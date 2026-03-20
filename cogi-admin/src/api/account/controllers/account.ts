const USER_TENANT_UID = 'api::user-tenant.user-tenant';

type BasicUser = {
  id: number;
  username?: string | null;
  email?: string | null;
};

export default {
  async find(ctx: any) {
    ctx.body = { ok: true };
  },

  async tenantUsers(ctx: any) {
    const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
    const authUser = ctx.state?.user as BasicUser | undefined;

    if (!tenantId) {
      return ctx.badRequest('Tenant context is required');
    }

    const seen = new Set<number>();
    const users: Array<{ id: number; username: string; email: string }> = [];

    if (authUser?.id) {
      users.push({
        id: authUser.id,
        username: authUser.username || '',
        email: authUser.email || '',
      });
      seen.add(authUser.id);
    }

    const rows = await strapi.db.query(USER_TENANT_UID).findMany({
      where: {
        tenant: { id: tenantId },
      },
      populate: {
        user: {
          select: ['id', 'username', 'email'],
        },
      },
    });

    for (const row of rows || []) {
      const user = row?.user as BasicUser | undefined;
      if (!user?.id || seen.has(user.id)) continue;

      users.push({
        id: user.id,
        username: user.username || '',
        email: user.email || '',
      });
      seen.add(user.id);
    }

    ctx.body = { data: users };
  },
};
