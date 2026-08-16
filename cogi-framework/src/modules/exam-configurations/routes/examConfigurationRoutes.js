import ExamConfigurationsPage from '../pages/ExamConfigurationsPage'
import ExamComponentDetailPage from '../pages/ExamComponentDetailPage'
import ExamProgramDetailPage from '../pages/ExamProgramDetailPage'
import OutcomeStandardDetailPage from '../pages/OutcomeStandardDetailPage'
import ExamSubjectDetailPage from '../pages/ExamSubjectDetailPage'
import ExamConfigurationPlaceholderDetailPage from '../pages/ExamConfigurationPlaceholderDetailPage'

const EXAM_CONFIGURATION_FEATURE_KEYS = ['exam-round.manage', 'exam-round.approve']

const examConfigurationRoutes = [
  {
    path: '/exam-configurations',
    title: 'Cấu hình thi chuẩn đầu ra',
    featureKeys: EXAM_CONFIGURATION_FEATURE_KEYS,
    component: ExamConfigurationsPage,
  },
  {
    path: '/exam-configurations/components',
    title: 'Cấu hình thi chuẩn đầu ra - Kỹ năng thi',
    featureKeys: EXAM_CONFIGURATION_FEATURE_KEYS,
    component: ExamConfigurationsPage,
  },
  {
    path: '/exam-configurations/components/:id',
    title: 'Cấu hình thi chuẩn đầu ra - Chi tiết kỹ năng thi',
    featureKeys: EXAM_CONFIGURATION_FEATURE_KEYS,
    component: ExamComponentDetailPage,
  },
  {
    path: '/exam-configurations/subjects',
    title: 'Cấu hình thi chuẩn đầu ra - Môn thi',
    featureKeys: EXAM_CONFIGURATION_FEATURE_KEYS,
    component: ExamConfigurationsPage,
  },
  {
    path: '/exam-configurations/subjects/:id',
    title: 'Cấu hình thi chuẩn đầu ra - Chi tiết môn thi',
    featureKeys: EXAM_CONFIGURATION_FEATURE_KEYS,
    component: ExamSubjectDetailPage,
  },
  {
    path: '/exam-configurations/programs',
    title: 'Cấu hình thi chuẩn đầu ra - Chương trình thi',
    featureKeys: EXAM_CONFIGURATION_FEATURE_KEYS,
    component: ExamConfigurationsPage,
  },
  {
    path: '/exam-configurations/programs/:id',
    title: 'Cấu hình thi chuẩn đầu ra - Chi tiết chương trình thi',
    featureKeys: EXAM_CONFIGURATION_FEATURE_KEYS,
    component: ExamProgramDetailPage,
  },
  {
    path: '/exam-configurations/outcomes',
    title: 'Cấu hình thi chuẩn đầu ra - Chuẩn đầu ra',
    featureKeys: EXAM_CONFIGURATION_FEATURE_KEYS,
    component: ExamConfigurationsPage,
  },
  {
    path: '/exam-configurations/outcomes/:id',
    title: 'Cấu hình thi chuẩn đầu ra - Chi tiết chuẩn đầu ra',
    featureKeys: EXAM_CONFIGURATION_FEATURE_KEYS,
    component: OutcomeStandardDetailPage,
  },
]

export default examConfigurationRoutes