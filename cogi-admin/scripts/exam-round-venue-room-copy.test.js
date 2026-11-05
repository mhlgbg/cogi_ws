const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

function loadService() {
  const modulePath = path.resolve(__dirname, '..', 'dist', 'src', 'api', 'exam-round', 'services', 'exam-round-management.js')
  delete require.cache[modulePath]
  return require(modulePath)
}

function createVenue(overrides = {}) {
  return {
    id: 11,
    documentId: 'venue-doc-11',
    code: 'V01',
    name: 'Co so 1',
    shortName: 'CS1',
    address: 'Dia chi 1',
    description: null,
    contactName: null,
    contactPhone: null,
    isActive: true,
    sortOrder: 0,
    ...overrides,
  }
}

function createRoom(overrides = {}) {
  const venue = overrides.examVenue || createVenue()
  return {
    id: 21,
    documentId: 'room-doc-21',
    code: 'R01',
    name: 'Phong 1',
    floor: '1',
    capacity: 30,
    roomType: 'standard',
    isActive: true,
    description: null,
    sortOrder: 0,
    examVenue: venue,
    ...overrides,
  }
}

function createRound(overrides = {}) {
  return {
    id: 101,
    documentId: 'round-doc-101',
    code: 'R-101',
    name: 'Dot thi 101',
    status: 'draft',
    examStartAt: '2026-09-10T00:00:00.000Z',
    examEndAt: '2026-09-11T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    examProgram: { id: 5, documentId: 'prog-5', code: 'P01', name: 'Chuong trinh 1' },
    examVenues: [],
    examRooms: [],
    examRoundComponents: [{ id: 1, nameSnapshot: 'Thi viet', status: 'active', examMethod: 'paper' }],
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
      if (node.id.$ne) ids.add(Number(node.id.$ne))
      if (Array.isArray(node.id.$in)) node.id.$in.forEach((value) => ids.add(Number(value)))
    }
    Object.values(node).forEach(visit)
  }

  visit(where)
  return Array.from(ids).filter((value) => Number.isInteger(value) && value > 0)
}

function matchesSearch(row, where) {
  const clauses = where?.$and || []
  const searchClause = clauses.find((item) => item?.$or)
  if (!searchClause) return true
  const values = [String(row.code || '').toLowerCase(), String(row.name || '').toLowerCase()]
  return searchClause.$or.some((item) => {
    const entry = item?.code?.$containsi || item?.name?.$containsi || ''
    return values.some((value) => value.includes(String(entry).toLowerCase()))
  })
}

