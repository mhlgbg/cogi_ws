import { cancelRegistrationById } from '../../event/services/event';
import { resolveCurrentTenantId } from '../../../utils/tenant-scope';

async function resolveAuthenticatedUser(ctx: any) {
  const stateUser = ctx.state?.user;
  if (stateUser?.id) {
    return stateUser;
  }

  const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    return null;
  }

  try {
    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) {
      return null;
    }

    const decoded = await jwtService.verify(token);
    const userId = Number(decoded?.id || 0);
    if (!userId) {
      return null;
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'email', 'username', 'firstName', 'lastName', 'blocked'],
    });

    if (!user || user.blocked) {
      return null;
    }

    ctx.state.user = user;
    return user;
  } catch {
    return null;
  }
}

export async function cancelRegistrationAction(ctx: any) {
  const tenantId = resolveCurrentTenantId(ctx);
  const user = await resolveAuthenticatedUser(ctx);
  return cancelRegistrationById(tenantId, ctx.params?.id, user);
}
