export default {
  routes: [
    {
      method: 'GET',
      path: '/account',
      handler: 'account.find',
      config: {
        auth: {
          scope: [],
        },
      },
    },
    {
      method: 'GET',
      path: '/account/tenant-users',
      handler: 'account.tenantUsers',
      config: {
        auth: {
          scope: [],
        },
      },
    },
  ],
};
