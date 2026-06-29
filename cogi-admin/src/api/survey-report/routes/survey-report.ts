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
    {
      method: 'GET',
      path: '/survey-reports/campaign/:campaignId/course/:courseId/export',
      handler: 'survey-report.exportCourse',
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
      path: '/survey-reports/campaign/:campaignId/progress/export',
      handler: 'survey-report.exportProgress',
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
      path: '/survey-reports/campaign/:campaignId/answers/export',
      handler: 'survey-report.exportAllAnswers',
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
      path: '/survey-reports/campaign/:campaignId/answers/file/generate',
      handler: 'survey-report.generateAllAnswersFile',
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
      path: '/survey-reports/campaign/:campaignId/answers/file/latest',
      handler: 'survey-report.latestAllAnswersFile',
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
      path: '/survey-reports/campaign/:campaignId/answers/file/download',
      handler: 'survey-report.downloadLatestAllAnswersFile',
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