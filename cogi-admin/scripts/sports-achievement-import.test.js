const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const XLSX = require('xlsx')

let app
let managementService
let achievementService
let submissionService
let authenticatedRoleId = 0

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadManagementService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'sports-club-management', 'services', 'sports-club-management.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
}

function loadAchievementService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'sports-achievement', 'services', 'sports-achievement.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
}

function loadSubmissionService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'sports-achievement-submission', 'services', 'sports-achievement-submission.js')
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
      code: `${label}`.toUpperCase(),
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
    select: ['id', 'code', 'fullName'],
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

async function createMembership(tenantId, profileId, clubId, memberCode = 'MEM001', status = 'active') {
  return app.db.query('api::club-membership.club-membership').create({
    data: {
      tenant: tenantId,
      sportsProfile: profileId,
      club: clubId,
      memberCode,
      status,
      role: 'member',
      joinedAt: '2024-01-01',
      source: 'admin_created',
    },
    select: ['id', 'memberCode', 'status'],
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

function buildWorkbookBuffer(rows) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Achievements')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
}

function buildImportFile(rows, name = 'achievement-import.xlsx') {
  return {
    name,
    originalFilename: name,
    buffer: buildWorkbookBuffer(rows),
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 1024,
  }
}

async function createFixture() {
  const cleanup = []
  const key = uniqueKey('achievement-import')
  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  const user = await createUser(`${key}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))

  const profile = await createSportsProfile(tenant.id, `${key}-profile`)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', profile.id))

  const club = await createSportsClub(tenant.id, `${key}-club`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', club.id))

  const assignment = await createAssignment(tenant.id, club.id, user.id, `${key}-club`)
  cleanup.push(() => destroyEntity('api::sports-club-user-assignment.sports-club-user-assignment', assignment.id))

  const membership = await createMembership(tenant.id, profile.id, club.id, 'RUN001', 'active')
  cleanup.push(() => destroyEntity('api::club-membership.club-membership', membership.id))

  const inactiveClub = await createSportsClub(tenant.id, `${key}-inactive-club`)
  cleanup.push(() => destroyEntity('api::sports-club.sports-club', inactiveClub.id))

  const inactiveMembership = await createMembership(tenant.id, profile.id, inactiveClub.id, 'RUN002', 'inactive')
  cleanup.push(() => destroyEntity('api::club-membership.club-membership', inactiveMembership.id))

  return { cleanup, tenant, user, profile, club, membership, inactiveClub, inactiveMembership }
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
  managementService = loadManagementService()
  achievementService = loadAchievementService()
  submissionService = loadSubmissionService()
})

after(async () => {
  if (app) await app.destroy()
})

test('achievement import preview allows race_result without distance and marks warning', async () => {
  const fixture = await createFixture()
  try {
    const file = buildImportFile([{
      profileCode: fixture.profile.code,
      eventCode: 'VMM2023',
      eventName: 'Vietnam Mountain Marathon 2023',
      bib: '0007',
      distance: '',
      raceType: 'Trail Running',
      finishTime: '10:15:30',
      achievedAt: '2023-09-22 05:00',
      sourceRef: 'results:VMM2023:0007',
      note: 'Historical trail result',
    }])

    const preview = await managementService.previewManagedClubAchievementImport(fixture.user.id, fixture.club.id, fixture.tenant.id, file, {
      titleStrategy: 'auto_event_bib',
      processingMode: 'verify_now',
    })

    assert.equal(preview.summary.errorCount, 0)
    assert.equal(preview.summary.warningCount, 1)
    assert.equal(preview.rows[0].status, 'WARNING')
    assert.equal(preview.rows[0].action, 'CREATE')
    assert.equal(preview.rows[0].nextValues.distancePending, true)
    assert.equal(preview.rows[0].nextValues.distanceKm, undefined)
    assert.equal(preview.rows[0].nextValues.raceType, 'trail')
  } finally {
    await cleanupFixture(fixture)
  }
})

test('achievement import confirm creates verified result with null distance and pending flag', async () => {
  const fixture = await createFixture()
  try {
    const file = buildImportFile([{
      profileCode: fixture.profile.code,
      eventCode: 'VMM2017',
      eventName: 'Vietnam Mountain Marathon 2017',
      bib: 'B017',
      distance: '',
      raceType: '',
      finishTime: '12:05:00',
      achievedAt: '2017-09-23 05:30',
      sourceRef: 'results:VMM2017:B017',
      note: 'Historic import',
    }])

    const result = await managementService.confirmManagedClubAchievementImport(fixture.user.id, fixture.club.id, fixture.tenant.id, file, {
      titleStrategy: 'auto_event_bib',
      processingMode: 'verify_now',
    }, fixture.user)

    assert.equal(result.summary.createdCount, 1)
    assert.equal(result.summary.errorCount, 0)

    const achievements = await achievementService.listTenantSportsAchievements({ club: fixture.club.id }, fixture.tenant.id)
    const created = achievements.rows.find((item) => item.sourceReference === 'results:VMM2017:B017')
    assert.ok(created)
    assert.equal(created.distanceKm, null)
    assert.equal(created.distancePending, true)
    assert.equal(created.raceType, 'trail')
    assert.equal(created.bib, 'B017')
    assert.equal(created.eventCode, 'VMM2017')
  } finally {
    await cleanupFixture(fixture)
  }
})

test('achievement import reimport supplements missing distance instead of creating duplicate', async () => {
  const fixture = await createFixture()
  try {
    const missingDistanceFile = buildImportFile([{
      profileCode: fixture.profile.code,
      eventCode: 'VMM2023',
      eventName: 'Vietnam Mountain Marathon 2023',
      bib: 'A123',
      distance: '',
      raceType: 'Trail',
      finishTime: '11:00:00',
      achievedAt: '2023-09-23 05:00',
      sourceRef: 'results:VMM2023:A123',
    }], 'missing-distance.xlsx')

    await managementService.confirmManagedClubAchievementImport(fixture.user.id, fixture.club.id, fixture.tenant.id, missingDistanceFile, {
      titleStrategy: 'auto_event_bib',
      processingMode: 'verify_now',
    }, fixture.user)

    const distanceFile = buildImportFile([{
      profileCode: fixture.profile.code,
      eventCode: 'VMM2023',
      eventName: 'Vietnam Mountain Marathon 2023',
      bib: 'A123',
      distance: '70',
      raceType: 'Trail',
      finishTime: '11:00:00',
      achievedAt: '2023-09-23 05:00',
      sourceRef: 'results:VMM2023:A123',
    }], 'supplement-distance.xlsx')

    const preview = await managementService.previewManagedClubAchievementImport(fixture.user.id, fixture.club.id, fixture.tenant.id, distanceFile, {
      titleStrategy: 'auto_event_bib',
      processingMode: 'verify_now',
    })
    assert.equal(preview.rows[0].action, 'SUPPLEMENT_ACHIEVEMENT')

    const confirm = await managementService.confirmManagedClubAchievementImport(fixture.user.id, fixture.club.id, fixture.tenant.id, distanceFile, {
      titleStrategy: 'auto_event_bib',
      processingMode: 'verify_now',
    }, fixture.user)
    assert.equal(confirm.summary.createdCount, 0)
    assert.equal(confirm.summary.updatedCount, 1)

    const achievements = await achievementService.listTenantSportsAchievements({ club: fixture.club.id }, fixture.tenant.id)
    const matches = achievements.rows.filter((item) => item.sourceReference === 'results:VMM2023:A123')
    assert.equal(matches.length, 1)
    assert.equal(matches[0].distanceKm, 70)
    assert.equal(matches[0].distancePending, false)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('achievement import preview flags missing-distance rows without bib and sourceRef as warning review', async () => {
  const fixture = await createFixture()
  try {
    const file = buildImportFile([{
      profileCode: fixture.profile.code,
      eventCode: 'VMM2018',
      eventName: 'Vietnam Mountain Marathon 2018',
      bib: '',
      distance: '',
      raceType: 'Trail',
      finishTime: '08:45:00',
      achievedAt: '2018-09-22 05:00',
      sourceRef: '',
    }], 'needs-review.xlsx')

    const preview = await managementService.previewManagedClubAchievementImport(fixture.user.id, fixture.club.id, fixture.tenant.id, file, {
      titleStrategy: 'auto_event_bib',
      processingMode: 'verify_now',
    })

    assert.equal(preview.summary.warningCount, 1)
    assert.equal(preview.rows[0].canImport, false)
    assert.match(preview.rows[0].reason, /Insufficient duplicate-detection data/i)
  } finally {
    await cleanupFixture(fixture)
  }
})
