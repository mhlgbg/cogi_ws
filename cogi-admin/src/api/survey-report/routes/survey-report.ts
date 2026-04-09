export default {
  routes: [
    {
      method: 'GET',
      path: '/survey-reports/campaign/:id/summary',
      handler: 'survey-report.summary',
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
      path: '/survey-reports/campaign/:id/lecturers',
      handler: 'survey-report.lecturers',
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
      path: '/survey-reports/campaign/:id/courses',
      handler: 'survey-report.courses',
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
      path: '/survey-reports/campaign/:campaignId/lecturer/:lecturerId/export',
      handler: 'survey-report.exportLecturer',
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
}