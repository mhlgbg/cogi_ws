import {
  createPublicChatMessage,
  createPublicChatSession,
  getPublicChatSessionMessages,
  getPublicChatWidgetStatus,
} from '../services/public-chat';

function extractPayload(ctx: any): Record<string, unknown> {
  const body = ctx.request?.body;
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

function handleError(ctx: any, error: any) {
  const status = Number(error?.status || 500);
  const rawMessage = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'Unexpected public chat error';

  function send(statusCode: number, code: string, msg: string) {
    ctx.status = statusCode;
    ctx.body = { code, message: msg };
  }

  // Map common statuses to standardized payload { code, message }
  if (status === 400) return send(400, 'BAD_REQUEST', rawMessage);
  if (status === 401) return send(401, 'UNAUTHORIZED', rawMessage);
  if (status === 403) {
    // Provide more specific codes for widget flows
    const lower = rawMessage.toLowerCase();
    if (lower.includes('disabled')) {
      return send(403, 'CHAT_WIDGET_DISABLED', 'Kênh tư vấn trực tuyến hiện đang tạm đóng.');
    }
    if (lower.includes('domain') && lower.includes('not')) {
      return send(403, 'CHAT_WIDGET_DOMAIN_DENIED', 'Dịch vụ tư vấn trực tuyến hiện không khả dụng trên website này.');
    }
    return send(403, 'FORBIDDEN', rawMessage);
  }
  if (status === 404) return send(404, 'NOT_FOUND', rawMessage);
  if (status === 409) return send(409, 'CONFLICT', rawMessage);
  if (status === 429) return send(429, 'TOO_MANY_REQUESTS', rawMessage);

  strapi.log.error('[public-chat] unexpected error', error);
  return send(500, 'INTERNAL_SERVER_ERROR', rawMessage);
}

export default {
  async createSession(ctx: any) {
    try {
      // pass ctx to service so it can inspect headers (Origin/Referer) for embed security
      const data = await createPublicChatSession(extractPayload(ctx), ctx);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async createMessage(ctx: any) {
    try {
      const data = await createPublicChatMessage(extractPayload(ctx), ctx);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async sessionMessages(ctx: any) {
    try {
      const data = await getPublicChatSessionMessages(ctx.params?.id, ctx);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },
  async widgetStatus(ctx: any) {
    try {
      const payload = { tenantCode: ctx.query?.tenantCode, tenantSlug: ctx.query?.tenantSlug };
      const data = await getPublicChatWidgetStatus(payload, ctx);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },
};
