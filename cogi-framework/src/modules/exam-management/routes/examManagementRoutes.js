import ExamRoundListPage from '../pages/ExamRoundListPage'
import ExamRoundCreatePage from '../pages/ExamRoundCreatePage'
import ExamRoundDetailPage from '../pages/ExamRoundDetailPage'
import LearnerExamDetailPage from '../pages/LearnerExamDetailPage'
import LearnerExamListPage from '../pages/LearnerExamListPage'
import LearnerExamRegisterProfilePlaceholderPage from '../pages/LearnerExamRegisterProfilePlaceholderPage'
import LearnerExamRegistrationPage from '../pages/LearnerExamRegistrationPage'
import LearnerExamRegistrationDetailPage from '../pages/LearnerExamRegistrationDetailPage'

const DETAIL_FEATURE_KEYS = ['exam-round.manage', 'exam-round.approve']
const LEARNER_FEATURE_KEY = 'exam-registration.self'

const examManagementRoutes = [
  {
    path: '/exam-rounds',
    title: 'Đợt thi chuẩn đầu ra',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundListPage,
  },
  {
    path: '/exam-rounds/new',
    title: 'Tạo đợt thi chuẩn đầu ra',
    featureKey: 'exam-round.manage',
    component: ExamRoundCreatePage,
  },
  {
    path: '/learner/exams',
    title: 'Đăng ký dự thi',
    featureKey: LEARNER_FEATURE_KEY,
    component: LearnerExamListPage,
  },
  {
    path: '/learner/exams/:id',
    title: 'Chi tiết đợt thi cho learner',
    featureKey: LEARNER_FEATURE_KEY,
    component: LearnerExamDetailPage,
  },
  {
    path: '/learner/exams/:id/register',
    title: 'Đăng ký dự thi',
    featureKey: LEARNER_FEATURE_KEY,
    component: LearnerExamRegistrationPage,
  },
  {
    path: '/learner/exams/:id/register/profile',
    title: 'Khai thông tin người học và đăng ký - Placeholder',
    featureKey: LEARNER_FEATURE_KEY,
    component: LearnerExamRegisterProfilePlaceholderPage,
  },
  {
    path: '/learner/exam-registrations/:id',
    title: 'Hồ sơ đăng ký dự thi',
    featureKey: LEARNER_FEATURE_KEY,
    component: LearnerExamRegistrationDetailPage,
  },
  {
    path: '/exam-rounds/:id',
    title: 'Chi tiết đợt thi chuẩn đầu ra',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/overview',
    title: 'Đợt thi chuẩn đầu ra - Tổng quan',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/configuration',
    title: 'Đợt thi chuẩn đầu ra - Cấu hình',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/structure',
    title: 'Đợt thi chuẩn đầu ra - Cấu trúc',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/eligibilities',
    title: 'Đợt thi chuẩn đầu ra - Điều kiện dự thi',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/registrations',
    title: 'Đợt thi chuẩn đầu ra - Đăng ký dự thi',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/payments',
    title: 'Đợt thi chuẩn đầu ra - Thanh toán',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/reviews',
    title: 'Đợt thi chuẩn đầu ra - Xét duyệt đăng ký',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/venues-rooms',
    title: 'Đợt thi chuẩn đầu ra - Địa điểm và phòng thi',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/schedules',
    title: 'Đợt thi chuẩn đầu ra - Lịch thi',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/allocation',
    title: 'Đợt thi chuẩn đầu ra - Phân bổ thí sinh',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/candidate-lists',
    title: 'Đợt thi chuẩn đầu ra - Danh sách thi',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/attendance',
    title: 'Đợt thi chuẩn đầu ra - Điểm danh',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
  {
    path: '/exam-rounds/:id/activity',
    title: 'Đợt thi chuẩn đầu ra - Nhật ký hoạt động',
    featureKeys: DETAIL_FEATURE_KEYS,
    component: ExamRoundDetailPage,
  },
]

export default examManagementRoutes