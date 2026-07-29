import crypto from 'node:crypto';
import { computeMessageEffectiveStatus, createQuickMessageAccessLogEntry, validatePin } from './quick-message-admin';

const bcrypt = require('bcryptjs');

const QUICK_MESSAGE_ACCESS_UID = 'api::quick-message-access.quick-message-access';
const QUICK_MESSAGE_REPLY_UID = 'api::quick-message-reply.quick-message-reply';
const QUICK_MESSAGE_MESSAGE_UID = 'api::quick-message-message.quick-message-message';
const PUBLIC_REPLY_MAX_LENGTH = 5000;
const PUBLIC_REPLY_DUPLICATE_WINDOW_MS = 10 * 1000;

type QuickMessagePublicAccessTokenPayload = {
  scope: 'quick-message-public-access';
  iss: 'quick-message-public';
  accessId: number;
  messageId: number;
  code: string;
  accessVersion: number;
  iat: number;
  exp: number;
};

type QuickMessagePublicOpenResponse = {
  code: string;
  message: {
    title: string | null;
    content: string | null;
    links: Array<{ label: string | null; url: string }>;
    replyEnabled: boolean;
    replyMode: string | null;
    senderDisplayName: string | null;
    expiresAt: string | null;
  };
  access: {
    recipientName: string | null;
    expiresAt: string | null;
  };
  tenant: {
    name: string;
    logo: string | null;
    favicon: string | null;
    primaryColor: string | null;
  };
  openedAt: string;
};

type QuickMessagePublicAccessTokenContext = {
  code: string;
  effectiveStatus: string;
  access: any;
  tokenPayload: QuickMessagePublicAccessTokenPayload;
};

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getRelationId(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return String(value?.id ?? value?.documentId ?? '');
}

function extractMediaUrl(media: any): string | null {
  if (!media) return null;
  if (typeof media?.url === 'string' && media.url.trim()) return media.url.trim();
  if (typeof media?.attributes?.url === 'string' && media.attributes.url.trim()) return media.attributes.url.trim();
  if (typeof media?.data?.attributes?.url === 'string' && media.data.attributes.url.trim()) return media.data.attributes.url.trim();
  return null;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function getQuickMessagePublicTokenSecret(): string {
  const explicitSecret = toText(process.env.QUICK_MESSAGE_PUBLIC_TOKEN_SECRET);
  if (explicitSecret) return explicitSecret;

  const appKeys = (strapi as any)?.config?.get?.('server.app.keys');
  if (Array.isArray(appKeys) && typeof appKeys[0] === 'string' && appKeys[0].trim()) {
    return appKeys[0].trim();
  }
  if (typeof appKeys === 'string' && appKeys.trim()) {
    const first = appKeys.split(',').map((item: string) => item.trim()).find(Boolean);
    if (first) return first;
  }

  const envAppKeys = toText(process.env.APP_KEYS);
  if (envAppKeys) {
    const first = envAppKeys.split(',').map((item) => item.trim()).find(Boolean);
    if (first) return first;
  }

  const jwtSecret = toText(process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET);
  if (jwtSecret) return jwtSecret;

  return 'quick-message-public-secret';
}

function getQuickMessagePublicTokenTtlSeconds(): number {
  const rawMinutes = Number(process.env.QUICK_MESSAGE_PUBLIC_TOKEN_TTL_MINUTES || 30);
  if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) return 30 * 60;
  return Math.floor(rawMinutes * 60);
}

function buildPublicTenantBranding(tenant: any) {
  return {
    name: toText(tenant?.shortName) || toText(tenant?.name) || toText(tenant?.siteTitle) || 'COGI',
    logo: extractMediaUrl(tenant?.logo),
    favicon: extractMediaUrl(tenant?.favicon) || extractMediaUrl(tenant?.logo),
    primaryColor: toText(tenant?.primaryColor) || null,
  };
}

function sanitizePublicLinks(value: unknown): Array<{ label: string | null; url: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 10)
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const label = toText((item as any).label) || null;
      const url = toText((item as any).url);
      if (!url) return null;
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        return { label, url: parsed.toString() };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<{ label: string | null; url: string }>;
}

function serializePublicLookup(access: any, effectiveStatus: string) {
  const requiresPin = access?.requirePin === true;
  const hasPin = requiresPin && Boolean(toText(access?.pinHash));
  return {
    code: toText(access?.code).toUpperCase(),
    available: effectiveStatus === 'active',
    effectiveStatus,
    requiresPin,
    hasPin,
    tenant: buildPublicTenantBranding(access?.message?.tenant || access?.tenant || null),
  };
}

