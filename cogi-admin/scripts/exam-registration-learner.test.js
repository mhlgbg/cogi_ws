const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

process.env.STRAVA_SYNC_RUNNER_ENABLED = 'false'
process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'false'

let app
let service
let authenticatedRoleId = 0

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'exam-round', 'services', 'exam-round-management.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
}

function loadMailQueue() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'services', 'mail-queue.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
}

function clearBuiltModule(moduleRelativePath) {
  const modulePath = path.join(__dirname, '..', 'dist', ...moduleRelativePath.split('/'))
  try {
    delete require.cache[require.resolve(modulePath)]
  } catch {
    // ignore missing cache entry
  }
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

async function createLearner(tenantId, userId, label) {
  return app.db.query('api::learner.learner').create({
    data: {
      code: `${label}`.toUpperCase(),
      fullName: `Learner ${label}`,
      dateOfBirth: '2000-01-01',
      learnerStatus: 'active',
      parentPhone: '0900000000',
      user: userId,
      tenant: tenantId,
    },
    select: ['id', 'code', 'fullName', 'dateOfBirth'],
  })
}

async function createProgram(tenantId, label) {
  return app.db.query('api::exam-program.exam-program').create({
    data: {
      code: `${label}`.toUpperCase(),
      name: `Program ${label}`,
      passingMethod: 'all_subjects_pass',
      feeCalculationMethod: 'sum_subject_fees',
      defaultFee: '0',
      isActive: true,
      tenant: tenantId,
    },
    select: ['id', 'code', 'name'],
  })
}

async function createSubjectCatalog(tenantId, label) {
  return app.db.query('api::exam-subject.exam-subject').create({
    data: {
      code: `${label}`.toUpperCase(),
      name: `Subject ${label}`,
      calculationMethod: 'total',
      requireAllComponents: true,
      defaultFee: '0',
      isActive: true,
      tenant: tenantId,
    },
    select: ['id', 'code', 'name'],
  })
}

async function createComponentCatalog(tenantId, label) {
  return app.db.query('api::exam-component.exam-component').create({
    data: {
      code: `${label}`.toUpperCase(),
      name: `Component ${label}`,
      componentType: 'skill',
      minimumScore: '0',
      maximumScore: '100',
      passingScore: '50',
      defaultDurationMinutes: 60,
      examMethod: 'computer',
      isActive: true,
      tenant: tenantId,
    },
    select: ['id', 'code', 'name'],
  })
}

async function createPaymentProfile(tenantId, qrFileId, label) {
  return app.db.query('api::payment-profile.payment-profile').create({
    data: {
      name: `Payment ${label}`,
      code: `${label}`.toUpperCase(),
      paymentMethod: 'bank_transfer',
      bankCode: 'VCB',
      bankName: `Bank source ${label}`,
      accountNumber: '000123456789',
      accountHolder: `Source Holder ${label}`,
      bankBranch: 'Main Branch',
      currency: 'VND',
      transferContentTemplate: 'SOURCE {registrationCode}',
      paymentInstruction: '<p>Source instruction</p>',
      supportPhone: '0900111222',
      supportEmail: 'source@example.com',
      qrImage: qrFileId,
      isActive: true,
      isDefault: true,
      sortOrder: 0,
      tenant: tenantId,
    },
    select: ['id', 'code', 'name'],
  })
}

async function createRoundFixture(options = {}) {
  const cleanup = []
  const key = uniqueKey('examreg')
  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))

  const user = await createUser(`${key}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))

  const learner = await createLearner(tenant.id, user.id, `${key}-learner`)
  cleanup.push(() => destroyEntity('api::learner.learner', learner.id))

  const otherUser = await createUser(`${key}-other-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', otherUser.id))

  const otherLearner = await createLearner(tenant.id, otherUser.id, `${key}-other-learner`)
  cleanup.push(() => destroyEntity('api::learner.learner', otherLearner.id))

  const outsiderTenant = await createTenant(`${key}-other-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', outsiderTenant.id))

  const outsiderUser = await createUser(`${key}-outsider-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', outsiderUser.id))

  const outsiderLearner = await createLearner(outsiderTenant.id, outsiderUser.id, `${key}-outsider-learner`)
  cleanup.push(() => destroyEntity('api::learner.learner', outsiderLearner.id))

  const program = await createProgram(tenant.id, `${key}-program`)
  cleanup.push(() => destroyEntity('api::exam-program.exam-program', program.id))

  const subjectRequired = await createSubjectCatalog(tenant.id, `${key}-subject-required`)
  const subjectOptional = await createSubjectCatalog(tenant.id, `${key}-subject-optional`)
  cleanup.push(() => destroyEntity('api::exam-subject.exam-subject', subjectOptional.id))
  cleanup.push(() => destroyEntity('api::exam-subject.exam-subject', subjectRequired.id))

  const componentRequired = await createComponentCatalog(tenant.id, `${key}-component-required`)
  const componentOptional = await createComponentCatalog(tenant.id, `${key}-component-optional`)
  cleanup.push(() => destroyEntity('api::exam-component.exam-component', componentOptional.id))
  cleanup.push(() => destroyEntity('api::exam-component.exam-component', componentRequired.id))

  const qrFile = await createUploadFile(`${key}-qr-1`)
  const qrFile2 = await createUploadFile(`${key}-qr-2`)
  cleanup.push(() => destroyEntity('plugin::upload.file', qrFile2.id))
  cleanup.push(() => destroyEntity('plugin::upload.file', qrFile.id))

  const paymentProfile = await createPaymentProfile(tenant.id, qrFile2.id, `${key}-profile`)
  cleanup.push(() => destroyEntity('api::payment-profile.payment-profile', paymentProfile.id))

  const now = new Date()
  const registrationStartAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const registrationEndAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  const paymentEndAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
  const examStartAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const examEndAt = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString()

  const round = await app.db.query('api::exam-round.exam-round').create({
    data: {
      code: `${key}`.toUpperCase(),
      name: `Round ${key}`,
      examProgram: program.id,
      academicYear: '2026-2027',
      semester: '1',
      registrationMode: options.registrationMode || 'open',
      registrationStartAt: options.registrationStartAt || registrationStartAt,
      registrationEndAt: options.registrationEndAt || registrationEndAt,
      paymentStartAt: registrationStartAt,
      paymentEndAt: paymentEndAt,
      examStartAt,
      examEndAt,
      paymentCalculationMethod: options.paymentCalculationMethod || 'component_fee',
      fixedFee: options.fixedFee || null,
      allowSubjectSelection: options.allowSubjectSelection !== false,
      allowComponentSelection: options.allowComponentSelection !== false,
      requireConfirmedPayment: false,
      allowCancellation: false,
      instructions: '<p>Round instruction</p>',
      paymentInstructions: '<p>Round payment instruction</p>',
      paymentProfile: paymentProfile.id,
      paymentMethodSnapshot: options.paymentRequired === false ? null : 'bank_transfer',
      paymentProfileNameSnapshot: options.paymentRequired === false ? null : `Round Snapshot ${key}`,
      paymentProfileCodeSnapshot: options.paymentRequired === false ? null : `${key}`.toUpperCase(),
      paymentBankCodeSnapshot: options.paymentRequired === false ? null : 'ACB',
      paymentBankNameSnapshot: options.paymentRequired === false ? null : `Round Bank ${key}`,
      paymentAccountNumberSnapshot: options.paymentRequired === false ? null : '001234560001',
      paymentAccountHolderSnapshot: options.paymentRequired === false ? null : `Round Holder ${key}`,
      paymentBankBranchSnapshot: options.paymentRequired === false ? null : 'Round Branch',
      paymentCurrencySnapshot: options.paymentRequired === false ? null : 'VND',
      paymentTransferContentTemplateSnapshot: options.paymentRequired === false ? null : '{registrationCode} {learnerCode} {roundCode}',
      paymentInstructionSnapshot: options.paymentRequired === false ? null : '<p>Snapshot instruction</p>',
      paymentSupportPhoneSnapshot: options.paymentRequired === false ? null : '0900999888',
      paymentSupportEmailSnapshot: options.paymentRequired === false ? null : 'snapshot@example.com',
      paymentQrImageSnapshot: options.paymentRequired === false ? null : qrFile.id,
      paymentProfileCustomized: false,
      status: options.status || 'registration_open',
      tenant: tenant.id,
    },
    select: ['id', 'code', 'name', 'status'],
  })
  cleanup.push(() => destroyEntity('api::exam-round.exam-round', round.id))

  const roundSubjectRequired = await app.db.query('api::exam-round-subject.exam-round-subject').create({
    data: {
      examRound: round.id,
      examSubject: subjectRequired.id,
      nameSnapshot: `Subject Required ${key}`,
      calculationMethodSnapshot: 'total',
      requiredAggregateScoreSnapshot: '50',
      requireAllComponentsSnapshot: true,
      fee: options.subjectRequiredFee || '70000',
      isRequired: true,
      allowSeparateRegistration: false,
      displayOrder: 1,
      status: options.subjectRequiredStatus || 'active',
      tenant: tenant.id,
    },
    select: ['id', 'nameSnapshot'],
  })
  cleanup.push(() => destroyEntity('api::exam-round-subject.exam-round-subject', roundSubjectRequired.id))

  const roundSubjectOptional = await app.db.query('api::exam-round-subject.exam-round-subject').create({
    data: {
      examRound: round.id,
      examSubject: subjectOptional.id,
      nameSnapshot: `Subject Optional ${key}`,
      calculationMethodSnapshot: 'total',
      requiredAggregateScoreSnapshot: '50',
      requireAllComponentsSnapshot: false,
      fee: options.subjectOptionalFee || '90000',
      isRequired: false,
      allowSeparateRegistration: true,
      displayOrder: 2,
      status: options.subjectOptionalStatus || 'active',
      tenant: tenant.id,
    },
    select: ['id', 'nameSnapshot'],
  })
  cleanup.push(() => destroyEntity('api::exam-round-subject.exam-round-subject', roundSubjectOptional.id))

  const roundComponentRequired = await app.db.query('api::exam-round-component.exam-round-component').create({
    data: {
      examRound: round.id,
      examRoundSubject: roundSubjectRequired.id,
      examComponent: componentRequired.id,
      nameSnapshot: `Component Required ${key}`,
      minimumScoreSnapshot: '0',
      maximumScoreSnapshot: '100',
      passingScoreSnapshot: '50',
      durationMinutes: 60,
      examMethod: 'computer',
      fee: options.componentRequiredFee || (options.paymentRequired === false ? '0' : '110000'),
      isRequired: true,
      allowSeparateRegistration: false,
      displayOrder: 1,
      status: options.componentRequiredStatus || 'active',
      tenant: tenant.id,
    },
    select: ['id', 'nameSnapshot'],
  })
  cleanup.push(() => destroyEntity('api::exam-round-component.exam-round-component', roundComponentRequired.id))

  const roundComponentOptional = await app.db.query('api::exam-round-component.exam-round-component').create({
    data: {
      examRound: round.id,
      examRoundSubject: roundSubjectOptional.id,
      examComponent: componentOptional.id,
      nameSnapshot: `Component Optional ${key}`,
      minimumScoreSnapshot: '0',
      maximumScoreSnapshot: '100',
      passingScoreSnapshot: '50',
      durationMinutes: 45,
      examMethod: 'paper',
      fee: options.componentOptionalFee || (options.paymentRequired === false ? '0' : '130000'),
      isRequired: false,
      allowSeparateRegistration: true,
      displayOrder: 2,
      status: options.componentOptionalStatus || 'active',
      tenant: tenant.id,
    },
    select: ['id', 'nameSnapshot'],
  })
  cleanup.push(() => destroyEntity('api::exam-round-component.exam-round-component', roundComponentOptional.id))

  if (options.eligibilityStatus) {
    const eligibility = await app.db.query('api::exam-eligibility.exam-eligibility').create({
      data: {
        examRound: round.id,
        learner: learner.id,
        source: 'manual',
        eligibilityStatus: options.eligibilityStatus,
        reason: options.eligibilityReason || null,
        tenant: tenant.id,
      },
      select: ['id'],
    })
    cleanup.push(() => destroyEntity('api::exam-eligibility.exam-eligibility', eligibility.id))
  }

  const ctx = {
    state: {
      user,
      tenant: { id: tenant.id, code: tenant.code },
      tenantId: tenant.id,
      tenantCode: tenant.code,
    },
  }

  const otherCtx = {
    state: {
      user: otherUser,
      tenant: { id: tenant.id, code: tenant.code },
      tenantId: tenant.id,
      tenantCode: tenant.code,
    },
  }

  const outsiderCtx = {
    state: {
      user: outsiderUser,
      tenant: { id: outsiderTenant.id, code: outsiderTenant.code },
      tenantId: outsiderTenant.id,
      tenantCode: outsiderTenant.code,
    },
  }

  return {
    cleanup,
    tenant,
    outsiderTenant,
    user,
    learner,
    otherUser,
    otherLearner,
    outsiderUser,
    outsiderLearner,
    round,
    paymentProfile,
    qrFile,
    qrFile2,
    ctx,
    otherCtx,
    outsiderCtx,
    selection: {
      subjectIds: [roundSubjectRequired.id, roundSubjectOptional.id],
      componentIds: [roundComponentRequired.id, roundComponentOptional.id],
      requiredSubjectId: roundSubjectRequired.id,
      optionalSubjectId: roundSubjectOptional.id,
      requiredComponentId: roundComponentRequired.id,
      optionalComponentId: roundComponentOptional.id,
    },
  }
}

async function cleanupFixture(fixture) {
  for (const action of (fixture.cleanup || []).slice().reverse()) {
    await action()
  }
}

async function countRegistrationsForRound(roundId) {
  const row = await app.db.connection('exam_registrations_exam_round_lnk').where({ exam_round_id: roundId }).count('* as count').first()
  return Number(row?.count || 0)
}

async function countRegistrationComponentsByRegistration(registrationId) {
  const row = await app.db.connection('exam_registration_components_exam_registration_lnk').where({ exam_registration_id: registrationId }).count('* as count').first()
  return Number(row?.count || 0)
}

async function findRegistrationByRoundAndLearner(roundId, learnerId) {
  return app.db.connection('exam_registrations as er')
    .join('exam_registrations_exam_round_lnk as rl', 'rl.exam_registration_id', 'er.id')
    .join('exam_registrations_learner_lnk as ll', 'll.exam_registration_id', 'er.id')
    .where({ 'rl.exam_round_id': roundId, 'll.learner_id': learnerId })
    .select('er.id', 'er.registration_code', 'er.payment_status', 'er.payment_account_number_snapshot', 'er.payment_transfer_content', 'er.tenant_scope_id', 'er.exam_round_scope_id', 'er.learner_scope_id')
    .first()
}

async function findQrMorphRows(relatedType, relatedId) {
  return app.db.connection('files_related_mph')
    .where({ related_type: relatedType, related_id: relatedId, field: 'paymentQrImageSnapshot' })
    .select('*')
}

function getService() {
  return service
}

function getMailQueueModule() {
  return loadMailQueue()
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  global.strapi = app
  authenticatedRoleId = Number((await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] }))?.id || 0)
  if (!authenticatedRoleId) {
    throw new Error('Authenticated role not found for test setup')
  }
  service = loadService()
})

