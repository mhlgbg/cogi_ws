const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

function loadService() {
  const modulePath = path.resolve(__dirname, '..', 'dist', 'src', 'api', 'exam-round', 'services', 'exam-round-management.js')
  delete require.cache[modulePath]
  return require(modulePath)
}

function createRound(status, overrides = {}) {
  return {
    id: 17,
    documentId: 'round-doc-17',
    code: 'ER-17',
    name: 'Dot thi 17',
    academicYear: '2026-2027',
    semester: '1',
    status,
    registrationMode: 'restricted',
    registrationStartAt: '2026-09-01T01:00:00.000Z',
    registrationEndAt: '2026-09-10T01:00:00.000Z',
    paymentStartAt: '2026-09-01T01:00:00.000Z',
    paymentEndAt: '2026-09-09T01:00:00.000Z',
    candidateListClosingAt: '2026-09-10T01:00:00.000Z',
    examStartAt: '2026-09-15T01:00:00.000Z',
    examEndAt: '2026-09-16T01:00:00.000Z',
    paymentCalculationMethod: 'program_fee',
    fixedFee: null,
    allowSubjectSelection: false,
    allowComponentSelection: false,
    requireConfirmedPayment: true,
    allowCancellation: false,
    cancellationDeadline: null,
    instructions: 'Huong dan thi',
    paymentInstructions: 'Huong dan thanh toan',
    submittedAt: null,
    approvedAt: null,
    returnedAt: null,
    approvalNote: null,
    returnReason: null,
    tenant: { id: 91 },
    examProgram: { id: 23, documentId: 'program-doc-23', code: 'EP-23', name: 'CTDT', tenant: { id: 91 } },
    ...overrides,
  }
}

function createSubject() {
  return {
    id: 101,
    nameSnapshot: 'Mon nghe',
    calculationMethodSnapshot: 'total',
    requiredAggregateScoreSnapshot: '50',
    requireAllComponentsSnapshot: true,
    ruleDescriptionSnapshot: null,
    fee: null,
    isRequired: true,
    allowSeparateRegistration: false,
    displayOrder: 1,
    status: 'active',
    examSubject: { id: 201, code: 'LISTEN' },
  }
}

function createComponent() {
  return {
    id: 301,
    nameSnapshot: 'Part 1',
    minimumScoreSnapshot: '0',
    maximumScoreSnapshot: '100',
    passingScoreSnapshot: '50',
    eliminationScoreSnapshot: null,
    durationMinutes: 60,
    fee: null,
    isRequired: true,
    allowSeparateRegistration: false,
    displayOrder: 1,
    status: 'active',
    examMethod: 'paper',
    externalExamCode: null,
    examRoundSubject: { id: 101 },
    examComponent: { id: 401, code: 'P1' },
  }
}

function createPayload(overrides = {}) {
  return {
    code: 'ER-17-UPDATED',
    name: 'Dot thi 17 da sua',
    academicYear: '2026-2027',
    semester: '2',
    registrationMode: 'open',
    registrationStartAt: '2026-09-02T01:00:00.000Z',
    registrationEndAt: '2026-09-12T01:00:00.000Z',
    paymentStartAt: '2026-09-02T01:00:00.000Z',
    paymentEndAt: '2026-09-11T01:00:00.000Z',
    candidateListClosingAt: '2026-09-12T01:00:00.000Z',
    examStartAt: '2026-09-18T01:00:00.000Z',
    examEndAt: '2026-09-19T01:00:00.000Z',
    paymentCalculationMethod: 'program_fee',
    fixedFee: null,
    allowSubjectSelection: false,
    allowComponentSelection: false,
    requireConfirmedPayment: false,
    allowCancellation: true,
    cancellationDeadline: '2026-09-11T01:00:00.000Z',
    instructions: 'Thong tin moi',
    paymentInstructions: 'Huong dan moi',
    subjects: [
      {
        examRoundSubjectId: 101,
        status: 'active',
        isRequired: true,
        allowSeparateRegistration: false,
        fee: null,
        displayOrder: 1,
        calculationMethodSnapshot: 'total',
        requiredAggregateScoreSnapshot: '50',
        requireAllComponentsSnapshot: true,
        ruleDescriptionSnapshot: null,
        components: [
          {
            examRoundComponentId: 301,
            status: 'active',
            isRequired: true,
            allowSeparateRegistration: false,
            minimumScoreSnapshot: '0',
            maximumScoreSnapshot: '100',
            passingScoreSnapshot: '50',
            eliminationScoreSnapshot: null,
            durationMinutes: 60,
            fee: null,
            examMethod: 'paper',
            externalExamCode: null,
            displayOrder: 1,
          },
        ],
      },
    ],
    ...overrides,
  }
}

