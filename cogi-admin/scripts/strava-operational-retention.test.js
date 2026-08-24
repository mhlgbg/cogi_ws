const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let service
let webhookRunner
let authenticatedRoleId = 0
let originalFetch
let originalRetentionHours

const STRAVA_CONNECTION_UID = 'api::strava-connection.strava-connection'
const STRAVA_ACTIVITY_UID = 'api::strava-activity.strava-activity'
const STRAVA_WEBHOOK_EVENT_UID = 'api::strava-webhook-event.strava-webhook-event'
const STRAVA_OAUTH_STATE_UID = 'api::strava-oauth-state.strava-oauth-state'

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

async function createStravaActivity(tenantId, userId, connectionId, label, overrides = {}) {
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
        distance: 5000,
      },
      ...overrides,
    },
    select: ['id', 'stravaActivityId', 'name', 'distance', 'movingTime', 'rawActivity'],
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

  const activity = await createStravaActivity(tenant.id, user.id, connection.id, label)
  cleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activity.id))

  return { cleanup, tenant, user, connection, activity }
}

async function cleanupFixture(fixture) {
  for (const action of (fixture.cleanup || []).slice().reverse()) {
    await action()
  }
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

function buildActivityPayload(activityId, overrides = {}) {
  return {
    id: activityId,
    name: 'Webhook Synced Run',
    type: 'Run',
    sport_type: 'Run',
    start_date: '2026-08-16T01:00:00.000Z',
    start_date_local: '2026-08-16T08:00:00.000Z',
    timezone: '(GMT+07:00) Asia/Ho_Chi_Minh',
    distance: 12345,
    moving_time: 4321,
    elapsed_time: 4400,
    total_elevation_gain: 120,
    average_speed: 3.2,
    max_speed: 5.5,
    average_heartrate: 151,
    max_heartrate: 173,
    calories: 512,
    achievement_count: 3,
    kudos_count: 9,
    location_country: 'VN',
    location_city: 'Ho Chi Minh',
    map: { summary_polyline: 'encoded-polyline' },
    visibility: 'private',
    ...overrides,
  }
}

function installActivityDetailFetchMock(activityId, payload, options = {}) {
  return installFetchMock(async (url) => {
    if (!url.includes(`/api/v3/activities/${activityId}`)) {
      throw new Error(`Unexpected outbound fetch: ${url}`)
    }
    if (options.failStatus) {
      return {
        ok: false,
        status: options.failStatus,
        headers: { get: () => null },
        text: async () => '',
      }
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      async json() {
        return payload
      },
    }
  })
}

async function getWebhookEventBySubscriptionId(subscriptionId) {
  const rows = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).findMany({
    where: { subscriptionId: String(subscriptionId) },
    orderBy: [{ id: 'desc' }],
    limit: 1,
    select: ['id', 'status', 'ownerId', 'objectId', 'updates', 'rawPayload', 'processedAt', 'nextAttemptAt', 'attempts', 'lastError'],
  })
  return Array.isArray(rows) ? rows[0] || null : null
}

async function loadActivityByStravaId(stravaActivityId) {
  return app.db.query(STRAVA_ACTIVITY_UID).findOne({
    where: { stravaActivityId },
    select: ['id', 'stravaActivityId', 'name', 'distance', 'movingTime', 'rawActivity'],
  })
}

async function createOAuthStateRow(data) {
  return app.db.query(STRAVA_OAUTH_STATE_UID).create({
    data,
    select: ['id', 'stateHash', 'expiresAt', 'usedAt'],
  })
}

async function loadOAuthState(id) {
  return app.db.query(STRAVA_OAUTH_STATE_UID).findOne({
    where: { id },
    select: ['id', 'expiresAt', 'usedAt'],
  })
}

before(async () => {
  process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'true'
  process.env.STRAVA_WEBHOOK_HANDLER_ENABLED = 'true'
  originalRetentionHours = process.env.STRAVA_OAUTH_STATE_RETENTION_HOURS

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
  if (typeof originalRetentionHours === 'undefined') delete process.env.STRAVA_OAUTH_STATE_RETENTION_HOURS
  else process.env.STRAVA_OAUTH_STATE_RETENTION_HOURS = originalRetentionHours
  if (app) await app.destroy()
})

