export default {
  routes: [
    {
      method: 'POST',
      path: '/public/lead-campaigns/:code/submit',
      handler: 'public-lead-campaign.submit',
      config: {
        auth: false,
      },
    },
  ],
};
