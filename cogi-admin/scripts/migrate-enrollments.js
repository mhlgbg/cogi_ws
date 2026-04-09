const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')
const { Pool } = require('pg')
const { v4: uuidv4 } = require('uuid')

const ENV_FILE_PATH = path.resolve(__dirname, '..', '.env')
const CLASS_MAPPING_FILE_PATH = path.resolve(__dirname, 'migrate-classes.mapping.json')
const DEFAULT_MONGO_DATABASE_NAME = 'vtf'
const ENROLLMENT_COLLECTION_NAME = 'enrollments'
const DEBT_COLLECTION_NAME = 'debts'
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

function getMongoDatabaseName() {
  return getEnv('MIGRATION_MONGO_DB', 'MONGO_DATABASE_NAME') || DEFAULT_MONGO_DATABASE_NAME
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

function normalizeItemCode(value) {
  return String(value || '').trim().toUpperCase()
}

function createMappingKey(mongoClassId, itemCode) {
  return `${mongoClassId}_${itemCode}`
}

function loadClassMapping() {
  if (!fs.existsSync(CLASS_MAPPING_FILE_PATH)) {
    throw new Error(`Class mapping file not found: ${CLASS_MAPPING_FILE_PATH}`)
  }

  const content = fs.readFileSync(CLASS_MAPPING_FILE_PATH, 'utf8')
  const parsed = JSON.parse(content)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid class mapping file content: ${CLASS_MAPPING_FILE_PATH}`)
  }

  return parsed
}

async function loadEnrollmentMap(collection) {
  const rows = await collection.find({}, { projection: { userId: 1, classId: 1 } }).toArray()
  const enrollmentMap = new Map()

  rows.forEach((row) => {
    const userId = normalizeMongoId(row?.userId)
    const mongoClassId = normalizeMongoId(row?.classId)
    if (!userId || !mongoClassId) return

    if (!enrollmentMap.has(userId)) {
      enrollmentMap.set(userId, mongoClassId)
      return
    }

    const existingClassId = enrollmentMap.get(userId)
    if (existingClassId !== mongoClassId) {
      throw new Error(`User ${userId} belongs to multiple Mongo classes: ${existingClassId} and ${mongoClassId}`)
    }
  })

  return enrollmentMap
}

async function loadDebts(collection) {
  const rows = await collection.find({}, { projection: { userId: 1, itemCode: 1 } }).toArray()
  const uniquePairs = new Map()

  rows.forEach((row) => {
    const userId = normalizeMongoId(row?.userId)
    const itemCode = normalizeItemCode(row?.itemCode)
    if (!userId || !itemCode) return

    const key = `${userId}_${itemCode}`
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, { userId, itemCode })
    }
  })

  return Array.from(uniquePairs.values())
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

async function getEnrollmentStorage(pool) {
  const enrollmentColumns = await getTableColumns(pool, 'enrollments')
  const learnerLinkColumns = await getTableColumns(pool, 'enrollments_learner_lnk')
  const classLinkColumns = await getTableColumns(pool, 'enrollments_class_lnk')
  const tenantLinkColumns = await getTableColumns(pool, 'enrollments_tenant_lnk')

  return {
    enrollmentColumns,
    learnerLinkColumns,
    classLinkColumns,
    tenantLinkColumns,
  }
}

async function getLearnerId(pool, oldUserId, learnerColumns) {
  if (!oldUserId) return null
  if (!learnerColumns.has('old_user_id')) {
    throw new Error('The learners table does not have old_user_id')
  }

  const result = await pool.query(
    'SELECT id FROM learners WHERE old_user_id = $1 LIMIT 1',
    [oldUserId]
  )

  return result.rows[0]?.id || null
}

function getClassIdFromMapping(classMapping, mongoClassId, itemCode) {
  const key = createMappingKey(mongoClassId, itemCode)
  return classMapping[key] || null
}

async function findExistingEnrollment(pool, payload) {
  const result = await pool.query(
    `
      SELECT e.id
      FROM enrollments e
      INNER JOIN enrollments_learner_lnk learner_link
        ON learner_link.enrollment_id = e.id
      INNER JOIN enrollments_class_lnk class_link
        ON class_link.enrollment_id = e.id
      WHERE learner_link.learner_id = $1
        AND class_link.class_id = $2
      LIMIT 1
    `,
    [payload.learnerId, payload.classId]
  )

  return result.rows[0]?.id || null
}

async function insertLinkRow(pool, tableName, linkColumns, targetColumn, enrollmentId, targetId) {
  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  pushColumn('enrollment_id', enrollmentId)
  pushColumn(targetColumn, targetId)
  if (linkColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (linkColumns.has('created_at')) pushColumn('created_at', new Date())
  if (linkColumns.has('updated_at')) pushColumn('updated_at', new Date())

  await pool.query(
    `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    insertValues
  )
}

