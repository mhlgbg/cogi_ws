import FeeSheetListPage from '../pages/FeeSheetListPage'
import FeeSheetDetailPage from '../pages/FeeSheetDetailPage'
import FeeSheetClassDetailPage from '../pages/FeeSheetClassDetailPage'
import FeeItemManagementPage from '../pages/FeeItemManagementPage'
import PaymentTrackingPage from '../pages/PaymentTrackingPage'
import PaymentTrackingDetailPage from '../pages/PaymentTrackingDetailPage'
import MyFeeSheetClassListPage from '../pages/MyFeeSheetClassListPage'
import MyFeeSheetClassDetailPage from '../pages/MyFeeSheetClassDetailPage'

const feeSheetManagementRoutes = [
  {
    path: '/fee-sheets',
    title: 'Phiếu thu',
    featureKey: 'fee-sheet.manage',
    component: FeeSheetListPage,
  },
  {
    path: '/fee-sheets/:id',
    title: 'Chi tiết phiếu thu',
    featureKey: 'fee-sheet.manage',
    component: FeeSheetDetailPage,
  },
  {
    path: '/fee-items',
    title: 'Khoản phí',
    featureKey: 'fee-sheet.manage',
    component: FeeItemManagementPage,
  },
  {
    path: '/fee-sheet-classes/:id',
    title: 'Chi tiết lớp thu phí',
    featureKey: 'fee-sheet.manage',
    component: FeeSheetClassDetailPage,
  },
  {
    path: '/payment-tracking',
    title: 'Theo dõi thanh toán',
    featureKey: 'fee-sheet.payment-tracking',
    component: PaymentTrackingPage,
  },
  {
    path: '/payment-tracking/:id',
    title: 'Chi tiết thanh toán',
    featureKey: 'fee-sheet.payment-tracking',
    component: PaymentTrackingDetailPage,
  },
  {
    path: '/my-fee-sheet-classes',
    title: 'Lớp phí của tôi',
    featureKey: 'fee-sheet.teacher-manage',
    component: MyFeeSheetClassListPage,
  },
  {
    path: '/my-fee-sheet-classes/:id',
    title: 'Chi tiết lớp phí của tôi',
    featureKey: 'fee-sheet.teacher-manage',
    component: MyFeeSheetClassDetailPage,
  },
]

export default feeSheetManagementRoutes