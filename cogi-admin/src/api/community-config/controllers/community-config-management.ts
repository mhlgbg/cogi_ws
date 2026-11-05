import {
  activateCommunityConfig,
  archiveCommunityConfig,
  cloneCommunityConfig,
  createCommunityConfig,
  getActiveCommunityConfig,
  getCommunityConfigDetail,
  getCommunityConfigFormOptions,
  getCommunityConfigPreview,
  getTenantCommunityBranding,
  getTenantIdFromContext,
  listCommunityConfigs,
  updateCommunityConfig,
} from '../services/community-config-management';

type AuthUser = {
  id: number;
  username?: string | null;
  email?: string | null;
  blocked?: boolean | null;
};

async function resolveUserFromJwt(ctx: any): Promise<AuthUser | null> {
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
      select: ['id', 'username', 'email', 'blocked'],
    });
  } catch {
    return null;
  }
}

async function requireAuthenticatedUser(ctx: any): Promise<AuthUser | null> {
  let authUser = ctx.state?.user as AuthUser | undefined;

  if (!authUser?.id) {
    authUser = await resolveUserFromJwt(ctx) || undefined;
    if (authUser?.id) {
      ctx.state.user = authUser;
    }
  }

  if (!authUser?.id) {
    ctx.unauthorized('Unauthorized');
    return null;
  }

  if (authUser?.blocked) {
    ctx.unauthorized('Account is blocked');
    return null;
  }

  return authUser;
}

function handleError(ctx: any, error: any) {
  const status = Number(error?.status || 500);
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'Unexpected community config error';

  if (status === 400) return ctx.badRequest(message);
  if (status === 401) return ctx.unauthorized(message);
  if (status === 403) return ctx.forbidden(message);
  if (status === 404) return ctx.notFound(message);
  if (status === 409) return ctx.conflict(message);

  strapi.log.error('[community-config-management] unexpected error', error);
  return ctx.internalServerError(message);
}

export default {
  async listConfigs(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = getTenantIdFromContext(ctx);
      const data = await listCommunityConfigs(ctx.request?.query || {}, tenantId);
      ctx.body = { success: true, ...data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async configDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = getTenantIdFromContext(ctx);
      const data = await getCommunityConfigDetail(ctx.params?.id, tenantId);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async configFormOptions(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      ctx.body = { success: true, data: getCommunityConfigFormOptions() };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async createConfig(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = getTenantIdFromContext(ctx);
      const data = await createCommunityConfig(ctx.request?.body || {}, tenantId);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async updateConfig(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = getTenantIdFromContext(ctx);
      const data = await updateCommunityConfig(ctx.params?.id, ctx.request?.body || {}, tenantId);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async activateConfig(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = getTenantIdFromContext(ctx);
      const data = await activateCommunityConfig(ctx.params?.id, tenantId);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async archiveConfig(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = getTenantIdFromContext(ctx);
      const data = await archiveCommunityConfig(ctx.params?.id, tenantId);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async cloneConfig(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = getTenantIdFromContext(ctx);
      const data = await cloneCommunityConfig(ctx.params?.id, tenantId);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async previewConfig(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = getTenantIdFromContext(ctx);
      const config = await getCommunityConfigPreview(ctx.params?.id, tenantId);
      const tenant = await getTenantCommunityBranding(tenantId);
      ctx.body = {
        success: true,
        data: {
          mode: 'preview',
          tenant,
          config,
        },
      };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async activeConfig(ctx: any) {
    try {
      const tenantId = getTenantIdFromContext(ctx);
      const [tenant, activeConfig] = await Promise.all([
        getTenantCommunityBranding(tenantId),
        getActiveCommunityConfig(tenantId),
      ]);

      ctx.body = {
        success: true,
        data: {
          mode: 'active',
          tenant,
          config: activeConfig,
          hasActiveConfig: Boolean(activeConfig),
        },
      };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },
};

