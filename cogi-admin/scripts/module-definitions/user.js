'use strict';

module.exports = {
  group: {
    name: 'User Management',
    code: 'user',
    order: 10,
    icon: 'cilPerson',
  },
  features: [
    {
      name: 'Invite User',
      key: 'user.invite',
      order: 1,
      description: 'Invite users to tenant',
      path: '/invite-user',
      icon: 'cilUserPlus',
      showInMenu: true,
    },
    {
      name: 'Manage Users',
      key: 'user.manage',
      order: 2,
      description: 'Manage tenant users and roles',
      path: '/users',
      icon: 'cilPeople',
      showInMenu: true,
    },
    {
      name: 'Dọn user trùng',
      key: 'admin.userDuplicateCleanup.view',
      order: 3,
      description: 'Rà soát user trùng theo tenant hiện tại',
      path: '/user-duplicate-cleanup',
      icon: 'cilFilterX',
      showInMenu: true,
    },
    {
      name: 'Cleanup user trùng',
      key: 'admin.userDuplicateCleanup.cleanup',
      order: 4,
      description: 'Cho phép cleanup user trùng theo tenant hiện tại',
      path: '/user-duplicate-cleanup',
      icon: 'cilTrash',
      showInMenu: false,
    },
  ],
};
