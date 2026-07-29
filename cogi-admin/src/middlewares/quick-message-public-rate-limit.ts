const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;
const buckets = new Map<string, { count: number; startedAt: number }>();

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
    const key = `quick-message-public:${readClientIp(ctx)}`;
    const current = buckets.get(key);

    if (!current || now - current.startedAt >= WINDOW_MS) {
      buckets.set(key, { count: 1, startedAt: now });
      await next();
      return;
    }

    if (current.count >= MAX_REQUESTS) {
      ctx.status = 429;
      ctx.body = {
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Bạn đang tra cứu quá nhanh. Vui lòng thử lại sau.',
        },
      };
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    await next();
  };
};