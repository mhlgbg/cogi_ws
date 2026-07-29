const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 6;
const QUICK_MESSAGE_ACCESS_UID = 'api::quick-message-access.quick-message-access';
const buckets = new Map<string, { count: number; startedAt: number }>();

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeCode(value: unknown): string {
  return toText(value).toUpperCase();
}

function readClientIp(ctx: any): string {
  const forwardedFor = ctx.request?.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return String(ctx.request?.ip || ctx.ip || 'unknown').trim() || 'unknown';
}

async function createReplyRateLimitedLog(ctx: any) {
  try {
    const code = normalizeCode(ctx.params?.code);
    if (!code) return;
    const access = await strapi.db.query(QUICK_MESSAGE_ACCESS_UID).findOne({
      where: {
        code: {
          $eq: code,
        },
      },
      select: ['id'],
      populate: {
        tenant: {
          select: ['id'],
        },
        message: {
          select: ['id'],
          populate: {
            tenant: {
              select: ['id'],
            },
          },
        },
      },
    });
    if (!access?.id || !access?.message?.id) return;

    const { createQuickMessageAccessLogEntry } = await import('../api/quick-message/services/quick-message-admin');
    await createQuickMessageAccessLogEntry({
      tenantId: access?.message?.tenant?.id || access?.tenant?.id,
      messageId: access?.message?.id,
      accessId: access?.id,
      eventType: 'REPLY_RATE_LIMITED',
      success: false,
      ipAddress: readClientIp(ctx),
      userAgent: toText(ctx.request?.headers?.['user-agent']) || null,
    });
  } catch {
    return;
  }
}

export default () => {
  return async (ctx: any, next: () => Promise<void>) => {
    const now = Date.now();
    const key = `quick-message-public-reply:${normalizeCode(ctx.params?.code)}:${readClientIp(ctx)}`;
    const current = buckets.get(key);

    if (!current || now - current.startedAt >= WINDOW_MS) {
      buckets.set(key, { count: 1, startedAt: now });
      await next();
      return;
    }

    if (current.count >= MAX_REQUESTS) {
      const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000));
      await createReplyRateLimitedLog(ctx);
      ctx.set('Retry-After', String(retryAfter));
      ctx.status = 429;
      ctx.body = {
        success: false,
        error: {
          code: 'TOO_MANY_PUBLIC_REPLIES',
          message: 'Bạn đang gửi phản hồi quá nhanh. Vui lòng thử lại sau.',
        },
      };
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    await next();
  };
};