import {
  exportCampaignLecturerReport,
  getCampaignCourseReport,
  getCampaignLecturerReport,
  getCampaignSummaryReport,
} from '../services/survey-report';

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
    : 'Unexpected survey report error';

  if (status === 400) return ctx.badRequest(message);
  if (status === 401) return ctx.unauthorized(message);
  if (status === 403) return ctx.forbidden(message);
  if (status === 404) return ctx.notFound(message);

  strapi.log.error('[survey-report] unexpected error', error);
  return ctx.internalServerError(message);
}

export default {
  async summary(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await getCampaignSummaryReport(ctx.params?.id, ctx.state?.tenantId ?? ctx.state?.tenant?.id);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async lecturers(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await getCampaignLecturerReport(ctx.params?.id, ctx.state?.tenantId ?? ctx.state?.tenant?.id);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async courses(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await getCampaignCourseReport(ctx.params?.id, ctx.state?.tenantId ?? ctx.state?.tenant?.id);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async exportLecturer(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const result = await exportCampaignLecturerReport(
        ctx.params?.campaignId,
        ctx.params?.lecturerId,
        ctx.state?.tenantId ?? ctx.state?.tenant?.id,
      );

      ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      ctx.set('Content-Disposition', `attachment; filename="${result.fileName}"`);
      ctx.body = result.buffer;
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },
};