function buildOpenResponse(access: any, openedAt: string): QuickMessagePublicOpenResponse {
  const effectiveStatus = computeQuickMessagePublicLookupStatus(access?.message, access);
  return {
    code: toText(access?.code).toUpperCase(),
    message: {
      title: toText(access?.message?.title) || null,
      content: toText(access?.message?.content) || null,
      links: sanitizePublicLinks(access?.message?.links),
      replyEnabled: resolvePublicReplyEnabled(access, effectiveStatus),
      replyMode: toText(access?.message?.replyMode) || null,
      senderDisplayName: toText(access?.message?.senderDisplayName) || null,
      expiresAt: access?.message?.expiresAt || null,
    },
    access: {
      recipientName: toText(access?.recipientName) || null,
      expiresAt: access?.expiresAt || null,
    },
    tenant: buildPublicTenantBranding(access?.message?.tenant || access?.tenant || null),
    openedAt,
  };
}

export class QuickMessagePublicError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function normalizeQuickMessageAccessCode(value: unknown): string {
  const normalized = toText(value).toUpperCase();
  if (!normalized) {
    throw new QuickMessagePublicError(400, 'QUICK_MESSAGE_INVALID_CODE', 'Mã truy cập không hợp lệ.');
  }
  if (!/^[A-Z0-9]{6,12}$/.test(normalized)) {
    throw new QuickMessagePublicError(400, 'QUICK_MESSAGE_INVALID_CODE', 'Mã truy cập không hợp lệ.');
  }
  return normalized;
}

export function computeQuickMessagePublicLookupStatus(message: any, access: any, now = new Date()) {
  const messageStatus = computeMessageEffectiveStatus(message, now);
  if (messageStatus === 'cancelled') return 'message_cancelled';
  if (messageStatus === 'locked') return 'message_locked';
  if (messageStatus === 'draft') return 'message_draft';
  if (messageStatus === 'expired') return 'message_expired';

  const accessStatus = toText(access?.status).toLowerCase();
  if (accessStatus === 'cancelled') return 'access_cancelled';
  if (accessStatus === 'locked') return 'access_locked';

  const accessExpiresAt = access?.expiresAt ? new Date(access.expiresAt) : null;
  if (accessExpiresAt && !Number.isNaN(accessExpiresAt.getTime()) && accessExpiresAt.getTime() <= now.getTime()) {
    return 'access_expired';
  }

  const maxViews = Number(access?.maxViews || 0);
  const viewCount = Number(access?.viewCount || 0);
  if (maxViews > 0 && viewCount >= maxViews) {
    return 'max_views_reached';
  }

  return 'active';
}

function signQuickMessagePublicTokenPayload(payload: QuickMessagePublicAccessTokenPayload): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', getQuickMessagePublicTokenSecret()).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function issueQuickMessagePublicAccessToken(access: any): { accessToken: string; expiresIn: number; payload: QuickMessagePublicAccessTokenPayload } {
  const accessId = toPositiveInt(access?.id);
  const messageId = toPositiveInt(access?.message?.id || access?.message);
  const accessVersion = Number(access?.accessVersion || 0);
  const code = toText(access?.code).toUpperCase();

  if (!accessId || !messageId || !code || !Number.isInteger(accessVersion) || accessVersion <= 0) {
    throw new QuickMessagePublicError(500, 'QUICK_MESSAGE_TOKEN_ISSUE_FAILED', 'Không thể cấp quyền truy cập vào lúc này.');
  }

  const expiresIn = getQuickMessagePublicTokenTtlSeconds();
  const iat = Math.floor(Date.now() / 1000);
  const payload: QuickMessagePublicAccessTokenPayload = {
    scope: 'quick-message-public-access',
    iss: 'quick-message-public',
    accessId,
    messageId,
    code,
    accessVersion,
    iat,
    exp: iat + expiresIn,
  };

  return {
    accessToken: signQuickMessagePublicTokenPayload(payload),
    expiresIn,
    payload,
  };
}

