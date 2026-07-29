import {
  mergeTenantWhere,
  normalizeSortInput,
  parseOptionalPositiveInt,
  resolveCurrentTenantId,
  toPositiveInt,
  toText,
  whereByParam,
} from '../../../utils/tenant-scope';

const bcrypt = require('bcryptjs');

const QUICK_MESSAGE_UID = 'api::quick-message.quick-message';
const QUICK_MESSAGE_ACCESS_UID = 'api::quick-message-access.quick-message-access';
const QUICK_MESSAGE_REPLY_UID = 'api::quick-message-reply.quick-message-reply';
const QUICK_MESSAGE_MESSAGE_UID = 'api::quick-message-message.quick-message-message';
const QUICK_MESSAGE_ACCESS_LOG_UID = 'api::quick-message-access-log.quick-message-access-log';
const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEFAULT_MESSAGE_EXPIRE_HOURS = 24;
const DEFAULT_ACCESS_CODE_LENGTH = 6;
const DEFAULT_ACCESS_CODE_MAX_ATTEMPTS = 10;
const ACCESS_PIN_SALT_ROUNDS = 10;
const QUICK_MESSAGE_MANAGE_PERMISSION = 'crms.quick-message.manage';

type GenericRecord = Record<string, unknown>;

type AuthUser = {
  id: number;
  username?: string | null;
  email?: string | null;
  fullName?: string | null;
  blocked?: boolean | null;
};

type LinkItem = {
  label: string | null;
  url: string;
};

type QuickMessageStatus = 'draft' | 'active' | 'locked' | 'expired' | 'cancelled';
type QuickMessageAccessStatus = 'active' | 'locked' | 'expired' | 'cancelled';
type QuickMessageReplyType = 'quick' | 'text';

const QUICK_RESPONSE_LABELS: Record<string, string> = {
  received: 'Đã nhận được thông điệp',
  opened: 'Đã mở thông điệp',
  understood: 'Đã hiểu nội dung',
  need_help: 'Cần được hỗ trợ thêm',
  cannot_open: 'Không thể mở nội dung',
  agree: 'Đồng ý',
  disagree: 'Không đồng ý',
};

export class QuickMessageAdminError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function extractPayload(body: any): GenericRecord {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as GenericRecord;
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as GenericRecord;
  }

  return {};
}

function toNullableText(value: unknown, maxLength?: number): string | null {
  const text = toText(value);
  if (!text) return null;
  if (maxLength && text.length > maxLength) {
    throw new QuickMessageAdminError(400, `Text exceeds max length ${maxLength}`);
  }
  return text;
}

function toRequiredText(value: unknown, label: string, maxLength?: number): string {
  const text = toText(value);
  if (!text) {
    throw new QuickMessageAdminError(400, `${label} is required`);
  }
  if (maxLength && text.length > maxLength) {
    throw new QuickMessageAdminError(400, `${label} max length is ${maxLength}`);
  }
  return text;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = toText(value).toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function toNullablePositiveInt(value: unknown, label: string, options: { min?: number; max?: number } = {}): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new QuickMessageAdminError(400, `${label} must be a positive integer`);
  }
  if (options.min && parsed < options.min) {
    throw new QuickMessageAdminError(400, `${label} must be at least ${options.min}`);
  }
  if (options.max && parsed > options.max) {
    throw new QuickMessageAdminError(400, `${label} must be at most ${options.max}`);
  }
  return parsed;
}

function parseDateTime(value: unknown, label: string): Date | null {
  const text = toText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new QuickMessageAdminError(400, `${label} is invalid`);
  }
  return date;
}

function toFutureDateTime(value: unknown, label: string, options: { required?: boolean } = {}): string | null {
  const date = parseDateTime(value, label);
  if (!date) {
    if (options.required) {
      throw new QuickMessageAdminError(400, `${label} is required`);
    }
    return null;
  }

  if (date.getTime() <= Date.now()) {
    throw new QuickMessageAdminError(400, `${label} must be in the future`);
  }

  return date.toISOString();
}

export function buildDefaultMessageExpiresAt(now = new Date()): string {
  return new Date(now.getTime() + DEFAULT_MESSAGE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();
}

export function resolveSenderDisplayName(user: AuthUser | null | undefined): string | null {
  const fullName = toText(user?.fullName);
  if (fullName) return fullName;
  const username = toText(user?.username);
  if (username) return username;
  const email = toText(user?.email);
  if (email) return email;
  const userId = Number(user?.id || 0);
  return userId > 0 ? `User #${userId}` : null;
}

export function validatePin(pin: unknown): string {
  const normalized = toText(pin);
  if (!/^\d{4,6}$/.test(normalized)) {
    throw new QuickMessageAdminError(400, 'pin must contain 4 to 6 digits');
  }
  return normalized;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, ACCESS_PIN_SALT_ROUNDS);
}

export function validateLinks(links: unknown): LinkItem[] | null {
  if (links === null || links === undefined || links === '') return null;
  if (!Array.isArray(links)) {
    throw new QuickMessageAdminError(400, 'links must be an array or null');
  }

  if (links.length > 10) {
    throw new QuickMessageAdminError(400, 'links must contain at most 10 items');
  }

  return links.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new QuickMessageAdminError(400, `links[${index}] is invalid`);
    }

    const rawUrl = toRequiredText((item as GenericRecord).url, `links[${index}].url`, 2000);
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new QuickMessageAdminError(400, `links[${index}].url is invalid`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new QuickMessageAdminError(400, `links[${index}].url protocol is not allowed`);
    }

    const rawLabel = toNullableText((item as GenericRecord).label, 200);
    return {
      label: rawLabel || parsed.hostname || null,
      url: parsed.toString().trim(),
    };
  });
}

function normalizeMessageStatus(value: unknown, allowed: QuickMessageStatus[], fallback: QuickMessageStatus): QuickMessageStatus {
  const normalized = toText(value).toLowerCase() as QuickMessageStatus;
  if (!normalized) return fallback;
  if (!allowed.includes(normalized)) {
    throw new QuickMessageAdminError(400, `status must be one of: ${allowed.join(', ')}`);
  }
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeReplyMode(value: unknown): 'quick' | 'text' | 'quick_and_text' {
  const normalized = toText(value).toLowerCase();
  if (!normalized) return 'quick_and_text';
  if (normalized === 'quick' || normalized === 'text' || normalized === 'quick_and_text') {
    return normalized;
  }
  throw new QuickMessageAdminError(400, 'replyMode must be one of: quick, text, quick_and_text');
}

export function computeMessageEffectiveStatus(message: any, now = new Date()): QuickMessageStatus {
  const status = toText(message?.status).toLowerCase() as QuickMessageStatus;
  if (status === 'cancelled' || status === 'locked' || status === 'draft') return status;

  const expiresAt = message?.expiresAt ? new Date(message.expiresAt) : null;
  if (status === 'active' && expiresAt && expiresAt.getTime() <= now.getTime()) {
    return 'expired';
  }

  return status === 'active' ? 'active' : 'expired';
}

export function computeAccessEffectiveStatus(message: any, access: any, now = new Date()): QuickMessageAccessStatus {
  const accessStatus = toText(access?.status).toLowerCase() as QuickMessageAccessStatus;
  if (accessStatus === 'cancelled' || accessStatus === 'locked') return accessStatus;

  const messageStatus = computeMessageEffectiveStatus(message, now);
  if (messageStatus === 'cancelled') return 'cancelled';
  if (messageStatus === 'locked') return 'locked';
  if (messageStatus !== 'active') return 'expired';

  const expiresAt = access?.expiresAt ? new Date(access.expiresAt) : null;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    return 'expired';
  }

  const maxViews = Number(access?.maxViews || 0);
  const viewCount = Number(access?.viewCount || 0);
  if (maxViews > 0 && viewCount >= maxViews) {
    return 'expired';
  }

  return 'active';
}

