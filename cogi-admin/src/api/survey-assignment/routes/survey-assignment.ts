export default {
  routes: [
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
  ],
};