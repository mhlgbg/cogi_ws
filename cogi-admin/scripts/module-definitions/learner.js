'use strict';

module.exports = {
  group: {
    name: 'Learner',
    code: 'learner',
    order: 14,
    icon: 'cilUserPlus',
  },
  features: [
    {
      name: 'Learner Management',
      key: 'learner.manage',
      order: 1,
      description: 'Manage tenant learners',
      path: '/learners',
      icon: 'cilUserPlus',
      showInMenu: true,
    },
  ],
};