export default {
  routes: [
    {
      method: 'GET',
      path: '/admission-campaigns',
      handler: 'campaign.admissionList',
      config: {
        auth: false,
      },
    },
  ],
};