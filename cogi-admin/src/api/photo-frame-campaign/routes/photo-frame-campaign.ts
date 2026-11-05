export default {
  routes: [
    {
      method: 'GET',
      path: '/public/photo-frame-campaigns/:slug',
      handler: 'photo-frame-campaign.getPublicCampaign',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/photo-frame-campaign-management/campaigns/form-options',
      handler: 'photo-frame-campaign.formOptions',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['photo-frame-campaign.manage', 'photo-frame-campaign.manage.all'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/photo-frame-campaign-management/campaigns',
      handler: 'photo-frame-campaign.listCampaigns',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['photo-frame-campaign.manage', 'photo-frame-campaign.manage.all'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/photo-frame-campaign-management/campaigns/:id',
      handler: 'photo-frame-campaign.campaignDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['photo-frame-campaign.manage', 'photo-frame-campaign.manage.all'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/photo-frame-campaign-management/campaigns',
      handler: 'photo-frame-campaign.createCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['photo-frame-campaign.manage', 'photo-frame-campaign.manage.all'],
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/photo-frame-campaign-management/campaigns/:id',
      handler: 'photo-frame-campaign.updateCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['photo-frame-campaign.manage', 'photo-frame-campaign.manage.all'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/photo-frame-campaign-management/campaigns/:id/toggle-status',
      handler: 'photo-frame-campaign.toggleStatus',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['photo-frame-campaign.manage', 'photo-frame-campaign.manage.all'],
            },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/photo-frame-campaign-management/campaigns/:id',
      handler: 'photo-frame-campaign.deleteCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['photo-frame-campaign.manage', 'photo-frame-campaign.manage.all'],
            },
          },
        ],
      },
    },
  ],
};