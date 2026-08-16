const SPORTS_ACHIEVEMENT_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'sports-achievement.manage',
  },
};

export default {
  routes: [
    { method: 'GET', path: '/sports/achievements', handler: 'sports-achievement.list', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_POLICY] } },
    { method: 'GET', path: '/sports/achievements/:id', handler: 'sports-achievement.getDetail', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_POLICY] } },
    { method: 'POST', path: '/sports/achievements', handler: 'sports-achievement.create', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_POLICY] } },
    { method: 'PUT', path: '/sports/achievements/:id', handler: 'sports-achievement.update', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_POLICY] } },
  ],
};
