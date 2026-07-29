const fitnessFeatures = {
  group: {
    name: 'Thể thao',
    code: 'fitness',
    order: 91,
    icon: 'cilChartLine',
  },
  features: [
    {
      name: 'Quản lý thể thao',
      key: 'fitness.manage',
      order: 1,
      description: 'Khu vực dành cho hoạt động thể thao cá nhân và challenge thể thao',
      path: '/fitness',
      showInMenu: true,
    },
  ],
}

export default fitnessFeatures
