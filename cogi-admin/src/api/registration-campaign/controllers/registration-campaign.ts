import { resolveCurrentTenantId, toText } from '../../../utils/tenant-scope';
import {
  approveCampaignRegistration,
  buildVerificationRedirectUrl,
  cancelCampaignRegistration,
  changeRegistrationEmail,
  completeRegistrationAccount,
  completeRegistrationForCurrentUser,
  getPublicRegistrationCampaignByCode,
  handleRegistrationCampaignError,
  registerToCampaign,
  rejectCampaignRegistration,
  resendRegistrationVerification,
  verifyRegistrationEmail,
} from '../services/registration-campaign';

type AuthUser = {
  id: number;
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
    const userId = Number(decoded?.id || 0);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'email', 'blocked'],
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

  if (authUser.blocked) {
    ctx.unauthorized('Account is blocked');
    return null;
  }

  return authUser;
}

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

export default {
  async getPublic(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const campaignCode = toText(ctx.params?.code).toLowerCase();
      if (!campaignCode) {
        return ctx.badRequest('code is required');
      }

      const data = await getPublicRegistrationCampaignByCode(tenantId, campaignCode);
      ctx.body = {
        ok: true,
        data,
      };
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error);
    }
  },

  async register(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const campaignCode = toText(ctx.params?.code).toLowerCase();
      if (!campaignCode) {
        return ctx.badRequest('code is required');
      }

      const data = await registerToCampaign(ctx, tenantId, campaignCode, extractPayload(ctx));
      ctx.body = data;
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error);
    }
  },

  async resendVerification(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const data = await resendRegistrationVerification(ctx, tenantId, extractPayload(ctx));
      ctx.body = data;
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error);
    }
  },

  async changeEmail(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const data = await changeRegistrationEmail(ctx, tenantId, extractPayload(ctx));
      ctx.body = data;
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error);
    }
  },

  async verify(ctx: any) {
    try {
      const token = toText(ctx.request?.query?.token);
      const data = await verifyRegistrationEmail(ctx, token);
      const redirectMode = toText(ctx.request?.query?.redirect).toLowerCase();

      if (redirectMode !== '0' && data?.redirectUrl) {
        ctx.redirect(data.redirectUrl);
        return;
      }

      ctx.body = data;
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error);
    }
  },

  async completeAccount(ctx: any) {
    try {
      const data = await completeRegistrationAccount(ctx, extractPayload(ctx));
      ctx.body = data;
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error);
    }
  },

  async complete(ctx: any) {
    try {
      const data = await completeRegistrationForCurrentUser(ctx, extractPayload(ctx));
      ctx.body = data;
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error);
    }
  },

  async approve(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const registrationId = Number(ctx.params?.id || 0);
      const data = await approveCampaignRegistration(ctx, tenantId, registrationId, authUser);
      ctx.body = data;
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error);
    }
  },

  async reject(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const registrationId = Number(ctx.params?.id || 0);
      const data = await rejectCampaignRegistration(tenantId, registrationId, authUser, extractPayload(ctx));
      ctx.body = data;
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error);
    }
  },

  async cancel(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const registrationId = Number(ctx.params?.id || 0);
      const data = await cancelCampaignRegistration(tenantId, registrationId, authUser, extractPayload(ctx));
      ctx.body = data;
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error);
    }
  },
};