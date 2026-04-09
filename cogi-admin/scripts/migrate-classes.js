const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')
const { Pool } = require('pg')
const { v4: uuidv4 } = require('uuid')

const ENV_FILE_PATH = path.resolve(__dirname, '..', '.env')
const MAPPING_OUTPUT_FILE_PATH = path.resolve(__dirname, 'migrate-classes.mapping.json')
const DEFAULT_MONGO_DATABASE_NAME = 'vtf'
const CLASS_COLLECTION_NAME = 'classes'
const ENROLLMENT_COLLECTION_NAME = 'enrollments'
const DEBT_COLLECTION_NAME = 'debts'
const DEFAULT_TENANT_ID = 1
const SUBJECT_PREFIXES = ['TOAN', 'VAN', 'ANH']

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

function normalizeClassName(value) {
  return String(value || '').trim()
}

function normalizeItemCode(value) {
  return String(value || '').trim().toUpperCase()
}

function createMappingKey(mongoClassId, itemCode) {
  return `${mongoClassId}_${itemCode}`
}

function extractSubjectPrefix(itemCode) {
  const normalized = normalizeItemCode(itemCode)
  if (!normalized) return null

  const exactPrefix = SUBJECT_PREFIXES.find((prefix) => normalized.startsWith(prefix))
  if (exactPrefix) return exactPrefix

  const alphaPrefix = normalized.match(/^[A-Z]+/)
  return alphaPrefix ? alphaPrefix[0] : null
}

function writeMappingFile(mapping) {
  fs.writeFileSync(MAPPING_OUTPUT_FILE_PATH, JSON.stringify(mapping, null, 2), 'utf8')
}

async function fetchClassesFromMongo(collection) {
  const rows = await collection.find({}, { projection: { name: 1 } }).toArray()

  return rows.map((row) => ({
    mongoClassId: normalizeMongoId(row?._id),
    name: normalizeClassName(row?.name),
  }))
}

async function buildUsersByClassMap(collection) {
  const rows = await collection.find({}, { projection: { classId: 1, userId: 1 } }).toArray()
  const usersByClassId = new Map()

  rows.forEach((row) => {
    const classId = normalizeMongoId(row?.classId)
    const userId = normalizeMongoId(row?.userId)

    if (!classId || !userId) return

    if (!usersByClassId.has(classId)) {
      usersByClassId.set(classId, new Set())
    }

    usersByClassId.get(classId).add(userId)
  })

  return usersByClassId
}

async function buildItemCodesByUserMap(collection) {
  const rows = await collection.find({}, { projection: { userId: 1, itemCode: 1 } }).toArray()
  const itemCodesByUserId = new Map()

  rows.forEach((row) => {
    const userId = normalizeMongoId(row?.userId)
    const itemCode = normalizeItemCode(row?.itemCode)

    if (!userId || !itemCode) return

    if (!itemCodesByUserId.has(userId)) {
      itemCodesByUserId.set(userId, new Set())
    }

    itemCodesByUserId.get(userId).add(itemCode)
  })

  return itemCodesByUserId
}

