export default {
  routes: [
    {
      method: 'GET',
      path: '/iam/me',
      handler: 'iam.me',
      config: {
        auth: {
          scope: [],
        },
      },
    },
  ],
};
