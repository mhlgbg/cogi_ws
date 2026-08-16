const EXAM_SCHEDULE_MANAGE_POLICY = { name: 'global::has-tenant-permission', config: { key: 'exam-schedule.manage' } };

export default {
  routes: [
    { method: 'GET', path: '/exam-rooms', handler: 'exam-room-management.list', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rooms', handler: 'exam-room-management.create', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'GET', path: '/exam-rooms/:id', handler: 'exam-room-management.detail', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'PUT', path: '/exam-rooms/:id', handler: 'exam-room-management.update', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rooms/:id/set-active', handler: 'exam-room-management.setActive', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
  ],
};