export default {
  routes: [
    {
      method: 'POST',
      path: '/platform/structured-import/preview',
      handler: 'platform-structured-import.preview',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-import/preview/:previewId',
      handler: 'platform-structured-import.getPreview',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/structured-import/confirm',
      handler: 'platform-structured-import.confirm',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-import/batches/:batchId',
      handler: 'platform-structured-import.getBatchStatus',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-import/batches',
      handler: 'platform-structured-import.listBatches',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
  ],
}