export function verifyQuickMessagePublicAccessToken(token: string): QuickMessagePublicAccessTokenPayload {
  const normalizedToken = toText(token);
  if (!normalizedToken || !normalizedToken.includes('.')) {
    throw new QuickMessagePublicError(401, 'QUICK_MESSAGE_ACCESS_TOKEN_INVALID', 'Token truy cập không hợp lệ.');
  }

  const [encodedPayload, signature] = normalizedToken.split('.');
  const expectedSignature = crypto.createHmac('sha256', getQuickMessagePublicTokenSecret()).update(encodedPayload).digest('base64url');
  if (signature.length !== expectedSignature.length) {
    throw new QuickMessagePublicError(401, 'QUICK_MESSAGE_ACCESS_TOKEN_INVALID', 'Token truy cập không hợp lệ.');
  }

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!isValid) {
    throw new QuickMessagePublicError(401, 'QUICK_MESSAGE_ACCESS_TOKEN_INVALID', 'Token truy cập không hợp lệ.');
  }

  let parsed: QuickMessagePublicAccessTokenPayload | null = null;
  try {
    parsed = JSON.parse(fromBase64Url(encodedPayload)) as QuickMessagePublicAccessTokenPayload;
  } catch {
    throw new QuickMessagePublicError(401, 'QUICK_MESSAGE_ACCESS_TOKEN_INVALID', 'Token truy cập không hợp lệ.');
  }

  if (parsed?.scope !== 'quick-message-public-access' || parsed?.iss !== 'quick-message-public') {
    throw new QuickMessagePublicError(401, 'QUICK_MESSAGE_ACCESS_TOKEN_INVALID', 'Token truy cập không hợp lệ.');
  }
  if (!parsed?.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new QuickMessagePublicError(410, 'QUICK_MESSAGE_ACCESS_TOKEN_EXPIRED', 'Token truy cập đã hết hạn.');
  }

  return parsed;
}

export function validateQuickMessagePublicAccessTokenAgainstAccess(tokenPayload: QuickMessagePublicAccessTokenPayload, access: any) {
  const accessId = toPositiveInt(access?.id);
  const messageId = toPositiveInt(access?.message?.id || access?.message);
  const accessVersion = Number(access?.accessVersion || 0);
  const code = toText(access?.code).toUpperCase();

  if (
    tokenPayload?.scope !== 'quick-message-public-access'
    || tokenPayload?.accessId !== accessId
    || tokenPayload?.messageId !== messageId
    || tokenPayload?.accessVersion !== accessVersion
    || tokenPayload?.code !== code
  ) {
    throw new QuickMessagePublicError(401, 'QUICK_MESSAGE_ACCESS_TOKEN_INVALID', 'Token truy cập không hợp lệ.');
  }

  return true;
}

async function findQuickMessageAccessByCode(codeParam: unknown) {
  const code = normalizeQuickMessageAccessCode(codeParam);
  const access = await strapi.db.query(QUICK_MESSAGE_ACCESS_UID).findOne({
    where: {
      code: {
        $eq: code,
      },
    },
    select: ['id', 'documentId', 'code', 'label', 'recipientName', 'requirePin', 'pinHash', 'status', 'expiresAt', 'maxViews', 'viewCount', 'firstViewedAt', 'lastViewedAt', 'accessVersion'],
    populate: {
      tenant: {
        select: ['id', 'name', 'shortName', 'siteTitle', 'primaryColor'],
        populate: {
          logo: { select: ['url'] },
          favicon: { select: ['url'] },
        },
      },
      message: {
        select: ['id', 'title', 'content', 'links', 'status', 'expiresAt', 'allowReply', 'replyMode', 'senderDisplayName'],
        populate: {
          tenant: {
            select: ['id', 'name', 'shortName', 'siteTitle', 'primaryColor'],
            populate: {
              logo: { select: ['url'] },
              favicon: { select: ['url'] },
            },
          },
        },
      },
    },
  });

  if (!access?.id) {
    throw new QuickMessagePublicError(404, 'QUICK_MESSAGE_NOT_FOUND', 'Mã truy cập không tồn tại hoặc không còn khả dụng.');
  }

  const accessTenantId = getRelationId(access?.tenant);
  const messageTenantId = getRelationId(access?.message?.tenant);
  if (!accessTenantId || !messageTenantId || accessTenantId !== messageTenantId) {
    strapi.log.error('[quick-message.public.lookup] tenant mismatch', {
      accessId: access?.id || null,
      code,
      accessTenantId: accessTenantId || null,
      messageTenantId: messageTenantId || null,
    });
    throw new QuickMessagePublicError(500, 'QUICK_MESSAGE_LOOKUP_FAILED', 'Không thể tra cứu mã truy cập vào lúc này.');
  }

  return access;
}

