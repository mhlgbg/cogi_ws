const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const XLSX = require('xlsx')

function loadService() {
  const modulePath = path.resolve(__dirname, '..', 'dist', 'src', 'api', 'exam-round', 'services', 'exam-round-management.js')
  delete require.cache[modulePath]
  return require(modulePath)
}

function createRound(status, registrationMode = 'restricted', overrides = {}) {
  return {
    id: 44,
    documentId: 'round-doc-44',
    code: 'ELG-44',
    name: 'Dot thi eligibility',
    academicYear: '2026-2027',
    semester: '1',
    status,
    registrationMode,
    registrationStartAt: '2026-09-01T00:00:00.000Z',
    registrationEndAt: '2026-09-10T00:00:00.000Z',
    paymentStartAt: null,
    paymentEndAt: null,
    candidateListClosingAt: '2026-09-10T00:00:00.000Z',
    examStartAt: '2026-09-15T00:00:00.000Z',
    examEndAt: '2026-09-16T00:00:00.000Z',
    paymentCalculationMethod: 'program_fee',
    fixedFee: null,
    allowSubjectSelection: false,
    allowComponentSelection: false,
    requireConfirmedPayment: true,
    allowCancellation: false,
    cancellationDeadline: null,
    instructions: null,
    paymentInstructions: null,
    submittedAt: null,
    approvedAt: null,
    returnedAt: null,
    returnReason: null,
    approvalNote: null,
    tenant: { id: 91 },
    examProgram: { id: 8, tenant: { id: 91 } },
    ...overrides,
  }
}

function createEligibilityRow(overrides = {}) {
  return {
    id: 71,
    examRound: { id: 44, documentId: 'round-doc-44', code: 'ELG-44', status: 'draft' },
    learner: { id: 501, code: 'L001', fullName: 'Le A', dateOfBirth: '2007-01-01', parentPhone: '0901', learnerStatus: 'active' },
    reviewedBy: { id: 5, username: 'admin' },
    eligibilityStatus: 'pending',
    source: 'manual',
    reason: null,
    note: null,
    reviewedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function collectIdValues(where) {
  const ids = new Set()

  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }

    if (typeof node.id === 'number') ids.add(Number(node.id))
    if (node.id && typeof node.id === 'object') {
      if (node.id.$eq) ids.add(Number(node.id.$eq))
      if (Array.isArray(node.id.$in)) node.id.$in.forEach((value) => ids.add(Number(value)))
    }

    Object.values(node).forEach(visit)
  }

  visit(where)
  return Array.from(ids).filter((value) => Number.isInteger(value) && value > 0)
}

function collectCodeValues(where) {
  const codes = new Set()

  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }

    if (typeof node.code === 'string') codes.add(String(node.code).trim())
    if (node.code && typeof node.code === 'object' && Array.isArray(node.code.$in)) {
      node.code.$in.forEach((value) => codes.add(String(value || '').trim()))
    }

    Object.values(node).forEach(visit)
  }

  visit(where)
  return Array.from(codes).filter(Boolean)
}

function createLearnerRow(overrides = {}) {
  return {
    id: 501,
    code: 'L001',
    fullName: 'Le A',
    dateOfBirth: '2007-01-01',
    parentPhone: '0901',
    learnerStatus: 'active',
    ...overrides,
  }
}

function createRegistrationRow(overrides = {}) {
  return {
    id: 801,
    documentId: 'reg-doc-801',
    registrationCode: 'REG001',
    registrationStatus: 'submitted',
    paymentStatus: 'pending',
    payableAmount: 0,
    registeredAt: '2026-09-02T00:00:00.000Z',
    learner: { id: 501 },
    ...overrides,
  }
}

function buildEligibilityWorkbook(rows, sheetName = 'Eligibility') {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['learnerCode', 'status', 'reason', 'note', 'fullName', 'dateOfBirth'],
    ...rows,
  ])
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
}

