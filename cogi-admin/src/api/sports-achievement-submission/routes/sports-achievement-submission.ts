const SPORTS_ACHIEVEMENT_SUBMISSION_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'sports-achievement-submission.manage',
  },
};

export default {
  routes: [
    { method: 'GET', path: '/sports/achievement-submissions', handler: 'sports-achievement-submission.list', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_SUBMISSION_POLICY] } },
    { method: 'GET', path: '/sports/achievement-submissions/:id', handler: 'sports-achievement-submission.getDetail', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_SUBMISSION_POLICY] } },
    { method: 'POST', path: '/sports/achievement-submissions', handler: 'sports-achievement-submission.create', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_SUBMISSION_POLICY] } },
    { method: 'PUT', path: '/sports/achievement-submissions/:id', handler: 'sports-achievement-submission.update', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_SUBMISSION_POLICY] } },
    { method: 'POST', path: '/sports/achievement-submissions/:id/submit', handler: 'sports-achievement-submission.submit', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_SUBMISSION_POLICY] } },
    { method: 'POST', path: '/sports/achievement-submissions/:id/verify', handler: 'sports-achievement-submission.verify', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_SUBMISSION_POLICY] } },
    { method: 'POST', path: '/sports/achievement-submissions/:id/reject', handler: 'sports-achievement-submission.reject', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_SUBMISSION_POLICY] } },
    { method: 'POST', path: '/sports/achievement-submissions/:id/cancel', handler: 'sports-achievement-submission.cancel', config: { auth: false, policies: [SPORTS_ACHIEVEMENT_SUBMISSION_POLICY] } },
  ],
};
