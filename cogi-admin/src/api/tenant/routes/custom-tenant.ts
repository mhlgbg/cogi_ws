export default {
  routes: [
    {
      method: 'GET',
      path: '/tenant-context',
      handler: 'tenant.context',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/tenant/me',
      handler: 'tenant.me',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/tenant/settings/website',
      handler: 'tenant.getWebsiteSettings',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'tenant-setting.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/tenant/settings/website',
      handler: 'tenant.updateWebsiteSettings',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'tenant-setting.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/tenant/settings/website/media-upload',
      handler: 'tenant.uploadWebsiteMedia',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'tenant-setting.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/tenant/settings/website/storage-configs',
      handler: 'tenant.createWebsiteStorageConfig',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'tenant-setting.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/tenant/settings/website/storage-configs/:id',
      handler: 'tenant.updateWebsiteStorageConfig',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'tenant-setting.manage',
            },
          },
        ],
      },
    },
  ],
};