function installEligibilityStrapiMock(options = {}) {
  const workflowRound = options.workflowRound || createRound('draft')
  const activeRegistrationCount = options.activeRegistrationCount || 0
  const learners = (options.learners || [
    createLearnerRow({ id: 501, code: 'L501', fullName: 'Learner 501' }),
    createLearnerRow({ id: 502, code: 'L502', fullName: 'Learner 502' }),
  ]).map((row) => ({ ...row }))
  const storedEligibilities = (options.existingEligibilities || []).map((row) => ({ ...row }))
  const registrations = (options.registrations || (activeRegistrationCount > 0 ? [createRegistrationRow()] : [])).map((row) => ({ ...row }))
  const createdRows = []
  const updatedRows = []
  const deletedRows = []

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
              if (Array.isArray(params?.select) && params.select.includes('name')) return { ...workflowRound }
              return {
                id: workflowRound.id,
                documentId: workflowRound.documentId,
                code: workflowRound.code,
                status: workflowRound.status,
                allowSubjectSelection: workflowRound.allowSubjectSelection,
                allowComponentSelection: workflowRound.allowComponentSelection,
                paymentCalculationMethod: workflowRound.paymentCalculationMethod,
                fixedFee: workflowRound.fixedFee,
              }
            },
          }
        }

        if (uid === 'api::learner.learner') {
          return {
            async findOne(params) {
              const learnerId = collectIdValues(params?.where)[0] || 0
              return learners.find((row) => Number(row.id) === Number(learnerId)) || null
            },
            async findMany(params) {
              const codes = collectCodeValues(params?.where)
              if (codes.length > 0) {
                return learners.filter((row) => codes.includes(String(row.code || '').trim())).map((row) => ({ ...row }))
              }
              const ids = collectIdValues(params?.where)
              const normalizedIds = ids.length > 0 ? ids : learners.map((row) => Number(row.id))
              return learners.filter((row) => normalizedIds.includes(Number(row.id))).map((row) => ({ ...row }))
            },
            async count() { return learners.length },
          }
        }

        if (uid === 'api::exam-eligibility.exam-eligibility') {
          return {
            async findMany(params) {
              const ids = collectIdValues(params?.where)
              const learnerIds = ids.filter((value) => value >= 500)
              if (learnerIds.length > 0) {
                return storedEligibilities.filter((row) => learnerIds.includes(Number(row?.learner?.id || 0))).map((row) => ({ ...row }))
              }
              return storedEligibilities.map((row) => ({ ...row }))
            },
            async findOne(params) {
              const ids = collectIdValues(params?.where)
              const eligibilityId = ids.find((value) => value < 500) || 0
              const found = storedEligibilities.find((row) => Number(row.id) === eligibilityId) || storedEligibilities[0] || createEligibilityRow()
              return { ...found }
            },
            async create(params) {
              createdRows.push(params)
              const created = createEligibilityRow({
                id: 88 + createdRows.length,
                learner: { id: Number(params.data.learner), code: `L${params.data.learner}`, fullName: `Learner ${params.data.learner}`, dateOfBirth: '2007-01-01', parentPhone: '0901', learnerStatus: 'active' },
                eligibilityStatus: params.data.eligibilityStatus,
                source: params.data.source,
                reason: params.data.reason,
                note: params.data.note,
              })
              storedEligibilities.push(created)
              return { id: created.id, ...params.data }
            },
            async update(params) {
              updatedRows.push(params)
              const targetId = Number(params?.where?.id || 71)
              const index = storedEligibilities.findIndex((row) => Number(row.id) === targetId)
              if (index >= 0) {
                storedEligibilities[index] = { ...storedEligibilities[index], ...params.data }
              }
              return { id: Number(params?.where?.id || 71), ...params.data }
            },
            async delete(params) {
              deletedRows.push(params)
              const targetId = Number(params?.where?.id || 71)
              const index = storedEligibilities.findIndex((row) => Number(row.id) === targetId)
              if (index >= 0) storedEligibilities.splice(index, 1)
              return { id: Number(params?.where?.id || 71) }
            },
            async count() {
              return storedEligibilities.length
            },
          }
        }

        if (uid === 'api::exam-registration.exam-registration') {
          return {
            async findMany(params) {
              const ids = collectIdValues(params?.where)
              const learnerIds = ids.filter((value) => value >= 500)
              if (learnerIds.length === 0) return registrations.map((row) => ({ ...row }))
              return registrations.filter((row) => learnerIds.includes(Number(row?.learner?.id || 0))).map((row) => ({ ...row }))
            },
          }
        }

        if (uid === 'api::exam-round-subject.exam-round-subject' || uid === 'api::exam-round-component.exam-round-component') {
          return {
            async findMany() { return [] },
          }
        }

        throw new Error(`Unexpected uid ${uid}`)
      },
    },
  }

  return { createdRows, updatedRows, deletedRows }
}

