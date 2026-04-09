import AdmissionDashboard from '../../../pages/admission/AdmissionDashboard.jsx'
import AdmissionApplicationManagement from '../../../pages/admission/AdmissionApplicationManagement.jsx'
import AdmissionApplicationForm from '../../../pages/admission/AdmissionApplicationForm.jsx'
import AdmissionCampaignManagementPage from '../pages/AdmissionCampaignManagementPage'
import AdmissionReviewDetailPage from '../pages/AdmissionReviewDetailPage'
import AdmissionReviewListPage from '../pages/AdmissionReviewListPage'
import FormTemplateManagementPage from '../pages/FormTemplateManagementPage'
import NotificationTemplateManagementPage from '../pages/NotificationTemplateManagementPage'

const admissionManagementRoutes = [
  {
    path: '/admission/dashboard',
    featureKey: 'admission.dashboard.view',
    component: AdmissionDashboard,
  },
  {
    path: '/admission/my-applications',
    featureKey: 'admission.dashboard.view',
    component: AdmissionApplicationManagement,
  },
  {
    path: '/admission/applications/new/:campaignCode',
    featureKey: 'admission.dashboard.view',
    component: AdmissionApplicationForm,
  },
  {
    path: '/admission/:campaignCode',
    featureKey: 'admission.dashboard.view',
    component: AdmissionApplicationForm,
  },
  {
    path: '/admission/applications/:id/edit',
    featureKey: 'admission.dashboard.view',
    component: AdmissionApplicationForm,
  },
  {
    path: '/admission/applications/:id/view',
    featureKey: 'admission.dashboard.view',
    component: AdmissionApplicationForm,
  },
  {
    path: '/admission/campaigns',
    featureKey: 'admission.campaign.manage',
    component: AdmissionCampaignManagementPage,
  },
  {
    path: '/admission/form-templates',
    featureKey: 'admission.form-template.manage',
    component: FormTemplateManagementPage,
  },
  {
    path: '/admission/notification-templates',
    featureKey: 'admission.notification-template.manage',
    component: NotificationTemplateManagementPage,
  },
  {
    path: '/admission/reviews',
    featureKey: 'admission.review.manage',
    component: AdmissionReviewListPage,
  },
  {
    path: '/admission/reviews/:id',
    featureKey: 'admission.review.manage',
    component: AdmissionReviewDetailPage,
  },
]

export default admissionManagementRoutes