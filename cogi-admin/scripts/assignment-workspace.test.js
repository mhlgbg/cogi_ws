const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

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

async function createTeacherAssignment(tenantId, classId, teacherId, label) {
  return app.db.query('api::class-teacher-assignment.class-teacher-assignment').create({
    data: {
      class: classId,
      teacher: teacherId,
      subjectCode: 'ENG',
      subject: 'English',
      role: 'co_teacher',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      assignmentStatus: 'active',
      isPayable: true,
      note: `Assignment ${label}`,
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
      sessionDate: data.sessionDate || '2026-09-08',
      startTime: data.startTime || '19:00:00',
      endTime: data.endTime || '19:45:00',
      status: data.status || 'scheduled',
      lessonContent: data.lessonContent || '<p>Unit 3</p>',
      homework: data.homework || '<p>Homework legacy field</p>',
      teacherComment: data.teacherComment || '<p>Keep practicing</p>',
      tenant: tenantId,
    },
    select: ['id', 'sessionDate', 'startTime', 'endTime', 'status', 'homework'],
  })
}

function createCtx({ tenant, user, params = {}, data = {}, query = {}, files = null }) {
  return {
    params,
    query,
    request: {
      body: { data },
      query,
      files: files || undefined,
      headers: {},
      header: {},
    },
    state: {
      user,
      tenant: { id: tenant.id, code: tenant.code, name: tenant.name },
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
    notFound(message) {
      this.status = 404
      this.body = { error: { message } }
      return this.body
    },
    conflict(message) {
      this.status = 409
      this.body = { error: { message } }
      return this.body
    },
    internalServerError(message) {
      this.status = 500
      this.body = { error: { message } }
      return this.body
    },
  }
}

async function createTempUpload(cleanup, label, extension, mimeType, content) {
  const filePath = path.join(os.tmpdir(), `${uniqueKey(label)}${extension}`)
  await fs.writeFile(filePath, content)
  cleanup.push(async () => { try { await fs.unlink(filePath) } catch {} })
  const stat = await fs.stat(filePath)
  return {
    filepath: filePath,
    path: filePath,
    tempFilePath: filePath,
    originalFilename: path.basename(filePath),
    mimetype: mimeType,
    type: mimeType,
    size: stat.size,
    name: path.basename(filePath),
  }
}

async function createFixture() {
  const cleanup = []
  const key = uniqueKey('assignment-workspace')

  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const outsiderTenant = await createTenant(`${key}-outsider-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', outsiderTenant.id))

  const teacher = await createUser(`${key}-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', teacher.id))
  const foreignTeacher = await createUser(`${key}-foreign-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', foreignTeacher.id))
  const studentUser = await createUser(`${key}-student-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', studentUser.id))
  const classmateUser = await createUser(`${key}-classmate-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', classmateUser.id))
  const outsiderStudentUser = await createUser(`${key}-outsider-student-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', outsiderStudentUser.id))

  const teacherMembership = await createUserTenant(teacher.id, tenant.id, `${key}-teacher`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', teacherMembership.id))
  const foreignTeacherMembership = await createUserTenant(foreignTeacher.id, tenant.id, `${key}-foreign-teacher`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', foreignTeacherMembership.id))
  const studentMembership = await createUserTenant(studentUser.id, tenant.id, `${key}-student-user`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', studentMembership.id))
  const classmateMembership = await createUserTenant(classmateUser.id, tenant.id, `${key}-classmate-user`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', classmateMembership.id))
  const outsiderStudentMembership = await createUserTenant(outsiderStudentUser.id, outsiderTenant.id, `${key}-outsider-student-user`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', outsiderStudentMembership.id))

  const teacherRole = await createPluginRole(`${key}-teacher-role`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.role', teacherRole.id))
  const studentRole = await createPluginRole(`${key}-student-role`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.role', studentRole.id))

  const featureTeacherWorkspace = await ensureFeature(cleanup, 'class', 'class.teacher-workspace', 'Teacher Classes', '/teacher/classes', 2)
  const featureTeacherSessions = await ensureFeature(cleanup, 'class', 'class.teacher-sessions', 'Teacher Sessions', '/teacher/sessions', 3)
  const featureStudentWorkspace = await ensureFeature(cleanup, 'class', 'class.student-workspace', 'Student Workspace', '/student', 4)
  const featureStudentSessions = await ensureFeature(cleanup, 'class', 'class.student-sessions', 'Student Sessions', '/student/sessions', 6)
  const roleFeature1 = await createRoleFeature(teacherRole.id, featureTeacherWorkspace.id)
  const roleFeature2 = await createRoleFeature(teacherRole.id, featureTeacherSessions.id)
  const roleFeature3 = await createRoleFeature(studentRole.id, featureStudentWorkspace.id)
  const roleFeature4 = await createRoleFeature(studentRole.id, featureStudentSessions.id)
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature1.id))
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature2.id))
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature3.id))
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', roleFeature4.id))

  const teacherTenantRole = await createUserTenantRole(teacherMembership.id, teacherRole.id, `${key}-teacher-main`)
  const foreignTeacherTenantRole = await createUserTenantRole(foreignTeacherMembership.id, teacherRole.id, `${key}-teacher-foreign`)
  const studentTenantRole = await createUserTenantRole(studentMembership.id, studentRole.id, `${key}-student-main`)
  const classmateTenantRole = await createUserTenantRole(classmateMembership.id, studentRole.id, `${key}-student-classmate`)
  const outsiderStudentTenantRole = await createUserTenantRole(outsiderStudentMembership.id, studentRole.id, `${key}-student-outsider`)
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', teacherTenantRole.id))
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', foreignTeacherTenantRole.id))
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', studentTenantRole.id))
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', classmateTenantRole.id))
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', outsiderStudentTenantRole.id))

  const classEntity = await createClass(tenant.id, teacher.id, `${key}-class`)
  cleanup.push(() => destroyEntity('api::class.class', classEntity.id))
  const outsiderClass = await createClass(outsiderTenant.id, foreignTeacher.id, `${key}-outsider-class`)
  cleanup.push(() => destroyEntity('api::class.class', outsiderClass.id))

  const teacherAssignment = await createTeacherAssignment(tenant.id, classEntity.id, teacher.id, `${key}-teacher-assignment`)
  cleanup.push(() => destroyEntity('api::class-teacher-assignment.class-teacher-assignment', teacherAssignment.id))

  const studentLearner = await createLearner(tenant.id, studentUser.id, `${key}-learner-main`)
  cleanup.push(() => destroyEntity('api::learner.learner', studentLearner.id))
  const classmateLearner = await createLearner(tenant.id, classmateUser.id, `${key}-learner-classmate`)
  cleanup.push(() => destroyEntity('api::learner.learner', classmateLearner.id))
  const lateLearner = await createLearner(tenant.id, classmateUser.id, `${key}-learner-late`)
  cleanup.push(() => destroyEntity('api::learner.learner', lateLearner.id))
  const outsiderLearner = await createLearner(outsiderTenant.id, outsiderStudentUser.id, `${key}-learner-outsider`)
  cleanup.push(() => destroyEntity('api::learner.learner', outsiderLearner.id))

  const enrollmentMain = await createEnrollment(tenant.id, classEntity.id, studentLearner.id, { joinDate: '2026-09-01' })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollmentMain.id))
  const enrollmentClassmate = await createEnrollment(tenant.id, classEntity.id, classmateLearner.id, { joinDate: '2026-09-01' })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollmentClassmate.id))
  const enrollmentLate = await createEnrollment(tenant.id, classEntity.id, lateLearner.id, { joinDate: '2026-09-09' })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', enrollmentLate.id))
  const outsiderEnrollment = await createEnrollment(outsiderTenant.id, outsiderClass.id, outsiderLearner.id, { joinDate: '2026-09-01' })
  cleanup.push(() => destroyEntity('api::enrollment.enrollment', outsiderEnrollment.id))

  const session = await createClassSession(tenant.id, classEntity.id, teacher.id, {
    sessionDate: '2026-09-08',
    status: 'in_progress',
    homework: '<p>Homework legacy field still visible.</p>',
  })
  cleanup.push(() => destroyEntity('api::class-session.class-session', session.id))

  return {
    cleanup,
    tenant,
    outsiderTenant,
    teacher,
    foreignTeacher,
    studentUser,
    classmateUser,
    outsiderStudentUser,
    classEntity,
    session,
    studentLearner,
    classmateLearner,
    lateLearner,
    outsiderLearner,
    enrollmentMain,
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

test('assignment workspace supports draft publish progress submissions review versioning tenant scope and legacy homework', async () => {
  const assignmentController = app.controller('api::assignment.assignment')
  const classController = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const studentListBeforePublishCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { sessionId: fixture.session.id }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.listStudentSessionAssignments(studentListBeforePublishCtx)
    assert.equal(studentListBeforePublishCtx.status, 200)
    assert.deepEqual(studentListBeforePublishCtx.body?.data, [])

    const createDraftCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.teacher,
      params: { sessionId: fixture.session.id },
      data: {
        title: 'Bài về nhà Unit 3',
        description: '<p>Làm đầy đủ các task dưới đây.</p><ul><li><strong>Đọc kỹ</strong> hướng dẫn</li><li>Mở <a href="https://example.com/assignment-guide">link bài tập</a></li></ul>',
        dueAt: '2026-09-10T13:00:00.000Z',
        tasks: [
          { title: 'Học 20 từ mới', description: '<p>Checklist từ vựng</p><ul><li>Bold <strong>từ mới</strong></li><li>Xem <a href="https://example.com/vocab">tài liệu</a></li></ul>', taskType: 'todo', required: true, order: 1, expectedOutcome: '<p>Nắm được toàn bộ từ vựng trọng tâm.</p>', gradingRubric: '<p>- Đúng nghĩa: 6 điểm</p><p>- Đầy đủ: 4 điểm</p>' },
          { title: 'Nộp workbook và audio', description: '<p>Nộp nhiều loại nội dung</p><p><a href="https://example.com/workbook">Workbook</a> và <a href="https://example.com/audio">audio mẫu</a></p>', taskType: 'submission', required: true, order: 2, expectedOutcome: '<p>Nêu đủ dấu hiệu present perfect<script>alert(1)</script></p>', gradingRubric: '<p>- Độ chính xác: 6 điểm</p><p>- Đầy đủ: 3 điểm</p><p>- Trình bày: 1 điểm</p>' },
        ],
      },
    })
    await assignmentController.createTeacherSessionAssignment(createDraftCtx)
    assert.equal(createDraftCtx.status, 200)
    assert.equal(createDraftCtx.body?.data?.status, 'draft')
    assert.equal(createDraftCtx.body?.data?.tasks?.length, 2)
    assert.match(String(createDraftCtx.body?.data?.description || ''), /<a href="https:\/\/example.com\/assignment-guide" target="_blank" rel="noopener noreferrer">link bài tập<\/a>/)
    assert.match(String(createDraftCtx.body?.data?.description || ''), /<ul>/)
    assert.match(String(createDraftCtx.body?.data?.tasks?.[0]?.description || ''), /<strong>từ mới<\/strong>/)
    assert.match(String(createDraftCtx.body?.data?.tasks?.[0]?.description || ''), /<a href="https:\/\/example.com\/vocab" target="_blank" rel="noopener noreferrer">tài liệu<\/a>/)
    assert.match(String(createDraftCtx.body?.data?.tasks?.[1]?.description || ''), /https:\/\/example.com\/workbook/)
    assert.match(String(createDraftCtx.body?.data?.tasks?.[1]?.description || ''), /https:\/\/example.com\/audio/)
    assert.match(String(createDraftCtx.body?.data?.tasks?.[0]?.expectedOutcome || ''), /toàn bộ từ vựng trọng tâm/i)
    assert.match(String(createDraftCtx.body?.data?.tasks?.[1]?.gradingRubric || ''), /Độ chính xác/i)
    assert.equal(String(createDraftCtx.body?.data?.tasks?.[1]?.expectedOutcome || '').includes('<script>'), false)

    const assignmentId = Number(createDraftCtx.body?.data?.id || 0)
    const todoTaskId = Number(createDraftCtx.body?.data?.tasks?.find((item) => item.taskType === 'todo')?.id || 0)
    const submissionTaskId = Number(createDraftCtx.body?.data?.tasks?.find((item) => item.taskType === 'submission')?.id || 0)
    assert.ok(assignmentId > 0)
    assert.ok(todoTaskId > 0)
    assert.ok(submissionTaskId > 0)

    const publishCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId } })
    await assignmentController.publishTeacherAssignment(publishCtx)
    assert.equal(publishCtx.status, 200)
    assert.equal(publishCtx.body?.data?.status, 'published')
    assert.equal((publishCtx.body?.data?.learners || []).length, 3)

    const progressRows = await app.db.query('api::assignment-task-learner-progress.assignment-task-learner-progress').findMany({
      where: { assignmentTask: { assignment: { id: { $eq: assignmentId } } }, tenant: fixture.tenant.id },
      populate: { learner: { select: ['id'] }, assignmentTask: { select: ['id'] } },
    })
    assert.equal(progressRows.length, 6)
    assert.equal(progressRows.some((item) => Number(item?.learner?.id || 0) === fixture.lateLearner.id), true)

    const cancelCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId } })
    await assignmentController.cancelTeacherAssignment(cancelCtx)
    assert.equal(cancelCtx.status, 200)
    assert.equal(cancelCtx.body?.data?.status, 'cancelled')

    const studentListWhileCancelledCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { sessionId: fixture.session.id }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.listStudentSessionAssignments(studentListWhileCancelledCtx)
    assert.equal(studentListWhileCancelledCtx.status, 200)
    assert.deepEqual(studentListWhileCancelledCtx.body?.data, [])

    const reopenCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId } })
    await assignmentController.reopenTeacherAssignment(reopenCtx)
    assert.equal(reopenCtx.status, 200)
    assert.equal(reopenCtx.body?.data?.status, 'published')

    const reopenInvalidStateCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId } })
    await assignmentController.reopenTeacherAssignment(reopenInvalidStateCtx)
    assert.equal(reopenInvalidStateCtx.status, 409)

    const closeCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId } })
    await assignmentController.closeTeacherAssignment(closeCtx)
    assert.equal(closeCtx.status, 200)
    assert.equal(closeCtx.body?.data?.status, 'closed')

    const cancelAgainCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId } })
    await assignmentController.cancelTeacherAssignment(cancelAgainCtx)
    assert.equal(cancelAgainCtx.status, 200)
    assert.equal(cancelAgainCtx.body?.data?.status, 'cancelled')

    const reopenAgainCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId } })
    await assignmentController.reopenTeacherAssignment(reopenAgainCtx)
    assert.equal(reopenAgainCtx.status, 200)
    assert.equal(reopenAgainCtx.body?.data?.status, 'published')

    const progressRowsAfterReopen = await app.db.query('api::assignment-task-learner-progress.assignment-task-learner-progress').findMany({
      where: { assignmentTask: { assignment: { id: { $eq: assignmentId } } }, tenant: fixture.tenant.id },
      select: ['id'],
    })
    assert.equal(progressRowsAfterReopen.length, progressRows.length)

    await app.db.query('api::enrollment.enrollment').update({
      where: { id: fixture.enrollmentMain.id },
      data: { leaveDate: '2026-09-09' },
    })

    const studentListCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { sessionId: fixture.session.id }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.listStudentSessionAssignments(studentListCtx)
    assert.equal(studentListCtx.status, 200)
    assert.equal(studentListCtx.body?.data?.length, 1)

    const studentAssignmentDetailCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { assignmentId }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.getStudentAssignment(studentAssignmentDetailCtx)
    assert.equal(studentAssignmentDetailCtx.status, 200)
    assert.equal(studentAssignmentDetailCtx.body?.data?.tasks?.length, 2)
    assert.match(String(studentAssignmentDetailCtx.body?.data?.description || ''), /assignment-guide/)
    assert.match(String(studentAssignmentDetailCtx.body?.data?.tasks?.[0]?.description || ''), /<ul>/)
    assert.match(String(studentAssignmentDetailCtx.body?.data?.tasks?.[1]?.description || ''), /target="_blank"/)
    assert.equal(String(studentAssignmentDetailCtx.body?.data?.tasks?.[1]?.expectedOutcome || ''), '')
    assert.equal(String(studentAssignmentDetailCtx.body?.data?.tasks?.[1]?.gradingRubric || ''), '')

    const studentTaskDetailCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { taskId: submissionTaskId }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.getStudentAssignmentTask(studentTaskDetailCtx)
    assert.equal(studentTaskDetailCtx.status, 200)
    assert.equal(studentTaskDetailCtx.body?.data?.assignment?.id, assignmentId)
    assert.equal(studentTaskDetailCtx.body?.data?.task?.id, submissionTaskId)
    assert.equal(studentTaskDetailCtx.body?.data?.task?.taskType, 'submission')
    assert.equal(String(studentTaskDetailCtx.body?.data?.assignment?.title || '').length > 0, true)

    const todoCompleteCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { taskId: todoTaskId }, query: { learnerId: fixture.studentLearner.id }, data: { status: 'completed' } })
    await assignmentController.updateStudentTodoProgress(todoCompleteCtx)
    assert.equal(todoCompleteCtx.status, 200)
    assert.equal(todoCompleteCtx.body?.data?.tasks?.find((item) => item.id === todoTaskId)?.myProgress?.status, 'completed')

    const imageUpload = await createTempUpload(fixture.cleanup, 'assignment-image', '.png', 'image/png', Buffer.from('image-content'))
    const audioUpload = await createTempUpload(fixture.cleanup, 'assignment-audio', '.mp3', 'audio/mpeg', Buffer.from('audio-content'))
    const videoUpload = await createTempUpload(fixture.cleanup, 'assignment-video', '.mp4', 'video/mp4', Buffer.from('video-content'))
    const fileUpload = await createTempUpload(fixture.cleanup, 'assignment-file', '.pdf', 'application/pdf', Buffer.from('file-content'))

    const uploadImageCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { taskId: submissionTaskId }, query: { learnerId: fixture.studentLearner.id }, files: { file: imageUpload } })
    await assignmentController.uploadStudentAssignmentFile(uploadImageCtx)
    assert.equal(uploadImageCtx.status, 200)
    const uploadAudioCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { taskId: submissionTaskId }, query: { learnerId: fixture.studentLearner.id }, files: { file: audioUpload } })
    await assignmentController.uploadStudentAssignmentFile(uploadAudioCtx)
    assert.equal(uploadAudioCtx.status, 200)
    const uploadVideoCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { taskId: submissionTaskId }, query: { learnerId: fixture.studentLearner.id }, files: { file: videoUpload } })
    await assignmentController.uploadStudentAssignmentFile(uploadVideoCtx)
    assert.equal(uploadVideoCtx.status, 200)
    const uploadFileCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { taskId: submissionTaskId }, query: { learnerId: fixture.studentLearner.id }, files: { file: fileUpload } })
    await assignmentController.uploadStudentAssignmentFile(uploadFileCtx)
    assert.equal(uploadFileCtx.status, 200)

    const imageAssetId = Number(uploadImageCtx.body?.data?.id || 0)
    const audioAssetId = Number(uploadAudioCtx.body?.data?.id || 0)
    const videoAssetId = Number(uploadVideoCtx.body?.data?.id || 0)
    const fileAssetId = Number(uploadFileCtx.body?.data?.id || 0)
    assert.ok(imageAssetId > 0)
    assert.ok(audioAssetId > 0)
    assert.ok(videoAssetId > 0)
    assert.ok(fileAssetId > 0)

    const saveDraftCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      params: { taskId: submissionTaskId },
      query: { learnerId: fixture.studentLearner.id },
      data: {
        comment: 'Đang làm bài',
        items: [
          { type: 'html', contentHtml: '<p>Bài viết nháp</p><script>alert(1)</script>' },
          { type: 'link', url: 'https://blockly-demo.appspot.com/static/demos/code/index.html#r9hefy' },
          { type: 'image', fileAsset: imageAssetId },
          { type: 'audio', fileAsset: audioAssetId },
          { type: 'video', fileAsset: videoAssetId },
          { type: 'file', fileAsset: fileAssetId },
        ],
      },
    })
    await assignmentController.saveStudentSubmissionDraft(saveDraftCtx)
    assert.equal(saveDraftCtx.status, 200)
    const submissionTaskAfterDraft = saveDraftCtx.body?.data?.tasks?.find((item) => item.id === submissionTaskId)
    assert.equal(submissionTaskAfterDraft?.submissions?.[0]?.status, 'draft')
    assert.equal(submissionTaskAfterDraft?.submissions?.[0]?.items?.length, 6)
    assert.equal(String(submissionTaskAfterDraft?.submissions?.[0]?.items?.[0]?.contentHtml || '').includes('<script>'), false)

    const submitCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      params: { taskId: submissionTaskId },
      query: { learnerId: fixture.studentLearner.id },
      data: {
        submissionId: submissionTaskAfterDraft?.submissions?.[0]?.id,
        comment: 'Đã hoàn tất bài nộp',
        items: submissionTaskAfterDraft?.submissions?.[0]?.items?.map((item) => ({
          type: item.type,
          contentHtml: item.contentHtml,
          url: item.url,
          fileAsset: item?.fileAsset?.id,
        })),
      },
    })
    await assignmentController.submitStudentSubmission(submitCtx)
    assert.equal(submitCtx.status, 200)
    const submissionTaskAfterSubmit = submitCtx.body?.data?.tasks?.find((item) => item.id === submissionTaskId)
    assert.equal(submissionTaskAfterSubmit?.myProgress?.status, 'submitted')
    assert.equal(submissionTaskAfterSubmit?.submissions?.[0]?.version, 1)
    assert.deepEqual((submissionTaskAfterSubmit?.submissions?.[0]?.items || []).map((item) => item.type), ['html', 'link', 'image', 'audio', 'video', 'file'])

    const submittedVersion1Id = Number(submissionTaskAfterSubmit?.submissions?.[0]?.id || 0)
    const submissionVersion1ViewerCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { submissionId: submittedVersion1Id }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.getStudentSubmissionVersion(submissionVersion1ViewerCtx)
    assert.equal(submissionVersion1ViewerCtx.status, 200)
    assert.equal(submissionVersion1ViewerCtx.body?.data?.submission?.version, 1)
    assert.equal(submissionVersion1ViewerCtx.body?.data?.submission?.status, 'submitted')
    assert.deepEqual((submissionVersion1ViewerCtx.body?.data?.submission?.items || []).map((item) => item.type), ['html', 'link', 'image', 'audio', 'video', 'file'])

    const teacherAssignmentDetailCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId } })
    await assignmentController.getTeacherAssignment(teacherAssignmentDetailCtx)
    assert.equal(teacherAssignmentDetailCtx.status, 200)
    assert.equal(teacherAssignmentDetailCtx.body?.data?.submittedCount > 0, true)
    assert.match(String(teacherAssignmentDetailCtx.body?.data?.description || ''), /assignment-guide/)
    assert.match(String(teacherAssignmentDetailCtx.body?.data?.tasks?.[0]?.description || ''), /<strong>từ mới<\/strong>/)

    const teacherLearnerTaskCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId, taskId: submissionTaskId, learnerId: fixture.studentLearner.id } })
    await assignmentController.getTeacherAssignmentLearnerTask(teacherLearnerTaskCtx)
    assert.equal(teacherLearnerTaskCtx.status, 200)
    assert.equal(teacherLearnerTaskCtx.body?.data?.submissions?.[0]?.status, 'submitted')
    assert.match(String(teacherLearnerTaskCtx.body?.data?.task?.description || ''), /https:\/\/example.com\/workbook/)
    assert.match(String(teacherLearnerTaskCtx.body?.data?.task?.expectedOutcome || ''), /present perfect/i)
    assert.match(String(teacherLearnerTaskCtx.body?.data?.task?.gradingRubric || ''), /Độ chính xác/i)

    const previousApiKey = process.env.OPENAI_API_KEY
    const originalFetch = global.fetch
    try {
      process.env.OPENAI_API_KEY = 'test-key-for-assignment-workspace'
      let capturedPrompt = ''
      const sampleBlocklyXml = '{[(< UNTRUSTED CONTENT >)]}\n<xml xmlns="https://developers.google.com/blockly/xml"><block type="controls_if"></block><block type="logic_compare"></block><block type="math_arithmetic"></block></xml>'
      global.fetch = async (url, options = {}) => {
        if (String(url).includes('blockly-demo.appspot.com/storage')) {
          return {
            ok: true,
            status: 200,
            text: async () => sampleBlocklyXml,
          }
        }
        if (String(url).includes('api.openai.com/v1/chat/completions')) {
          const payload = JSON.parse(options.body)
          capturedPrompt = String(payload?.messages?.[1]?.content || '')
          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      score: 10,
                      maxScore: 10,
                      teacherFeedback: '<p>Bài làm đạt đủ tiêu chí.</p>',
                    }),
                  },
                },
              ],
            }),
          }
        }
        throw new Error(`Unexpected fetch URL: ${String(url)}`)
      }

      const autoGradeCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId, taskId: submissionTaskId, learnerId: fixture.studentLearner.id } })
      await assignmentController.autoGradeTeacherAssignmentLearnerTask(autoGradeCtx)
      assert.equal(autoGradeCtx.status, 200)
      assert.equal(autoGradeCtx.body?.data?.proposal?.score, 10)
      assert.equal(autoGradeCtx.body?.data?.proposal?.maxScore, 10)
      assert.match(capturedPrompt, /STUDENT INSTRUCTION:/)
      assert.match(capturedPrompt, /EXPECTED OUTCOME:/)
      assert.match(capturedPrompt, /GRADING RUBRIC:/)
      assert.match(capturedPrompt, /MAX SCORE:\n10/)
      assert.match(capturedPrompt, /Do not reduce the score merely to make the feedback more critical\./)
      assert.match(capturedPrompt, /award full credit\./)
      assert.match(capturedPrompt, /Blockly XML:/)
      assert.match(capturedPrompt, /Tổng số khối lệnh:\s*3/)
      assert.equal(/script/i.test(capturedPrompt), false)

      global.fetch = async (url, options = {}) => {
        if (String(url).includes('blockly-demo.appspot.com/storage')) {
          return {
            ok: true,
            status: 200,
            text: async () => sampleBlocklyXml,
          }
        }
        if (String(url).includes('api.openai.com/v1/chat/completions')) {
          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      score: 9,
                      maxScore: 20,
                      teacherFeedback: '<p>Không khớp thang điểm hệ thống.</p>',
                    }),
                  },
                },
              ],
            }),
          }
        }
        throw new Error(`Unexpected fetch URL: ${String(url)}`)
      }
      const autoGradeInvalidMaxCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId, taskId: submissionTaskId, learnerId: fixture.studentLearner.id } })
      await assignmentController.autoGradeTeacherAssignmentLearnerTask(autoGradeInvalidMaxCtx)
      assert.equal(autoGradeInvalidMaxCtx.status, 502)

      const linkItems = await app.db.query('api::assignment-submission-item.assignment-submission-item').findMany({
        where: { assignmentSubmission: submittedVersion1Id, tenant: fixture.tenant.id, type: 'link' },
        select: ['id', 'url'],
      })
      assert.equal(linkItems.length > 0, true)
      const linkItemId = Number(linkItems[0]?.id || 0)
      const originalBlocklyLink = String(linkItems[0]?.url || '')
      assert.ok(linkItemId > 0)

      await app.db.query('api::assignment-submission-item.assignment-submission-item').update({
        where: { id: linkItemId },
        data: { url: 'https://blockly-demo.appspot.com/static/demos/code/index.html' },
      })
      const invalidBlocklyLinkCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId, taskId: submissionTaskId, learnerId: fixture.studentLearner.id } })
      await assignmentController.autoGradeTeacherAssignmentLearnerTask(invalidBlocklyLinkCtx)
      assert.equal(invalidBlocklyLinkCtx.status, 422)

      await app.db.query('api::assignment-submission-item.assignment-submission-item').update({
        where: { id: linkItemId },
        data: { url: originalBlocklyLink },
      })

      global.fetch = async (url) => {
        if (String(url).includes('blockly-demo.appspot.com/storage')) {
          return {
            ok: true,
            status: 200,
            text: async () => '',
          }
        }
        throw new Error(`Unexpected fetch URL: ${String(url)}`)
      }
      const beforeNotFoundProgress = await app.db.query('api::assignment-task-learner-progress.assignment-task-learner-progress').findOne({
        where: { assignmentTask: submissionTaskId, learner: fixture.studentLearner.id, tenant: fixture.tenant.id },
        select: ['id', 'aiSuggestedScore', 'aiSuggestedFeedback'],
      })
      const blocklyNotFoundCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId, taskId: submissionTaskId, learnerId: fixture.studentLearner.id } })
      await assignmentController.autoGradeTeacherAssignmentLearnerTask(blocklyNotFoundCtx)
      assert.equal(blocklyNotFoundCtx.status, 422)
      const afterNotFoundProgress = await app.db.query('api::assignment-task-learner-progress.assignment-task-learner-progress').findOne({
        where: { assignmentTask: submissionTaskId, learner: fixture.studentLearner.id, tenant: fixture.tenant.id },
        select: ['id', 'aiSuggestedScore', 'aiSuggestedFeedback'],
      })
      assert.equal(afterNotFoundProgress?.aiSuggestedScore, beforeNotFoundProgress?.aiSuggestedScore)
      assert.equal(String(afterNotFoundProgress?.aiSuggestedFeedback || ''), String(beforeNotFoundProgress?.aiSuggestedFeedback || ''))

      global.fetch = async (url) => {
        if (String(url).includes('blockly-demo.appspot.com/storage')) {
          return {
            ok: true,
            status: 200,
            text: async () => '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
          }
        }
        throw new Error(`Unexpected fetch URL: ${String(url)}`)
      }
      const emptyProgramCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId, taskId: submissionTaskId, learnerId: fixture.studentLearner.id } })
      await assignmentController.autoGradeTeacherAssignmentLearnerTask(emptyProgramCtx)
      assert.equal(emptyProgramCtx.status, 422)

      global.fetch = async (url) => {
        if (String(url).includes('blockly-demo.appspot.com/storage')) {
          return {
            ok: false,
            status: 503,
            text: async () => 'Service unavailable',
          }
        }
        throw new Error(`Unexpected fetch URL: ${String(url)}`)
      }
      const blocklyServiceErrorCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId, taskId: submissionTaskId, learnerId: fixture.studentLearner.id } })
      await assignmentController.autoGradeTeacherAssignmentLearnerTask(blocklyServiceErrorCtx)
      assert.equal(blocklyServiceErrorCtx.status, 503)

      global.fetch = async (url) => {
        if (String(url).includes('blockly-demo.appspot.com/storage')) {
          return {
            ok: true,
            status: 200,
            text: async () => sampleBlocklyXml,
          }
        }
        if (String(url).includes('api.openai.com/v1/chat/completions')) {
          return {
            ok: false,
            status: 500,
            text: async () => 'openai-down',
          }
        }
        throw new Error(`Unexpected fetch URL: ${String(url)}`)
      }
      const openAiFailureCtx = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId, taskId: submissionTaskId, learnerId: fixture.studentLearner.id } })
      await assignmentController.autoGradeTeacherAssignmentLearnerTask(openAiFailureCtx)
      assert.equal(openAiFailureCtx.status, 502)
    } finally {
      process.env.OPENAI_API_KEY = previousApiKey
      global.fetch = originalFetch
    }

    const returnCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.teacher,
      params: { assignmentId, taskId: submissionTaskId, learnerId: fixture.studentLearner.id },
      data: {
        status: 'returned',
        score: 5,
        maxScore: 10,
        teacherFeedback: '<p>Cần làm lại audio.</p>',
        submissionId: teacherLearnerTaskCtx.body?.data?.submissions?.[0]?.id,
      },
    })
    await assignmentController.reviewTeacherAssignmentLearnerTask(returnCtx)
    assert.equal(returnCtx.status, 200)
    assert.equal(returnCtx.body?.data?.progress?.status, 'returned')

    const studentAfterReturnCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { assignmentId }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.getStudentAssignment(studentAfterReturnCtx)
    const afterReturnTask = studentAfterReturnCtx.body?.data?.tasks?.find((item) => item.id === submissionTaskId)
    assert.equal(afterReturnTask?.myProgress?.status, 'returned')
    assert.match(String(afterReturnTask?.myProgress?.teacherFeedback || ''), /audio/i)

    const resubmitCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      params: { taskId: submissionTaskId },
      query: { learnerId: fixture.studentLearner.id },
      data: {
        comment: 'Nộp lại version 2',
        items: [
          { type: 'html', contentHtml: '<p>Version 2 hoàn chỉnh</p>' },
          { type: 'file', fileAsset: fileAssetId },
        ],
      },
    })
    await assignmentController.submitStudentSubmission(resubmitCtx)
    assert.equal(resubmitCtx.status, 200)
    const afterResubmitTask = resubmitCtx.body?.data?.tasks?.find((item) => item.id === submissionTaskId)
    assert.equal(afterResubmitTask?.submissions?.length >= 2, true)
    assert.equal(afterResubmitTask?.submissions?.[0]?.version, 2)
    assert.equal(afterResubmitTask?.submissions?.[1]?.version, 1)
    assert.deepEqual((afterResubmitTask?.submissions?.[0]?.items || []).map((item) => item.type), ['html', 'file'])

    const submittedVersion2Id = Number(afterResubmitTask?.submissions?.[0]?.id || 0)
    const submissionVersion2ViewerCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { submissionId: submittedVersion2Id }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.getStudentSubmissionVersion(submissionVersion2ViewerCtx)
    assert.equal(submissionVersion2ViewerCtx.status, 200)
    assert.equal(submissionVersion2ViewerCtx.body?.data?.submission?.version, 2)
    assert.deepEqual((submissionVersion2ViewerCtx.body?.data?.submission?.items || []).map((item) => item.type), ['html', 'file'])

    const submissionVersion1HistoryCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { submissionId: submittedVersion1Id }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.getStudentSubmissionVersion(submissionVersion1HistoryCtx)
    assert.equal(submissionVersion1HistoryCtx.status, 200)
    assert.equal(submissionVersion1HistoryCtx.body?.data?.submission?.version, 1)
    assert.deepEqual((submissionVersion1HistoryCtx.body?.data?.submission?.items || []).map((item) => item.type), ['html', 'link', 'image', 'audio', 'video', 'file'])

    const completeCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.teacher,
      params: { assignmentId, taskId: submissionTaskId, learnerId: fixture.studentLearner.id },
      data: {
        status: 'completed',
        score: 8.5,
        maxScore: 10,
        teacherFeedback: '<p>Tốt hơn nhiều.</p>',
        submissionId: afterResubmitTask?.submissions?.[0]?.id,
      },
    })
    await assignmentController.reviewTeacherAssignmentLearnerTask(completeCtx)
    assert.equal(completeCtx.status, 200)
    assert.equal(completeCtx.body?.data?.progress?.status, 'completed')

    const rawSubmissions = await app.db.query('api::assignment-submission.assignment-submission').findMany({
      where: { assignmentTask: submissionTaskId, learner: fixture.studentLearner.id, tenant: fixture.tenant.id },
      select: ['id', 'version', 'status'],
      orderBy: [{ version: 'desc' }],
    })
    assert.deepEqual(rawSubmissions.map((item) => Number(item.version)), [2, 1])
    assert.equal(rawSubmissions[0]?.status, 'accepted')
    assert.equal(rawSubmissions[1]?.status, 'returned')

    const postSubmitDraftCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      params: { taskId: submissionTaskId },
      query: { learnerId: fixture.studentLearner.id },
      data: {
        comment: 'Bản nháp version 3',
        items: [
          { type: 'link', url: 'https://example.com/draft-v3' },
        ],
      },
    })
    await assignmentController.saveStudentSubmissionDraft(postSubmitDraftCtx)
    assert.equal(postSubmitDraftCtx.status, 200)
    const taskWithDraftAndHistory = postSubmitDraftCtx.body?.data?.tasks?.find((item) => item.id === submissionTaskId)
    assert.equal(taskWithDraftAndHistory?.submissions?.[0]?.status, 'draft')
    assert.equal(taskWithDraftAndHistory?.submissions?.[0]?.version, 3)
    assert.equal(taskWithDraftAndHistory?.submissions?.[1]?.version, 2)
    assert.equal(taskWithDraftAndHistory?.submissions?.[1]?.status, 'accepted')
    assert.equal(taskWithDraftAndHistory?.submissions?.[2]?.version, 1)
    assert.equal(taskWithDraftAndHistory?.submissions?.[2]?.status, 'returned')

    const foreignTeacherCtx = createCtx({ tenant: fixture.tenant, user: fixture.foreignTeacher, params: { assignmentId } })
    await assignmentController.getTeacherAssignment(foreignTeacherCtx)
    assert.equal(foreignTeacherCtx.status, 403)

    const foreignTeacherReopenCtx = createCtx({ tenant: fixture.tenant, user: fixture.foreignTeacher, params: { assignmentId } })
    await assignmentController.reopenTeacherAssignment(foreignTeacherReopenCtx)
    assert.equal(foreignTeacherReopenCtx.status, 403)

    const outsiderStudentCtx = createCtx({ tenant: fixture.tenant, user: fixture.classmateUser, params: { assignmentId }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.getStudentAssignment(outsiderStudentCtx)
    assert.equal(outsiderStudentCtx.status, 403)

    const outsiderTaskCtx = createCtx({ tenant: fixture.tenant, user: fixture.classmateUser, params: { taskId: submissionTaskId }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.getStudentAssignmentTask(outsiderTaskCtx)
    assert.equal(outsiderTaskCtx.status, 403)

    const outsiderTenantCtx = createCtx({ tenant: fixture.outsiderTenant, user: fixture.outsiderStudentUser, params: { assignmentId }, query: { learnerId: fixture.outsiderLearner.id } })
    await assignmentController.getStudentAssignment(outsiderTenantCtx)
    assert.equal(outsiderTenantCtx.status, 404)

    const outsiderTenantReopenCtx = createCtx({ tenant: fixture.outsiderTenant, user: fixture.teacher, params: { assignmentId } })
    await assignmentController.reopenTeacherAssignment(outsiderTenantReopenCtx)
    assert.equal(outsiderTenantReopenCtx.status, 403)

    const outsiderTenantTaskCtx = createCtx({ tenant: fixture.outsiderTenant, user: fixture.outsiderStudentUser, params: { taskId: submissionTaskId }, query: { learnerId: fixture.outsiderLearner.id } })
    await assignmentController.getStudentAssignmentTask(outsiderTenantTaskCtx)
    assert.equal(outsiderTenantTaskCtx.status, 404)

    const forbiddenSubmissionViewerCtx = createCtx({ tenant: fixture.tenant, user: fixture.classmateUser, params: { submissionId: submittedVersion2Id }, query: { learnerId: fixture.studentLearner.id } })
    await assignmentController.getStudentSubmissionVersion(forbiddenSubmissionViewerCtx)
    assert.equal(forbiddenSubmissionViewerCtx.status, 403)

    const hiddenSubmissionViewerCtx = createCtx({ tenant: fixture.tenant, user: fixture.classmateUser, params: { submissionId: submittedVersion2Id }, query: { learnerId: fixture.classmateLearner.id } })
    await assignmentController.getStudentSubmissionVersion(hiddenSubmissionViewerCtx)
    assert.equal(hiddenSubmissionViewerCtx.status, 404)

    const outsiderTenantSubmissionViewerCtx = createCtx({ tenant: fixture.outsiderTenant, user: fixture.outsiderStudentUser, params: { submissionId: submittedVersion2Id }, query: { learnerId: fixture.outsiderLearner.id } })
    await assignmentController.getStudentSubmissionVersion(outsiderTenantSubmissionViewerCtx)
    assert.equal(outsiderTenantSubmissionViewerCtx.status, 404)

    const legacyHomeworkCtx = createCtx({ tenant: fixture.tenant, user: fixture.studentUser, params: { sessionId: fixture.session.id }, query: { learnerId: fixture.studentLearner.id } })
    await classController.getStudentSession(legacyHomeworkCtx)
    assert.equal(legacyHomeworkCtx.status, 200)
    assert.match(String(legacyHomeworkCtx.body?.data?.homework || ''), /legacy field/i)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})

test('student assignments list flattens learner tasks with filters pagination summary and ownership', async () => {
  const assignmentController = app.controller('api::assignment.assignment')
  const fixture = await createFixture()

  try {
    const createPublishedAssignment = async (payload) => {
      const createCtxValue = createCtx({
        tenant: fixture.tenant,
        user: fixture.teacher,
        params: { sessionId: fixture.session.id },
        data: payload,
      })
      await assignmentController.createTeacherSessionAssignment(createCtxValue)
      assert.equal(createCtxValue.status, 200)
      const assignmentId = Number(createCtxValue.body?.data?.id || 0)
      assert.ok(assignmentId > 0)
      const publishCtxValue = createCtx({ tenant: fixture.tenant, user: fixture.teacher, params: { assignmentId } })
      await assignmentController.publishTeacherAssignment(publishCtxValue)
      assert.equal(publishCtxValue.status, 200)
      return publishCtxValue.body?.data
    }

    const firstAssignment = await createPublishedAssignment({
      title: 'PET Reading homework',
      description: '<p>Đọc và hoàn thành bài.</p>',
      dueAt: '2099-09-21T13:54:00.000Z',
      tasks: [
        { title: 'Hoàn thành bài PET Reading', description: '<p>Task 1</p>', taskType: 'todo', required: true, order: 1 },
        { title: 'Nộp workbook Unit 1', description: '<p>Task 2</p>', taskType: 'submission', required: true, order: 2 },
      ],
    })

    const overdueAssignment = await createPublishedAssignment({
      title: 'Past due homework',
      description: '<p>Quá hạn</p>',
      dueAt: '2020-09-19T13:54:00.000Z',
      tasks: [
        { title: 'Task quá hạn', description: '<p>Quá hạn</p>', taskType: 'todo', required: true, order: 1 },
      ],
    })

    const mainLearnerListCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      query: {
        learnerId: fixture.studentLearner.id,
        page: 1,
        pageSize: 10,
      },
    })
    await assignmentController.listStudentAssignments(mainLearnerListCtx)
    assert.equal(mainLearnerListCtx.status, 200)
    assert.equal(Array.isArray(mainLearnerListCtx.body?.data), true)
    assert.equal(mainLearnerListCtx.body?.data?.length, 3)
    assert.equal(mainLearnerListCtx.body?.meta?.summary?.countsByStatus?.pending, 2)
    assert.equal(mainLearnerListCtx.body?.meta?.summary?.countsByStatus?.overdue, 1)

    const searchCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      query: {
        learnerId: fixture.studentLearner.id,
        search: 'hoàn thành bài pet reading',
      },
    })
    await assignmentController.listStudentAssignments(searchCtx)
    assert.equal(searchCtx.status, 200)
    assert.equal(searchCtx.body?.data?.length, 1)
    assert.match(String(searchCtx.body?.data?.[0]?.taskTitle || ''), /Reading/i)

    const taskTypeCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      query: {
        learnerId: fixture.studentLearner.id,
        taskType: 'submission',
      },
    })
    await assignmentController.listStudentAssignments(taskTypeCtx)
    assert.equal(taskTypeCtx.status, 200)
    assert.equal(taskTypeCtx.body?.data?.length, 1)
    assert.equal(taskTypeCtx.body?.data?.[0]?.taskType, 'submission')

    const overdueCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      query: {
        learnerId: fixture.studentLearner.id,
        status: 'overdue',
      },
    })
    await assignmentController.listStudentAssignments(overdueCtx)
    assert.equal(overdueCtx.status, 200)
    assert.equal(overdueCtx.body?.data?.length, 1)
    assert.equal(overdueCtx.body?.data?.[0]?.normalizedStatus, 'overdue')
    assert.equal(Number(overdueCtx.body?.data?.[0]?.assignmentId || 0), Number(overdueAssignment?.id || 0))

    const completeTaskId = Number(firstAssignment?.tasks?.find((item) => item.taskType === 'todo')?.id || 0)
    const completeCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      params: { taskId: completeTaskId },
      query: { learnerId: fixture.studentLearner.id },
      data: { status: 'completed' },
    })
    await assignmentController.updateStudentTodoProgress(completeCtx)
    assert.equal(completeCtx.status, 200)

    const completedFilterCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      query: {
        learnerId: fixture.studentLearner.id,
        status: 'completed',
      },
    })
    await assignmentController.listStudentAssignments(completedFilterCtx)
    assert.equal(completedFilterCtx.status, 200)
    assert.equal(completedFilterCtx.body?.data?.length, 1)
    assert.equal(completedFilterCtx.body?.data?.[0]?.learnerTaskStatus, 'completed')
    assert.equal(completedFilterCtx.body?.data?.[0]?.normalizedStatus, 'completed')

    const otherLearnerCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.classmateUser,
      query: {
        learnerId: fixture.lateLearner.id,
      },
    })
    await assignmentController.listStudentAssignments(otherLearnerCtx)
    assert.equal(otherLearnerCtx.status, 200)
    assert.equal(otherLearnerCtx.body?.data?.length, 3)
    assert.equal(otherLearnerCtx.body?.data?.some((item) => item.taskTitle === 'Task quá hạn'), true)
    assert.equal(otherLearnerCtx.body?.data?.some((item) => item.learnerTaskStatus === 'completed'), false)

    const paginationCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      query: {
        learnerId: fixture.studentLearner.id,
        page: 2,
        pageSize: 1,
      },
    })
    await assignmentController.listStudentAssignments(paginationCtx)
    assert.equal(paginationCtx.status, 200)
    assert.equal(paginationCtx.body?.data?.length, 1)
    assert.equal(paginationCtx.body?.meta?.pagination?.page, 2)
    assert.equal(paginationCtx.body?.meta?.pagination?.pageSize, 1)
    assert.equal(paginationCtx.body?.meta?.pagination?.total, 3)

    const forbiddenCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.studentUser,
      query: {
        learnerId: fixture.lateLearner.id,
      },
    })
    await assignmentController.listStudentAssignments(forbiddenCtx)
    assert.equal(forbiddenCtx.status, 403)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})