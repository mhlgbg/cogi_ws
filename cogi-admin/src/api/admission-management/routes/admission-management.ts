export default {
  routes: [
    {
      method: 'GET',
      path: '/admission-management/campaigns/form-options',
      handler: 'admission-management.campaignFormOptions',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/admission-management/campaigns',
      handler: 'admission-management.listCampaigns',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/admission-management/campaigns/:id',
      handler: 'admission-management.campaignDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/admission-management/campaigns',
      handler: 'admission-management.createCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/admission-management/campaigns/:id',
      handler: 'admission-management.updateCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/admission-management/form-templates',
      handler: 'admission-management.listFormTemplates',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.form-template.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/admission-management/form-templates/:id',
      handler: 'admission-management.formTemplateDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.form-template.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/admission-management/form-templates',
      handler: 'admission-management.createFormTemplate',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.form-template.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/admission-management/form-templates/:id',
      handler: 'admission-management.updateFormTemplate',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.form-template.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/admission-management/notification-templates',
      handler: 'admission-management.listNotificationTemplates',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.notification-template.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/admission-management/notification-templates/:id',
      handler: 'admission-management.notificationTemplateDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.notification-template.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/admission-management/notification-templates',
      handler: 'admission-management.createNotificationTemplate',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.notification-template.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/admission-management/notification-templates/:id',
      handler: 'admission-management.updateNotificationTemplate',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.notification-template.manage',
            },
          },
        ],
      },
    },
  ],
};