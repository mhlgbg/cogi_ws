const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

function loadService() {
  const modulePath = path.resolve(__dirname, '..', 'dist', 'src', 'api', 'exam-round', 'services', 'exam-round-management.js')
  delete require.cache[modulePath]
  return require(modulePath)
}

function createRound(overrides = {}) {
  return {
    id: 101,
    documentId: 'round-doc-101',
    code: 'R101',
    name: 'Dot thi 101',
    academicYear: '2026-2027',
    semester: '1',
    registrationMode: 'open',
    registrationStartAt: '2099-09-10T00:00:00.000Z',
    registrationEndAt: '2099-09-20T00:00:00.000Z',
    examStartAt: '2099-09-25T00:00:00.000Z',
    examEndAt: '2099-09-26T00:00:00.000Z',
    paymentCalculationMethod: 'fixed',
    fixedFee: 100000,
    status: 'approved',
    instructions: null,
    paymentInstructions: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function createEligibility(roundId, status, reason = null) {
  return {
    id: roundId + 1000,
    examRound: { id: roundId },
    eligibilityStatus: status,
    reason,
  }
}

function createRegistration(roundId) {
  return {
    id: roundId + 2000,
    documentId: `reg-doc-${roundId}`,
    registrationCode: `REG-${roundId}`,
    registrationStatus: 'submitted',
    paymentStatus: 'pending',
    payableAmount: 100000,
    registeredAt: '2026-09-02T00:00:00.000Z',
    examRound: { id: roundId },
  }
}

function installLearnerAvailabilityMock(options = {}) {
  const rounds = (options.rounds || []).map((row) => ({ ...row }))
  const eligibilityRows = (options.eligibilityRows || []).map((row) => ({ ...row }))
  const registrationRows = (options.registrationRows || []).map((row) => ({ ...row }))

  global.strapi = {
    log: { info() {}, error() {} },
    db: {
      connection: {
        client: { config: { client: 'sqlite' } },
      },
      query(uid) {
        if (uid === 'api::exam-round.exam-round') {
          return {
            async findMany() {
              return rounds.map((row) => ({ ...row }))
            },
          }
        }

        if (uid === 'api::learner.learner') {
          return {
            async findMany() {
              return [{ id: 501, documentId: 'learner-501', code: 'L001', fullName: 'Learner One', dateOfBirth: '2007-01-01', learnerStatus: 'active' }]
            },
          }
        }

        if (uid === 'api::enrollment.enrollment') {
          return {
            async findMany() {
              return []
            },
          }
        }

        if (uid === 'api::tenant.tenant') {
          return {
            async findOne() {
              return { id: 91, name: 'Tenant A', shortName: 'TA', siteTitle: null, slogan: null, siteDescription: null, description: null }
            },
          }
        }

        if (uid === 'api::exam-eligibility.exam-eligibility') {
          return {
            async findMany() {
              return eligibilityRows.map((row) => ({ ...row }))
            },
          }
        }

        if (uid === 'api::exam-registration.exam-registration') {
          return {
            async findMany() {
              return registrationRows.map((row) => ({ ...row }))
            },
          }
        }

        throw new Error(`Unexpected uid ${uid}`)
      },
    },
  }
}

test('learner-facing round list returns specific availability states and reasons', async () => {
  const service = loadService()
  installLearnerAvailabilityMock({
    rounds: [
      createRound({ id: 101, code: 'A-NOT-OPEN', status: 'approved', registrationMode: 'open' }),
      createRound({ id: 102, code: 'B-PAUSED', status: 'registration_paused', registrationMode: 'open' }),
      createRound({ id: 103, code: 'C-BEFORE', status: 'registration_open', registrationMode: 'open', registrationStartAt: '2099-10-01T00:00:00.000Z', registrationEndAt: '2099-10-10T00:00:00.000Z' }),
      createRound({ id: 104, code: 'D-AFTER', status: 'registration_open', registrationMode: 'open', registrationStartAt: '2020-10-01T00:00:00.000Z', registrationEndAt: '2020-10-10T00:00:00.000Z' }),
      createRound({ id: 105, code: 'E-RESTRICTED', status: 'registration_open', registrationMode: 'restricted', registrationStartAt: '2020-10-01T00:00:00.000Z', registrationEndAt: '2099-10-10T00:00:00.000Z' }),
      createRound({ id: 106, code: 'F-REGISTERED', status: 'registration_open', registrationMode: 'open', registrationStartAt: '2020-10-01T00:00:00.000Z', registrationEndAt: '2099-10-10T00:00:00.000Z' }),
    ],
    eligibilityRows: [
      createEligibility(105, 'ineligible', 'Khong du dieu kien'),
    ],
    registrationRows: [
      createRegistration(106),
    ],
  })

  const result = await service.listLearnerExamRounds({ state: { user: { id: 7 } } }, 91, { page: 1, pageSize: 20 }, { id: 7, username: 'parent' })
  const rows = Array.isArray(result?.data) ? result.data : []
  const byCode = new Map(rows.map((row) => [row.code, row]))

  assert.equal(byCode.get('A-NOT-OPEN')?.availabilityState, 'registration_not_open')
  assert.equal(byCode.get('A-NOT-OPEN')?.reasonCode, 'EXAM_ROUND_REGISTRATION_NOT_OPEN')

  assert.equal(byCode.get('B-PAUSED')?.availabilityState, 'registration_paused')
  assert.equal(byCode.get('B-PAUSED')?.reasonCode, 'EXAM_ROUND_REGISTRATION_PAUSED')

  assert.equal(byCode.get('C-BEFORE')?.availabilityState, 'registration_not_started')
  assert.equal(byCode.get('C-BEFORE')?.reasonCode, 'REGISTRATION_WINDOW_NOT_STARTED')

  assert.equal(byCode.get('D-AFTER')?.availabilityState, 'registration_ended')
  assert.equal(byCode.get('D-AFTER')?.reasonCode, 'REGISTRATION_WINDOW_ENDED')

  assert.equal(byCode.get('E-RESTRICTED')?.availabilityState, 'not_eligible')
  assert.equal(byCode.get('E-RESTRICTED')?.reasonCode, 'EXAM_LEARNER_NOT_ELIGIBLE')

  assert.equal(byCode.get('F-REGISTERED')?.availabilityState, 'registered')
  assert.equal(byCode.get('F-REGISTERED')?.reasonCode, 'EXAM_REGISTRATION_ALREADY_EXISTS')
})