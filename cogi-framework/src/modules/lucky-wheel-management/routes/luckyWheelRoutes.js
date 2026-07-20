import LuckyWheelListPage from '../pages/LuckyWheelListPage'
import LuckyWheelCreatePage from '../pages/LuckyWheelCreatePage'
import LuckyWheelDetailPage from '../pages/LuckyWheelDetailPage'

const luckyWheelRoutes = [
  { path: '/lucky-wheels', title: 'Vòng quay may mắn', featureKey: 'lucky-wheel.manage', component: LuckyWheelListPage },
  { path: '/lucky-wheels/create', title: 'Tạo vòng quay', featureKey: 'lucky-wheel.manage', component: LuckyWheelCreatePage },
  { path: '/lucky-wheels/:id', title: 'Chi tiết vòng quay', featureKey: 'lucky-wheel.manage', component: LuckyWheelDetailPage },
  { path: '/lucky-wheels/:id/prizes', title: 'Chi tiết vòng quay - Phần thưởng', featureKey: 'lucky-wheel.manage', component: LuckyWheelDetailPage },
  { path: '/lucky-wheels/:id/participants', title: 'Chi tiết vòng quay - Người tham gia', featureKey: 'lucky-wheel.manage', component: LuckyWheelDetailPage },
  { path: '/lucky-wheels/:id/settings', title: 'Chi tiết vòng quay - Cấu hình', featureKey: 'lucky-wheel.manage', component: LuckyWheelDetailPage },
  { path: '/lucky-wheels/:id/spins', title: 'Chi tiết vòng quay - Kết quả', featureKey: 'lucky-wheel.manage', component: LuckyWheelDetailPage },
  { path: '/lucky-wheels/:id/results', title: 'Chi tiết vòng quay - Kết quả', featureKey: 'lucky-wheel.manage', component: LuckyWheelDetailPage },
  { path: '/lucky-wheels/:id/slides', title: 'Chi tiết vòng quay - Trình chiếu', featureKey: 'lucky-wheel.manage', component: LuckyWheelDetailPage },
]

export default luckyWheelRoutes
