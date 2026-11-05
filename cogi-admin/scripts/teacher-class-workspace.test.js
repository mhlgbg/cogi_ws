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
      timezone: '(GMT+07:00) Asia/Ho_Chi_Minh',
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

async function ensureFeature(cleanup, groupCode, featureKey, featureName, featurePath) {
  let group = await app.db.query('api::feature-group.feature-group').findOne({ where: { code: groupCode }, select: ['id'] })
  if (!group?.id) {
    group = await app.db.query('api::feature-group.feature-group').create({
      data: {
        name: 'Class',
        code: groupCode,
        order: 13,
        icon: 'cilLibrary',
      },
      select: ['id'],
    })
    cleanup.push(() => destroyEntity('api::feature-group.feature-group', group.id))
  }

  let feature = await app.db.query('api::feature.feature').findOne({ where: { key: featureKey }, select: ['id', 'key'] })
  if (!feature?.id) {
    feature = await app.db.query('api::feature.feature').create({
      data: {
        name: featureName,
        key: featureKey,
        group: group.id,
        order: 1,
        description: featureName,
        path: featurePath,
      },
      select: ['id', 'key'],
    })
    cleanup.push(() => destroyEntity('api::feature.feature', feature.id))
  }

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
    select: ['id', 'name', 'subjectCode', 'subject'],
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

async function createLearner(tenantId, label) {
  return app.db.query('api::learner.learner').create({
    data: {
      code: label.toUpperCase(),
      fullName: `Learner ${label}`,
      learnerStatus: 'active',
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
      joinDate: options.joinDate || '2026-09-01',
      leaveDate: options.leaveDate || null,
      enrollmentStatus: options.enrollmentStatus || 'active',
      tenant: tenantId,
    },
    select: ['id'],
  })
}

async function createClassSession(tenantId, classId, teacherId, data = {}) {
  return app.db.query('api::class-session.class-session').create({
    data: {
      class: classId,
      teacher: teacherId,
      sessionDate: data.sessionDate || '2026-09-10',
      startTime: data.startTime || '18:00:00',
      endTime: data.endTime || '19:30:00',
      room: data.room || null,
      location: data.location || null,
      status: data.status || 'scheduled',
      lessonContent: data.lessonContent || null,
      homework: data.homework || null,
      teacherComment: data.teacherComment || null,
      completedAt: data.completedAt || null,
      completedBy: data.completedBy || null,
      tenant: tenantId,
    },
    select: ['id', 'sessionDate', 'startTime', 'endTime', 'status'],
  })
}

function createCtx({ tenant, user, params = {}, data = {}, query = {} }) {
  return {
    params,
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
    forbidden(message) {
      this.status = 403
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

async function withMockedNow(isoText, run) {
  const RealDate = Date
  const fixedNow = new RealDate(isoText)

  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixedNow.getTime())
        return
      }
      super(...args)
    }

    static now() {
      return fixedNow.getTime()
    }

    static parse(value) {
      return RealDate.parse(value)
    }

    static UTC(...args) {
      return RealDate.UTC(...args)
    }
  }

  global.Date = MockDate
  try {
    return await run()
  } finally {
    global.Date = RealDate
  }
}

