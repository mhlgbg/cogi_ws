const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let service
let webhookRunner
let authenticatedRoleId = 0
let originalFetch

const STRAVA_CONNECTION_UID = 'api::strava-connection.strava-connection'
const STRAVA_ACTIVITY_UID = 'api::strava-activity.strava-activity'
const STRAVA_SYNC_JOB_UID = 'api::strava-sync-job.strava-sync-job'
const STRAVA_WEBHOOK_EVENT_UID = 'api::strava-webhook-event.strava-webhook-event'
const CHALLENGE_UID = 'api::fitness-challenge.fitness-challenge'
const CHALLENGE_PARTICIPANT_UID = 'api::challenge-participant.challenge-participant'
const CHALLENGE_ACTIVITY_UID = 'api::challenge-activity.challenge-activity'
const STRAVA_REVOKE_URL = 'https://www.strava.com/oauth/revoke'

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'strava', 'services', 'strava.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath).default
}

function loadWebhookRunner() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'bootstrap', 'strava-webhook-runner.js')
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

async function createActiveConnection(tenantId, userId, label, overrides = {}) {
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
      scope: 'activity:read_all profile:read_all',
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
    select: ['id', 'stravaAthleteId', 'status', 'cleanupStatus'],
  })
}

async function createStravaActivity(tenantId, userId, connectionId, label, distance = 5000) {
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
      distance,
      movingTime: 1800,
      elapsedTime: 1900,
      totalElevationGain: 50,
      averageSpeed: 2.7,
      maxSpeed: 4.2,
      averageHeartrate: 150,
      maxHeartrate: 170,
      calories: 400,
      achievementCount: 1,
      kudosCount: 2,
      locationCountry: 'VN',
      locationCity: 'HCM',
      hasMap: true,
      mapSummaryPolyline: 'encoded-polyline',
      visibility: 'PRIVATE',
      syncStatus: 'SYNCED',
      rawActivity: {
        id: `${Date.now()}`,
        name: `Run ${label}`,
      },
    },
    select: ['id', 'stravaActivityId', 'name'],
  })
}

async function createSyncJob(tenantId, userId, connectionId, status = 'completed', phase = 'finalizing', metadata = {}) {
  return app.db.query(STRAVA_SYNC_JOB_UID).create({
    data: {
      tenant: tenantId,
      user: userId,
      connection: connectionId,
      status,
      phase,
      syncMode: 'initial',
      currentPage: 1,
      perPage: 100,
      processedActivities: 2,
      createdActivities: 2,
      updatedActivities: 0,
      skippedActivities: 0,
      failedActivities: 0,
      retryCount: 0,
      requestedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: status === 'completed' ? new Date().toISOString() : null,
      heartbeatAt: new Date().toISOString(),
      claimedAt: status === 'running' ? new Date().toISOString() : null,
      claimedBy: status === 'running' ? 'test-runner' : null,
      metadata: {
        recentProcessed: 2,
        pagesProcessed: 1,
        lastProcessedActivityId: 'activity-raw-id',
        snapshotSummary: {
          totalActivities: 2,
          totalDistance: 10000,
        },
        ...metadata,
      },
    },
    select: ['id', 'status', 'phase', 'metadata'],
  })
}

