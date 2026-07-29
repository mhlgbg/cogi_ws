'use strict';

module.exports = {
  group: {
    name: 'Registration Campaign',
    code: 'registration-campaign',
    order: 92,
    icon: 'cilUserPlus',
  },
  features: [
    {
      name: 'Registration Campaign Management',
      key: 'registration-campaign.manage',
      order: 1,
      description: 'Manage tenant registration campaigns and registrations',
      path: '/registration-campaigns',
      icon: 'cilUserPlus',
      showInMenu: true,
    },
  ],
};