async function createFixture() {
  const cleanup = []
  const key = uniqueKey('teacher-class-workspace')

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
  const secondTeacher = await createUser(`${key}-second-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', secondTeacher.id))
  const outsiderTeacher = await createUser(`${key}-outsider-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', outsiderTeacher.id))

  const adminMembership = await createUserTenant(adminUser.id, tenant.id, `${key}-admin`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', adminMembership.id))
  const mainMembership = await createUserTenant(mainTeacher.id, tenant.id, `${key}-main`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', mainMembership.id))
  const assignedMembership = await createUserTenant(assignedTeacher.id, tenant.id, `${key}-assigned`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', assignedMembership.id))
  const secondMembership = await createUserTenant(secondTeacher.id, tenant.id, `${key}-second`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', secondMembership.id))
  const outsiderMembership = await createUserTenant(outsiderTeacher.id, outsiderTenant.id, `${key}-outsider`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', outsiderMembership.id))

  const pluginRole = await createPluginRole(`${key}-class-admin`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.role', pluginRole.id))
  const teacherRole = await createPluginRole(`${key}-class-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.role', teacherRole.id))
  const classManageFeature = await ensureFeature(cleanup, 'class', 'class.manage', 'Class Management', '/classes')
  const teacherWorkspaceFeature = await ensureFeature(cleanup, 'class', 'class.teacher-workspace', 'Teacher Classes', '/teacher/classes')
  const teacherSessionsFeature = await ensureFeature(cleanup, 'class', 'class.teacher-sessions', 'Teacher Sessions', '/teacher/sessions')
  const roleFeature1 = await createRoleFeature(pluginRole.id, classManageFeature.id)
  const roleFeature2 = await createRoleFeature(pluginRole.id, teacherWorkspaceFeature.id)
  const roleFeature3 = await createRoleFeature(pluginRole.id, teacherSessionsFeature.id)
  const teacherRoleFeature1 = await createRoleFeature(teacherRole.id, teacherWorkspaceFeature.id)
  const teacherRoleFeature2 = await createRoleFeature(teacherRole.id, teacherSessionsFeature.id)
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature1.id))
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature2.id))
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature3.id))
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', teacherRoleFeature1.id))
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', teacherRoleFeature2.id))
  const adminTenantRole = await createUserTenantRole(adminMembership.id, pluginRole.id, `${key}-admin`)
  const mainTenantRole = await createUserTenantRole(mainMembership.id, teacherRole.id, `${key}-main`)
  const assignedTenantRole = await createUserTenantRole(assignedMembership.id, teacherRole.id, `${key}-assigned`)
  const secondTenantRole = await createUserTenantRole(secondMembership.id, teacherRole.id, `${key}-second`)
  const outsiderTenantRole = await createUserTenantRole(outsiderMembership.id, teacherRole.id, `${key}-outsider`)
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', adminTenantRole.id))
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', mainTenantRole.id))
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', assignedTenantRole.id))
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', secondTenantRole.id))
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', outsiderTenantRole.id))

  const classWithAssignment = await createClass(tenant.id, mainTeacher.id, `${key}-assigned-class`)
  cleanup.push(() => destroyEntity('api::class.class', classWithAssignment.id))
  const classViaSession = await createClass(tenant.id, secondTeacher.id, `${key}-session-only-class`)
  cleanup.push(() => destroyEntity('api::class.class', classViaSession.id))
  const foreignClass = await createClass(tenant.id, secondTeacher.id, `${key}-foreign-class`)
  cleanup.push(() => destroyEntity('api::class.class', foreignClass.id))

  const assignment = await createTeacherAssignment(tenant.id, classWithAssignment.id, assignedTeacher.id, `${key}-assignment`)
  cleanup.push(() => destroyEntity('api::class-teacher-assignment.class-teacher-assignment', assignment.id))

  const learner1 = await createLearner(tenant.id, `${key}-learner-1`)
  cleanup.push(() => destroyEntity('api::learner.learner', learner1.id))
  const learner2 = await createLearner(tenant.id, `${key}-learner-2`)
  cleanup.push(() => destroyEntity('api::learner.learner', learner2.id))
  const outsiderLearner = await createLearner(outsiderTenant.id, `${key}-outsider-learner`)
  cleanup.push(() => destroyEntity('api::learner.learner', outsiderLearner.id))

  const enrollment1 = await createEnrollment(tenant.id, classWithAssignment.id, learner1.id)
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollment1.id))
  const enrollment2 = await createEnrollment(tenant.id, classWithAssignment.id, learner2.id)
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollment2.id))

  const mySession = await createClassSession(tenant.id, classWithAssignment.id, assignedTeacher.id, { sessionDate: '2026-09-10', status: 'scheduled' })
  cleanup.push(() => destroyEntity('api::class-session.class-session', mySession.id))
  const otherTeacherSessionSameClass = await createClassSession(tenant.id, classWithAssignment.id, mainTeacher.id, { sessionDate: '2026-09-11', status: 'scheduled' })
  cleanup.push(() => destroyEntity('api::class-session.class-session', otherTeacherSessionSameClass.id))
  const sessionOnlyClassSession = await createClassSession(tenant.id, classViaSession.id, assignedTeacher.id, { sessionDate: '2026-09-12', status: 'scheduled' })
  cleanup.push(() => destroyEntity('api::class-session.class-session', sessionOnlyClassSession.id))
  const cancelledSession = await createClassSession(tenant.id, classWithAssignment.id, assignedTeacher.id, { sessionDate: '2026-09-09', status: 'cancelled' })
  cleanup.push(() => destroyEntity('api::class-session.class-session', cancelledSession.id))
  const foreignSession = await createClassSession(tenant.id, foreignClass.id, secondTeacher.id, { sessionDate: '2026-09-12', status: 'scheduled' })
  cleanup.push(() => destroyEntity('api::class-session.class-session', foreignSession.id))

  return {
    cleanup,
    tenant,
    outsiderTenant,
    adminUser,
    mainTeacher,
    assignedTeacher,
    secondTeacher,
    outsiderTeacher,
    classWithAssignment,
    classViaSession,
    foreignClass,
    learner1,
    learner2,
    outsiderLearner,
    mySession,
    otherTeacherSessionSameClass,
    sessionOnlyClassSession,
    cancelledSession,
    foreignSession,
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

test('teacher workspace lists only accessible classes and blocks direct URL access to foreign class', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const listCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher })
    await controller.listTeacherClasses(listCtx)

    assert.equal(listCtx.status, 200)
    assert.equal(Array.isArray(listCtx.body?.data), true)
    const classIds = listCtx.body.data.map((item) => item.id).sort((a, b) => a - b)
    assert.deepEqual(classIds, [fixture.classWithAssignment.id, fixture.classViaSession.id].sort((a, b) => a - b))

    const detailCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher, params: { classId: fixture.classWithAssignment.id } })
    await controller.getTeacherClass(detailCtx)
    assert.equal(detailCtx.status, 200)
    assert.equal(detailCtx.body?.data?.permissions?.canEditEnrollments, false)
    assert.equal(detailCtx.body?.data?.learners?.length, 2)

    const forbiddenClassCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher, params: { classId: fixture.foreignClass.id } })
    await controller.getTeacherClass(forbiddenClassCtx)
    assert.equal(forbiddenClassCtx.status, 404)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})

test('teacher sessions list shows only assigned sessions while class session listing can expose read-only sessions', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const sessionListCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher })
    await controller.listTeacherSessions(sessionListCtx)
    assert.equal(sessionListCtx.status, 200)
    const sessionIds = sessionListCtx.body.data.map((item) => item.id).sort((a, b) => a - b)
    assert.deepEqual(sessionIds, [fixture.mySession.id, fixture.sessionOnlyClassSession.id, fixture.cancelledSession.id].sort((a, b) => a - b))

    const classSessionsCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher, params: { classId: fixture.classWithAssignment.id } })
    await controller.listTeacherClassSessions(classSessionsCtx)
    assert.equal(classSessionsCtx.status, 200)
    assert.equal(classSessionsCtx.body?.data?.length, 3)

    const ownRow = classSessionsCtx.body.data.find((item) => item.id === fixture.mySession.id)
    const readOnlyRow = classSessionsCtx.body.data.find((item) => item.id === fixture.otherTeacherSessionSameClass.id)
    assert.equal(ownRow?.permissions?.canMarkAttendance, true)
    assert.equal(readOnlyRow?.permissions?.canMarkAttendance, false)

    const readOnlyDetailCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher, params: { sessionId: fixture.otherTeacherSessionSameClass.id } })
    await controller.getTeacherSession(readOnlyDetailCtx)
    assert.equal(readOnlyDetailCtx.status, 200)
    assert.equal(readOnlyDetailCtx.body?.data?.permissions?.canEditReport, false)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})

test('teacher sessions mark today upcoming pending-report and completed in tenant timezone while excluding other teachers', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  const todaySession = await createClassSession(fixture.tenant.id, fixture.classWithAssignment.id, fixture.assignedTeacher.id, {
    sessionDate: '2026-09-08',
    startTime: '19:00:00',
    endTime: '19:45:00',
    status: 'in_progress',
  })
  fixture.cleanup.push(() => destroyEntity('api::class-session.class-session', todaySession.id))

  const otherTeacherTodaySession = await createClassSession(fixture.tenant.id, fixture.classWithAssignment.id, fixture.mainTeacher.id, {
    sessionDate: '2026-09-08',
    startTime: '19:00:00',
    endTime: '19:45:00',
    status: 'in_progress',
  })
  fixture.cleanup.push(() => destroyEntity('api::class-session.class-session', otherTeacherTodaySession.id))

  const upcomingSession = await createClassSession(fixture.tenant.id, fixture.classWithAssignment.id, fixture.assignedTeacher.id, {
    sessionDate: '2026-09-09',
    startTime: '18:00:00',
    endTime: '18:45:00',
    status: 'scheduled',
  })
  fixture.cleanup.push(() => destroyEntity('api::class-session.class-session', upcomingSession.id))

  const pendingReportSession = await createClassSession(fixture.tenant.id, fixture.classWithAssignment.id, fixture.assignedTeacher.id, {
    sessionDate: '2026-09-08',
    startTime: '17:00:00',
    endTime: '17:45:00',
    status: 'scheduled',
  })
  fixture.cleanup.push(() => destroyEntity('api::class-session.class-session', pendingReportSession.id))

  const completedSession = await createClassSession(fixture.tenant.id, fixture.classWithAssignment.id, fixture.assignedTeacher.id, {
    sessionDate: '2026-09-08',
    startTime: '15:00:00',
    endTime: '15:45:00',
    status: 'completed',
  })
  fixture.cleanup.push(() => destroyEntity('api::class-session.class-session', completedSession.id))

  try {
    await withMockedNow('2026-09-08T12:30:00.000Z', async () => {
      const sessionListCtx = createCtx({ tenant: fixture.tenant, user: fixture.assignedTeacher })
      await controller.listTeacherSessions(sessionListCtx)
      assert.equal(sessionListCtx.status, 200)

      const rows = sessionListCtx.body.data
      const rowIds = rows.map((item) => item.id)
      assert.equal(rowIds.includes(todaySession.id), true)
      assert.equal(rowIds.includes(otherTeacherTodaySession.id), false)

      const todayRow = rows.find((item) => item.id === todaySession.id)
      const upcomingRow = rows.find((item) => item.id === upcomingSession.id)
      const pendingReportRow = rows.find((item) => item.id === pendingReportSession.id)
      const completedRow = rows.find((item) => item.id === completedSession.id)

      assert.equal(todayRow?.timing?.isToday, true)
      assert.equal(todayRow?.timing?.isUpcoming, false)
      assert.equal(todayRow?.timing?.needsReport, false)
      assert.equal(todayRow?.status, 'in_progress')

      assert.equal(upcomingRow?.timing?.isToday, false)
      assert.equal(upcomingRow?.timing?.isUpcoming, true)
      assert.equal(upcomingRow?.timing?.needsReport, false)

      assert.equal(pendingReportRow?.timing?.isToday, true)
      assert.equal(pendingReportRow?.timing?.isUpcoming, false)
      assert.equal(pendingReportRow?.timing?.needsReport, true)

      assert.equal(completedRow?.status, 'completed')
      assert.equal(completedRow?.timing?.isToday, true)
      assert.equal(completedRow?.timing?.isUpcoming, false)
      assert.equal(completedRow?.timing?.needsReport, false)
    })
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})

test('teacher can mark attendance and complete only own session, duplicates are blocked, and cancelled sessions are not editable', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const markCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      params: { sessionId: fixture.mySession.id },
      data: {
        items: [
          { learner: fixture.learner1.id, status: 'present' },
          { learner: fixture.learner2.id, status: 'late', note: 'Muon 10 phut' },
        ],
      },
    })
    await controller.saveTeacherSessionAttendance(markCtx)
    assert.equal(markCtx.status, 200)
    assert.equal(markCtx.body?.data?.attendanceSummary?.markedCount, 2)

    const duplicateCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      params: { sessionId: fixture.mySession.id },
      data: {
        items: [
          { learner: fixture.learner1.id, status: 'present' },
          { learner: fixture.learner1.id, status: 'absent' },
        ],
      },
    })
    await controller.saveTeacherSessionAttendance(duplicateCtx)
    assert.equal(duplicateCtx.status, 409)

    const otherTeacherWriteCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      params: { sessionId: fixture.otherTeacherSessionSameClass.id },
      data: { lessonContent: '<p>Should fail</p>' },
    })
    await controller.saveTeacherSessionReport(otherTeacherWriteCtx)
    assert.equal(otherTeacherWriteCtx.status, 403)

    const cancelledWriteCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      params: { sessionId: fixture.cancelledSession.id },
      data: { lessonContent: '<p>Cancelled</p>' },
    })
    await controller.saveTeacherSessionReport(cancelledWriteCtx)
    assert.equal(cancelledWriteCtx.status, 403)

    const reportCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      params: { sessionId: fixture.mySession.id },
      data: {
        lessonContent: '<p>Unit 1</p>',
        homework: '<ul><li>Workbook</li></ul>',
        teacherComment: '<p>Hoc vien hop tac</p>',
      },
    })
    await controller.saveTeacherSessionReport(reportCtx)
    assert.equal(reportCtx.status, 200)
    assert.match(String(reportCtx.body?.data?.lessonContent || ''), /Unit 1/)

    const completeCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      params: { sessionId: fixture.mySession.id },
      data: {
        lessonContent: '<p>Unit 1</p>',
        homework: '<ul><li>Workbook</li></ul>',
        teacherComment: '<p>Hoc vien hop tac</p>',
      },
    })
    await controller.completeTeacherSession(completeCtx)
    assert.equal(completeCtx.status, 200)
    assert.equal(completeCtx.body?.data?.status, 'completed')
    assert.equal(completeCtx.body?.data?.completedBy?.id, fixture.assignedTeacher.id)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})

test('teacher workspace remains tenant-scoped and teacher still cannot create class sessions through admin flow', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const outsiderCtx = createCtx({ tenant: fixture.outsiderTenant, user: fixture.outsiderTeacher, params: { sessionId: fixture.mySession.id } })
    await controller.getTeacherSession(outsiderCtx)
    assert.equal(outsiderCtx.status, 404)

    const createSessionCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.assignedTeacher,
      params: { id: fixture.classWithAssignment.id },
      data: {
        sessionDate: '2026-09-20',
        startTime: '18:00',
        endTime: '19:00',
        teacher: fixture.assignedTeacher.id,
      },
    })
    await controller.createSession(createSessionCtx)
    assert.equal(createSessionCtx.status, 403)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})