function installStrapiMock(workflowRound, options = {}) {
  const updates = []
  const registrationCount = Number(options.registrationCount || 0) || 0
  const countCalls = []
  const examRoundListRow = {
    id: workflowRound.id,
    documentId: workflowRound.documentId,
    code: workflowRound.code,
    status: workflowRound.status,
    allowSubjectSelection: workflowRound.allowSubjectSelection,
    allowComponentSelection: workflowRound.allowComponentSelection,
    paymentCalculationMethod: workflowRound.paymentCalculationMethod,
    fixedFee: workflowRound.fixedFee,
  }

  global.strapi = {
    log: { info() {}, error() {} },
    db: {
      connection: {
        client: { config: { client: 'sqlite' } },
        transaction: async (callback) => callback({}),
      },
      query(uid) {
        if (uid === 'api::exam-round.exam-round') {
          return {
            async findOne(params) {
              if (Array.isArray(params?.select) && params.select.includes('name')) {
                return { ...workflowRound }
              }
              return { ...examRoundListRow }
            },
            async update(params) {
              updates.push({ uid, params })
              return { id: workflowRound.id, ...params.data }
            },
          }
        }

        if (uid === 'api::exam-round-subject.exam-round-subject') {
          return {
            async findMany() {
              return [createSubject()]
            },
            async update(params) {
              updates.push({ uid, params })
              return { id: 101, ...params.data }
            },
          }
        }

        if (uid === 'api::exam-round-component.exam-round-component') {
          return {
            async findMany() {
              return [createComponent()]
            },
            async update(params) {
              updates.push({ uid, params })
              return { id: 301, ...params.data }
            },
          }
        }

        if (uid === 'api::exam-registration.exam-registration') {
          return {
            async count(params) {
              countCalls.push(params)
              return registrationCount
            },
          }
        }

        throw new Error(`Unexpected uid ${uid}`)
      },
    },
  }

  return { updates, countCalls }
}

test('exam round config update allows draft rounds and persists timeline fields', async () => {
  const service = loadService()
  const { updates } = installStrapiMock(createRound('draft'))

  const result = await service.updateExamRoundStructure(91, 17, createPayload(), { id: 5 })

  assert.equal(result.examRound.status, 'draft')
  assert.equal(result.examRound.name, 'Dot thi 17 da sua')
  assert.equal(result.examRound.registrationStartAt, '2026-09-02T01:00:00.000Z')
  assert.equal(result.examRound.paymentEndAt, '2026-09-11T01:00:00.000Z')
  assert.equal(result.examRound.examEndAt, '2026-09-19T01:00:00.000Z')
  assert.equal(result.examRound.requireConfirmedPayment, false)
  assert.equal(result.examRound.allowCancellation, true)

  const roundUpdate = updates.find((entry) => entry.uid === 'api::exam-round.exam-round')
  assert.ok(roundUpdate)
  assert.equal(roundUpdate.params.data.code, 'ER-17-UPDATED')
  assert.equal(roundUpdate.params.data.registrationMode, 'open')
  assert.equal(roundUpdate.params.data.registrationStartAt, '2026-09-02T01:00:00.000Z')
  assert.equal(roundUpdate.params.data.paymentStartAt, '2026-09-02T01:00:00.000Z')
  assert.equal(roundUpdate.params.data.examStartAt, '2026-09-18T01:00:00.000Z')
  assert.equal(roundUpdate.params.data.instructions, 'Thong tin moi')
})

