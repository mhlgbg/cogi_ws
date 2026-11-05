module.exports = {
  group: {
    name: 'Game Platform',
    code: 'game',
    order: 82,
    icon: 'cilGamepad',
  },
  features: [
    {
      name: 'Game Management',
      key: 'game.manage',
      order: 1,
      description: 'Manage tenant game catalog, lifecycle, rules and registrants',
      path: '/games',
      icon: 'cilGamepad',
      showInMenu: true,
    },
    {
      name: 'Game Center',
      key: 'game.center.view',
      order: 2,
      description: 'User-facing game center page for tenant members',
      path: '/game-center',
      icon: 'cilGamepad',
      showInMenu: true,
    },
  ],
}
