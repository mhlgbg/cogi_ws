import {
  addAssessmentQuestion,
  archiveAssessment,
  cloneAssessmentVersion,
  createAssessment,
  createAssessmentSpeakingCriterion,
  createAssessmentSection,
  createAssessmentVersion,
  deleteAssessment,
  deleteAssessmentSpeakingCriterion,
  deleteAssessmentSection,
  deleteAssessmentVersion,
  getAssessmentDetail,
  getAssessmentVersionDetail,
  getTenantIdFromContext,
  listAssessments,
  listAssessmentSpeakingCriteria,
  listAssessmentVersions,
  publishAssessmentVersion,
  removeAssessmentQuestion,
  reorderAssessmentQuestions,
  reorderAssessmentSections,
  retireAssessmentVersion,
  updateAssessment,
  updateAssessmentSpeakingCriterion,
  updateAssessmentQuestion,
  updateAssessmentSection,
  updateAssessmentVersion,
  validateAssessmentVersion,
} from '../services/assessment-management';

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
    : 'Unexpected assessment management error';

  if (status === 400) return ctx.badRequest(message);
  if (status === 401) return ctx.unauthorized(message);
  if (status === 403) return ctx.forbidden(message);
  if (status === 404) return ctx.notFound(message);
  if (status === 409) return ctx.conflict(message);

  strapi.log.error('[assessment-management] unexpected error', error);
  return ctx.internalServerError(message);
}

async function runHandler(ctx: any, handler: () => Promise<any>) {
  const authUser = await requireAuthenticatedUser(ctx);
  if (!authUser?.id) return;

  try {
    const data = await handler();
    ctx.body = { success: true, data };
  } catch (error: any) {
    return handleError(ctx, error);
  }
}

export default {
  async listAssessments(ctx: any) {
    return runHandler(ctx, () => listAssessments(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async getAssessment(ctx: any) {
    return runHandler(ctx, () => getAssessmentDetail(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async createAssessment(ctx: any) {
    return runHandler(ctx, () => createAssessment(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async updateAssessment(ctx: any) {
    return runHandler(ctx, () => updateAssessment(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async archiveAssessment(ctx: any) {
    return runHandler(ctx, () => archiveAssessment(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async deleteAssessment(ctx: any) {
    return runHandler(ctx, () => deleteAssessment(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async listAssessmentVersions(ctx: any) {
    return runHandler(ctx, () => listAssessmentVersions(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async getAssessmentVersion(ctx: any) {
    return runHandler(ctx, () => getAssessmentVersionDetail(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async validateAssessmentVersion(ctx: any) {
    return runHandler(ctx, () => validateAssessmentVersion(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async createAssessmentVersion(ctx: any) {
    return runHandler(ctx, () => createAssessmentVersion(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async listAssessmentSpeakingCriteria(ctx: any) {
    return runHandler(ctx, () => listAssessmentSpeakingCriteria({ ...(ctx.request?.query || {}), assessmentVersion: ctx.params?.versionId || ctx.request?.query?.assessmentVersion }, getTenantIdFromContext(ctx)));
  },

  async createAssessmentSpeakingCriterion(ctx: any) {
    return runHandler(ctx, () => createAssessmentSpeakingCriterion({ ...(ctx.request?.body || {}), assessmentVersion: ctx.params?.versionId || ctx.request?.body?.assessmentVersion }, getTenantIdFromContext(ctx)));
  },

  async updateAssessmentSpeakingCriterion(ctx: any) {
    return runHandler(ctx, () => updateAssessmentSpeakingCriterion(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async deleteAssessmentSpeakingCriterion(ctx: any) {
    return runHandler(ctx, () => deleteAssessmentSpeakingCriterion(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async updateAssessmentVersion(ctx: any) {
    return runHandler(ctx, () => updateAssessmentVersion(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async publishAssessmentVersion(ctx: any) {
    return runHandler(ctx, () => publishAssessmentVersion(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async retireAssessmentVersion(ctx: any) {
    return runHandler(ctx, () => retireAssessmentVersion(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async deleteAssessmentVersion(ctx: any) {
    return runHandler(ctx, () => deleteAssessmentVersion(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async cloneAssessmentVersion(ctx: any) {
    return runHandler(ctx, () => cloneAssessmentVersion(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async createAssessmentSection(ctx: any) {
    return runHandler(ctx, () => createAssessmentSection({ ...(ctx.request?.body || {}), assessmentVersion: ctx.params?.versionId }, getTenantIdFromContext(ctx)));
  },

  async updateAssessmentSection(ctx: any) {
    return runHandler(ctx, () => updateAssessmentSection(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async deleteAssessmentSection(ctx: any) {
    return runHandler(ctx, () => deleteAssessmentSection(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async reorderAssessmentSections(ctx: any) {
    return runHandler(ctx, () => reorderAssessmentSections(ctx.params?.versionId, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async addAssessmentQuestion(ctx: any) {
    return runHandler(ctx, () => addAssessmentQuestion({ ...(ctx.request?.body || {}), section: ctx.params?.sectionId }, getTenantIdFromContext(ctx)));
  },

  async updateAssessmentQuestion(ctx: any) {
    return runHandler(ctx, () => updateAssessmentQuestion(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async removeAssessmentQuestion(ctx: any) {
    return runHandler(ctx, () => removeAssessmentQuestion(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async reorderAssessmentQuestions(ctx: any) {
    return runHandler(ctx, () => reorderAssessmentQuestions(ctx.params?.sectionId, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },
};