test('exam round config update also allows returned rounds through the draft status workflow state', async () => {
  const service = loadService()
  const returnedRound = createRound('draft', {
    returnedAt: '2026-08-30T10:00:00.000Z',
    returnReason: 'Bo sung moc thoi gian',
  })
  const { updates } = installStrapiMock(returnedRound)

  const result = await service.updateExamRoundStructure(91, 17, createPayload({ name: 'Dot thi sau khi tra ve' }), { id: 5 })

  assert.equal(result.examRound.status, 'draft')
  assert.equal(result.examRound.name, 'Dot thi sau khi tra ve')
  assert.equal(updates.filter((entry) => entry.uid === 'api::exam-round.exam-round').length, 1)
})

test('exam round config update rejects pending approval rounds', async () => {
  const service = loadService()
  installStrapiMock(createRound('pending_approval', {
    submittedAt: '2026-08-30T10:00:00.000Z',
  }))

  await assert.rejects(
    () => service.updateExamRoundStructure(91, 17, createPayload(), { id: 5 }),
    (error) => error && error.status === 409 && error.code === 'EXAM_ROUND_BASE_CONFIGURATION_LOCKED' && /chờ phê duyệt/i.test(error.message),
  )
})

test('exam round config update allows approved not-open rounds when there is no registration and keeps approved status', async () => {
  const service = loadService()
  const { updates, countCalls } = installStrapiMock(createRound('approved', {
    approvedAt: '2026-08-30T10:00:00.000Z',
  }), { registrationCount: 0 })

  const result = await service.updateExamRoundStructure(91, 17, createPayload({ name: 'Dot thi approved chua mo' }), { id: 5 })

  assert.equal(result.examRound.status, 'approved')
  assert.equal(result.examRound.name, 'Dot thi approved chua mo')
  assert.equal(updates.filter((entry) => entry.uid === 'api::exam-round.exam-round').length, 1)
  assert.equal(countCalls.length > 0, true)
  assert.match(JSON.stringify(countCalls[0] || {}), /17/)
})

test('exam round config update rejects approved rounds that already have registrations', async () => {
  const service = loadService()
  installStrapiMock(createRound('approved', {
    approvedAt: '2026-08-30T10:00:00.000Z',
  }), { registrationCount: 1 })

  await assert.rejects(
    () => service.updateExamRoundStructure(91, 17, createPayload(), { id: 5 }),
    (error) => error && error.status === 409 && error.code === 'EXAM_ROUND_BASE_CONFIGURATION_LOCKED' && /hồ sơ đăng ký/i.test(error.message),
  )
})

test('exam round config update rejects registration-open rounds', async () => {
  const service = loadService()
  installStrapiMock(createRound('registration_open', {
    approvedAt: '2026-08-30T10:00:00.000Z',
    registrationOpenedAt: '2026-09-01T10:00:00.000Z',
  }), { registrationCount: 0 })

  await assert.rejects(
    () => service.updateExamRoundStructure(91, 17, createPayload(), { id: 5 }),
    (error) => error && error.status === 409 && error.code === 'EXAM_ROUND_BASE_CONFIGURATION_LOCKED' && /không thể chỉnh sửa/i.test(error.message),
  )
})

test('exam round config update keeps timeline validation', async () => {
  const service = loadService()

  await assert.rejects(
    () => service.updateExamRoundStructure(91, 17, createPayload({ registrationStartAt: '2026-09-15T01:00:00.000Z', registrationEndAt: '2026-09-12T01:00:00.000Z' }), { id: 5 }),
    (error) => error && error.status === 400 && error.code === 'INVALID_DATE_RANGE' && /registrationStartAt must be before registrationEndAt/i.test(error.message),
  )
})