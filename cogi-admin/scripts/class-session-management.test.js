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

async function createPluginRole(label) {
  return app.db.query('plugin::users-permissions.role').create({
    data: {
      name: `Role ${label}`,
      description: `Role ${label}`,
      type: `role-${label}`,
    },
    select: ['id', 'type', 'name'],
  })
}

async function ensureClassManageFeature(cleanup, label) {
  const existing = await app.db.query('api::feature.feature').findOne({
    where: { key: 'class.manage' },
    populate: { group: { select: ['id'] } },
  })
  if (existing?.id) return existing

  const group = await app.db.query('api::feature-group.feature-group').create({
    data: {
      name: `Class ${label}`,
      code: `class-${label}`,
      order: 0,
      icon: 'cilLibrary',
    },
    select: ['id'],
  })
  cleanup.push(() => destroyEntity('api::feature-group.feature-group', group.id))

  const feature = await app.db.query('api::feature.feature').create({
    data: {
      name: 'Class Management',
      key: 'class.manage',
      group: group.id,
      order: 1,
      description: 'Manage classes',
      path: '/classes',
    },
    select: ['id', 'key'],
  })
  cleanup.push(() => destroyEntity('api::feature.feature', feature.id))
  return feature
}

async function createRoleFeature(roleId, featureId) {
  return app.db.query('api::role-feature.role-feature').create({
    data: {
      role: roleId,
      feature: featureId,
      isActive: true,
    },
    select: ['id'],
  })
}

