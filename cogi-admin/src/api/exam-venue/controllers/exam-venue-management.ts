import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import { createExamVenue, getExamVenueDetail, handleExamScheduleManagementError, listExamVenues, setExamVenueActive, updateExamVenue } from '../../exam-schedule/services/exam-schedule-management';

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
  async list(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = await listExamVenues(Number(resolveCurrentTenantId(ctx)), ctx.query || {}); } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async detail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await getExamVenueDetail(Number(resolveCurrentTenantId(ctx)), ctx.params?.id) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async create(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await createExamVenue(Number(resolveCurrentTenantId(ctx)), extractPayload(ctx), authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async update(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await updateExamVenue(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
  async setActive(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await setExamVenueActive(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamScheduleManagementError(ctx, error); }
  },
};