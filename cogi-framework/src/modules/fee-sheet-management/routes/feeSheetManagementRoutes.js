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
    featureKey: 'fee-sheet.manage',
    component: FeeSheetListPage,
  },
  {
    path: '/fee-sheets/:id',
    featureKey: 'fee-sheet.manage',
    component: FeeSheetDetailPage,
  },
  {
    path: '/fee-items',
    featureKey: 'fee-sheet.manage',
    component: FeeItemManagementPage,
  },
  {
    path: '/fee-sheet-classes/:id',
    featureKey: 'fee-sheet.manage',
    component: FeeSheetClassDetailPage,
  },
  {
    path: '/payment-tracking',
    featureKey: 'fee-sheet.payment-tracking',
    component: PaymentTrackingPage,
  },
  {
    path: '/payment-tracking/:id',
    featureKey: 'fee-sheet.payment-tracking',
    component: PaymentTrackingDetailPage,
  },
  {
    path: '/my-fee-sheet-classes',
    featureKey: 'fee-sheet.teacher-manage',
    component: MyFeeSheetClassListPage,
  },
  {
    path: '/my-fee-sheet-classes/:id',
    featureKey: 'fee-sheet.teacher-manage',
    component: MyFeeSheetClassDetailPage,
  },
]

export default feeSheetManagementRoutes