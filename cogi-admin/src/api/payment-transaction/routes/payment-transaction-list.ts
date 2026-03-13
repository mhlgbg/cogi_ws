export default {
  routes: [
    {
      method: 'GET',
      path: '/payment-transactions/list',
      handler: 'payment-transaction.list',
      config: {
        auth: {
          scope: [],
        },
      },
    },
  ],
};
