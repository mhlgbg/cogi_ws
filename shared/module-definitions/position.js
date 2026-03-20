'use strict';

module.exports = {
  group: {
    name: 'Position',
    code: 'position',
    order: 6,
    icon: 'cilBriefcase',
  },
  features: [
    {
      name: 'Position Management',
      key: 'position.manage',
      order: 1,
      description: 'Position management module',
      path: '/positions',
      icon: 'cilBriefcase',
      showInMenu: true,
    },
  ],
};
