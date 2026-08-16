import { factories } from '@strapi/strapi';
import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
  cancelAchievementSubmission,
  createTenantSportsAchievementSubmission,
  getTenantSportsAchievementSubmission,
  handleSportsAchievementSubmissionError,
  listTenantSportsAchievementSubmissions,
  rejectAchievementSubmission,
  submitAchievementSubmission,
  updateTenantSportsAchievementSubmission,
  verifyAchievementSubmission,
} from '../services/sports-achievement-submission';

const SPORTS_ACHIEVEMENT_SUBMISSION_UID = 'api::sports-achievement-submission.sports-achievement-submission' as any;

type AuthUser = {
  id: number;
  blocked?: boolean | null;
};

async function resolveUserFromJwt(ctx: any): Promise<AuthUser | null> {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return null;
    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) return null;
    const decoded = await jwtService.verify(token);
    const userId = Number(decoded?.id || 0);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return strapi.db.query('plugin::users-permissions.user').findOne({ where: { id: userId }, select: ['id', 'blocked'] });
  } catch {
    return null;
  }
}

async function requireAuthenticatedUser(ctx: any): Promise<AuthUser | null> {
  let authUser = ctx.state?.user as AuthUser | undefined;
  if (!authUser?.id) {
    authUser = (await resolveUserFromJwt(ctx)) || undefined;
    if (authUser?.id) ctx.state.user = authUser;
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
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data as Record<string, unknown>;
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  return {};
}

export default factories.createCoreController(SPORTS_ACHIEVEMENT_SUBMISSION_UID, () => ({
  async list(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const data = await listTenantSportsAchievementSubmissions(ctx.query || {}, tenantId);
      ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
    } catch (error) {
      return handleSportsAchievementSubmissionError(ctx, error);
    }
  },

  async getDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      ctx.body = { success: true, data: await getTenantSportsAchievementSubmission(ctx.params?.id, tenantId) };
    } catch (error) {
      return handleSportsAchievementSubmissionError(ctx, error);
    }
  },

  async create(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      ctx.body = { success: true, data: await createTenantSportsAchievementSubmission(extractPayload(ctx), tenantId, authUser) };
    } catch (error) {
      return handleSportsAchievementSubmissionError(ctx, error);
    }
  },

  async update(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      ctx.body = { success: true, data: await updateTenantSportsAchievementSubmission(ctx.params?.id, extractPayload(ctx), tenantId, authUser) };
    } catch (error) {
      return handleSportsAchievementSubmissionError(ctx, error);
    }
  },

  async submit(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      ctx.body = { success: true, data: await submitAchievementSubmission(ctx.params?.id, tenantId, authUser) };
    } catch (error) {
      return handleSportsAchievementSubmissionError(ctx, error);
    }
  },

  async verify(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      ctx.body = { success: true, data: await verifyAchievementSubmission(ctx.params?.id, tenantId, extractPayload(ctx), authUser) };
    } catch (error) {
      return handleSportsAchievementSubmissionError(ctx, error);
    }
  },

  async reject(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      ctx.body = { success: true, data: await rejectAchievementSubmission(ctx.params?.id, tenantId, extractPayload(ctx), authUser) };
    } catch (error) {
      return handleSportsAchievementSubmissionError(ctx, error);
    }
  },

  async cancel(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      ctx.body = { success: true, data: await cancelAchievementSubmission(ctx.params?.id, tenantId, authUser) };
    } catch (error) {
      return handleSportsAchievementSubmissionError(ctx, error);
    }
  },
}));
