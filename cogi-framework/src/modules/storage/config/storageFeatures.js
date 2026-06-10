const storageFeatures = {
  group: {
    name: 'Storage',
    code: 'storage',
    order: 13,
    icon: 'cilStorage',
  },
  features: [
    {
      name: 'Quan ly luu tru',
      key: 'storage.manage',
      order: 1,
      description: 'Tenant quan ly dung luong storage va FileAsset cua minh',
      path: '/tenant/storage',
      showInMenu: true,
    },
  ],
}

export default storageFeatures