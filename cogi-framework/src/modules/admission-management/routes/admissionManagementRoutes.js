import AdmissionDashboard from '../../../pages/admission/AdmissionDashboard.jsx'
import AdmissionApplicationManagement from '../../../pages/admission/AdmissionApplicationManagement.jsx'
import AdmissionApplicationForm from '../../../pages/admission/AdmissionApplicationForm.jsx'
import AdmissionCampaignManagementPage from '../pages/AdmissionCampaignManagementPage'
import CandidateExamManagementPage from '../pages/CandidateExamManagementPage'
import AdmissionReviewDetailPage from '../pages/AdmissionReviewDetailPage'
import AdmissionReviewListPage from '../pages/AdmissionReviewListPage'
import FormTemplateManagementPage from '../pages/FormTemplateManagementPage'
import NotificationTemplateManagementPage from '../pages/NotificationTemplateManagementPage'

const admissionManagementRoutes = [
  {
    path: '/admission/dashboard',
    title: 'Dashboard tuyển sinh',
    featureKey: 'admission.dashboard.view',
    component: AdmissionDashboard,
  },
  {
    path: '/admission/my-applications',
    title: 'Hồ sơ của tôi',
    featureKey: 'admission.dashboard.view',
    component: AdmissionApplicationManagement,
  },
  {
    path: '/admission/applications/new/:campaignCode',
    title: 'Tạo hồ sơ',
    featureKey: 'admission.dashboard.view',
    component: AdmissionApplicationForm,
  },
  {
    path: '/admission/:campaignCode',
    title: 'Đăng ký tuyển sinh',
    featureKey: 'admission.dashboard.view',
    component: AdmissionApplicationForm,
  },
  {
    path: '/admission/applications/:id/edit',
    title: 'Cập nhật hồ sơ',
    featureKey: 'admission.dashboard.view',
    component: AdmissionApplicationForm,
  },
  {
    path: '/admission/applications/:id/view',
    title: 'Chi tiết hồ sơ',
    featureKey: 'admission.dashboard.view',
    component: AdmissionApplicationForm,
  },
  {
    path: '/admission/campaigns',
    title: 'Kỳ tuyển sinh',
    featureKey: 'admission.campaign.manage',
    component: AdmissionCampaignManagementPage,
  },
  {
    path: '/admission/form-templates',
    title: 'Mẫu biểu tuyển sinh',
    featureKey: 'admission.form-template.manage',
    component: FormTemplateManagementPage,
  },
  {
    path: '/admission/notification-templates',
    title: 'Mẫu thông báo tuyển sinh',
    featureKey: 'admission.notification-template.manage',
    component: NotificationTemplateManagementPage,
  },
  {
    path: '/admission/reviews',
    title: 'Duyệt hồ sơ',
    featureKey: 'admission.review.manage',
    component: AdmissionReviewListPage,
  },
  {
    path: '/admission/reviews/:id',
    title: 'Chi tiết hồ sơ',
    featureKey: 'admission.review.manage',
    component: AdmissionReviewDetailPage,
  },
  {
    path: '/admission/candidate-exams',
    title: 'Thẻ dự kiểm tra',
    featureKey: 'admission.candidate-exam.manage',
    component: CandidateExamManagementPage,
  },
]

export default admissionManagementRoutes