function installVenueRoomCopyMock(options = {}) {
  const venues = (options.venues || [createVenue(), createVenue({ id: 12, documentId: 'venue-doc-12', code: 'V02', name: 'Co so 2' })]).map((row) => ({ ...row }))
  const rooms = (options.rooms || [
    createRoom({ id: 21, documentId: 'room-doc-21', code: 'R01', examVenue: venues[0] }),
    createRoom({ id: 22, documentId: 'room-doc-22', code: 'R02', examVenue: venues[0] }),
    createRoom({ id: 23, documentId: 'room-doc-23', code: 'R03', examVenue: venues[1] }),
  ]).map((row) => ({ ...row }))
  const rounds = new Map((options.rounds || []).map((row) => [Number(row.id), { ...row }]))
  const roundUpdates = []

  function resolveVenue(id) {
    return venues.find((row) => Number(row.id) === Number(id)) || null
  }

  function resolveRoom(id) {
    const row = rooms.find((item) => Number(item.id) === Number(id)) || null
    if (!row) return null
    return { ...row, examVenue: resolveVenue(row.examVenue?.id || row.examVenue) || row.examVenue }
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
              const ids = collectIdValues(params?.where)
              const excludedId = params?.where?.$and?.find?.((item) => item?.id?.$ne)?.id?.$ne
              let row = null
              if (ids.length > 0) row = rounds.get(Number(ids[0])) || null
              if (!row) return null
              if (excludedId && Number(row.id) === Number(excludedId)) return null
              return {
                ...row,
                examVenues: (row.examVenues || []).map((item) => resolveVenue(item?.id || item)).filter(Boolean),
                examRooms: (row.examRooms || []).map((item) => resolveRoom(item?.id || item)).filter(Boolean),
              }
            },
            async findMany(params) {
              const excludedId = params?.where?.$and?.find?.((item) => item?.id?.$ne)?.id?.$ne
              return Array.from(rounds.values())
                .filter((row) => Number(row.id) !== Number(excludedId || 0))
                .filter((row) => matchesSearch(row, params?.where))
                .map((row) => ({
                  ...row,
                  examVenues: (row.examVenues || []).map((item) => resolveVenue(item?.id || item)).filter(Boolean),
                  examRooms: (row.examRooms || []).map((item) => resolveRoom(item?.id || item)).filter(Boolean),
                }))
            },
            async update(params) {
              roundUpdates.push(params)
              const row = rounds.get(Number(params?.where?.id || 0))
              if (!row) return null
              row.examVenues = (params?.data?.examVenues || []).map((id) => resolveVenue(id)).filter(Boolean)
              row.examRooms = (params?.data?.examRooms || []).map((id) => resolveRoom(id)).filter(Boolean)
              return { id: row.id }
            },
          }
        }

        if (uid === 'api::exam-venue.exam-venue') {
          return {
            async findMany() {
              return venues.map((row) => ({ ...row }))
            },
            async findOne(params) {
              const ids = collectIdValues(params?.where)
              return resolveVenue(ids[0])
            },
          }
        }

        if (uid === 'api::exam-room.exam-room') {
          return {
            async findMany() {
              return rooms.map((row) => ({ ...resolveRoom(row.id) }))
            },
            async findOne(params) {
              const ids = collectIdValues(params?.where)
              return resolveRoom(ids[0])
            },
          }
        }

        if (uid === 'api::exam-schedule.exam-schedule') {
          return {
            async findMany() { return [] },
          }
        }

        throw new Error(`Unexpected uid ${uid}`)
      },
    },
  }

  return { roundUpdates, rounds }
}

test('copy preview lists only source rounds with venue room configuration', async () => {
  const service = loadService()
  installVenueRoomCopyMock({
    rounds: [
      createRound({ id: 101, code: 'TARGET' }),
      createRound({ id: 102, code: 'SRC1', examVenues: [createVenue({ id: 11 })], examRooms: [createRoom({ id: 21, examVenue: createVenue({ id: 11 }) })] }),
      createRound({ id: 103, code: 'EMPTY', examVenues: [], examRooms: [] }),
    ],
  })

  const result = await service.listExamRoundVenueRoomCopySources(91, 101, { search: 'SRC' })
  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].code, 'SRC1')
  assert.equal(result.data[0].venueCount, 1)
  assert.equal(result.data[0].roomCount, 1)
})

test('copy preview shows merge plan and skips existing target room', async () => {
  const service = loadService()
  installVenueRoomCopyMock({
    rounds: [
      createRound({ id: 101, code: 'TARGET', examVenues: [createVenue({ id: 11 })], examRooms: [createRoom({ id: 21, examVenue: createVenue({ id: 11 }) })] }),
      createRound({ id: 102, code: 'SRC', examVenues: [createVenue({ id: 11 }), createVenue({ id: 12 })], examRooms: [createRoom({ id: 21, examVenue: createVenue({ id: 11 }) }), createRoom({ id: 23, examVenue: createVenue({ id: 12 }) })] }),
    ],
  })

  const preview = await service.previewExamRoundVenueRoomCopy(91, 101, 102)
  assert.equal(preview.summary.addedVenues, 1)
  assert.equal(preview.summary.addedRooms, 1)
  assert.equal(preview.summary.skippedRooms, 1)
  assert.equal(preview.rooms.find((item) => item.id === 21)?.action, 'SKIP')
  assert.equal(preview.rooms.find((item) => item.id === 23)?.action, 'ADD')
})

