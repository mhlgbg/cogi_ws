export default {
  routes: [
    {
      method: 'POST',
      path: '/platform/structured-tree/:treeId/node',
      handler: 'structured-node.create',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-tree/:treeId/nodes',
      handler: 'structured-node.find',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-tree/:treeId/nodes/:nodeId',
      handler: 'structured-node.findOne',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/structured-tree/:treeId/nodes/:nodeId',
      handler: 'structured-node.update',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/structured-tree/:treeId/nodes/:nodeId',
      handler: 'structured-node.delete',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-tree/:treeId/tree-hierarchy',
      handler: 'structured-node.hierarchy',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-tree/:treeId/requirements',
      handler: 'structured-node.findRequirements',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/structured-tree/:treeId/criteria',
      handler: 'structured-node.findCriteria',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
  ],
}
