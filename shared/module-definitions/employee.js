'use strict';

module.exports = {
  group: {
    name: 'Employee',
    code: 'employee',
    order: 7,
    icon: 'cilPeople',
  },
  features: [
    {
      name: 'Employee Management',
      key: 'employee.manage',
      order: 1,
      description: 'Employee management module',
      path: '/employees',
      icon: 'cilPeople',
      showInMenu: true,
    },
  ],
};