test('eligibility import template includes eligibility and guide sheets', async () => {
  const service = loadService()

  const result = await service.downloadExamEligibilityImportTemplate()
  const workbook = XLSX.read(result.buffer, { type: 'buffer' })

  assert.equal(result.fileName, 'exam-eligibility-import-template.xlsx')
  assert.deepEqual(workbook.SheetNames, ['Eligibility', 'Hướng dẫn'])
  const headerRow = XLSX.utils.sheet_to_json(workbook.Sheets.Eligibility, { header: 1, raw: false })[0]
  assert.deepEqual(headerRow, ['learnerCode', 'status', 'reason', 'note', 'fullName', 'dateOfBirth'])
})

test('eligibility import preview keeps learnerCode as string and classifies create update skip', async () => {
  const service = loadService()
  installEligibilityStrapiMock({
    workflowRound: createRound('draft', 'restricted'),
    learners: [
      createLearnerRow({ id: 501, code: '001001', fullName: 'Learner One' }),
      createLearnerRow({ id: 502, code: '001002', fullName: 'Learner Two' }),
      createLearnerRow({ id: 503, code: '001003', fullName: 'Learner Three' }),
    ],
    existingEligibilities: [
      createEligibilityRow({ id: 71, learner: { id: 502, code: '001002', fullName: 'Learner Two', dateOfBirth: '2007-01-01', parentPhone: '0901', learnerStatus: 'active' }, eligibilityStatus: 'pending', reason: null, note: null }),
      createEligibilityRow({ id: 72, learner: { id: 503, code: '001003', fullName: 'Learner Three', dateOfBirth: '2007-01-01', parentPhone: '0901', learnerStatus: 'active' }, eligibilityStatus: 'eligible', reason: null, note: 'same' }),
    ],
  })

  const file = { name: 'eligibility.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1024, buffer: buildEligibilityWorkbook([
    ['001001', '', '', '', 'Learner One', '2007-01-01'],
    ['001002', 'Không đủ điều kiện', 'Thiếu hồ sơ', '', 'Learner Two', '2007-01-01'],
    ['001003', 'eligible', '', 'same', 'Learner Three', '2007-01-01'],
  ]) }

  const preview = await service.previewExamEligibilityImport(91, 44, file, { id: 5 })

  assert.equal(preview.totalRows, 3)
  assert.equal(preview.validRows, 3)
  assert.equal(preview.createCount, 1)
  assert.equal(preview.updateCount, 1)
  assert.equal(preview.skipCount, 1)
  assert.equal(preview.errorCount, 0)
  assert.equal(preview.rows[0].learnerCode, '001001')
  assert.equal(preview.rows[0].newStatus, 'eligible')
  assert.equal(preview.rows[0].action, 'CREATE')
  assert.equal(preview.rows[1].action, 'UPDATE')
  assert.equal(preview.rows[2].action, 'SKIP')
})

test('eligibility import preview reports learner not found and duplicate code in file as errors', async () => {
  const service = loadService()
  installEligibilityStrapiMock({
    workflowRound: createRound('draft', 'restricted'),
    learners: [createLearnerRow({ id: 501, code: '001001' })],
  })

  const file = { name: 'eligibility.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1024, buffer: buildEligibilityWorkbook([
    ['009999', 'eligible', '', '', '', ''],
    ['001001', 'eligible', '', '', '', ''],
    ['001001', 'eligible', '', '', '', ''],
  ]) }

  const preview = await service.previewExamEligibilityImport(91, 44, file, { id: 5 })

  assert.equal(preview.errorCount, 3)
  assert.match(preview.rows[0].errors.join(' | '), /LEARNER_NOT_FOUND/)
  assert.match(preview.rows[1].errors.join(' | '), /DUPLICATE_LEARNER_CODE_IN_FILE/)
  assert.match(preview.rows[2].errors.join(' | '), /DUPLICATE_LEARNER_CODE_IN_FILE/)
})

