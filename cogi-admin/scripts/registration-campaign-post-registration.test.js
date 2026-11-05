const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

let app
let service
let authenticatedRoleId = 0
let sharedFixture = null

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'registration-campaign', 'services', 'registration-campaign-post-registration.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
}

async function destroyEntity(uid, id) {
  if (!id) return
  try {
    await app.db.query(uid).delete({ where: { id } })
  } catch {
    // ignore cleanup errors
  }
}

async function createTenant(label) {
  return app.db.query('api::tenant.tenant').create({
    data: {
      name: `Tenant ${label}`,
      code: `${label}`.toLowerCase(),
      tenantStatus: 'active',
      siteTitle: `Tenant ${label}`,
    },
    select: ['id', 'code', 'name'],
  })
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
    select: ['id', 'email', 'fullName'],
  })
}

async function createUserTenant(tenantId, userId, label) {
  return app.db.query('api::user-tenant.user-tenant').create({
    data: {
      tenant: tenantId,
      user: userId,
      label: `Membership ${label}`,
      userTenantStatus: 'active',
      isDefault: true,
      joinedAt: new Date().toISOString(),
    },
    select: ['id'],
  })
}

async function ensureFeatureEnabledForTenant(tenantId, featureKey, cleanup) {
  let feature = await app.db.query('api::feature.feature').findOne({
    where: { key: featureKey },
    select: ['id'],
    populate: { group: { select: ['id'] } },
  })

  if (!feature?.id) {
    const groupKey = `test-group-${uniqueKey('feature')}`
    const group = await app.db.query('api::feature-group.feature-group').create({
      data: {
        name: `Feature Group ${groupKey}`,
        code: groupKey,
        order: 9999,
      },
      select: ['id'],
    })
    cleanup.push(() => destroyEntity('api::feature-group.feature-group', group.id))

    feature = await app.db.query('api::feature.feature').create({
      data: {
        name: featureKey,
        key: featureKey,
        group: group.id,
        order: 9999,
        description: 'Test feature',
      },
      select: ['id'],
    })
    cleanup.push(() => destroyEntity('api::feature.feature', feature.id))
  }

  const existingTenantFeature = await app.db.query('api::tenant-feature.tenant-feature').findOne({
    where: {
      tenant: tenantId,
      feature: feature.id,
    },
    select: ['id'],
  })

  if (!existingTenantFeature?.id) {
    const tenantFeature = await app.db.query('api::tenant-feature.tenant-feature').create({
      data: {
        tenant: tenantId,
        feature: feature.id,
        isEnabled: true,
        label: `Enabled ${featureKey}`,
      },
      select: ['id'],
    })
    cleanup.push(() => destroyEntity('api::tenant-feature.tenant-feature', tenantFeature.id))
  }
}

async function createCampaign(tenantId, code, postRegistrationConfig = null) {
  return app.db.query('api::registration-campaign.registration-campaign').create({
    data: {
      tenant: tenantId,
      name: `Campaign ${code}`,
      code,
      status: 'open',
      registrationMode: 'public_code',
      targetFeature: 'fitness.manage',
      verificationRequired: true,
      verificationMethod: 'email_link',
      verificationExpireMinutes: 1440,
      autoApprove: true,
      requireTermsAcceptance: false,
      formConfig: {
        fields: [
          { key: 'fullName', label: 'Họ và tên', type: 'text', required: true, enabled: true, system: true, order: 0 },
          { key: 'email', label: 'Email', type: 'text', required: true, enabled: true, system: true, order: 1 },
          { key: 'phone', label: 'Số điện thoại', type: 'text', required: false, enabled: true, system: true, order: 2 },
          { key: 'MaThanhVienVKL', label: 'Mã thành viên', type: 'text', required: true, enabled: true, order: 3 },
        ],
      },
      postRegistrationConfig: postRegistrationConfig || {
        sportsProfileLink: {
          enabled: true,
          formFieldKey: 'MaThanhVienVKL',
        },
      },
    },
    select: ['id', 'code'],
  })
}

async function createRegistration(tenantId, campaignId, userId, input = {}) {
  return app.db.query('api::campaign-registration.campaign-registration').create({
    data: {
      tenant: tenantId,
      campaign: campaignId,
      user: userId || null,
      membership: null,
      fullName: input.fullName || 'Nguyen Van A',
      email: input.email || `${uniqueKey('registration')}@example.com`,
      phone: input.phone || '0900000000',
      formData: input.formData || {},
      status: 'approved',
      approvedAt: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      registrationSource: 'admin',
      termsAccepted: true,
      verificationSendCount: 0,
      metadata: {},
      isDeleted: false,
    },
    select: ['id', 'fullName', 'email'],
  })
}

