export default {
  routes: [
    {
      method: 'GET',
      path: '/admission-campaigns/by-code/:campaignCode',
      handler: 'auth-extended.admissionCampaignByCode',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/tenants/by-code/:tenantCode',
      handler: 'auth-extended.tenantByCode',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/invite',
      handler: 'auth-extended.invite',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/activate',
      handler: 'auth-extended.activate',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/set-password',
      handler: 'auth-extended.setPassword',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/forgot-password-safe',
      handler: 'auth-extended.forgotPasswordSafe',
      config: {
        auth: false,
      },
    },
  ],
};
