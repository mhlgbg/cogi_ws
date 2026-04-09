import CampaignDetail from '../pages/CampaignDetail'
import CampaignForm from '../pages/CampaignForm'
import CampaignList from '../pages/CampaignList'

const surveyCampaignRoutes = [
  {
    path: '/survey/campaigns',
    featureKey: 'survey.campaign.manage',
    component: CampaignList,
  },
  {
    path: '/survey/campaigns/create',
    featureKey: 'survey.campaign.manage',
    component: CampaignForm,
  },
  {
    path: '/survey/campaigns/:id',
    featureKey: 'survey.campaign.manage',
    component: CampaignDetail,
  },
]

export default surveyCampaignRoutes