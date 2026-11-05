export default {
  routes: [
    {
      method: 'GET',
      path: '/events',
      handler: 'event.listEvents',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'event.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/events/:id',
      handler: 'event.getEvent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'event.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/events',
      handler: 'event.createEvent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'event.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/events/:id',
      handler: 'event.updateEvent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'event.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/events/:id/registration-settings',
      handler: 'event.updateRegistrationSettings',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'event.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/events/:id/registrations',
      handler: 'event.listRegistrations',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'event.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/events/:id/stats',
      handler: 'event.getStats',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'event.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/events/:id/register',
      handler: 'event.registerForEvent',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/events/:id/my-registration',
      handler: 'event.getMyRegistration',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/events/:id/cancel-registration',
      handler: 'event.cancelRegistration',
      config: {
        auth: false,
      },
    },
  ],
};
