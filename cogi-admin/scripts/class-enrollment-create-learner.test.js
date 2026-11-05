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
    select: ['id', 'username', 'email', 'phone', 'fullName', 'blocked'],
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

async function createLearner(tenantId, label, options = {}) {
  return app.db.query('api::learner.learner').create({
    data: {
      code: options.code || label.toUpperCase(),
      fullName: options.fullName || `Learner ${label}`,
      email: options.email || null,
      phone: options.phone || null,
      learnerStatus: options.learnerStatus || 'active',
      user: options.userId || null,
      tenant: tenantId,
    },
    select: ['id', 'code', 'fullName', 'email', 'phone'],
  })
}

function createCtx(tenant, user, classId, data) {
  return {
    params: { id: classId },
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
  const key = uniqueKey('class-enrollment')

  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  const actor = await createUser(`${key}-actor`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', actor.id))

  const mainTeacher = await createUser(`${key}-teacher`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', mainTeacher.id))

  const actorMembership = await createUserTenant(actor.id, tenant.id, `${key}-actor`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', actorMembership.id))

  const teacherMembership = await createUserTenant(mainTeacher.id, tenant.id, `${key}-teacher`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', teacherMembership.id))

  const classEntity = await createClass(tenant.id, mainTeacher.id, `${key}-class`)
  cleanup.push(() => destroyEntity('api::class.class', classEntity.id))

  const learner = await createLearner(tenant.id, `${key}-learner`)
  cleanup.push(() => destroyEntity('api::learner.learner', learner.id))

  const outsiderTenant = await createTenant(`${key}-outsider-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', outsiderTenant.id))

  const outsiderUser = await createUser(`${key}-outsider`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', outsiderUser.id))

  const outsiderMembership = await createUserTenant(outsiderUser.id, outsiderTenant.id, `${key}-outsider`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', outsiderMembership.id))

  const outsiderLearner = await createLearner(outsiderTenant.id, `${key}-outsider-learner`)
  cleanup.push(() => destroyEntity('api::learner.learner', outsiderLearner.id))

  return { cleanup, tenant, actor, classEntity, learner, outsiderTenant, outsiderLearner }
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

test('existing learner enrollment succeeds and duplicate enrollment is blocked', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const createCtx1 = createCtx(fixture.tenant, fixture.actor, fixture.classEntity.id, {
      learner: fixture.learner.id,
      joinDate: '2026-09-01',
      status: 'active',
    })

    await controller.createEnrollment(createCtx1)

    assert.equal(createCtx1.body?.data?.learner?.id, fixture.learner.id)
    assert.equal(createCtx1.body?.data?.enrollmentStatus, 'active')

    const createCtx2 = createCtx(fixture.tenant, fixture.actor, fixture.classEntity.id, {
      learner: fixture.learner.id,
      status: 'active',
    })

    await controller.createEnrollment(createCtx2)

    assert.equal(createCtx2.status, 409)
    assert.match(String(createCtx2.body?.error?.message || ''), /đã có enrollment trong lớp hiện tại/i)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) {
      await action()
    }
  }
})

test('new learner can be created without user, email, or phone and enrolled immediately', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()
  const learnerCode = uniqueKey('hv').toUpperCase()

  try {
    const ctx = createCtx(fixture.tenant, fixture.actor, fixture.classEntity.id, {
      newLearner: {
        code: learnerCode,
        fullName: 'Hoc vien moi',
      },
      joinDate: '2026-09-02',
      status: 'active',
    })

    await controller.createEnrollment(ctx)

    assert.equal(ctx.body?.data?.learner?.code, learnerCode)
    assert.equal(ctx.body?.data?.learner?.fullName, 'Hoc vien moi')
    assert.equal(ctx.body?.data?.learner?.user, null)

    const createdLearner = await app.db.query('api::learner.learner').findOne({
      where: {
        code: { $eqi: learnerCode },
        tenant: fixture.tenant.id,
      },
      populate: {
        user: { select: ['id'] },
      },
    })

    assert.ok(createdLearner?.id)
    assert.equal(createdLearner?.user, null)
    assert.equal(createdLearner?.email || null, null)
    assert.equal(createdLearner?.phone || null, null)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) {
      await action()
    }
  }
})

test('new learner creation warns on duplicate code, email, phone, and tenant user collisions', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const duplicateCodeLearner = await createLearner(fixture.tenant.id, uniqueKey('dup-code'), {
      code: 'HS-DUP-001',
      fullName: 'Duplicate Code Learner',
    })
    fixture.cleanup.push(() => destroyEntity('api::learner.learner', duplicateCodeLearner.id))

    const duplicateEmailLearner = await createLearner(fixture.tenant.id, uniqueKey('dup-email'), {
      code: 'HS-DUP-EMAIL',
      fullName: 'Duplicate Email Learner',
      email: 'duplicate-email@example.com',
    })
    fixture.cleanup.push(() => destroyEntity('api::learner.learner', duplicateEmailLearner.id))

    const duplicatePhoneLearner = await createLearner(fixture.tenant.id, uniqueKey('dup-phone'), {
      code: 'HS-DUP-PHONE',
      fullName: 'Duplicate Phone Learner',
      phone: '0900111222',
    })
    fixture.cleanup.push(() => destroyEntity('api::learner.learner', duplicatePhoneLearner.id))

    const tenantUser = await createUser(uniqueKey('tenant-user-email'))
    fixture.cleanup.push(() => destroyEntity('plugin::users-permissions.user', tenantUser.id))
    const tenantUserMembership = await createUserTenant(tenantUser.id, fixture.tenant.id, uniqueKey('tenant-user-email'))
    fixture.cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', tenantUserMembership.id))

    await app.db.query('plugin::users-permissions.user').update({
      where: { id: tenantUser.id },
      data: {
        phone: '0900999888',
        email: 'existing-user@example.com',
      },
    })

    const codeCtx = createCtx(fixture.tenant, fixture.actor, fixture.classEntity.id, {
      newLearner: { code: 'HS-DUP-001', fullName: 'Another Learner' },
      status: 'active',
    })
    await controller.createEnrollment(codeCtx)
    assert.equal(codeCtx.status, 409)
    assert.match(String(codeCtx.body?.error?.message || ''), /Mã học viên đã tồn tại/i)

    const emailCtx = createCtx(fixture.tenant, fixture.actor, fixture.classEntity.id, {
      newLearner: { code: 'HS-NEW-EMAIL', fullName: 'Another Learner', email: 'duplicate-email@example.com' },
      status: 'active',
    })
    await controller.createEnrollment(emailCtx)
    assert.equal(emailCtx.status, 409)
    assert.match(String(emailCtx.body?.error?.message || ''), /Email đã khớp với learner hiện có/i)

    const phoneCtx = createCtx(fixture.tenant, fixture.actor, fixture.classEntity.id, {
      newLearner: { code: 'HS-NEW-PHONE', fullName: 'Another Learner', phone: '0900111222' },
      status: 'active',
    })
    await controller.createEnrollment(phoneCtx)
    assert.equal(phoneCtx.status, 409)
    assert.match(String(phoneCtx.body?.error?.message || ''), /Số điện thoại đã khớp với learner hiện có/i)

    const tenantUserEmailCtx = createCtx(fixture.tenant, fixture.actor, fixture.classEntity.id, {
      newLearner: { code: 'HS-NEW-USER-EMAIL', fullName: 'Another Learner', email: 'existing-user@example.com' },
      status: 'active',
    })
    await controller.createEnrollment(tenantUserEmailCtx)
    assert.equal(tenantUserEmailCtx.status, 409)
    assert.match(String(tenantUserEmailCtx.body?.error?.message || ''), /Email đã thuộc về user/i)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) {
      await action()
    }
  }
})

test('learner from another tenant cannot be enrolled into the current tenant class', async () => {
  const controller = app.controller('api::class.class')
  const fixture = await createFixture()

  try {
    const ctx = createCtx(fixture.tenant, fixture.actor, fixture.classEntity.id, {
      learner: fixture.outsiderLearner.id,
      status: 'active',
    })

    await controller.createEnrollment(ctx)

    assert.equal(ctx.status, 400)
    assert.match(String(ctx.body?.error?.message || ''), /current tenant/i)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) {
      await action()
    }
  }
})