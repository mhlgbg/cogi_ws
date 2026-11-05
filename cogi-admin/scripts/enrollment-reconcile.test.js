const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')

process.env.STRAVA_SYNC_RUNNER_ENABLED = 'false'
process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'false'

let app
let authenticatedRoleId = 0

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function destroyEntity(uid, id) {
  if (!id) return
  try {
    await app.db.query(uid).delete({ where: { id } })
  } catch {
    // ignore cleanup failures in dev DB
  }
}

async function createTenant(label) {
  return app.db.query('api::tenant.tenant').create({
    data: {
      name: `Tenant ${label}`,
      code: label.toUpperCase(),
      tenantStatus: 'active',
      siteTitle: `Tenant ${label}`,
    },
    select: ['id', 'code', 'name'],
  })
}

async function createUser(label) {
  return app.db.query('plugin::users-permissions.user').create({
    data: {
      username: label,
      email: `${label}@example.com`,
      password: 'Pass1234!',
      provider: 'local',
      confirmed: true,
      blocked: false,
      fullName: `User ${label}`,
      role: authenticatedRoleId,
    },
    select: ['id', 'username', 'email', 'fullName', 'blocked'],
  })
}

async function createUserTenant(userId, tenantId, label) {
  return app.db.query('api::user-tenant.user-tenant').create({
    data: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: 'active',
      isDefault: false,
      label: `Membership ${label}`,
    },
    select: ['id'],
  })
}

async function createClass(tenantId, mainTeacherId, label) {
  return app.db.query('api::class.class').create({
    data: {
      name: `Class ${label}`,
      subjectCode: `SUB-${label.toUpperCase()}`,
      subject: 'English',
      classStatus: 'active',
      mainTeacher: mainTeacherId,
      tenant: tenantId,
    },
    select: ['id', 'name'],
  })
}

async function createLearner(tenantId, label) {
  return app.db.query('api::learner.learner').create({
    data: {
      code: `LRN-${label}`.toUpperCase(),
      fullName: `Learner ${label}`,
      learnerStatus: 'active',
      tenant: tenantId,
      user: null,
    },
    select: ['id', 'code', 'fullName'],
  })
}

async function createClassSession(tenantId, classId, teacherId, options = {}) {
  return app.db.query('api::class-session.class-session').create({
    data: {
      class: classId,
      teacher: teacherId,
      sessionDate: options.sessionDate,
      startTime: options.startTime || '19:00:00',
      endTime: options.endTime || '20:00:00',
      status: options.status || 'scheduled',
      title: options.title || `Session ${options.sessionDate}`,
      tenant: tenantId,
    },
    select: ['id', 'sessionDate'],
  })
}

async function createPublishedAssignment(tenantId, classId, classSessionId, assignedAt, title) {
  return app.db.query('api::assignment.assignment').create({
    data: {
      class: classId,
      classSession: classSessionId,
      title,
      status: 'published',
      assignedAt,
      tenant: tenantId,
    },
    select: ['id', 'assignedAt', 'status'],
  })
}

async function createAssignmentTask(tenantId, assignmentId, title, taskType) {
  return app.db.query('api::assignment-task.assignment-task').create({
    data: {
      assignment: assignmentId,
      title,
      order: 0,
      required: true,
      taskType,
      tenant: tenantId,
    },
    select: ['id', 'taskType'],
  })
}

function createCtx({ tenant, user, classId, enrollmentId = null, data = {} }) {
  return {
    params: {
      id: classId,
      ...(enrollmentId ? { enrollmentId } : {}),
    },
    request: { body: { data } },
    state: {
      user,
      tenant: { id: tenant.id, code: tenant.code },
      tenantId: tenant.id,
      tenantCode: tenant.code,
    },
    status: 200,
    body: null,
    unauthorized(message) {
      this.status = 401
      this.body = { error: { message } }
      return this.body
    },
    notFound(message) {
      this.status = 404
      this.body = { error: { message } }
      return this.body
    },
    badRequest(message) {
      this.status = 400
      this.body = { error: { message } }
      return this.body
    },
    throw(status, message) {
      const error = new Error(message)
      error.status = status
      throw error
    },
  }
}

