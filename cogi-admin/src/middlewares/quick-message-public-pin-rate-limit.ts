const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const buckets = new Map<string, { count: number; startedAt: number }>();

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function readClientIp(ctx: any): string {
  const forwardedFor = ctx.request?.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return String(ctx.request?.ip || ctx.ip || 'unknown').trim() || 'unknown';
}

export default () => {
  return async (ctx: any, next: () => Promise<void>) => {
    const now = Date.now();
    const code = toText(ctx.params?.code).toUpperCase();
    const key = `quick-message-public-pin:${readClientIp(ctx)}:${code}`;
    const current = buckets.get(key);

    if (!current || now - current.startedAt >= WINDOW_MS) {
      buckets.set(key, { count: 1, startedAt: now });
      await next();
      return;
    }

    if (current.count >= MAX_REQUESTS) {
      const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000));
      ctx.set('Retry-After', String(retryAfter));
      ctx.status = 429;
      ctx.body = {
        success: false,
        error: {
          code: 'TOO_MANY_PIN_ATTEMPTS',
          message: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.',
        },
      };
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    await next();
  };
};