test('eligibility import preview blocks ineligible transition when learner already has registration', async () => {
  const service = loadService()
  installEligibilityStrapiMock({
    workflowRound: createRound('draft', 'restricted'),
    learners: [createLearnerRow({ id: 501, code: '001001' })],
    existingEligibilities: [createEligibilityRow({ id: 71, learner: { id: 501, code: '001001', fullName: 'Le A', dateOfBirth: '2007-01-01', parentPhone: '0901', learnerStatus: 'active' }, eligibilityStatus: 'eligible' })],
    registrations: [createRegistrationRow({ learner: { id: 501 } })],
  })

  const file = { name: 'eligibility.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1024, buffer: buildEligibilityWorkbook([
    ['001001', 'Không đủ điều kiện', 'Thiếu hồ sơ', '', '', ''],
  ]) }

  const preview = await service.previewExamEligibilityImport(91, 44, file, { id: 5 })
  assert.equal(preview.errorCount, 1)
  assert.match(preview.rows[0].errors.join(' | '), /EXAM_ELIGIBILITY_IMPORT_REGISTRATION_CONFLICT/)
})

test('eligibility import commit creates and updates without removing untouched eligibilities', async () => {
  const service = loadService()
  const { createdRows, updatedRows } = installEligibilityStrapiMock({
    workflowRound: createRound('draft', 'restricted'),
    learners: [
      createLearnerRow({ id: 501, code: '001001' }),
      createLearnerRow({ id: 502, code: '001002' }),
      createLearnerRow({ id: 503, code: '001003' }),
    ],
    existingEligibilities: [
      createEligibilityRow({ id: 71, learner: { id: 502, code: '001002', fullName: 'Le B', dateOfBirth: '2007-01-01', parentPhone: '0901', learnerStatus: 'active' }, eligibilityStatus: 'pending', reason: null, note: null }),
      createEligibilityRow({ id: 72, learner: { id: 503, code: '001003', fullName: 'Le C', dateOfBirth: '2007-01-01', parentPhone: '0901', learnerStatus: 'active' }, eligibilityStatus: 'eligible', reason: null, note: null }),
    ],
  })

  const file = { name: 'eligibility.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1024, buffer: buildEligibilityWorkbook([
    ['001001', 'eligible', '', '', '', ''],
    ['001002', 'Không đủ điều kiện', 'Thiếu hồ sơ', '', '', ''],
  ]) }

  const result = await service.commitExamEligibilityImport(91, 44, file, { id: 5 })

  assert.equal(result.created, 1)
  assert.equal(result.updated, 1)
  assert.equal(result.skipped, 0)
  assert.equal(createdRows.length, 1)
  assert.equal(updatedRows.length, 1)
  assert.equal(createdRows[0].data.source, 'imported')
  assert.equal(updatedRows[0].data.source, 'imported')
})

test('eligibility import commit revalidates and rejects files with preview errors', async () => {
  const service = loadService()
  installEligibilityStrapiMock({
    workflowRound: createRound('draft', 'restricted'),
    learners: [createLearnerRow({ id: 501, code: '001001' })],
  })

  const file = { name: 'eligibility.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1024, buffer: buildEligibilityWorkbook([
    ['009999', 'eligible', '', '', '', ''],
  ]) }

  await assert.rejects(
    () => service.commitExamEligibilityImport(91, 44, file, { id: 5 }),
    (error) => error && error.status === 409 && error.code === 'EXAM_ELIGIBILITY_IMPORT_HAS_ERRORS',
  )
})

test('eligibility create allows draft restricted rounds', async () => {
  const service = loadService()
  const { createdRows } = installEligibilityStrapiMock({ workflowRound: createRound('draft', 'restricted') })

  const result = await service.createExamRoundEligibility(91, 44, {
    learnerId: 501,
    eligibilityStatus: 'eligible',
    source: 'manual',
    reason: null,
    note: 'ok',
  }, { id: 5 })

  assert.equal(result.eligibilityStatus, 'eligible')
  assert.equal(createdRows.length, 1)
  assert.equal(createdRows[0].data.eligibilityStatus, 'eligible')
})

test('eligibility bulk create allows draft restricted rounds', async () => {
  const service = loadService()
  const { createdRows } = installEligibilityStrapiMock({ workflowRound: createRound('draft', 'restricted') })

  const result = await service.bulkCreateExamRoundEligibilities(91, 44, {
    source: 'manual',
    duplicateHandling: 'skip',
    items: [
      { learnerId: 501, eligibilityStatus: 'eligible', reason: null, note: null },
      { learnerId: 502, eligibilityStatus: 'pending', reason: null, note: null },
    ],
  }, { id: 5 })

  assert.equal(result.summary.created, 2)
  assert.equal(createdRows.length, 2)
})

