export default {
  routes: [
    {
      method: 'POST',
      path: '/platform/structured-node-type',
      handler: 'structured-node-type.create',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-node-type',
      handler: 'structured-node-type.find',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-node-type/:id',
      handler: 'structured-node-type.findOne',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/structured-node-type/:id',
      handler: 'structured-node-type.update',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/structured-node-type/:id',
      handler: 'structured-node-type.delete',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
  ],
}
