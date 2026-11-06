export default {
  routes: [
    {
      method: 'POST',
      path: '/platform/structured-tree',
      handler: 'structured-tree.create',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-tree',
      handler: 'structured-tree.find',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-tree/:id',
      handler: 'structured-tree.findOne',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/structured-tree/:id',
      handler: 'structured-tree.update',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/structured-tree/:id',
      handler: 'structured-tree.delete',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
  ],
}
