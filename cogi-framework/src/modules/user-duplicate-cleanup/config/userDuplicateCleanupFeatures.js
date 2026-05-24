const userDuplicateCleanupFeatures = {
  group: {
    name: 'User Management',
    code: 'user',
    order: 10,
    icon: 'cilPerson',
  },
  features: [
    {
      name: 'Dọn user trùng',
      key: 'admin.userDuplicateCleanup.view',
      order: 3,
      description: 'Rà soát và dọn user trùng theo tenant hiện tại',
      path: '/user-duplicate-cleanup',
      showInMenu: true,
    },
    {
      name: 'Dọn user trùng',
      key: 'admin.userDuplicateCleanup.cleanup',
      order: 4,
      description: 'Cho phép dọn user trùng theo tenant hiện tại',
      path: '/user-duplicate-cleanup',
      showInMenu: false,
    },
  ],
}

export default userDuplicateCleanupFeatures