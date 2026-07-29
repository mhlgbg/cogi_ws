export default {
  routes: [
    {
      method: 'GET',
      path: '/public/registration-campaigns/:code',
      handler: 'registration-campaign.getPublic',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/public/registration-campaigns/:code/register',
      handler: 'registration-campaign.register',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/public/campaign-registrations/resend-verification',
      handler: 'registration-campaign.resendVerification',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/public/campaign-registrations/change-email',
      handler: 'registration-campaign.changeEmail',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/public/campaign-registrations/verify',
      handler: 'registration-campaign.verify',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/public/campaign-registrations/complete-account',
      handler: 'registration-campaign.completeAccount',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/public/campaign-registrations/complete',
      handler: 'registration-campaign.complete',
      config: {
        auth: false,
      },
    },
  ],
};