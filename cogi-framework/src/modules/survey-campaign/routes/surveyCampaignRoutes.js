import CampaignDetail from '../pages/CampaignDetail'
import CampaignForm from '../pages/CampaignForm'
import CampaignList from '../pages/CampaignList'

const surveyCampaignRoutes = [
  {
    path: '/survey/campaigns',
    title: 'Chiến dịch khảo sát',
    featureKey: 'survey.campaign.manage',
    component: CampaignList,
  },
  {
    path: '/survey/campaigns/create',
    title: 'Tạo chiến dịch khảo sát',
    featureKey: 'survey.campaign.manage',
    component: CampaignForm,
  },
  {
    path: '/survey/campaigns/:id',
    title: 'Chi tiết chiến dịch khảo sát',
    featureKey: 'survey.campaign.manage',
    component: CampaignDetail,
  },
]

export default surveyCampaignRoutes