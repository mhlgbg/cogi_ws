const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let service
let achievementService
let sportsMeService
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

function loadSportsMeService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'sports-me', 'services', 'sports-me.js')
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

async function createSportsProfile(tenantId, label, userId = null) {
  return app.db.query('api::sports-profile.sports-profile').create({
    data: {
      tenant: tenantId,
      user: userId || null,
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

async function createMembership(tenantId, profileId, clubId, memberCode, status = 'active') {
  return app.db.query('api::club-membership.club-membership').create({
    data: {
      tenant: tenantId,
      sportsProfile: profileId,
      club: clubId,
      memberCode,
      status,
      role: 'member',
      joinedAt: '2025-01-01',
      source: 'admin_created',
    },
    select: ['id', 'memberCode', 'status'],
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

  const profile = await createSportsProfile(tenant.id, `${key}-profile`, user.id)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', profile.id))

  const outsiderProfile = await createSportsProfile(outsiderTenant.id, `${key}-outsider-profile`)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', outsiderProfile.id))

  const club = await createSportsClub(tenant.id, `${key}-club`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', club.id))

  const outsiderClub = await createSportsClub(outsiderTenant.id, `${key}-outsider-club`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', outsiderClub.id))

  const membership = await createMembership(tenant.id, profile.id, club.id, 'SELF001', 'active')
  cleanup.push(() => destroyEntity('api::club-membership.club-membership', membership.id))

  const inactiveClub = await createSportsClub(tenant.id, `${key}-inactive-club`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', inactiveClub.id))

  const inactiveMembership = await createMembership(tenant.id, profile.id, inactiveClub.id, 'SELF002', 'inactive')
  cleanup.push(() => destroyEntity('api::club-membership.club-membership', inactiveMembership.id))

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
    membership,
    inactiveClub,
    inactiveMembership,
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
  sportsMeService = loadSportsMeService()
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
      achievedAt: '2026-01-01',
      distanceKm: 10,
      durationSeconds: 2720,
      source: 'club_manager',
      status: 'draft',
      evidence: [fixture.evidence.id],
    }, fixture.tenant.id, fixture.user)
    assert.equal(created.status, 'draft')
    assert.equal(created.submittedAt, null)
    assert.equal(created.distanceKm, 10)
    assert.equal(created.durationSeconds, 2720)
    assert.equal(created.resultValue, 2720)
    assert.equal(created.resultUnit, 'seconds')
    assert.equal(created.resultText, '00:45:20')

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
      achievedAt: '2026-01-02',
      distanceKm: 5,
      durationSeconds: 1215,
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
    assert.equal(achievement.distanceKm, 5)
    assert.equal(achievement.durationSeconds, 1215)
    assert.equal(achievement.resultText, '00:20:15')

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

test('sports me: self submit uses current profile and requires active membership', async () => {
  const fixture = await createFixture()
  try {
    const created = await sportsMeService.createMyAchievementSubmission(fixture.tenant.id, fixture.user.id, {
      club: fixture.club.id,
      achievementType: 'race_result',
      title: 'Member self submit',
      achievedAt: '2026-01-03',
      distanceKm: 42.195,
      durationSeconds: 3010,
      evidence: [fixture.evidence.id],
    }, fixture.user)

    assert.equal(created.status, 'submitted')
    assert.equal(created.source, 'member')
    assert.equal(created.sportsProfile.id, fixture.profile.id)
    assert.equal(created.club.id, fixture.club.id)
    assert.equal(created.sportType, 'running')
    assert.equal(created.distanceKm, 42.195)
    assert.equal(created.durationSeconds, 3010)
    assert.equal(created.resultText, '00:50:10')

    await assert.rejects(
      () => sportsMeService.createMyAchievementSubmission(fixture.tenant.id, fixture.user.id, {
        club: fixture.club.id,
        achievementType: 'club_award',
        title: 'Not allowed',
        achievedAt: '2026-01-03',
        distanceKm: 5,
        durationSeconds: 1200,
      }, fixture.user),
      (error) => error && error.code === 'SELF_ACHIEVEMENT_TYPE_NOT_ALLOWED',
    )

    await assert.rejects(
      () => sportsMeService.createMyAchievementSubmission(fixture.tenant.id, fixture.user.id, {
        club: fixture.inactiveClub.id,
        achievementType: 'race_result',
        title: 'Inactive membership submit',
      }, fixture.user),
      (error) => error && error.code === 'ACTIVE_CLUB_MEMBERSHIP_REQUIRED',
    )

    await assert.rejects(
      () => sportsMeService.createMyAchievementSubmission(fixture.tenant.id, fixture.user.id, {
        club: fixture.club.id,
        sportsProfile: fixture.outsiderProfile.id,
        achievementType: 'race_result',
        title: 'Spoof profile',
      }, fixture.user),
      (error) => error && error.code === 'UNKNOWN_FIELDS',
    )
  } finally {
    await cleanupFixture(fixture)
  }
})

test('sports achievement: client cannot write workflow fields directly', async () => {
  const fixture = await createFixture()
  try {
    await assert.rejects(
      () => achievementService.createTenantSportsAchievement({
        sportsProfile: fixture.profile.id,
        club: fixture.club.id,
        achievementType: 'other',
        title: 'Blocked workflow create',
        status: 'revoked',
      }, fixture.tenant.id, fixture.user),
      (error) => error && error.code === 'WORKFLOW_FIELDS_READONLY',
    )

    const created = await achievementService.createTenantSportsAchievement({
      sportsProfile: fixture.profile.id,
      club: fixture.club.id,
      achievementType: 'other',
      title: 'Allowed create',
    }, fixture.tenant.id, fixture.user)

    await assert.rejects(
      () => achievementService.updateTenantSportsAchievement(created.id, {
        status: 'revoked',
      }, fixture.tenant.id, fixture.user),
      (error) => error && error.code === 'WORKFLOW_FIELDS_READONLY',
    )
  } finally {
    await cleanupFixture(fixture)
  }
})
