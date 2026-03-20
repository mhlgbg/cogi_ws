import ServiceOrderListPage from '../pages/ServiceOrderListPage'
import ServiceOrderDetailPage from '../pages/ServiceOrderDetailPage'
import ServiceOrderFormPage from '../pages/ServiceOrderFormPage'

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
]

export default serviceOrderRoutes