function assertQuickMessageAccessAvailableForToken(access: any) {
  const effectiveStatus = computeQuickMessagePublicLookupStatus(access?.message, access);
  if (effectiveStatus !== 'active') {
    throw new QuickMessagePublicError(409, 'QUICK_MESSAGE_NOT_AVAILABLE', 'Thông điệp hiện không còn khả dụng.');
  }
  return effectiveStatus;
}

export async function lookupQuickMessageAccessPublic(codeParam: unknown) {
  const access = await findQuickMessageAccessByCode(codeParam);
  const effectiveStatus = computeQuickMessagePublicLookupStatus(access?.message, access);
  await createQuickMessageAccessLogEntry({
    tenantId: access?.message?.tenant?.id || access?.tenant?.id,
    messageId: access?.message?.id,
    accessId: access?.id,
    eventType: 'LOOKUP',
    success: effectiveStatus === 'active',
    metadata: {
      effectiveStatus,
      requiresPin: access?.requirePin === true,
    },
  });
  return serializePublicLookup(access, effectiveStatus);
}

export async function verifyQuickMessageAccessPinPublic(codeParam: unknown, body: Record<string, unknown>) {
  const access = await findQuickMessageAccessByCode(codeParam);
  assertQuickMessageAccessAvailableForToken(access);

  if (access?.requirePin !== true) {
    throw new QuickMessagePublicError(409, 'PIN_NOT_REQUIRED', 'Mã truy cập này không yêu cầu PIN.');
  }
  if (!toText(access?.pinHash)) {
    strapi.log.error('[quick-message.public.verify-pin] missing pin hash', { accessId: access?.id || null, code: access?.code || null });
    throw new QuickMessagePublicError(500, 'QUICK_MESSAGE_VERIFY_FAILED', 'Không thể xác minh mã truy cập vào lúc này.');
  }

  const pin = validatePin(body?.pin);
  const matched = await bcrypt.compare(pin, access.pinHash);
  if (!matched) {
    await createQuickMessageAccessLogEntry({
      tenantId: access?.message?.tenant?.id || access?.tenant?.id,
      messageId: access?.message?.id,
      accessId: access?.id,
      eventType: 'VERIFY_PIN_FAILED',
      success: false,
    });
    throw new QuickMessagePublicError(401, 'INVALID_PIN', 'PIN không đúng. Vui lòng kiểm tra lại.');
  }

  const tokenResult = issueQuickMessagePublicAccessToken(access);
  await createQuickMessageAccessLogEntry({
    tenantId: access?.message?.tenant?.id || access?.tenant?.id,
    messageId: access?.message?.id,
    accessId: access?.id,
    eventType: 'VERIFY_PIN_SUCCESS',
    success: true,
  });
  return {
    code: toText(access?.code).toUpperCase(),
    accessToken: tokenResult.accessToken,
    tokenType: 'Bearer',
    expiresIn: tokenResult.expiresIn,
  };
}

export async function createQuickMessageAccessTokenPublic(codeParam: unknown) {
  const access = await findQuickMessageAccessByCode(codeParam);
  assertQuickMessageAccessAvailableForToken(access);

  if (access?.requirePin === true) {
    throw new QuickMessagePublicError(409, 'PIN_REQUIRED', 'Mã truy cập này yêu cầu PIN.');
  }

  const tokenResult = issueQuickMessagePublicAccessToken(access);
  await createQuickMessageAccessLogEntry({
    tenantId: access?.message?.tenant?.id || access?.tenant?.id,
    messageId: access?.message?.id,
    accessId: access?.id,
    eventType: 'ACCESS_TOKEN_ISSUED',
    success: true,
  });
  return {
    code: toText(access?.code).toUpperCase(),
    accessToken: tokenResult.accessToken,
    tokenType: 'Bearer',
    expiresIn: tokenResult.expiresIn,
  };
}

export function extractBearerTokenFromHeader(authorizationHeader: unknown): string {
  const header = toText(authorizationHeader);
  if (!header || !header.startsWith('Bearer ')) {
    throw new QuickMessagePublicError(401, 'INVALID_PUBLIC_ACCESS_TOKEN', 'Phiên truy cập không hợp lệ hoặc đã hết hạn.');
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new QuickMessagePublicError(401, 'INVALID_PUBLIC_ACCESS_TOKEN', 'Phiên truy cập không hợp lệ hoặc đã hết hạn.');
  }

  return token;
}

