export default {
  routes: [
    {
      method: 'GET',
      path: '/admission-applications/me/list',
      handler: 'admission-application.me',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/admission-applications/me/:id/detail',
      handler: 'admission-application.detail',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/admission-applications/me',
      handler: 'admission-application.createMine',
      config: {
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/admission-applications/me/:id',
      handler: 'admission-application.updateMine',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/admission-management/reviews',
      handler: 'admission-application.reviewList',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.review.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/admission-management/reviews/export',
      handler: 'admission-application.reviewExport',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.review.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/admission-management/reviews/:id',
      handler: 'admission-application.reviewDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.review.manage',
            },
          },
        ],
      },
    },
    {
    method: 'GET',
    path: '/admission/reviews/:id/messages',
    handler: 'admission-application.reviewMessages',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
    method: 'POST',
    path: '/admission/reviews/:id/messages',
    handler: 'admission-application.reviewSendMessage',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
    method: 'POST',
    path: '/admission/reviews/:id/view-detail-activity',
    handler: 'admission-application.reviewViewDetailActivity',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
    method: 'POST',
    path: '/admission/reviews/:id/send-email',
    handler: 'admission-application.reviewSendEmail',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
    method: 'GET',
    path: '/admission/reviews/:id/email-templates',
    handler: 'admission-application.reviewEmailTemplates',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
    method: 'GET',
    path: '/admission/reviews/:id/notification-template',
    handler: 'admission-application.reviewNotificationTemplate',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
    method: 'POST',
    path: '/admission/reviews/:id/send-approval-reminder',
    handler: 'admission-application.reviewSendApprovalReminder',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
    method: 'POST',
    path: '/admission/reviews/:id/update-returned-note',
    handler: 'admission-application.reviewUpdateReturnedNote',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
    method: 'POST',
    path: '/admission/reviews/:id/reset-to-draft',
    handler: 'admission-application.reviewResetToDraft',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
    method: 'POST',
    path: '/admission/reviews/:id/soft-delete',
    handler: 'admission-application.reviewSoftDelete',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
    method: 'POST',
    path: '/admission/reviews/:id/restore',
    handler: 'admission-application.reviewRestore',
    config: {
      auth: false,
      policies: [
        {
          name: 'global::has-tenant-permission',
          config: {
            key: 'admission.review.manage',
          },
        },
      ],
    },
  },
    {
      method: 'GET',
      path: '/admission-management/reviews/:id/snapshot',
      handler: 'admission-application.reviewSnapshot',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.review.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/admission-management/reviews/:id/form-data',
      handler: 'admission-application.reviewFormData',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.review.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/admission-management/reviews/:id/account',
      handler: 'admission-application.reviewUpdateAccount',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.review.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/admission-management/reviews/:id/application',
      handler: 'admission-application.reviewUpdateApplication',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.review.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/admission-management/reviews/:id/rebuild-snapshot',
      handler: 'admission-application.reviewRebuildSnapshot',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.review.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/admission/reviews/:id/rebuild-snapshot',
      handler: 'admission-application.reviewRebuildSnapshot',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.review.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/admission-management/reviews/:id/decision',
      handler: 'admission-application.reviewDecision',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'admission.review.manage',
            },
          },
        ],
      },
    },
  ],
};