import ServiceOrderListPage from '../pages/ServiceOrderListPage'
import ServiceOrderDetailPage from '../pages/ServiceOrderDetailPage'
import ServiceOrderFormPage from '../pages/ServiceOrderFormPage'
import ServiceItemManagementPage from '../pages/ServiceItemManagementPage'
import ServiceCategoryManagementPage from '../pages/ServiceCategoryManagementPage'

const serviceOrderRoutes = [
  {
    path: '/service-orders',
    featureKey: 'service-orders',
    component: ServiceOrderListPage,
  },
  {
    path: '/service-orders/new',
    featureKey: 'service-orders',
    component: ServiceOrderFormPage,
  },
  {
    path: '/service-orders/:id',
    featureKey: 'service-orders',
    component: ServiceOrderDetailPage,
  },
  {
    path: '/service-orders/:id/edit',
    featureKey: 'service-orders',
    component: ServiceOrderFormPage,
  },
  {
    path: '/service-items',
    featureKey: 'service-items.manage',
    component: ServiceItemManagementPage,
  },
  {
    path: '/service-categories',
    featureKey: 'service-categories.manage',
    component: ServiceCategoryManagementPage,
  },
]

export default serviceOrderRoutes
