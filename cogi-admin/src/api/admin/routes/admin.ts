export default {
  routes: [
    {
      method: 'GET',
      path: '/admin/invite-options',
      handler: 'admin.getInviteOptions',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'user.invite',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/admin/invite-user',
      handler: 'admin.inviteUser',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'user.invite',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/admin/tenant-users',
      handler: 'admin.listTenantUsers',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'user.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/admin/tenant-users/:userTenantId/roles',
      handler: 'admin.updateTenantUserRoles',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'user.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/users/import',
      handler: 'admin.importUsers',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'user.manage',
            },
          },
        ],
      },
    },
  ],
};
