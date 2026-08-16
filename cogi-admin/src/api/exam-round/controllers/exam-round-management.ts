import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
  applyPaymentProfileToExamRound,
  approveExamRound,
  bulkCreateExamRoundEligibilities,
  createExamConfigurationComponent,
  createExamConfigurationOutcome,
  createExamConfigurationProgram,
  createExamConfigurationSubject,
  closeExamRoundRegistration,
  createExamRoundEligibility,
  createLearnerProfileForExamRound,
  createExamRoomForRound,
  createExamVenueForRound,
  createExamRoundFromProgram,
  getExamConfigurationComponentDetail,
  getExamConfigurationOutcomeDetail,
  getExamConfigurationProgramDetail,
  getExamConfigurationSubjectDetail,
  getExamRoundManagementDetail,
  listActivePaymentProfilesForExamRound,
  getMyExamRoundRegistrationContext,
  getExamRoundEligibility,
  handleExamRoundManagementError,
  getCurrentLearnerProfile,
  getLearnerProfileContext,
  getLearnerExamRoundDetail,
  getLearnerExamRegistrationDetail,
  getExamRoundPaymentDetail,
  getExamRoundPaymentSummary,
  getExamRoundVenueRoomConfiguration,
  listExamRoundPayments,
  confirmPaymentForExamRegistration,
  rejectPaymentReportForExamRegistration,
  reportLearnerPaymentForRegistration,
  uploadPaymentEvidenceForRegistration,
  getLearnerRegistrationOptions,
  listLearnersForExamRoundEligibility,
  listLearnerExamRounds,
  listExamConfigurationComponents,
  listExamConfigurationOutcomes,
  listExamConfigurationPrograms,
  listExamConfigurationSubjects,
  listExamRoundsManagement,
  listExamRoundEligibilities,
  markExamRoundEligibilityIneligible,
  openExamRoundRegistration,
  registerCurrentLearnerForExamRound,
  pauseExamRoundRegistration,
  replaceExamConfigurationSubjectComponents,
  replaceExamConfigurationProgramSubjects,
  returnExamRoundToDraft,
  resumeExamRoundRegistration,
  submitExamRoundForApproval,
  updateExamConfigurationProgramSubject,
  updateExamConfigurationSubjectComponent,
  updateExamConfigurationComponent,
  updateExamConfigurationOutcome,
  updateExamConfigurationProgram,
  updateExamConfigurationSubject,
  updateExamRoundEligibility,
  updateExamRoundPaymentSettings,
  updateExamRoundVenuesRooms,
  updateExamRoundStructure,
} from '../services/exam-round-management';
import {
  approveExamRegistrationForRound,
  getExamRoundReviewDetail,
  getExamRoundReviewSummary,
  listExamRoundReviews,
  rejectExamRegistrationForRound,
  returnExamRegistrationForRound,
} from '../../exam-registration/services/exam-registration-review';

type AuthUser = {
  id: number;
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
  blocked?: boolean | null;
};

const EXAM_ROUND_PAYMENT_MEDIA_MAX_FILE_SIZE = 10 * 1024 * 1024;
const EXAM_ROUND_PAYMENT_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
]);

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
    const userId = Number(decoded?.id || 0);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'username', 'fullName', 'email', 'blocked'],
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

  if (authUser.blocked) {
    ctx.unauthorized('Account is blocked');
    return null;
  }

  return authUser;
}

function extractPayload(ctx: any): Record<string, unknown> {
  const body = ctx.request?.body;
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
}

function flattenUploadedFiles(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => flattenUploadedFiles(entry));
  if (
    typeof value === 'object'
    && value
    && ((value as Record<string, unknown>).filepath || (value as Record<string, unknown>).path || (value as Record<string, unknown>).tempFilePath)
  ) {
    return [value];
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((entry) => flattenUploadedFiles(entry));
  }
  return [];
}

function resolveUploadFile(rawFiles: any) {
  return flattenUploadedFiles(rawFiles)[0] || null;
}

function normalizeUploadMimeType(file: any) {
  return String(file?.mimetype || file?.type || '').trim().toLowerCase();
}

function normalizeUploadSize(file: any) {
  const size = Number(file?.size || 0);
  return Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0;
}

function ensureExamRoundPaymentMediaFileValid(file: any) {
  const mimeType = normalizeUploadMimeType(file);
  if (!mimeType || !EXAM_ROUND_PAYMENT_MEDIA_TYPES.has(mimeType)) {
    throw new Error('Chỉ cho phép upload ảnh JPG, PNG, WEBP, GIF, SVG hoặc AVIF');
  }

  const size = normalizeUploadSize(file);
  if (!size || size > EXAM_ROUND_PAYMENT_MEDIA_MAX_FILE_SIZE) {
    throw new Error('Ảnh tải lên vượt quá giới hạn 10MB');
  }
}

