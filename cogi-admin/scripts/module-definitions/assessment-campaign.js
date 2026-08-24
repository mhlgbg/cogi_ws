'use strict';

module.exports = {
  group: {
    name: 'Assessment Campaign',
    code: 'assessment-campaign',
    order: 91,
    icon: 'cilBullhorn',
  },
  features: [
    {
      name: 'Assessment Campaign Management',
      key: 'assessment-campaign.manage',
      order: 1,
      description: 'Manage tenant assessment campaigns, collection fields, assessment rules, and participations',
      path: '/assessment-campaigns',
      icon: 'cilBullhorn',
      showInMenu: true,
    },
  ],
};