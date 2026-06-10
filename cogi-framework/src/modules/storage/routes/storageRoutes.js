import TenantStorageManagerPage from '../pages/TenantStorageManagerPage'

const storageRoutes = [
  {
    path: '/tenant/storage',
    title: 'Quản lý lưu trữ',
    featureKey: 'storage.manage',
    component: TenantStorageManagerPage,
  },
]

export default storageRoutes