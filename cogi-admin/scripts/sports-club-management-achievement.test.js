const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let service
let authenticatedRoleId = 0

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'sports-club-management', 'services', 'sports-club-management.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
}

async function destroyEntity(uid, id) {
  if (!id) return
  try {
    await app.db.query(uid).delete({ where: { id } })
  } catch {
    // ignore cleanup failures in dev DB
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
    select: ['id', 'status'],
  })
}

async function createMembership(tenantId, profileId, clubId, memberCode) {
  return app.db.query('api::club-membership.club-membership').create({
    data: {
      tenant: tenantId,
      sportsProfile: profileId,
      club: clubId,
      memberCode,
      status: 'active',
      role: 'member',
      joinedAt: '2025-01-01',
      source: 'admin_created',
    },
    select: ['id', 'memberCode', 'status'],
  })
}

async function createFixture() {
  const cleanup = []
  const key = uniqueKey('managed-achievement')
  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  const manager = await createUser(`${key}-manager`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', manager.id))

  const outsiderUser = await createUser(`${key}-outsider-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', outsiderUser.id))

  const otherTenant = await createTenant(`${key}-other-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', otherTenant.id))

  const clubA = await createSportsClub(tenant.id, `${key}-club-a`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', clubA.id))

  const clubB = await createSportsClub(tenant.id, `${key}-club-b`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', clubB.id))

  const otherTenantClub = await createSportsClub(otherTenant.id, `${key}-club-other`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', otherTenantClub.id))

  const profileA = await createSportsProfile(tenant.id, `${key}-profile-a`)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', profileA.id))

  const profileB = await createSportsProfile(tenant.id, `${key}-profile-b`)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', profileB.id))

  const otherTenantProfile = await createSportsProfile(otherTenant.id, `${key}-profile-other`)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', otherTenantProfile.id))

  const assignment = await createAssignment(tenant.id, clubA.id, manager.id, `${key}-club-a`)
  cleanup.push(() => destroyEntity('api::sports-club-user-assignment.sports-club-user-assignment', assignment.id))

  const membership = await createMembership(tenant.id, profileA.id, clubA.id, 'MGR001')
  cleanup.push(() => destroyEntity('api::club-membership.club-membership', membership.id))

  const evidence = await createUploadFile(`${key}-evidence`)
  cleanup.push(() => destroyEntity('plugin::upload.file', evidence.id))

  return { cleanup, tenant, manager, outsiderUser, otherTenant, clubA, clubB, otherTenantClub, profileA, profileB, otherTenantProfile, evidence }
}

async function cleanupFixture(fixture) {
  for (const action of (fixture.cleanup || []).slice().reverse()) {
    await action()
  }
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  global.strapi = app
  authenticatedRoleId = Number((await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] }))?.id || 0)
  if (!authenticatedRoleId) throw new Error('Authenticated role not found for test setup')
  service = loadService()
})

after(async () => {
  if (app) await app.destroy()
})

test('managed club achievements: manager can create submitted submission and member code is attached', async () => {
  const fixture = await createFixture()
  try {
    const created = await service.createManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, fixture.tenant.id, {
      sportsProfile: fixture.profileA.id,
      achievementType: 'race_result',
      sportType: 'running',
      title: '10K Night Run',
      resultText: '46:00',
      evidence: [fixture.evidence.id],
    }, fixture.manager)
    assert.equal(created.status, 'submitted')
    assert.equal(created.source, 'club_manager')
    assert.equal(created.achievement, null)
    assert.equal(created.clubMembership.memberCode, 'MGR001')
    assert.equal(created.evidence.length, 1)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('managed club achievements: direct record creates verified submission and one active achievement', async () => {
  const fixture = await createFixture()
  try {
    const created = await service.createManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, fixture.tenant.id, {
      sportsProfile: fixture.profileA.id,
      achievementType: 'personal_best',
      sportType: 'running',
      title: '5K PB',
      resultText: '20:11',
      evidence: [fixture.evidence.id],
      verifyNow: true,
    }, fixture.manager)
    assert.equal(created.status, 'verified')
    assert.ok(created.achievement?.id)

    const listed = await service.listManagedClubAchievements(fixture.manager.id, fixture.clubA.id, fixture.tenant.id, {})
    assert.equal(listed.rows.length, 1)
    assert.equal(listed.rows[0].id, created.achievement.id)
    assert.equal(listed.rows[0].status, 'active')
    assert.equal(listed.rows[0].clubMembership.memberCode, 'MGR001')
  } finally {
    await cleanupFixture(fixture)
  }
})

test('managed club achievements: verify is idempotent and reject does not create achievement', async () => {
  const fixture = await createFixture()
  try {
    const verifyCandidate = await service.createManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, fixture.tenant.id, {
      sportsProfile: fixture.profileA.id,
      achievementType: 'finisher',
      title: 'Half Marathon',
      resultText: '01:55:00',
    }, fixture.manager)

    const verified = await service.verifyManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, verifyCandidate.id, fixture.tenant.id, { reviewNote: 'ok' }, fixture.manager)
    const verifiedAgain = await service.verifyManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, verifyCandidate.id, fixture.tenant.id, { reviewNote: 'retry' }, fixture.manager)
    assert.equal(verified.status, 'verified')
    assert.equal(verifiedAgain.status, 'verified')
    assert.equal(verifiedAgain.achievement.id, verified.achievement.id)

    const rejectCandidate = await service.createManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, fixture.tenant.id, {
      sportsProfile: fixture.profileB.id,
      achievementType: 'other',
      title: 'Need proof',
    }, fixture.manager)
    const rejected = await service.rejectManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, rejectCandidate.id, fixture.tenant.id, { reviewNote: 'missing evidence' }, fixture.manager)
    assert.equal(rejected.status, 'rejected')
    assert.equal(rejected.achievement, null)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('managed club achievements: revoke requires reason, is not repeatable, and correction submission clones revoked achievement', async () => {
  const fixture = await createFixture()
  try {
    const created = await service.createManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, fixture.tenant.id, {
      sportsProfile: fixture.profileA.id,
      achievementType: 'race_result',
      sportType: 'running',
      title: 'FM Result',
      resultText: '03:30:28',
      evidence: [fixture.evidence.id],
      verifyNow: true,
    }, fixture.manager)

    await assert.rejects(
      () => service.revokeManagedClubAchievement(fixture.manager.id, fixture.clubA.id, created.achievement.id, fixture.tenant.id, { reason: '' }, fixture.manager),
      (error) => error && error.status === 400,
    )

    const revoked = await service.revokeManagedClubAchievement(fixture.manager.id, fixture.clubA.id, created.achievement.id, fixture.tenant.id, { reason: 'Nhập sai kết quả FM.' }, fixture.manager)
    assert.equal(revoked.status, 'revoked')
    assert.ok(revoked.revokedAt)
    assert.equal(revoked.revokedBy.id, fixture.manager.id)
    assert.equal(revoked.revokeReason, 'Nhập sai kết quả FM.')

    await assert.rejects(
      () => service.revokeManagedClubAchievement(fixture.manager.id, fixture.clubA.id, created.achievement.id, fixture.tenant.id, { reason: 'retry' }, fixture.manager),
      (error) => error && error.status === 409,
    )

    const listed = await service.listManagedClubAchievements(fixture.manager.id, fixture.clubA.id, fixture.tenant.id, { status: 'revoked' })
    assert.equal(listed.rows.length, 1)
    assert.equal(listed.rows[0].id, created.achievement.id)

    const correction = await service.createManagedClubAchievementCorrectionSubmission(fixture.manager.id, fixture.clubA.id, created.achievement.id, fixture.tenant.id, fixture.manager)
    assert.equal(correction.status, 'draft')
    assert.equal(correction.source, 'club_manager')
    assert.equal(correction.sourceAchievement.id, created.achievement.id)
    assert.equal(correction.title, 'FM Result')
    assert.equal(correction.resultText, '03:30:28')
    assert.equal(correction.evidence.length, 1)

    const corrected = await service.updateManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, correction.id, fixture.tenant.id, {
      resultText: '03:31:28',
      title: correction.title,
      sportsProfile: fixture.profileA.id,
      achievementType: correction.achievementType,
      sportType: correction.sportType,
      achievedAt: correction.achievedAt,
      resultValue: correction.resultValue,
      resultUnit: correction.resultUnit,
      description: correction.description,
      sourceReference: correction.sourceReference,
      note: correction.note,
      evidence: correction.evidence.map((item) => item.id),
    }, fixture.manager)
    const submittedCorrection = await service.submitManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, corrected.id, fixture.tenant.id, fixture.manager)
    assert.equal(submittedCorrection.status, 'submitted')
    const verifiedCorrection = await service.verifyManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, corrected.id, fixture.tenant.id, { reviewNote: 'Đã sửa kết quả' }, fixture.manager)
    assert.equal(verifiedCorrection.status, 'verified')
    assert.ok(verifiedCorrection.achievement?.id)
    assert.notEqual(verifiedCorrection.achievement.id, created.achievement.id)

    const activeList = await service.listManagedClubAchievements(fixture.manager.id, fixture.clubA.id, fixture.tenant.id, { status: 'active' })
    assert.equal(activeList.rows.length, 1)
    assert.equal(activeList.rows[0].resultText, '03:31:28')

    const revokedDetail = await service.getManagedClubAchievementDetail(fixture.manager.id, fixture.clubA.id, created.achievement.id, fixture.tenant.id)
    assert.equal(revokedDetail.status, 'revoked')
    assert.equal(revokedDetail.resultText, '03:30:28')
  } finally {
    await cleanupFixture(fixture)
  }
})

