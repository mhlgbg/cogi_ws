export default {
  routes: [
    {
      method: 'POST',
      path: '/strava/connect-url',
      handler: 'strava.connectUrl',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/connect',
      handler: 'strava.connect',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
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
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/strava/sync',
      handler: 'strava.sync',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/sync/current',
      handler: 'strava.syncCurrent',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/sync/jobs/:id',
      handler: 'strava.syncJobDetail',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/strava/sync/jobs/:id/retry',
      handler: 'strava.retrySyncJob',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/strava/sync/jobs/:id/cancel',
      handler: 'strava.cancelSyncJob',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/activities',
      handler: 'strava.activities',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/summary',
      handler: 'strava.summary',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/analytics/overview',
      handler: 'strava.analyticsOverview',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/analytics/trends',
      handler: 'strava.analyticsTrends',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/analytics/yearly',
      handler: 'strava.analyticsYearly',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/analytics/insights',
      handler: 'strava.analyticsInsights',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/analytics/records',
      handler: 'strava.analyticsRecords',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/analytics/top-activities',
      handler: 'strava.analyticsTopActivities',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/analytics/yearly-records',
      handler: 'strava.analyticsYearlyRecords',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/strava/analytics/milestones',
      handler: 'strava.analyticsMilestones',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/strava/disconnect',
      handler: 'strava.disconnect',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'fitness.manage' } },
        ],
      },
    },
  ],
};