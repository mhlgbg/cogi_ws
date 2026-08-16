import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import { bulkCreateExamRoundSchedules, cancelExamRoundSchedule, cloneExamRoundSchedule, createExamRoundSchedule, generateExamRoundSchedules, getExamRoundScheduleDetail, getExamRoundScheduleSummary, handleExamScheduleManagementError, listExamRoundSchedules, publishExamRoundSchedule, publishExamRoundSchedulesBulk, updateExamRoundSchedule } from '../services/exam-schedule-management';

type AuthUser = { id: number; username?: string | null; fullName?: string | null; email?: string | null; blocked?: boolean | null };

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
    return strapi.db.query('plugin::users-permissions.user').findOne({ where: { id: userId }, select: ['id', 'username', 'fullName', 'email', 'blocked'] });
  } catch { return null; }
}

async function requireAuthenticatedUser(ctx: any): Promise<AuthUser | null> {
  let authUser = ctx.state?.user as AuthUser | undefined;
  if (!authUser?.id) { authUser = await resolveUserFromJwt(ctx) || undefined; if (authUser?.id) ctx.state.user = authUser; }
  if (!authUser?.id) { ctx.unauthorized('Unauthorized'); return null; }
  if (authUser.blocked) { ctx.unauthorized('Account is blocked'); return null; }
  return authUser;
}

function extractPayload(ctx: any): Record<string, unknown> {
  const body = ctx.request?.body;
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data as Record<string, unknown>;
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  return {};
}

export default {
  async summary(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await getExamRoundScheduleSummary(Number(resolveCurrentTenantId(ctx)), ctx.params?.id) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async list(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = await listExamRoundSchedules(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.query || {}); } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async detail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await getExamRoundScheduleDetail(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.scheduleId) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async create(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await createExamRoundSchedule(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async generate(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await generateExamRoundSchedules(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async bulkCreate(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await bulkCreateExamRoundSchedules(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async update(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await updateExamRoundSchedule(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.scheduleId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async clone(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await cloneExamRoundSchedule(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.scheduleId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async publish(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await publishExamRoundSchedule(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.scheduleId, authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async publishBulk(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await publishExamRoundSchedulesBulk(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async cancel(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await cancelExamRoundSchedule(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.scheduleId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
};