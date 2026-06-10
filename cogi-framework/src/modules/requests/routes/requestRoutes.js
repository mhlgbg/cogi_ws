import RequestCategoriesPage from '../pages/RequestCategoriesPage'
import RequestDetailPage from '../pages/RequestDetailPage'
import RequestFormPage from '../pages/RequestFormPage'
import RequestListPage from '../pages/RequestListPage'
import RequestMonitorDetailPage from '../pages/RequestMonitorDetailPage'
import RequestMonitorPage from '../pages/RequestMonitorPage'

const requestRoutes = [
  {
    path: '/requests',
    title: 'Yêu cầu',
    featureKey: 'request.list',
    component: RequestListPage,
  },
  {
    path: '/requests/new',
    title: 'Tạo yêu cầu',
    featureKey: 'request.create',
    component: RequestFormPage,
  },
  {
    path: '/requests/:id',
    title: 'Chi tiết yêu cầu',
    featureKey: 'request.list',
    component: RequestDetailPage,
  },
  {
    path: '/requests/:id/edit',
    title: 'Cập nhật yêu cầu',
    featureKey: 'request.create',
    component: RequestFormPage,
  },
  {
    path: '/requests/monitor',
    title: 'Theo dõi yêu cầu',
    featureKey: 'request.monitor',
    component: RequestMonitorPage,
  },
  {
    path: '/requests/monitor/:id',
    title: 'Chi tiết theo dõi yêu cầu',
    featureKey: 'request.monitor',
    component: RequestMonitorDetailPage,
  },
  {
    path: '/request-categories',
    title: 'Danh mục yêu cầu',
    featureKey: 'request.category.manage',
    component: RequestCategoriesPage,
  },
]

export default requestRoutes
