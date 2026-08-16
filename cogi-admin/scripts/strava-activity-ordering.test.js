const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let service
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

async function createSyncJob(tenantId, userId, connectionId, lastProcessedActivityId) {
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
        lastProcessedActivityId,
        snapshotSummary: {
          totalActivities: 3,
          totalDistance: 21000,
        },
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
    select: ['id'],
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
    select: ['id'],
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

  const syncJob = await createSyncJob(tenant.id, user.id, connection.id, activityA.stravaActivityId)
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

async function destroyWebhookEventsBySubscriptionId(subscriptionId) {
  if (!subscriptionId) return
  const rows = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).findMany({
    where: { subscriptionId: String(subscriptionId) },
    select: ['id'],
  })
  for (const row of rows || []) {
    await destroyEntity(STRAVA_WEBHOOK_EVENT_UID, row.id)
  }
}

async function getLatestWebhookEventBySubscriptionId(subscriptionId) {
  const rows = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).findMany({
    where: { subscriptionId: String(subscriptionId) },
    select: ['id', 'ownerId', 'objectId', 'aspectType', 'eventTime'],
    orderBy: [{ id: 'desc' }],
    limit: 1,
  })
  return Array.isArray(rows) ? rows[0] || null : null
}

async function processLatestActivityEvent(subscriptionId) {
  const event = await getLatestWebhookEventBySubscriptionId(subscriptionId)
  if (!event?.id) throw new Error(`Webhook event not found for subscription ${String(subscriptionId)}`)
  const result = await service.processActivityWebhookEvent({
    id: event.id,
    ownerId: event.ownerId,
    objectId: event.objectId,
    aspectType: event.aspectType,
    eventTime: event.eventTime,
  })

  await app.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
    where: { id: event.id },
    data: {
      status: result === 'IGNORED' ? 'ignored' : 'processed',
      processedAt: new Date().toISOString(),
    },
  })

  return result
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
  process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'false'
  process.env.STRAVA_WEBHOOK_HANDLER_ENABLED = 'true'

  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  global.strapi = app
  authenticatedRoleId = Number((await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] }))?.id || 0)
  if (!authenticatedRoleId) throw new Error('Authenticated role not found for test setup')
  service = loadService()
  originalFetch = global.fetch
  process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'true'
})

after(async () => {
  global.fetch = originalFetch
  if (app) await app.destroy()
})

test('activity.delete invalidates snapshotSummary and clears matching lastProcessedActivityId', async () => {
  const fixture = await createFixture(uniqueKey('snapshot-invalidation'))
  const subscriptionId = 2001
  const calls = installFetchMock(async (url) => {
    throw new Error(`Unexpected outbound fetch: ${url}`)
  })

  try {
    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityA.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: 200,
      subscription_id: subscriptionId,
      updates: null,
    })
    await processLatestActivityEvent(subscriptionId)

    const syncJob = await app.db.query(STRAVA_SYNC_JOB_UID).findOne({
      where: { id: fixture.syncJob.id },
      select: ['id', 'metadata'],
    })
    assert.equal(syncJob.metadata.snapshotSummary, null)
    assert.equal(syncJob.metadata.lastProcessedActivityId, null)
    assert.equal(countStravaCalls(calls).length, 0)
  } finally {
    global.fetch = originalFetch
    await destroyWebhookEventsBySubscriptionId(subscriptionId)
    await cleanupFixture(fixture)
  }
})

test('stale update after confirmed delete is ignored before outbound fetch and activity is not recreated', async () => {
  const fixture = await createFixture(uniqueKey('stale-update'))
  const subscriptionId = 2002
  const calls = installFetchMock(async (url) => {
    throw new Error(`Unexpected outbound fetch: ${url}`)
  })

  try {
    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityA.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: 200,
      subscription_id: subscriptionId,
      updates: null,
    })
    await processLatestActivityEvent(subscriptionId)

    calls.length = 0

    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityA.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'update',
      event_time: 150,
      subscription_id: subscriptionId,
      updates: { title: 'Old update' },
    })
    await processLatestActivityEvent(subscriptionId)

    const activity = await app.db.query(STRAVA_ACTIVITY_UID).findOne({ where: { stravaActivityId: fixture.activityA.stravaActivityId }, select: ['id'] })
    assert.equal(activity, null)
    assert.equal(countStravaCalls(calls).length, 0)
  } finally {
    global.fetch = originalFetch
    await destroyWebhookEventsBySubscriptionId(subscriptionId)
    await cleanupFixture(fixture)
  }
})

test('stale create after confirmed delete is ignored before outbound fetch and activity is not recreated', async () => {
  const fixture = await createFixture(uniqueKey('stale-create'))
  const subscriptionId = 2003
  const calls = installFetchMock(async (url) => {
    throw new Error(`Unexpected outbound fetch: ${url}`)
  })

  try {
    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityA.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: 200,
      subscription_id: subscriptionId,
      updates: null,
    })
    await processLatestActivityEvent(subscriptionId)

    calls.length = 0

    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityA.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'create',
      event_time: 100,
      subscription_id: subscriptionId,
      updates: null,
    })
    await processLatestActivityEvent(subscriptionId)

    const activity = await app.db.query(STRAVA_ACTIVITY_UID).findOne({ where: { stravaActivityId: fixture.activityA.stravaActivityId }, select: ['id'] })
    assert.equal(activity, null)
    assert.equal(countStravaCalls(calls).length, 0)
  } finally {
    global.fetch = originalFetch
    await destroyWebhookEventsBySubscriptionId(subscriptionId)
    await cleanupFixture(fixture)
  }
})

test('different activity update is not blocked by delete marker of another activity', async () => {
  const fixture = await createFixture(uniqueKey('different-activity'))
  const subscriptionId = 2004
  const calls = installFetchMock(async (url) => {
    if (url.includes(`/api/v3/activities/${fixture.activityB.stravaActivityId}`)) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
        text: async () => '',
      }
    }
    throw new Error(`Unexpected outbound fetch: ${url}`)
  })

  try {
    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityA.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: 200,
      subscription_id: subscriptionId,
      updates: null,
    })
    await processLatestActivityEvent(subscriptionId)

    calls.length = 0

    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activityB.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'update',
      event_time: 250,
      subscription_id: subscriptionId,
      updates: { title: 'B update' },
    })
    await processLatestActivityEvent(subscriptionId)

    const stravaCalls = countStravaCalls(calls)
    assert.equal(stravaCalls.length, 1)
    assert.ok(stravaCalls[0].url.includes(`/api/v3/activities/${fixture.activityB.stravaActivityId}`))
  } finally {
    global.fetch = originalFetch
    await destroyWebhookEventsBySubscriptionId(subscriptionId)
    await cleanupFixture(fixture)
  }
})