function isAccessAccessible(message: any, access: any, now = new Date()): boolean {
  return computeAccessEffectiveStatus(message, access, now) === 'active';
}

function buildMessageWhereByRef(idParam: unknown, tenantId: number | string) {
  const where = whereByParam(idParam);
  if (!where) {
    throw new QuickMessageAdminError(404, 'Quick message not found');
  }
  return mergeTenantWhere(where, tenantId);
}

function buildAccessWhereByRef(idParam: unknown, tenantId: number | string) {
  const where = whereByParam(idParam);
  if (!where) {
    throw new QuickMessageAdminError(404, 'Quick message access not found');
  }
  return mergeTenantWhere(where, tenantId);
}

function buildReplyWhereByRef(idParam: unknown, tenantId: number | string) {
  const where = whereByParam(idParam);
  if (!where) {
    throw new QuickMessageAdminError(404, 'Quick message reply not found');
  }
  return mergeTenantWhere(where, tenantId);
}

async function findMessageOrThrow(idParam: unknown, tenantId: number | string, populate?: any) {
  const entity = await strapi.db.query(QUICK_MESSAGE_UID).findOne({
    where: buildMessageWhereByRef(idParam, tenantId),
    populate,
  });

  if (!entity?.id) {
    throw new QuickMessageAdminError(404, 'Quick message not found');
  }

  return entity;
}

async function findAccessOrThrow(idParam: unknown, tenantId: number | string, populate?: any) {
  const entity = await strapi.db.query(QUICK_MESSAGE_ACCESS_UID).findOne({
    where: buildAccessWhereByRef(idParam, tenantId),
    populate,
  });

  if (!entity?.id) {
    throw new QuickMessageAdminError(404, 'Quick message access not found');
  }

  return entity;
}

async function findReplyOrThrow(idParam: unknown, tenantId: number | string, populate?: any) {
  const entity = await strapi.db.query(QUICK_MESSAGE_REPLY_UID).findOne({
    where: buildReplyWhereByRef(idParam, tenantId),
    populate,
  });

  if (!entity?.id) {
    throw new QuickMessageAdminError(404, 'Quick message reply not found');
  }

  return entity;
}

function buildListSort(query: Record<string, unknown>, fallbackField: string): Array<Record<string, 'asc' | 'desc'>> {
  const normalizedSort = normalizeSortInput(query?.sort);
  if (normalizedSort.length > 0) return normalizedSort;
  return [{ [fallbackField]: 'desc' }, { id: 'desc' }];
}

