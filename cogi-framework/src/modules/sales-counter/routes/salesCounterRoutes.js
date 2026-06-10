import SalesCounterPage from '../pages/SalesCounterPage'
import SalesCounterOrderDetailPage from '../pages/SalesCounterOrderDetailPage'

const salesCounterRoutes = [
  {
    path: '/sales-counters',
    title: 'Quầy bán hàng',
    featureKey: 'sales-counters.manage',
    component: SalesCounterPage,
  },
  {
    path: '/sales-counters/orders/:id',
    title: 'Chi tiết đơn quầy',
    featureKey: 'sales-counters.manage',
    component: SalesCounterOrderDetailPage,
  },
]

export default salesCounterRoutes
