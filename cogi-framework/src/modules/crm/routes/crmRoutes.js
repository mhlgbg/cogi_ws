import CrmHome from "../pages/CrmHome";
import LeadCampaignManagementPage from '../pages/LeadCampaignManagementPage'
import ChatSessionManagerPage from '../pages/ChatSessionManagerPage'
import AiAssistantSettingPage from '../pages/AiAssistantSettingPage'
import AiKnowledgeManagerPage from '../pages/AiKnowledgeManagerPage'

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
  {
    path: '/ai/assistant',
    title: 'Cấu hình trợ lý AI',
    featureKey: 'crms.ai-assistant.manage',
    component: AiAssistantSettingPage,
  },
  {
    path: '/ai/knowledge',
    title: 'Dữ liệu tri thức AI',
    featureKey: 'crms.ai-knowledge.manage',
    component: AiKnowledgeManagerPage,
  },
];

export default crmRoutes;