async function createUserTenantRole(userTenantId, roleId, label) {
  return app.db.query('api::user-tenant-role.user-tenant-role').create({
    data: {
      userTenant: userTenantId,
      role: roleId,
      userTenantRoleStatus: 'active',
      label: `Role ${label}`,
      isPrimary: true,
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

async function createTeacherAssignment(tenantId, classId, teacherId, label, options = {}) {
  return app.db.query('api::class-teacher-assignment.class-teacher-assignment').create({
    data: {
      class: classId,
      teacher: teacherId,
      subjectCode: options.subjectCode || 'ENG',
      subject: options.subject || 'English',
      role: options.role || 'co_teacher',
      startDate: options.startDate || '2026-09-01',
      endDate: options.endDate || '2026-12-31',
      assignmentStatus: options.assignmentStatus || 'active',
      isPayable: true,
      note: `Assignment ${label}`,
      tenant: tenantId,
    },
    select: ['id'],
  })
}

async function createLearner(tenantId, label, options = {}) {
  return app.db.query('api::learner.learner').create({
    data: {
      code: options.code || label.toUpperCase(),
      fullName: options.fullName || `Learner ${label}`,
      email: options.email || null,
      phone: options.phone || null,
      learnerStatus: options.learnerStatus || 'active',
      user: null,
      tenant: tenantId,
    },
    select: ['id', 'code', 'fullName'],
  })
}

async function createEnrollment(tenantId, classId, learnerId, options = {}) {
  return app.db.query('api::enrollment.enrollment').create({
    data: {
      learner: learnerId,
      class: classId,
      joinDate: options.joinDate || null,
      leaveDate: options.leaveDate || null,
      enrollmentStatus: options.enrollmentStatus || 'active',
      tenant: tenantId,
    },
    select: ['id', 'joinDate', 'leaveDate', 'enrollmentStatus'],
  })
}

function createCtx({ tenant, user, classId, sessionId = null, data = {}, query = {} }) {
  return {
    params: {
      id: classId,
      ...(sessionId ? { sessionId } : {}),
    },
    query,
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
  const key = uniqueKey('class-session')

  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  const outsiderTenant = await createTenant(`${key}-outsider-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', outsiderTenant.id))

  const adminUser = await createUser(`${key}-admin`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', adminUser.id))

  const mainTeacher = await createUser(`${key}-main-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', mainTeacher.id))

  const assignedTeacher = await createUser(`${key}-assigned-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', assignedTeacher.id))

  const unassignedTeacher = await createUser(`${key}-unassigned-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', unassignedTeacher.id))

  const outsiderTeacher = await createUser(`${key}-outsider-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', outsiderTeacher.id))

  const adminMembership = await createUserTenant(adminUser.id, tenant.id, `${key}-admin`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', adminMembership.id))

  const mainTeacherMembership = await createUserTenant(mainTeacher.id, tenant.id, `${key}-main`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', mainTeacherMembership.id))

  const assignedTeacherMembership = await createUserTenant(assignedTeacher.id, tenant.id, `${key}-assigned`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', assignedTeacherMembership.id))

  const unassignedTeacherMembership = await createUserTenant(unassignedTeacher.id, tenant.id, `${key}-unassigned`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', unassignedTeacherMembership.id))

  const outsiderTeacherMembership = await createUserTenant(outsiderTeacher.id, outsiderTenant.id, `${key}-outsider`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', outsiderTeacherMembership.id))

  const pluginRole = await createPluginRole(`${key}-class-admin`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.role', pluginRole.id))

  const classManageFeature = await ensureClassManageFeature(cleanup, key)
  const roleFeature = await createRoleFeature(pluginRole.id, classManageFeature.id)
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature.id))

  const adminTenantRole = await createUserTenantRole(adminMembership.id, pluginRole.id, `${key}-admin`)
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', adminTenantRole.id))

  const classEntity = await createClass(tenant.id, mainTeacher.id, `${key}-class`)
  cleanup.push(() => destroyEntity('api::class.class', classEntity.id))

  const secondClass = await createClass(tenant.id, mainTeacher.id, `${key}-second-class`)
  cleanup.push(() => destroyEntity('api::class.class', secondClass.id))

  const teacherAssignment = await createTeacherAssignment(tenant.id, classEntity.id, assignedTeacher.id, `${key}-assigned-teacher`)
  cleanup.push(() => destroyEntity('api::class-teacher-assignment.class-teacher-assignment', teacherAssignment.id))

  const learnerStayed = await createLearner(tenant.id, `${key}-learner-stayed`)
  cleanup.push(() => destroyEntity('api::learner.learner', learnerStayed.id))

  const learnerLeft = await createLearner(tenant.id, `${key}-learner-left`)
  cleanup.push(() => destroyEntity('api::learner.learner', learnerLeft.id))

  const learnerFuture = await createLearner(tenant.id, `${key}-learner-future`)
  cleanup.push(() => destroyEntity('api::learner.learner', learnerFuture.id))

  const outsiderLearner = await createLearner(outsiderTenant.id, `${key}-outsider-learner`)
  cleanup.push(() => destroyEntity('api::learner.learner', outsiderLearner.id))

  const enrollmentStayed = await createEnrollment(tenant.id, classEntity.id, learnerStayed.id, {
    joinDate: '2026-09-01',
    leaveDate: null,
    enrollmentStatus: 'active',
  })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollmentStayed.id))

  const enrollmentLeft = await createEnrollment(tenant.id, classEntity.id, learnerLeft.id, {
    joinDate: '2026-09-01',
    leaveDate: '2026-09-20',
    enrollmentStatus: 'active',
  })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollmentLeft.id))

  const enrollmentFuture = await createEnrollment(tenant.id, classEntity.id, learnerFuture.id, {
    joinDate: '2026-09-11',
    leaveDate: null,
    enrollmentStatus: 'active',
  })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollmentFuture.id))

  return {
    cleanup,
    tenant,
    outsiderTenant,
    adminUser,
    mainTeacher,
    assignedTeacher,
    unassignedTeacher,
    outsiderTeacher,
    classEntity,
    secondClass,
    learnerStayed,
    learnerLeft,
    learnerFuture,
    outsiderLearner,
    enrollmentLeft,
  }
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  const authenticatedRole = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] })
  authenticatedRoleId = Number(authenticatedRole?.id || 0)
  assert.ok(authenticatedRoleId > 0, 'authenticated role must exist')
})

after(async () => {
  if (app) await app.destroy()
})

test('admin can create class sessions, bulk create, and duplicate sessions are skipped or blocked', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const createSessionCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.adminUser,
      classId: fixture.classEntity.id,
      data: {
        sessionDate: '2026-09-10',
        startTime: '18:00',
        endTime: '19:30',
        teacher: fixture.assignedTeacher.id,
        room: 'P.101',
        location: 'Co Gi campus',
        note: 'Buoi dau tien',
      },
    })
    await controller.createSession(createSessionCtx)

    assert.equal(createSessionCtx.status, 200)
    assert.equal(createSessionCtx.body?.data?.sessionDate, '2026-09-10')
    assert.equal(createSessionCtx.body?.data?.teacher?.id, fixture.assignedTeacher.id)
    assert.equal(createSessionCtx.body?.data?.attendanceSummary?.eligibleCount, 2)

    const duplicateCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.adminUser,
      classId: fixture.classEntity.id,
      data: {
        sessionDate: '2026-09-10',
        startTime: '18:00',
        endTime: '19:30',
        teacher: fixture.assignedTeacher.id,
      },
    })
    await controller.createSession(duplicateCtx)

    assert.equal(duplicateCtx.status, 409)
    assert.match(String(duplicateCtx.body?.error?.message || ''), /already exists/i)

    const bulkCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.adminUser,
      classId: fixture.classEntity.id,
      data: {
        teacher: fixture.assignedTeacher.id,
        items: [
          { sessionDate: '2026-09-12', startTime: '18:00', endTime: '19:30', room: 'P.101' },
          { sessionDate: '2026-09-12', startTime: '18:00', endTime: '19:30', room: 'P.101' },
          { sessionDate: '2026-09-14', startTime: '18:00', endTime: '19:30', room: 'P.101' },
        ],
      },
    })
    await controller.createSessionsBulk(bulkCtx)

    assert.equal(bulkCtx.status, 200)
    assert.equal(bulkCtx.body?.data?.summary?.requestedCount, 3)
    assert.equal(bulkCtx.body?.data?.summary?.createdCount, 2)
    assert.equal(bulkCtx.body?.data?.summary?.skippedCount, 1)

    const listCtx = createCtx({ tenant: fixture.tenant, user: fixture.adminUser, classId: fixture.classEntity.id })
    await controller.listSessions(listCtx)
    assert.equal(listCtx.status, 200)
    assert.equal(Array.isArray(listCtx.body?.data), true)
    assert.equal(listCtx.body.data.length, 3)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) {
      await action()
    }
  }
})

test('teacher permissions are enforced for class sessions', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const adminCreateCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.adminUser,
      classId: fixture.classEntity.id,
      data: {
        sessionDate: '2026-09-10',
        startTime: '18:00',
        endTime: '19:30',
        teacher: fixture.assignedTeacher.id,
      },
    })
    await controller.createSession(adminCreateCtx)
    assert.equal(adminCreateCtx.status, 200)
    const sessionId = adminCreateCtx.body?.data?.id

    const teacherCreateCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      classId: fixture.classEntity.id,
      data: {
        sessionDate: '2026-09-11',
        startTime: '18:00',
        endTime: '19:30',
        teacher: fixture.assignedTeacher.id,
      },
    })
    await controller.createSession(teacherCreateCtx)
    assert.equal(teacherCreateCtx.status, 403)

    const teacherListCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher, classId: fixture.classEntity.id })
    await controller.listSessions(teacherListCtx)
    assert.equal(teacherListCtx.status, 200)
    assert.equal(teacherListCtx.body?.data?.length, 1)

    const teacherDetailCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher, classId: fixture.classEntity.id, sessionId })
    await controller.getSession(teacherDetailCtx)
    assert.equal(teacherDetailCtx.status, 200)
    assert.equal(teacherDetailCtx.body?.data?.permissions?.canTeach, true)
    assert.equal(teacherDetailCtx.body?.data?.permissions?.canEditSchedule, false)

    const teacherUpdateCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      classId: fixture.classEntity.id,
      sessionId,
      data: { room: 'P.202' },
    })
    await controller.updateSession(teacherUpdateCtx)
    assert.equal(teacherUpdateCtx.status, 403)

    const unassignedTeacherDetailCtx = createCtx({ tenant: fixture.tenant, user: fixture.unassignedTeacher, classId: fixture.classEntity.id, sessionId })
    await controller.getSession(unassignedTeacherDetailCtx)
    assert.equal(unassignedTeacherDetailCtx.status, 403)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) {
      await action()
    }
  }
})

test('eligible learners follow join and leave dates, outsider learners are blocked, and attendance history survives enrollment changes', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const adminCreateCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.adminUser,
      classId: fixture.classEntity.id,
      data: {
        sessionDate: '2026-09-10',
        startTime: '18:00',
        endTime: '19:30',
        teacher: fixture.assignedTeacher.id,
      },
    })
    await controller.createSession(adminCreateCtx)
    assert.equal(adminCreateCtx.status, 200)
    const sessionId = adminCreateCtx.body?.data?.id

    const teacherDetailBeforeCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher, classId: fixture.classEntity.id, sessionId })
    await controller.getSession(teacherDetailBeforeCtx)
    assert.equal(teacherDetailBeforeCtx.status, 200)
    const beforeLearnerIds = teacherDetailBeforeCtx.body.data.eligibleLearners.map((item) => item.learner.id)
    assert.deepEqual(beforeLearnerIds.sort((a, b) => a - b), [fixture.learnerStayed.id, fixture.learnerLeft.id].sort((a, b) => a - b))

    const outsiderAttendanceCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      classId: fixture.classEntity.id,
      sessionId,
      data: {
        items: [
          { learner: fixture.outsiderLearner.id, status: 'present' },
        ],
      },
    })
    await controller.saveSessionAttendance(outsiderAttendanceCtx)
    assert.equal(outsiderAttendanceCtx.status, 400)
    assert.match(String(outsiderAttendanceCtx.body?.error?.message || ''), /not eligible|current tenant/i)

    const attendanceCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      classId: fixture.classEntity.id,
      sessionId,
      data: {
        items: [
          { learner: fixture.learnerStayed.id, status: 'present' },
          { learner: fixture.learnerLeft.id, status: 'absent', note: 'Bao nghi' },
        ],
      },
    })
    await controller.saveSessionAttendance(attendanceCtx)
    assert.equal(attendanceCtx.status, 200)
    assert.equal(attendanceCtx.body?.data?.attendanceSummary?.markedCount, 2)
    assert.equal(attendanceCtx.body?.data?.attendanceSummary?.presentCount, 1)
    assert.equal(attendanceCtx.body?.data?.attendanceSummary?.absentCount, 1)
    assert.equal(attendanceCtx.body?.data?.status, 'in_progress')

    const duplicatePayloadCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      classId: fixture.classEntity.id,
      sessionId,
      data: {
        items: [
          { learner: fixture.learnerStayed.id, status: 'present' },
          { learner: fixture.learnerStayed.id, status: 'late' },
        ],
      },
    })
    await controller.saveSessionAttendance(duplicatePayloadCtx)
    assert.equal(duplicatePayloadCtx.status, 409)

    await app.db.query('api::enrollment.enrollment').update({
      where: { id: fixture.enrollmentLeft.id },
      data: {
        leaveDate: '2026-09-05',
        enrollmentStatus: 'inactive',
      },
    })

    const teacherDetailAfterCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher, classId: fixture.classEntity.id, sessionId })
    await controller.getSession(teacherDetailAfterCtx)
    assert.equal(teacherDetailAfterCtx.status, 200)
    const learnerLeftRow = teacherDetailAfterCtx.body.data.eligibleLearners.find((item) => item.learner.id === fixture.learnerLeft.id)
    assert.ok(learnerLeftRow)
    assert.equal(learnerLeftRow.historicalOnly, true)
    assert.equal(learnerLeftRow.attendance?.status, 'absent')
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) {
      await action()
    }
  }
})

test('teacher can save report and complete session, admin can cancel without deleting record, and tenant scope blocks cross-tenant access', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const createCtxOne = createCtx({
      tenant: fixture.tenant,
      user: fixture.adminUser,
      classId: fixture.classEntity.id,
      data: {
        sessionDate: '2026-09-10',
        startTime: '18:00',
        endTime: '19:30',
        teacher: fixture.assignedTeacher.id,
      },
    })
    await controller.createSession(createCtxOne)
    assert.equal(createCtxOne.status, 200)
    const reportSessionId = createCtxOne.body?.data?.id

    const createCtxTwo = createCtx({
      tenant: fixture.tenant,
      user: fixture.adminUser,
      classId: fixture.classEntity.id,
      data: {
        sessionDate: '2026-09-12',
        startTime: '18:00',
        endTime: '19:30',
        teacher: fixture.assignedTeacher.id,
      },
    })
    await controller.createSession(createCtxTwo)
    assert.equal(createCtxTwo.status, 200)
    const cancelSessionId = createCtxTwo.body?.data?.id

    const updateReportCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      classId: fixture.classEntity.id,
      sessionId: reportSessionId,
      data: {
        lessonContent: 'Unit 1',
        homework: 'Workbook page 10',
        teacherComment: 'Lop hoc tot',
      },
    })
    await controller.updateSessionReport(updateReportCtx)
    assert.equal(updateReportCtx.status, 200)
    assert.equal(updateReportCtx.body?.data?.lessonContent, 'Unit 1')
    assert.equal(updateReportCtx.body?.data?.status, 'in_progress')

    const completeCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      classId: fixture.classEntity.id,
      sessionId: reportSessionId,
      data: {
        homework: 'Workbook page 10',
        teacherComment: 'Lop hoc tot',
      },
    })
    await controller.completeSession(completeCtx)
    assert.equal(completeCtx.status, 200)
    assert.equal(completeCtx.body?.data?.status, 'completed')
    assert.ok(completeCtx.body?.data?.completedAt)
    assert.equal(completeCtx.body?.data?.completedBy?.id, fixture.assignedTeacher.id)

    const cancelCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.adminUser,
      classId: fixture.classEntity.id,
      sessionId: cancelSessionId,
      data: {
        cancelReason: 'Teacher unavailable',
      },
    })
    await controller.cancelSession(cancelCtx)
    assert.equal(cancelCtx.status, 200)
    assert.equal(cancelCtx.body?.data?.status, 'cancelled')
    assert.equal(cancelCtx.body?.data?.cancelReason, 'Teacher unavailable')

    const storedCancelled = await app.db.query('api::class-session.class-session').findOne({
      where: { id: cancelSessionId },
      select: ['id', 'status', 'cancelReason'],
    })
    assert.equal(storedCancelled?.id, cancelSessionId)
    assert.equal(storedCancelled?.status, 'cancelled')

    const outsiderAccessCtx = createCtx({
      tenant: fixture.outsiderTenant,
      user: fixture.outsiderTeacher,
      classId: fixture.classEntity.id,
      sessionId: reportSessionId,
    })
    await controller.getSession(outsiderAccessCtx)
    assert.equal(outsiderAccessCtx.status, 404)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) {
      await action()
    }
  }
})