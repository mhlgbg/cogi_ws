const contentManagementFeatures = {
  group: {
    name: 'Content',
    code: 'content',
    order: 12,
    icon: 'cilDescription',
  },
  features: [
    {
      name: 'Quan ly article',
      key: 'article.manage',
      order: 1,
      description: 'Tenant quan ly bai viet cua minh',
      path: '/articles',
      showInMenu: true,
    },
    {
      name: 'Quan ly category',
      key: 'category.manage',
      order: 2,
      description: 'Tenant quan ly category bai viet cua minh',
      path: '/categories',
      showInMenu: true,
    },
    {
      name: 'Quan ly author',
      key: 'author.manage',
      order: 3,
      description: 'Tenant quan ly tac gia bai viet cua minh',
      path: '/authors',
      showInMenu: true,
    },
    {
      name: 'Quan ly tenant config',
      key: 'tenant-config.manage',
      order: 4,
      description: 'Tenant quan ly cac cau hinh JSON cua minh',
      path: '/tenant-configs',
      showInMenu: true,
    },
  ],
}

export default contentManagementFeatures