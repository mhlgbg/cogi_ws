const EXAM_CONFIGURATION_READ_POLICY = {
  name: 'global::has-tenant-permission',
  config: { keys: ['exam-round.manage', 'exam-round.approve'] },
};

export default {
  routes: [
    {
      method: 'GET',
      path: '/exam-configuration-management/components',
      handler: 'exam-configuration-management.listComponents',
      config: { auth: false, policies: [EXAM_CONFIGURATION_READ_POLICY] },
    },
    {
      method: 'GET',
      path: '/exam-configuration-management/components/:id',
      handler: 'exam-configuration-management.getComponentDetail',
      config: { auth: false, policies: [EXAM_CONFIGURATION_READ_POLICY] },
    },
  ],
};