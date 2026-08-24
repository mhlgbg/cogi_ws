import {
  createAssessmentCampaign,
  createAssessmentCampaignField,
  createAssessmentCampaignRule,
  allowAssessmentCampaignRetake,
  cancelAssessmentCampaignAttempt,
  finalizeAssessmentCampaignAttemptTimeout,
  finalizeOverdueAssessmentCampaignAttempts,
  deleteAssessmentCampaignField,
  deleteAssessmentCampaignRule,
  completeAssessmentCampaignResultProfile,
  recoverPublicAssessmentCampaignParticipations,
  getAssessmentCampaignDetail,
  getAssessmentCampaignResultGate,
  getPublicAssessmentCampaignBySlug,
  getTenantIdFromContext,
  listAssessmentCampaignFields,
  listAssessmentCampaignLeads,
  listAssessmentCampaignParticipations,
  listAssessmentCampaignResults,
  listAssessmentCampaignRules,
  listAssessmentCampaigns,
  reorderAssessmentCampaignFields,
  restorePublicAssessmentAttemptAccess,
  resolveAssessmentCampaignAssessment,
  resolvePublicAssessmentCampaign,
  resolvePublicAssessmentAttemptAccess,
  startAssessmentCampaignRetake,
  startPublicAssessmentCampaign,
  updateAssessmentCampaign,
  updateAssessmentCampaignField,
  updateAssessmentCampaignRule,
} from '../services/assessment-campaign';

type AuthUser = { id: number; username?: string | null; email?: string | null; blocked?: boolean | null };

