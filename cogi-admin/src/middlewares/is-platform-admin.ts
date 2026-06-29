function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function resolveUserFromJwt(ctx: any, strapi: any) {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!token) return null;

    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) return null;

    const decoded = await jwtService.verify(token);
    const userId = toPositiveInt(decoded?.id);
    if (!userId) return null;

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'blocked', 'isPlatformAdmin'],
    });
  } catch {
    return null;
  }
}

export default (_config: unknown, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    let authUser = ctx.state?.user;

    if (!authUser?.id) {
      authUser = await resolveUserFromJwt(ctx, strapi);
    }

    if (!authUser?.id) {
      strapi.log?.warn?.('[is-platform-admin] unauthorized request without authenticated user');
      return ctx.unauthorized('Unauthorized');
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: authUser.id },
      select: ['id', 'blocked', 'isPlatformAdmin'],
    });

    if (!user?.id) {
      strapi.log?.warn?.(`[is-platform-admin] user not found for auth user=${String(authUser.id)}`);
      return ctx.unauthorized('Unauthorized');
    }

    if (user.blocked === true) {
      strapi.log?.warn?.(`[is-platform-admin] blocked user=${String(user.id)}`);
      return ctx.unauthorized('Account is blocked');
    }

    if (user.isPlatformAdmin !== true) {
      strapi.log?.warn?.(`[is-platform-admin] forbidden user=${String(user.id)} isPlatformAdmin=${String(user.isPlatformAdmin)}`);
      return ctx.forbidden('Platform admin only');
    }

    ctx.state.user = {
      ...authUser,
      isPlatformAdmin: true,
    };

    await next();
  };
};