test('activity.create keeps StravaActivity intact and scrubs terminal webhook payload', async () => {
  const fixture = await createFixture(uniqueKey('patch5-create'))
  const extraCleanup = []
  const stravaActivityId = 'patch5-create-activity'
  const subscriptionId = 5101
  const calls = installActivityDetailFetchMock(stravaActivityId, buildActivityPayload(stravaActivityId, { name: 'Created by webhook', distance: 25000 }))

  try {
    const received = await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'create',
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: subscriptionId,
      updates: { title: 'Created by webhook' },
    })
    assert.equal(received.duplicate, false)

    await webhookRunner.runStravaWebhookRunnerTick(app)

    assert.equal(calls.length, 1)
    const activity = await loadActivityByStravaId(stravaActivityId)
    assert.ok(activity?.id)
    assert.equal(activity.name, 'Created by webhook')
    assert.equal(Number(activity.distance || 0), 25000)
    assert.equal(Number(activity.movingTime || 0), 4321)
    assert.equal(activity.rawActivity.name, 'Created by webhook')
    extraCleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activity.id))

    const event = await getWebhookEventBySubscriptionId(subscriptionId)
    assert.equal(event.status, 'processed')
    assert.equal(event.ownerId, fixture.connection.stravaAthleteId)
    assert.equal(event.objectId, stravaActivityId)
    assert.equal(event.updates, null)
    assert.equal(event.rawPayload, null)
    assert.ok(event.processedAt)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture({ cleanup: [...extraCleanup, ...fixture.cleanup] })
  }
})

test('activity.update updates StravaActivity and scrubs terminal webhook payload', async () => {
  const fixture = await createFixture(uniqueKey('patch5-update'))
  const subscriptionId = 5102
  const stravaActivityId = fixture.activity.stravaActivityId
  const calls = installActivityDetailFetchMock(stravaActivityId, buildActivityPayload(stravaActivityId, { name: 'Updated by webhook', distance: 32100, moving_time: 5432 }))

  try {
    const received = await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'update',
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: subscriptionId,
      updates: { title: 'Updated by webhook' },
    })
    assert.equal(received.duplicate, false)

    await webhookRunner.runStravaWebhookRunnerTick(app)

    assert.equal(calls.length, 1)
    const activity = await loadActivityByStravaId(stravaActivityId)
    assert.ok(activity?.id)
    assert.equal(activity.name, 'Updated by webhook')
    assert.equal(Number(activity.distance || 0), 32100)
    assert.equal(Number(activity.movingTime || 0), 5432)

    const event = await getWebhookEventBySubscriptionId(subscriptionId)
    assert.equal(event.status, 'processed')
    assert.equal(event.updates, null)
    assert.equal(event.rawPayload, null)
    assert.equal(event.ownerId, fixture.connection.stravaAthleteId)
    assert.equal(event.objectId, stravaActivityId)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('activity.delete keeps delete semantics and retains minimal correlation metadata', async () => {
  const fixture = await createFixture(uniqueKey('patch5-delete'))
  const subscriptionId = 5103
  const calls = installFetchMock(async (url) => {
    throw new Error(`Unexpected outbound fetch during activity.delete: ${url}`)
  })

  try {
    const received = await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activity.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: subscriptionId,
      updates: null,
    })
    assert.equal(received.duplicate, false)

    await webhookRunner.runStravaWebhookRunnerTick(app)

    const activity = await loadActivityByStravaId(fixture.activity.stravaActivityId)
    assert.equal(activity, null)
    assert.equal(calls.length, 0)

    const event = await getWebhookEventBySubscriptionId(subscriptionId)
    assert.equal(event.status, 'processed')
    assert.equal(event.ownerId, fixture.connection.stravaAthleteId)
    assert.equal(event.objectId, fixture.activity.stravaActivityId)
    assert.equal(event.rawPayload, null)
    assert.equal(event.updates, null)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('retryable failure retains payload until retry succeeds, then scrubs terminal payload', async () => {
  const fixture = await createFixture(uniqueKey('patch5-retry'))
  const extraCleanup = []
  const subscriptionId = 5104
  const stravaActivityId = 'patch5-retry-activity'
  installActivityDetailFetchMock(stravaActivityId, buildActivityPayload(stravaActivityId), { failStatus: 503 })

  try {
    const received = await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'create',
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: subscriptionId,
      updates: { phase: 'first-try' },
    })
    assert.equal(received.duplicate, false)

    await webhookRunner.runStravaWebhookRunnerTick(app)

    const failedEvent = await getWebhookEventBySubscriptionId(subscriptionId)
    assert.equal(failedEvent.status, 'failed')
    assert.ok(failedEvent.rawPayload)
    assert.ok(failedEvent.updates)
    assert.ok(failedEvent.nextAttemptAt)
    assert.equal(Number(failedEvent.attempts || 0), 1)

    await app.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
      where: { id: failedEvent.id },
      data: { nextAttemptAt: new Date(Date.now() - 1000).toISOString() },
    })

    installActivityDetailFetchMock(stravaActivityId, buildActivityPayload(stravaActivityId, { name: 'Retried success', distance: 8888 }))
    await webhookRunner.runStravaWebhookRunnerTick(app)

    const activity = await loadActivityByStravaId(stravaActivityId)
    assert.ok(activity?.id)
    assert.equal(activity.name, 'Retried success')
    extraCleanup.push(() => destroyEntity(STRAVA_ACTIVITY_UID, activity.id))

    const processedEvent = await getWebhookEventBySubscriptionId(subscriptionId)
    assert.equal(processedEvent.status, 'processed')
    assert.equal(processedEvent.rawPayload, null)
    assert.equal(processedEvent.updates, null)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture({ cleanup: [...extraCleanup, ...fixture.cleanup] })
  }
})

