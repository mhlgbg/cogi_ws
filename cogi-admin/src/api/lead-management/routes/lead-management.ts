export default {
  routes: [
    {
      method: 'GET',
      path: '/lead-management/campaigns/form-options',
      handler: 'lead-management.campaignFormOptions',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.lead-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lead-management/campaigns',
      handler: 'lead-management.listCampaigns',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.lead-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lead-management/campaigns/:id',
      handler: 'lead-management.campaignDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.lead-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lead-management/campaigns',
      handler: 'lead-management.createCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.lead-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/lead-management/campaigns/:id',
      handler: 'lead-management.updateCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'crms.lead-campaign.manage',
            },
          },
        ],
      },
    },
  ],
};
