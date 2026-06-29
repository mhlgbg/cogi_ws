export default {
  routes: [
    {
      method: 'GET',
      path: '/ai/assistant',
      handler: 'ai-management.getAssistant',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.ai-assistant.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/ai/assistant',
      handler: 'ai-management.saveAssistant',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.ai-assistant.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/ai/assistant/test',
      handler: 'ai-management.testAssistant',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.ai-assistant.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/ai/knowledge',
      handler: 'ai-management.listKnowledge',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.ai-knowledge.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/ai/knowledge',
      handler: 'ai-management.createKnowledge',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.ai-knowledge.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/ai/knowledge/:id',
      handler: 'ai-management.knowledgeDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.ai-knowledge.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/ai/knowledge/:id',
      handler: 'ai-management.updateKnowledge',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.ai-knowledge.manage',
            },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/ai/knowledge/:id',
      handler: 'ai-management.deleteKnowledge',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.ai-knowledge.manage',
            },
          },
        ],
      },
    },
  ],
};