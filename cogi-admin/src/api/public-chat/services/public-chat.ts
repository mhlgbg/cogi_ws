import { whereByParam } from '../../../utils/tenant-scope';
import { generateAssistantReply } from './ai-chat';

// Helper: read tenant chat widget config
async function getChatWidgetConfig(tenantId: number | string) {
  try {
    const row = await strapi.db.query('api::tenant-config.tenant-config').findOne({
      where: {
        key: { $eq: 'chatWidgetConfig' },
        tenant: tenantId,
      },
    });
    return (row && row.jsonContent) ? row.jsonContent : null;
  } catch (err) {
    strapi.log.warn('[public-chat] getChatWidgetConfig error', err?.message || err);
    return null;
  }
}

function getOriginHostFromCtx(ctx: any) {
  try {
    const originHeader = String(ctx?.request?.header?.origin || ctx?.request?.header?.referer || '').trim();
    if (!originHeader) return '';
    try {
      return new URL(originHeader).hostname || '';
    } catch {
      // fallback: normalize host
      const withoutProto = originHeader.replace(/^https?:\/\//, '');
      return withoutProto.split('/')[0].split(':')[0];
    }
  } catch {
    return '';
  }
}

function validateChatWidgetDomain(config: any, ctx: any) {
  // returns { allowed: boolean, reason?: string, originHost }
  const originHost = getOriginHostFromCtx(ctx);
  // try to capture host:port when possible for more accurate matching
  let originHostWithPort = '';
  try {
    const originHeader = String(ctx?.request?.header?.origin || ctx?.request?.header?.referer || '').trim();
    if (originHeader) {
      try {
        originHostWithPort = new URL(originHeader).host || '';
      } catch {
        const withoutProto = originHeader.replace(/^https?:\/\//, '');
        originHostWithPort = withoutProto.split('/')[0];
      }
    }
  } catch {
    originHostWithPort = '';
  }
  if (!config) {
    // no config - treat as not allowed when originHost present
    if (originHost) return { allowed: false, reason: 'no-config', originHost, originHostWithPort };
    return { allowed: true, originHost };
  }

  const enabled = config && (config.enabled === true || String(config.enabled).toLowerCase() === 'true');
  if (!enabled) return { allowed: false, reason: 'disabled', originHost };

  const allowedDomains = Array.isArray(config.allowedDomains) ? config.allowedDomains.map((s: any) => String(s || '').toLowerCase().trim()) : [];
  if (!originHost) return { allowed: true, originHost };

  const hostLower = originHost.toLowerCase();
  const hostWithPortLower = String(originHostWithPort || '').toLowerCase();

  // Accept when allowedDomains contains either hostname or host:port, or when allowedDomains entries includes hostname part
  if (allowedDomains.includes(hostLower) || (hostWithPortLower && allowedDomains.includes(hostWithPortLower))) {
    return { allowed: true, originHost };
  }

  // also compare by stripping port from allowedDomains entries
  const allowedStripped = allowedDomains.map((d: string) => d.split(':')[0]);
  if (allowedStripped.includes(hostLower)) {
    return { allowed: true, originHost };
  }

  // not allowed
  strapi.log.info('[public-chat] domain validation failed', { originHost, originHostWithPort, allowedDomains });
  return { allowed: false, reason: 'domain-not-allowed', originHost, originHostWithPort };
}

const TENANT_UID = 'api::tenant.tenant';
const CHAT_SESSION_UID = 'api::chat-session.chat-session';
const CHAT_MESSAGE_UID = 'api::chat-message.chat-message';
const USER_MESSAGE_RATE_LIMIT_MS = 3000;
const MAX_USER_MESSAGES_PER_SESSION = 50;

const LOW_VALUE_CONFIRMATION_KEYWORDS = new Set([
  'ok',
  'oke',
  'okay',
  'vang',
  'da',
  'uh',
  'uhm',
]);

const LOW_VALUE_THANKS_KEYWORDS = new Set([
  'cam on',
  'thanks',
  'thank you',
]);

const LOW_VALUE_EMOJI_KEYWORDS = new Set(['👍', '👌']);

class PublicChatError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeKeywordText(value: unknown): string {
  return toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'Đ' ? 'D' : 'd'))
    .toLowerCase();
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toRequiredText(value: unknown, label: string): string {
  const text = toText(value);
  if (!text) {
    throw new PublicChatError(400, `${label} is required`);
  }
  return text;
}

function isValidEmail(value: unknown): boolean {
  const email = toText(value).toLowerCase();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeVnPhoneCandidate(value: unknown): string {
  const digits = toText(value).replace(/[^0-9+]/g, '');
  if (!digits) return '';

  if (/^(\+84|84|0)(3|5|7|8|9)\d{8}$/.test(digits)) return digits;
  return '';
}

function extractVietnamesePhoneFromContent(value: unknown): string {
  const source = toText(value);
  if (!source) return '';

  const matches = source.match(/(?:\+84|84|0)(?:\s|\.|-)?(?:3|5|7|8|9)(?:[\s.-]?\d){8}/g) || [];
  for (const candidate of matches) {
    const normalized = normalizeVnPhoneCandidate(candidate);
    if (normalized) return normalized;
  }
  return '';
}

function extractEmailFromContent(value: unknown): string {
  const source = toText(value).toLowerCase();
  if (!source) return '';

  const matches = source.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  for (const candidate of matches) {
    if (isValidEmail(candidate)) {
      return candidate;
    }
  }

  return '';
}

function normalizeLowValueMessage(value: unknown): string {
  return normalizeKeywordText(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function getLowValueReplyContent(content: unknown): string | null {
  const rawText = toText(content).replace(/\s+/g, ' ').trim();
  const normalized = normalizeLowValueMessage(content);

  if (!rawText) return null;

  if (LOW_VALUE_EMOJI_KEYWORDS.has(rawText)) {
    return 'Dạ vâng ạ. Anh/Chị cần em hỗ trợ thêm thông tin gì không?';
  }

  if (LOW_VALUE_THANKS_KEYWORDS.has(normalized)) {
    return 'Rất vui được hỗ trợ Anh/Chị. Nếu cần thêm thông tin, Anh/Chị cứ nhắn cho em nhé.';
  }

  if (LOW_VALUE_CONFIRMATION_KEYWORDS.has(normalized) || normalized === 'u' || normalized === 'uk') {
    return 'Dạ vâng ạ. Anh/Chị cần em hỗ trợ thêm thông tin gì không?';
  }

  return null;
}

function buildSessionWhere(id: unknown) {
  const where = whereByParam(id);
  if (!where) {
    throw new PublicChatError(400, 'sessionId is invalid');
  }
  return where;
}

function normalizeSession(row: any) {
  return {
    id: row?.id,
    documentId: row?.documentId || null,
    tenant: row?.tenant
      ? {
          id: row.tenant.id,
          code: row.tenant.code || '',
          name: row.tenant.name || '',
        }
      : null,
    visitorName: row?.visitorName || '',
    visitorPhone: row?.visitorPhone || '',
    visitorEmail: row?.visitorEmail || '',
    sourcePage: row?.sourcePage || '',
    chatSessionStatus: row?.chatSessionStatus || 'OPEN',
    chatLeadStatus: row?.chatLeadStatus || 'NEW',
    status: row?.chatSessionStatus || 'OPEN',
    leadStatus: row?.chatLeadStatus || 'NEW',
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
  };
}

function normalizeMessage(row: any) {
  return {
    id: row?.id,
    documentId: row?.documentId || null,
    role: row?.role || 'assistant',
    content: row?.content || '',
    displayName: row?.displayName || null,
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
  };
}

function resolveAssistantDisplayName(tenant: any): string {
  const tenantCode = toText(tenant?.code);
  if (tenantCode) return tenantCode;

  const tenantName = toText(tenant?.name);
  if (tenantName) return tenantName;

  return 'COGI';
}

async function fetchAssistantDisplayNameForTenant(tenantId: number | string, tenantObj?: any): Promise<string> {
  try {
    let tenant = tenantObj || null;
    if (!tenant) {
      tenant = await strapi.db.query(TENANT_UID).findOne({ where: { id: tenantId }, select: ['id', 'code', 'name'] });
    }

    const rows = await strapi.db.query('api::ai-assistant.ai-assistant').findMany({
      where: { tenant: tenantId },
      orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      limit: 1,
    });
    const ai = Array.isArray(rows) ? rows[0] || null : rows;
    if (ai && (ai.assistantName || ai.name)) return String(ai.assistantName || ai.name).trim();
    return resolveAssistantDisplayName(tenant);
  } catch (err) {
    try {
      const tenant = await strapi.db.query(TENANT_UID).findOne({ where: { id: tenantId }, select: ['id', 'code', 'name'] });
      return resolveAssistantDisplayName(tenant);
    } catch {
      return 'COGI';
    }
  }
}

async function buildAssistantGreeting(tenant: any): Promise<string> {
  // Prefer tenant-scoped AI assistant display name when available
  try {
    const aiRow = (await strapi.db.query('api::ai-assistant.ai-assistant').findMany({
      where: { tenant: tenant?.id || tenant },
      orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      limit: 1,
    })) || [];
    const ai = Array.isArray(aiRow) ? aiRow[0] || null : aiRow;
    const assistantName = (ai && (ai.assistantName || ai.name)) ? String(ai.assistantName || ai.name).trim() : resolveAssistantDisplayName(tenant);
    return `Xin chào, ${assistantName} có thể hỗ trợ gì cho Anh/Chị hôm nay?`;
  } catch (e) {
    const assistantName = resolveAssistantDisplayName(tenant);
    return `Xin chào, ${assistantName} có thể hỗ trợ gì cho Anh/Chị hôm nay?`;
  }
}

async function findTenantByCodeOrSlug(input: { tenantCode?: unknown; tenantSlug?: unknown }) {
  const tenantCode = toText(input?.tenantCode).toLowerCase();
  const tenantSlug = toText(input?.tenantSlug).toLowerCase();
  const candidates = [tenantCode, tenantSlug].filter(Boolean);
  if (candidates.length === 0) {
    throw new PublicChatError(400, 'tenantCode or tenantSlug is required');
  }

  for (const candidate of candidates) {
    const tenant = await strapi.db.query(TENANT_UID).findOne({
      where: {
        code: { $eqi: candidate },
        tenantStatus: 'active',
      },
      select: ['id', 'code', 'name', 'tenantStatus'],
    });

    if (tenant?.id) return tenant;
  }

  return null;
}

async function createAssistantMessage(tenantId: number | string, sessionId: number | string, content: string) {
  return strapi.db.query(CHAT_MESSAGE_UID).create({
    data: {
      tenant: tenantId,
      session: sessionId,
      role: 'assistant',
      content,
    },
  });
}

async function loadSessionOrThrow(sessionId: unknown) {
  const where = buildSessionWhere(sessionId);
  const session = await strapi.db.query(CHAT_SESSION_UID).findOne({
    where,
    populate: {
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });

  if (!session?.id) {
    throw new PublicChatError(404, 'Chat session not found');
  }

  return session;
}

async function listMessagesBySession(sessionId: unknown) {
  const where = buildSessionWhere(sessionId);
  const session = await strapi.db.query(CHAT_SESSION_UID).findOne({ where, select: ['id'] });
  if (!session?.id) {
    throw new PublicChatError(404, 'Chat session not found');
  }

  const rows = await strapi.db.query(CHAT_MESSAGE_UID).findMany({
    where: {
      session: { id: { $eq: session.id } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return (rows || []).map((item: any) => normalizeMessage(item));
}

async function listRecentMessagesBySession(sessionId: unknown, limit = 20) {
  const where = buildSessionWhere(sessionId);
  const session = await strapi.db.query(CHAT_SESSION_UID).findOne({ where, select: ['id'] });
  if (!session?.id) {
    throw new PublicChatError(404, 'Chat session not found');
  }

  const rows = await strapi.db.query(CHAT_MESSAGE_UID).findMany({
    where: {
      session: { id: { $eq: session.id } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    limit,
  });

  return (rows || []).slice().reverse().map((item: any) => normalizeMessage(item));
}

async function getLatestUserMessageBySession(sessionId: unknown) {
  const where = buildSessionWhere(sessionId);
  const session = await strapi.db.query(CHAT_SESSION_UID).findOne({ where, select: ['id'] });
  if (!session?.id) {
    throw new PublicChatError(404, 'Chat session not found');
  }

  const rows = await strapi.db.query(CHAT_MESSAGE_UID).findMany({
    where: {
      session: { id: { $eq: session.id } },
      role: 'user',
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    limit: 1,
  });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function countUserMessagesBySession(sessionId: unknown) {
  const where = buildSessionWhere(sessionId);
  const session = await strapi.db.query(CHAT_SESSION_UID).findOne({ where, select: ['id'] });
  if (!session?.id) {
    throw new PublicChatError(404, 'Chat session not found');
  }

  const rows = await strapi.db.query(CHAT_MESSAGE_UID).findMany({
    where: {
      session: { id: { $eq: session.id } },
      role: 'user',
    },
    select: ['id'],
  });

  return Array.isArray(rows) ? rows.length : 0;
}

function buildAssistantReply(content: string, tenant: any) {
  const assistantName = resolveAssistantDisplayName(tenant);
  const normalized = normalizeKeywordText(content);
  const phone = extractVietnamesePhoneFromContent(content);
  if (phone) {
    return `Cảm ơn Anh/Chị. ${assistantName} đã ghi nhận số điện thoại và sẽ liên hệ lại trong thời gian sớm nhất.`;
  }

  if (/(hoc|lop|khoa hoc|chuong trinh)/.test(normalized)) {
    return `${assistantName} đã ghi nhận nhu cầu học tập của Anh/Chị. Anh/Chị vui lòng để lại số điện thoại để bộ phận tư vấn liên hệ chi tiết hơn.`;
  }

  if (/(dang ky|tuyen sinh|tu van)/.test(normalized)) {
    return `${assistantName} đã ghi nhận thông tin. Anh/Chị vui lòng để lại số điện thoại hoặc email để được hỗ trợ đăng ký.`;
  }

  return `Cảm ơn Anh/Chị đã nhắn tin. Anh/Chị có thể để lại số điện thoại để ${assistantName} tư vấn cụ thể hơn.`;
}

export async function createPublicChatSession(body: Record<string, unknown>, ctx?: any) {
  const tenant = await findTenantByCodeOrSlug(body);
  if (!tenant?.id) {
    throw new PublicChatError(404, 'Tenant not found');
  }

  const visitorEmail = toNullableText(body.visitorEmail);
  if (visitorEmail && !isValidEmail(visitorEmail)) {
    throw new PublicChatError(400, 'visitorEmail is invalid');
  }

  // Read tenant config and validate domain / enabled flags
  const config = await getChatWidgetConfig(tenant.id);
  const validation = validateChatWidgetDomain(config, ctx);
  if (!validation.allowed) {
    if (validation.reason === 'domain-not-allowed') {
      throw new PublicChatError(403, 'Domain is not allowed.');
    }
    throw new PublicChatError(403, 'Chat widget is disabled.');
  }

  const session = await strapi.db.query(CHAT_SESSION_UID).create({
    data: {
      tenant: tenant.id,
      visitorName: toNullableText(body.visitorName),
      visitorPhone: toNullableText(body.visitorPhone),
      visitorEmail,
      sourcePage: toNullableText(body.sourcePage),
      chatSessionStatus: 'OPEN',
      chatLeadStatus: 'NEW',
    },
    populate: {
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });

  // If widget available flag is false, return offline assistant message and mark widgetStatus
  const widgetAvailable = Boolean(config?.available === true);
  if (!widgetAvailable) {
    const offline = String((config && config.offlineMessage) ? config.offlineMessage : await buildAssistantGreeting(tenant));
    const greeting = await createAssistantMessage(tenant.id, session.id, offline);
    const assistantDisplayName = await fetchAssistantDisplayNameForTenant(tenant.id, tenant);
    const message = normalizeMessage(greeting);
    if (message.role === 'assistant') message.displayName = assistantDisplayName;
    return {
      session: normalizeSession(session),
      messages: [message],
      widgetStatus: 'OFFLINE',
    };
  }

  const greeting = await createAssistantMessage(tenant.id, session.id, await buildAssistantGreeting(tenant));
  const assistantDisplayName = await fetchAssistantDisplayNameForTenant(tenant.id, tenant);
  const message = normalizeMessage(greeting);
  if (message.role === 'assistant') message.displayName = assistantDisplayName;

  return {
    session: normalizeSession(session),
    messages: [message],
  };
}

export async function createPublicChatMessage(body: Record<string, unknown>, ctx?: any) {
  const sessionId = toRequiredText(body.sessionId, 'sessionId');
  const content = toRequiredText(body.content, 'content');
  const session = await loadSessionOrThrow(sessionId);

  if (String(session.chatSessionStatus || '').toUpperCase() === 'CLOSED') {
    throw new PublicChatError(400, 'Hội thoại đã đóng');
  }

  const tenantId = session?.tenant?.id || session?.tenant;
  if (!tenantId) {
    throw new PublicChatError(400, 'Chat session tenant is invalid');
  }

  // enforce chatWidgetConfig for messages as well
  const config = await getChatWidgetConfig(tenantId);
  const validation = validateChatWidgetDomain(config, ctx);
  if (!validation.allowed) {
    if (validation.reason === 'domain-not-allowed') {
      throw new PublicChatError(403, 'Domain is not allowed.');
    }
    throw new PublicChatError(403, 'Chat widget is disabled.');
  }

  const latestUserMessage = await getLatestUserMessageBySession(session.id);
  if (latestUserMessage?.createdAt) {
    const latestUserMessageTime = new Date(latestUserMessage.createdAt).getTime();
    if (Number.isFinite(latestUserMessageTime) && Date.now() - latestUserMessageTime < USER_MESSAGE_RATE_LIMIT_MS) {
      strapi.log.info('[public-chat.createMessage] rate limited, skip new user message');
      throw new PublicChatError(429, 'Vui lòng chờ vài giây trước khi gửi tiếp.');
    }
  }

  const userMessageCount = await countUserMessagesBySession(session.id);
  if (userMessageCount >= MAX_USER_MESSAGES_PER_SESSION) {
    strapi.log.info('[public-chat.createMessage] max user messages reached, reject new user message');
    throw new PublicChatError(429, 'Hội thoại đã đạt giới hạn. Anh/Chị vui lòng để lại số điện thoại để được tư vấn tiếp.');
  }

  await strapi.db.query(CHAT_MESSAGE_UID).create({
    data: {
      tenant: tenantId,
      session: session.id,
      role: 'user',
      content,
    },
  });

  const extractedPhone = extractVietnamesePhoneFromContent(content);
  const extractedEmail = extractEmailFromContent(content);
  const sessionUpdateData: Record<string, unknown> = {};

  if (extractedPhone && !toText(session.visitorPhone)) {
    sessionUpdateData.visitorPhone = extractedPhone;
  }

  if (extractedEmail && !toText(session.visitorEmail)) {
    sessionUpdateData.visitorEmail = extractedEmail;
  }

  let nextSession = session;
  if (Object.keys(sessionUpdateData).length > 0) {
    await strapi.db.query(CHAT_SESSION_UID).update({
      where: { id: session.id },
      data: sessionUpdateData,
    });

    nextSession = {
      ...session,
      ...sessionUpdateData,
    };
  }

  // If widget is offline (available=false), save user message and reply with offlineMessage without calling AI
  const widgetAvailable = Boolean(config?.available === true);
  const recentMessages = await listRecentMessagesBySession(session.id, 20);
  if (!widgetAvailable) {
    const offline = String((config && config.offlineMessage) ? config.offlineMessage : 'Hệ thống tư vấn đang tạm thời đi vắng.');
    await createAssistantMessage(tenantId, session.id, offline);

    {
      const msgs = await listMessagesBySession(session.id);
      const assistantDisplayName = await fetchAssistantDisplayNameForTenant(tenantId);
      const mapped = (msgs || []).map((m: any) => (m && m.role === 'assistant') ? { ...m, displayName: assistantDisplayName } : m);
      return {
        session: normalizeSession(session),
        messages: mapped,
        widgetStatus: 'OFFLINE',
      };
    }
  }

  const lowValueReply = getLowValueReplyContent(content);

  if (lowValueReply) {
    strapi.log.info('[public-chat.createMessage] low-value message, skip AI reply');
    await createAssistantMessage(tenantId, session.id, lowValueReply);

    {
      const msgs = await listMessagesBySession(session.id);
      const assistantDisplayName = await fetchAssistantDisplayNameForTenant(tenantId);
      const mapped = (msgs || []).map((m: any) => (m && m.role === 'assistant') ? { ...m, displayName: assistantDisplayName } : m);
      return {
        session: normalizeSession(nextSession),
        messages: mapped,
      };
    }
  }

  let assistantReplyContent = '';
  try {
    const aiReply = await generateAssistantReply({
      tenantId: nextSession?.tenant?.id || nextSession?.tenant,
      session: nextSession,
      messages: recentMessages,
      userMessage: content,
    });

    assistantReplyContent = toText(aiReply?.content);
  } catch (error) {
    strapi.log.error('[public-chat.createMessage] AI reply failed, fallback scripted reply', error);
  }

  if (!assistantReplyContent) {
    assistantReplyContent = buildAssistantReply(content, nextSession?.tenant || null);
  }

  await createAssistantMessage(tenantId, session.id, assistantReplyContent);

  {
    const msgs = await listMessagesBySession(session.id);
    const assistantDisplayName = await fetchAssistantDisplayNameForTenant(tenantId);
    const mapped = (msgs || []).map((m: any) => (m && m.role === 'assistant') ? { ...m, displayName: assistantDisplayName } : m);
    return {
      session: normalizeSession(nextSession),
      messages: mapped,
    };
  }
}

export async function getPublicChatSessionMessages(sessionId: unknown, ctx?: any) {
  const session = await loadSessionOrThrow(sessionId);
  const tenantId = session?.tenant?.id || session?.tenant;
  if (!tenantId) {
    throw new PublicChatError(400, 'Chat session tenant is invalid');
  }

  const config = await getChatWidgetConfig(tenantId);
  const validation = validateChatWidgetDomain(config, ctx);
  if (!validation.allowed) {
    if (validation.reason === 'domain-not-allowed') {
      throw new PublicChatError(403, 'Domain is not allowed.');
    }
    throw new PublicChatError(403, 'Chat widget is disabled.');
  }

  const messages = await listMessagesBySession(sessionId);
  if (!(config && config.available === true)) {
    const assistantDisplayName = await fetchAssistantDisplayNameForTenant(session?.tenant?.id || session?.tenant);
    const mapped = (messages || []).map((m: any) => (m && m.role === 'assistant') ? { ...m, displayName: assistantDisplayName } : m);
    return { messages: mapped, widgetStatus: 'OFFLINE' };
  }

  const assistantDisplayName = await fetchAssistantDisplayNameForTenant(session?.tenant?.id || session?.tenant);
  return (messages || []).map((m: any) => (m && m.role === 'assistant') ? { ...m, displayName: assistantDisplayName } : m);
}

export async function getPublicChatWidgetStatus(payload: { tenantCode?: unknown; tenantSlug?: unknown }, ctx?: any) {
  const tenant = await findTenantByCodeOrSlug(payload || {});
  if (!tenant?.id) {
    throw new PublicChatError(404, 'Tenant not found');
  }
  const config = await getChatWidgetConfig(tenant.id);

  // If missing config or explicitly disabled, return the status payload with enabled=false
  const widgetEnabled = config && (config.enabled === true || String(config.enabled).toLowerCase() === 'true');
  if (!config || !widgetEnabled) {
    return {
      enabled: false,
      available: false,
      widgetTitle: String((config && config.widgetTitle) || ''),
      offlineMessage: String((config && config.offlineMessage) || ''),
    };
  }

  // For the public status endpoint we do not enforce allowedDomains here.
  // allowedDomains is enforced on session/message creation endpoints.
  return {
    enabled: true,
    available: Boolean(config.available === true),
    widgetTitle: String(config.widgetTitle || ''),
    offlineMessage: String(config.offlineMessage || ''),
  };
}