async function createWebhookEvent(tenantId, userId, connectionId, ownerId, objectId, aspectType = 'update', objectType = 'athlete', updates = { authorized: false }) {
  return app.db.query(STRAVA_WEBHOOK_EVENT_UID).create({
    data: {
      tenant: tenantId,
      user: userId,
      connection: connectionId,
      subscriptionId: 'sub-1',
      ownerId,
      objectType,
      objectId,
      aspectType,
      eventTime: `${Math.floor(Date.now() / 1000)}`,
      updates,
      rawPayload: {
        owner_id: ownerId,
        object_id: objectId,
        updates,
      },
      status: 'processed',
      attempts: 1,
      processedAt: new Date().toISOString(),
      idempotencyKey: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    select: ['id', 'ownerId', 'objectId'],
  })
}

async function createChallenge(tenantId, label) {
  return app.db.query(CHALLENGE_UID).create({
    data: {
      tenant: tenantId,
      code: `${label}-challenge`,
      title: `Challenge ${label}`,
      status: 'ACTIVE',
      metric: 'DISTANCE',
      leaderboardMode: 'TOTAL',
      activityAcceptMode: 'AUTO_ACCEPT',
      visibility: 'TENANT',
    },
    select: ['id', 'code'],
  })
}

async function createChallengeParticipant(tenantId, challengeId, userId) {
  return app.db.query(CHALLENGE_PARTICIPANT_UID).create({
    data: {
      tenant: tenantId,
      challenge: challengeId,
      user: userId,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
      displayName: 'Participant',
      totalDistance: 5000,
      totalMovingTime: 1800,
      totalElevationGain: 50,
      activityCount: 1,
      lastCalculatedAt: new Date().toISOString(),
    },
    select: ['id', 'totalDistance', 'totalMovingTime', 'totalElevationGain', 'activityCount'],
  })
}

async function createChallengeActivity(tenantId, challengeId, participantId, userId, activityId) {
  return app.db.query(CHALLENGE_ACTIVITY_UID).create({
    data: {
      tenant: tenantId,
      challenge: challengeId,
      participant: participantId,
      user: userId,
      activity: activityId,
      status: 'ACCEPTED',
      submittedBy: 'SYSTEM',
      submittedAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
      countedDistance: 5000,
      countedMovingTime: 1800,
      countedElevationGain: 50,
      countedActivityCount: 1,
    },
    select: ['id'],
  })
}

async function createFixture(label, options = {}) {
  const cleanup = []
  const tenant = await createTenant(`${label}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  const user = await createUser(`${label}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))

  const connection = await createActiveConnection(tenant.id, user.id, label, options.connectionOverrides || {})
  cleanup.push(() => destroyEntity(STRAVA_CONNECTION_UID, connection.id))

  const activityA = await createStravaActivity(tenant.id, user.id, connection.id, `${label}-a`, 5000)
  const activityB = await createStravaActivity(tenant.id, user.id, connection.id, `${label}-b`, 7000)
  cleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activityA.id))
  cleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activityB.id))

  const completedJob = await createSyncJob(tenant.id, user.id, connection.id, 'completed', 'finalizing')
  cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, completedJob.id))

  const queuedJob = await createSyncJob(tenant.id, user.id, connection.id, 'queued', 'preparing', { snapshotSummary: null })
  const runningJob = await createSyncJob(tenant.id, user.id, connection.id, 'running', 'syncing_recent', { snapshotSummary: null })
  const partialJob = await createSyncJob(tenant.id, user.id, connection.id, 'partial_ready', 'syncing_history', { snapshotSummary: null })
  cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, queuedJob.id))
  cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, runningJob.id))
  cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, partialJob.id))

  const webhookEvent = await createWebhookEvent(tenant.id, user.id, connection.id, connection.stravaAthleteId, activityA.stravaActivityId)
  cleanup.push(() => destroyEntity(STRAVA_WEBHOOK_EVENT_UID, webhookEvent.id))

  const challenge = await createChallenge(tenant.id, label)
  cleanup.push(() => destroyEntity(CHALLENGE_UID, challenge.id))

  const participant = await createChallengeParticipant(tenant.id, challenge.id, user.id)
  cleanup.push(() => destroyEntity(CHALLENGE_PARTICIPANT_UID, participant.id))

  const challengeActivity = await createChallengeActivity(tenant.id, challenge.id, participant.id, user.id, activityA.id)
  cleanup.push(() => destroyEntity(CHALLENGE_ACTIVITY_UID, challengeActivity.id))

  return {
    cleanup,
    tenant,
    user,
    connection,
    activityA,
    activityB,
    completedJob,
    queuedJob,
    runningJob,
    partialJob,
    webhookEvent,
    challenge,
    participant,
    challengeActivity,
  }
}

async function cleanupFixture(fixture) {
  for (const action of (fixture.cleanup || []).slice().reverse()) {
    await action()
  }
}

async function loadConnection(id) {
  return app.db.query(STRAVA_CONNECTION_UID).findOne({
    where: { id },
    select: ['id', 'status', 'stravaAthleteId', 'athleteUsername', 'athleteFirstname', 'athleteLastname', 'profileUrl', 'accessToken', 'refreshToken', 'tokenExpiresAt', 'scope', 'cleanupStatus', 'cleanupRequestedAt', 'cleanupCompletedAt', 'cleanupError', 'terminationReason', 'disconnectedAt'],
  })
}

async function loadJob(id) {
  return app.db.query(STRAVA_SYNC_JOB_UID).findOne({
    where: { id },
    select: ['id', 'status', 'phase', 'cancelledAt', 'lastErrorCode', 'metadata'],
  })
}

async function loadWebhookEvent(id) {
  return app.db.query(STRAVA_WEBHOOK_EVENT_UID).findOne({
    where: { id },
    select: ['id', 'status', 'ownerId', 'objectId', 'updates', 'rawPayload', 'processedAt'],
  })
}

