const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let service
let controller
let authenticatedRoleId = 0
let originalFetch

const STRAVA_CONNECTION_UID = 'api::strava-connection.strava-connection'
const STRAVA_ACTIVITY_UID = 'api::strava-activity.strava-activity'
const STRAVA_SYNC_JOB_UID = 'api::strava-sync-job.strava-sync-job'

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'strava', 'services', 'strava.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath).default
}

function loadController() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'strava', 'controllers', 'strava.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath).default
}

async function destroyEntity(uid, id) {
  if (!id) return
  try {
    await app.db.query(uid).delete({ where: { id } })
  } catch {
    // ignore cleanup failures in dev DB
  }
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

async function createConnection(tenantId, userId, label, overrides = {}) {
  return app.db.query(STRAVA_CONNECTION_UID).create({
    data: {
      tenant: tenantId,
      user: userId,
      stravaAthleteId: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
      athleteUsername: `${label}-athlete`,
      athleteFirstname: 'Strava',
      athleteLastname: 'Runner',
      profileUrl: `https://example.com/${label}`,
      accessToken: `access-${label}`,
      refreshToken: `refresh-${label}`,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      scope: 'read,activity:read',
      status: 'ACTIVE',
      lastSyncStatus: 'SUCCESS',
      rawAthlete: {
        id: `${Date.now()}`,
        firstname: 'Strava',
        lastname: 'Runner',
        username: `${label}-athlete`,
      },
      cleanupStatus: 'NOT_REQUIRED',
      ...overrides,
    },
    select: ['id', 'status', 'cleanupStatus'],
  })
}

async function createStravaActivity(tenantId, userId, connectionId, label) {
  return app.db.query(STRAVA_ACTIVITY_UID).create({
    data: {
      tenant: tenantId,
      user: userId,
      connection: connectionId,
      stravaActivityId: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: `Run ${label}`,
      type: 'Run',
      sportType: 'Run',
      startDate: new Date().toISOString(),
      startDateLocal: new Date().toISOString(),
      timezone: '(GMT+07:00) Asia/Ho_Chi_Minh',
      distance: 5000,
      movingTime: 1800,
      elapsedTime: 1900,
      totalElevationGain: 50,
      averageSpeed: 2.7,
      maxSpeed: 4.2,
      averageHeartrate: 150,
      maxHeartrate: 170,
      calories: 400,
      visibility: 'PRIVATE',
      syncStatus: 'SYNCED',
      rawActivity: {
        id: `${Date.now()}`,
        name: `Run ${label}`,
      },
    },
    select: ['id'],
  })
}

async function createSyncJob(tenantId, userId, connectionId, overrides = {}) {
  return app.db.query(STRAVA_SYNC_JOB_UID).create({
    data: {
      tenant: tenantId,
      user: userId,
      connection: connectionId,
      status: 'completed',
      phase: 'finalizing',
      syncMode: 'initial',
      currentPage: 1,
      perPage: 100,
      processedActivities: 2,
      createdActivities: 2,
      updatedActivities: 0,
      skippedActivities: 0,
      failedActivities: 0,
      retryCount: 0,
      requestedAt: new Date(Date.now() - 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 55 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 50 * 1000).toISOString(),
      heartbeatAt: new Date(Date.now() - 50 * 1000).toISOString(),
      metadata: {
        snapshotSummary: { totalActivities: 2 },
        snapshotIsComplete: true,
        lastCompletedSyncAt: new Date(Date.now() - 50 * 1000).toISOString(),
      },
      ...overrides,
    },
    select: ['id', 'status', 'syncMode', 'metadata'],
  })
}

async function loadConnection(id) {
  return app.db.query(STRAVA_CONNECTION_UID).findOne({
    where: { id },
    select: ['id', 'status', 'cleanupStatus', 'cleanupRequestedAt', 'cleanupCompletedAt', 'cleanupError', 'disconnectedAt', 'accessToken', 'refreshToken', 'lastSyncStatus', 'activityDeleteMarkers'],
  })
}

async function countJobsForConnection(connectionId) {
  return app.db.query(STRAVA_SYNC_JOB_UID).count({
    where: {
      connection: { id: connectionId },
    },
  })
}

async function loadLatestJob(connectionId) {
  const jobs = await app.db.query(STRAVA_SYNC_JOB_UID).findMany({
    where: {
      connection: { id: connectionId },
    },
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    limit: 1,
    select: ['id', 'status', 'syncMode', 'phase', 'requestedAt'],
  })
  return Array.isArray(jobs) ? jobs[0] || null : null
}

async function loadOAuthStateByRecordId(recordId) {
  return app.db.query('api::strava-oauth-state.strava-oauth-state').findOne({
    where: { id: recordId },
    select: ['id', 'usedAt'],
  })
}

function installTokenExchangeMock() {
  const calls = []
  global.fetch = async (input) => {
    const url = typeof input === 'string' ? input : String(input?.url || '')
    calls.push(url)
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          token_type: 'Bearer',
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          scope: 'read,activity:read',
          athlete: {
            id: '789123',
            username: 'runner-updated',
            firstname: 'Runner',
            lastname: 'Updated',
            profile: 'https://example.com/profile.png',
          },
        }
      },
    }
  }
  return calls
}

