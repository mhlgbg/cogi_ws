const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let sportsMeService
let authenticatedRoleId = 0

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadService(relativePath) {
  const modulePath = path.join(__dirname, '..', 'dist', ...relativePath.split('/'))
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
}

async function destroyEntity(uid, id) {
  if (!id) return
  try {
    await app.db.query(uid).delete({ where: { id } })
  } catch {
    // ignore cleanup issues in dev DB
  }
}

async function createTenant(label) {
  return app.db.query('api::tenant.tenant').create({
    data: {
      name: `Tenant ${label}`,
      code: label,
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
    select: ['id', 'username', 'email'],
  })
}

async function createUserTenant(tenantId, userId, label) {
  return app.db.query('api::user-tenant.user-tenant').create({
    data: {
      tenant: tenantId,
      user: userId,
      userTenantStatus: 'active',
      isDefault: true,
      joinedAt: new Date().toISOString(),
      label: `Membership ${label}`,
    },
    select: ['id'],
  })
}

async function createSportsClub(tenantId, label) {
  return app.db.query('api::sports-club.sports-club').create({
    data: {
      tenant: tenantId,
      code: `${label}`.toUpperCase(),
      name: `Club ${label}`,
      slug: `${label}`.toLowerCase(),
      clubType: 'club',
      sportType: 'running',
      status: 'active',
      joinPolicy: 'approval',
    },
    select: ['id', 'code', 'name'],
  })
}

async function createSportsProfile(tenantId, label, data = {}) {
  return app.db.query('api::sports-profile.sports-profile').create({
    data: {
      tenant: tenantId,
      code: `${label}`.toUpperCase(),
      fullName: `Profile ${label}`,
      displayName: `Display ${label}`,
      status: 'active',
      source: 'admin_created',
      ...data,
    },
    select: ['id', 'code', 'fullName', 'displayName', 'status'],
  })
}

async function createAssignment(tenantId, clubId, userId, label) {
  return app.db.query('api::sports-club-user-assignment.sports-club-user-assignment').create({
    data: {
      tenant: tenantId,
      club: clubId,
      user: userId,
      status: 'active',
      assignedAt: new Date().toISOString(),
      note: `Assignment ${label}`,
    },
    select: ['id'],
  })
}

async function createFixture() {
  const cleanup = []
  const key = uniqueKey('sports-me-profile')
  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  const user = await createUser(`${key}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))
  const userTenant = await createUserTenant(tenant.id, user.id, `${key}-user`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', userTenant.id))

  const manager = await createUser(`${key}-manager`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', manager.id))
  const managerTenant = await createUserTenant(tenant.id, manager.id, `${key}-manager`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', managerTenant.id))

  const otherUser = await createUser(`${key}-other-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', otherUser.id))
  const otherUserTenant = await createUserTenant(tenant.id, otherUser.id, `${key}-other-user`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', otherUserTenant.id))

  const club = await createSportsClub(tenant.id, `${key}-club`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', club.id))

  const assignment = await createAssignment(tenant.id, club.id, manager.id, `${key}-club`)
  cleanup.push(() => destroyEntity('api::sports-club-user-assignment.sports-club-user-assignment', assignment.id))

  return { cleanup, tenant, user, manager, otherUser, club }
}

async function cleanupFixture(fixture) {
  for (const action of (fixture.cleanup || []).slice().reverse()) {
    await action()
  }
}

async function expectReject(action, expectedCode, expectedMessagePattern) {
  let thrown = null
  try {
    await action()
  } catch (error) {
    thrown = error
  }
  assert.ok(thrown, 'Expected action to reject')
  if (expectedCode) {
    assert.equal(String(thrown.code || ''), expectedCode)
  }
  if (expectedMessagePattern) {
    assert.match(String(thrown.message || ''), expectedMessagePattern)
  }
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  global.strapi = app
  authenticatedRoleId = Number((await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] }))?.id || 0)
  if (!authenticatedRoleId) throw new Error('Authenticated role not found for test setup')
  sportsMeService = loadService('src/api/sports-me/services/sports-me.js')
})

after(async () => {
  if (app) await app.destroy()
})

