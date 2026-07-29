export default {
  routes: [
    {
      method: 'GET',
      path: '/registration-campaigns/form-options',
      handler: 'registration-campaign-management.getFormOptions',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/registration-campaigns',
      handler: 'registration-campaign-management.listCampaigns',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns',
      handler: 'registration-campaign-management.createCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/registration-campaigns/:id',
      handler: 'registration-campaign-management.getCampaignDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/registration-campaigns/:id',
      handler: 'registration-campaign-management.updateCampaignBasicInfo',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/registration-campaigns/:id/config',
      handler: 'registration-campaign-management.updateCampaignConfig',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/registration-campaigns/:id/form',
      handler: 'registration-campaign-management.updateCampaignForm',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/:id/open',
      handler: 'registration-campaign-management.openCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/:id/pause',
      handler: 'registration-campaign-management.pauseCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/:id/close',
      handler: 'registration-campaign-management.closeCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/:id/cancel',
      handler: 'registration-campaign-management.cancelCampaign',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/registration-campaigns/:id/registrations',
      handler: 'registration-campaign-management.listRegistrations',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/registration-campaigns/:id/registrations/:registrationId',
      handler: 'registration-campaign-management.registrationDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/:id/registrations/:registrationId/resend-verification',
      handler: 'registration-campaign-management.resendRegistration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/:id/registrations/:registrationId/change-email',
      handler: 'registration-campaign-management.changeRegistrationEmail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/:id/registrations/:registrationId/resend-completion-email',
      handler: 'registration-campaign-management.resendCompletionEmail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/:id/registrations/:registrationId/resend-rejection-email',
      handler: 'registration-campaign-management.resendRejectionEmail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/registrations/:id/approve',
      handler: 'registration-campaign-management.approveRegistration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/registrations/:id/reject',
      handler: 'registration-campaign-management.rejectRegistration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/registrations/:id/cancel',
      handler: 'registration-campaign-management.cancelRegistration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/registrations/:id/retry-complete',
      handler: 'registration-campaign-management.retryCompleteRegistration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/registration-campaigns/:id/emails',
      handler: 'registration-campaign-management.listEmails',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/registration-campaigns/:id/emails',
      handler: 'registration-campaign-management.updateEmailConfig',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/registration-campaigns/:id/email-templates',
      handler: 'registration-campaign-management.listEmailTemplates',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/:id/emails/preview',
      handler: 'registration-campaign-management.previewEmailTemplate',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/registration-campaigns/:id/emails/test-send',
      handler: 'registration-campaign-management.testSendEmailTemplate',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/registration-campaigns/:id/emails/:mailLogId',
      handler: 'registration-campaign-management.emailDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'registration-campaign.manage',
            },
          },
        ],
      },
    },
  ],
};