function normalizeUploadedMedia(media: any) {
  if (!media || typeof media !== 'object') return null;
  return {
    id: Number(media.id || 0) || null,
    name: String(media.name || '').trim() || null,
    url: String(media.url || '').trim() || null,
    mime: String(media.mime || '').trim() || null,
  };
}

export default {
  async listRounds(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listExamRoundsManagement(ctx.query || {}, tenantId);
      ctx.body = {
        data: data.rows,
        pagination: data.pagination,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getRoundDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamRoundManagementDetail(ctx.params?.id, tenantId);
      if (!data) return ctx.notFound('Exam round not found');
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async listConfigurationComponents(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listExamConfigurationComponents(ctx.query || {}, tenantId);
      ctx.body = {
        success: true,
        data: data.rows,
        pagination: data.pagination,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getConfigurationComponentDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamConfigurationComponentDetail(ctx.params?.componentId, tenantId);
      if (!data) return ctx.notFound('Exam component not found');
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async listConfigurationSubjects(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listExamConfigurationSubjects(ctx.query || {}, tenantId);
      ctx.body = {
        success: true,
        data: data.rows,
        pagination: data.pagination,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getConfigurationSubjectDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamConfigurationSubjectDetail(ctx.params?.subjectId, tenantId);
      if (!data) return ctx.notFound('Exam subject not found');
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async listConfigurationPrograms(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listExamConfigurationPrograms(ctx.query || {}, tenantId);
      ctx.body = {
        success: true,
        data: data.rows,
        pagination: data.pagination,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getConfigurationProgramDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamConfigurationProgramDetail(ctx.params?.programId, tenantId);
      if (!data) return ctx.notFound('Exam program not found');
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async listConfigurationOutcomes(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listExamConfigurationOutcomes(ctx.query || {}, tenantId);
      ctx.body = {
        success: true,
        data: data.rows,
        pagination: data.pagination,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getConfigurationOutcomeDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamConfigurationOutcomeDetail(ctx.params?.outcomeId, tenantId);
      if (!data) return ctx.notFound('Outcome standard not found');
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async createConfigurationOutcome(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await createExamConfigurationOutcome(tenantId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async updateConfigurationOutcome(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await updateExamConfigurationOutcome(tenantId, ctx.params?.outcomeId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async createConfigurationProgram(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await createExamConfigurationProgram(tenantId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async updateConfigurationProgram(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await updateExamConfigurationProgram(tenantId, ctx.params?.programId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async replaceConfigurationProgramSubjects(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await replaceExamConfigurationProgramSubjects(tenantId, ctx.params?.programId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async updateConfigurationProgramSubject(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await updateExamConfigurationProgramSubject(
        tenantId,
        ctx.params?.programId,
        ctx.params?.programSubjectId,
        extractPayload(ctx),
        authUser,
      );
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async createConfigurationSubject(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await createExamConfigurationSubject(tenantId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async updateConfigurationSubject(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await updateExamConfigurationSubject(tenantId, ctx.params?.subjectId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async replaceConfigurationSubjectComponents(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await replaceExamConfigurationSubjectComponents(tenantId, ctx.params?.subjectId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async updateConfigurationSubjectComponent(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await updateExamConfigurationSubjectComponent(
        tenantId,
        ctx.params?.subjectId,
        ctx.params?.subjectComponentId,
        extractPayload(ctx),
        authUser,
      );
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async createConfigurationComponent(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await createExamConfigurationComponent(tenantId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async updateConfigurationComponent(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await updateExamConfigurationComponent(tenantId, ctx.params?.componentId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async createFromProgram(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await createExamRoundFromProgram(tenantId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async updateStructure(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await updateExamRoundStructure(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async listPaymentProfiles(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      ctx.body = await listActivePaymentProfilesForExamRound(ctx.query || {}, tenantId);
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async uploadPaymentMedia(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const uploadFile = resolveUploadFile(ctx.request?.files);
      if (!uploadFile) {
        return ctx.badRequest('file is required');
      }

      ensureExamRoundPaymentMediaFileValid(uploadFile);
      const uploadService = strapi.plugin('upload').service('upload');
      const uploadedFiles = await uploadService.upload({ data: {}, files: [uploadFile] });
      const uploaded = Array.isArray(uploadedFiles) ? uploadedFiles[0] : uploadedFiles;
      if (!uploaded?.id) {
        throw new Error('Không nhận được dữ liệu media sau khi upload');
      }

      ctx.body = { data: normalizeUploadedMedia(uploaded) };
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message === 'file is required' || message.includes('Chỉ cho phép upload ảnh') || message.includes('vượt quá giới hạn 10MB')) {
        return ctx.badRequest(message);
      }
      strapi.log.error('[exam-round-management.uploadPaymentMedia] unexpected error', error);
      return ctx.internalServerError('Failed to upload exam round payment media');
    }
  },

  async applyPaymentProfile(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await applyPaymentProfileToExamRound(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async updatePaymentSettings(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await updateExamRoundPaymentSettings(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async submitForApproval(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await submitExamRoundForApproval(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async approve(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await approveExamRound(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async returnToDraft(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await returnExamRoundToDraft(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async openRegistration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await openExamRoundRegistration(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async pauseRegistration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await pauseExamRoundRegistration(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async resumeRegistration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await resumeExamRoundRegistration(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async closeRegistration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await closeExamRoundRegistration(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async createEligibility(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await createExamRoundEligibility(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getCurrentLearner(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getCurrentLearnerProfile(ctx, tenantId, authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async listLearnerRounds(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      ctx.body = await listLearnerExamRounds(ctx, tenantId, ctx.query || {}, authUser);
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getLearnerRoundDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getLearnerExamRoundDetail(ctx, tenantId, ctx.params?.id, authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getLearnerProfileRegistrationContext(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getLearnerProfileContext(ctx, tenantId, ctx.params?.id, authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async createLearnerProfile(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await createLearnerProfileForExamRound(ctx, tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getLearnerRegistrationOptions(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getLearnerRegistrationOptions(ctx, tenantId, ctx.params?.id, authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async myRegistrationContext(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getMyExamRoundRegistrationContext(ctx, tenantId, ctx.params?.id, authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async registerLearner(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await registerCurrentLearnerForExamRound(ctx, tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getLearnerRegistrationDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getLearnerExamRegistrationDetail(ctx, tenantId, ctx.params?.id, authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async uploadLearnerRegistrationPaymentEvidence(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const file = resolveUploadFile(ctx.request?.files);
      if (!file) {
        return ctx.badRequest('Thiếu file chứng từ thanh toán');
      }

      const data = await uploadPaymentEvidenceForRegistration(ctx, tenantId, ctx.params?.id, file, authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async reportLearnerRegistrationPayment(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await reportLearnerPaymentForRegistration(ctx, tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getPaymentSummary(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamRoundPaymentSummary(tenantId, ctx.params?.id, authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async listRoundPayments(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listExamRoundPayments(tenantId, ctx.params?.id, ctx.query || {}, authUser);
      ctx.body = data;
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getRoundPaymentDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamRoundPaymentDetail(tenantId, ctx.params?.roundId, ctx.params?.registrationId, authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async confirmRegistrationPayment(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await confirmPaymentForExamRegistration(tenantId, ctx.params?.roundId, ctx.params?.registrationId, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async rejectRegistrationPaymentReport(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await rejectPaymentReportForExamRegistration(tenantId, ctx.params?.roundId, ctx.params?.registrationId, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getVenueRoomConfiguration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamRoundVenueRoomConfiguration(tenantId, ctx.params?.id);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async updateVenueRoomConfiguration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await updateExamRoundVenuesRooms(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async createVenueForRound(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await createExamVenueForRound(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async createRoomForRound(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await createExamRoomForRound(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getReviewSummary(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamRoundReviewSummary(tenantId, ctx.params?.id, authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async listRoundReviews(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listExamRoundReviews(tenantId, ctx.params?.id, ctx.query || {}, authUser);
      ctx.body = data;
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getRoundReviewDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamRoundReviewDetail(tenantId, ctx.params?.roundId, ctx.params?.registrationId, authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async approveRegistrationReview(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await approveExamRegistrationForRound(tenantId, ctx.params?.roundId, ctx.params?.registrationId, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async returnRegistrationReview(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await returnExamRegistrationForRound(tenantId, ctx.params?.roundId, ctx.params?.registrationId, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async rejectRegistrationReview(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await rejectExamRegistrationForRound(tenantId, ctx.params?.roundId, ctx.params?.registrationId, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async register(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await registerCurrentLearnerForExamRound(ctx, tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async bulkCreateEligibilities(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await bulkCreateExamRoundEligibilities(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async listEligibilities(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listExamRoundEligibilities(tenantId, ctx.params?.id, ctx.query || {}, authUser);
      ctx.body = data;
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async listEligibilityLearners(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listLearnersForExamRoundEligibility(tenantId, ctx.params?.id, ctx.query || {}, authUser);
      ctx.body = data;
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async getEligibility(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getExamRoundEligibility(tenantId, ctx.params?.id, ctx.params?.eligibilityId, authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async updateEligibility(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await updateExamRoundEligibility(tenantId, ctx.params?.id, ctx.params?.eligibilityId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },

  async markEligibilityIneligible(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await markExamRoundEligibilityIneligible(tenantId, ctx.params?.id, ctx.params?.eligibilityId, extractPayload(ctx), authUser);
      ctx.body = {
        success: true,
        data,
      };
    } catch (error) {
      return handleExamRoundManagementError(ctx, error);
    }
  },
};