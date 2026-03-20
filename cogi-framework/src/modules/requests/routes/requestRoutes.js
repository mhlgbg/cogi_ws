import RequestCategoriesPage from '../pages/RequestCategoriesPage'
import RequestDetailPage from '../pages/RequestDetailPage'
import RequestFormPage from '../pages/RequestFormPage'
import RequestListPage from '../pages/RequestListPage'
import RequestMonitorDetailPage from '../pages/RequestMonitorDetailPage'
import RequestMonitorPage from '../pages/RequestMonitorPage'

const requestRoutes = [
  {
    path: '/requests',
    featureKey: 'request.list',
    component: RequestListPage,
  },
  {
    path: '/requests/new',
    featureKey: 'request.create',
    component: RequestFormPage,
  },
  {
    path: '/requests/:id',
    featureKey: 'request.list',
    component: RequestDetailPage,
  },
  {
    path: '/requests/:id/edit',
    featureKey: 'request.create',
    component: RequestFormPage,
  },
  {
    path: '/requests/monitor',
    featureKey: 'request.monitor',
    component: RequestMonitorPage,
  },
  {
    path: '/requests/monitor/:id',
    featureKey: 'request.monitor',
    component: RequestMonitorDetailPage,
  },
  {
    path: '/request-categories',
    featureKey: 'request.category.manage',
    component: RequestCategoriesPage,
  },
]

export default requestRoutes
