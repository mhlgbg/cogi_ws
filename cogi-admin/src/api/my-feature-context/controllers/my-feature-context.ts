import myFeatureContextService from '../services/my-feature-context';

export default {
  async index(ctx: any) {
    const authUser = ctx.state?.user;
    if (!authUser?.id) {
      return ctx.unauthorized('Unauthorized');
    }

    const tenantCodeRaw = ctx.get?.('x-tenant-code') || ctx.request?.headers?.['x-tenant-code'];
    const tenantCode = String(tenantCodeRaw || '').trim().toLowerCase();

    if (!tenantCode) {
      return ctx.badRequest('x-tenant-code header is required');
    }

    try {
      const data = await myFeatureContextService.buildContext({
        userId: authUser.id,
        tenantCode,
      });

      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);
      if (error?.status === 404) return ctx.notFound(error.message);

      strapi.log.error('[my-feature-context] unexpected error', error);
      return ctx.internalServerError('Failed to load feature context');
    }
  },
};
