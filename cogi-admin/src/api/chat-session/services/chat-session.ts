import { mergeTenantWhere, parseOptionalPositiveInt, resolveCurrentTenantId, toText, whereByParam } from '../../../utils/tenant-scope';

const CHAT_SESSION_UID = 'api::chat-session.chat-session';
const CHAT_MESSAGE_UID = 'api::chat-message.chat-message';

class ChatSessionAdminError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toRequiredText(value: unknown, label: string): string {
  const text = toText(value);
  if (!text) {
    throw new ChatSessionAdminError(400, `${label} is required`);
  }
  return text;
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toSessionStatus(value: unknown): 'OPEN' | 'CLOSED' {
  return toText(value).toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN';
}

function toLeadStatus(value: unknown): 'NEW' | 'CONTACTED' | 'CONVERTED' | 'IGNORED' {
  const normalized = toText(value).toUpperCase();
  if (normalized === 'CONTACTED' || normalized === 'CONVERTED' || normalized === 'IGNORED') return normalized;
  return 'NEW';
}

function isValidEmail(value: unknown): boolean {
  const email = toText(value).toLowerCase();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractPayload(body: any): Record<string, unknown> {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
}

function normalizeMessage(row: any) {
  return {
    id: row?.id,
    documentId: row?.documentId || null,
    role: row?.role || 'assistant',
    content: row?.content || '',
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
  };
}

function normalizeSession(row: any, latestMessage: any = null) {
  return {
    id: row?.id,
    documentId: row?.documentId || null,
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
    latestMessage: latestMessage ? normalizeMessage(latestMessage) : null,
  };
}

async function findChatSessionOrThrow(idParam: unknown, tenantId: number | string) {
  const where = whereByParam(idParam);
  if (!where) {
    throw new ChatSessionAdminError(404, 'Chat session not found');
  }

  const session = await strapi.db.query(CHAT_SESSION_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });

  if (!session?.id) {
    throw new ChatSessionAdminError(404, 'Chat session not found');
  }

  return session;
}

async function loadMessagesBySession(sessionId: number | string) {
  const rows = await strapi.db.query(CHAT_MESSAGE_UID).findMany({
    where: {
      session: { id: { $eq: sessionId } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return (rows || []).map((item: any) => normalizeMessage(item));
}

async function loadLatestMessageMap(sessionIds: number[]) {
  const map = new Map<number, any>();
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) return map;

  const rows = await strapi.db.query(CHAT_MESSAGE_UID).findMany({
    where: {
      session: { id: { $in: sessionIds } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    populate: {
      session: {
        select: ['id'],
      },
    },
  });

  for (const row of rows || []) {
    const sessionId = Number(row?.session?.id || row?.session || 0);
    if (!sessionId || map.has(sessionId)) continue;
    map.set(sessionId, row);
  }

  return map;
}

function buildKeywordWhere(keyword: string) {
  if (!keyword) return null;
  return {
    $or: [
      { visitorName: { $containsi: keyword } },
      { visitorPhone: { $containsi: keyword } },
      { visitorEmail: { $containsi: keyword } },
      { sourcePage: { $containsi: keyword } },
    ],
  };
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function listChatSessions(query: Record<string, unknown> = {}, tenantId: number | string) {
  const keyword = toText(query?.keyword || query?.q).trim();
  const status = toText(query?.chatSessionStatus || query?.status).toUpperCase();
  const leadStatus = toText(query?.chatLeadStatus || query?.leadStatus).toUpperCase();
  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 20));
  const whereClauses: Array<Record<string, unknown>> = [];

  const keywordWhere = buildKeywordWhere(keyword);
  if (keywordWhere) whereClauses.push(keywordWhere);
  if (status === 'OPEN' || status === 'CLOSED') whereClauses.push({ chatSessionStatus: status });
  if (['NEW', 'CONTACTED', 'CONVERTED', 'IGNORED'].includes(leadStatus)) whereClauses.push({ chatLeadStatus: leadStatus });

  const baseWhere = whereClauses.length > 0 ? { $and: whereClauses } : {};
  const where = mergeTenantWhere(baseWhere, tenantId);

  const [rows, total] = await Promise.all([
    strapi.db.query(CHAT_SESSION_UID).findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(CHAT_SESSION_UID).count({ where }),
  ]);

  const ids = (rows || []).map((item: any) => Number(item?.id || 0)).filter((id) => id > 0);
  const latestMessageMap = await loadLatestMessageMap(ids);

  return {
    data: (rows || []).map((item: any) => normalizeSession(item, latestMessageMap.get(Number(item?.id || 0)) || null)),
    pagination: {
      page,
      pageSize,
      total: Number(total || 0),
      pageCount: Math.max(1, Math.ceil(Number(total || 0) / pageSize)),
    },
  };
}

export async function getChatSessionDetail(idParam: unknown, tenantId: number | string) {
  const session = await findChatSessionOrThrow(idParam, tenantId);
  const messages = await loadMessagesBySession(session.id);

  return {
    session: normalizeSession(session),
    messages,
  };
}

export async function updateChatSession(idParam: unknown, body: Record<string, unknown>, tenantId: number | string) {
  const session = await findChatSessionOrThrow(idParam, tenantId);
  const payload = extractPayload(body);
  const visitorEmail = toNullableText(payload.visitorEmail);
  if (visitorEmail && !isValidEmail(visitorEmail)) {
    throw new ChatSessionAdminError(400, 'visitorEmail is invalid');
  }

  const updated = await strapi.db.query(CHAT_SESSION_UID).update({
    where: { id: session.id },
    data: {
      visitorName: toNullableText(payload.visitorName),
      visitorPhone: toNullableText(payload.visitorPhone),
      visitorEmail,
      chatSessionStatus: payload.chatSessionStatus !== undefined || payload.status !== undefined
        ? toSessionStatus(payload.chatSessionStatus ?? payload.status)
        : session.chatSessionStatus,
      chatLeadStatus: payload.chatLeadStatus !== undefined || payload.leadStatus !== undefined
        ? toLeadStatus(payload.chatLeadStatus ?? payload.leadStatus)
        : session.chatLeadStatus,
    },
    populate: {
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });

  const messages = await loadMessagesBySession(session.id);
  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  return normalizeSession(updated, latestMessage);
}

export async function createAdminReply(idParam: unknown, body: Record<string, unknown>, tenantId: number | string) {
  const session = await findChatSessionOrThrow(idParam, tenantId);
  const payload = extractPayload(body);
  const content = toRequiredText(payload.content, 'content');
  const tenantRef = session?.tenant?.id || session?.tenant;
  if (!tenantRef) {
    throw new ChatSessionAdminError(400, 'Chat session tenant is invalid');
  }

  await strapi.db.query(CHAT_MESSAGE_UID).create({
    data: {
      tenant: tenantRef,
      session: session.id,
      role: 'admin',
      content,
    },
  });

  let updatedSession = session;
  if (String(session.chatSessionStatus || '').toUpperCase() === 'CLOSED') {
    updatedSession = await strapi.db.query(CHAT_SESSION_UID).update({
      where: { id: session.id },
      data: {
        chatSessionStatus: 'OPEN',
      },
      populate: {
        tenant: {
          select: ['id', 'code', 'name'],
        },
      },
    });
  }

  const messages = await loadMessagesBySession(session.id);
  return {
    session: normalizeSession(updatedSession, messages.length > 0 ? messages[messages.length - 1] : null),
    messages,
  };
}
