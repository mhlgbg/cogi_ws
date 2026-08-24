const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let service
let authenticatedRoleId = 0

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
    select: ['id', 'username', 'email', 'fullName'],
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

async function createSyncJob(tenantId, userId, connectionId) {
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
      requestedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      metadata: {
        recentProcessed: 2,
        pagesProcessed: 1,
        lastProcessedActivityId: 'activity-raw-id',
        snapshotSummary: {
          totalActivities: 2,
          totalDistance: 10000,
        },
      },
    },
    select: ['id', 'status', 'metadata'],
  })
}

async function createWebhookEvent(tenantId, userId, connectionId, ownerId, objectId) {
  return app.db.query(STRAVA_WEBHOOK_EVENT_UID).create({
    data: {
      tenant: tenantId,
      user: userId,
      connection: connectionId,
      subscriptionId: 'sub-1',
      ownerId,
      objectType: 'athlete',
      objectId,
      aspectType: 'update',
      eventTime: `${Math.floor(Date.now() / 1000)}`,
      updates: { authorized: false },
      rawPayload: {
        owner_id: ownerId,
        object_id: objectId,
        updates: { authorized: false },
      },
      status: 'processed',
      attempts: 1,
      processedAt: new Date().toISOString(),
      idempotencyKey: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    select: ['id', 'ownerId', 'objectId'],
  })
}

async function createChallenge(tenantId, userId, label) {
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
    select: ['id', 'countedDistance'],
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
  cleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activityA.id))
  cleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activityB.id))

  const syncJob = await createSyncJob(tenant.id, user.id, connection.id)
  cleanup.push(() => destroyEntity(STRAVA_SYNC_JOB_UID, syncJob.id))

  const webhookEvent = await createWebhookEvent(tenant.id, user.id, connection.id, connection.stravaAthleteId, activityA.stravaActivityId)
  cleanup.push(() => destroyEntity(STRAVA_WEBHOOK_EVENT_UID, webhookEvent.id))

  const challenge = await createChallenge(tenant.id, user.id, label)
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
    syncJob,
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
    select: ['id', 'status', 'stravaAthleteId', 'athleteUsername', 'athleteFirstname', 'athleteLastname', 'profileUrl', 'accessToken', 'refreshToken', 'tokenExpiresAt', 'scope', 'cleanupStatus', 'cleanupRequestedAt', 'cleanupCompletedAt', 'cleanupError', 'terminationReason'],
  })
}

async function loadSyncJob(id) {
  return app.db.query(STRAVA_SYNC_JOB_UID).findOne({
    where: { id },
    select: ['id', 'metadata'],
  })
}

async function loadWebhookEvent(id) {
  return app.db.query(STRAVA_WEBHOOK_EVENT_UID).findOne({
    where: { id },
    select: ['id', 'ownerId', 'objectId', 'updates', 'rawPayload', 'status'],
  })
}

