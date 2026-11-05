import {
  createPhotoFrameCampaign,
  deletePhotoFrameCampaign,
  getPhotoFrameCampaignDetail,
  getPhotoFrameCampaignFormOptions,
  getPublicPhotoFrameCampaign,
  listPhotoFrameCampaigns,
  togglePhotoFrameCampaignStatus,
  updatePhotoFrameCampaign,
} from '../services/photo-frame-campaign';

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
      select: ['id', 'username', 'email', 'blocked', 'isPlatformAdmin'],
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
    : 'Unexpected photo frame campaign management error';

  if (status === 400) return ctx.badRequest(message);
  if (status === 401) return ctx.unauthorized(message);
  if (status === 403) return ctx.forbidden(message);
  if (status === 404) return ctx.notFound(message);
  if (status === 409) return ctx.conflict(message);

  strapi.log.error('[photo-frame-campaign] unexpected error', error);
  return ctx.internalServerError(message);
}

export default {
  async getPublicCampaign(ctx: any) {
    try {
      const data = await getPublicPhotoFrameCampaign(ctx);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async formOptions(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await getPhotoFrameCampaignFormOptions(ctx, authUser);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async listCampaigns(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await listPhotoFrameCampaigns(ctx, authUser);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async campaignDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await getPhotoFrameCampaignDetail(ctx, authUser);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async createCampaign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await createPhotoFrameCampaign(ctx, authUser);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async updateCampaign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await updatePhotoFrameCampaign(ctx, authUser);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async toggleStatus(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await togglePhotoFrameCampaignStatus(ctx, authUser);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async deleteCampaign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await deletePhotoFrameCampaign(ctx, authUser);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },
};