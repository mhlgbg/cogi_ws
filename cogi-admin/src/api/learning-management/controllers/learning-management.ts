import {
  attachQuestionToLearningObject,
  createContentBlock,
  createFormula,
  createGrade,
  createKnowledgeNode,
  createLearningObject,
  createQuestion,
  createQuestionOption,
  createSkill,
  createSubject,
  createVisualAsset,
  deleteGrade,
  deleteFormula,
  deleteQuestion,
  deleteSubject,
  deleteContentBlock,
  deleteLearningObject,
  detachQuestionFromLearningObject,
  getContentBlocks,
  getFormulas,
  getGrades,
  getKnowledgeNodes,
  getLearningManagementBootstrap,
  getLearningObjectDetail,
  getQuestions,
  getSkills,
  getSubjects,
  getTenantIdFromContext,
  getVisualAssets,
  listLearningObjects,
  updateContentBlock,
  updateFormula,
  updateGrade,
  updateQuestion,
  updateLearningObject,
  updateSubject,
} from '../services/learning-management';

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
    : 'Unexpected learning management error';

  if (status === 400) return ctx.badRequest(message);
  if (status === 401) return ctx.unauthorized(message);
  if (status === 403) return ctx.forbidden(message);
  if (status === 404) return ctx.notFound(message);
  if (status === 409) return ctx.conflict(message);

  strapi.log.error('[learning-management] unexpected error', error);
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
  async bootstrap(ctx: any) {
    return runHandler(ctx, () => getLearningManagementBootstrap(getTenantIdFromContext(ctx)));
  },

  async listLearningObjects(ctx: any) {
    return runHandler(ctx, () => listLearningObjects(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async findOneLearningObject(ctx: any) {
    return runHandler(ctx, () => getLearningObjectDetail(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async createLearningObject(ctx: any) {
    return runHandler(ctx, () => createLearningObject(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async updateLearningObject(ctx: any) {
    return runHandler(ctx, () => updateLearningObject(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async deleteLearningObject(ctx: any) {
    return runHandler(ctx, () => deleteLearningObject(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async listSubjects(ctx: any) {
    return runHandler(ctx, () => getSubjects(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async createSubject(ctx: any) {
    return runHandler(ctx, () => createSubject(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async updateSubject(ctx: any) {
    return runHandler(ctx, () => updateSubject(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async deleteSubject(ctx: any) {
    return runHandler(ctx, () => deleteSubject(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async listGrades(ctx: any) {
    return runHandler(ctx, () => getGrades(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async createGrade(ctx: any) {
    return runHandler(ctx, () => createGrade(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async updateGrade(ctx: any) {
    return runHandler(ctx, () => updateGrade(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async deleteGrade(ctx: any) {
    return runHandler(ctx, () => deleteGrade(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async listKnowledgeNodes(ctx: any) {
    return runHandler(ctx, () => getKnowledgeNodes(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async createKnowledgeNode(ctx: any) {
    return runHandler(ctx, () => createKnowledgeNode(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async listSkills(ctx: any) {
    return runHandler(ctx, () => getSkills(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async createSkill(ctx: any) {
    return runHandler(ctx, () => createSkill(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async listFormulas(ctx: any) {
    return runHandler(ctx, () => getFormulas(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async createFormula(ctx: any) {
    return runHandler(ctx, () => createFormula(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async updateFormula(ctx: any) {
    return runHandler(ctx, () => updateFormula(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async deleteFormula(ctx: any) {
    return runHandler(ctx, () => deleteFormula(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async listVisualAssets(ctx: any) {
    return runHandler(ctx, () => getVisualAssets(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async createVisualAsset(ctx: any) {
    return runHandler(ctx, () => createVisualAsset(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async listContentBlocks(ctx: any) {
    return runHandler(ctx, () => getContentBlocks(ctx.params?.learningObjectId, getTenantIdFromContext(ctx)));
  },

  async createContentBlock(ctx: any) {
    return runHandler(ctx, () => createContentBlock(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async updateContentBlock(ctx: any) {
    return runHandler(ctx, () => updateContentBlock(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async deleteContentBlock(ctx: any) {
    return runHandler(ctx, () => deleteContentBlock(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async listQuestions(ctx: any) {
    return runHandler(ctx, () => getQuestions(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async createQuestion(ctx: any) {
    return runHandler(ctx, () => createQuestion(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async updateQuestion(ctx: any) {
    return runHandler(ctx, () => updateQuestion(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async deleteQuestion(ctx: any) {
    return runHandler(ctx, () => deleteQuestion(ctx.params?.id, getTenantIdFromContext(ctx)));
  },

  async createQuestionOption(ctx: any) {
    return runHandler(ctx, () => createQuestionOption(ctx.request?.body || {}, getTenantIdFromContext(ctx)));
  },

  async attachQuestion(ctx: any) {
    return runHandler(ctx, () => attachQuestionToLearningObject(ctx.params?.learningObjectId, ctx.request?.body?.questionId, getTenantIdFromContext(ctx)));
  },

  async detachQuestion(ctx: any) {
    return runHandler(ctx, () => detachQuestionFromLearningObject(ctx.params?.learningObjectId, ctx.request?.body?.questionId, getTenantIdFromContext(ctx)));
  },
};
