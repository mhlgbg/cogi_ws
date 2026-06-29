export default {
  routes: [
    {
      method: 'POST',
      path: '/learning/package-import/preview',
      handler: 'learning-package-import.preview',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'learning.package-import.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/learning/package-import/confirm',
      handler: 'learning-package-import.confirm',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'learning.package-import.manage',
            },
          },
        ],
      },
    },
  ],
};
