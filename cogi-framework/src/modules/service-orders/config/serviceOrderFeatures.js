const serviceOrderFeatures = {
  group: {
    name: 'Service Orders',
    code: 'service-orders',
    order: 9,
    icon: 'cilList',
  },
  features: [
    {
      name: 'Danh sach don hang',
      key: 'service-orders',
      order: 1,
      description: 'Danh sach don dich vu',
      path: '/service-orders',
      showInMenu: true,
    },
    {
      name: 'Quan ly service item',
      key: 'service-items.manage',
      order: 2,
      description: 'Tenant quan ly service item cua minh',
      path: '/service-items',
      showInMenu: true,
    },
    {
      name: 'Quan ly service category',
      key: 'service-categories.manage',
      order: 3,
      description: 'Tenant quan ly service category cua minh',
      path: '/service-categories',
      showInMenu: true,
    },
  ],
}

export default serviceOrderFeatures
