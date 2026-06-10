import UserDuplicateCleanupPage from '../pages/UserDuplicateCleanupPage'

const userDuplicateCleanupRoutes = [
  {
    path: '/user-duplicate-cleanup',
    title: 'Dọn user trùng',
    featureKey: 'admin.userDuplicateCleanup.view',
    component: UserDuplicateCleanupPage,
  },
]

export default userDuplicateCleanupRoutes