function buildMessageListWhere(query: Record<string, unknown>) {
  const parts: Record<string, unknown>[] = [];
  const search = toText(query?.search);
  const status = toText(query?.status).toLowerCase();

  if (search) {
    parts.push({
      $or: [
        { title: { $containsi: search } },
        { senderDisplayName: { $containsi: search } },
      ],
    });
  }

  if (['draft', 'active', 'locked', 'expired', 'cancelled'].includes(status)) {
    if (status === 'expired') {
      parts.push({ status: { $eq: 'active' } });
      parts.push({ expiresAt: { $notNull: true, $lte: new Date().toISOString() } });
    } else {
      parts.push({ status: { $eq: status } });
    }
  }

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

function assertAccessWritable(message: any) {
  if (toText(message?.status).toLowerCase() === 'cancelled') {
    throw new QuickMessageAdminError(409, 'Cannot modify access for a cancelled quick message');
  }
}

function buildMessageMutationPayload(payload: Record<string, unknown>, senderUser: AuthUser, options: { isCreate?: boolean; current?: any } = {}) {
  const title = options.isCreate ? toRequiredText(payload.title, 'title', 200) : (payload.title === undefined ? undefined : toRequiredText(payload.title, 'title', 200));
  const content = payload.content === undefined ? undefined : toNullableText(payload.content);
  const expiresAt = payload.expiresAt === undefined
    ? (options.isCreate ? buildDefaultMessageExpiresAt() : undefined)
    : toFutureDateTime(payload.expiresAt, 'expiresAt');
  const nextStatus = normalizeMessageStatus(payload.status, options.isCreate ? ['draft', 'active'] : ['draft', 'active'], options.isCreate ? 'active' : (toText(options.current?.status).toLowerCase() as QuickMessageStatus || 'draft'));

  return {
    title,
    content,
    links: payload.links === undefined ? undefined : validateLinks(payload.links),
    status: nextStatus,
    expiresAt,
    allowReply: payload.allowReply === undefined ? (options.isCreate ? true : undefined) : toBoolean(payload.allowReply, true),
    replyMode: payload.replyMode === undefined ? (options.isCreate ? 'quick_and_text' : undefined) : normalizeReplyMode(payload.replyMode),
    tenant: undefined,
    sender: senderUser.id,
    senderDisplayName: resolveSenderDisplayName(senderUser),
  };
}

function buildAccessMutationPayload(payload: Record<string, unknown>) {
  const requirePin = payload.requirePin === undefined ? false : toBoolean(payload.requirePin, false);
  return {
    label: payload.label === undefined ? undefined : toNullableText(payload.label, 200),
    recipientName: payload.recipientName === undefined ? undefined : toNullableText(payload.recipientName, 200),
    requirePin,
    expiresAt: payload.expiresAt === undefined ? undefined : toFutureDateTime(payload.expiresAt, 'expiresAt'),
    maxViews: payload.maxViews === undefined ? undefined : toNullablePositiveInt(payload.maxViews, 'maxViews', { min: 1 }),
  };
}

function toStrictPositiveInt(value: unknown, label: string, options: { min?: number; max?: number; fallback?: number } = {}): number {
  if (value === undefined || value === null || value === '') {
    if (options.fallback !== undefined) return options.fallback;
    throw new QuickMessageAdminError(400, `${label} is required`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new QuickMessageAdminError(400, `${label} must be a positive integer`);
  }
  if (options.min && parsed < options.min) {
    throw new QuickMessageAdminError(400, `${label} must be at least ${options.min}`);
  }
  if (options.max && parsed > options.max) {
    throw new QuickMessageAdminError(400, `${label} must be at most ${options.max}`);
  }
  return parsed;
}

function toCloneText(value: unknown, options: { appendIndex?: boolean; sequence: number; separator: string }) {
  const base = toNullableText(value, 200);
  if (!base) return null;
  if (!options.appendIndex) return base;
  return `${base}${options.separator}${String(options.sequence).padStart(2, '0')}`;
}

function buildCloneBatchOptions(payload: Record<string, unknown>) {
  return {
    quantity: toStrictPositiveInt(payload.quantity, 'quantity', { min: 1, max: 100 }),
    startIndex: toStrictPositiveInt(payload.startIndex, 'startIndex', { min: 1, max: 10000, fallback: 1 }),
    appendIndexToLabel: payload.appendIndexToLabel === undefined ? true : toBoolean(payload.appendIndexToLabel, true),
    appendIndexToRecipientName: payload.appendIndexToRecipientName === undefined ? false : toBoolean(payload.appendIndexToRecipientName, false),
    separator: toNullableText(payload.separator, 10) || ' - ',
  };
}

function serializeAccess(message: any, access: any) {
  const effectiveStatus = computeAccessEffectiveStatus(message, access);
  return {
    id: access.id,
    documentId: access.documentId || null,
    code: access.code || '',
    label: access.label || null,
    recipientName: access.recipientName || null,
    requirePin: access.requirePin === true,
    hasPin: access.requirePin === true && Boolean(toText(access.pinHash)),
    accessVersion: Number(access.accessVersion || 1),
    status: access.status || 'active',
    expiresAt: access.expiresAt || null,
    maxViews: access.maxViews ?? null,
    viewCount: Number(access.viewCount || 0),
    firstViewedAt: access.firstViewedAt || null,
    lastViewedAt: access.lastViewedAt || null,
    lockedAt: access.lockedAt || null,
    effectiveStatus,
    isExpired: effectiveStatus === 'expired',
    isAccessible: isAccessAccessible(message, access),
  };
}

function serializeMessage(message: any) {
  const effectiveStatus = computeMessageEffectiveStatus(message);
  return {
    id: message.id,
    documentId: message.documentId || null,
    title: message.title || '',
    content: message.content || null,
    links: Array.isArray(message.links) ? message.links : message.links || null,
    status: message.status || 'draft',
    expiresAt: message.expiresAt || null,
    allowReply: message.allowReply !== false,
    replyMode: message.replyMode || 'quick_and_text',
    senderDisplayName: message.senderDisplayName || null,
    createdAt: message.createdAt || null,
    updatedAt: message.updatedAt || null,
    effectiveStatus,
    isExpired: effectiveStatus === 'expired',
  };
}

function serializeMessageListItem(message: any, stats: {
  accessCount: number;
  activeAccessCount: number;
  replyCount: number;
  unreadReplyCount: number;
  totalViewCount: number;
}) {
  return {
    id: message.id,
    documentId: message.documentId || null,
    title: message.title || '',
    status: message.status || 'draft',
    expiresAt: message.expiresAt || null,
    allowReply: message.allowReply !== false,
    replyMode: message.replyMode || 'quick_and_text',
    senderDisplayName: message.senderDisplayName || null,
    createdAt: message.createdAt || null,
    updatedAt: message.updatedAt || null,
    accessCount: stats.accessCount,
    activeAccessCount: stats.activeAccessCount,
    replyCount: stats.replyCount,
    unreadReplyCount: stats.unreadReplyCount,
    totalViewCount: stats.totalViewCount,
    effectiveStatus: computeMessageEffectiveStatus(message),
  };
}

function serializeReply(reply: any) {
  return {
    id: reply.id,
    documentId: reply.documentId || null,
    access: reply.access
      ? {
          id: reply.access.id,
          documentId: reply.access.documentId || null,
          code: reply.access.code || '',
          label: reply.access.label || null,
          recipientName: reply.access.recipientName || null,
        }
      : null,
    replyType: reply.replyType || 'quick',
    quickResponse: reply.quickResponse || null,
    content: reply.content || null,
    responderName: reply.responderName || null,
    isRead: reply.isRead === true,
    readAt: reply.readAt || null,
    createdAt: reply.createdAt || null,
  };
}

function maskIpAddress(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;

  if (text.includes(':')) {
    const parts = text.split(':').filter(Boolean);
    if (parts.length <= 2) return '****';
    return `${parts.slice(0, 2).join(':')}:****`;
  }

  const parts = text.split('.').filter(Boolean);
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }

  return '***';
}

function summarizeUserAgent(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;

  const lower = text.toLowerCase();
  const browser = lower.includes('edg/')
    ? 'Edge'
    : lower.includes('chrome/') && !lower.includes('edg/')
      ? 'Chrome'
      : lower.includes('firefox/')
        ? 'Firefox'
        : lower.includes('safari/') && !lower.includes('chrome/')
          ? 'Safari'
          : 'Trình duyệt';
  const device = lower.includes('iphone')
    ? 'iPhone'
    : lower.includes('ipad')
      ? 'iPad'
      : lower.includes('android')
        ? 'Android'
        : lower.includes('windows')
          ? 'Windows'
          : lower.includes('mac os') || lower.includes('macintosh')
            ? 'macOS'
            : 'Thiết bị';
  return `${browser} trên ${device}`;
}

function toActivityEventLabel(eventType: unknown, success = true): string {
  const normalized = toText(eventType).toUpperCase();
  const labels: Record<string, string> = {
    LOOKUP: 'Tra cứu mã',
    VERIFY_PIN_SUCCESS: 'Xác thực PIN thành công',
    VERIFY_PIN_FAILED: 'Nhập sai PIN',
    ACCESS_TOKEN_ISSUED: 'Cấp token truy cập',
    ACCESS_TOKEN_DENIED: 'Không cấp được token',
    OPEN_CONTENT: 'Mở nội dung',
    OPEN_DENIED: 'Mã không thể mở',
    PUBLIC_MESSAGES_VIEWED: 'Xem trao đổi công khai',
    PUBLIC_REPLY_SENT: 'Người nhận gửi phản hồi',
    PUBLIC_REPLY_FAILED: 'Gửi phản hồi thất bại',
    PUBLIC_ADMIN_MESSAGES_READ: 'Người nhận đã đọc phản hồi từ trung tâm',
    REPLY_NOT_ALLOWED: 'Thông điệp không còn nhận phản hồi',
    REPLY_RATE_LIMITED: 'Gửi phản hồi quá nhanh',
    MESSAGE_SENT_ADMIN: 'Quản trị viên gửi tin nhắn',
    MESSAGE_SENT_PUBLIC: 'Người nhận gửi phản hồi',
    REPLY_MARKED_READ: 'Đánh dấu phản hồi đã đọc',
  };

  const base = labels[normalized] || normalized || 'Hoạt động';
  if (normalized === 'LOOKUP' && success !== true) {
    return 'Tra cứu mã thất bại';
  }
  return base;
}

function normalizeActivityMessageRow(row: any, fallbackRecipientName?: string | null) {
  return {
    id: row?.id,
    documentId: row?.documentId || null,
    senderType: toText(row?.senderType).toUpperCase() || 'ADMIN',
    senderDisplayName: toText(row?.senderDisplayName)
      || toText(row?.senderUser?.fullName)
      || toText(row?.senderUser?.username)
      || fallbackRecipientName
      || 'Người dùng',
    content: row?.content || '',
    createdAt: row?.createdAt || null,
    readAt: row?.readByAdminAt || row?.readAt || null,
    source: 'message',
  };
}

function normalizeActivityReplyRow(row: any, fallbackRecipientName?: string | null) {
  const replyType = toText(row?.replyType).toLowerCase();
  const quickResponse = toText(row?.quickResponse).toLowerCase();
  const quickLabel = QUICK_RESPONSE_LABELS[quickResponse] || quickResponse;
  const content = replyType === 'text'
    ? toText(row?.content)
    : quickLabel
      ? `Phản hồi nhanh: ${quickLabel}`
      : toText(row?.content);

  return {
    id: row?.id,
    documentId: row?.documentId || null,
    senderType: 'PUBLIC',
    senderDisplayName: toText(row?.responderName) || fallbackRecipientName || 'Người nhận',
    content,
    createdAt: row?.createdAt || null,
    readAt: row?.readAt || null,
    source: 'reply',
    isRead: row?.isRead === true,
  };
}

export async function createQuickMessageAccessLogEntry(options: {
  tenantId: number | string;
  messageId: number | string;
  accessId: number | string;
  eventType: string;
  success?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  if (!options?.tenantId || !options?.messageId || !options?.accessId) {
    return null;
  }

  try {
    return await strapi.db.query(QUICK_MESSAGE_ACCESS_LOG_UID).create({
      data: {
        tenant: options.tenantId,
        message: options.messageId,
        access: options.accessId,
        eventType: toText(options.eventType).toUpperCase(),
        success: options.success !== false,
        ipAddress: maskIpAddress(options.ipAddress),
        userAgent: toText(options.userAgent) || null,
        metadata: options.metadata || null,
      },
    });
  } catch {
    return null;
  }
}

export async function listQuickMessageActivityAccesses(messageId: unknown, query: Record<string, unknown>, tenantId: number | string) {
  const message = await findMessageOrThrow(messageId, tenantId);
  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 20));
  const search = toText(query?.search).toLowerCase();
  const statusFilter = toText(query?.status).toLowerCase();

  const [accesses, replies, adminMessages, logs] = await Promise.all([
    strapi.db.query(QUICK_MESSAGE_ACCESS_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id } }, tenantId),
      select: ['id', 'documentId', 'code', 'label', 'recipientName', 'requirePin', 'pinHash', 'accessVersion', 'status', 'expiresAt', 'maxViews', 'viewCount', 'firstViewedAt', 'lastViewedAt', 'lockedAt', 'createdAt'],
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    strapi.db.query(QUICK_MESSAGE_REPLY_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id } }, tenantId),
      select: ['id', 'documentId', 'createdAt', 'isRead'],
      populate: {
        access: {
          select: ['id'],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    strapi.db.query(QUICK_MESSAGE_MESSAGE_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id } }, tenantId),
      select: ['id', 'documentId', 'createdAt', 'senderType'],
      populate: {
        access: {
          select: ['id'],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    strapi.db.query(QUICK_MESSAGE_ACCESS_LOG_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id } }, tenantId),
      select: ['id', 'createdAt', 'eventType', 'success', 'ipAddress', 'userAgent'],
      populate: {
        access: {
          select: ['id'],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      limit: 1000,
    }),
  ]);

  const replyStats = new Map<number, { unreadCount: number; latestAt: string | null }>();
  for (const row of replies || []) {
    const accessId = Number(row?.access?.id || row?.access || 0);
    if (!accessId) continue;
    const current = replyStats.get(accessId) || { unreadCount: 0, latestAt: null };
    current.unreadCount += row?.isRead === true ? 0 : 1;
    if (!current.latestAt) current.latestAt = row?.createdAt || null;
    replyStats.set(accessId, current);
  }

  const adminMessageStats = new Map<number, { latestAt: string | null }>();
  for (const row of adminMessages || []) {
    const accessId = Number(row?.access?.id || row?.access || 0);
    if (!accessId) continue;
    const current = adminMessageStats.get(accessId) || { latestAt: null };
    if (!current.latestAt) current.latestAt = row?.createdAt || null;
    adminMessageStats.set(accessId, current);
  }

  const logStats = new Map<number, { latestAt: string | null; lastIpAddress: string | null; lastUserAgent: string | null }>();
  for (const row of logs || []) {
    const accessId = Number(row?.access?.id || row?.access || 0);
    if (!accessId) continue;
    const current = logStats.get(accessId) || { latestAt: null, lastIpAddress: null, lastUserAgent: null };
    if (!current.latestAt) {
      current.latestAt = row?.createdAt || null;
      current.lastIpAddress = row?.ipAddress || null;
      current.lastUserAgent = summarizeUserAgent(row?.userAgent);
    }
    logStats.set(accessId, current);
  }

  const enriched = (accesses || []).map((access: any) => {
    const serialized = serializeAccess(message, access);
    const replyStat = replyStats.get(Number(access.id)) || { unreadCount: 0, latestAt: null };
    const adminStat = adminMessageStats.get(Number(access.id)) || { latestAt: null };
    const logStat = logStats.get(Number(access.id)) || { latestAt: null, lastIpAddress: null, lastUserAgent: null };
    const lastInteractionAt = [serialized.lastViewedAt, replyStat.latestAt, adminStat.latestAt, logStat.latestAt]
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;

    return {
      ...serialized,
      hasBeenAccessed: Number(serialized.viewCount || 0) > 0 || Boolean(serialized.firstViewedAt),
      unreadCount: replyStat.unreadCount,
      latestReplyAt: replyStat.latestAt,
      latestAdminMessageAt: adminStat.latestAt,
      lastInteractionAt,
      lastIpAddress: logStat.lastIpAddress,
      lastUserAgent: logStat.lastUserAgent,
    };
  }).filter((row: any) => {
    const matchesSearch = !search
      || toText(row?.code).toLowerCase().includes(search)
      || toText(row?.recipientName).toLowerCase().includes(search);
    if (!matchesSearch) return false;

    if (!statusFilter) return true;
    if (statusFilter === 'unread') return Number(row?.unreadCount || 0) > 0;
    if (statusFilter === 'accessed') return row?.hasBeenAccessed === true;
    if (statusFilter === 'not_accessed') return row?.hasBeenAccessed !== true;
    if (statusFilter === 'locked') return toText(row?.effectiveStatus).toLowerCase() === 'locked';
    if (statusFilter === 'expired') return toText(row?.effectiveStatus).toLowerCase() === 'expired';
    return true;
  }).sort((left: any, right: any) => {
    const unreadDiff = Number(right?.unreadCount || 0) - Number(left?.unreadCount || 0);
    if (unreadDiff !== 0) return unreadDiff;
    const latestLeft = left?.lastInteractionAt ? new Date(left.lastInteractionAt).getTime() : 0;
    const latestRight = right?.lastInteractionAt ? new Date(right.lastInteractionAt).getTime() : 0;
    if (latestLeft !== latestRight) return latestRight - latestLeft;
    const accessLeft = left?.hasBeenAccessed === true ? 1 : 0;
    const accessRight = right?.hasBeenAccessed === true ? 1 : 0;
    if (accessLeft !== accessRight) return accessRight - accessLeft;
    return Number(right?.id || 0) - Number(left?.id || 0);
  });

  const total = enriched.length;
  const data = enriched.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  return {
    message: {
      id: message.id,
      documentId: message.documentId || null,
      title: message.title || '',
    },
    data,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getQuickMessageActivityAccessDetail(messageId: unknown, accessId: unknown, tenantId: number | string) {
  const message = await findMessageOrThrow(messageId, tenantId);
  const access = await findAccessOrThrow(accessId, tenantId, {
    message: {
      select: ['id', 'status', 'expiresAt'],
    },
  });
  if (Number(access?.message?.id || access?.message || 0) !== Number(message.id)) {
    throw new QuickMessageAdminError(404, 'Quick message access not found');
  }

  const [replyRows, adminMessageRows, logRows] = await Promise.all([
    strapi.db.query(QUICK_MESSAGE_REPLY_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id }, access: { id: access.id } }, tenantId),
      select: ['id', 'createdAt', 'isRead'],
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    strapi.db.query(QUICK_MESSAGE_MESSAGE_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id }, access: { id: access.id } }, tenantId),
      select: ['id', 'createdAt', 'senderType'],
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    strapi.db.query(QUICK_MESSAGE_ACCESS_LOG_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id }, access: { id: access.id } }, tenantId),
      select: ['id', 'createdAt', 'ipAddress', 'userAgent', 'eventType', 'success'],
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      limit: 50,
    }),
  ]);

  const serialized = serializeAccess(message, access);
  const lastLog = (logRows || [])[0] || null;
  return {
    access: {
      ...serialized,
      unreadCount: (replyRows || []).filter((row: any) => row?.isRead !== true).length,
      latestReplyAt: replyRows?.[0]?.createdAt || null,
      latestAdminMessageAt: adminMessageRows?.[0]?.createdAt || null,
      lastInteractionAt: [serialized.lastViewedAt, replyRows?.[0]?.createdAt, adminMessageRows?.[0]?.createdAt, lastLog?.createdAt].filter(Boolean).sort().reverse()[0] || null,
      lastIpAddress: lastLog?.ipAddress || null,
      lastUserAgent: summarizeUserAgent(lastLog?.userAgent),
    },
  };
}

