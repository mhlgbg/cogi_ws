const feeSheetManagementFeatures = {
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
      showInMenu: true,
    },
    {
      name: 'My Class Fee Sheets',
      key: 'fee-sheet.teacher-manage',
      order: 2,
      description: 'Teachers manage their assigned class fee sheets',
      path: '/my-fee-sheet-classes',
      showInMenu: true,
    },
    {
      name: 'Fee Items',
      key: 'fee-sheet.manage',
      order: 3,
      description: 'Browse tenant fee items by fee sheet',
      path: '/fee-items',
      showInMenu: true,
    },
    {
      name: 'Invoice Tracking',
      key: 'fee-sheet.payment-tracking',
      order: 4,
      description: 'Track tenant payments and collection details',
      path: '/payment-tracking',
      showInMenu: true,
    },
  ],
}

export default feeSheetManagementFeatures