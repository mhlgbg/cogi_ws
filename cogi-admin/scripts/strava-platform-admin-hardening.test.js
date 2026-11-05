const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let service
let authenticatedRoleId = 0

const STRAVA_CONNECTION_UID = 'api::strava-connection.strava-connection'
const STRAVA_WEBHOOK_EVENT_UID = 'api::strava-webhook-event.strava-webhook-event'

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadStravaService() {
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
    select: ['id'],
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
    select: ['id'],
  })
}

async function createConnection(tenantId, userId, label) {
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
      cleanupStatus: 'NOT_REQUIRED',
    },
    select: ['id', 'stravaAthleteId'],
  })
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  global.strapi = app
  authenticatedRoleId = Number((await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] }))?.id || 0)
  if (!authenticatedRoleId) throw new Error('Authenticated role not found for test setup')
  service = loadStravaService()
})

after(async () => {
  if (app) await app.destroy()
})

test('platform webhook detail omits raw payload and updates but keeps operational correlation fields', async () => {
  const label = uniqueKey('platform-webhook-detail')
  const cleanup = []
  const tenant = await createTenant(`${label}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const user = await createUser(`${label}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))
  const connection = await createConnection(tenant.id, user.id, label)
  cleanup.push(() => destroyEntity(STRAVA_CONNECTION_UID, connection.id))

  try {
    const event = await app.db.query(STRAVA_WEBHOOK_EVENT_UID).create({
      data: {
        tenant: tenant.id,
        user: user.id,
        connection: connection.id,
        subscriptionId: '7001',
        ownerId: connection.stravaAthleteId,
        objectType: 'activity',
        objectId: 'activity-7001',
        aspectType: 'update',
        eventTime: `${Math.floor(Date.now() / 1000)}`,
        updates: { title: 'sensitive' },
        rawPayload: { object_type: 'activity', updates: { title: 'sensitive' } },
        status: 'failed',
        attempts: 2,
        lastError: 'Failed with retryable issue',
        idempotencyKey: `event-${label}`,
      },
      select: ['id'],
    })
    cleanup.push(() => destroyEntity(STRAVA_WEBHOOK_EVENT_UID, event.id))

    const detail = await service.getPlatformStravaWebhookEventDetail(event.id)
    assert.equal(detail.eventId, event.id)
    assert.equal(detail.ownerId, connection.stravaAthleteId)
    assert.equal(detail.objectId, 'activity-7001')
    assert.equal(detail.aspectType, 'update')
    assert.equal(detail.subscriptionId, 7001)
    assert.equal(detail.idempotencyKey, `event-${label}`)
    assert.equal('rawPayload' in detail, false)
    assert.equal('updates' in detail, false)
  } finally {
    for (const action of cleanup.slice().reverse()) {
      await action()
    }
  }
})

test('challenge activity content API controller blocks Strava-backed ledger mutation', async () => {
  const controller = app.controller('api::challenge-activity.challenge-activity')
  let badRequestMessage = ''
  const createResult = await controller.create({
    badRequest(message) {
      badRequestMessage = message
      return { error: message }
    },
  })
  assert.match(badRequestMessage, /Strava-backed activity linking is disabled/i)
  assert.equal(createResult.error, badRequestMessage)
})