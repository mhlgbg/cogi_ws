export default {
  routes: [
    {
      method: 'GET',
      path: '/me',
      handler: 'me.index',
      config: {
        auth: {
          scope: [],
        },
      },
    },
  ],
};
