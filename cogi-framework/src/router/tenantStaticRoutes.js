import Dashboard from '../pages/Dashboard'
import ChangePassword from '../pages/ChangePassword'
import Forbidden from '../pages/Forbidden'

export const tenantStaticRoutes = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    featureKey: 'dashboard.view',
    component: Dashboard,
  },
  {
    path: '/change-password',
    title: 'Đổi mật khẩu',
    component: ChangePassword,
  },
  {
    path: '/forbidden',
    title: 'Không có quyền truy cập',
    component: Forbidden,
  },
]