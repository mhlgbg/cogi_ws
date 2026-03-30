export default {
  routes: [
    {
      method: 'GET',
      path: '/service-orders/lookups/customers',
      handler: 'service-order.lookupCustomers',
      config: {
				auth: false,
      },
    },
    {
      method: 'POST',
      path: '/service-orders/lookups/customers/quick-create',
      handler: 'service-order.quickCreateCustomer',
      config: {
				auth: false,
      },
    },
    {
      method: 'GET',
      path: '/service-orders/lookups/service-items',
      handler: 'service-order.lookupServiceItems',
      config: {
				auth: false,
      },
    },
  ],
};