function collectClassItemCodes(mongoClassId, usersByClassId, itemCodesByUserId) {
  const userIds = usersByClassId.get(mongoClassId) || new Set()
  const itemCodes = new Set()

  userIds.forEach((userId) => {
    const userItemCodes = itemCodesByUserId.get(userId)
    if (!userItemCodes) return

    userItemCodes.forEach((itemCode) => {
      if (itemCode) itemCodes.add(itemCode)
    })
  })

  return {
    userIds,
    itemCodes,
  }
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

async function findExistingClass(pool, className) {
  const result = await pool.query(
    'SELECT id FROM classes WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [className]
  )

  return result.rows[0]?.id || null
}

async function ensureClassTenantLink(pool, classId, tenantId, linkColumns) {
  const existing = await pool.query(
    'SELECT 1 FROM classes_tenant_lnk WHERE class_id = $1 AND tenant_id = $2 LIMIT 1',
    [classId, tenantId]
  )

  if (existing.rowCount > 0) {
    return
  }

  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  pushColumn('class_id', classId)
  pushColumn('tenant_id', tenantId)
  if (linkColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (linkColumns.has('created_at')) pushColumn('created_at', new Date())
  if (linkColumns.has('updated_at')) pushColumn('updated_at', new Date())

  await pool.query(
    `INSERT INTO classes_tenant_lnk (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    insertValues
  )
}

async function createClassIfNotExists(pool, payload, options) {
  const { classColumns, classTenantLinkColumns, tenantId, mapping } = options
  const { mongoClassId, classCode, itemCode } = payload
  const existingClassId = await findExistingClass(pool, classCode)

  function assignMapping(classId) {
    mapping[createMappingKey(mongoClassId, itemCode)] = classId
  }

  if (existingClassId) {
    assignMapping(existingClassId)
    log(`[SKIP] exists ${classCode}`)
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

  if (classColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (classColumns.has('name')) pushColumn('name', classCode)
  if (classColumns.has('subject')) pushColumn('subject', extractSubjectPrefix(itemCode))
  if (classColumns.has('subject_code')) pushColumn('subject_code', itemCode)
  if (classColumns.has('status')) pushColumn('status', 'active')
  if (classColumns.has('created_at')) pushColumn('created_at', new Date())
  if (classColumns.has('updated_at')) pushColumn('updated_at', new Date())

  const result = await pool.query(
    `INSERT INTO classes (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues
  )

  const newClassId = result.rows[0]?.id || null
  if (!newClassId) {
    throw new Error(`Failed to create class for Mongo class ${mongoClassId} and itemCode ${itemCode}`)
  }

  await ensureClassTenantLink(pool, newClassId, tenantId, classTenantLinkColumns)
  assignMapping(newClassId)
  log(`[CREATE] ${classCode}`)
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

  try {
    await mongoClient.connect()
    log('Mongo connected')

    const mongoDatabaseName = getMongoDatabaseName()
    const mongoDatabase = mongoClient.db(mongoDatabaseName)
    const classCollection = mongoDatabase.collection(CLASS_COLLECTION_NAME)
    const enrollmentCollection = mongoDatabase.collection(ENROLLMENT_COLLECTION_NAME)
    const debtCollection = mongoDatabase.collection(DEBT_COLLECTION_NAME)
    const mongoClasses = await fetchClassesFromMongo(classCollection)
    const usersByClassId = await buildUsersByClassMap(enrollmentCollection)
    const itemCodesByUserId = await buildItemCodesByUserMap(debtCollection)
    log(`Using Mongo database: ${mongoDatabaseName}`)
    log(`Found ${mongoClasses.length} classes from Mongo collection ${CLASS_COLLECTION_NAME}`)
    log(`Found ${usersByClassId.size} class-user groups from Mongo collection ${ENROLLMENT_COLLECTION_NAME}`)
    log(`Found ${itemCodesByUserId.size} users with debts from Mongo collection ${DEBT_COLLECTION_NAME}`)

    await pgPool.query('SELECT NOW()')
    log('Postgres connected')

    const classColumns = await getTableColumns(pgPool, 'classes')
    const classTenantLinkColumns = await getTableColumns(pgPool, 'classes_tenant_lnk')
    log('Detected classes columns:', Array.from(classColumns).sort())
    log('Detected classes_tenant_lnk columns:', Array.from(classTenantLinkColumns).sort())

    if (!classColumns.has('name')) {
      throw new Error('The classes table does not have the expected name column')
    }

    if (!classTenantLinkColumns.has('class_id') || !classTenantLinkColumns.has('tenant_id')) {
      throw new Error('The classes_tenant_lnk table does not have class_id/tenant_id as expected')
    }

    for (const mongoClass of mongoClasses) {
      if (!mongoClass.mongoClassId) {
        invalidCount += 1
        warn('[WARN] Missing Mongo class _id, skipped row')
        continue
      }

      if (!mongoClass.name) {
        invalidCount += 1
        warn(`[WARN] Missing class name for Mongo class ${mongoClass.mongoClassId}, skipped row`)
        continue
      }
      const { itemCodes } = collectClassItemCodes(mongoClass.mongoClassId, usersByClassId, itemCodesByUserId)

      if (itemCodes.size === 0) {
        invalidCount += 1
        warn(`[WARN] No itemCode found for Mongo class ${mongoClass.mongoClassId} (${mongoClass.name}), skipped row`)
        continue
      }

      for (const itemCode of itemCodes) {
        if (!itemCode) {
          invalidCount += 1
          warn(`[WARN] Empty itemCode found for Mongo class ${mongoClass.mongoClassId}, skipped itemCode`)
          continue
        }

        const classCode = `${mongoClass.name}-${itemCode}`
        const result = await createClassIfNotExists(pgPool, {
          mongoClassId: mongoClass.mongoClassId,
          classCode,
          itemCode,
        }, {
        classColumns,
        classTenantLinkColumns,
        tenantId,
        mapping,
        })

        if (result === 'created') createdCount += 1
        else skippedCount += 1
      }
    }

    log(`Total classes created: ${createdCount}`)
    log(`Total classes skipped: ${skippedCount}`)
    log(`Total invalid rows skipped: ${invalidCount}`)
    log(`Mapping entries created: ${Object.keys(mapping).length}`)
    writeMappingFile(mapping)
    log(`Mapping file written: ${MAPPING_OUTPUT_FILE_PATH}`)
    log(`Migration finished in ${Date.now() - startedAt}ms`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Class migration failed:`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await mongoClient.close().catch(() => undefined)
    await pgPool.end().catch(() => undefined)
    log('Connections closed')
  }
}

main()