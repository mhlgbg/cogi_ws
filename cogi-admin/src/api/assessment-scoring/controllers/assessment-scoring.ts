import {
  completeSpeakingReview,
  confirmAssessmentPlacement,
  createAssessmentPlacementRule,
  createSpeakingReviewForResult,
  deleteAssessmentPlacementRule,
  getCandidatePreviewForAssessmentResult,
  getPlacementConfirmationForResult,
  getAssessmentResult,
  getAssessmentResultDetail,
  getSpeakingReviewForResult,
  getTenantIdFromContext,
  listAssessmentResults,
  listAssessmentPlacementRules,
  recalculateAssessmentResult,
  rescoreAssessmentAttempt,
  saveSpeakingReview,
  setManualAnswerScore,
  scoreAssessmentAttempt,
  startSpeakingReview,
  updateAssessmentPlacementRule,
} from '../services/assessment-scoring';

type AuthUser = { id: number; username?: string | null; email?: string | null; blocked?: boolean | null };

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
    return strapi.db.query('plugin::users-permissions.user').findOne({ where: { id: userId }, select: ['id', 'username', 'email', 'blocked'] });
  } catch {
    return null;
  }
}

async function requireAuthenticatedUser(ctx: any): Promise<AuthUser | null> {
  let authUser = ctx.state?.user as AuthUser | undefined;
  if (!authUser?.id) {
    authUser = await resolveUserFromJwt(ctx) || undefined;
    if (authUser?.id) ctx.state.user = authUser;
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
  const message = typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : 'Unexpected assessment scoring error';
  ctx.status = status;
  ctx.body = { success: false, error: { message, details: error?.details || null } };
}

async function runHandler(ctx: any, handler: (authUser: AuthUser) => Promise<any>) {
  const authUser = await requireAuthenticatedUser(ctx);
  if (!authUser?.id) return;
  try {
    const data = await handler(authUser);
    ctx.body = { success: true, data };
  } catch (error: any) {
    return handleError(ctx, error);
  }
}

export default {
  async listAssessmentResults(ctx: any) {
    return runHandler(ctx, () => listAssessmentResults(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },
  async getAssessmentResultDetail(ctx: any) {
    return runHandler(ctx, () => getAssessmentResultDetail(ctx.params?.id, getTenantIdFromContext(ctx)));
  },
  async getCandidatePreviewForAssessmentResult(ctx: any) {
    return runHandler(ctx, () => getCandidatePreviewForAssessmentResult(ctx.params?.id, getTenantIdFromContext(ctx)));
  },
  async getAssessmentResult(ctx: any) {
    return runHandler(ctx, () => getAssessmentResult(ctx.params?.attemptId, getTenantIdFromContext(ctx)));
  },
  async scoreAssessmentAttempt(ctx: any) {
    return runHandler(ctx, () => scoreAssessmentAttempt(ctx.params?.attemptId, getTenantIdFromContext(ctx), { scoringVersion: Number(ctx.request?.body?.scoringVersion || 1) }));
  },
  async setManualAnswerScore(ctx: any) {
    return runHandler(ctx, (authUser) => setManualAnswerScore(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx), { authUserId: authUser.id }));
  },
  async getSpeakingReviewForResult(ctx: any) {
    return runHandler(ctx, () => getSpeakingReviewForResult(ctx.params?.id, getTenantIdFromContext(ctx)));
  },
  async createSpeakingReviewForResult(ctx: any) {
    return runHandler(ctx, (authUser) => createSpeakingReviewForResult(ctx.params?.id, getTenantIdFromContext(ctx), { authUserId: authUser.id }));
  },
  async startSpeakingReview(ctx: any) {
    return runHandler(ctx, (authUser) => startSpeakingReview(ctx.params?.id, getTenantIdFromContext(ctx), { authUserId: authUser.id }));
  },
  async saveSpeakingReview(ctx: any) {
    return runHandler(ctx, (authUser) => saveSpeakingReview(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx), { authUserId: authUser.id }));
  },
  async completeSpeakingReview(ctx: any) {
    return runHandler(ctx, (authUser) => completeSpeakingReview(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx), { authUserId: authUser.id }));
  },
  async getPlacementConfirmationForResult(ctx: any) {
    return runHandler(ctx, () => getPlacementConfirmationForResult(ctx.params?.id, getTenantIdFromContext(ctx)));
  },
  async confirmAssessmentPlacement(ctx: any) {
    return runHandler(ctx, (authUser) => confirmAssessmentPlacement(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx), { authUserId: authUser.id }));
  },
  async rescoreAssessmentAttempt(ctx: any) {
    return runHandler(ctx, () => rescoreAssessmentAttempt(ctx.params?.attemptId, getTenantIdFromContext(ctx), { scoringVersion: Number(ctx.request?.body?.scoringVersion || 1) }));
  },
  async recalculateAssessmentResult(ctx: any) {
    return runHandler(ctx, () => recalculateAssessmentResult(ctx.params?.id, getTenantIdFromContext(ctx)));
  },
  async listAssessmentPlacementRules(ctx: any) {
    return runHandler(ctx, () => listAssessmentPlacementRules(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },
  async createAssessmentPlacementRule(ctx: any) {
    return runHandler(ctx, () => createAssessmentPlacementRule(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async updateAssessmentPlacementRule(ctx: any) {
    return runHandler(ctx, () => updateAssessmentPlacementRule(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async deleteAssessmentPlacementRule(ctx: any) {
    return runHandler(ctx, () => deleteAssessmentPlacementRule(ctx.params?.id, getTenantIdFromContext(ctx)));
  },
};