export async function listQuickMessageActivityMessages(messageId: unknown, accessId: unknown, query: Record<string, unknown>, tenantId: number | string) {
  const message = await findMessageOrThrow(messageId, tenantId);
  const access = await findAccessOrThrow(accessId, tenantId, {
    message: {
      select: ['id'],
    },
  });
  if (Number(access?.message?.id || access?.message || 0) !== Number(message.id)) {
    throw new QuickMessageAdminError(404, 'Quick message access not found');
  }

  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(200, toPositiveInt(query?.pageSize, 50));
  const [replies, adminMessages] = await Promise.all([
    strapi.db.query(QUICK_MESSAGE_REPLY_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id }, access: { id: access.id } }, tenantId),
      select: ['id', 'documentId', 'replyType', 'quickResponse', 'content', 'responderName', 'isRead', 'readAt', 'createdAt'],
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    strapi.db.query(QUICK_MESSAGE_MESSAGE_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id }, access: { id: access.id } }, tenantId),
      select: ['id', 'documentId', 'senderType', 'senderDisplayName', 'content', 'readByAdminAt', 'readByPublicAt', 'createdAt'],
      populate: {
        senderUser: {
          select: ['id', 'username', 'email', 'fullName'],
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const merged = [
    ...(replies || []).map((row: any) => normalizeActivityReplyRow(row, access?.recipientName || null)),
    ...(adminMessages || []).map((row: any) => normalizeActivityMessageRow(row, access?.recipientName || null)),
  ].sort((left: any, right: any) => {
    const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return Number(left?.id || 0) - Number(right?.id || 0);
  });

  const total = merged.length;
  return {
    data: merged.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function createQuickMessageActivityMessage(messageId: unknown, accessId: unknown, body: any, tenantId: number | string, senderUser?: AuthUser | null) {
  const message = await findMessageOrThrow(messageId, tenantId);
  const access = await findAccessOrThrow(accessId, tenantId, {
    message: {
      select: ['id'],
    },
  });
  if (Number(access?.message?.id || access?.message || 0) !== Number(message.id)) {
    throw new QuickMessageAdminError(404, 'Quick message access not found');
  }
  if (toText(access?.status).toLowerCase() === 'cancelled') {
    throw new QuickMessageAdminError(409, 'Cannot send message to a cancelled quick message access');
  }

  const payload = extractPayload(body);
  const content = toText(payload?.content);
  if (!content) {
    throw new QuickMessageAdminError(400, 'content is required');
  }
  if (content.length > 5000) {
    throw new QuickMessageAdminError(400, 'content max length is 5000');
  }

  const timestamp = new Date().toISOString();
  const created = await strapi.db.query(QUICK_MESSAGE_MESSAGE_UID).create({
    data: {
      tenant: tenantId,
      message: message.id,
      access: access.id,
      senderUser: senderUser?.id || null,
      senderType: 'ADMIN',
      senderDisplayName: resolveSenderDisplayName(senderUser),
      content,
      readByAdminAt: timestamp,
      readByPublicAt: null,
      metadata: null,
    },
    populate: {
      senderUser: {
        select: ['id', 'username', 'email', 'fullName'],
      },
    },
  });

  await createQuickMessageAccessLogEntry({
    tenantId,
    messageId: message.id,
    accessId: access.id,
    eventType: 'MESSAGE_SENT_ADMIN',
    success: true,
    metadata: {
      contentLength: content.length,
    },
  });

  return {
    message: normalizeActivityMessageRow(created, access?.recipientName || null),
  };
}

export async function markQuickMessageActivityRead(messageId: unknown, accessId: unknown, tenantId: number | string) {
  const message = await findMessageOrThrow(messageId, tenantId);
  const access = await findAccessOrThrow(accessId, tenantId, {
    message: {
      select: ['id'],
    },
  });
  if (Number(access?.message?.id || access?.message || 0) !== Number(message.id)) {
    throw new QuickMessageAdminError(404, 'Quick message access not found');
  }

  const unreadReplies = await strapi.db.query(QUICK_MESSAGE_REPLY_UID).findMany({
    where: mergeTenantWhere({ message: { id: message.id }, access: { id: access.id }, isRead: false }, tenantId),
    select: ['id'],
  });

  const readAt = new Date().toISOString();
  await Promise.all((unreadReplies || []).map((row: any) => strapi.db.query(QUICK_MESSAGE_REPLY_UID).update({
    where: mergeTenantWhere({ id: row.id }, tenantId),
    data: {
      isRead: true,
      readAt,
    },
  })));

  await createQuickMessageAccessLogEntry({
    tenantId,
    messageId: message.id,
    accessId: access.id,
    eventType: 'REPLY_MARKED_READ',
    success: true,
    metadata: {
      updatedCount: (unreadReplies || []).length,
    },
  });

  return {
    updatedCount: (unreadReplies || []).length,
    readAt,
  };
}

export async function listQuickMessageActivityLogs(messageId: unknown, accessId: unknown, query: Record<string, unknown>, tenantId: number | string) {
  const message = await findMessageOrThrow(messageId, tenantId);
  const access = await findAccessOrThrow(accessId, tenantId, {
    message: {
      select: ['id'],
    },
  });
  if (Number(access?.message?.id || access?.message || 0) !== Number(message.id)) {
    throw new QuickMessageAdminError(404, 'Quick message access not found');
  }

  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 20));
  const where = mergeTenantWhere({ message: { id: message.id }, access: { id: access.id } }, tenantId);
  const [rows, total] = await Promise.all([
    strapi.db.query(QUICK_MESSAGE_ACCESS_LOG_UID).findMany({
      where,
      select: ['id', 'documentId', 'eventType', 'success', 'ipAddress', 'userAgent', 'metadata', 'createdAt'],
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(QUICK_MESSAGE_ACCESS_LOG_UID).count({ where }),
  ]);

  return {
    data: (rows || []).map((row: any) => ({
      id: row.id,
      documentId: row.documentId || null,
      eventType: row.eventType || '',
      eventLabel: toActivityEventLabel(row.eventType, row.success !== false),
      success: row.success !== false,
      ipAddress: row.ipAddress || null,
      userAgent: summarizeUserAgent(row.userAgent),
      createdAt: row.createdAt || null,
      metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

async function loadMessageStats(messageIds: number[]) {
  const accessMap = new Map<number, any[]>();
  const replyMap = new Map<number, any[]>();

  if (messageIds.length === 0) {
    return { accessMap, replyMap };
  }

  const [accesses, replies] = await Promise.all([
    strapi.db.query(QUICK_MESSAGE_ACCESS_UID).findMany({
      where: {
        message: {
          id: {
            $in: messageIds,
          },
        },
      },
      select: ['id', 'status', 'expiresAt', 'viewCount', 'maxViews', 'lockedAt'],
      populate: {
        message: {
          select: ['id', 'status', 'expiresAt'],
        },
      },
    }),
    strapi.db.query(QUICK_MESSAGE_REPLY_UID).findMany({
      where: {
        message: {
          id: {
            $in: messageIds,
          },
        },
      },
      select: ['id', 'isRead'],
      populate: {
        message: {
          select: ['id'],
        },
      },
    }),
  ]);

  for (const access of accesses || []) {
    const messageId = Number(access?.message?.id || access?.message || 0);
    if (!messageId) continue;
    const bucket = accessMap.get(messageId) || [];
    bucket.push(access);
    accessMap.set(messageId, bucket);
  }

  for (const reply of replies || []) {
    const messageId = Number(reply?.message?.id || reply?.message || 0);
    if (!messageId) continue;
    const bucket = replyMap.get(messageId) || [];
    bucket.push(reply);
    replyMap.set(messageId, bucket);
  }

  return { accessMap, replyMap };
}

function buildSummary(message: any, accesses: any[], replies: any[]) {
  const activeAccessCount = accesses.filter((access) => computeAccessEffectiveStatus(message, access) === 'active').length;
  return {
    accessCount: accesses.length,
    activeAccessCount,
    totalViewCount: accesses.reduce((total, access) => total + Number(access?.viewCount || 0), 0),
    replyCount: replies.length,
    unreadReplyCount: replies.filter((reply) => reply?.isRead !== true).length,
  };
}

async function generateRandomAccessCode(length = DEFAULT_ACCESS_CODE_LENGTH): Promise<string> {
  let code = '';
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * ACCESS_CODE_ALPHABET.length);
    code += ACCESS_CODE_ALPHABET[randomIndex];
  }
  return code.toUpperCase();
}

export async function generateUniqueAccessCode(options: { length?: number; maxAttempts?: number; trx?: any } = {}): Promise<string> {
  const length = options.length || DEFAULT_ACCESS_CODE_LENGTH;
  const maxAttempts = options.maxAttempts || DEFAULT_ACCESS_CODE_MAX_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = await generateRandomAccessCode(length);
    const existing = await strapi.db.query(QUICK_MESSAGE_ACCESS_UID).findOne({
      where: { code },
      select: ['id'],
      transacting: options.trx,
    } as any);

    if (!existing?.id) {
      return code;
    }
  }

  throw new QuickMessageAdminError(500, 'Unable to generate a unique quick message access code');
}

async function createAccessRecord(message: any, payload: Record<string, unknown>, trx?: any) {
  const accessPayload = buildAccessMutationPayload(payload);
  const data: Record<string, unknown> = {
    tenant: message.tenant?.id || message.tenant,
    message: message.id,
    code: await generateUniqueAccessCode({ trx }),
    label: accessPayload.label ?? null,
    recipientName: accessPayload.recipientName ?? null,
    requirePin: accessPayload.requirePin,
    pinHash: null,
    accessVersion: 1,
    status: 'active',
    expiresAt: accessPayload.expiresAt ?? null,
    maxViews: accessPayload.maxViews ?? null,
    viewCount: 0,
    firstViewedAt: null,
    lastViewedAt: null,
    lockedAt: null,
  };

  let plainPin: string | null = null;
  if (accessPayload.requirePin) {
    plainPin = validatePin(payload.pin);
    data.pinHash = await hashPin(plainPin);
  }

  const created = await strapi.db.query(QUICK_MESSAGE_ACCESS_UID).create({
    data,
    transacting: trx,
  } as any);

  return { created, plainPin };
}

async function createClonedAccessRecord(options: {
  sourceAccess: any;
  sourceMessage: any;
  sequence: number;
  appendIndexToLabel: boolean;
  appendIndexToRecipientName: boolean;
  separator: string;
  trx?: any;
}) {
  const sourceAccess = options.sourceAccess;
  if (sourceAccess.requirePin === true && !toText(sourceAccess.pinHash)) {
    throw new QuickMessageAdminError(409, 'Source access requires PIN but has no stored PIN hash');
  }

  const code = await generateUniqueAccessCode({ trx: options.trx });
  const data = {
    tenant: options.sourceMessage?.tenant?.id || options.sourceMessage?.tenant || sourceAccess?.tenant?.id || sourceAccess?.tenant,
    message: options.sourceMessage?.id || sourceAccess?.message?.id || sourceAccess?.message,
    code,
    label: toCloneText(sourceAccess.label, {
      appendIndex: options.appendIndexToLabel,
      sequence: options.sequence,
      separator: options.separator,
    }),
    recipientName: toCloneText(sourceAccess.recipientName, {
      appendIndex: options.appendIndexToRecipientName,
      sequence: options.sequence,
      separator: options.separator,
    }),
    requirePin: sourceAccess.requirePin === true,
    pinHash: sourceAccess.requirePin === true ? sourceAccess.pinHash || null : null,
    accessVersion: 1,
    status: 'active',
    expiresAt: sourceAccess.expiresAt || null,
    maxViews: sourceAccess.maxViews ?? null,
    viewCount: 0,
    firstViewedAt: null,
    lastViewedAt: null,
    lockedAt: null,
  };

  return strapi.db.query(QUICK_MESSAGE_ACCESS_UID).create({
    data,
    transacting: options.trx,
  } as any);
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function listQuickMessages(query: Record<string, unknown>, tenantId: number | string) {
  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 20));
  const where = mergeTenantWhere(buildMessageListWhere(query), tenantId);
  const orderBy = buildListSort(query, 'createdAt');

  const [rows, total] = await Promise.all([
    strapi.db.query(QUICK_MESSAGE_UID).findMany({
      where,
      select: ['id', 'documentId', 'title', 'status', 'expiresAt', 'allowReply', 'replyMode', 'senderDisplayName', 'createdAt', 'updatedAt'],
      orderBy,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(QUICK_MESSAGE_UID).count({ where }),
  ]);

  const messageIds = (rows || []).map((row: any) => Number(row?.id || 0)).filter((id: number) => id > 0);
  const { accessMap, replyMap } = await loadMessageStats(messageIds);

  const data = (rows || []).map((row: any) => {
    const accesses = accessMap.get(Number(row.id)) || [];
    const replies = replyMap.get(Number(row.id)) || [];
    return serializeMessageListItem(row, buildSummary(row, accesses, replies));
  });

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getQuickMessageDetail(idParam: unknown, tenantId: number | string) {
  const message = await findMessageOrThrow(idParam, tenantId, {
    sender: {
      select: ['id', 'username', 'email', 'fullName'],
    },
  });

  const [accesses, replies] = await Promise.all([
    strapi.db.query(QUICK_MESSAGE_ACCESS_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id } }, tenantId),
      select: ['id', 'documentId', 'code', 'label', 'recipientName', 'requirePin', 'pinHash', 'accessVersion', 'status', 'expiresAt', 'maxViews', 'viewCount', 'firstViewedAt', 'lastViewedAt', 'lockedAt', 'createdAt'],
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    strapi.db.query(QUICK_MESSAGE_REPLY_UID).findMany({
      where: mergeTenantWhere({ message: { id: message.id } }, tenantId),
      select: ['id', 'isRead'],
      limit: 10000,
    }),
  ]);

  return {
    message: serializeMessage(message),
    accesses: (accesses || []).map((access: any) => serializeAccess(message, access)),
    summary: buildSummary(message, accesses || [], replies || []),
  };
}

export async function createQuickMessage(body: any, tenantId: number | string, senderUser: AuthUser) {
  const payload = extractPayload(body);
  const mutation = buildMessageMutationPayload(payload, senderUser, { isCreate: true });
  const initialAccessInput = payload.initialAccess;

  if (!initialAccessInput || typeof initialAccessInput !== 'object' || Array.isArray(initialAccessInput)) {
    throw new QuickMessageAdminError(400, 'initialAccess is required');
  }

  const result = await strapi.db.transaction(async ({ trx }: any) => {
    const createdMessage = await strapi.db.query(QUICK_MESSAGE_UID).create({
      data: {
        title: mutation.title,
        content: mutation.content,
        links: mutation.links ?? null,
        status: mutation.status,
        expiresAt: mutation.expiresAt,
        allowReply: mutation.allowReply,
        replyMode: mutation.replyMode,
        tenant: tenantId,
        sender: senderUser.id,
        senderDisplayName: mutation.senderDisplayName,
      },
      transacting: trx,
    } as any);

    const createdMessageWithTenant = {
      ...createdMessage,
      tenant: { id: tenantId },
      status: mutation.status,
      expiresAt: mutation.expiresAt,
    };
    const { created: createdAccess, plainPin } = await createAccessRecord(createdMessageWithTenant, initialAccessInput as Record<string, unknown>, trx);

    return { createdMessage, createdAccess, plainPin };
  });

  return {
    message: {
      id: result.createdMessage.id,
      documentId: result.createdMessage.documentId || null,
      title: result.createdMessage.title || '',
    },
    access: serializeAccess(result.createdMessage, result.createdAccess),
    plainPin: result.plainPin,
  };
}

export async function updateQuickMessage(idParam: unknown, body: any, tenantId: number | string, senderUser: AuthUser) {
  const existing = await findMessageOrThrow(idParam, tenantId);
  const payload = extractPayload(body);
  const existingStatus = toText(existing?.status).toLowerCase();
  if (existingStatus === 'cancelled') {
    throw new QuickMessageAdminError(409, 'Cannot update a cancelled quick message');
  }

  const mutation = buildMessageMutationPayload(payload, senderUser, { current: existing });
  const nextStatus = payload.status === undefined ? existing.status : mutation.status;
  if (existingStatus === 'locked' && nextStatus === 'active') {
    throw new QuickMessageAdminError(409, 'Use unlock action to reactivate a locked quick message');
  }

  const updated = await strapi.db.query(QUICK_MESSAGE_UID).update({
    where: buildMessageWhereByRef(idParam, tenantId),
    data: {
      ...(payload.title !== undefined ? { title: mutation.title } : {}),
      ...(payload.content !== undefined ? { content: mutation.content } : {}),
      ...(payload.links !== undefined ? { links: mutation.links } : {}),
      ...(payload.expiresAt !== undefined ? { expiresAt: mutation.expiresAt } : {}),
      ...(payload.allowReply !== undefined ? { allowReply: mutation.allowReply } : {}),
      ...(payload.replyMode !== undefined ? { replyMode: mutation.replyMode } : {}),
      ...(payload.status !== undefined ? { status: nextStatus } : {}),
    },
  });

  return {
    message: serializeMessage(updated),
  };
}

export async function lockQuickMessage(idParam: unknown, tenantId: number | string) {
  await findMessageOrThrow(idParam, tenantId);
  const updated = await strapi.db.query(QUICK_MESSAGE_UID).update({
    where: buildMessageWhereByRef(idParam, tenantId),
    data: { status: 'locked' },
  });
  return { message: serializeMessage(updated) };
}

export async function unlockQuickMessage(idParam: unknown, body: any, tenantId: number | string) {
  const payload = extractPayload(body);
  const existing = await findMessageOrThrow(idParam, tenantId);
  const status = toText(existing?.status).toLowerCase();
  if (status === 'cancelled') {
    throw new QuickMessageAdminError(409, 'Cannot unlock a cancelled quick message');
  }
  if (status !== 'locked') {
    throw new QuickMessageAdminError(409, 'Only locked quick messages can be unlocked');
  }

  const expiresAt = payload.expiresAt !== undefined
    ? toFutureDateTime(payload.expiresAt, 'expiresAt', { required: true })
    : existing.expiresAt;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    throw new QuickMessageAdminError(409, 'Quick message must have a future expiresAt before unlock');
  }

  const updated = await strapi.db.query(QUICK_MESSAGE_UID).update({
    where: buildMessageWhereByRef(idParam, tenantId),
    data: {
      status: 'active',
      expiresAt: expiresAt || null,
    },
  });

  return { message: serializeMessage(updated) };
}

export async function cancelQuickMessage(idParam: unknown, tenantId: number | string) {
  await findMessageOrThrow(idParam, tenantId);
  const updated = await strapi.db.query(QUICK_MESSAGE_UID).update({
    where: buildMessageWhereByRef(idParam, tenantId),
    data: { status: 'cancelled' },
  });
  return { message: serializeMessage(updated) };
}

export async function createQuickMessageAccess(messageId: unknown, body: any, tenantId: number | string) {
  const message = await findMessageOrThrow(messageId, tenantId);
  assertAccessWritable(message);
  const payload = extractPayload(body);
  const { created, plainPin } = await createAccessRecord({ ...message, tenant: { id: tenantId } }, payload);
  return {
    access: serializeAccess(message, created),
    plainPin,
  };
}

export async function cloneQuickMessageAccessBatch(idParam: unknown, body: any, tenantId: number | string) {
  const payload = extractPayload(body);
  const cloneOptions = buildCloneBatchOptions(payload);
  const sourceAccess = await findAccessOrThrow(idParam, tenantId, {
    tenant: {
      select: ['id'],
    },
    message: {
      select: ['id', 'status', 'expiresAt'],
      populate: {
        tenant: {
          select: ['id'],
        },
      },
    },
  });

  if (toText(sourceAccess?.status).toLowerCase() === 'cancelled') {
    throw new QuickMessageAdminError(409, 'Cannot clone a cancelled quick message access');
  }

  const message = sourceAccess?.message;
  if (!message?.id) {
    throw new QuickMessageAdminError(409, 'Source access is missing quick message relation');
  }
  assertAccessWritable(message);

  const result = await strapi.db.transaction(async ({ trx }: any) => {
    const createdAccesses = [];
    for (let index = 0; index < cloneOptions.quantity; index += 1) {
      const created = await createClonedAccessRecord({
        sourceAccess,
        sourceMessage: message,
        sequence: cloneOptions.startIndex + index,
        appendIndexToLabel: cloneOptions.appendIndexToLabel,
        appendIndexToRecipientName: cloneOptions.appendIndexToRecipientName,
        separator: cloneOptions.separator,
        trx,
      });
      createdAccesses.push(created);
    }
    return createdAccesses;
  });

  return {
    sourceAccess: serializeAccess(message, sourceAccess),
    quantity: result.length,
    accesses: (result || []).map((item: any) => serializeAccess(message, item)),
  };
}

export async function updateQuickMessageAccess(idParam: unknown, body: any, tenantId: number | string) {
  const existing = await findAccessOrThrow(idParam, tenantId, {
    message: {
      select: ['id', 'status', 'expiresAt'],
    },
  });
  if (toText(existing?.status).toLowerCase() === 'cancelled') {
    throw new QuickMessageAdminError(409, 'Cannot update a cancelled quick message access');
  }

  const payload = extractPayload(body);
  const mutation = buildAccessMutationPayload(payload);
  const updated = await strapi.db.query(QUICK_MESSAGE_ACCESS_UID).update({
    where: buildAccessWhereByRef(idParam, tenantId),
    data: {
      ...(payload.label !== undefined ? { label: mutation.label } : {}),
      ...(payload.recipientName !== undefined ? { recipientName: mutation.recipientName } : {}),
      ...(payload.expiresAt !== undefined ? { expiresAt: mutation.expiresAt } : {}),
      ...(payload.maxViews !== undefined ? { maxViews: mutation.maxViews } : {}),
    },
  });

  return {
    access: serializeAccess(existing.message, { ...existing, ...updated }),
  };
}

async function updateAccessPinState(idParam: unknown, tenantId: number | string, options: { pin?: unknown; mode: 'enable' | 'change' | 'disable' }) {
  const existing = await findAccessOrThrow(idParam, tenantId, {
    message: {
      select: ['id', 'status', 'expiresAt'],
    },
  });

  if (options.mode === 'enable' && existing.requirePin === true) {
    throw new QuickMessageAdminError(409, 'PIN is already enabled for this quick message access; use change-pin instead');
  }

  if (options.mode === 'change' && existing.requirePin !== true) {
    throw new QuickMessageAdminError(409, 'PIN is not enabled for this quick message access');
  }

  if (options.mode === 'disable' && existing.requirePin !== true && !toText(existing?.pinHash)) {
    return {
      access: serializeAccess(existing.message, existing),
      plainPin: null,
    };
  }

  let pinHash: string | null = null;
  let plainPin: string | null = null;
  if (options.mode !== 'disable') {
    plainPin = validatePin(options.pin);
    pinHash = await hashPin(plainPin);
  }

  const updated = await strapi.db.query(QUICK_MESSAGE_ACCESS_UID).update({
    where: buildAccessWhereByRef(idParam, tenantId),
    data: {
      requirePin: options.mode === 'disable' ? false : true,
      pinHash,
      accessVersion: Number(existing.accessVersion || 1) + 1,
    },
  });

  return {
    access: serializeAccess(existing.message, { ...existing, ...updated }),
    plainPin,
  };
}

export async function enableQuickMessageAccessPin(idParam: unknown, body: any, tenantId: number | string) {
  const payload = extractPayload(body);
  return updateAccessPinState(idParam, tenantId, { pin: payload.pin, mode: 'enable' });
}

export async function changeQuickMessageAccessPin(idParam: unknown, body: any, tenantId: number | string) {
  const payload = extractPayload(body);
  return updateAccessPinState(idParam, tenantId, { pin: payload.pin, mode: 'change' });
}

export async function disableQuickMessageAccessPin(idParam: unknown, tenantId: number | string) {
  return updateAccessPinState(idParam, tenantId, { mode: 'disable' });
}

export async function lockQuickMessageAccess(idParam: unknown, tenantId: number | string) {
  const existing = await findAccessOrThrow(idParam, tenantId, {
    message: {
      select: ['id', 'status', 'expiresAt'],
    },
  });
  const updated = await strapi.db.query(QUICK_MESSAGE_ACCESS_UID).update({
    where: buildAccessWhereByRef(idParam, tenantId),
    data: {
      status: 'locked',
      lockedAt: new Date().toISOString(),
      accessVersion: Number(existing.accessVersion || 1) + 1,
    },
  });
  return { access: serializeAccess(existing.message, { ...existing, ...updated }) };
}

export async function unlockQuickMessageAccess(idParam: unknown, body: any, tenantId: number | string) {
  const existing = await findAccessOrThrow(idParam, tenantId, {
    message: {
      select: ['id', 'status', 'expiresAt'],
    },
  });

  if (toText(existing?.status).toLowerCase() === 'cancelled') {
    throw new QuickMessageAdminError(409, 'Cannot unlock a cancelled quick message access');
  }
  if (toText(existing?.status).toLowerCase() !== 'locked') {
    throw new QuickMessageAdminError(409, 'Only locked quick message access can be unlocked');
  }

  const payload = extractPayload(body);
  const expiresAt = payload.expiresAt !== undefined
    ? toFutureDateTime(payload.expiresAt, 'expiresAt', { required: true })
    : existing.expiresAt;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    throw new QuickMessageAdminError(409, 'Quick message access must have a future expiresAt before unlock');
  }

  const updated = await strapi.db.query(QUICK_MESSAGE_ACCESS_UID).update({
    where: buildAccessWhereByRef(idParam, tenantId),
    data: {
      status: 'active',
      lockedAt: null,
      expiresAt: expiresAt || null,
      accessVersion: Number(existing.accessVersion || 1) + 1,
    },
  });
  return { access: serializeAccess(existing.message, { ...existing, ...updated }) };
}

export async function cancelQuickMessageAccess(idParam: unknown, tenantId: number | string) {
  const existing = await findAccessOrThrow(idParam, tenantId, {
    message: {
      select: ['id', 'status', 'expiresAt'],
    },
  });
  const updated = await strapi.db.query(QUICK_MESSAGE_ACCESS_UID).update({
    where: buildAccessWhereByRef(idParam, tenantId),
    data: {
      status: 'cancelled',
      lockedAt: null,
      accessVersion: Number(existing.accessVersion || 1) + 1,
    },
  });
  return { access: serializeAccess(existing.message, { ...existing, ...updated }) };
}

export async function listQuickMessageReplies(messageId: unknown, query: Record<string, unknown>, tenantId: number | string) {
  const message = await findMessageOrThrow(messageId, tenantId);
  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 20));
  const accessId = parseOptionalPositiveInt(query?.accessId);
  const isReadInput = toText(query?.isRead).toLowerCase();
  const replyType = toText(query?.replyType).toLowerCase();
  const quickResponse = toText(query?.quickResponse).toLowerCase();
  const whereParts: Record<string, unknown>[] = [{ message: { id: message.id } }];

  if (accessId) {
    whereParts.push({ access: { id: accessId } });
  }
  if (isReadInput === 'true' || isReadInput === 'false') {
    whereParts.push({ isRead: isReadInput === 'true' });
  }
  if (replyType === 'quick' || replyType === 'text') {
    whereParts.push({ replyType: { $eq: replyType as QuickMessageReplyType } });
  }
  if (quickResponse) {
    whereParts.push({ quickResponse: { $eq: quickResponse } });
  }

  const where = mergeTenantWhere(whereParts.length === 1 ? whereParts[0] : { $and: whereParts }, tenantId);
  const orderBy = buildListSort(query, 'createdAt');

  const [rows, total] = await Promise.all([
    strapi.db.query(QUICK_MESSAGE_REPLY_UID).findMany({
      where,
      select: ['id', 'documentId', 'replyType', 'quickResponse', 'content', 'responderName', 'isRead', 'readAt', 'createdAt'],
      populate: {
        access: {
          select: ['id', 'documentId', 'code', 'label', 'recipientName'],
        },
      },
      orderBy,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(QUICK_MESSAGE_REPLY_UID).count({ where }),
  ]);

  return {
    message: {
      id: message.id,
      documentId: message.documentId || null,
      title: message.title || '',
    },
    data: (rows || []).map((reply: any) => serializeReply(reply)),
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function markQuickMessageReplyRead(idParam: unknown, tenantId: number | string) {
  const existing = await findReplyOrThrow(idParam, tenantId, {
    access: {
      select: ['id', 'documentId', 'code', 'label', 'recipientName'],
    },
  });
  const updated = existing.isRead === true
    ? existing
    : await strapi.db.query(QUICK_MESSAGE_REPLY_UID).update({
        where: buildReplyWhereByRef(idParam, tenantId),
        data: {
          isRead: true,
          readAt: new Date().toISOString(),
        },
        populate: {
          access: {
            select: ['id', 'documentId', 'code', 'label', 'recipientName'],
          },
        },
      });

  return {
    reply: serializeReply(updated),
  };
}

export async function markQuickMessageRepliesReadAll(messageId: unknown, tenantId: number | string) {
  const message = await findMessageOrThrow(messageId, tenantId);
  const readAt = new Date().toISOString();
  const unreadReplies = await strapi.db.query(QUICK_MESSAGE_REPLY_UID).findMany({
    where: mergeTenantWhere({
      message: { id: message.id },
      isRead: false,
    }, tenantId),
    select: ['id'],
    limit: 10000,
  });

  const unreadIds = (unreadReplies || []).map((reply: any) => Number(reply?.id || 0)).filter((id: number) => id > 0);
  if (unreadIds.length === 0) {
    return { updatedCount: 0 };
  }

  for (const replyId of unreadIds) {
    await strapi.db.query(QUICK_MESSAGE_REPLY_UID).update({
      where: mergeTenantWhere({ id: replyId }, tenantId),
      data: {
        isRead: true,
        readAt,
      },
    });
  }

  return {
    updatedCount: unreadIds.length,
  };
}

export default {
  getTenantIdFromContext,
  listQuickMessages,
  getQuickMessageDetail,
  createQuickMessage,
  updateQuickMessage,
  lockQuickMessage,
  unlockQuickMessage,
  cancelQuickMessage,
  createQuickMessageAccess,
  updateQuickMessageAccess,
  enableQuickMessageAccessPin,
  changeQuickMessageAccessPin,
  disableQuickMessageAccessPin,
  lockQuickMessageAccess,
  unlockQuickMessageAccess,
  cancelQuickMessageAccess,
  listQuickMessageReplies,
  markQuickMessageReplyRead,
  markQuickMessageRepliesReadAll,
  createQuickMessageAccessLogEntry,
  listQuickMessageActivityAccesses,
  getQuickMessageActivityAccessDetail,
  listQuickMessageActivityMessages,
  createQuickMessageActivityMessage,
  markQuickMessageActivityRead,
  listQuickMessageActivityLogs,
  QUICK_MESSAGE_MANAGE_PERMISSION,
};