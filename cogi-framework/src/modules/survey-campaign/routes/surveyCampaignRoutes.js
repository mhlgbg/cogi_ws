import CampaignDetail from '../pages/CampaignDetail'
import CampaignForm from '../pages/CampaignForm'
import CampaignList from '../pages/CampaignList'
import MyManagedCampaignDetail from '../pages/MyManagedCampaignDetail'
import MyManagedCampaignList from '../pages/MyManagedCampaignList'

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
  {
    path: '/survey/my-campaigns',
    title: 'Chiến dịch khảo sát tôi quản lý',
    featureKey: 'survey.campaign.management',
    component: MyManagedCampaignList,
  },
  {
    path: '/survey/my-campaigns/:id',
    title: 'Chi tiết chiến dịch khảo sát tôi quản lý',
    featureKey: 'survey.campaign.management',
    component: MyManagedCampaignDetail,
  },
]

export default surveyCampaignRoutes