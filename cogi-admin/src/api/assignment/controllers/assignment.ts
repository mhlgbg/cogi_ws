import { factories } from '@strapi/strapi';
import {
  cancelTeacherAssignment,
  closeTeacherAssignment,
  createTeacherSessionAssignment,
  getAssignmentWorkspaceErrorStatus,
  getStudentAssignmentDetail,
  getStudentAssignmentTaskDetail,
  getStudentSubmissionVersionDetail,
  listStudentAssignments,
  getTeacherAssignmentDetail,
  getTeacherAssignmentLearnerTaskDetail,
  listTeacherAssignmentAssessmentOptions,
  listTeacherSessionAssessmentOptions,
  listStudentSessionAssignments,
  listTeacherSessionAssignments,
  autoGradeTeacherAssignmentTask,
  publishTeacherAssignment,
  reopenTeacherAssignment,
  reviewTeacherAssignmentTask,
  saveStudentAssignmentSubmission,
  startTeacherAssignmentAssessmentPreviewAttempt,
  startTeacherSessionAssessmentPreviewAttempt,
  startStudentAssessmentTaskAttempt,
  uploadStudentAssignmentFile,
  updateStudentTodoProgress,
  updateTeacherAssignment,
  updateTeacherAssignmentTaskGradingDefinition,
  batchRegradeStaleUnreviewedTeacherAssignmentTask,
} from '../services/assignment-workspace';

function flattenUploadedFiles(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => flattenUploadedFiles(entry));
  if (typeof value === 'object' && value && (((value as Record<string, unknown>).filepath) || ((value as Record<string, unknown>).path) || ((value as Record<string, unknown>).tempFilePath))) return [value];
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap((entry) => flattenUploadedFiles(entry));
  return [];
}

function resolveUploadFile(rawFiles: any) {
  return flattenUploadedFiles(rawFiles)[0] || null;
}

function resolveTenantId(ctx: any) {
  return ctx.state?.tenantId ?? ctx.state?.tenant?.id;
}

async function requireAuthenticatedUser(ctx: any) {
  let authUser = ctx.state?.user;
  if (authUser?.id) return authUser;
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return null;
    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    const decoded = await jwtService?.verify(token);
    const userId = Number(decoded?.id || 0);
    if (!userId) return null;
    authUser = await strapi.db.query('plugin::users-permissions.user').findOne({ where: { id: userId }, select: ['id', 'username', 'email', 'fullName', 'blocked'] });
    if (authUser?.id) ctx.state.user = authUser;
  } catch {
    return null;
  }
  return authUser?.blocked ? null : authUser;
}

function errorBody(status: number, message: string) {
  return {
    data: null,
    error: {
      status,
      name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
      message,
    },
  };
}