test('sports me: current user cannot self-create sports profile', async () => {
  const fixture = await createFixture()
  try {
    await expectReject(
      () => sportsMeService.createMySportsProfile(fixture.tenant.id, fixture.user.id, {
        code: 'RUNNER001',
        fullName: 'Self Runner',
      }),
      'SPORTS_PROFILE_SELF_CREATE_DISABLED',
      /không được tự tạo hồ sơ thể thao/i,
    )
  } finally {
    await cleanupFixture(fixture)
  }
})

test('sports me: current user cannot self-claim existing sports profile', async () => {
  const fixture = await createFixture()
  try {
    const existing = await createSportsProfile(fixture.tenant.id, 'claim001', {
      code: 'CLAIM001',
      fullName: 'Claimable Profile',
      contactEmail: fixture.user.email,
    })
    fixture.cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', existing.id))

    await expectReject(
      () => sportsMeService.claimMyExistingSportsProfile(fixture.tenant.id, fixture.user.id, { code: 'CLAIM001' }, fixture.user),
      'SPORTS_PROFILE_SELF_CLAIM_DISABLED',
      /không được tự liên kết hồ sơ thể thao/i,
    )
  } finally {
    await cleanupFixture(fixture)
  }
})

test('sports me: linked user can view and self-update only allowed personal fields', async () => {
  const fixture = await createFixture()
  try {
    const linkedProfile = await createSportsProfile(fixture.tenant.id, 'self001', {
      code: 'SELF001',
      fullName: 'Official Name',
      displayName: 'Old Display',
      user: fixture.user.id,
      contactEmail: fixture.user.email,
      contactPhone: '0900000001',
      hometown: 'Hue',
      gender: 'female',
    })
    fixture.cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', linkedProfile.id))

    const fetched = await sportsMeService.getMySportsProfile(fixture.tenant.id, fixture.user.id)
    assert.equal(fetched.profile.code, 'SELF001')
    assert.equal(fetched.profile.fullName, 'Official Name')

    const updated = await sportsMeService.updateMySportsProfile(fixture.tenant.id, fixture.user.id, {
      displayName: 'New Display',
      hometown: 'Da Nang',
      contactPhone: '0911222333',
      contactEmail: 'updated@example.com',
      gender: 'other',
      birthYear: 1990,
      bio: 'Updated bio',
    })

    assert.equal(updated.profile.code, 'SELF001')
    assert.equal(updated.profile.fullName, 'Official Name')
    assert.equal(updated.profile.displayName, 'New Display')
    assert.equal(updated.profile.hometown, 'Da Nang')
    assert.equal(updated.profile.contactPhone, '0911222333')
    assert.equal(updated.profile.contactEmail, 'updated@example.com')
    assert.equal(updated.profile.gender, 'other')
    assert.equal(updated.profile.birthYear, 1990)
    assert.equal(updated.profile.bio, 'Updated bio')
  } finally {
    await cleanupFixture(fixture)
  }
})

test('sports me: self-update rejects profileCode, fullName, user, and tenant changes', async () => {
  const fixture = await createFixture()
  try {
    const linkedProfile = await createSportsProfile(fixture.tenant.id, 'self002', {
      code: 'SELF002',
      fullName: 'Locked Official Name',
      displayName: 'Editable Display',
      user: fixture.user.id,
      contactEmail: fixture.user.email,
    })
    fixture.cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', linkedProfile.id))

    await expectReject(
      () => sportsMeService.updateMySportsProfile(fixture.tenant.id, fixture.user.id, { code: 'HACK001' }),
      'UNKNOWN_FIELDS',
      /unknown fields/i,
    )

    await expectReject(
      () => sportsMeService.updateMySportsProfile(fixture.tenant.id, fixture.user.id, { fullName: 'Changed Name' }),
      'UNKNOWN_FIELDS',
      /unknown fields/i,
    )

    await expectReject(
      () => sportsMeService.updateMySportsProfile(fixture.tenant.id, fixture.user.id, { user: fixture.otherUser.id }),
      'UNKNOWN_FIELDS',
      /unknown fields/i,
    )

    await expectReject(
      () => sportsMeService.updateMySportsProfile(fixture.tenant.id, fixture.user.id, { tenant: fixture.tenant.id }),
      'UNKNOWN_FIELDS',
      /unknown fields/i,
    )

    const fetched = await sportsMeService.getMySportsProfile(fixture.tenant.id, fixture.user.id)
    assert.equal(fetched.profile.code, 'SELF002')
    assert.equal(fetched.profile.fullName, 'Locked Official Name')
  } finally {
    await cleanupFixture(fixture)
  }
})