async function createOAuthState(tenantId, userId) {
  const state = await service.createSignedOAuthState(tenantId, userId, { frontendOrigin: process.env.FRONTEND_URL })
  const verified = await service.verifySignedOAuthState(state)
  return { state, recordId: verified.recordId }
}

function createCallbackContext(state) {
  const ctx = {
    query: {
      state,
      code: 'oauth-code-123',
      scope: 'read,activity:read',
    },
    request: {
      query: {
        state,
        code: 'oauth-code-123',
        scope: 'read,activity:read',
      },
    },
    status: 0,
    redirectedTo: null,
    redirect(url) {
      this.redirectedTo = url
    },
    internalServerError(message) {
      this.status = 500
      this.body = { error: message }
      return this.body
    },
  }
  return ctx
}

async function cleanupFixture(fixture) {
  for (const action of (fixture.cleanup || []).slice().reverse()) {
    await action()
  }
}

before(async () => {
  process.env.STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '12345'
  process.env.STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || 'secret-12345'
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  global.strapi = app
  authenticatedRoleId = Number((await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] }))?.id || 0)
  if (!authenticatedRoleId) throw new Error('Authenticated role not found for test setup')
  service = loadService()
  controller = loadController()
  originalFetch = global.fetch
})

after(async () => {
  global.fetch = originalFetch
  if (app) await app.destroy()
})

test('oauth callback first connect creates exactly one initial sync job', async () => {
  const label = uniqueKey('oauth-first')
  const cleanup = []
  const tenant = await createTenant(`${label}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const user = await createUser(`${label}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))
  const tokenCalls = installTokenExchangeMock()

  try {
    const { state } = await createOAuthState(tenant.id, user.id)
    const ctx = createCallbackContext(state)

    await controller.callback(ctx)

    assert.equal(ctx.status, 302)
    assert.match(String(ctx.redirectedTo || ''), /connected=1/)
    assert.equal(tokenCalls.length, 1)

    const connection = await app.db.query(STRAVA_CONNECTION_UID).findOne({
      where: { tenant: tenant.id, user: user.id },
      select: ['id', 'status', 'cleanupStatus'],
    })

    assert.ok(connection?.id)
    assert.equal(connection.status, 'ACTIVE')
    assert.equal(connection.cleanupStatus, 'NOT_REQUIRED')

    const jobCount = await countJobsForConnection(connection.id)
    const latestJob = await loadLatestJob(connection.id)
    assert.equal(Number(jobCount || 0), 1)
    assert.equal(latestJob.status, 'queued')
    assert.equal(latestJob.syncMode, 'initial')

    cleanup.push(() => destroyEntity(STRAVA_CONNECTION_UID, connection.id))
    cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, latestJob.id))
  } finally {
    global.fetch = originalFetch
    await cleanupFixture({ cleanup })
  }
})

