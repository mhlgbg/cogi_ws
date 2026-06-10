import CrmHome from "../pages/CrmHome";
import LeadCampaignManagementPage from '../pages/LeadCampaignManagementPage'
import ChatSessionManagerPage from '../pages/ChatSessionManagerPage'

const crmRoutes = [
  {
    path: "/crms",
    title: 'CRM',
    featureKey: "crms.home",
    component: CrmHome,
  },
  {
    path: '/crms/lead-campaigns',
    title: 'Chiến dịch lead',
    featureKey: 'crms.lead-campaign.manage',
    component: LeadCampaignManagementPage,
  },
  {
    path: '/chat-sessions',
    title: 'Hội thoại khách hàng',
    featureKey: 'crms.chat-session.manage',
    component: ChatSessionManagerPage,
  },
];

export default crmRoutes;