async function createFixture() {
  const cleanup = []
  const key = uniqueKey('enrollment-reconcile')

  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  const actor = await createUser(`${key}-actor`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', actor.id))
  const teacher = await createUser(`${key}-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', teacher.id))

  const actorMembership = await createUserTenant(actor.id, tenant.id, `${key}-actor`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', actorMembership.id))
  const teacherMembership = await createUserTenant(teacher.id, tenant.id, `${key}-teacher`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', teacherMembership.id))

  const classEntity = await createClass(tenant.id, teacher.id, `${key}-class`)
  cleanup.push(() => destroyEntity('api::class.class', classEntity.id))

  const learnerA = await createLearner(tenant.id, `${key}-a`)
  cleanup.push(() => destroyEntity('api::learner.learner', learnerA.id))
  const learnerB = await createLearner(tenant.id, `${key}-b`)
  cleanup.push(() => destroyEntity('api::learner.learner', learnerB.id))

  const session1 = await createClassSession(tenant.id, classEntity.id, teacher.id, { sessionDate: '2026-09-15' })
  const session2 = await createClassSession(tenant.id, classEntity.id, teacher.id, { sessionDate: '2026-09-20' })
  const session3 = await createClassSession(tenant.id, classEntity.id, teacher.id, { sessionDate: '2026-10-02' })
  cleanup.push(() => destroyEntity('api::class-session.class-session', session1.id))
  cleanup.push(() => destroyEntity('api::class-session.class-session', session2.id))
  cleanup.push(() => destroyEntity('api::class-session.class-session', session3.id))

  const assignment1 = await createPublishedAssignment(tenant.id, classEntity.id, session1.id, '2026-09-16T08:00:00.000Z', `Assignment ${key} 1`)
  const assignment2 = await createPublishedAssignment(tenant.id, classEntity.id, session2.id, '2026-09-25T08:00:00.000Z', `Assignment ${key} 2`)
  cleanup.push(() => destroyEntity('api::assignment.assignment', assignment1.id))
  cleanup.push(() => destroyEntity('api::assignment.assignment', assignment2.id))

  const assignment1TaskTodo = await createAssignmentTask(tenant.id, assignment1.id, `Task todo ${key}`, 'todo')
  const assignment1TaskAssessment = await createAssignmentTask(tenant.id, assignment1.id, `Task assessment ${key}`, 'assessment')
  const assignment2TaskSubmission = await createAssignmentTask(tenant.id, assignment2.id, `Task submission ${key}`, 'submission')
  cleanup.push(() => destroyEntity('api::assignment-task.assignment-task', assignment1TaskTodo.id))
  cleanup.push(() => destroyEntity('api::assignment-task.assignment-task', assignment1TaskAssessment.id))
  cleanup.push(() => destroyEntity('api::assignment-task.assignment-task', assignment2TaskSubmission.id))

  return {
    cleanup,
    tenant,
    actor,
    classEntity,
    learnerA,
    learnerB,
    session1,
    session2,
    session3,
    assignment1,
    assignment2,
    assignment1TaskTodo,
    assignment1TaskAssessment,
    assignment2TaskSubmission,
  }
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  const authenticatedRole = await app.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'authenticated' },
    select: ['id'],
  })
  authenticatedRoleId = Number(authenticatedRole?.id || 0)
  assert.ok(authenticatedRoleId > 0, 'authenticated role must exist')
})

after(async () => {
  if (app) await app.destroy()
})

test('enrollment reconcile adds missing attendance/progress and remains idempotent without deleting historical data', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const createCtxA = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      classId: fixture.classEntity.id,
      data: {
        learner: fixture.learnerA.id,
        joinDate: '2026-09-15',
        status: 'active',
      },
    })
    await controller.createEnrollment(createCtxA)

    const enrollmentAId = Number(createCtxA?.body?.data?.id || 0)
    const reconcileA = createCtxA?.body?.meta?.reconcile
    assert.ok(enrollmentAId > 0)
    assert.equal(reconcileA?.triggered, true)
    assert.equal(reconcileA?.summary?.attendanceAdded, 3)
    assert.equal(reconcileA?.summary?.assignmentsAdded, 2)
    assert.equal(reconcileA?.summary?.taskProgressAdded, 3)

    const attendanceA = await app.db.query('api::class-session-attendance.class-session-attendance').findMany({
      where: {
        learner: { id: { $eq: fixture.learnerA.id } },
        classSession: { id: { $in: [fixture.session1.id, fixture.session2.id, fixture.session3.id] } },
      },
      populate: { classSession: { select: ['id', 'sessionDate'] } },
    })
    assert.equal(attendanceA.length, 3)
    assert.ok(attendanceA.every((row) => row.status === 'not_marked'))

    const progressA = await app.db.query('api::assignment-task-learner-progress.assignment-task-learner-progress').findMany({
      where: {
        learner: { id: { $eq: fixture.learnerA.id } },
        assignmentTask: { id: { $in: [fixture.assignment1TaskTodo.id, fixture.assignment1TaskAssessment.id, fixture.assignment2TaskSubmission.id] } },
      },
      select: ['id', 'status'],
    })
    assert.equal(progressA.length, 3)
    assert.ok(progressA.every((row) => row.status === 'assigned'))

    const attemptsA = await app.db.query('api::assessment-attempt.assessment-attempt').findMany({
      where: {
        learner: { id: { $eq: fixture.learnerA.id } },
      },
      select: ['id'],
    })
    assert.equal(attemptsA.length, 0, 'reconcile must not create assessment attempts')

    const repeatJoinDateCtxA = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      classId: fixture.classEntity.id,
      enrollmentId: enrollmentAId,
      data: {
        learner: fixture.learnerA.id,
        joinDate: '2026-09-15',
        status: 'active',
      },
    })
    await controller.updateEnrollment(repeatJoinDateCtxA)
    assert.equal(repeatJoinDateCtxA?.body?.meta?.reconcile?.triggered, false)

    const attendanceAAfterRepeat = await app.db.query('api::class-session-attendance.class-session-attendance').count({
      where: {
        learner: { id: { $eq: fixture.learnerA.id } },
        classSession: { id: { $in: [fixture.session1.id, fixture.session2.id, fixture.session3.id] } },
      },
    })
    assert.equal(Number(attendanceAAfterRepeat || 0), 3)

    const progressAAfterRepeat = await app.db.query('api::assignment-task-learner-progress.assignment-task-learner-progress').count({
      where: {
        learner: { id: { $eq: fixture.learnerA.id } },
        assignmentTask: { id: { $in: [fixture.assignment1TaskTodo.id, fixture.assignment1TaskAssessment.id, fixture.assignment2TaskSubmission.id] } },
      },
    })
    assert.equal(Number(progressAAfterRepeat || 0), 3)

    const createCtxB = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      classId: fixture.classEntity.id,
      data: {
        learner: fixture.learnerB.id,
        joinDate: '2026-10-01',
        status: 'active',
      },
    })
    await controller.createEnrollment(createCtxB)
    const enrollmentBId = Number(createCtxB?.body?.data?.id || 0)
    assert.ok(enrollmentBId > 0)

    const keepAttendance = await app.db.query('api::class-session-attendance.class-session-attendance').create({
      data: {
        classSession: fixture.session2.id,
        learner: fixture.learnerB.id,
        status: 'late',
        note: 'existing-note',
        tenant: fixture.tenant.id,
      },
      select: ['id'],
    })

    const keepProgress = await app.db.query('api::assignment-task-learner-progress.assignment-task-learner-progress').create({
      data: {
        assignmentTask: fixture.assignment1TaskTodo.id,
        learner: fixture.learnerB.id,
        status: 'submitted',
        submittedAt: '2026-09-20T10:00:00.000Z',
        score: 8.5,
        teacherFeedback: 'existing-feedback',
        tenant: fixture.tenant.id,
      },
      select: ['id'],
    })

    const updateEarlierCtxB = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      classId: fixture.classEntity.id,
      enrollmentId: enrollmentBId,
      data: {
        learner: fixture.learnerB.id,
        joinDate: '2026-09-15',
        status: 'active',
      },
    })
    await controller.updateEnrollment(updateEarlierCtxB)
    assert.equal(updateEarlierCtxB?.body?.meta?.reconcile?.triggered, true)
    assert.equal(updateEarlierCtxB?.body?.meta?.reconcile?.summary?.attendanceAdded, 2)
    assert.equal(updateEarlierCtxB?.body?.meta?.reconcile?.summary?.assignmentsAdded, 2)

    const keptAttendanceRow = await app.db.query('api::class-session-attendance.class-session-attendance').findOne({
      where: { id: keepAttendance.id },
      select: ['id', 'status', 'note'],
    })
    assert.equal(keptAttendanceRow?.status, 'late')
    assert.equal(keptAttendanceRow?.note, 'existing-note')

    const keptProgressRow = await app.db.query('api::assignment-task-learner-progress.assignment-task-learner-progress').findOne({
      where: { id: keepProgress.id },
      select: ['id', 'status', 'submittedAt', 'score', 'teacherFeedback'],
    })
    assert.equal(keptProgressRow?.status, 'submitted')
    assert.equal(keptProgressRow?.submittedAt, '2026-09-20T10:00:00.000Z')
    assert.equal(Number(keptProgressRow?.score || 0), 8.5)
    assert.equal(keptProgressRow?.teacherFeedback, 'existing-feedback')

    const updateSameEarlierCtxB = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      classId: fixture.classEntity.id,
      enrollmentId: enrollmentBId,
      data: {
        learner: fixture.learnerB.id,
        joinDate: '2026-09-15',
        status: 'active',
      },
    })
    await controller.updateEnrollment(updateSameEarlierCtxB)
    assert.equal(updateSameEarlierCtxB?.body?.meta?.reconcile?.triggered, false)

    const attendanceBCount = await app.db.query('api::class-session-attendance.class-session-attendance').count({
      where: {
        learner: { id: { $eq: fixture.learnerB.id } },
        classSession: { id: { $in: [fixture.session1.id, fixture.session2.id, fixture.session3.id] } },
      },
    })
    assert.equal(Number(attendanceBCount || 0), 3)

    const progressBCount = await app.db.query('api::assignment-task-learner-progress.assignment-task-learner-progress').count({
      where: {
        learner: { id: { $eq: fixture.learnerB.id } },
        assignmentTask: { id: { $in: [fixture.assignment1TaskTodo.id, fixture.assignment1TaskAssessment.id, fixture.assignment2TaskSubmission.id] } },
      },
    })
    assert.equal(Number(progressBCount || 0), 3)

    const updateLaterCtxB = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      classId: fixture.classEntity.id,
      enrollmentId: enrollmentBId,
      data: {
        learner: fixture.learnerB.id,
        joinDate: '2026-10-05',
        status: 'active',
      },
    })
    await controller.updateEnrollment(updateLaterCtxB)
    assert.equal(updateLaterCtxB?.body?.meta?.reconcile?.triggered, true)
    assert.equal(updateLaterCtxB?.body?.meta?.reconcile?.summary?.attendanceAdded, 0)
    assert.equal(updateLaterCtxB?.body?.meta?.reconcile?.summary?.taskProgressAdded, 0)

    const attendanceBAfterLateJoin = await app.db.query('api::class-session-attendance.class-session-attendance').count({
      where: {
        learner: { id: { $eq: fixture.learnerB.id } },
        classSession: { id: { $in: [fixture.session1.id, fixture.session2.id, fixture.session3.id] } },
      },
    })
    assert.equal(Number(attendanceBAfterLateJoin || 0), 3, 'late joinDate update must not delete historical attendance')

    const progressBAfterLateJoin = await app.db.query('api::assignment-task-learner-progress.assignment-task-learner-progress').count({
      where: {
        learner: { id: { $eq: fixture.learnerB.id } },
        assignmentTask: { id: { $in: [fixture.assignment1TaskTodo.id, fixture.assignment1TaskAssessment.id, fixture.assignment2TaskSubmission.id] } },
      },
    })
    assert.equal(Number(progressBAfterLateJoin || 0), 3, 'late joinDate update must not delete historical progress')

    const attemptsB = await app.db.query('api::assessment-attempt.assessment-attempt').findMany({
      where: {
        learner: { id: { $eq: fixture.learnerB.id } },
      },
      select: ['id'],
    })
    assert.equal(attemptsB.length, 0, 'reconcile must not create assessment attempts')
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) {
      await action()
    }
  }
})