async function createSportsProfile(tenantId, code, fullName, userId = null) {
  return app.db.query('api::sports-profile.sports-profile').create({
    data: {
      tenant: tenantId,
      code: String(code || '').toUpperCase(),
      fullName: fullName || code,
      displayName: fullName || code,
      status: 'active',
      source: 'admin_created',
      user: userId || null,
    },
    select: ['id', 'code', 'fullName'],
  })
}

async function createFixture() {
  const cleanup = []
  const key = uniqueKey('post-registration')
  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  await ensureFeatureEnabledForTenant(tenant.id, 'sports-profile.manage', cleanup)

  const actor = await createUser(`${key}-actor`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', actor.id))
  const actorTenant = await createUserTenant(tenant.id, actor.id, `${key}-actor`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', actorTenant.id))

  const readyUser = await createUser(`${key}-ready-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', readyUser.id))
  const readyUserTenant = await createUserTenant(tenant.id, readyUser.id, `${key}-ready`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', readyUserTenant.id))

  const linkedUser = await createUser(`${key}-linked-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', linkedUser.id))
  const linkedUserTenant = await createUserTenant(tenant.id, linkedUser.id, `${key}-linked`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', linkedUserTenant.id))

  const lockedProfileOwner = await createUser(`${key}-locked-owner`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', lockedProfileOwner.id))
  const lockedOwnerTenant = await createUserTenant(tenant.id, lockedProfileOwner.id, `${key}-locked-owner`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', lockedOwnerTenant.id))

  const conflictUser = await createUser(`${key}-conflict-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', conflictUser.id))
  const conflictUserTenant = await createUserTenant(tenant.id, conflictUser.id, `${key}-conflict`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', conflictUserTenant.id))

  const noCodeUser = await createUser(`${key}-no-code-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', noCodeUser.id))
  const noCodeUserTenant = await createUserTenant(tenant.id, noCodeUser.id, `${key}-no-code`)
  cleanup.push(() => destroyEntity('api::user-tenant.user-tenant', noCodeUserTenant.id))

  const campaign = await createCampaign(tenant.id, `${key}-cmp`)
  cleanup.push(() => destroyEntity('api::registration-campaign.registration-campaign', campaign.id))

  const readyRegistration = await createRegistration(tenant.id, campaign.id, readyUser.id, {
    fullName: 'Tran Van Ready',
    email: `${key}-ready@exam.com`,
    formData: { MaThanhVienVKL: '  READY 001  ' },
  })
  cleanup.push(() => destroyEntity('api::campaign-registration.campaign-registration', readyRegistration.id))

  const linkedRegistration = await createRegistration(tenant.id, campaign.id, linkedUser.id, {
    fullName: 'Le Thi Linked',
    email: `${key}-linked@exam.com`,
    formData: { MaThanhVienVKL: 'DONE001' },
  })
  cleanup.push(() => destroyEntity('api::campaign-registration.campaign-registration', linkedRegistration.id))

  const missingProfileRegistration = await createRegistration(tenant.id, campaign.id, actor.id, {
    fullName: 'Mai Missing',
    email: `${key}-missing@exam.com`,
    formData: { MaThanhVienVKL: 'MISSING001' },
  })
  cleanup.push(() => destroyEntity('api::campaign-registration.campaign-registration', missingProfileRegistration.id))

  const profileLinkedOtherUserRegistration = await createRegistration(tenant.id, campaign.id, actor.id, {
    fullName: 'Hoang Locked',
    email: `${key}-locked@exam.com`,
    formData: { MaThanhVienVKL: 'LOCKED001' },
  })
  cleanup.push(() => destroyEntity('api::campaign-registration.campaign-registration', profileLinkedOtherUserRegistration.id))

  const userLinkedOtherProfileRegistration = await createRegistration(tenant.id, campaign.id, conflictUser.id, {
    fullName: 'Bui Conflict',
    email: `${key}-conflict@exam.com`,
    formData: { MaThanhVienVKL: 'CONFLICT001' },
  })
  cleanup.push(() => destroyEntity('api::campaign-registration.campaign-registration', userLinkedOtherProfileRegistration.id))

  const manualReviewRegistration = await createRegistration(tenant.id, campaign.id, actor.id, {
    fullName: 'Name From Registration',
    email: `${key}-manual@exam.com`,
    formData: { MaThanhVienVKL: 'NAME001' },
  })
  cleanup.push(() => destroyEntity('api::campaign-registration.campaign-registration', manualReviewRegistration.id))

  const emptyCodeRegistration = await createRegistration(tenant.id, campaign.id, noCodeUser.id, {
    fullName: 'No Code',
    email: `${key}-empty@exam.com`,
    formData: {},
  })
  cleanup.push(() => destroyEntity('api::campaign-registration.campaign-registration', emptyCodeRegistration.id))

  const readyProfile = await createSportsProfile(tenant.id, 'READY001', 'Tran Van Ready')
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', readyProfile.id))

  const linkedProfile = await createSportsProfile(tenant.id, 'DONE001', 'Le Thi Linked', linkedUser.id)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', linkedProfile.id))

  const lockedProfile = await createSportsProfile(tenant.id, 'LOCKED001', 'Locked Profile', lockedProfileOwner.id)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', lockedProfile.id))

  const conflictProfileTarget = await createSportsProfile(tenant.id, 'CONFLICT001', 'Bui Conflict')
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', conflictProfileTarget.id))
  const conflictProfileExisting = await createSportsProfile(tenant.id, 'OTHER001', 'User Already Linked', conflictUser.id)
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', conflictProfileExisting.id))

  const manualReviewProfile = await createSportsProfile(tenant.id, 'NAME001', 'Different Name')
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', manualReviewProfile.id))
  const manualPickProfile = await createSportsProfile(tenant.id, 'MANUAL001', 'Mai Missing')
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', manualPickProfile.id))
  const noCodeProfile = await createSportsProfile(tenant.id, 'NOCODE001', 'No Code')
  cleanup.push(() => destroyEntity('api::sports-profile.sports-profile', noCodeProfile.id))

  return {
    cleanup,
    tenant,
    campaign,
    actor,
    users: {
      readyUser,
      linkedUser,
      conflictUser,
      noCodeUser,
      lockedProfileOwner,
    },
    registrations: {
      readyRegistration,
      linkedRegistration,
      missingProfileRegistration,
      profileLinkedOtherUserRegistration,
      userLinkedOtherProfileRegistration,
      manualReviewRegistration,
      emptyCodeRegistration,
    },
    profiles: {
      readyProfile,
      linkedProfile,
      conflictProfileTarget,
      manualPickProfile,
      noCodeProfile,
      lockedProfile,
    },
  }
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
  sharedFixture = await createFixture()
})

after(async () => {
  if (sharedFixture) {
    await cleanupFixture(sharedFixture)
    sharedFixture = null
  }
  if (app) await app.destroy()
})

test('post-registration reconciliation classifies expected statuses', async () => {
  const fixture = sharedFixture
  const result = await service.listCampaignSportsProfilePostRegistration(fixture.tenant.id, fixture.campaign.id, {
    page: 1,
    pageSize: 50,
  })

  const byRegistrationId = new Map((result.data || []).map((row) => [Number(row.registrationId), row]))

  assert.equal(byRegistrationId.get(fixture.registrations.readyRegistration.id)?.reconciliationStatus, 'ready_to_link')
  assert.equal(byRegistrationId.get(fixture.registrations.linkedRegistration.id)?.reconciliationStatus, 'already_linked_correct')
  assert.equal(byRegistrationId.get(fixture.registrations.missingProfileRegistration.id)?.reconciliationStatus, 'profile_not_found')
  assert.equal(byRegistrationId.get(fixture.registrations.profileLinkedOtherUserRegistration.id)?.reconciliationStatus, 'profile_linked_to_other_user')
  assert.equal(byRegistrationId.get(fixture.registrations.userLinkedOtherProfileRegistration.id)?.reconciliationStatus, 'already_linked_different_code')
  assert.equal(byRegistrationId.get(fixture.registrations.manualReviewRegistration.id)?.reconciliationStatus, 'need_manual_review')
  assert.equal(byRegistrationId.get(fixture.registrations.emptyCodeRegistration.id)?.reconciliationStatus, 'profile_not_found')
})

test('post-registration link supports single/bulk and is idempotent under race', async () => {
  const fixture = sharedFixture
  const readyId = fixture.registrations.readyRegistration.id
  const actor = { id: fixture.actor.id }

  const first = await service.linkCampaignSportsProfilePostRegistration(
    fixture.tenant.id,
    fixture.campaign.id,
    { mode: 'selected', registrationIds: [readyId] },
    actor,
  )
  const second = await service.linkCampaignSportsProfilePostRegistration(
    fixture.tenant.id,
    fixture.campaign.id,
    { mode: 'selected', registrationIds: [readyId] },
    actor,
  )

  assert.ok(Number(first.successCount) >= 1)
  assert.ok(Number(second.successCount) >= 1)

  const readyProfileAfter = await app.db.query('api::sports-profile.sports-profile').findOne({
    where: { id: fixture.profiles.readyProfile.id },
    populate: { user: { select: ['id'] } },
  })
  assert.equal(Number(readyProfileAfter?.user?.id || 0), fixture.users.readyUser.id)

  const bulkResult = await service.linkCampaignSportsProfilePostRegistration(
    fixture.tenant.id,
    fixture.campaign.id,
    {
      mode: 'selected',
      registrationIds: [fixture.registrations.missingProfileRegistration.id, fixture.registrations.linkedRegistration.id],
    },
    actor,
  )
  assert.equal(bulkResult.totalRequested, 2)
  assert.ok(bulkResult.results.some((item) => item.registrationId === fixture.registrations.linkedRegistration.id && item.ok === true))
  assert.ok(bulkResult.results.some((item) => item.registrationId === fixture.registrations.missingProfileRegistration.id && item.ok === false))
})

test('post-registration supports manual link and persists mismatch state', async () => {
  const fixture = sharedFixture
  const actor = { id: fixture.actor.id }

  const firstManual = await service.manualLinkCampaignSportsProfilePostRegistration(
    fixture.tenant.id,
    fixture.campaign.id,
    {
      registrationId: fixture.registrations.missingProfileRegistration.id,
      sportsProfileId: fixture.profiles.manualPickProfile.id,
    },
    actor,
  )
  assert.equal(firstManual.ok, true)
  assert.equal(firstManual.status, 'already_linked_different_code')

  const secondManual = await service.manualLinkCampaignSportsProfilePostRegistration(
    fixture.tenant.id,
    fixture.campaign.id,
    {
      registrationId: fixture.registrations.emptyCodeRegistration.id,
      sportsProfileId: fixture.profiles.noCodeProfile.id,
    },
    actor,
  )
  assert.equal(secondManual.ok, true)
  assert.equal(secondManual.status, 'already_linked_different_code')

  await assert.rejects(
    () => service.manualLinkCampaignSportsProfilePostRegistration(
      fixture.tenant.id,
      fixture.campaign.id,
      {
        registrationId: fixture.registrations.userLinkedOtherProfileRegistration.id,
        sportsProfileId: fixture.profiles.manualPickProfile.id,
      },
      actor,
    ),
    /chưa đủ điều kiện liên kết thủ công|đã liên kết/i,
  )

  await assert.rejects(
    () => service.manualLinkCampaignSportsProfilePostRegistration(
      fixture.tenant.id,
      fixture.campaign.id,
      {
        registrationId: fixture.registrations.manualReviewRegistration.id,
        sportsProfileId: fixture.profiles.lockedProfile.id,
      },
      actor,
    ),
    /đã liên kết/i,
  )

  const latest = await service.listCampaignSportsProfilePostRegistration(fixture.tenant.id, fixture.campaign.id, {
    page: 1,
    pageSize: 50,
  })
  const byRegistrationId = new Map((latest.data || []).map((row) => [Number(row.registrationId), row]))
  assert.equal(byRegistrationId.get(fixture.registrations.missingProfileRegistration.id)?.sportsProfile?.id, fixture.profiles.manualPickProfile.id)
  assert.equal(byRegistrationId.get(fixture.registrations.emptyCodeRegistration.id)?.sportsProfile?.id, fixture.profiles.noCodeProfile.id)
  assert.equal(byRegistrationId.get(fixture.registrations.missingProfileRegistration.id)?.manualLinkTag, 'Liên kết thủ công – khác mã khai báo')
})

test('post-registration rejects cross-tenant access', async () => {
  const fixture = sharedFixture
  await assert.rejects(
    () => service.listCampaignSportsProfilePostRegistration(999999999, fixture.campaign.id, {}),
    /Registration campaign not found/i,
  )
  await assert.rejects(
    () => service.manualLinkCampaignSportsProfilePostRegistration(
      999999999,
      fixture.campaign.id,
      {
        registrationId: fixture.registrations.missingProfileRegistration.id,
        sportsProfileId: fixture.profiles.manualPickProfile.id,
      },
      { id: fixture.actor.id },
    ),
    /Registration campaign not found/i,
  )
})
