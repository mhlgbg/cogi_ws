const crmFeatures = {
  group: {
    name: "CRM",
    code: "crm",
    order: 2,
    icon: "cilHandshake",
  },
  features: [
    {
      name: "CRM Home",
      key: "crms.home",
      order: 1,
      description: "CRM home page",
      path: "/crms",
    },
    {
      name: 'Lead Campaign Management',
      key: 'crms.lead-campaign.manage',
      order: 2,
      description: 'Manage tenant lead capture campaigns',
      path: '/crms/lead-campaigns',
      showInMenu: true,
    },
    {
      name: 'Customer Chat Session Management',
      key: 'crms.chat-session.manage',
      order: 3,
      description: 'Manage tenant customer chat conversations',
      path: '/chat-sessions',
      showInMenu: true,
    },
  ],
};

export default crmFeatures;
