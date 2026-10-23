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
      description: 'Quyền quản trị Storage Manager: xem thống kê, duyệt FileAsset, xóa/khôi phục file ở tenant',
      path: '/tenant/storage',
      showInMenu: true,
    },
  ],
}

export default storageFeatures