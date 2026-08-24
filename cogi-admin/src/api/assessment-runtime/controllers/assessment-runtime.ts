import {
  getCandidateAssessmentResult,
  getAssessmentAttempt,
  getTenantIdFromContext,
  listAssessmentAttempts,
  registerAssessmentAudioPlay,
  resumeAssessmentAttempt,
  saveAssessmentAnswer,
  startAssessmentAttempt,
  submitAssessmentAttempt,
  updateAssessmentProgress,
} from '../services/assessment-runtime';
import { resolvePublicAssessmentAttemptAccess } from '../../assessment-campaign/services/assessment-campaign';

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

function getPublicAccessToken(ctx: any) {
  return String(ctx.request?.headers?.['x-assessment-public-token'] || '').trim();
}

async function runAttemptHandler(ctx: any, handler: (context: { authUserId?: number; allowManagerAccess: boolean }) => Promise<any>, options: { requireCandidateOwnership?: boolean } = {}) {
  const tenantId = getTenantIdFromContext(ctx);
  const authUser = await resolveUserFromJwt(ctx) || ctx.state?.user || null;

  if (authUser?.blocked) {
    ctx.unauthorized('Account is blocked');
    return;
  }

  try {
    if (authUser?.id) {
      const data = await handler({ authUserId: authUser.id, allowManagerAccess: options.requireCandidateOwnership !== true });
      ctx.body = { success: true, data };
      return;
    }

    const publicAccessToken = getPublicAccessToken(ctx);
    if (!publicAccessToken) {
      ctx.unauthorized('Unauthorized');
      return;
    }

    await resolvePublicAssessmentAttemptAccess(ctx.params?.id, tenantId, publicAccessToken);
    const data = await handler({ allowManagerAccess: true });
    ctx.body = { success: true, data };
  } catch (error: any) {
    return handleError(ctx, error);
  }
}

function handleError(ctx: any, error: any) {
  const status = Number(error?.status || 500);
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'Unexpected assessment runtime error';

  ctx.status = status;
  ctx.body = {
    success: false,
    error: {
      message,
      details: error?.details || null,
    },
  };
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
  async listAssessmentAttempts(ctx: any) {
    return runHandler(ctx, () => listAssessmentAttempts(ctx.request?.query || {}, getTenantIdFromContext(ctx)));
  },

  async startAssessmentAttempt(ctx: any) {
    return runHandler(ctx, (authUser) => startAssessmentAttempt(ctx.params?.versionId, ctx.request?.body || {}, getTenantIdFromContext(ctx), {
      authUserId: authUser.id,
      allowManagerAccess: true,
    }));
  },

  async getAssessmentAttempt(ctx: any) {
    return runAttemptHandler(ctx, (context) => getAssessmentAttempt(ctx.params?.id, getTenantIdFromContext(ctx), context));
  },

  async getCandidateAssessmentResult(ctx: any) {
    return runAttemptHandler(ctx, (context) => getCandidateAssessmentResult(ctx.params?.id, getTenantIdFromContext(ctx), context), { requireCandidateOwnership: true });
  },

  async resumeAssessmentAttempt(ctx: any) {
    return runAttemptHandler(ctx, (context) => resumeAssessmentAttempt(ctx.params?.id, getTenantIdFromContext(ctx), context));
  },

  async saveAssessmentAnswer(ctx: any) {
    return runAttemptHandler(ctx, (context) => saveAssessmentAnswer(ctx.params?.id, ctx.params?.assessmentQuestionId, ctx.request?.body || {}, getTenantIdFromContext(ctx), context));
  },

  async registerAssessmentAudioPlay(ctx: any) {
    return runAttemptHandler(ctx, (context) => registerAssessmentAudioPlay(ctx.params?.id, ctx.params?.assessmentQuestionId, ctx.request?.body || {}, getTenantIdFromContext(ctx), context));
  },

  async updateAssessmentProgress(ctx: any) {
    return runAttemptHandler(ctx, (context) => updateAssessmentProgress(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx), context));
  },

  async submitAssessmentAttempt(ctx: any) {
    return runAttemptHandler(ctx, (context) => submitAssessmentAttempt(ctx.params?.id, getTenantIdFromContext(ctx), context));
  },
};