async function loadLatestWebhookEventBySubscriptionId(subscriptionId) {
  const rows = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).findMany({
    where: { subscriptionId: String(subscriptionId) },
    orderBy: [{ id: 'desc' }],
    limit: 1,
    select: ['id', 'status', 'ownerId', 'objectId', 'updates', 'rawPayload', 'processedAt'],
  })
  return Array.isArray(rows) ? rows[0] || null : null
}

function installFetchMock(handler) {
  const calls = []
  global.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : String(input?.url || '')
    calls.push({ url, init })
    return handler(url, init, calls)
  }
  return calls
}

function countStravaCalls(calls) {
  return calls.filter((call) => call.url.startsWith('https://www.strava.com/'))
}

before(async () => {
  process.env.STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '12345'
  process.env.STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || 'secret-12345'
  process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'true'
  process.env.STRAVA_WEBHOOK_HANDLER_ENABLED = 'true'

  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  global.strapi = app
  authenticatedRoleId = Number((await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] }))?.id || 0)
  if (!authenticatedRoleId) throw new Error('Authenticated role not found for test setup')
  service = loadService()
  webhookRunner = loadWebhookRunner()
  originalFetch = global.fetch
})

after(async () => {
  global.fetch = originalFetch
  if (app) await app.destroy()
})

