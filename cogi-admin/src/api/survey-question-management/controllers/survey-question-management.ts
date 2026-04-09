import {
  createSurveyQuestion,
  createSurveySection,
  createSurveyTemplate,
  deleteSurveyQuestion,
  deleteSurveySection,
  deleteSurveyTemplate,
  getSurveyQuestionManagementBootstrap,
  getTenantIdFromContext,
  listSurveyQuestions,
  updateSurveyQuestion,
  updateSurveySection,
  updateSurveyTemplate,
} from '../services/survey-question-management';

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
    : 'Unexpected survey question management error';

  if (status === 400) return ctx.badRequest(message);
  if (status === 401) return ctx.unauthorized(message);
  if (status === 403) return ctx.forbidden(message);
  if (status === 404) return ctx.notFound(message);
  if (status === 409) return ctx.conflict(message);

  strapi.log.error('[survey-question-management] unexpected error', error);
  return ctx.internalServerError(message);
}

export default {
  async bootstrap(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await getSurveyQuestionManagementBootstrap(getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async listQuestions(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await listSurveyQuestions(ctx.request?.query || {}, getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async createTemplate(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await createSurveyTemplate(ctx.request?.body || {}, getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async updateTemplate(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await updateSurveyTemplate(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async deleteTemplate(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await deleteSurveyTemplate(ctx.params?.id, getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async createSection(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await createSurveySection(ctx.request?.body || {}, getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async updateSection(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await updateSurveySection(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async deleteSection(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await deleteSurveySection(ctx.params?.id, getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async createQuestion(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await createSurveyQuestion(ctx.request?.body || {}, getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async updateQuestion(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await updateSurveyQuestion(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async deleteQuestion(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const data = await deleteSurveyQuestion(ctx.params?.id, getTenantIdFromContext(ctx));
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },
};