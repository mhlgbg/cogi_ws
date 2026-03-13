export default {
  routes: [
    {
      method: 'GET',
      path: '/service-orders/lookups/customers',
      handler: 'service-order.lookupCustomers',
      config: {
        auth: {
          scope: [],
        },
      },
    },
    {
      method: 'POST',
      path: '/service-orders/lookups/customers/quick-create',
      handler: 'service-order.quickCreateCustomer',
      config: {
        auth: {
          scope: [],
        },
      },
    },
    {
      method: 'GET',
      path: '/service-orders/lookups/service-items',
      handler: 'service-order.lookupServiceItems',
      config: {
        auth: {
          scope: [],
        },
      },
    },
  ],
};
