const EXAM_SCHEDULE_MANAGE_POLICY = { name: 'global::has-tenant-permission', config: { keys: ['exam-schedule.manage', 'exam-round.manage'] } };
const EXAM_SCHEDULE_READ_POLICY = { name: 'global::has-tenant-permission', config: { keys: ['exam-schedule.manage', 'exam-round.manage', 'exam-round.approve'] } };

export default {
  routes: [
    { method: 'GET', path: '/exam-rounds/:id/schedule-summary', handler: 'exam-schedule-management.summary', config: { auth: false, policies: [EXAM_SCHEDULE_READ_POLICY] } },
    { method: 'GET', path: '/exam-rounds/:id/schedules', handler: 'exam-schedule-management.list', config: { auth: false, policies: [EXAM_SCHEDULE_READ_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/schedules', handler: 'exam-schedule-management.create', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/schedules/generate', handler: 'exam-schedule-management.generate', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/schedules/bulk', handler: 'exam-schedule-management.bulkCreate', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'GET', path: '/exam-rounds/:id/schedules/:scheduleId', handler: 'exam-schedule-management.detail', config: { auth: false, policies: [EXAM_SCHEDULE_READ_POLICY] } },
    { method: 'PUT', path: '/exam-rounds/:id/schedules/:scheduleId', handler: 'exam-schedule-management.update', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/schedules/:scheduleId/clone', handler: 'exam-schedule-management.clone', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/schedules/:scheduleId/cancel', handler: 'exam-schedule-management.cancel', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/schedules/:scheduleId/publish', handler: 'exam-schedule-management.publish', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/schedules/publish-bulk', handler: 'exam-schedule-management.publishBulk', config: { auth: false, policies: [EXAM_SCHEDULE_MANAGE_POLICY] } },
  ],
};