'use strict';

module.exports = {
  group: {
    name: 'Department',
    code: 'department',
    order: 5,
    icon: 'cilBuilding',
  },
  features: [
    {
      name: 'Department Management',
      key: 'department.manage',
      order: 1,
      description: 'Department management module',
      path: '/departments',
      icon: 'cilBuilding',
      showInMenu: true,
    },
  ],
};