test('eligibility update allows draft restricted rounds', async () => {
  const service = loadService()
  const { updatedRows } = installEligibilityStrapiMock({
    workflowRound: createRound('draft', 'restricted'),
    existingEligibilities: [createEligibilityRow()],
  })

  const result = await service.updateExamRoundEligibility(91, 44, 71, {
    eligibilityStatus: 'eligible',
    reason: null,
    note: 'cap nhat',
  }, { id: 5 })

  assert.equal(updatedRows.length, 1)
  assert.equal(updatedRows[0].data.eligibilityStatus, 'eligible')
  assert.equal(result.eligibilityStatus, 'eligible')
})

test('eligibility delete allows draft restricted rounds when learner has no active registration', async () => {
  const service = loadService()
  const { deletedRows } = installEligibilityStrapiMock({
    workflowRound: createRound('draft', 'restricted'),
    existingEligibilities: [createEligibilityRow()],
  })

  const result = await service.deleteExamRoundEligibility(91, 44, 71, { id: 5 })

  assert.equal(result.deleted, true)
  assert.equal(deletedRows.length, 1)
})

test('eligibility create rejects open rounds with specific reason', async () => {
  const service = loadService()
  installEligibilityStrapiMock({ workflowRound: createRound('draft', 'open') })

  await assert.rejects(
    () => service.createExamRoundEligibility(91, 44, { learnerId: 501, eligibilityStatus: 'eligible', source: 'manual' }, { id: 5 }),
    (error) => error && error.status === 409 && error.code === 'EXAM_ELIGIBILITY_RESTRICTED_MODE_REQUIRED',
  )
})

test('eligibility management allows returned rounds through draft workflow state', async () => {
  const service = loadService()
  const { createdRows } = installEligibilityStrapiMock({
    workflowRound: createRound('draft', 'restricted', { returnedAt: '2026-08-31T00:00:00.000Z', returnReason: 'bo sung' }),
  })

  await service.createExamRoundEligibility(91, 44, { learnerId: 501, eligibilityStatus: 'eligible', source: 'manual' }, { id: 5 })
  assert.equal(createdRows.length, 1)
})

test('eligibility create rejects pending approval rounds', async () => {
  const service = loadService()
  installEligibilityStrapiMock({ workflowRound: createRound('pending_approval', 'restricted') })

  await assert.rejects(
    () => service.createExamRoundEligibility(91, 44, { learnerId: 501, eligibilityStatus: 'eligible', source: 'manual' }, { id: 5 }),
    (error) => error && error.status === 409 && error.code === 'EXAM_ELIGIBILITY_PENDING_APPROVAL_LOCKED',
  )
})

test('eligibility create still allows approved rounds by current business rule', async () => {
  const service = loadService()
  const { createdRows } = installEligibilityStrapiMock({ workflowRound: createRound('approved', 'restricted') })

  await service.createExamRoundEligibility(91, 44, { learnerId: 501, eligibilityStatus: 'eligible', source: 'manual' }, { id: 5 })
  assert.equal(createdRows.length, 1)
})

test('eligibility delete is blocked when learner already has active registration', async () => {
  const service = loadService()
  installEligibilityStrapiMock({
    workflowRound: createRound('draft', 'restricted'),
    existingEligibilities: [createEligibilityRow()],
    activeRegistrationCount: 1,
  })

  await assert.rejects(
    () => service.deleteExamRoundEligibility(91, 44, 71, { id: 5 }),
    (error) => error && error.status === 409 && error.code === 'EXAM_ELIGIBILITY_HAS_ACTIVE_REGISTRATION',
  )
})

test('eligibility create blocks learner from another tenant through tenant-scoped lookup', async () => {
  const service = loadService()
  installEligibilityStrapiMock({ workflowRound: createRound('draft', 'restricted') })

  await assert.rejects(
    () => service.createExamRoundEligibility(91, 44, { learnerId: 9999, eligibilityStatus: 'eligible', source: 'manual' }, { id: 5 }),
    (error) => error && error.status === 404 && error.code === 'LEARNER_NOT_FOUND',
  )
})