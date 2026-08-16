const EXAM_SCHEDULE_MANAGE_POLICY = { name: 'global::has-tenant-permission', config: { key: 'exam-schedule.manage' } };

export default {
  routes: [
    { method: 'GET', path: '/exam-venues', handler: 'exam-venue-management.list', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-venues', handler: 'exam-venue-management.create', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'GET', path: '/exam-venues/:id', handler: 'exam-venue-management.detail', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'PUT', path: '/exam-venues/:id', handler: 'exam-venue-management.update', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-venues/:id/set-active', handler: 'exam-venue-management.setActive', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
  ],
};