export default {
  routes: [
    {
      method: 'GET',
      path: '/survey-campaigns/form-options',
      handler: 'survey-campaign.formOptions',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/survey-campaigns/import-assignments',
      handler: 'survey-campaign.importAssignments',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/survey-campaigns/:id/reset-responses',
      handler: 'survey-campaign.resetResponses',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/survey-campaigns',
      handler: 'survey-campaign.find',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/survey-campaigns/:id',
      handler: 'survey-campaign.findOne',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/survey-campaigns',
      handler: 'survey-campaign.create',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/survey-campaigns/:id',
      handler: 'survey-campaign.update',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'survey.campaign.manage',
            },
          },
        ],
      },
    },
  ],
};