async function searchFixtureData(values) {
  const queries = [
    app.db.query(STRAVA_CONNECTION_UID).findMany({ select: ['id', 'stravaAthleteId', 'athleteUsername', 'athleteFirstname', 'athleteLastname', 'profileUrl', 'accessToken', 'refreshToken', 'scope', 'cleanupStatus'] }),
    app.db.query(STRAVA_SYNC_JOB_UID).findMany({ select: ['id', 'metadata'] }),
    app.db.query(STRAVA_WEBHOOK_EVENT_UID).findMany({ select: ['id', 'ownerId', 'objectId', 'updates', 'rawPayload'] }),
  ]
  const payload = JSON.stringify(await Promise.all(queries))
  for (const value of values.filter(Boolean)) {
    assert.equal(payload.includes(String(value)), false, `unexpected residual value found: ${value}`)
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

test('terminateStravaConnection removes shared Strava data and preserves audit shell', async () => {
  const fixture = await createFixture(uniqueKey('strava-termination'))
  try {
    const result = await service.terminateStravaConnection({
      connection: fixture.connection.id,
      terminationReason: 'user_deletion_request',
      source: 'test',
      skipRemoteRevoke: true,
    })

    assert.equal(result.cleanupStatus, 'COMPLETED')
    assert.equal(result.deletedActivities, 2)
    assert.equal(result.deletedChallengeActivities, 1)
    assert.equal(result.cleanedWebhookEvents, 1)
    assert.equal(result.scrubbedSyncJobs, 1)

    const connection = await loadConnection(fixture.connection.id)
    assert.equal(connection.status, 'DISCONNECTED')
    assert.equal(connection.cleanupStatus, 'COMPLETED')
    assert.equal(connection.terminationReason, 'user_deletion_request')
    assert.equal(connection.accessToken, null)
    assert.equal(connection.refreshToken, null)
    assert.equal(connection.tokenExpiresAt, null)
    assert.equal(connection.stravaAthleteId, null)
    assert.equal(connection.athleteUsername, null)
    assert.equal(connection.athleteFirstname, null)
    assert.equal(connection.athleteLastname, null)
    assert.equal(connection.profileUrl, null)
    assert.equal(connection.scope, null)
    assert.ok(connection.cleanupRequestedAt)
    assert.ok(connection.cleanupCompletedAt)

    const remainingActivities = await app.db.query(STRAVA_ACTIVITY_UID).count({ where: { connection: { id: fixture.connection.id } } })
    assert.equal(remainingActivities, 0)

    const remainingChallengeActivities = await app.db.query(CHALLENGE_ACTIVITY_UID).count({ where: { participant: { id: fixture.participant.id } } })
    assert.equal(remainingChallengeActivities, 0)

    const participant = await app.db.query(CHALLENGE_PARTICIPANT_UID).findOne({
      where: { id: fixture.participant.id },
      select: ['totalDistance', 'totalMovingTime', 'totalElevationGain', 'activityCount'],
    })
    assert.equal(Number(participant.totalDistance || 0), 0)
    assert.equal(Number(participant.totalMovingTime || 0), 0)
    assert.equal(Number(participant.totalElevationGain || 0), 0)
    assert.equal(Number(participant.activityCount || 0), 0)

    const syncJob = await loadSyncJob(fixture.syncJob.id)
    assert.equal(syncJob.metadata.lastProcessedActivityId, null)
    assert.equal(syncJob.metadata.snapshotSummary, null)

    const webhookEvent = await loadWebhookEvent(fixture.webhookEvent.id)
    assert.equal(webhookEvent.ownerId, fixture.connection.stravaAthleteId)
    assert.equal(webhookEvent.objectId, fixture.activityA.stravaActivityId)
    assert.equal(webhookEvent.updates, null)
    assert.equal(webhookEvent.rawPayload, null)

    await searchFixtureData([
      `access-${fixture.connection.id}`,
      `refresh-${fixture.connection.id}`,
      'encoded-polyline',
    ])
  } finally {
    await cleanupFixture(fixture)
  }
})

test('terminateStravaConnection is idempotent on second run', async () => {
  const fixture = await createFixture(uniqueKey('strava-idempotent'))
  try {
    const first = await service.terminateStravaConnection({
      connection: fixture.connection.id,
      terminationReason: 'manual_disconnect',
      source: 'test',
      skipRemoteRevoke: true,
    })
    const second = await service.terminateStravaConnection({
      connection: fixture.connection.id,
      terminationReason: 'manual_disconnect',
      source: 'test',
      skipRemoteRevoke: true,
    })

    assert.equal(first.cleanupStatus, 'COMPLETED')
    assert.equal(second.cleanupStatus, 'COMPLETED')
    assert.equal(second.alreadyCompleted, true)
    assert.equal(second.deletedActivities, 0)
    assert.equal(second.deletedChallengeActivities, 0)
    assert.equal(second.cleanedWebhookEvents, 0)
    assert.equal(second.scrubbedSyncJobs, 0)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('terminateStravaConnection can retry after partial cleanup failure', async () => {
  const fixture = await createFixture(uniqueKey('strava-retry'))
  const originalQuery = app.db.query.bind(app.db)
  let injected = false

  app.db.query = (uid) => {
    const repository = originalQuery(uid)
    if (uid !== STRAVA_WEBHOOK_EVENT_UID) return repository

    return new Proxy(repository, {
      get(target, property) {
        const value = target[property]
        if (property !== 'update' || typeof value !== 'function') return typeof value === 'function' ? value.bind(target) : value
        return async (...args) => {
          if (!injected) {
            injected = true
            throw new Error('Injected webhook cleanup failure')
          }
          return value.apply(target, args)
        }
      },
    })
  }

  try {
    await assert.rejects(() => service.terminateStravaConnection({
      connection: fixture.connection.id,
      terminationReason: 'athlete_deauthorized',
      source: 'test',
      skipRemoteRevoke: true,
    }), /Failed to terminate Strava connection/)
  } finally {
    app.db.query = originalQuery
  }

  try {
    const failedConnection = await loadConnection(fixture.connection.id)
    assert.equal(failedConnection.status, 'DISCONNECTED')
    assert.equal(failedConnection.cleanupStatus, 'FAILED')
    assert.equal(failedConnection.accessToken, null)
    assert.equal(failedConnection.refreshToken, null)

    const retried = await service.terminateStravaConnection({
      connection: fixture.connection.id,
      terminationReason: 'athlete_deauthorized',
      source: 'test',
      skipRemoteRevoke: true,
    })

    assert.equal(retried.cleanupStatus, 'COMPLETED')
    const connection = await loadConnection(fixture.connection.id)
    assert.equal(connection.cleanupStatus, 'COMPLETED')
    assert.equal(connection.cleanupError, null)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('termination guards block outbound Strava access after cleanup', async () => {
  const fixture = await createFixture(uniqueKey('strava-guard'))
  try {
    await service.terminateStravaConnection({
      connection: fixture.connection.id,
      terminationReason: 'user_deletion_request',
      source: 'test',
      skipRemoteRevoke: true,
    })

    await assert.rejects(() => service.startCurrentUserStravaSync(fixture.tenant.id, fixture.user.id), /Strava connection/i)

    const webhookEvent = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).create({
      data: {
        tenant: fixture.tenant.id,
        user: fixture.user.id,
        subscriptionId: 'sub-2',
        ownerId: fixture.connection.stravaAthleteId,
        objectType: 'activity',
        objectId: 'deleted-activity',
        aspectType: 'update',
        eventTime: `${Math.floor(Date.now() / 1000)}`,
        updates: null,
        rawPayload: null,
        status: 'processing',
        attempts: 0,
        idempotencyKey: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      select: ['id'],
    })

    try {
      const result = await service.processActivityWebhookEvent({
        id: webhookEvent.id,
        objectId: 'deleted-activity',
        ownerId: fixture.connection.stravaAthleteId,
        aspectType: 'update',
      })
      assert.equal(result, 'IGNORED')
    } finally {
      await destroyEntity(STRAVA_WEBHOOK_EVENT_UID, webhookEvent.id)
    }
  } finally {
    await cleanupFixture(fixture)
  }
})