const TEMPLATE_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'sports-achievement.manage',
  },
};

export default {
  routes: [
    { method: 'GET', path: '/sports/achievement-templates', handler: 'sports-achievement-template.list', config: { auth: false, policies: [TEMPLATE_POLICY] } },
    { method: 'GET', path: '/sports/achievement-templates/:id', handler: 'sports-achievement-template.getDetail', config: { auth: false, policies: [TEMPLATE_POLICY] } },
    { method: 'POST', path: '/sports/achievement-templates', handler: 'sports-achievement-template.create', config: { auth: false, policies: [TEMPLATE_POLICY] } },
    { method: 'PUT', path: '/sports/achievement-templates/:id', handler: 'sports-achievement-template.update', config: { auth: false, policies: [TEMPLATE_POLICY] } },
  ],
};
