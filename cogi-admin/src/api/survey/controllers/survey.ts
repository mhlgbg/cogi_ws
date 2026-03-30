import surveyService from '../services/survey';

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

function getOptionalTenantId(ctx: any): number | string | undefined {
  const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
  if (tenantId === null || tenantId === undefined || tenantId === '') {
    return undefined;
  }

  return tenantId;
}

function handleSurveyError(ctx: any, error: any) {
  const status = Number(error?.status || 500);
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'Unexpected survey error';

  if (status === 400) return ctx.badRequest(message);
  if (status === 401) return ctx.unauthorized(message);
  if (status === 403) return ctx.forbidden(message);
  if (status === 404) return ctx.notFound(message);
  if (status === 409) return ctx.conflict(message);

  strapi.log.error('[survey] unexpected error', error);
  return ctx.internalServerError(message);
}

export default {
  async myAssignments(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await surveyService.getMyAssignments(authUser.id, getOptionalTenantId(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleSurveyError(ctx, error);
    }
  },

  async getAssignment(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await surveyService.getAssignmentDetail(
        ctx.params?.id,
        authUser.id,
        getOptionalTenantId(ctx)
      );
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleSurveyError(ctx, error);
    }
  },

  async saveDraft(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const payload = ctx.request?.body || {};
      const data = await surveyService.saveDraftSurvey(authUser.id, payload, getOptionalTenantId(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleSurveyError(ctx, error);
    }
  },

  async submit(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const payload = ctx.request?.body || {};
      const data = await surveyService.submitSurvey(authUser.id, payload, getOptionalTenantId(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleSurveyError(ctx, error);
    }
  },
};