async function resolveUserFromJwt(ctx: any): Promise<AuthUser | null> {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
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
  const message = typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : 'Unexpected assessment campaign error';
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

async function runPublicHandler(ctx: any, handler: () => Promise<any>) {
  try {
    const data = await handler();
    ctx.body = { success: true, data };
  } catch (error: any) {
    return handleError(ctx, error);
  }
}

function getPublicAccessToken(ctx: any) {
  return String(ctx.request?.headers?.['x-assessment-public-token'] || '').trim();
}

export default {
  async listAssessmentCampaigns(ctx: any) {
    return runHandler(ctx, () => listAssessmentCampaigns(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },
  async getAssessmentCampaign(ctx: any) {
    return runHandler(ctx, () => getAssessmentCampaignDetail(ctx.params?.id, getTenantIdFromContext(ctx)));
  },
  async createAssessmentCampaign(ctx: any) {
    return runHandler(ctx, () => createAssessmentCampaign(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async updateAssessmentCampaign(ctx: any) {
    return runHandler(ctx, () => updateAssessmentCampaign(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async listAssessmentCampaignFields(ctx: any) {
    return runHandler(ctx, () => listAssessmentCampaignFields(ctx.params?.id, getTenantIdFromContext(ctx)));
  },
  async createAssessmentCampaignField(ctx: any) {
    return runHandler(ctx, () => createAssessmentCampaignField({ ...(ctx.request?.body || {}), assessmentCampaign: ctx.params?.id }, getTenantIdFromContext(ctx)));
  },
  async updateAssessmentCampaignField(ctx: any) {
    return runHandler(ctx, () => updateAssessmentCampaignField(ctx.params?.fieldId, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async deleteAssessmentCampaignField(ctx: any) {
    return runHandler(ctx, () => deleteAssessmentCampaignField(ctx.params?.fieldId, getTenantIdFromContext(ctx)));
  },
  async reorderAssessmentCampaignFields(ctx: any) {
    return runHandler(ctx, () => reorderAssessmentCampaignFields(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async listAssessmentCampaignRules(ctx: any) {
    return runHandler(ctx, () => listAssessmentCampaignRules(ctx.params?.id, getTenantIdFromContext(ctx)));
  },
  async createAssessmentCampaignRule(ctx: any) {
    return runHandler(ctx, () => createAssessmentCampaignRule({ ...(ctx.request?.body || {}), assessmentCampaign: ctx.params?.id }, getTenantIdFromContext(ctx)));
  },
  async updateAssessmentCampaignRule(ctx: any) {
    return runHandler(ctx, () => updateAssessmentCampaignRule(ctx.params?.ruleId, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async deleteAssessmentCampaignRule(ctx: any) {
    return runHandler(ctx, () => deleteAssessmentCampaignRule(ctx.params?.ruleId, getTenantIdFromContext(ctx)));
  },
  async resolveAssessmentCampaignAssessment(ctx: any) {
    return runHandler(ctx, () => resolveAssessmentCampaignAssessment(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async listAssessmentCampaignLeads(ctx: any) {
    return runHandler(ctx, () => listAssessmentCampaignLeads(ctx.params?.id, ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },
  async listAssessmentCampaignParticipations(ctx: any) {
    return runHandler(ctx, () => listAssessmentCampaignParticipations(ctx.params?.id, ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },
  async listAssessmentCampaignResults(ctx: any) {
    return runHandler(ctx, () => listAssessmentCampaignResults(ctx.params?.id, ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },
  async getPublicAssessmentCampaign(ctx: any) {
    return runPublicHandler(ctx, () => getPublicAssessmentCampaignBySlug(ctx.params?.slug, getTenantIdFromContext(ctx)));
  },
  async resolvePublicAssessmentCampaign(ctx: any) {
    return runPublicHandler(ctx, () => resolvePublicAssessmentCampaign(ctx.params?.slug, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async startPublicAssessmentCampaign(ctx: any) {
    return runPublicHandler(ctx, () => startPublicAssessmentCampaign(ctx.params?.slug, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async startAssessmentCampaignRetake(ctx: any) {
    return runPublicHandler(ctx, () => startAssessmentCampaignRetake(ctx.params?.attemptId, getTenantIdFromContext(ctx), getPublicAccessToken(ctx)));
  },
  async recoverPublicAssessmentCampaignParticipations(ctx: any) {
    return runPublicHandler(ctx, () => recoverPublicAssessmentCampaignParticipations(ctx.params?.slug, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async restorePublicAssessmentAttemptAccess(ctx: any) {
    return runPublicHandler(ctx, () => restorePublicAssessmentAttemptAccess(ctx.params?.attemptId, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
  async getAssessmentCampaignResultGate(ctx: any) {
    return runPublicHandler(ctx, () => getAssessmentCampaignResultGate(ctx.params?.attemptId, getTenantIdFromContext(ctx), getPublicAccessToken(ctx)));
  },
  async completeAssessmentCampaignResultProfile(ctx: any) {
    return runPublicHandler(ctx, () => completeAssessmentCampaignResultProfile(ctx.params?.attemptId, ctx.request?.body || {}, getTenantIdFromContext(ctx), getPublicAccessToken(ctx)));
  },
  async cancelAssessmentCampaignAttempt(ctx: any) {
    return runHandler(ctx, (authUser) => cancelAssessmentCampaignAttempt(ctx.params?.attemptId, ctx.request?.body || {}, getTenantIdFromContext(ctx), { authUserId: authUser.id }));
  },
  async finalizeAssessmentCampaignAttemptTimeout(ctx: any) {
    return runHandler(ctx, () => finalizeAssessmentCampaignAttemptTimeout(ctx.params?.attemptId, getTenantIdFromContext(ctx)));
  },
  async finalizeOverdueAssessmentCampaignAttempts(ctx: any) {
    return runHandler(ctx, () => finalizeOverdueAssessmentCampaignAttempts(ctx.params?.id, getTenantIdFromContext(ctx)));
  },
  async allowAssessmentCampaignRetake(ctx: any) {
    return runHandler(ctx, (authUser) => allowAssessmentCampaignRetake(ctx.params?.attemptId, ctx.request?.body || {}, getTenantIdFromContext(ctx), { authUserId: authUser.id }));
  },
};