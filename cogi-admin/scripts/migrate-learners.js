const fs = require('fs')
const path = require('path')
const { MongoClient, ObjectId } = require('mongodb')
const { Pool } = require('pg')
const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcryptjs')

const ENV_FILE_PATH = path.resolve(__dirname, '..', '.env')
const MONGO_DATABASE_NAME = 'vtf'
const MONGO_COLLECTION_NAME = 'debts'
const MONGO_USER_COLLECTION_NAME = 'users'
const DEFAULT_TEMP_PASSWORD = 'A123456a@'
const DEFAULT_TENANT_ID = 1

function log(message, payload) {
  const timestamp = new Date().toISOString()

  if (payload === undefined) {
    console.log(`[${timestamp}] ${message}`)
    return
  }

  console.log(`[${timestamp}] ${message}`, payload)
}

function warn(message, payload) {
  const timestamp = new Date().toISOString()

  if (payload === undefined) {
    console.warn(`[${timestamp}] ${message}`)
    return
  }

  console.warn(`[${timestamp}] ${message}`, payload)
}

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE_PATH)) return

  const content = fs.readFileSync(ENV_FILE_PATH, 'utf8')
  const lines = content.split(/\r?\n/)

  lines.forEach((line) => {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) return

    const separatorIndex = trimmedLine.indexOf('=')
    if (separatorIndex <= 0) return

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim()
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) return

    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
  })
}

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value && String(value).trim()) return String(value).trim()
  }

  return ''
}

function requireEnv(...names) {
  const value = getEnv(...names)
  if (!value) {
    throw new Error(`Missing required environment variable: ${names.join(' or ')}`)
  }
  return value
}

