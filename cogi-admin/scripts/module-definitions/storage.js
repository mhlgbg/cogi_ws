'use strict';

module.exports = {
  group: {
    name: 'Storage',
    code: 'storage',
    order: 13,
    icon: 'cilStorage',
  },
  features: [
    {
      name: 'Tenant Storage Manager',
      key: 'storage.manage',
      order: 1,
      description: 'View tenant storage usage, manage FileAsset metadata, and upload test files',
      path: '',
      icon: 'cilStorage',
      showInMenu: true,
    },
  ],
};