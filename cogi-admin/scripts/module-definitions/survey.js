'use strict';

module.exports = {
  group: {
    name: 'Survey',
    code: 'survey',
    order: 12,
    icon: 'cilDescription',
  },
  features: [
    {
      name: 'Survey List',
      key: 'survey.list',
      order: 1,
      description: 'End-user survey assignments and submission flow',
      path: '/survey',
      icon: 'cilDescription',
      showInMenu: true,
    },
  ],
};