async function insertEnrollmentBaseRow(pool, enrollmentColumns) {
  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  if (enrollmentColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (enrollmentColumns.has('status')) pushColumn('status', 'active')
  if (enrollmentColumns.has('created_at')) pushColumn('created_at', new Date())
  if (enrollmentColumns.has('updated_at')) pushColumn('updated_at', new Date())

  const result = await pool.query(
    `INSERT INTO enrollments (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues
  )

  return result.rows[0]?.id || null
}

async function createEnrollmentIfNotExists(pool, payload, options) {
  const { enrollmentColumns, learnerLinkColumns, classLinkColumns, tenantLinkColumns, tenantId } = options
  const existingEnrollmentId = await findExistingEnrollment(pool, payload)

  if (existingEnrollmentId) {
    log(`[SKIP] exists learner ${payload.oldUserId} -> class ${payload.className}`)
    return 'skipped'
  }

  const enrollmentId = await insertEnrollmentBaseRow(pool, enrollmentColumns)
  if (!enrollmentId) {
    throw new Error(`Failed to create enrollment row for learner ${payload.oldUserId} and class ${payload.className}`)
  }

  await insertLinkRow(pool, 'enrollments_learner_lnk', learnerLinkColumns, 'learner_id', enrollmentId, payload.learnerId)
  await insertLinkRow(pool, 'enrollments_class_lnk', classLinkColumns, 'class_id', enrollmentId, payload.classId)
  await insertLinkRow(pool, 'enrollments_tenant_lnk', tenantLinkColumns, 'tenant_id', enrollmentId, tenantId)

  log(`[CREATE] learner ${payload.oldUserId} -> class ${payload.className}`)
  return 'created'
}

async function getClassName(pool, classId) {
  const result = await pool.query('SELECT name FROM classes WHERE id = $1 LIMIT 1', [classId])
  return result.rows[0]?.name || String(classId)
}

async function main() {
  const startedAt = Date.now()
  loadEnvFile()

  const mongoClient = createMongoClient()
  const pgPool = createPostgresPool()

  let createdCount = 0
  let skippedCount = 0
  let invalidCount = 0
  const tenantId = getOptionalNumberEnv('MIGRATION_TENANT_ID') || DEFAULT_TENANT_ID
  const classMapping = loadClassMapping()
  const classNameCache = new Map()

  try {
    await mongoClient.connect()
    log('Mongo connected')

    const mongoDatabaseName = getMongoDatabaseName()
    const mongoDatabase = mongoClient.db(mongoDatabaseName)
    const enrollmentsCollection = mongoDatabase.collection(ENROLLMENT_COLLECTION_NAME)
    const debtsCollection = mongoDatabase.collection(DEBT_COLLECTION_NAME)
    const enrollmentMap = await loadEnrollmentMap(enrollmentsCollection)
    const debts = await loadDebts(debtsCollection)
    log(`Using Mongo database: ${mongoDatabaseName}`)
    log(`Found ${enrollmentMap.size} user -> mongoClassId mappings from ${ENROLLMENT_COLLECTION_NAME}`)
    log(`Found ${debts.length} unique user/itemCode pairs from ${DEBT_COLLECTION_NAME}`)
    log(`Loaded ${Object.keys(classMapping).length} class mapping entries`)

    await pgPool.query('SELECT NOW()')
    log('Postgres connected')

    const learnerColumns = await getTableColumns(pgPool, 'learners')
    const storage = await getEnrollmentStorage(pgPool)
    log('Detected learners columns:', Array.from(learnerColumns).sort())
    log('Detected enrollments columns:', Array.from(storage.enrollmentColumns).sort())
    log('Detected enrollments_learner_lnk columns:', Array.from(storage.learnerLinkColumns).sort())
    log('Detected enrollments_class_lnk columns:', Array.from(storage.classLinkColumns).sort())
    log('Detected enrollments_tenant_lnk columns:', Array.from(storage.tenantLinkColumns).sort())

    if (!storage.enrollmentColumns.size) {
      throw new Error('The enrollments table was not found or has no columns')
    }

    if (!storage.learnerLinkColumns.has('enrollment_id') || !storage.learnerLinkColumns.has('learner_id')) {
      throw new Error('The enrollments_learner_lnk table does not have enrollment_id/learner_id as expected')
    }

    if (!storage.classLinkColumns.has('enrollment_id') || !storage.classLinkColumns.has('class_id')) {
      throw new Error('The enrollments_class_lnk table does not have enrollment_id/class_id as expected')
    }

    if (!storage.tenantLinkColumns.has('enrollment_id') || !storage.tenantLinkColumns.has('tenant_id')) {
      throw new Error('The enrollments_tenant_lnk table does not have enrollment_id/tenant_id as expected')
    }

    for (const debt of debts) {
      if (!debt.userId) {
        invalidCount += 1
        warn('[WARN] Missing userId, skipped enrollment row')
        continue
      }

      if (!debt.itemCode) {
        invalidCount += 1
        warn(`[WARN] Missing itemCode skipped for user ${debt.userId}`)
        continue
      }

      const mongoClassId = enrollmentMap.get(debt.userId)
      if (!mongoClassId) {
        skippedCount += 1
        warn(`[WARN] Mongo class not found for user ${debt.userId}`)
        continue
      }

      const classId = getClassIdFromMapping(classMapping, mongoClassId, debt.itemCode)
      if (!classId) {
        skippedCount += 1
        warn(`[WARN] Class mapping not found for key ${createMappingKey(mongoClassId, debt.itemCode)}`)
        continue
      }

      const learnerId = await getLearnerId(pgPool, debt.userId, learnerColumns)
      if (!learnerId) {
        skippedCount += 1
        warn(`[WARN] Learner not found for old user ${debt.userId}`)
        continue
      }

      let className = classNameCache.get(classId)
      if (!className) {
        className = await getClassName(pgPool, classId)
        classNameCache.set(classId, className)
      }

      const result = await createEnrollmentIfNotExists(
        pgPool,
        {
          oldUserId: debt.userId,
          learnerId,
          classId,
          className,
        },
        {
          enrollmentColumns: storage.enrollmentColumns,
          learnerLinkColumns: storage.learnerLinkColumns,
          classLinkColumns: storage.classLinkColumns,
          tenantLinkColumns: storage.tenantLinkColumns,
          tenantId,
        }
      )

      if (result === 'created') createdCount += 1
      else skippedCount += 1
    }

    log(`Total enrollments created: ${createdCount}`)
    log(`Total enrollments skipped: ${skippedCount}`)
    log(`Total invalid rows skipped: ${invalidCount}`)
    log(`Migration finished in ${Date.now() - startedAt}ms`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Enrollment migration failed:`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await mongoClient.close().catch(() => undefined)
    await pgPool.end().catch(() => undefined)
    log('Connections closed')
  }
}

main()