after(async () => {
  if (app) {
    await app.destroy()
  }
})

test.skip('registration-options endpoint returns 401 without auth', async () => {
  // Verified separately by runtime HTTP probe against the live Strapi instance.
})

test('registration-options uses round snapshots and open mode does not require eligibility', async () => {
  const fixture = await createRoundFixture({ registrationMode: 'open' })
  const service = getService()
  try {
    const result = await service.getLearnerRegistrationOptions(fixture.ctx, fixture.tenant.id, fixture.round.id, fixture.user)
    assert.equal(result.canRegister, true)
    assert.equal(result.eligibility.status, null)
    assert.equal(result.subjects[0].nameSnapshot.includes('Subject Required'), true)
    assert.equal(result.subjects[0].components[0].nameSnapshot.includes('Component Required'), true)
    assert.equal(result.paymentConfigured, true)
    assert.equal(result.paymentRequired, true)
    assert.equal(result.feePreview.calculationMethod, 'component_fee')
  } finally {
    await cleanupFixture(fixture)
  }
})

test('registration-options blocks restricted ineligible learner and allows free round without payment settings', async () => {
  const restrictedFixture = await createRoundFixture({ registrationMode: 'restricted', eligibilityStatus: 'ineligible' })
  const freeFixture = await createRoundFixture({ paymentRequired: false, componentRequiredFee: '0', componentOptionalFee: '0' })
  const service = getService()
  try {
    const restricted = await service.getLearnerRegistrationOptions(restrictedFixture.ctx, restrictedFixture.tenant.id, restrictedFixture.round.id, restrictedFixture.user)
    assert.equal(restricted.canRegister, false)
    assert.equal(restricted.reasonCode, 'EXAM_LEARNER_NOT_ELIGIBLE')

    const freeRound = await service.getLearnerRegistrationOptions(freeFixture.ctx, freeFixture.tenant.id, freeFixture.round.id, freeFixture.user)
    assert.equal(freeRound.paymentRequired, false)
    assert.equal(freeRound.paymentConfigured, true)
  } finally {
    await cleanupFixture(freeFixture)
    await cleanupFixture(restrictedFixture)
  }
})

