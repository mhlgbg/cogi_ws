export default {
  routes: [
    {
      method: 'GET',
      path: '/tenant-context',
      handler: 'tenant.context',
      config: {
        auth: false,
      },
    },
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