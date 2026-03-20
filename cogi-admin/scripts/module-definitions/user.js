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
  ],
};
