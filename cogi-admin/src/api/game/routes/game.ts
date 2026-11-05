const GAME_MANAGE_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'game.manage',
  },
};

const GAME_CENTER_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'game.center.view',
  },
};

export default {
  routes: [
    {
      method: 'GET',
      path: '/platform/game-types',
      handler: 'game.listPlatformGameTypes',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/tenants/:tenantId/game-types',
      handler: 'game.listPlatformTenantGameTypes',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PATCH',
      path: '/platform/tenants/:tenantId/game-types/:gameTypeId/license',
      handler: 'game.updatePlatformTenantGameTypeLicense',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/game-management/game-types',
      handler: 'game.listTenantGameTypes',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'PATCH',
      path: '/game-management/game-types/:gameTypeId/enablement',
      handler: 'game.updateTenantGameTypeEnablement',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/game-management/dashboard',
      handler: 'game.dashboard',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/game-management/games',
      handler: 'game.listAdminGames',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/game-management/games',
      handler: 'game.createAdminGame',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/game-management/games/:id',
      handler: 'game.getAdminGameDetail',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/game-management/games/:id/dev/process-activity',
      handler: 'game.processActivityDev',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'PUT',
      path: '/game-management/games/:id',
      handler: 'game.updateAdminGame',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/game-management/games/:id/publish',
      handler: 'game.publishAdminGame',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/game-management/games/:id/unpublish',
      handler: 'game.unpublishAdminGame',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/game-management/games/:id/reset-challenge',
      handler: 'game.createResetChallenge',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/game-management/games/:id/reset',
      handler: 'game.resetAdminGame',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'PUT',
      path: '/game-management/games/:id/rules',
      handler: 'game.updateAdminGameRules',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/game-management/games/:id/participants',
      handler: 'game.listAdminGameParticipants',
      config: {
        auth: false,
        policies: [GAME_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/game-center/games',
      handler: 'game.listGameCenterGames',
      config: {
        auth: false,
        policies: [GAME_CENTER_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/game-center/activity-signal',
      handler: 'game.signalDailyActive',
      config: {
        auth: false,
        policies: [GAME_CENTER_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/game-center/games/:id',
      handler: 'game.getGameCenterGameDetail',
      config: {
        auth: false,
        policies: [GAME_CENTER_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/game-center/games/:id/register',
      handler: 'game.registerCurrentUser',
      config: {
        auth: false,
        policies: [GAME_CENTER_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/game-center/games/:id/ghost-race/session',
      handler: 'game.getGhostRaceSession',
      config: {
        auth: false,
        policies: [GAME_CENTER_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/game-center/games/:id/ghost-race/attempts/start',
      handler: 'game.startGhostRaceAttempt',
      config: {
        auth: false,
        policies: [GAME_CENTER_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/game-center/games/:id/ghost-race/attempts/submit',
      handler: 'game.submitGhostRaceAttempt',
      config: {
        auth: false,
        policies: [GAME_CENTER_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/game-center/games/:id/ghost-race/attempts',
      handler: 'game.listMyGhostRaceAttempts',
      config: {
        auth: false,
        policies: [GAME_CENTER_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/game-center/games/:id/ghost-race/personal-best',
      handler: 'game.getMyGhostRacePersonalBest',
      config: {
        auth: false,
        policies: [GAME_CENTER_POLICY],
      },
    },
  ],
};
