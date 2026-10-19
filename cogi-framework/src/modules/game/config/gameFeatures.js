const gameFeatures = {
  group: {
    name: 'Game Platform',
    code: 'game',
    order: 82,
    icon: 'cilGamepad',
  },
  features: [
    {
      name: 'Quản lý Game',
      key: 'game.manage',
      order: 1,
      description: 'Quản lý các game trong tenant, lifecycle, rule và đăng ký thành viên.',
      path: '/games',
      icon: 'cilGamepad',
      showInMenu: true,
    },
    {
      name: 'Game Center',
      key: 'game.center.view',
      order: 2,
      description: 'Truy cập Game Center dành cho người dùng đã đăng nhập.',
      path: '/game-center',
      icon: 'cilGamepad',
      showInMenu: true,
    },
  ],
}

export default gameFeatures
