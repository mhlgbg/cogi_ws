import AssessmentListPage from '../pages/AssessmentListPage'
import AssessmentDetailPage from '../pages/AssessmentDetailPage'
import AssessmentResultDetailPage from '../pages/AssessmentResultDetailPage'
import AssessmentResultListPage from '../pages/AssessmentResultListPage'
import AssessmentRunnerPage from '../pages/AssessmentRunnerPage'
import AssessmentRunnerStartPage from '../pages/AssessmentRunnerStartPage'

const assessmentRoutes = [
  {
    path: '/assessments',
    title: 'Ngân hàng đề',
    featureKey: 'learning.assessment.manage',
    component: AssessmentListPage,
  },
  {
    path: '/assessments/:id',
    title: 'Chi tiết ngân hàng đề',
    featureKey: 'learning.assessment.manage',
    component: AssessmentDetailPage,
  },
  {
    path: '/assessment-results',
    title: 'Kết quả đánh giá',
    featureKey: 'learning.assessment.manage',
    component: AssessmentResultListPage,
  },
  {
    path: '/assessment-results/:id',
    title: 'Chi tiết kết quả đánh giá',
    featureKey: 'learning.assessment.manage',
    component: AssessmentResultDetailPage,
  },
  {
    path: '/assessment-runner/start/:versionId',
    title: 'Bắt đầu làm bài assessment',
    featureKey: 'learning.assessment.manage',
    component: AssessmentRunnerStartPage,
  },
  {
    path: '/assessment-runner/:attemptId',
    title: 'Assessment Runner',
    featureKey: 'learning.assessment.manage',
    component: AssessmentRunnerPage,
  },
]

export default assessmentRoutes