function getOptionalNumberEnv(...names) {
  const value = getEnv(...names)
  if (!value) return null

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function createMongoClient() {
  return new MongoClient(requireEnv('MONGO_URI'))
}

function createPostgresPool() {
  return new Pool({
    host: requireEnv('PG_HOST', 'DATABASE_HOST'),
    port: Number.parseInt(requireEnv('PG_PORT', 'DATABASE_PORT'), 10),
    database: requireEnv('PG_DATABASE', 'DATABASE_NAME'),
    user: requireEnv('PG_USER', 'DATABASE_USERNAME'),
    password: requireEnv('PG_PASSWORD', 'DATABASE_PASSWORD'),
  })
}

function normalizeMongoId(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toObjectIdIfPossible(value) {
  const normalized = normalizeMongoId(value)
  if (!normalized || !ObjectId.isValid(normalized)) return null
  return new ObjectId(normalized)
}

function buildMongoUserMap(users) {
  const result = new Map()

  for (const user of users || []) {
    const objectIdKey = normalizeMongoId(user?._id)
    if (!objectIdKey) continue

    result.set(objectIdKey, {
      userName: String(user?.username || user?.userName || '').trim(),
      fullName: String(user?.fullName || '').trim(),
    })
  }

  return result
}

async function fetchUniqueUsersFromMongo(database, collection) {
  const rows = await collection.aggregate([
    {
      $addFields: {
        normalizedUserName: {
          $trim: {
            input: { $ifNull: ['$userName', ''] },
          },
        },
        normalizedFullName: {
          $trim: {
            input: { $ifNull: ['$fullName', ''] },
          },
        },
      },
    },
    {
      $addFields: {
        hasUserName: {
          $cond: [{ $ne: ['$normalizedUserName', ''] }, 1, 0],
        },
        hasFullName: {
          $cond: [{ $ne: ['$normalizedFullName', ''] }, 1, 0],
        },
      },
    },
    {
      $sort: {
        hasUserName: -1,
        hasFullName: -1,
        _id: 1,
      },
    },
    {
      $group: {
        _id: '$userId',
        userName: { $first: '$normalizedUserName' },
        fullName: { $first: '$normalizedFullName' },
      },
    },
  ]).toArray()

  const userCollection = database.collection(MONGO_USER_COLLECTION_NAME)
  const objectIds = []

  for (const row of rows) {
    const objectId = toObjectIdIfPossible(row?._id)
    if (objectId) objectIds.push(objectId)
  }

  const users = objectIds.length > 0
    ? await userCollection.find({ _id: { $in: objectIds } }, { projection: { username: 1, userName: 1, fullName: 1 } }).toArray()
    : []
  const userMap = buildMongoUserMap(users)

  return rows.map((row) => ({
    oldUserId: normalizeMongoId(row?._id),
    code: userMap.get(normalizeMongoId(row?._id))?.userName || String(row?.userName || '').trim(),
    fullName: userMap.get(normalizeMongoId(row?._id))?.fullName || String(row?.fullName || '').trim(),
  }))
}

async function getLearnerTableColumns(pool) {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'learners'
    `
  )

  return new Set(result.rows.map((row) => row.column_name))
}

async function getTableColumns(pool, tableName) {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  )

  return new Set(result.rows.map((row) => row.column_name))
}

function buildFallbackEmail(code) {
  const normalized = String(code || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
  return `${normalized || `learner-${Date.now()}`}@migration.local`
}

async function findExistingUser(pool, learner, userColumns) {
  const conditions = []
  const values = []

  if (learner.code && userColumns.has('username')) {
    values.push(learner.code)
    conditions.push(`LOWER(username) = LOWER($${values.length})`)
  }

  if (learner.email && userColumns.has('email')) {
    values.push(learner.email)
    conditions.push(`LOWER(email) = LOWER($${values.length})`)
  }

  if (conditions.length === 0) return null

  const result = await pool.query(
    `SELECT id FROM up_users WHERE ${conditions.join(' OR ')} LIMIT 1`,
    values
  )

  return result.rows[0] || null
}

async function createUserIfNotExists(pool, learner, options) {
  const { userColumns, tempPassword } = options
  const existingUser = await findExistingUser(pool, learner, userColumns)
  if (existingUser?.id) {
    return existingUser.id
  }

  const hashedPassword = await bcrypt.hash(tempPassword, 10)
  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  if (userColumns.has('username')) pushColumn('username', learner.code)
  if (userColumns.has('email')) pushColumn('email', learner.email)
  if (userColumns.has('full_name')) pushColumn('full_name', learner.fullName || learner.code)
  if (userColumns.has('provider')) pushColumn('provider', 'local')
  if (userColumns.has('password')) pushColumn('password', hashedPassword)
  if (userColumns.has('confirmed')) pushColumn('confirmed', true)
  if (userColumns.has('blocked')) pushColumn('blocked', false)
  if (userColumns.has('created_at')) pushColumn('created_at', new Date())
  if (userColumns.has('updated_at')) pushColumn('updated_at', new Date())

  const result = await pool.query(
    `INSERT INTO up_users (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues
  )

  return result.rows[0]?.id || null
}

async function ensureUserTenantMembership(pool, userId, options) {
  const { tenantId, userTenantColumns } = options
  if (!userTenantColumns || userTenantColumns.size === 0 || !tenantId) {
    return null
  }

  const existing = await pool.query(
    'SELECT id FROM user_tenants WHERE user_id = $1 AND tenant_id = $2 LIMIT 1',
    [userId, tenantId]
  )

  if (existing.rowCount > 0) {
    return existing.rows[0].id
  }

  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  pushColumn('user_id', userId)
  pushColumn('tenant_id', tenantId)
  if (userTenantColumns.has('user_tenant_status')) pushColumn('user_tenant_status', 'active')
  if (userTenantColumns.has('joined_at')) pushColumn('joined_at', new Date())
  if (userTenantColumns.has('is_default')) pushColumn('is_default', false)
  if (userTenantColumns.has('created_at')) pushColumn('created_at', new Date())
  if (userTenantColumns.has('updated_at')) pushColumn('updated_at', new Date())
  if (userTenantColumns.has('document_id')) pushColumn('document_id', uuidv4())

  const result = await pool.query(
    `INSERT INTO user_tenants (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues
  )

  return result.rows[0]?.id || null
}

async function findExistingLearner(pool, learner, columns) {
  const conditions = []
  const values = []

  if (learner.code && columns.has('code')) {
    values.push(learner.code)
    conditions.push(`code = $${values.length}`)
  }

  if (learner.oldUserId && columns.has('old_user_id')) {
    values.push(learner.oldUserId)
    conditions.push(`old_user_id = $${values.length}`)
  }

  if (conditions.length === 0) return null

  const result = await pool.query(
    `SELECT id FROM learners WHERE ${conditions.join(' OR ')} LIMIT 1`,
    values
  )

  return result.rows[0] || null
}

async function createLearnerIfNotExists(pool, learner, options) {
  const { columns, tenantId, mapping, userId } = options
  const existing = await findExistingLearner(pool, learner, columns)

  if (existing?.id) {
    if (learner.oldUserId) mapping[learner.oldUserId] = existing.id
    log(`[SKIP] learner: ${learner.code}`)
    return 'skipped'
  }

  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  if (columns.has('document_id')) {
    pushColumn('document_id', uuidv4())
  }

  if (columns.has('code')) {
    pushColumn('code', learner.code)
  }

  if (columns.has('full_name')) {
    pushColumn('full_name', learner.fullName || learner.code)
  }

  if (columns.has('old_user_id')) {
    pushColumn('old_user_id', learner.oldUserId)
  }

  if (columns.has('user_id') && userId) {
    pushColumn('user_id', userId)
  }

  if (columns.has('status')) {
    pushColumn('status', 'active')
  }

  if (columns.has('tenant_id')) {
    if (!tenantId) {
      throw new Error('Missing required environment variable: MIGRATION_TENANT_ID for learners.tenant_id')
    }
    pushColumn('tenant_id', tenantId)
  }

  if (columns.has('created_at')) {
    pushColumn('created_at', new Date())
  }

  if (columns.has('updated_at')) {
    pushColumn('updated_at', new Date())
  }

  const result = await pool.query(
    `
      INSERT INTO learners (${insertColumns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING id
    `,
    insertValues
  )

  const learnerId = result.rows[0]?.id || null
  if (learner.oldUserId && learnerId) mapping[learner.oldUserId] = learnerId
  log(`[CREATE] learner: ${learner.code}`)
  return 'created'
}

async function main() {
  const startedAt = Date.now()
  loadEnvFile()

  const mongoClient = createMongoClient()
  const pgPool = createPostgresPool()
  const mapping = {}

  let createdCount = 0
  let skippedCount = 0
  let invalidCount = 0
  const tenantId = getOptionalNumberEnv('MIGRATION_TENANT_ID') || DEFAULT_TENANT_ID
  const tempPassword = getEnv('MIGRATION_TEMP_PASSWORD') || DEFAULT_TEMP_PASSWORD

  try {
    await mongoClient.connect()
    log('Mongo connected')

    const mongoDatabase = mongoClient.db(MONGO_DATABASE_NAME)
    const debtsCollection = mongoDatabase.collection(MONGO_COLLECTION_NAME)
    const uniqueUsers = await fetchUniqueUsersFromMongo(mongoDatabase, debtsCollection)
    log(`Found ${uniqueUsers.length} grouped users from debts.userId`)

    await pgPool.query('SELECT NOW()')
    log('Postgres connected')

    const learnerTableColumns = await getLearnerTableColumns(pgPool)
    log('Detected learners columns:', Array.from(learnerTableColumns).sort())
    const userTableColumns = await getTableColumns(pgPool, 'up_users')
    const userTenantColumns = await getTableColumns(pgPool, 'user_tenants')
    log('Detected up_users columns:', Array.from(userTableColumns).sort())
    if (userTenantColumns.size > 0) {
      log('Detected user_tenants columns:', Array.from(userTenantColumns).sort())
    }

    if (!learnerTableColumns.has('code')) {
      throw new Error('The learners table does not have the expected code column')
    }

    if (!learnerTableColumns.has('old_user_id')) {
      throw new Error('The learners table does not have old_user_id yet. Update the learner schema and sync the database first.')
    }

    for (const learner of uniqueUsers) {
      if (!learner.oldUserId) {
        invalidCount += 1
        warn('[WARN] Missing userId, skipped learner row')
        continue
      }

      if (!learner.code) {
        invalidCount += 1
        warn(`[WARN] Missing username/userName for old user ${learner.oldUserId}, skipped learner row`)
        continue
      }

      const normalizedLearner = {
        oldUserId: learner.oldUserId,
        code: learner.code,
        fullName: learner.fullName || learner.code,
        email: buildFallbackEmail(learner.code),
      }

      const userId = await createUserIfNotExists(pgPool, normalizedLearner, {
        userColumns: userTableColumns,
        tempPassword,
      })

      if (userId && userTenantColumns.has('user_id') && userTenantColumns.has('tenant_id')) {
        await ensureUserTenantMembership(pgPool, userId, {
          tenantId,
          userTenantColumns,
        })
      }

      const result = await createLearnerIfNotExists(pgPool, normalizedLearner, {
        columns: learnerTableColumns,
        tenantId,
        mapping,
        userId,
      })

      if (result === 'created') createdCount += 1
      else skippedCount += 1
    }

    log(`Total learners created: ${createdCount}`)
    log(`Total learners skipped: ${skippedCount}`)
    log(`Total invalid rows skipped: ${invalidCount}`)
    log(`Mapping entries created: ${Object.keys(mapping).length}`)
    log(`Migration finished in ${Date.now() - startedAt}ms`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Learner migration failed:`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await mongoClient.close().catch(() => undefined)
    await pgPool.end().catch(() => undefined)
    log('Connections closed')
  }
}

main()