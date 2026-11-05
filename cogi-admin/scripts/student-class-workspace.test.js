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

async function ensureFeature(cleanup, groupCode, featureKey, featureName, featurePath, order = 1) {
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
        order,
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

async function createLearner(tenantId, userId, label) {
  return app.db.query('api::learner.learner').create({
    data: {
      code: label.toUpperCase(),
      fullName: `Learner ${label}`,
      learnerStatus: 'active',
      tenant: tenantId,
      user: userId,
    },
    select: ['id', 'code', 'fullName', 'learnerStatus'],
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
    select: ['id', 'joinDate', 'leaveDate', 'enrollmentStatus'],
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

async function createAttendance(tenantId, sessionId, learnerId, status = 'present', note = '') {
  return app.db.query('api::class-session-attendance.class-session-attendance').create({
    data: {
      classSession: sessionId,
      learner: learnerId,
      status,
      note: note || null,
      tenant: tenantId,
    },
    select: ['id', 'status', 'note'],
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

async function createFixture() {
  const cleanup = []
  const key = uniqueKey('student-class-workspace')

  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const outsiderTenant = await createTenant(`${key}-outsider-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', outsiderTenant.id))

  const portalUser = await createUser(`${key}-portal-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', portalUser.id))
  const noLearnerUser = await createUser(`${key}-no-learner-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', noLearnerUser.id))
  const teacherA = await createUser(`${key}-teacher-a`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', teacherA.id))
  const teacherB = await createUser(`${key}-teacher-b`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', teacherB.id))

  const portalMembership = await createUserTenant(portalUser.id, tenant.id, `${key}-portal-main`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', portalMembership.id))
  const portalOutsiderMembership = await createUserTenant(portalUser.id, outsiderTenant.id, `${key}-portal-outsider`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', portalOutsiderMembership.id))
  const noLearnerMembership = await createUserTenant(noLearnerUser.id, tenant.id, `${key}-no-learner`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', noLearnerMembership.id))
  const teacherMembershipA = await createUserTenant(teacherA.id, tenant.id, `${key}-teacher-a`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', teacherMembershipA.id))
  const teacherMembershipB = await createUserTenant(teacherB.id, tenant.id, `${key}-teacher-b`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', teacherMembershipB.id))

  const studentRole = await createPluginRole(`${key}-student-role`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.role', studentRole.id))

  const studentWorkspaceFeature = await ensureFeature(cleanup, 'class', 'class.student-workspace', 'Student Workspace', '/student', 4)
  const studentClassesFeature = await ensureFeature(cleanup, 'class', 'class.student-classes', 'My Classes', '/student/classes', 5)
  const studentSessionsFeature = await ensureFeature(cleanup, 'class', 'class.student-sessions', 'My Sessions', '/student/sessions', 6)
  const roleFeature1 = await createRoleFeature(studentRole.id, studentWorkspaceFeature.id)
  const roleFeature2 = await createRoleFeature(studentRole.id, studentClassesFeature.id)
  const roleFeature3 = await createRoleFeature(studentRole.id, studentSessionsFeature.id)
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature1.id))
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature2.id))
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature3.id))

  const portalRole = await createUserTenantRole(portalMembership.id, studentRole.id, `${key}-portal-main`)
  const portalOutsiderRole = await createUserTenantRole(portalOutsiderMembership.id, studentRole.id, `${key}-portal-outsider`)
  const noLearnerRole = await createUserTenantRole(noLearnerMembership.id, studentRole.id, `${key}-no-learner`)
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', portalRole.id))
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', portalOutsiderRole.id))
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', noLearnerRole.id))

  const classA = await createClass(tenant.id, teacherA.id, `${key}-class-a`)
  cleanup.push(() => destroyEntity('api::class.class', classA.id))
  const classB = await createClass(tenant.id, teacherB.id, `${key}-class-b`)
  cleanup.push(() => destroyEntity('api::class.class', classB.id))
  const classHistory = await createClass(tenant.id, teacherA.id, `${key}-class-history`)
  cleanup.push(() => destroyEntity('api::class.class', classHistory.id))
  const outsiderClass = await createClass(outsiderTenant.id, teacherB.id, `${key}-outsider-class`)
  cleanup.push(() => destroyEntity('api::class.class', outsiderClass.id))

  const learnerA = await createLearner(tenant.id, portalUser.id, `${key}-learner-a`)
  cleanup.push(() => destroyEntity('api::learner.learner', learnerA.id))
  const learnerB = await createLearner(tenant.id, portalUser.id, `${key}-learner-b`)
  cleanup.push(() => destroyEntity('api::learner.learner', learnerB.id))
  const classmate = await createLearner(tenant.id, portalUser.id, `${key}-classmate`)
  cleanup.push(() => destroyEntity('api::learner.learner', classmate.id))
  const outsiderLearner = await createLearner(outsiderTenant.id, portalUser.id, `${key}-outsider-learner`)
  cleanup.push(() => destroyEntity('api::learner.learner', outsiderLearner.id))

  const enrollmentA = await createEnrollment(tenant.id, classA.id, learnerA.id, { joinDate: '2026-09-01' })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollmentA.id))
  const enrollmentAHistory = await createEnrollment(tenant.id, classHistory.id, learnerA.id, { joinDate: '2026-09-01', leaveDate: '2026-09-20', enrollmentStatus: 'inactive' })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollmentAHistory.id))
  const enrollmentB = await createEnrollment(tenant.id, classB.id, learnerB.id, { joinDate: '2026-09-01' })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollmentB.id))
  const enrollmentClassmate = await createEnrollment(tenant.id, classA.id, classmate.id, { joinDate: '2026-09-01' })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollmentClassmate.id))
  const outsiderEnrollment = await createEnrollment(outsiderTenant.id, outsiderClass.id, outsiderLearner.id, { joinDate: '2026-09-01' })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', outsiderEnrollment.id))

  const todaySession = await createClassSession(tenant.id, classA.id, teacherA.id, {
    sessionDate: '2026-09-08',
    startTime: '19:00:00',
    endTime: '19:45:00',
    status: 'in_progress',
    lessonContent: '<p>Present simple</p>',
    homework: '<p>Workbook page 10</p>',
    teacherComment: '<p>Tiếp tục luyện phát âm.</p>',
  })
  cleanup.push(() => destroyEntity('api::class-session.class-session', todaySession.id))
  const upcomingSession = await createClassSession(tenant.id, classA.id, teacherA.id, {
    sessionDate: '2026-09-09',
    startTime: '19:00:00',
    endTime: '19:45:00',
    status: 'scheduled',
  })
  cleanup.push(() => destroyEntity('api::class-session.class-session', upcomingSession.id))
  const beforeJoinSession = await createClassSession(tenant.id, classHistory.id, teacherA.id, {
    sessionDate: '2026-08-31',
    startTime: '18:00:00',
    endTime: '18:45:00',
    status: 'completed',
  })
  cleanup.push(() => destroyEntity('api::class-session.class-session', beforeJoinSession.id))
  const historicalVisibleSession = await createClassSession(tenant.id, classHistory.id, teacherA.id, {
    sessionDate: '2026-09-10',
    startTime: '18:00:00',
    endTime: '18:45:00',
    status: 'completed',
  })
  cleanup.push(() => destroyEntity('api::class-session.class-session', historicalVisibleSession.id))
  const learnerBSession = await createClassSession(tenant.id, classB.id, teacherB.id, {
    sessionDate: '2026-09-08',
    startTime: '20:00:00',
    endTime: '20:45:00',
    status: 'scheduled',
  })
  cleanup.push(() => destroyEntity('api::class-session.class-session', learnerBSession.id))
  const cancelledSession = await createClassSession(tenant.id, classA.id, teacherA.id, {
    sessionDate: '2026-09-07',
    startTime: '19:00:00',
    endTime: '19:45:00',
    status: 'cancelled',
  })
  cleanup.push(() => destroyEntity('api::class-session.class-session', cancelledSession.id))

  const attendanceMine = await createAttendance(tenant.id, todaySession.id, learnerA.id, 'late', 'Đến muộn 5 phút')
  cleanup.push(() => destroyEntity('api::class-session-attendance.class-session-attendance', attendanceMine.id))
  const attendanceOther = await createAttendance(tenant.id, todaySession.id, classmate.id, 'absent', 'Nghỉ học')
  cleanup.push(() => destroyEntity('api::class-session-attendance.class-session-attendance', attendanceOther.id))

  return {
    cleanup,
    tenant,
    outsiderTenant,
    portalUser,
    noLearnerUser,
    learnerA,
    learnerB,
    classmate,
    outsiderLearner,
    classA,
    classB,
    classHistory,
    todaySession,
    upcomingSession,
    beforeJoinSession,
    historicalVisibleSession,
    learnerBSession,
    cancelledSession,
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

test('student context supports multi-learner selection and tenant scoping', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const ctx = createCtx({ tenant: fixture.tenant, user: fixture.portalUser })
    await controller.getStudentContext(ctx)
    assert.equal(ctx.status, 200)
    assert.equal(ctx.body?.data?.learners?.length, 3)
    assert.equal(ctx.body?.data?.learnerContext, null)
    assert.equal(ctx.body?.data?.requiresLearnerSelection, true)

    const selectedCtx = createCtx({ tenant: fixture.tenant, user: fixture.portalUser, query: { learnerId: fixture.learnerA.id } })
    await controller.getStudentContext(selectedCtx)
    assert.equal(selectedCtx.body?.data?.learnerContext?.id, fixture.learnerA.id)

    const outsiderCtx = createCtx({ tenant: fixture.outsiderTenant, user: fixture.portalUser })
    await controller.getStudentContext(outsiderCtx)
    assert.equal(outsiderCtx.body?.data?.learners?.length, 1)
    assert.equal(outsiderCtx.body?.data?.learnerContext?.id, fixture.outsiderLearner.id)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})

test('student class listing and direct class access follow selected learner context', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const classListCtx = createCtx({ tenant: fixture.tenant, user: fixture.portalUser, query: { learnerId: fixture.learnerA.id } })
    await controller.listStudentClasses(classListCtx)
    assert.equal(classListCtx.status, 200)
    const classIds = classListCtx.body.data.map((item) => item.id).sort((a, b) => a - b)
    assert.deepEqual(classIds, [fixture.classA.id, fixture.classHistory.id].sort((a, b) => a - b))

    const forbiddenDetailCtx = createCtx({ tenant: fixture.tenant, user: fixture.portalUser, params: { classId: fixture.classB.id }, query: { learnerId: fixture.learnerA.id } })
    await controller.getStudentClass(forbiddenDetailCtx)
    assert.equal(forbiddenDetailCtx.status, 403)

    const learnerBClassListCtx = createCtx({ tenant: fixture.tenant, user: fixture.portalUser, query: { learnerId: fixture.learnerB.id } })
    await controller.listStudentClasses(learnerBClassListCtx)
    assert.deepEqual(learnerBClassListCtx.body.data.map((item) => item.id), [fixture.classB.id])
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})

test('student sessions respect enrollment history and switching learner changes visible sessions', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const learnerACtx = createCtx({ tenant: fixture.tenant, user: fixture.portalUser, query: { learnerId: fixture.learnerA.id } })
    await controller.listStudentSessions(learnerACtx)
    assert.equal(learnerACtx.status, 200)
    const learnerASessionIds = learnerACtx.body.data.map((item) => item.id).sort((a, b) => a - b)
    assert.equal(learnerASessionIds.includes(fixture.todaySession.id), true)
    assert.equal(learnerASessionIds.includes(fixture.upcomingSession.id), true)
    assert.equal(learnerASessionIds.includes(fixture.historicalVisibleSession.id), true)
    assert.equal(learnerASessionIds.includes(fixture.cancelledSession.id), true)
    assert.equal(learnerASessionIds.includes(fixture.beforeJoinSession.id), false)
    assert.equal(learnerASessionIds.includes(fixture.learnerBSession.id), false)

    const learnerATodayRow = learnerACtx.body.data.find((item) => item.id === fixture.todaySession.id)
    assert.equal(learnerATodayRow?.myAttendance?.status, 'late')

    const learnerBCtx = createCtx({ tenant: fixture.tenant, user: fixture.portalUser, query: { learnerId: fixture.learnerB.id } })
    await controller.listStudentSessions(learnerBCtx)
    const learnerBSessionIds = learnerBCtx.body.data.map((item) => item.id)
    assert.deepEqual(learnerBSessionIds, [fixture.learnerBSession.id])
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})

test('student session detail exposes only current learner attendance and blocks inaccessible sessions', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const detailCtx = createCtx({ tenant: fixture.tenant, user: fixture.portalUser, params: { sessionId: fixture.todaySession.id }, query: { learnerId: fixture.learnerA.id } })
    await controller.getStudentSession(detailCtx)
    assert.equal(detailCtx.status, 200)
    assert.equal(detailCtx.body?.data?.myAttendance?.status, 'late')
    assert.equal(detailCtx.body?.data?.myAttendance?.note, 'Đến muộn 5 phút')
    assert.equal(Array.isArray(detailCtx.body?.data?.attendanceRows), false)
    assert.equal(Array.isArray(detailCtx.body?.data?.eligibleLearners), false)
    assert.match(String(detailCtx.body?.data?.lessonContent || ''), /Present simple/)
    assert.match(String(detailCtx.body?.data?.homework || ''), /Workbook/)
    assert.match(String(detailCtx.body?.data?.teacherComment || ''), /phát âm/i)

    const inaccessibleCtx = createCtx({ tenant: fixture.tenant, user: fixture.portalUser, params: { sessionId: fixture.beforeJoinSession.id }, query: { learnerId: fixture.learnerA.id } })
    await controller.getStudentSession(inaccessibleCtx)
    assert.equal(inaccessibleCtx.status, 403)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})

test('student context handles user without learner and collection endpoints stay empty', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const contextCtx = createCtx({ tenant: fixture.tenant, user: fixture.noLearnerUser })
    await controller.getStudentContext(contextCtx)
    assert.equal(contextCtx.status, 200)
    assert.equal(contextCtx.body?.data?.learnerState, 'missing')
    assert.equal(contextCtx.body?.data?.learners?.length, 0)

    const sessionsCtx = createCtx({ tenant: fixture.tenant, user: fixture.noLearnerUser })
    await controller.listStudentSessions(sessionsCtx)
    assert.equal(sessionsCtx.status, 200)
    assert.deepEqual(sessionsCtx.body?.data, [])
    assert.equal(sessionsCtx.body?.meta?.context?.learnerState, 'missing')
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})