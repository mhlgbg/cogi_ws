export default {
  routes: [
    {
      method: 'GET',
      path: '/public-page-management/pages/form-options',
      handler: 'public-page-management.pageFormOptions',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'public-page.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/public-page-management/pages',
      handler: 'public-page-management.listPages',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'public-page.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/public-page-management/pages/:id',
      handler: 'public-page-management.pageDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'public-page.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/public-page-management/pages',
      handler: 'public-page-management.createPage',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'public-page.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/public-page-management/pages/:id',
      handler: 'public-page-management.updatePage',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'public-page.manage',
            },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/public-page-management/pages/:id',
      handler: 'public-page-management.deletePage',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'public-page.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/public-page-management/pages/:id/restore',
      handler: 'public-page-management.restorePage',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'public-page.manage',
            },
          },
        ],
      },
    },
  ],
};
