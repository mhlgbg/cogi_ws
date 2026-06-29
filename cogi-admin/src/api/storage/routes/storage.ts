export default {
  routes: [
    {
      method: 'GET',
      path: '/tenant/storage/summary',
      handler: 'storage.getTenantStorageSummary',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'storage.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/tenant/storage/files',
      handler: 'storage.listTenantStorageFiles',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'storage.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/tenant/storage/upload',
      handler: 'storage.uploadTenantStorageFile',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'storage.manage',
            },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/tenant/storage/files/:id',
      handler: 'storage.deleteTenantStorageFile',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'storage.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/tenant/storage/files/:id/restore',
      handler: 'storage.restoreTenantStorageFile',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'storage.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/storage/files/:id/download',
      handler: 'storage.downloadFileAsset',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/storage/upload-test',
      handler: 'storage.uploadTest',
      config: {
        auth: { scope: [] },
      },
    },
  ],
};