function mapTokenValidationError(error: any) {
  if (error instanceof QuickMessagePublicError) {
    if (error.code === 'QUICK_MESSAGE_ACCESS_TOKEN_EXPIRED' || error.code === 'QUICK_MESSAGE_ACCESS_TOKEN_INVALID') {
      return new QuickMessagePublicError(401, 'INVALID_PUBLIC_ACCESS_TOKEN', 'Phiên truy cập không hợp lệ hoặc đã hết hạn.');
    }
    return error;
  }
  return new QuickMessagePublicError(401, 'INVALID_PUBLIC_ACCESS_TOKEN', 'Phiên truy cập không hợp lệ hoặc đã hết hạn.');
}

function readClientIp(headers: Record<string, unknown> = {}, fallback = ''): string | null {
  const forwardedFor = toText(headers?.['x-forwarded-for']);
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }
  return toText(fallback) || null;
}

function readUserAgent(headers: Record<string, unknown> = {}): string | null {
  return toText(headers?.['user-agent']) || null;
}

function hashPublicReplyIp(ipAddress: string | null): string | null {
  const value = toText(ipAddress);
  if (!value) return null;
  return crypto.createHash('sha256').update(`${getQuickMessagePublicTokenSecret()}:${value}`).digest('hex');
}

function resolvePublicReplyEnabled(access: any, effectiveStatus = computeQuickMessagePublicLookupStatus(access?.message, access)) {
  return access?.message?.allowReply !== false && effectiveStatus === 'active';
}

function buildReplyNotAllowedError(access: any, effectiveStatus = computeQuickMessagePublicLookupStatus(access?.message, access)) {
  if (access?.message?.allowReply === false) {
    return new QuickMessagePublicError(409, 'REPLY_DISABLED', 'Thông điệp này hiện không còn nhận phản hồi.');
  }
  if (effectiveStatus === 'access_locked') {
    return new QuickMessagePublicError(409, 'ACCESS_LOCKED', 'Mã truy cập đã bị khóa.');
  }
  if (effectiveStatus === 'access_cancelled') {
    return new QuickMessagePublicError(409, 'ACCESS_CANCELLED', 'Mã truy cập không còn khả dụng.');
  }
  if (effectiveStatus === 'access_expired' || effectiveStatus === 'max_views_reached' || effectiveStatus === 'message_expired') {
    return new QuickMessagePublicError(409, 'QUICK_MESSAGE_EXPIRED', 'Thông điệp đã hết hạn.');
  }
  if (effectiveStatus === 'message_locked') {
    return new QuickMessagePublicError(409, 'MESSAGE_LOCKED', 'Thông điệp này hiện không còn nhận phản hồi.');
  }
  if (effectiveStatus === 'message_cancelled' || effectiveStatus === 'message_draft') {
    return new QuickMessagePublicError(409, 'QUICK_MESSAGE_NOT_AVAILABLE', 'Thông điệp hiện không còn khả dụng.');
  }
  return new QuickMessagePublicError(409, 'REPLY_DISABLED', 'Thông điệp này hiện không còn nhận phản hồi.');
}

function serializePublicAdminMessage(row: any, access: any) {
  return {
    id: row?.id,
    documentId: row?.documentId || null,
    direction: 'incoming',
    senderDisplayName: toText(row?.senderDisplayName)
      || toText(row?.senderUser?.fullName)
      || toText(row?.senderUser?.username)
      || toText(access?.message?.senderDisplayName)
      || toText(access?.message?.tenant?.shortName)
      || toText(access?.message?.tenant?.name)
      || 'Trung tâm',
    content: toText(row?.content),
    createdAt: row?.createdAt || null,
    readAt: row?.readByPublicAt || null,
    source: 'admin',
  };
}

function serializePublicReplyMessage(row: any, access: any) {
  return {
    id: row?.id,
    documentId: row?.documentId || null,
    direction: 'outgoing',
    senderDisplayName: toText(row?.responderName) || toText(access?.recipientName) || 'Bạn',
    content: toText(row?.content),
    createdAt: row?.createdAt || null,
    readAt: row?.readAt || null,
    source: 'public',
  };
}

