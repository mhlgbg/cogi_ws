import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
  confirmExamPayment,
  getAdminExamPaymentReviewDetail,
  getMyExamRegistrationPaymentDetail,
  handleExamPaymentWorkflowError,
  listAdminExamPaymentsForReview,
  listMyExamRegistrationPayments,
  rejectExamPayment,
  reportExamPaymentByLearner,
  startExamPaymentReview,
} from '../services/exam-payment-workflow';

type AuthUser = {
  id: number;
  username?: string | null;
  fullName?: string | null;
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

export default {
  async reportSelf(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await reportExamPaymentByLearner(ctx, tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamPaymentWorkflowError(ctx, error);
    }
  },

  async listMy(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listMyExamRegistrationPayments(ctx, tenantId, ctx.params?.id, ctx.query || {}, authUser);
      ctx.body = data;
    } catch (error) {
      return handleExamPaymentWorkflowError(ctx, error);
    }
  },

  async detailMy(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getMyExamRegistrationPaymentDetail(ctx, tenantId, ctx.params?.id, ctx.params?.paymentId, authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamPaymentWorkflowError(ctx, error);
    }
  },

  async reviewList(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await listAdminExamPaymentsForReview(tenantId, ctx.query || {}, authUser);
      ctx.body = data;
    } catch (error) {
      return handleExamPaymentWorkflowError(ctx, error);
    }
  },

  async reviewDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await getAdminExamPaymentReviewDetail(tenantId, ctx.params?.id, authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamPaymentWorkflowError(ctx, error);
    }
  },

  async startReview(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await startExamPaymentReview(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamPaymentWorkflowError(ctx, error);
    }
  },

  async confirm(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await confirmExamPayment(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamPaymentWorkflowError(ctx, error);
    }
  },

  async reject(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx));
      const data = await rejectExamPayment(tenantId, ctx.params?.id, extractPayload(ctx), authUser);
      ctx.body = { success: true, data };
    } catch (error) {
      return handleExamPaymentWorkflowError(ctx, error);
    }
  },
};