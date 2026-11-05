export default {
  routes: [
    {
      method: 'POST',
      path: '/platform/curriculum-source-import/preview',
      handler: 'platform-curriculum-source-import.preview',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/curriculum-source-import/confirm',
      handler: 'platform-curriculum-source-import.confirm',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculum-source-import/batches',
      handler: 'platform-curriculum-source-import.listBatches',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculum-source-import/batches/:id',
      handler: 'platform-curriculum-source-import.batchDetail',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
  ],
}