async function authorizeQuickMessagePublicAccess(codeParam: unknown, authorizationHeader: unknown): Promise<QuickMessagePublicAccessTokenContext> {
  const normalizedCode = normalizeQuickMessageAccessCode(codeParam);
  const token = extractBearerTokenFromHeader(authorizationHeader);

  let tokenPayload: QuickMessagePublicAccessTokenPayload;
  try {
    tokenPayload = verifyQuickMessagePublicAccessToken(token);
  } catch (error: any) {
    throw mapTokenValidationError(error);
  }

  if (tokenPayload.code !== normalizedCode) {
    throw new QuickMessagePublicError(401, 'INVALID_PUBLIC_ACCESS_TOKEN', 'Phiên truy cập không hợp lệ hoặc đã hết hạn.');
  }

  const access = await findQuickMessageAccessByCode(normalizedCode);
  if (tokenPayload.accessId !== Number(access?.id || 0) || tokenPayload.messageId !== Number(access?.message?.id || 0) || tokenPayload.code !== toText(access?.code).toUpperCase()) {
    throw new QuickMessagePublicError(401, 'INVALID_PUBLIC_ACCESS_TOKEN', 'Phiên truy cập không hợp lệ hoặc đã hết hạn.');
  }
  if (tokenPayload.accessVersion !== Number(access?.accessVersion || 0)) {
    throw new QuickMessagePublicError(401, 'PUBLIC_ACCESS_REVOKED', 'Quyền truy cập đã thay đổi. Vui lòng xác thực lại.');
  }

  return {
    code: normalizedCode,
    access,
    tokenPayload,
    effectiveStatus: computeQuickMessagePublicLookupStatus(access?.message, access),
  };
}

export async function openQuickMessageContentPublic(codeParam: unknown, authorizationHeader: unknown): Promise<QuickMessagePublicOpenResponse> {
  const { code: normalizedCode, access: baseAccess, tokenPayload } = await authorizeQuickMessagePublicAccess(codeParam, authorizationHeader);

  const accessId = Number(baseAccess.id);
  const messageId = Number(baseAccess.message.id);
  const nowIso = new Date().toISOString();
  const knex = strapi.db.connection;

  const result = await knex.transaction(async (trx: any) => {
    const lockedAccess = await trx('quick_message_accesses')
      .where({ id: accessId })
      .select(['id', 'code', 'status', 'expires_at', 'max_views', 'view_count', 'first_viewed_at', 'last_viewed_at', 'access_version', 'recipient_name'])
      .first()
      .forUpdate();

    if (!lockedAccess?.id) {
      throw new QuickMessagePublicError(401, 'INVALID_PUBLIC_ACCESS_TOKEN', 'Phiên truy cập không hợp lệ hoặc đã hết hạn.');
    }

    const lockedMessage = await trx('quick_messages')
      .where({ id: messageId })
      .select(['id', 'status', 'expires_at'])
      .first()
      .forUpdate();

    if (!lockedMessage?.id) {
      throw new QuickMessagePublicError(401, 'INVALID_PUBLIC_ACCESS_TOKEN', 'Phiên truy cập không hợp lệ hoặc đã hết hạn.');
    }

    const currentAccess = {
      id: lockedAccess.id,
      code: lockedAccess.code,
      status: lockedAccess.status,
      expiresAt: lockedAccess.expires_at,
      maxViews: lockedAccess.max_views,
      viewCount: lockedAccess.view_count,
      firstViewedAt: lockedAccess.first_viewed_at,
      lastViewedAt: lockedAccess.last_viewed_at,
      accessVersion: lockedAccess.access_version,
    };
    const currentMessage = {
      id: lockedMessage.id,
      status: lockedMessage.status,
      expiresAt: lockedMessage.expires_at,
    };

    if (tokenPayload.accessVersion !== Number(currentAccess.accessVersion || 0)) {
      throw new QuickMessagePublicError(401, 'PUBLIC_ACCESS_REVOKED', 'Quyền truy cập đã thay đổi. Vui lòng xác thực lại.');
    }

    const effectiveStatus = computeQuickMessagePublicLookupStatus(currentMessage, currentAccess);
    if (effectiveStatus !== 'active') {
      throw new QuickMessagePublicError(409, 'QUICK_MESSAGE_NOT_AVAILABLE', 'Thông điệp hiện không còn khả dụng.');
    }

    const updatedRows = await trx('quick_message_accesses')
      .where({ id: accessId })
      .where((builder: any) => {
        builder.whereNull('max_views').orWhere('view_count', '<', trx.ref('max_views'));
      })
      .update({
        view_count: trx.raw('coalesce(view_count, 0) + 1'),
        first_viewed_at: trx.raw('coalesce(first_viewed_at, ?)', [nowIso]),
        last_viewed_at: nowIso,
      }, ['id', 'view_count', 'first_viewed_at', 'last_viewed_at']);

    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      throw new QuickMessagePublicError(409, 'QUICK_MESSAGE_NOT_AVAILABLE', 'Thông điệp hiện không còn khả dụng.');
    }

    return updatedRows[0];
  });

  const openedAt = result?.last_viewed_at || nowIso;
  const responseAccess = {
    ...baseAccess,
    viewCount: result?.view_count ?? baseAccess?.viewCount,
    firstViewedAt: result?.first_viewed_at ?? baseAccess?.firstViewedAt,
    lastViewedAt: result?.last_viewed_at ?? baseAccess?.lastViewedAt,
  };

  await createQuickMessageAccessLogEntry({
    tenantId: baseAccess?.message?.tenant?.id || baseAccess?.tenant?.id,
    messageId: baseAccess?.message?.id,
    accessId: baseAccess?.id,
    eventType: 'OPEN_CONTENT',
    success: true,
  });

  return buildOpenResponse(responseAccess, openedAt);
}

