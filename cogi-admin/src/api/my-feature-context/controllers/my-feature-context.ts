import myFeatureContextService from '../services/my-feature-context';

async function resolveUserFromJwt(ctx: any) {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!token) return null;

    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) return null;

    const decoded = await jwtService.verify(token);
    const userId = Number(decoded?.id);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'email', 'confirmed', 'blocked'],
    });
  } catch {
    return null;
  }
}

export default {
  async index(ctx: any) {
    let authUser = ctx.state?.user;
    if (!authUser?.id) {
      authUser = await resolveUserFromJwt(ctx);
    }

    if (!authUser?.id) {
      return ctx.unauthorized('Unauthorized');
    }

    if (authUser?.blocked) {
      return ctx.unauthorized('Account is blocked');
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
