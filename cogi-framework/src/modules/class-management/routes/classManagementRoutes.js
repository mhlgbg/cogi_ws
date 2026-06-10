import ClassManagementPage from '../pages/ClassManagementPage'
import ClassDetailPage from '../pages/ClassDetailPage'

const classManagementRoutes = [
  {
    path: '/classes',
    title: 'Lớp học',
    featureKey: 'class.manage',
    component: ClassManagementPage,
  },
  {
    path: '/classes/:id',
    title: 'Chi tiết lớp học',
    featureKey: 'class.manage',
    component: ClassDetailPage,
  },
]

export default classManagementRoutes