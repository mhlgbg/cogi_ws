const userManagementFeatures = {
  group: {
    name: 'User Management',
    code: 'user',
    order: 10,
    icon: 'cilPerson',
  },
  features: [
    {
      name: 'Manage Users',
      key: 'user.manage',
      order: 2,
      description: 'Manage tenant users and roles',
      path: '/users',
      showInMenu: true,
    },
  ],
}

export default userManagementFeatures
