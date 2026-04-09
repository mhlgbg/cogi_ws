import ClassManagementPage from '../pages/ClassManagementPage'
import ClassDetailPage from '../pages/ClassDetailPage'

const classManagementRoutes = [
  {
    path: '/classes',
    featureKey: 'class.manage',
    component: ClassManagementPage,
  },
  {
    path: '/classes/:id',
    featureKey: 'class.manage',
    component: ClassDetailPage,
  },
]

export default classManagementRoutes