import UserManagementPage from '../pages/UserManagementPage'

const userManagementRoutes = [
  {
    path: '/users',
    title: 'Người dùng',
    featureKey: 'user.manage',
    component: UserManagementPage,
  },
]

export default userManagementRoutes