test('terminal ignored event scrubs payload but keeps minimal correlation metadata and ignore reason', async () => {
  const fixture = await createFixture(uniqueKey('patch5-ignored'))
  const subscriptionId = 5105

  try {
    const received = await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: 'missing-correlation-activity',
      owner_id: 'unknown-athlete',
      aspect_type: 'update',
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: subscriptionId,
      updates: { title: 'Ignored' },
    })
    assert.equal(received.duplicate, false)

    await webhookRunner.runStravaWebhookRunnerTick(app)

    const event = await getWebhookEventBySubscriptionId(subscriptionId)
    assert.equal(event.status, 'ignored')
    assert.equal(event.rawPayload, null)
    assert.equal(event.updates, null)
    assert.equal(event.ownerId, 'unknown-athlete')
    assert.equal(event.objectId, 'missing-correlation-activity')
    assert.equal(event.lastError, 'CONNECTION_NOT_FOUND')
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('athlete deauthorization keeps termination behavior and scrubs payload after terminal processing', async () => {
  const fixture = await createFixture(uniqueKey('patch5-athlete'))
  const subscriptionId = 5106
  const calls = installFetchMock(async () => ({ status: 418 }))

  try {
    const received = await service.receiveStravaWebhookEvent({
      object_type: 'athlete',
      object_id: fixture.connection.stravaAthleteId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'update',
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: subscriptionId,
      updates: { authorized: false },
    })
    assert.equal(received.duplicate, false)

    await webhookRunner.runStravaWebhookRunnerTick(app)

    assert.equal(calls.length, 0)
    const connection = await app.db.query(STRAVA_CONNECTION_UID).findOne({
      where: { id: fixture.connection.id },
      select: ['status', 'cleanupStatus', 'accessToken', 'refreshToken'],
    })
    assert.equal(connection.status, 'DISCONNECTED')
    assert.equal(connection.cleanupStatus, 'COMPLETED')
    assert.equal(connection.accessToken, null)
    assert.equal(connection.refreshToken, null)

    const event = await getWebhookEventBySubscriptionId(subscriptionId)
    assert.equal(event.status, 'processed')
    assert.equal(event.rawPayload, null)
    assert.equal(event.updates, null)
    assert.equal(event.ownerId, fixture.connection.stravaAthleteId)
    assert.equal(event.objectId, fixture.connection.stravaAthleteId)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('terminal webhook scrub helper is idempotent', async () => {
  const fixture = await createFixture(uniqueKey('patch5-idempotent'))

  try {
    const event = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).create({
      data: {
        tenant: fixture.tenant.id,
        user: fixture.user.id,
        connection: fixture.connection.id,
        subscriptionId: '5107',
        ownerId: fixture.connection.stravaAthleteId,
        objectType: 'activity',
        objectId: fixture.activity.stravaActivityId,
        aspectType: 'update',
        eventTime: `${Math.floor(Date.now() / 1000)}`,
        updates: { title: 'idempotent' },
        rawPayload: { test: true },
        status: 'processed',
        attempts: 0,
        processedAt: new Date().toISOString(),
        idempotencyKey: `idempotent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      select: ['id'],
    })

    await service.scrubWebhookEventPayload(event.id)
    await service.scrubWebhookEventPayload(event.id)

    const scrubbed = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).findOne({
      where: { id: event.id },
      select: ['status', 'ownerId', 'objectId', 'rawPayload', 'updates', 'processedAt'],
    })
    assert.equal(scrubbed.status, 'processed')
    assert.equal(scrubbed.ownerId, fixture.connection.stravaAthleteId)
    assert.equal(scrubbed.objectId, fixture.activity.stravaActivityId)
    assert.equal(scrubbed.rawPayload, null)
    assert.equal(scrubbed.updates, null)
    assert.ok(scrubbed.processedAt)

    await destroyEntity(STRAVA_WEBHOOK_EVENT_UID, event.id)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('ordering guard still blocks stale recreate after delete while terminal payload is scrubbed', async () => {
  const fixture = await createFixture(uniqueKey('patch5-ordering'))
  const deleteSubscriptionId = 5108
  const staleSubscriptionId = 5109
  const calls = installFetchMock(async (url) => {
    throw new Error(`Unexpected outbound fetch during ordering test: ${url}`)
  })

  try {
    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activity.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'delete',
      event_time: 200,
      subscription_id: deleteSubscriptionId,
      updates: null,
    })
    await webhookRunner.runStravaWebhookRunnerTick(app)

    const deleteEvent = await getWebhookEventBySubscriptionId(deleteSubscriptionId)
    assert.equal(deleteEvent.status, 'processed')
    assert.equal(deleteEvent.rawPayload, null)
    assert.equal(deleteEvent.updates, null)

    calls.length = 0
    await service.receiveStravaWebhookEvent({
      object_type: 'activity',
      object_id: fixture.activity.stravaActivityId,
      owner_id: fixture.connection.stravaAthleteId,
      aspect_type: 'update',
      event_time: 150,
      subscription_id: staleSubscriptionId,
      updates: { stale: true },
    })
    await webhookRunner.runStravaWebhookRunnerTick(app)

    const activity = await loadActivityByStravaId(fixture.activity.stravaActivityId)
    assert.equal(activity, null)
    assert.equal(calls.length, 0)

    const staleEvent = await getWebhookEventBySubscriptionId(staleSubscriptionId)
    assert.equal(staleEvent.status, 'processed')
    assert.equal(staleEvent.rawPayload, null)
    assert.equal(staleEvent.updates, null)
  } finally {
    global.fetch = originalFetch
    await cleanupFixture(fixture)
  }
})

test('lazy OAuth state cleanup removes stale used and expired rows while keeping active unused state', async () => {
  const label = uniqueKey('patch5-oauth')
  const cleanup = []
  const tenant = await createTenant(`${label}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const user = await createUser(`${label}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))

  process.env.STRAVA_OAUTH_STATE_RETENTION_HOURS = '24'
  const now = Date.now()
  const oldUsed = await createOAuthStateRow({
    tenant: tenant.id,
    user: user.id,
    nonce: `${label}-used`,
    frontendOrigin: 'http://localhost:3000',
    stateHash: `${label}-used-hash`,
    expiresAt: new Date(now - (72 * 60 * 60 * 1000)).toISOString(),
    usedAt: new Date(now - (48 * 60 * 60 * 1000)).toISOString(),
  })
  cleanup.push(() => destroyEntity(STRAVA_OAUTH_STATE_UID, oldUsed.id))
  const oldExpired = await createOAuthStateRow({
    tenant: tenant.id,
    user: user.id,
    nonce: `${label}-expired`,
    frontendOrigin: 'http://localhost:3000',
    stateHash: `${label}-expired-hash`,
    expiresAt: new Date(now - (48 * 60 * 60 * 1000)).toISOString(),
    usedAt: null,
  })
  cleanup.push(() => destroyEntity(STRAVA_OAUTH_STATE_UID, oldExpired.id))
  const retained = await createOAuthStateRow({
    tenant: tenant.id,
    user: user.id,
    nonce: `${label}-retained`,
    frontendOrigin: 'http://localhost:3000',
    stateHash: `${label}-retained-hash`,
    expiresAt: new Date(now + (60 * 60 * 1000)).toISOString(),
    usedAt: null,
  })
  cleanup.push(() => destroyEntity(STRAVA_OAUTH_STATE_UID, retained.id))

  try {
    const state = await service.createSignedOAuthState(tenant.id, user.id, { frontendOrigin: 'http://localhost:3000' })
    assert.ok(state)
    const verified = await service.verifySignedOAuthState(state)
    assert.ok(verified?.recordId)

    const deletedUsed = await loadOAuthState(oldUsed.id)
    const deletedExpired = await loadOAuthState(oldExpired.id)
    const keptRetained = await loadOAuthState(retained.id)
     assert.equal(deletedUsed, null)
     assert.equal(deletedExpired, null)
     assert.ok(keptRetained?.id)
   } finally {
     await cleanupFixture({ cleanup })
   }
})
