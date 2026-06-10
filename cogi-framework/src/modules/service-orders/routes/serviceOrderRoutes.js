import ServiceOrderListPage from '../pages/ServiceOrderListPage'
import ServiceOrderDetailPage from '../pages/ServiceOrderDetailPage'
import ServiceOrderFormPage from '../pages/ServiceOrderFormPage'
import ServiceItemManagementPage from '../pages/ServiceItemManagementPage'
import ServiceCategoryManagementPage from '../pages/ServiceCategoryManagementPage'

const serviceOrderRoutes = [
  {
    path: '/service-orders',
    title: 'Đơn dịch vụ',
    featureKey: 'service-orders',
    component: ServiceOrderListPage,
  },
  {
    path: '/service-orders/new',
    title: 'Tạo đơn dịch vụ',
    featureKey: 'service-orders',
    component: ServiceOrderFormPage,
  },
  {
    path: '/service-orders/:id',
    title: 'Chi tiết đơn dịch vụ',
    featureKey: 'service-orders',
    component: ServiceOrderDetailPage,
  },
  {
    path: '/service-orders/:id/edit',
    title: 'Cập nhật đơn dịch vụ',
    featureKey: 'service-orders',
    component: ServiceOrderFormPage,
  },
  {
    path: '/service-items',
    title: 'Dịch vụ',
    featureKey: 'service-items.manage',
    component: ServiceItemManagementPage,
  },
  {
    path: '/service-categories',
    title: 'Danh mục dịch vụ',
    featureKey: 'service-categories.manage',
    component: ServiceCategoryManagementPage,
  },
]

export default serviceOrderRoutes
