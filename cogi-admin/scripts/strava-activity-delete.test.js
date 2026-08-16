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

async function createActiveConnection(tenantId, userId, label) {
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
    },
    select: ['id', 'stravaAthleteId', 'status'],
  })
}

async function createStravaActivity(tenantId, userId, connectionId, label, distance) {
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
      mapSummaryPolyline: `polyline-${label}`,
      visibility: 'PRIVATE',
      syncStatus: 'SYNCED',
      rawActivity: {
        id: `${Date.now()}`,
        name: `Run ${label}`,
        distance,
      },
    },
    select: ['id', 'stravaActivityId', 'name', 'distance'],
  })
}

async function createSyncJob(tenantId, userId, connectionId, metadata = {}) {
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
      processedActivities: 3,
      createdActivities: 3,
      updatedActivities: 0,
      skippedActivities: 0,
      failedActivities: 0,
      retryCount: 0,
      requestedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      metadata: {
        recentProcessed: 3,
        pagesProcessed: 1,
        lastProcessedActivityId: 'activity-raw-id',
        snapshotSummary: {
          totalActivities: 3,
          totalDistance: 21000,
        },
        ...metadata,
      },
    },
    select: ['id', 'metadata'],
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

async function createFixture(label) {
  const cleanup = []
  const tenant = await createTenant(`${label}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  const user = await createUser(`${label}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))

  const connection = await createActiveConnection(tenant.id, user.id, label)
  cleanup.push(() => destroyEntity(STRAVA_CONNECTION_UID, connection.id))

  const activityA = await createStravaActivity(tenant.id, user.id, connection.id, `${label}-a`, 5000)
  const activityB = await createStravaActivity(tenant.id, user.id, connection.id, `${label}-b`, 7000)
  const activityC = await createStravaActivity(tenant.id, user.id, connection.id, `${label}-c`, 9000)
  cleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activityA.id))
  cleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activityB.id))
  cleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activityC.id))

  const syncJob = await createSyncJob(tenant.id, user.id, connection.id)
  cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, syncJob.id))

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
    activityC,
    syncJob,
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

function installFetchMock() {
  const calls = []
  global.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : String(input?.url || '')
    calls.push({ url, init })
    throw new Error(`Unexpected outbound fetch during activity.delete: ${url}`)
  }
  return calls
}

function countStravaCalls(calls) {
  return calls.filter((call) => call.url.startsWith('https://www.strava.com/'))
}

async function loadWebhookEvent(id) {
  return app.db.query(STRAVA_WEBHOOK_EVENT_UID).findOne({
    where: { id },
    select: ['id', 'status', 'ownerId', 'objectId', 'updates', 'rawPayload', 'processedAt'],
  })
}

