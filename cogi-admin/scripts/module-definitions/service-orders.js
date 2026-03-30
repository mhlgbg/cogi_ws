module.exports = {
  group: {
    name: 'Service Orders',
    code: 'service-orders',
    order: 9,
    icon: 'cilList',
  },
  features: [
    {
      name: 'Service Order List',
      key: 'service-orders',
      order: 1,
      description: 'Service orders list module',
      path: '/service-orders',
      icon: 'cilList',
      showInMenu: true,
    },
    {
      name: 'Service Items',
      key: 'service-items.manage',
      order: 2,
      description: 'Tenant service item management',
      path: '/service-items',
      icon: 'cilList',
      showInMenu: true,
    },
    {
      name: 'Service Categories',
      key: 'service-categories.manage',
      order: 3,
      description: 'Tenant service category management',
      path: '/service-categories',
      icon: 'cilList',
      showInMenu: true,
    },
  ],
}
