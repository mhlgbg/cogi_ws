import AssessmentCampaignListPage from '../pages/AssessmentCampaignListPage'
import AssessmentCampaignDetailPage from '../pages/AssessmentCampaignDetailPage'

const assessmentCampaignRoutes = [
  {
    path: '/assessment-campaigns',
    title: 'Chiến dịch đánh giá',
    featureKey: 'assessment-campaign.manage',
    component: AssessmentCampaignListPage,
  },
  {
    path: '/assessment-campaigns/:id',
    title: 'Chi tiết chiến dịch đánh giá',
    featureKey: 'assessment-campaign.manage',
    component: AssessmentCampaignDetailPage,
  },
]

export default assessmentCampaignRoutes