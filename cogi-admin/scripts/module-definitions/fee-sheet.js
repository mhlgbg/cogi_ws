'use strict';

module.exports = {
  group: {
    name: 'Fee Sheet',
    code: 'fee-sheet',
    order: 15,
    icon: 'cilNotes',
  },
  features: [
    {
      name: 'FeeSheet Management',
      key: 'fee-sheet.manage',
      order: 1,
      description: 'Manage tenant fee sheets',
      path: '/fee-sheets',
      icon: 'cilNotes',
      showInMenu: true,
    },
    {
      name: 'My Class Fee Sheets',
      key: 'fee-sheet.teacher-manage',
      order: 2,
      description: 'Teachers manage their assigned class fee sheets',
      path: '/my-fee-sheet-classes',
      icon: 'cilSpreadsheet',
      showInMenu: true,
    },
    {
      name: 'Invoice Tracking',
      key: 'fee-sheet.payment-tracking',
      order: 4,
      description: 'Track tenant payments and collection details',
      path: '/payment-tracking',
      icon: 'cilMoney',
      showInMenu: true,
    },
  ],
};