test('oauth callback reconnect after completed cleanup reuses connection and creates one initial job', async () => {
  const label = uniqueKey('oauth-reconnect')
  const cleanup = []
  const tenant = await createTenant(`${label}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const user = await createUser(`${label}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))
  const connection = await createConnection(tenant.id, user.id, label, {
    status: 'DISCONNECTED',
    cleanupStatus: 'COMPLETED',
    cleanupRequestedAt: new Date(Date.now() - 120000).toISOString(),
    cleanupCompletedAt: new Date(Date.now() - 60000).toISOString(),
    disconnectedAt: new Date(Date.now() - 120000).toISOString(),
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    stravaAthleteId: null,
    athleteUsername: null,
    athleteFirstname: null,
    athleteLastname: null,
    profileUrl: null,
    rawAthlete: null,
    scope: null,
    lastSyncStatus: 'SUCCESS',
    activityDeleteMarkers: [{ stravaActivityId: 'old-activity', deletedEventTime: '123456', deletedAt: new Date().toISOString() }],
  })
  cleanup.push(() => destroyEntity(STRAVA_CONNECTION_UID, connection.id))
  const historicalJob = await createSyncJob(tenant.id, user.id, connection.id)
  cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, historicalJob.id))
  const tokenCalls = installTokenExchangeMock()

  try {
    const beforeCount = await countJobsForConnection(connection.id)
    const { state } = await createOAuthState(tenant.id, user.id)
    const ctx = createCallbackContext(state)

    await controller.callback(ctx)

    assert.equal(ctx.status, 302)
    assert.match(String(ctx.redirectedTo || ''), /connected=1/)
    assert.equal(tokenCalls.length, 1)

    const updatedConnection = await loadConnection(connection.id)
    assert.equal(updatedConnection.id, connection.id)
    assert.equal(updatedConnection.status, 'ACTIVE')
    assert.equal(updatedConnection.cleanupStatus, 'NOT_REQUIRED')
    assert.equal(updatedConnection.cleanupRequestedAt, null)
    assert.equal(updatedConnection.cleanupCompletedAt, null)
    assert.equal(updatedConnection.disconnectedAt, null)
    assert.deepEqual(updatedConnection.activityDeleteMarkers || [], [])

    const afterCount = await countJobsForConnection(connection.id)
    const latestJob = await loadLatestJob(connection.id)
    assert.equal(Number(afterCount || 0), Number(beforeCount || 0) + 1)
    assert.equal(latestJob.status, 'queued')
    assert.equal(latestJob.syncMode, 'initial')

    cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, latestJob.id))
  } finally {
    global.fetch = originalFetch
    await cleanupFixture({ cleanup })
  }
})

test('oauth callback active reauthorization does not auto-create a new sync job', async () => {
  const label = uniqueKey('oauth-active')
  const cleanup = []
  const tenant = await createTenant(`${label}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const user = await createUser(`${label}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))
  const connection = await createConnection(tenant.id, user.id, label)
  cleanup.push(() => destroyEntity(STRAVA_CONNECTION_UID, connection.id))
  const activity = await createStravaActivity(tenant.id, user.id, connection.id, label)
  cleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activity.id))
  const historicalJob = await createSyncJob(tenant.id, user.id, connection.id)
  cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, historicalJob.id))
  const tokenCalls = installTokenExchangeMock()

  try {
    const beforeCount = await countJobsForConnection(connection.id)
    const { state } = await createOAuthState(tenant.id, user.id)
    const ctx = createCallbackContext(state)

    await controller.callback(ctx)

    assert.equal(ctx.status, 302)
    assert.equal(tokenCalls.length, 1)
    const afterCount = await countJobsForConnection(connection.id)
    assert.equal(Number(afterCount || 0), Number(beforeCount || 0))
  } finally {
    global.fetch = originalFetch
    await cleanupFixture({ cleanup })
  }
})

test('oauth callback reconnect with existing active job does not create duplicate job', async () => {
  const label = uniqueKey('oauth-existing-job')
  const cleanup = []
  const tenant = await createTenant(`${label}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const user = await createUser(`${label}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))
  const connection = await createConnection(tenant.id, user.id, label, {
    status: 'DISCONNECTED',
    cleanupStatus: 'COMPLETED',
    disconnectedAt: new Date(Date.now() - 120000).toISOString(),
    cleanupCompletedAt: new Date(Date.now() - 60000).toISOString(),
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    stravaAthleteId: null,
    athleteUsername: null,
    athleteFirstname: null,
    athleteLastname: null,
    profileUrl: null,
    rawAthlete: null,
    scope: null,
    activityDeleteMarkers: [{ stravaActivityId: 'old-activity', deletedEventTime: '123456', deletedAt: new Date().toISOString() }],
  })
  cleanup.push(() => destroyEntity(STRAVA_CONNECTION_UID, connection.id))
  const activeJob = await createSyncJob(tenant.id, user.id, connection.id, {
    status: 'queued',
    phase: 'preparing',
    completedAt: null,
    startedAt: null,
    claimedAt: null,
    claimedBy: null,
    metadata: { snapshotSummary: null },
  })
  cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, activeJob.id))
  const tokenCalls = installTokenExchangeMock()

  try {
    const beforeCount = await countJobsForConnection(connection.id)
    const { state } = await createOAuthState(tenant.id, user.id)
    const ctx = createCallbackContext(state)

    await controller.callback(ctx)

    assert.equal(ctx.status, 302)
    assert.equal(tokenCalls.length, 1)
    const afterCount = await countJobsForConnection(connection.id)
    assert.equal(Number(afterCount || 0), Number(beforeCount || 0))
  } finally {
    global.fetch = originalFetch
    await cleanupFixture({ cleanup })
  }
})