before(async () => {
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

test('activity.delete hard-deletes activity, recalculates challenge aggregates, scrubs event, and makes no outbound Strava calls', async () => {
  const fixture = await createFixture(uniqueKey('activity-delete'))
  const calls = installFetchMock()

  try {
    const received = await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityA.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: 1001,
      updates: null,
    })
    assert.equal(received.duplicate, false)

    await webhookRunner.runStravaWebhookRunnerTick(app)

    assert.equal(countStravaCalls(calls).length, 0)

    const connection = await app.db.query(STRAVA_CONNECTION_UID).findOne({
      where: { id: fixture.connection.id },
      select: ['id', 'status', 'accessToken', 'refreshToken', 'stravaAthleteId', 'cleanupStatus'],
    })
    assert.equal(connection.status, 'ACTIVE')
    assert.ok(connection.accessToken)
    assert.ok(connection.refreshToken)
    assert.ok(connection.stravaAthleteId)
    assert.equal(connection.cleanupStatus, 'NOT_REQUIRED')

    const deletedActivity = await app.db.query(STRAVA_ACTIVITY_UID).findOne({
      where: { id: fixture.activityA.id },
      select: ['id'],
    })
    assert.equal(deletedActivity, null)

    const keptB = await app.db.query(STRAVA_ACTIVITY_UID).findOne({ where: { id: fixture.activityB.id }, select: ['id', 'stravaActivityId'] })
    const keptC = await app.db.query(STRAVA_ACTIVITY_UID).findOne({ where: { id: fixture.activityC.id }, select: ['id', 'stravaActivityId'] })
    assert.ok(keptB?.id)
    assert.ok(keptC?.id)

    const remainingChallengeActivity = await app.db.query(CHALLENGE_ACTIVITY_UID).findOne({ where: { id: fixture.challengeActivity.id }, select: ['id'] })
    assert.equal(remainingChallengeActivity, null)

    const syncJob = await app.db.query(STRAVA_SYNC_JOB_UID).findOne({
      where: { id: fixture.syncJob.id },
      select: ['id', 'metadata'],
    })
    assert.equal(syncJob.metadata.lastProcessedActivityId, 'activity-raw-id')
    assert.equal(syncJob.metadata.snapshotSummary, null)

    const participant = await app.db.query(CHALLENGE_PARTICIPANT_UID).findOne({
      where: { id: fixture.participant.id },
      select: ['totalDistance', 'totalMovingTime', 'totalElevationGain', 'activityCount'],
    })
    assert.equal(Number(participant.totalDistance || 0), 0)
    assert.equal(Number(participant.totalMovingTime || 0), 0)
    assert.equal(Number(participant.totalElevationGain || 0), 0)
    assert.equal(Number(participant.activityCount || 0), 0)

    const list = await service.listCurrentUserActivities(fixture.tenant.id, fixture.user.id, { page: 1, pageSize: 10 })
    assert.equal(list.pagination.total, 2)
    assert.equal(list.items.some((item) => item.stravaActivityId === fixture.activityA.stravaActivityId), false)
    assert.equal(list.items.some((item) => item.stravaActivityId === fixture.activityB.stravaActivityId), true)
    assert.equal(list.items.some((item) => item.stravaActivityId === fixture.activityC.stravaActivityId), true)

    const summary = await service.getCurrentUserActivitySummary(fixture.tenant.id, fixture.user.id)
    assert.equal(summary.totalActivities, 2)
    assert.equal(Number(summary.totalDistance || 0), 16000)

    const overview = await service.getCurrentUserAnalyticsOverview(fixture.tenant.id, fixture.user.id)
    assert.equal(overview.allTime.totalActivities, 2)
    assert.equal(Number(overview.allTime.totalDistance || 0), 16000)

    const trends = await service.getCurrentUserAnalyticsTrends(fixture.tenant.id, fixture.user.id, { range: '12m', metric: 'distance', groupBy: 'month' })
    const trendTotal = (trends.items || []).reduce((sum, item) => sum + Number(item.value || 0), 0)
    assert.equal(trendTotal, 16000)

    const event = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).findOne({
      where: { subscriptionId: '1001' },
      select: ['id', 'status', 'ownerId', 'objectId', 'updates', 'rawPayload', 'processedAt'],
    })
    assert.equal(event.status, 'processed')
    assert.equal(event.ownerId, null)
    assert.equal(event.objectId, null)
    assert.equal(event.updates, null)
    assert.equal(event.rawPayload, null)
    assert.ok(event.processedAt)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('activity.delete on missing activity is terminal success with no outbound calls', async () => {
  const fixture = await createFixture(uniqueKey('activity-missing'))
  const calls = installFetchMock()

  try {
    const received = await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: 'missing-activity-id',
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: 1002,
      updates: null,
    })
    assert.equal(received.duplicate, false)

    await webhookRunner.runStravaWebhookRunnerTick(app)

    assert.equal(countStravaCalls(calls).length, 0)
    const event = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).findOne({
      where: { subscriptionId: '1002' },
      select: ['id', 'status', 'ownerId', 'objectId', 'updates', 'rawPayload', 'processedAt'],
    })
    assert.equal(event.status, 'processed')
    assert.equal(event.ownerId, null)
    assert.equal(event.objectId, null)
    assert.equal(event.updates, null)
    assert.equal(event.rawPayload, null)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('duplicate activity.delete remains terminal success without resurrecting data', async () => {
  const fixture = await createFixture(uniqueKey('activity-duplicate'))
  const calls = installFetchMock()

  try {
    const firstTime = Math.floor(Date.now() / 1000)
    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityA.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: firstTime,
      subscription_id: 1003,
      updates: null,
    })
    await webhookRunner.runStravaWebhookRunnerTick(app)

    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityA.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: firstTime + 1,
      subscription_id: 1003,
      updates: null,
    })
    await webhookRunner.runStravaWebhookRunnerTick(app)

    assert.equal(countStravaCalls(calls).length, 0)
    const stillMissing = await app.db.query(STRAVA_ACTIVITY_UID).findOne({ where: { id: fixture.activityA.id }, select: ['id'] })
    assert.equal(stillMissing, null)

    const remainingList = await service.listCurrentUserActivities(fixture.tenant.id, fixture.user.id, { page: 1, pageSize: 10 })
    assert.equal(remainingList.pagination.total, 2)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('activity.delete after connection termination is safe no-op with no outbound calls', async () => {
  const fixture = await createFixture(uniqueKey('activity-after-termination'))
  global.fetch = async () => ({ status: 200 })

  try {
    await service.disconnectCurrentUser(fixture.tenant.id, fixture.user.id)
  } finally {
    global.fetch = originalFetch
  }

  const calls = installFetchMock()

  try {
    const received = await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityA.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: 1004,
      updates: null,
    })
    assert.equal(received.duplicate, false)

    await webhookRunner.runStravaWebhookRunnerTick(app)

    assert.equal(countStravaCalls(calls).length, 0)
    const connection = await app.db.query(STRAVA_CONNECTION_UID).findOne({ where: { id: fixture.connection.id }, select: ['cleanupStatus', 'status'] })
    assert.equal(connection.status, 'DISCONNECTED')
    assert.equal(connection.cleanupStatus, 'COMPLETED')

    const event = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).findOne({
      where: { subscriptionId: '1004' },
      select: ['id', 'status'],
    })
    assert.equal(['ignored', 'processed'].includes(String(event.status)), true)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})