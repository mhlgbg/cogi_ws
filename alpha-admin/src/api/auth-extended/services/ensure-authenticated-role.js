async function ensureUserHasAuthenticatedRole(strapi, userId) {
  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    populate: ['role'],
  });

  const existingRole = user?.role;
  const existingRoleId =
    existingRole && typeof existingRole === 'object' ? existingRole.id : existingRole;
  const hasRoleBefore = Boolean(existingRoleId);

  if (hasRoleBefore) {
    return {
      hasRoleBefore: true,
      roleAssigned: false,
      assignedRoleId: Number(existingRoleId),
    };
  }

  const authenticatedRoleByName = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({
      where: { name: 'Authenticated' },
    });

  const authenticatedRole =
    authenticatedRoleByName ||
    (await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    }));

  if (!authenticatedRole?.id) {
    throw new Error('Authenticated role was not found');
  }

  await strapi.entityService.update('plugin::users-permissions.user', userId, {
    data: {
      role: authenticatedRole.id,
    },
  });

  return {
    hasRoleBefore: false,
    roleAssigned: true,
    assignedRoleId: authenticatedRole.id,
  };
}

module.exports = {
  ensureUserHasAuthenticatedRole,
};
