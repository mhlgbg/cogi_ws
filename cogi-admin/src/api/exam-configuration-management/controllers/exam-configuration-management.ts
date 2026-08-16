import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import { getExamConfigurationComponentDetail, listExamConfigurationComponents } from '../services/exam-configuration-management';

type AuthUser = {
  id: number;
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
      select: ['id', 'blocked'],
    });
  } catch {
    return null;
  }
}

async function requireAuthenticatedUser(ctx: any): Promise<AuthUser | null> {
  let authUser = ctx.state?.user as AuthUser | undefined;
  if (!authUser?.id) {
    authUser = (await resolveUserFromJwt(ctx)) || undefined;
    if (authUser?.id) ctx.state.user = authUser;
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

export default {
  async listComponents(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    const tenantId = resolveCurrentTenantId(ctx);
    const result = await listExamConfigurationComponents(ctx.query || {}, tenantId);
    ctx.body = {
      success: true,
      data: result.rows,
      pagination: result.pagination,
    };
  },

  async getComponentDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser?.id) return;

    const tenantId = resolveCurrentTenantId(ctx);
    const entity = await getExamConfigurationComponentDetail(ctx.params?.id, tenantId);
    if (!entity) return ctx.notFound('Exam component not found');
    ctx.body = { success: true, data: entity };
  },
};