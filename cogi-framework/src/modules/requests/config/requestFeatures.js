const requestFeatures = {
  group: {
    name: 'Requests',
    code: 'request',
    order: 11,
    icon: 'cilTask',
  },
  features: [
    {
      name: 'Danh sách yêu cầu',
      key: 'request.list',
      order: 1,
      description: 'Danh sách yêu cầu của người dùng',
      path: '/requests',
      showInMenu: true,
    },
    {
      name: 'Tạo yêu cầu',
      key: 'request.create',
      order: 2,
      description: 'Tạo và cập nhật yêu cầu',
      path: '/requests/new',
      showInMenu: false,
    },
    {
      name: 'Theo dõi yêu cầu',
      key: 'request.monitor',
      order: 3,
      description: 'Theo dõi toàn bộ yêu cầu trong tenant',
      path: '/requests/monitor',
      showInMenu: true,
    },
    {
      name: 'Quản lý loại yêu cầu',
      key: 'request.category.manage',
      order: 4,
      description: 'Quản lý danh mục yêu cầu',
      path: '/request-categories',
      showInMenu: true,
    },
  ],
}

export default requestFeatures