test('managed club achievements: assignment and tenant scope block other clubs and other-tenant profiles', async () => {
  const fixture = await createFixture()
  try {
    await assert.rejects(
      () => service.listManagedClubAchievements(fixture.manager.id, fixture.clubB.id, fixture.tenant.id, {}),
      (error) => error && error.status === 403,
    )

    await assert.rejects(
      () => service.createManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, fixture.tenant.id, {
        sportsProfile: fixture.otherTenantProfile.id,
        achievementType: 'other',
        title: 'Cross tenant profile',
      }, fixture.manager),
      (error) => error && error.status === 404,
    )

    const created = await service.createManagedClubAchievementSubmission(fixture.manager.id, fixture.clubA.id, fixture.tenant.id, {
      sportsProfile: fixture.profileA.id,
      achievementType: 'other',
      title: 'Only Club A',
      verifyNow: true,
    }, fixture.manager)

    const clubBAssignment = await createAssignment(fixture.tenant.id, fixture.clubB.id, fixture.outsiderUser.id, 'club-b')
    fixture.cleanup.push(() => destroyEntity('api::sports-club-user-assignment.sports-club-user-assignment', clubBAssignment.id))
    const outsiderList = await service.listManagedClubAchievements(fixture.outsiderUser.id, fixture.clubB.id, fixture.tenant.id, {})
    assert.equal(outsiderList.rows.length, 0)
    assert.ok(created.achievement?.id)
  } finally {
    await cleanupFixture(fixture)
  }
})
