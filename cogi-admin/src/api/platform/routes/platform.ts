export default {
  routes: [
    {
      method: 'GET',
      path: '/platform/tenants',
      handler: 'platform.listTenants',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/tenants',
      handler: 'platform.createTenant',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/tenants/:id',
      handler: 'platform.updateTenant',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/features',
      handler: 'platform.listFeatures',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/features',
      handler: 'platform.createFeature',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/features/:featureId',
      handler: 'platform.updateFeature',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/settings',
      handler: 'platform.listSettings',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/strava/dashboard/overview',
      handler: 'platform.getStravaDashboardOverview',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/strava/connections',
      handler: 'platform.listStravaConnections',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/strava/webhook-events',
      handler: 'platform.listStravaWebhookEvents',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/strava/webhook-events/:id',
      handler: 'platform.getStravaWebhookEventDetail',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/strava/sync-jobs',
      handler: 'platform.listStravaSyncJobs',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/strava/sync-jobs/:id',
      handler: 'platform.getStravaSyncJobDetail',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/strava/subscription',
      handler: 'platform.getStravaSubscriptionOverview',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/strava/diagnostics',
      handler: 'platform.getStravaDiagnostics',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/strava/subscription',
      handler: 'platform.createStravaSubscription',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/strava/subscription',
      handler: 'platform.deleteStravaSubscription',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/settings/:key',
      handler: 'platform.getSettingByKey',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/settings/:key',
      handler: 'platform.upsertSettingByKey',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/features/:featureId/roles',
      handler: 'platform.listFeatureRoles',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/features/:featureId/roles/:roleId/activate',
      handler: 'platform.activateFeatureRole',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/features/:featureId/roles/:roleId/deactivate',
      handler: 'platform.deactivateFeatureRole',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PATCH',
      path: '/platform/tenants/:id/status',
      handler: 'platform.updateTenantStatus',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/tenants/:id/features',
      handler: 'platform.listTenantFeatures',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/tenants/:tenantId/roles',
      handler: 'platform.listTenantRoles',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/tenants/:tenantId/tenant-admins',
      handler: 'platform.listTenantAdmins',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/tenants/:tenantId/tenant-admins/invite',
      handler: 'platform.inviteTenantAdmin',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/tenants/:tenantId/tenant-admins/:assignmentId/inactive',
      handler: 'platform.inactiveTenantAdmin',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/tenants/:tenantId/tenant-admins/:assignmentId/activate',
      handler: 'platform.activateTenantAdmin',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PATCH',
      path: '/platform/tenants/:id/features/:featureId',
      handler: 'platform.updateTenantFeature',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/tenants/:tenantId/roles/:roleId/activate',
      handler: 'platform.activateTenantRole',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/tenants/:tenantId/roles/:roleId/deactivate',
      handler: 'platform.deactivateTenantRole',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/tenants/:tenantId/storage-configs',
      handler: 'platform.listTenantStorageConfigs',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/tenants/:tenantId/storage-configs',
      handler: 'platform.createTenantStorageConfig',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/tenants/:tenantId/storage-configs/:storageConfigId',
      handler: 'platform.updateTenantStorageConfig',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PATCH',
      path: '/platform/tenants/:tenantId/storage-default-config',
      handler: 'platform.updateTenantDefaultStorageConfig',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/permission-debug',
      handler: 'platform.permissionDebug',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
  ],
};