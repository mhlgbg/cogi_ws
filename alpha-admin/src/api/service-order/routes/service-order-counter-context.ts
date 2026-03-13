export default {
  routes: [
    {
      method: 'GET',
      path: '/service-orders/counter-context',
      handler: 'service-order.counterContext',
      config: {
        auth: {
          scope: [],
        },
      },
    },
  ],
};
