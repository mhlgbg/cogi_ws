export default {
  routes: [
    {
      method: 'GET',
      path: '/survey-question-management/bootstrap',
      handler: 'survey-question-management.bootstrap',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/survey-question-management/questions',
      handler: 'survey-question-management.listQuestions',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/survey-question-management/templates',
      handler: 'survey-question-management.createTemplate',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/survey-question-management/templates/:id',
      handler: 'survey-question-management.updateTemplate',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/survey-question-management/templates/:id',
      handler: 'survey-question-management.deleteTemplate',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/survey-question-management/sections',
      handler: 'survey-question-management.createSection',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/survey-question-management/sections/:id',
      handler: 'survey-question-management.updateSection',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/survey-question-management/sections/:id',
      handler: 'survey-question-management.deleteSection',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/survey-question-management/questions',
      handler: 'survey-question-management.createQuestion',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/survey-question-management/questions/:id',
      handler: 'survey-question-management.updateQuestion',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/survey-question-management/questions/:id',
      handler: 'survey-question-management.deleteQuestion',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.question.manage',
            },
          },
        ],
      },
    },
  ],
};