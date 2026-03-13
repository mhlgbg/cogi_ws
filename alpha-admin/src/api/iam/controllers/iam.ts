export default {
  async me(ctx) {
    const authUser = ctx.state.user;
    if (!authUser?.id) {
      return ctx.unauthorized('Unauthorized');
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: authUser.id },
      populate: ['role'],
    });

    if (!user) {
      return ctx.notFound('User not found');
    }

    const roleId = user.role?.id;
    const roleName = user.role?.name || null;

    let permissionKeys: string[] = [];

    if (roleId) {
      const mappings = await strapi.db.query('api::role-feature.role-feature').findMany({
        where: { role: roleId },
        populate: ['feature'],
      });

      permissionKeys = Array.from(
        new Set(
          (mappings || [])
            .map((item) => item?.feature?.key)
            .filter((key): key is string => typeof key === 'string' && key.length > 0)
        )
      );
    }

    ctx.body = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      role: roleName,
      permissionKeys,
    };
  },
};
