export default {
  routes: [
    {
      method: 'GET',
      path: '/service-orders/list',
      handler: 'service-order.list',
      config: {
        auth: {
          scope: [],
        },
      },
    },
  ],
};
