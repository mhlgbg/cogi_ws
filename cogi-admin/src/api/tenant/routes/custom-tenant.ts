export default {
  routes: [
    {
      method: 'GET',
      path: '/tenant/me',
      handler: 'tenant.me',
      config: {
        auth: false,
      },
    },
  ],
};