export async function listQuickMessagePublicMessages(codeParam: unknown, authorizationHeader: unknown, query: Record<string, unknown> = {}) {
  const { access, effectiveStatus } = await authorizeQuickMessagePublicAccess(codeParam, authorizationHeader);
  const tenantId = Number(access?.message?.tenant?.id || access?.tenant?.id || 0);
  const messageId = Number(access?.message?.id || 0);
  const accessId = Number(access?.id || 0);
  const page = toPositiveInt(query?.page) || 1;
  const pageSize = Math.min(200, toPositiveInt(query?.pageSize) || 100);

  const [replies, adminMessages] = await Promise.all([
    strapi.db.query(QUICK_MESSAGE_REPLY_UID).findMany({
      where: {
        tenant: { id: tenantId },
        message: { id: messageId },
        access: { id: accessId },
      },
      select: ['id', 'documentId', 'content', 'responderName', 'readAt', 'createdAt'],
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    strapi.db.query(QUICK_MESSAGE_MESSAGE_UID).findMany({
      where: {
        tenant: { id: tenantId },
        message: { id: messageId },
        access: { id: accessId },
      },
      select: ['id', 'documentId', 'senderDisplayName', 'content', 'readByPublicAt', 'createdAt'],
      populate: {
        senderUser: {
          select: ['id', 'username', 'fullName'],
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const merged = [
    ...(adminMessages || []).map((row: any) => serializePublicAdminMessage(row, access)),
    ...(replies || []).map((row: any) => serializePublicReplyMessage(row, access)),
  ].sort((left: any, right: any) => {
    const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return Number(left?.id || 0) - Number(right?.id || 0);
  });

  const total = merged.length;
  const data = merged.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  await createQuickMessageAccessLogEntry({
    tenantId,
    messageId,
    accessId,
    eventType: 'PUBLIC_MESSAGES_VIEWED',
    success: true,
    metadata: {
      page,
      pageSize,
      resultCount: data.length,
    },
  });

  return {
    replyEnabled: resolvePublicReplyEnabled(access, effectiveStatus),
    replyMode: toText(access?.message?.replyMode) || null,
    data,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function sendQuickMessagePublicReply(codeParam: unknown, authorizationHeader: unknown, body: Record<string, unknown> = {}, requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {}) {
  const { access, effectiveStatus } = await authorizeQuickMessagePublicAccess(codeParam, authorizationHeader);
  const tenantId = Number(access?.message?.tenant?.id || access?.tenant?.id || 0);
  const messageId = Number(access?.message?.id || 0);
  const accessId = Number(access?.id || 0);

  if (!resolvePublicReplyEnabled(access, effectiveStatus)) {
    await createQuickMessageAccessLogEntry({
      tenantId,
      messageId,
      accessId,
      eventType: 'REPLY_NOT_ALLOWED',
      success: false,
      metadata: {
        effectiveStatus,
      },
    });
    throw buildReplyNotAllowedError(access, effectiveStatus);
  }

  const content = toText(body?.content);
  if (!content) {
    throw new QuickMessagePublicError(400, 'PUBLIC_REPLY_EMPTY', 'Vui lòng nhập nội dung phản hồi.');
  }
  if (content.length > PUBLIC_REPLY_MAX_LENGTH) {
    throw new QuickMessagePublicError(400, 'PUBLIC_REPLY_TOO_LONG', `Phản hồi không được vượt quá ${PUBLIC_REPLY_MAX_LENGTH} ký tự.`);
  }

  const duplicateSince = new Date(Date.now() - PUBLIC_REPLY_DUPLICATE_WINDOW_MS).toISOString();
  const existingDuplicate = await strapi.db.query(QUICK_MESSAGE_REPLY_UID).findMany({
    where: {
      tenant: { id: tenantId },
      message: { id: messageId },
      access: { id: accessId },
      replyType: { $eq: 'text' },
      content: { $eq: content },
      createdAt: { $gte: duplicateSince },
    },
    select: ['id', 'documentId', 'content', 'responderName', 'readAt', 'createdAt'],
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    limit: 1,
  });
  if (Array.isArray(existingDuplicate) && existingDuplicate[0]?.id) {
    return {
      message: serializePublicReplyMessage(existingDuplicate[0], access),
      deduplicated: true,
    };
  }

  try {
    const created = await strapi.db.query(QUICK_MESSAGE_REPLY_UID).create({
      data: {
        tenant: tenantId,
        message: messageId,
        access: accessId,
        replyType: 'text',
        content,
        responderName: toText(access?.recipientName) || null,
        clientSessionId: null,
        ipHash: hashPublicReplyIp(requestMeta.ipAddress || null),
        userAgent: requestMeta.userAgent || null,
        isRead: false,
        readAt: null,
        metadata: null,
      },
    });

    await createQuickMessageAccessLogEntry({
      tenantId,
      messageId,
      accessId,
      eventType: 'PUBLIC_REPLY_SENT',
      success: true,
      metadata: {
        contentLength: content.length,
      },
    });

    return {
      message: serializePublicReplyMessage(created, access),
      deduplicated: false,
    };
  } catch (error) {
    await createQuickMessageAccessLogEntry({
      tenantId,
      messageId,
      accessId,
      eventType: 'PUBLIC_REPLY_FAILED',
      success: false,
      metadata: {
        contentLength: content.length,
      },
    });
    throw error;
  }
}

export async function markQuickMessagePublicMessagesRead(codeParam: unknown, authorizationHeader: unknown) {
  const { access } = await authorizeQuickMessagePublicAccess(codeParam, authorizationHeader);
  const tenantId = Number(access?.message?.tenant?.id || access?.tenant?.id || 0);
  const messageId = Number(access?.message?.id || 0);
  const accessId = Number(access?.id || 0);

  const unreadMessages = await strapi.db.query(QUICK_MESSAGE_MESSAGE_UID).findMany({
    where: {
      tenant: { id: tenantId },
      message: { id: messageId },
      access: { id: accessId },
      readByPublicAt: { $null: true },
    },
    select: ['id'],
  });

  const readAt = new Date().toISOString();
  await Promise.all((unreadMessages || []).map((row: any) => strapi.db.query(QUICK_MESSAGE_MESSAGE_UID).update({
    where: { id: row.id },
    data: {
      readByPublicAt: readAt,
    },
  })));

  await createQuickMessageAccessLogEntry({
    tenantId,
    messageId,
    accessId,
    eventType: 'PUBLIC_ADMIN_MESSAGES_READ',
    success: true,
    metadata: {
      updatedCount: (unreadMessages || []).length,
    },
  });

  return {
    updatedCount: (unreadMessages || []).length,
    readAt,
  };
}

export default {
  lookupQuickMessageAccessPublic,
  normalizeQuickMessageAccessCode,
  computeQuickMessagePublicLookupStatus,
  issueQuickMessagePublicAccessToken,
  verifyQuickMessagePublicAccessToken,
  validateQuickMessagePublicAccessTokenAgainstAccess,
  verifyQuickMessageAccessPinPublic,
  createQuickMessageAccessTokenPublic,
  extractBearerTokenFromHeader,
  openQuickMessageContentPublic,
  listQuickMessagePublicMessages,
  sendQuickMessagePublicReply,
  markQuickMessagePublicMessagesRead,
};