export default factories.createCoreController('api::assignment.assignment', () => ({
  async listTeacherSessionAssignments(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await listTeacherSessionAssignments(ctx.params?.sessionId, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load teacher session assignments');
    }
  },

  async createTeacherSessionAssignment(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await createTeacherSessionAssignment(ctx.params?.sessionId, ctx.request?.body?.data || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to create assignment');
    }
  },

  async listTeacherSessionAssessmentOptions(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await listTeacherSessionAssessmentOptions(ctx.params?.sessionId, ctx.query || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load assignment assessment options');
    }
  },

  async startTeacherSessionAssessmentPreviewAttempt(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await startTeacherSessionAssessmentPreviewAttempt(ctx.params?.sessionId, ctx.request?.body?.data || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to start assessment preview');
    }
  },

  async getTeacherAssignment(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await getTeacherAssignmentDetail(ctx.params?.assignmentId, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load assignment');
    }
  },

  async updateTeacherAssignment(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await updateTeacherAssignment(ctx.params?.assignmentId, ctx.request?.body?.data || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to update assignment');
    }
  },

  async updateTeacherAssignmentTaskGradingDefinition(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = {
        data: await updateTeacherAssignmentTaskGradingDefinition(
          ctx.params?.assignmentId,
          ctx.params?.taskId,
          ctx.request?.body?.data || {},
          tenantId,
          authUser,
        ),
      };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to update assignment task grading definition');
    }
  },

  async listTeacherAssignmentAssessmentOptions(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await listTeacherAssignmentAssessmentOptions(ctx.params?.assignmentId, ctx.query || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load assignment assessment options');
    }
  },

  async startTeacherAssignmentAssessmentPreviewAttempt(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await startTeacherAssignmentAssessmentPreviewAttempt(ctx.params?.assignmentId, ctx.request?.body?.data || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to start assessment preview');
    }
  },

  async publishTeacherAssignment(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await publishTeacherAssignment(ctx.params?.assignmentId, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to publish assignment');
    }
  },

  async closeTeacherAssignment(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await closeTeacherAssignment(ctx.params?.assignmentId, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to close assignment');
    }
  },

  async cancelTeacherAssignment(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await cancelTeacherAssignment(ctx.params?.assignmentId, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to cancel assignment');
    }
  },

  async reopenTeacherAssignment(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await reopenTeacherAssignment(ctx.params?.assignmentId, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to reopen assignment');
    }
  },

  async getTeacherAssignmentLearnerTask(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await getTeacherAssignmentLearnerTaskDetail(ctx.params?.assignmentId, ctx.params?.taskId, ctx.params?.learnerId, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load assignment learner task detail');
    }
  },

  async autoGradeTeacherAssignmentLearnerTask(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await autoGradeTeacherAssignmentTask(ctx.params?.assignmentId, ctx.params?.taskId, ctx.params?.learnerId, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to auto-grade assignment task');
    }
  },

  async batchRegradeStaleUnreviewedTeacherAssignmentTask(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = {
        data: await batchRegradeStaleUnreviewedTeacherAssignmentTask(
          ctx.params?.assignmentId,
          ctx.params?.taskId,
          tenantId,
          authUser,
        ),
      };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to batch regrade stale assignment task');
    }
  },

  async reviewTeacherAssignmentLearnerTask(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await reviewTeacherAssignmentTask(ctx.params?.assignmentId, ctx.params?.taskId, ctx.params?.learnerId, ctx.request?.body?.data || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to review assignment task');
    }
  },

  async listStudentSessionAssignments(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await listStudentSessionAssignments(ctx.params?.sessionId, ctx.query || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load student assignments');
    }
  },

  async listStudentAssignments(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      const result = await listStudentAssignments(ctx.query || {}, tenantId, authUser);
      ctx.body = {
        data: result?.data || [],
        meta: result?.meta || {},
      };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load student assignment list');
    }
  },

  async getStudentAssignment(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await getStudentAssignmentDetail(ctx.params?.assignmentId, ctx.query || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load student assignment');
    }
  },

  async getStudentAssignmentTask(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await getStudentAssignmentTaskDetail(ctx.params?.taskId, ctx.query || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load assignment task');
    }
  },

  async getStudentSubmissionVersion(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await getStudentSubmissionVersionDetail(ctx.params?.submissionId, ctx.query || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load submission version');
    }
  },

  async updateStudentTodoProgress(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await updateStudentTodoProgress(ctx.params?.taskId, ctx.query || {}, ctx.request?.body?.data || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to update todo progress');
    }
  },

  async startStudentAssessmentTaskAttempt(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await startStudentAssessmentTaskAttempt(ctx.params?.taskId, ctx.query || {}, tenantId, authUser) };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to start assessment task attempt');
    }
  },

  async saveStudentSubmissionDraft(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await saveStudentAssignmentSubmission(ctx.params?.taskId, ctx.query || {}, ctx.request?.body?.data || {}, tenantId, authUser, 'draft') };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to save submission draft');
    }
  },

  async submitStudentSubmission(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const tenantId = resolveTenantId(ctx);
    try {
      ctx.body = { data: await saveStudentAssignmentSubmission(ctx.params?.taskId, ctx.query || {}, ctx.request?.body?.data || {}, tenantId, authUser, 'submitted') };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to submit assignment');
    }
  },

  async uploadStudentAssignmentFile(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');
    const file = resolveUploadFile(ctx.request?.files?.file);
    if (!file) return ctx.badRequest('file is required');

    try {
      ctx.body = {
        data: await uploadStudentAssignmentFile(
          ctx.params?.taskId,
          ctx.query || {},
          file,
          ctx.state?.tenant || { id: ctx.state?.tenantId, code: ctx.state?.tenantCode || '' },
          authUser,
        ),
      };
    } catch (error: any) {
      const status = getAssignmentWorkspaceErrorStatus(error, 400);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to upload assignment file');
    }
  },
}));