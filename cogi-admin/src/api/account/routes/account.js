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
  ],
}
