import RegistrationCampaignsPage from '../pages/RegistrationCampaignsPage'
import RegistrationCampaignDetailPage from '../pages/RegistrationCampaignDetailPage'

const registrationCampaignRoutes = [
  {
    path: '/registration-campaigns',
    title: 'Chiến dịch đăng ký',
    featureKey: 'registration-campaign.manage',
    component: RegistrationCampaignsPage,
  },
  {
    path: '/registration-campaigns/:id',
    title: 'Chi tiết chiến dịch đăng ký',
    featureKey: 'registration-campaign.manage',
    component: RegistrationCampaignDetailPage,
  },
  {
    path: '/registration-campaigns/:id/overview',
    title: 'Chi tiết chiến dịch đăng ký - Tổng quan',
    featureKey: 'registration-campaign.manage',
    component: RegistrationCampaignDetailPage,
  },
  {
    path: '/registration-campaigns/:id/config',
    title: 'Chi tiết chiến dịch đăng ký - Cấu hình',
    featureKey: 'registration-campaign.manage',
    component: RegistrationCampaignDetailPage,
  },
  {
    path: '/registration-campaigns/:id/form',
    title: 'Chi tiết chiến dịch đăng ký - Biểu mẫu',
    featureKey: 'registration-campaign.manage',
    component: RegistrationCampaignDetailPage,
  },
  {
    path: '/registration-campaigns/:id/registrations',
    title: 'Chi tiết chiến dịch đăng ký - Người đăng ký',
    featureKey: 'registration-campaign.manage',
    component: RegistrationCampaignDetailPage,
  },
  {
    path: '/registration-campaigns/:id/emails',
    title: 'Chi tiết chiến dịch đăng ký - Email',
    featureKey: 'registration-campaign.manage',
    component: RegistrationCampaignDetailPage,
  },
  {
    path: '/registration-campaigns/:id/public-page',
    title: 'Chi tiết chiến dịch đăng ký - Trang public',
    featureKey: 'registration-campaign.manage',
    component: RegistrationCampaignDetailPage,
  },
]

export default registrationCampaignRoutes