test('oauth callback state reuse creates at most one job and second callback is rejected', async () => {
  const label = uniqueKey('oauth-duplicate')
  const cleanup = []
  const tenant = await createTenant(`${label}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const user = await createUser(`${label}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))
  const tokenCalls = installTokenExchangeMock()

  try {
    const { state, recordId } = await createOAuthState(tenant.id, user.id)
    const firstCtx = createCallbackContext(state)
    const secondCtx = createCallbackContext(state)

    await controller.callback(firstCtx)
    await controller.callback(secondCtx)

    assert.equal(firstCtx.status, 302)
    assert.match(String(firstCtx.redirectedTo || ''), /connected=1/)
    assert.equal(secondCtx.status, 302)
    assert.match(String(secondCtx.redirectedTo || ''), /error=1/)
    assert.equal(tokenCalls.length, 1)

    const connection = await app.db.query(STRAVA_CONNECTION_UID).findOne({
      where: { tenant: tenant.id, user: user.id },
      select: ['id'],
    })
    const jobCount = await countJobsForConnection(connection.id)
    const stateRecord = await loadOAuthStateByRecordId(recordId)
    assert.equal(Number(jobCount || 0), 1)
    assert.ok(stateRecord?.usedAt)

    const latestJob = await loadLatestJob(connection.id)
    cleanup.push(() => destroyEntity(STRAVA_CONNECTION_UID, connection.id))
    cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, latestJob.id))
  } finally {
    global.fetch = originalFetch
    await cleanupFixture({ cleanup })
  }
})

test('oauth callback keeps connection active when auto-sync start fails and manual sync remains available', async () => {
  const label = uniqueKey('oauth-sync-fail')
  const cleanup = []
  const tenant = await createTenant(`${label}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const user = await createUser(`${label}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))
  const tokenCalls = installTokenExchangeMock()
  const originalStartCurrentUserStravaSync = service.startCurrentUserStravaSync

  service.startCurrentUserStravaSync = async () => {
    throw Object.assign(new Error('Injected sync start failure'), {
      code: 'STRAVA_SYNC_START_FAILED',
      status: 500,
    })
  }

  try {
    const { state } = await createOAuthState(tenant.id, user.id)
    const ctx = createCallbackContext(state)

    await controller.callback(ctx)

    assert.equal(ctx.status, 302)
    assert.match(String(ctx.redirectedTo || ''), /connected=1/)
    assert.equal(tokenCalls.length, 1)

    const connection = await app.db.query(STRAVA_CONNECTION_UID).findOne({
      where: { tenant: tenant.id, user: user.id },
      select: ['id', 'status', 'cleanupStatus'],
    })
    assert.ok(connection?.id)
    assert.equal(connection.status, 'ACTIVE')
    assert.equal(connection.cleanupStatus, 'NOT_REQUIRED')

    const jobCount = await countJobsForConnection(connection.id)
    assert.equal(Number(jobCount || 0), 0)

    service.startCurrentUserStravaSync = originalStartCurrentUserStravaSync
    const manualResult = await service.startCurrentUserStravaSync(tenant.id, user.id)
    assert.equal(manualResult.created, true)
    assert.equal(manualResult.job.syncMode, 'initial')

    cleanup.push(() => destroyEntity(STRAVA_CONNECTION_UID, connection.id))
    cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, manualResult.job.id))
  } finally {
    service.startCurrentUserStravaSync = originalStartCurrentUserStravaSync
    global.fetch = originalFetch
    await cleanupFixture({ cleanup })
  }
})