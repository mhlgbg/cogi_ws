export default {
  routes: [
    {
      method: 'GET',
      path: '/auth/my-tenant-context',
      handler: 'my-tenant-context.index',
      config: {
        auth: {
          scope: [],
        },
      },
    },
  ],
};
