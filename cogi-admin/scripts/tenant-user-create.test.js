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

async function createUser(label, data = {}) {
  return app.db.query('plugin::users-permissions.user').create({
    data: {
      username: data.username || label,
      email: data.email || `${label}@example.com`,
      password: data.password || 'Pass1234!',
      provider: 'local',
      confirmed: data.confirmed ?? true,
      blocked: data.blocked ?? false,
      fullName: data.fullName || `User ${label}`,
      phone: data.phone || null,
      role: authenticatedRoleId,
    },
    select: ['id', 'username', 'email', 'fullName', 'phone', 'blocked', 'confirmed'],
  })
}

async function createUserTenant(userId, tenantId, label, status = 'active') {
  return app.db.query('api::user-tenant.user-tenant').create({
    data: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: status,
      isDefault: false,
      label: `Membership ${label}`,
    },
    select: ['id', 'userTenantStatus'],
  })
}

async function createPluginRole(label) {
  return app.db.query('plugin::users-permissions.role').create({
    data: {
      name: label,
      description: `Role ${label}`,
      type: `role-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    },
    select: ['id', 'type', 'name'],
  })
}

async function ensureFeature(cleanup, groupCode, featureKey, featureName, featurePath) {
  let group = await app.db.query('api::feature-group.feature-group').findOne({ where: { code: groupCode }, select: ['id'] })
  if (!group?.id) {
    group = await app.db.query('api::feature-group.feature-group').create({
      data: {
        name: 'User Management',
        code: groupCode,
        order: 10,
        icon: 'cilPerson',
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

async function createTenantRole(tenantId, roleId, label) {
  return app.db.query('api::tenant-role.tenant-role').create({
    data: {
      tenant: tenantId,
      role: roleId,
      isActive: true,
      activatedAt: new Date(),
      label,
    },
    select: ['id'],
  })
}

function createCtx({ tenant, user, params = {}, body = {}, query = {} }) {
  return {
    params,
    request: { body, query },
    state: {
      user,
      tenant: { id: tenant.id, code: tenant.code, name: tenant.name },
      tenantId: tenant.id,
      tenantCode: tenant.code,
    },
    status: 200,
    body: null,
    badRequest(message) {
      this.status = 400
      this.body = { error: { message } }
      return this.body
    },
    conflict(message) {
      this.status = 409
      this.body = { error: { message } }
      return this.body
    },
    notFound(message) {
      this.status = 404
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

async function createFixture() {
  const cleanup = []
  const key = uniqueKey('tenant-user-create')

  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const outsiderTenant = await createTenant(`${key}-outsider-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', outsiderTenant.id))

  const actor = await createUser(`${key}-actor`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', actor.id))
  const actorMembership = await createUserTenant(actor.id, tenant.id, `${key}-actor`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', actorMembership.id))

  const adminRole = await createPluginRole('Tenant Admin')
  const editorRole = await createPluginRole('Editor')
  const teacherRole = await createPluginRole('Teacher')
  const studentRole = await createPluginRole('Student')
  cleanup.push(() => destroyEntity('plugin::users-permissions.role', adminRole.id))
  cleanup.push(() => destroyEntity('plugin::users-permissions.role', editorRole.id))
  cleanup.push(() => destroyEntity('plugin::users-permissions.role', teacherRole.id))
  cleanup.push(() => destroyEntity('plugin::users-permissions.role', studentRole.id))

  const userManageFeature = await ensureFeature(cleanup, 'user', 'user.manage', 'Manage Users', '/users')
  const actorRoleFeature = await createRoleFeature(adminRole.id, userManageFeature.id)
  cleanup.push(() => destroyEntity('api::role-feature.role-feature', actorRoleFeature.id))

  const actorTenantRole = await createUserTenantRole(actorMembership.id, adminRole.id, `${key}-actor-admin`)
  cleanup.push(() => destroyEntity('api::user-tenant-role.user-tenant-role', actorTenantRole.id))

  const tenantRoleAdmin = await createTenantRole(tenant.id, adminRole.id, 'Tenant Admin')
  const tenantRoleEditor = await createTenantRole(tenant.id, editorRole.id, 'Editor')
  const tenantRoleTeacher = await createTenantRole(tenant.id, teacherRole.id, 'Teacher')
  const tenantRoleStudent = await createTenantRole(tenant.id, studentRole.id, 'Student')
  cleanup.push(() => destroyEntity('api::tenant-role.tenant-role', tenantRoleAdmin.id))
  cleanup.push(() => destroyEntity('api::tenant-role.tenant-role', tenantRoleEditor.id))
  cleanup.push(() => destroyEntity('api::tenant-role.tenant-role', tenantRoleTeacher.id))
  cleanup.push(() => destroyEntity('api::tenant-role.tenant-role', tenantRoleStudent.id))

  const outsiderTenantRoleStudent = await createTenantRole(outsiderTenant.id, studentRole.id, 'Student')
  cleanup.push(() => destroyEntity('api::tenant-role.tenant-role', outsiderTenantRoleStudent.id))

  return {
    cleanup,
    tenant,
    outsiderTenant,
    actor,
    roles: {
      adminRole,
      editorRole,
      teacherRole,
      studentRole,
    },
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

test('create tenant user reuses import-user rules for create attach duplicates roles tenant scope and no learner side effects', async () => {
  const controller = app.controller('api::admin.admin')
  const fixture = await createFixture()

  try {
    const createOneRoleCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      body: {
        fullName: 'Nguyen Van Tao',
        username: 'create-one-role-user',
        email: 'create-one-role-user@example.com',
        phone: '0901002003',
        password: 'Pass123!',
        roleIds: [fixture.roles.studentRole.id],
      },
    })
    await controller.createTenantUser(createOneRoleCtx)
    assert.equal(createOneRoleCtx.status, 200)
    assert.equal(createOneRoleCtx.body?.ok, true)
    assert.equal(createOneRoleCtx.body?.data?.caseType, 'NEW_USER')

    const createdUser = await app.db.query('plugin::users-permissions.user').findOne({
      where: { username: { $eqi: 'create-one-role-user' } },
      select: ['id', 'username', 'email', 'fullName', 'phone', 'confirmed', 'blocked'],
    })
    assert.ok(createdUser?.id)
    assert.equal(createdUser?.email, 'create-one-role-user@example.com')
    assert.equal(createdUser?.phone, '0901002003')
    assert.equal(createdUser?.confirmed, true)
    assert.equal(createdUser?.blocked, false)

    const createdMembership = await app.db.query('api::user-tenant.user-tenant').findOne({
      where: { user: createdUser.id, tenant: fixture.tenant.id },
      select: ['id', 'userTenantStatus'],
    })
    assert.ok(createdMembership?.id)
    assert.equal(createdMembership?.userTenantStatus, 'active')

    const createdRoles = await app.db.query('api::user-tenant-role.user-tenant-role').findMany({
      where: { userTenant: createdMembership.id, userTenantRoleStatus: 'active' },
      populate: { role: { select: ['id'] } },
    })
    assert.deepEqual(createdRoles.map((item) => Number(item?.role?.id || item?.role)).sort((a, b) => a - b), [fixture.roles.studentRole.id])

    const createdLearners = await app.db.query('api::learner.learner').findMany({
      where: { user: createdUser.id },
      select: ['id'],
    })
    assert.equal(createdLearners.length, 0)

    const createMultiRoleCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      body: {
        fullName: 'Tran Thi Da Vai Tro',
        username: 'create-multi-role-user',
        email: 'create-multi-role-user@example.com',
        password: 'Pass123!',
        roleIds: [fixture.roles.teacherRole.id, fixture.roles.studentRole.id],
      },
    })
    await controller.createTenantUser(createMultiRoleCtx)
    assert.equal(createMultiRoleCtx.status, 200)
    assert.equal(createMultiRoleCtx.body?.data?.caseType, 'NEW_USER')

    const multiUser = await app.db.query('plugin::users-permissions.user').findOne({
      where: { username: { $eqi: 'create-multi-role-user' } },
      select: ['id'],
    })
    const multiMembership = await app.db.query('api::user-tenant.user-tenant').findOne({
      where: { user: multiUser.id, tenant: fixture.tenant.id },
      select: ['id'],
    })
    const multiRoles = await app.db.query('api::user-tenant-role.user-tenant-role').findMany({
      where: { userTenant: multiMembership.id, userTenantRoleStatus: 'active' },
      populate: { role: { select: ['id'] } },
    })
    assert.deepEqual(multiRoles.map((item) => Number(item?.role?.id || item?.role)).sort((a, b) => a - b), [fixture.roles.studentRole.id, fixture.roles.teacherRole.id].sort((a, b) => a - b))

    const listCtx = createCtx({ tenant: fixture.tenant, user: fixture.actor, query: { page: 1, pageSize: 50 } })
    await controller.listTenantUsers(listCtx)
    assert.equal(listCtx.status, 200)
    const listedUsernames = listCtx.body?.data?.map((item) => item?.user?.username) || []
    assert.equal(listedUsernames.includes('create-one-role-user'), true)
    assert.equal(listedUsernames.includes('create-multi-role-user'), true)

    const duplicateUsernameCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      body: {
        fullName: 'Duplicate Username',
        username: 'create-one-role-user',
        email: 'new-email-for-dup-username@example.com',
        password: 'Pass123!',
        roleIds: [fixture.roles.editorRole.id],
      },
    })
    await controller.createTenantUser(duplicateUsernameCtx)
    assert.equal(duplicateUsernameCtx.status, 400)
    assert.match(String(duplicateUsernameCtx.body?.error?.message || ''), /user already exists in this tenant/i)

    const duplicateEmailCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      body: {
        fullName: 'Duplicate Email',
        username: 'new-username-for-dup-email',
        email: 'create-one-role-user@example.com',
        password: 'Pass123!',
        roleIds: [fixture.roles.editorRole.id],
      },
    })
    await controller.createTenantUser(duplicateEmailCtx)
    assert.equal(duplicateEmailCtx.status, 400)
    assert.match(String(duplicateEmailCtx.body?.error?.message || ''), /user already exists in this tenant/i)

    const outsiderExistingUser = await createUser(`${uniqueKey('outsider-existing')}`, {
      username: 'existing-global-user',
      email: 'existing-global-user@example.com',
      fullName: 'Existing Global User',
    })
    fixture.cleanup.push(() => destroyEntity('plugin::users-permissions.user', outsiderExistingUser.id))
    const outsiderMembership = await createUserTenant(outsiderExistingUser.id, fixture.outsiderTenant.id, `${uniqueKey('outsider-existing-membership')}`)
    fixture.cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', outsiderMembership.id))

    const attachExistingCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      body: {
        fullName: 'Ignored Full Name',
        username: 'existing-global-user',
        email: 'existing-global-user@example.com',
        password: '',
        roleIds: [fixture.roles.editorRole.id, fixture.roles.studentRole.id],
      },
    })
    await controller.createTenantUser(attachExistingCtx)
    assert.equal(attachExistingCtx.status, 200)
    assert.equal(attachExistingCtx.body?.data?.caseType, 'EXISTING_USER')
    assert.equal(Number(attachExistingCtx.body?.data?.userId || 0), outsiderExistingUser.id)

    const attachedMembership = await app.db.query('api::user-tenant.user-tenant').findOne({
      where: { user: outsiderExistingUser.id, tenant: fixture.tenant.id },
      select: ['id', 'userTenantStatus'],
    })
    assert.ok(attachedMembership?.id)
    assert.equal(attachedMembership?.userTenantStatus, 'active')
    const attachedRoles = await app.db.query('api::user-tenant-role.user-tenant-role').findMany({
      where: { userTenant: attachedMembership.id, userTenantRoleStatus: 'active' },
      populate: { role: { select: ['id'] } },
    })
    assert.deepEqual(attachedRoles.map((item) => Number(item?.role?.id || item?.role)).sort((a, b) => a - b), [fixture.roles.editorRole.id, fixture.roles.studentRole.id].sort((a, b) => a - b))

    const existingSameTenantCtx = createCtx({
      tenant: fixture.tenant,
      user: fixture.actor,
      body: {
        fullName: 'Existing Same Tenant',
        username: 'existing-global-user',
        email: 'existing-global-user@example.com',
        roleIds: [fixture.roles.teacherRole.id],
      },
    })
    await controller.createTenantUser(existingSameTenantCtx)
    assert.equal(existingSameTenantCtx.status, 400)
    assert.match(String(existingSameTenantCtx.body?.error?.message || ''), /user already exists in this tenant/i)

    const outsiderTenantMembershipCount = await app.db.query('api::user-tenant.user-tenant').count({
      where: { tenant: fixture.outsiderTenant.id, user: { username: { $eqi: 'create-one-role-user' } } },
    })
    assert.equal(outsiderTenantMembershipCount, 0)
  } finally {
    for (const action of fixture.cleanup.slice().reverse()) await action()
  }
})