test('copy merge adds source venue and room without removing target configuration', async () => {
  const service = loadService()
  const { roundUpdates, rounds } = installVenueRoomCopyMock({
    rounds: [
      createRound({ id: 101, code: 'TARGET', examVenues: [createVenue({ id: 11 })], examRooms: [createRoom({ id: 21, examVenue: createVenue({ id: 11 }) })] }),
      createRound({ id: 102, code: 'SRC', examVenues: [createVenue({ id: 12 })], examRooms: [createRoom({ id: 23, examVenue: createVenue({ id: 12 }) })] }),
    ],
  })

  const result = await service.copyExamRoundVenueRoomConfiguration(91, 101, { sourceRoundId: 102 }, { id: 5 })
  assert.equal(result.summary.addedVenues, 1)
  assert.equal(result.summary.addedRooms, 1)
  assert.equal(roundUpdates.length, 1)
  assert.deepEqual(roundUpdates[0].data.examVenues, [11, 12])
  assert.deepEqual(roundUpdates[0].data.examRooms, [21, 23])
  assert.equal((rounds.get(101)?.examVenues || []).length, 2)
  assert.equal((rounds.get(101)?.examRooms || []).length, 2)
})

test('copy preview skips inactive room and inactive venue with warnings', async () => {
  const service = loadService()
  const inactiveVenue = createVenue({ id: 11, isActive: false })
  const activeVenue = createVenue({ id: 12, isActive: true })
  installVenueRoomCopyMock({
    venues: [inactiveVenue, activeVenue],
    rooms: [
      createRoom({ id: 21, examVenue: inactiveVenue, isActive: true }),
      createRoom({ id: 23, examVenue: activeVenue, isActive: false }),
    ],
    rounds: [
      createRound({ id: 101, code: 'TARGET' }),
      createRound({
        id: 102,
        code: 'SRC',
        examVenues: [inactiveVenue, activeVenue],
        examRooms: [createRoom({ id: 21, examVenue: inactiveVenue, isActive: true }), createRoom({ id: 23, examVenue: activeVenue, isActive: false })],
      }),
    ],
  })

  const preview = await service.previewExamRoundVenueRoomCopy(91, 101, 102)
  assert.match(preview.warnings.map((item) => item.code).join(' | '), /INACTIVE_VENUE_SKIPPED/)
  assert.match(preview.warnings.map((item) => item.code).join(' | '), /INACTIVE_ROOM_SKIPPED/)
  assert.equal(preview.venues.find((item) => item.id === 11)?.action, 'WARNING')
  assert.equal(preview.rooms.find((item) => item.id === 21)?.action, 'WARNING')
  assert.equal(preview.rooms.find((item) => item.id === 23)?.action, 'WARNING')
})

test('copy rejects using current round as source', async () => {
  const service = loadService()
  installVenueRoomCopyMock({
    rounds: [createRound({ id: 101, examVenues: [createVenue({ id: 11 })], examRooms: [createRoom({ id: 21, examVenue: createVenue({ id: 11 }) })] })],
  })

  await assert.rejects(
    () => service.copyExamRoundVenueRoomConfiguration(91, 101, { sourceRoundId: 101 }, { id: 5 }),
    (error) => error && error.status === 409 && error.code === 'EXAM_ROUND_COPY_SOURCE_SAME_AS_TARGET',
  )
})

test('copy rejects source round without configuration or outside tenant scope', async () => {
  const service = loadService()
  installVenueRoomCopyMock({
    rounds: [
      createRound({ id: 101, code: 'TARGET' }),
      createRound({ id: 102, code: 'EMPTY', examVenues: [], examRooms: [] }),
    ],
  })

  await assert.rejects(
    () => service.previewExamRoundVenueRoomCopy(91, 101, 102),
    (error) => error && error.status === 409 && error.code === 'EXAM_ROUND_COPY_SOURCE_EMPTY_CONFIGURATION',
  )

  await assert.rejects(
    () => service.previewExamRoundVenueRoomCopy(91, 101, 999),
    (error) => error && error.status === 404 && error.code === 'EXAM_ROUND_COPY_SOURCE_NOT_FOUND',
  )
})