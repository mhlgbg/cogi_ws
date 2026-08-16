const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let service
let achievementService
let authenticatedRoleId = 0

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadSubmissionService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'sports-achievement-submission', 'services', 'sports-achievement-submission.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
}

function loadAchievementService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'sports-achievement', 'services', 'sports-achievement.js')
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

async function createUploadFile(label) {
  return app.db.query('plugin::upload.file').create({
    data: {
      name: `${label}.png`,
      hash: `${label}-hash`,
      ext: '.png',
      mime: 'image/png',
      size: 1,
      url: `/uploads/${label}.png`,
      provider: 'local',
      folderPath: '/api-uploads',
      width: 32,
      height: 32,
      alternativeText: label,
      caption: label,
    },
    select: ['id', 'url', 'mime', 'name'],
  })
}

async function createUser(label) {
  return app.db.query('plugin::users-permissions.user').create({
    data: {
      username: `${label}`,
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

async function createTenant(label) {
  return app.db.query('api::tenant.tenant').create({
    data: {
      name: `Tenant ${label}`,
      code: `${label}`,
      tenantStatus: 'active',
      siteTitle: `Tenant ${label}`,
    },
    select: ['id', 'code', 'name'],
  })
}

async function createSportsProfile(tenantId, label) {
  return app.db.query('api::sports-profile.sports-profile').create({
    data: {
      tenant: tenantId,
      code: `${label}`.toUpperCase(),
      fullName: `Profile ${label}`,
      displayName: `Display ${label}`,
      status: 'active',
      source: 'admin_created',
      contactPhone: '0900000000',
      contactEmail: `${label}@profile.example.com`,
    },
    select: ['id', 'code', 'fullName', 'displayName'],
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

async function createFixture() {
  const cleanup = []
  const key = uniqueKey('achievement')
  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  const user = await createUser(`${key}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))

  const outsiderTenant = await createTenant(`${key}-other-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', outsiderTenant.id))

  const outsiderUser = await createUser(`${key}-other-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', outsiderUser.id))

  const profile = await createSportsProfile(tenant.id, `${key}-profile`)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', profile.id))

  const outsiderProfile = await createSportsProfile(outsiderTenant.id, `${key}-outsider-profile`)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', outsiderProfile.id))

  const club = await createSportsClub(tenant.id, `${key}-club`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', club.id))

  const outsiderClub = await createSportsClub(outsiderTenant.id, `${key}-outsider-club`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', outsiderClub.id))

  const evidence = await createUploadFile(`${key}-evidence`)
  cleanup.push(() => destroyEntity('plugin::upload.file', evidence.id))

  return {
    cleanup,
    tenant,
    user,
    outsiderTenant,
    outsiderUser,
    profile,
    outsiderProfile,
    club,
    outsiderClub,
    evidence,
  }
}

async function cleanupFixture(fixture) {
  for (const action of (fixture.cleanup || []).slice().reverse()) {
    await action()
  }
}

async function countAchievementsForProfile(tenantId, profileId) {
  return Number(await app.db.query('api::sports-achievement.sports-achievement').count({ where: { $and: [{ tenant: { id: { $eq: tenantId } } }, { sportsProfile: { id: { $eq: profileId } } }] } }))
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  global.strapi = app
  authenticatedRoleId = Number((await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] }))?.id || 0)
  if (!authenticatedRoleId) throw new Error('Authenticated role not found for test setup')
  service = loadSubmissionService()
  achievementService = loadAchievementService()
})

after(async () => {
  if (app) await app.destroy()
})

test('sports achievement submission: create draft then submit sets submittedAt', async () => {
  const fixture = await createFixture()
  try {
    const created = await service.createTenantSportsAchievementSubmission({
      sportsProfile: fixture.profile.id,
      club: fixture.club.id,
      achievementType: 'race_result',
      sportType: 'running',
      title: 'Da Nang Marathon 10K',
      resultText: '45:20',
      source: 'club_manager',
      status: 'draft',
      evidence: [fixture.evidence.id],
    }, fixture.tenant.id, fixture.user)
    assert.equal(created.status, 'draft')
    assert.equal(created.submittedAt, null)

    const submitted = await service.submitAchievementSubmission(created.id, fixture.tenant.id, fixture.user)
    assert.equal(submitted.status, 'submitted')
    assert.ok(submitted.submittedAt)
    assert.equal(submitted.submittedBy.id, fixture.user.id)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('sports achievement submission: verify creates one active achievement and is idempotent', async () => {
  const fixture = await createFixture()
  try {
    const created = await service.createTenantSportsAchievementSubmission({
      sportsProfile: fixture.profile.id,
      club: fixture.club.id,
      achievementType: 'personal_best',
      sportType: 'running',
      title: '5K PB',
      resultText: '20:15',
      source: 'club_manager',
      status: 'submitted',
      evidence: [fixture.evidence.id],
    }, fixture.tenant.id, fixture.user)

    const verified = await service.verifyAchievementSubmission(created.id, fixture.tenant.id, { reviewNote: 'OK' }, fixture.user)
    assert.equal(verified.status, 'verified')
    assert.ok(verified.achievement?.id)
    assert.ok(verified.reviewedAt)
    assert.equal(verified.reviewedBy.id, fixture.user.id)

    const achievement = await achievementService.getTenantSportsAchievement(verified.achievement.id, fixture.tenant.id)
    assert.equal(achievement.status, 'active')
    assert.equal(achievement.verifiedBy.id, fixture.user.id)
    assert.ok(achievement.verifiedAt)
    assert.equal(achievement.evidence.length, 1)

    const beforeCount = await countAchievementsForProfile(fixture.tenant.id, fixture.profile.id)
    const verifiedAgain = await service.verifyAchievementSubmission(created.id, fixture.tenant.id, { reviewNote: 'Retry' }, fixture.user)
    const afterCount = await countAchievementsForProfile(fixture.tenant.id, fixture.profile.id)
    assert.equal(verifiedAgain.status, 'verified')
    assert.equal(verifiedAgain.achievement.id, verified.achievement.id)
    assert.equal(afterCount, beforeCount)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('sports achievement submission: reject submitted does not create achievement', async () => {
  const fixture = await createFixture()
  try {
    const created = await service.createTenantSportsAchievementSubmission({
      sportsProfile: fixture.profile.id,
      club: fixture.club.id,
      achievementType: 'finisher',
      sportType: 'running',
      title: 'Half Marathon Finisher',
      resultText: '01:55:00',
      source: 'member',
      status: 'submitted',
    }, fixture.tenant.id, fixture.user)

    const rejected = await service.rejectAchievementSubmission(created.id, fixture.tenant.id, { reviewNote: 'Missing evidence' }, fixture.user)
    assert.equal(rejected.status, 'rejected')
    assert.equal(rejected.achievement, null)
    assert.ok(rejected.reviewedAt)
    assert.equal(rejected.reviewedBy.id, fixture.user.id)
    assert.equal(rejected.reviewNote, 'Missing evidence')
    assert.equal(await countAchievementsForProfile(fixture.tenant.id, fixture.profile.id), 0)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('sports achievement submission: tenant isolation blocks cross-tenant profile or club', async () => {
  const fixture = await createFixture()
  try {
    await assert.rejects(
      () => service.createTenantSportsAchievementSubmission({
        sportsProfile: fixture.outsiderProfile.id,
        club: fixture.club.id,
        achievementType: 'other',
        title: 'Invalid cross tenant profile',
        source: 'other',
        status: 'draft',
      }, fixture.tenant.id, fixture.user),
      (error) => error && error.status === 404,
    )

    await assert.rejects(
      () => service.createTenantSportsAchievementSubmission({
        sportsProfile: fixture.profile.id,
        club: fixture.outsiderClub.id,
        achievementType: 'other',
        title: 'Invalid cross tenant club',
        source: 'other',
        status: 'draft',
      }, fixture.tenant.id, fixture.user),
      (error) => error && error.status === 404,
    )
  } finally {
    await cleanupFixture(fixture)
  }
})
