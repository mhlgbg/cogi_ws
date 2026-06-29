export default {
  routes: [
    {
      method: 'GET',
      path: '/strava/connect',
      handler: 'strava.connect',
      config: {
        auth: {
          scope: [],
        },
      },
    },
    {
      method: 'GET',
      path: '/strava/callback',
      handler: 'strava.callback',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/strava/status',
      handler: 'strava.status',
      config: {
        auth: {
          scope: [],
        },
      },
    },
    {
      method: 'POST',
      path: '/strava/disconnect',
      handler: 'strava.disconnect',
      config: {
        auth: {
          scope: [],
        },
      },
    },
  ],
};