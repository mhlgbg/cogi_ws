const COMMUNITY_CONFIG_MANAGE_POLICY = [
  {
    name: 'global::has-tenant-permission',
    config: {
      key: 'community-config.manage',
    },
  },
];

export default {
  routes: [
    {
      method: 'GET',
      path: '/community-config-management/configs/form-options',
      handler: 'community-config-management.configFormOptions',
      config: {
        auth: false,
        policies: COMMUNITY_CONFIG_MANAGE_POLICY,
      },
    },
    {
      method: 'GET',
      path: '/community-config-management/configs',
      handler: 'community-config-management.listConfigs',
      config: {
        auth: false,
        policies: COMMUNITY_CONFIG_MANAGE_POLICY,
      },
    },
    {
      method: 'GET',
      path: '/community-config-management/configs/:id',
      handler: 'community-config-management.configDetail',
      config: {
        auth: false,
        policies: COMMUNITY_CONFIG_MANAGE_POLICY,
      },
    },
    {
      method: 'POST',
      path: '/community-config-management/configs',
      handler: 'community-config-management.createConfig',
      config: {
        auth: false,
        policies: COMMUNITY_CONFIG_MANAGE_POLICY,
      },
    },
    {
      method: 'PUT',
      path: '/community-config-management/configs/:id',
      handler: 'community-config-management.updateConfig',
      config: {
        auth: false,
        policies: COMMUNITY_CONFIG_MANAGE_POLICY,
      },
    },
    {
      method: 'POST',
      path: '/community-config-management/configs/:id/activate',
      handler: 'community-config-management.activateConfig',
      config: {
        auth: false,
        policies: COMMUNITY_CONFIG_MANAGE_POLICY,
      },
    },
    {
      method: 'POST',
      path: '/community-config-management/configs/:id/archive',
      handler: 'community-config-management.archiveConfig',
      config: {
        auth: false,
        policies: COMMUNITY_CONFIG_MANAGE_POLICY,
      },
    },
    {
      method: 'POST',
      path: '/community-config-management/configs/:id/clone',
      handler: 'community-config-management.cloneConfig',
      config: {
        auth: false,
        policies: COMMUNITY_CONFIG_MANAGE_POLICY,
      },
    },
    {
      method: 'GET',
      path: '/community-config-management/configs/:id/preview',
      handler: 'community-config-management.previewConfig',
      config: {
        auth: false,
        policies: COMMUNITY_CONFIG_MANAGE_POLICY,
      },
    },
    {
      method: 'GET',
      path: '/community/active-config',
      handler: 'community-config-management.activeConfig',
      config: {
        auth: false,
      },
    },
  ],
};

