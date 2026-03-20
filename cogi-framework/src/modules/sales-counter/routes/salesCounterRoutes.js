import SalesCounterPage from '../pages/SalesCounterPage'
import SalesCounterOrderDetailPage from '../pages/SalesCounterOrderDetailPage'

const salesCounterRoutes = [
  {
    path: '/sales-counters',
    featureKey: 'sales-counters.manage',
    component: SalesCounterPage,
  },
  {
    path: '/sales-counters/orders/:id',
    featureKey: 'sales-counters.manage',
    component: SalesCounterOrderDetailPage,
  },
]

export default salesCounterRoutes