test('manual disconnect uses remote revoke then shared termination cleanup', async () => {
  const fixture = await createFixture(uniqueKey('disconnect-success'))
  const calls = installFetchMock(async (url) => {
    if (url === STRAVA_REVOKE_URL) return { status: 200 }
    return { status: 418 }
  })

  try {
    const result = await service.disconnectCurrentUser(fixture.tenant.id, fixture.user.id)
    assert.equal(result.success, true)

    const stravaCalls = countStravaCalls(calls)
    assert.equal(stravaCalls.length, 1)
    assert.equal(stravaCalls[0].url, STRAVA_REVOKE_URL)

    const connection = await loadConnection(fixture.connection.id)
    assert.equal(connection.status, 'DISCONNECTED')
    assert.equal(connection.cleanupStatus, 'COMPLETED')
    assert.equal(connection.cleanupError, null)
    assert.equal(connection.accessToken, null)
    assert.equal(connection.refreshToken, null)
    assert.equal(connection.stravaAthleteId, null)

    const queuedJob = await loadJob(fixture.queuedJob.id)
    const runningJob = await loadJob(fixture.runningJob.id)
    const partialJob = await loadJob(fixture.partialJob.id)
    assert.equal(queuedJob.status, 'cancelled')
    assert.equal(runningJob.status, 'cancelled')
    assert.equal(partialJob.status, 'cancelled')

    const status = await service.getCurrentUserStravaStatus(fixture.tenant.id, fixture.user.id)
    assert.equal(status.connected, false)
    assert.equal(status.status, 'DISCONNECTED')
    assert.equal(status.athleteFirstname, null)
    assert.equal(status.athleteLastname, null)
    assert.equal(status.profileUrl, null)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('manual disconnect succeeds when no usable local token remains and does not call remote revoke', async () => {
  const fixture = await createFixture(uniqueKey('disconnect-no-token'), {
    connectionOverrides: {
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    },
  })
  const calls = installFetchMock(async () => ({ status: 418 }))

  try {
    const result = await service.disconnectCurrentUser(fixture.tenant.id, fixture.user.id)
    assert.equal(result.success, true)
    assert.equal(countStravaCalls(calls).length, 0)

    const connection = await loadConnection(fixture.connection.id)
    assert.equal(connection.cleanupStatus, 'COMPLETED')
    assert.equal(connection.status, 'DISCONNECTED')
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('manual disconnect blocks local access and completes cleanup when remote revoke returns 503', async () => {
  const fixture = await createFixture(uniqueKey('disconnect-503'))
  const calls = installFetchMock(async (url) => {
    if (url === STRAVA_REVOKE_URL) return { status: 503 }
    return { status: 418 }
  })

  try {
    const result = await service.disconnectCurrentUser(fixture.tenant.id, fixture.user.id)
    assert.equal(result.success, true)
    assert.equal(countStravaCalls(calls).length, 1)

    const connection = await loadConnection(fixture.connection.id)
    assert.equal(connection.status, 'DISCONNECTED')
    assert.equal(connection.cleanupStatus, 'COMPLETED')
    assert.match(String(connection.cleanupError || ''), /Remote Strava revoke failed/i)

    const cleanedConnection = await app.db.query(STRAVA_CONNECTION_UID).findOne({
      where: { id: fixture.connection.id },
      select: ['id', 'status', 'accessToken', 'refreshToken', 'tokenExpiresAt', 'disconnectedAt'],
    })

    await assert.rejects(() => service.getValidAccessToken(cleanedConnection), /Strava connection/i)
    await assert.rejects(() => service.startCurrentUserStravaSync(fixture.tenant.id, fixture.user.id), /Strava connection|Bạn chưa kết nối/i)

    const webhookEvent = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).create({
      data: {
        tenant: fixture.tenant.id,
        user: fixture.user.id,
        subscriptionId: 'sub-2',
        ownerId: fixture.connection.stravaAthleteId,
        objectType: 'activity',
        objectId: 'remote-503-activity',
        aspectType: 'update',
        updates: null,
        rawPayload: null,
        eventTime: `${Math.floor(Date.now() / 1000)}`,
        status: 'processing',
        attempts: 0,
        idempotencyKey: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      select: ['id'],
    })

    try {
      const activityResult = await service.processActivityWebhookEvent({
        id: webhookEvent.id,
        ownerId: fixture.connection.stravaAthleteId,
        objectId: 'remote-503-activity',
        aspectType: 'update',
      })
      assert.equal(activityResult, 'IGNORED')
    } finally {
      await destroyEntity(STRAVA_WEBHOOK_EVENT_UID, webhookEvent.id)
    }

    assert.equal(countStravaCalls(calls).length, 1)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('manual disconnect is idempotent on second request and does not revoke twice', async () => {
  const fixture = await createFixture(uniqueKey('disconnect-twice'))
  const calls = installFetchMock(async (url) => {
    if (url === STRAVA_REVOKE_URL) return { status: 200 }
    return { status: 418 }
  })

  try {
    const first = await service.disconnectCurrentUser(fixture.tenant.id, fixture.user.id)
    const second = await service.disconnectCurrentUser(fixture.tenant.id, fixture.user.id)
    assert.equal(first.success, true)
    assert.equal(second.success, true)
    assert.equal(countStravaCalls(calls).length, 1)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('athlete deauthorization webhook uses shared termination service without remote revoke', async () => {
  const fixture = await createFixture(uniqueKey('athlete-webhook'))
  const calls = installFetchMock(async () => ({ status: 418 }))

  try {
    const received = await service.receiveStravaWebhookEvent({
      object_type: 'athlete',
      object_id: fixture.connection.stravaAthleteId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'update',
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: 999,
      updates: { authorized: false },
    })
    assert.equal(received.duplicate, false)

    await webhookRunner.runStravaWebhookRunnerTick(app)

    const stravaCalls = countStravaCalls(calls)
    assert.equal(stravaCalls.length, 0)

    const connection = await loadConnection(fixture.connection.id)
    assert.equal(connection.status, 'DISCONNECTED')
    assert.equal(connection.cleanupStatus, 'COMPLETED')
    assert.equal(connection.accessToken, null)
    assert.equal(connection.refreshToken, null)

    const queuedJob = await loadJob(fixture.queuedJob.id)
    const runningJob = await loadJob(fixture.runningJob.id)
    const partialJob = await loadJob(fixture.partialJob.id)
    assert.equal(queuedJob.status, 'cancelled')
    assert.equal(runningJob.status, 'cancelled')
    assert.equal(partialJob.status, 'cancelled')

    const event = await loadLatestWebhookEventBySubscriptionId('999')
    assert.equal(event.status, 'processed')
    assert.equal(event.ownerId, fixture.connection.stravaAthleteId)
    assert.equal(event.objectId, fixture.connection.stravaAthleteId)
    assert.equal(event.updates, null)
    assert.equal(event.rawPayload, null)
    assert.ok(event.processedAt)

    const duplicate = await service.receiveStravaWebhookEvent({
      object_type: 'athlete',
      object_id: fixture.connection.stravaAthleteId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'update',
      event_time: Math.floor(Date.now() / 1000) + 1,
      subscription_id: 999,
      updates: { authorized: false },
    })
    assert.equal(duplicate.duplicate, false)
    await webhookRunner.runStravaWebhookRunnerTick(app)

    const ignoredEvent = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).findOne({
      where: { eventTime: `${Math.floor(Date.now() / 1000) + 1}` },
      select: ['id', 'status'],
      orderBy: [{ id: 'desc' }],
    })
    assert.ok(ignoredEvent)
    assert.equal(['ignored', 'processed'].includes(String(ignoredEvent.status)), true)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})