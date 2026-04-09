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