import CrmHome from "../pages/CrmHome";
import LeadCampaignManagementPage from '../pages/LeadCampaignManagementPage'
import ChatSessionManagerPage from '../pages/ChatSessionManagerPage'
import AiAssistantSettingPage from '../pages/AiAssistantSettingPage'
import AiKnowledgeManagerPage from '../pages/AiKnowledgeManagerPage'
import QuickMessageListPage from '../pages/QuickMessageListPage'
import QuickMessageCreatePage from '../pages/QuickMessageCreatePage'
import QuickMessageDetailPage from '../pages/QuickMessageDetailPage'

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
  {
    path: '/quick-messages',
    title: 'Chuyển nhanh',
    featureKey: 'crms.quick-message.manage',
    component: QuickMessageListPage,
  },
  {
    path: '/quick-messages/new',
    title: 'Tạo thông điệp',
    featureKey: 'crms.quick-message.manage',
    component: QuickMessageCreatePage,
  },
  {
    path: '/quick-messages/:id',
    title: 'Chi tiết thông điệp',
    featureKey: 'crms.quick-message.manage',
    component: QuickMessageDetailPage,
  },
];

export default crmRoutes;
