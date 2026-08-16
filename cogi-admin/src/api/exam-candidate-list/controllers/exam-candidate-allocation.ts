import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
  approveCandidateList,
  assignRegistrationComponentsToSchedules,
  autoAssignExamCandidates,
  finalizeCandidateList,
  generateCandidateNumbers,
  generateCandidateSequence,
  getAllocationCapacityOverview,
  getCandidateListDetail,
  getExamCandidateAllocationPreview,
  handleExamCandidateAllocationError,
  listCandidateLists,
  listUnassignedRegistrationComponents,
  lockCandidateList,
  reopenCandidateList,
  reassignExamCandidate,
  returnCandidateListToDraft,
  submitCandidateListForApproval,
  unassignExamCandidates,
  unlockCandidateList,
} from '../services/exam-candidate-allocation';

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
  if (!authUser?.id) {
    authUser = await resolveUserFromJwt(ctx) || undefined;
    if (authUser?.id) ctx.state.user = authUser;
  }
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
  async unassigned(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = await listUnassignedRegistrationComponents(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.query || {}, authUser); } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async capacity(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = await getAllocationCapacityOverview(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.query || {}, authUser); } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async preview(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await getExamCandidateAllocationPreview(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async autoAssign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await autoAssignExamCandidates(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async assign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await assignRegistrationComponentsToSchedules(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async reassign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await reassignExamCandidate(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async unassign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await unassignExamCandidates(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async listCandidateLists(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = await listCandidateLists(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.query || {}, authUser); } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async detailCandidateList(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await getCandidateListDetail(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.candidateListId, ctx.query || {}, authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async submitForApproval(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await submitCandidateListForApproval(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.candidateListId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async approve(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await approveCandidateList(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.candidateListId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async returnToDraft(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await returnCandidateListToDraft(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.candidateListId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async lock(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await lockCandidateList(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.candidateListId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async finalize(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await finalizeCandidateList(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.candidateListId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async reopen(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await reopenCandidateList(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.candidateListId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async unlock(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await unlockCandidateList(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.candidateListId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async generateSequence(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await generateCandidateSequence(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.candidateListId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
  async generateNumbers(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx); if (!authUser?.id) return;
    try { ctx.body = { success: true, data: await generateCandidateNumbers(Number(resolveCurrentTenantId(ctx)), ctx.params?.id, ctx.params?.candidateListId, extractPayload(ctx), authUser) }; } catch (error) { return handleExamCandidateAllocationError(ctx, error); }
  },
};