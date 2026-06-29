export default {
  routes: [
    {
      method: 'POST',
      path: '/survey-assignments/delete-filtered',
      handler: 'survey-assignment.deleteFiltered',
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
      path: '/survey-assignments/restore-filtered',
      handler: 'survey-assignment.restoreFiltered',
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
      path: '/survey-assignments/:id/restore',
      handler: 'survey-assignment.restore',
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
      path: '/survey-assignments',
      handler: 'survey-assignment.find',
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
      path: '/survey-assignments',
      handler: 'survey-assignment.create',
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