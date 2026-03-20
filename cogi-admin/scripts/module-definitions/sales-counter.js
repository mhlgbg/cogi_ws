module.exports = {
  group: {
    name: 'Sales Counter',
    code: 'sales-counter',
    order: 8,
    icon: 'cilCart',
  },
  features: [
    {
      name: 'Sales Counter Management',
      key: 'sales-counters.manage',
      order: 1,
      description: 'Sales counter management module',
      path: '/sales-counters',
      icon: 'cilCart',
      showInMenu: true,
    },
  ],
}
