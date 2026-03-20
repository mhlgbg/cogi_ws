export default {
  routes: [
    {
      method: 'GET',
      path: '/my-feature-context',
      handler: 'my-feature-context.index',
      config: {
        auth: {
          scope: [],
        },
      },
    },
  ],
};