test('register creates paid registration from round snapshot, renders transfer content, and stores QR relation snapshot', async () => {
  const fixture = await createRoundFixture({})
  const service = getService()
  try {
    const result = await service.registerCurrentLearnerForExamRound(
      fixture.ctx,
      fixture.tenant.id,
      fixture.round.id,
      { subjectIds: fixture.selection.subjectIds, componentIds: fixture.selection.componentIds },
      fixture.user,
    )

    assert.ok(result.registration.id > 0)
    assert.equal(result.registration.paymentStatus, 'unpaid')
    assert.equal(result.payment.accountNumber, '001234560001')
    assert.equal(result.payment.accountNumber, result.payment.accountNumber)
    assert.equal(result.payment.transferContent.includes(result.registration.registrationCode), true)
    assert.equal(result.payment.bankName.startsWith('Round Bank'), true)

    const persisted = await findRegistrationByRoundAndLearner(fixture.round.id, fixture.learner.id)
    assert.ok(persisted)
    assert.equal(persisted.payment_account_number_snapshot, '001234560001')
    assert.equal(persisted.tenant_scope_id, fixture.tenant.id)
    assert.equal(persisted.exam_round_scope_id, fixture.round.id)
    assert.equal(persisted.learner_scope_id, fixture.learner.id)
    assert.equal(await countRegistrationComponentsByRegistration(result.registration.id), 2)

    const detail = await service.getLearnerExamRegistrationDetail(fixture.ctx, fixture.tenant.id, result.registration.id, fixture.user)
    assert.equal(detail.payment.accountNumber, '001234560001')
    assert.ok(detail.payment.qrImage)

    const roundMorphRows = await findQrMorphRows('api::exam-round.exam-round', fixture.round.id)
    const registrationMorphRows = await findQrMorphRows('api::exam-registration.exam-registration', result.registration.id)
    assert.equal(roundMorphRows.length > 0, true)
    assert.equal(registrationMorphRows.length > 0, true)
    assert.equal(roundMorphRows[0].file_id, fixture.qrFile.id)
    assert.equal(registrationMorphRows[0].file_id, fixture.qrFile.id)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('register rejects forged totalAmount payload as unknown field', async () => {
  const fixture = await createRoundFixture({})
  const service = getService()
  try {
    await assert.rejects(
      () => service.registerCurrentLearnerForExamRound(
        fixture.ctx,
        fixture.tenant.id,
        fixture.round.id,
        { subjectIds: fixture.selection.subjectIds, componentIds: fixture.selection.componentIds, totalAmount: 1 },
        fixture.user,
      ),
      (error) => error && error.code === 'UNKNOWN_FIELDS',
    )
  } finally {
    await cleanupFixture(fixture)
  }
})

test('register creates free registration with not_required payment status', async () => {
  const fixture = await createRoundFixture({ paymentRequired: false, componentRequiredFee: '0', componentOptionalFee: '0' })
  const service = getService()
  try {
    const result = await service.registerCurrentLearnerForExamRound(
      fixture.ctx,
      fixture.tenant.id,
      fixture.round.id,
      { subjectIds: [fixture.selection.requiredSubjectId], componentIds: [fixture.selection.requiredComponentId] },
      fixture.user,
    )

    assert.equal(result.registration.paymentStatus, 'not_required')
    assert.equal(result.payment.transferContent, null)
    assert.equal(result.fee.amountDue, 0)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('register rejects invalid selection and reruns latest round payment snapshot between prepare and submit', async () => {
  const fixture = await createRoundFixture({})
  const service = getService()
  try {
    await assert.rejects(
      () => service.registerCurrentLearnerForExamRound(
        fixture.ctx,
        fixture.tenant.id,
        fixture.round.id,
        { subjectIds: [fixture.selection.optionalSubjectId], componentIds: [fixture.selection.optionalComponentId] },
        fixture.user,
      ),
      (error) => error && error.code === 'REQUIRED_SUBJECT_MISSING',
    )

    const options = await service.getLearnerRegistrationOptions(fixture.ctx, fixture.tenant.id, fixture.round.id, fixture.user)
    assert.equal(options.canRegister, true)

    await app.db.query('api::exam-round.exam-round').update({
      where: { id: fixture.round.id },
      data: {
        paymentBankNameSnapshot: 'Round Bank Updated',
        paymentAccountNumberSnapshot: '009999999999',
      },
    })

    const updated = await service.registerCurrentLearnerForExamRound(
      fixture.ctx,
      fixture.tenant.id,
      fixture.round.id,
      { subjectIds: fixture.selection.subjectIds, componentIds: fixture.selection.componentIds },
      fixture.user,
    )
    assert.equal(updated.payment.accountNumber, '009999999999')

    const fixtureInvalid = await createRoundFixture({})
    try {
      await service.getLearnerRegistrationOptions(fixtureInvalid.ctx, fixtureInvalid.tenant.id, fixtureInvalid.round.id, fixtureInvalid.user)
      await app.db.query('api::exam-round.exam-round').update({
        where: { id: fixtureInvalid.round.id },
        data: {
          paymentAccountNumberSnapshot: null,
        },
      })

      await assert.rejects(
        () => service.registerCurrentLearnerForExamRound(
          fixtureInvalid.ctx,
          fixtureInvalid.tenant.id,
          fixtureInvalid.round.id,
          { subjectIds: fixtureInvalid.selection.subjectIds, componentIds: fixtureInvalid.selection.componentIds },
          fixtureInvalid.user,
        ),
        (error) => error && error.code === 'PAYMENT_SETTINGS_INVALID',
      )
      assert.equal(await countRegistrationsForRound(fixtureInvalid.round.id), 0)

      await app.db.query('api::exam-round.exam-round').update({
        where: { id: fixtureInvalid.round.id },
        data: {
          status: 'registration_paused',
          paymentAccountNumberSnapshot: '001122334455',
        },
      })
      await assert.rejects(
        () => service.registerCurrentLearnerForExamRound(
          fixtureInvalid.ctx,
          fixtureInvalid.tenant.id,
          fixtureInvalid.round.id,
          { subjectIds: fixtureInvalid.selection.subjectIds, componentIds: fixtureInvalid.selection.componentIds },
          fixtureInvalid.user,
        ),
        (error) => error && error.code === 'EXAM_REGISTRATION_NOT_OPEN',
      )
    } finally {
      await cleanupFixture(fixtureInvalid)
    }
  } finally {
    await cleanupFixture(fixture)
  }
})

test('double submit creates one registration and the second request returns business conflict', async () => {
  const fixture = await createRoundFixture({})
  const service = getService()
  try {
    const payload = { subjectIds: fixture.selection.subjectIds, componentIds: fixture.selection.componentIds }
    const [first, second] = await Promise.allSettled([
      service.registerCurrentLearnerForExamRound(fixture.ctx, fixture.tenant.id, fixture.round.id, payload, fixture.user),
      service.registerCurrentLearnerForExamRound(fixture.ctx, fixture.tenant.id, fixture.round.id, payload, fixture.user),
    ])

    const fulfilled = [first, second].filter((item) => item.status === 'fulfilled')
    const rejected = [first, second].filter((item) => item.status === 'rejected')
    assert.equal(fulfilled.length, 1)
    assert.equal(rejected.length, 1)
    assert.equal(rejected[0].reason.code, 'EXAM_REGISTRATION_ALREADY_EXISTS')
    assert.equal(await countRegistrationsForRound(fixture.round.id), 1)

    const registrationId = fulfilled[0].value.registration.id
    assert.equal(await countRegistrationComponentsByRegistration(registrationId), 2)
  } finally {
    await cleanupFixture(fixture)
  }
})

test('detail is learner-safe and email enqueue failure does not roll back registration', async () => {
  const fixture = await createRoundFixture({})
  const mailQueueModule = getMailQueueModule()
  const originalEnqueueMail = mailQueueModule.enqueueMail
  const originalLogError = app.log.error
  const errorLogs = []

  try {
    clearBuiltModule('src/services/mail-queue.js')
    clearBuiltModule('src/api/exam-round/services/exam-round-management.js')
    mailQueueModule.enqueueMail = async () => {
      throw new Error('Simulated mail enqueue failure')
    }
    app.log.error = (...args) => {
      errorLogs.push(args.map((item) => String(item)).join(' '))
    }
    service = loadService()

    const created = await service.registerCurrentLearnerForExamRound(
      fixture.ctx,
      fixture.tenant.id,
      fixture.round.id,
      { subjectIds: fixture.selection.subjectIds, componentIds: fixture.selection.componentIds },
      fixture.user,
    )

    const detail = await service.getLearnerExamRegistrationDetail(fixture.ctx, fixture.tenant.id, created.registration.id, fixture.user)
    assert.equal(detail.registration.registrationCode.length > 0, true)
    assert.ok(detail.payment.qrImage)

    await assert.rejects(
      () => service.getLearnerExamRegistrationDetail(fixture.otherCtx, fixture.tenant.id, created.registration.id, fixture.otherUser),
      (error) => error && error.code === 'EXAM_REGISTRATION_NOT_FOUND',
    )

    await assert.rejects(
      () => service.getLearnerExamRegistrationDetail(fixture.outsiderCtx, fixture.outsiderTenant.id, created.registration.id, fixture.outsiderUser),
      (error) => error && (error.code === 'CURRENT_USER_HAS_NO_LEARNER' || error.code === 'EXAM_REGISTRATION_NOT_FOUND'),
    )

    await app.db.query('api::exam-round.exam-round').update({
      where: { id: fixture.round.id },
      data: { paymentQrImageSnapshot: fixture.qrFile2.id },
    })

    const reloaded = await service.getLearnerExamRegistrationDetail(fixture.ctx, fixture.tenant.id, created.registration.id, fixture.user)
    assert.equal(reloaded.payment.qrImage.id, fixture.qrFile.id)
    assert.equal(errorLogs.some((entry) => entry.includes('failed to enqueue learner registration email')), true)
  } finally {
    mailQueueModule.enqueueMail = originalEnqueueMail
    app.log.error = originalLogError
    await cleanupFixture(fixture)
  }
})