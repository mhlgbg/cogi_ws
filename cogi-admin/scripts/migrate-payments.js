const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')
const { Pool } = require('pg')
const { v4: uuidv4 } = require('uuid')

const ENV_FILE_PATH = path.resolve(__dirname, '..', '.env')
const MAPPING_OUTPUT_FILE_PATH = path.resolve(__dirname, 'migrate-payments.mapping.json')
const DEFAULT_MONGO_DATABASE_NAME = 'vtf'
const RECEIPT_COLLECTION_NAME = 'receipts'
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

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeDateTime(value) {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function normalizePaymentMethod(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'cash') return 'cash'
  if (normalized === 'bank') return 'transfer'
  if (normalized === 'transfer') return 'transfer'
  if (normalized === 'other') return 'other'
  return 'cash'
}

function writeMappingFile(mapping) {
  fs.writeFileSync(MAPPING_OUTPUT_FILE_PATH, JSON.stringify(mapping, null, 2), 'utf8')
}

async function loadReceipts(collection) {
  const rows = await collection.find({}, {
    projection: {
      _id: 1,
      userId: 1,
      amount: 1,
      totalAmount: 1,
      paymentDate: 1,
      createdAt: 1,
      updatedAt: 1,
      method: 1,
      note: 1,
    },
  }).toArray()

  return rows.map((row) => ({
    receiptId: normalizeMongoId(row?._id),
    userId: normalizeMongoId(row?.userId),
    amount: toNumber(row?.amount ?? row?.totalAmount, 0),
    paymentDate: normalizeDateTime(row?.paymentDate ?? row?.createdAt),
    createdAt: normalizeDateTime(row?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDateTime(row?.updatedAt ?? row?.createdAt) || new Date().toISOString(),
    method: normalizePaymentMethod(row?.method),
    note: normalizeText(row?.note),
  }))
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

async function getLearnerDisplay(pool, learnerId, learnerColumns) {
  if (!learnerId) return String(learnerId || '')

  const selectColumns = ['id']
  if (learnerColumns.has('code')) selectColumns.push('code')
  if (learnerColumns.has('full_name')) selectColumns.push('full_name')

  const result = await pool.query(
    `SELECT ${selectColumns.join(', ')} FROM learners WHERE id = $1 LIMIT 1`,
    [learnerId]
  )

  const row = result.rows[0]
  return row?.full_name || row?.code || `learner ${learnerId}`
}

async function findExistingPayment(pool, payload, paymentColumns, learnerLinkColumns) {
  if (!learnerLinkColumns.has('payment_id') || !learnerLinkColumns.has('learner_id')) {
    throw new Error('The payments_learner_lnk table does not have payment_id/learner_id as expected')
  }

  const noteSql = paymentColumns.has('note')
    ? 'AND COALESCE(p.note, \'\') = $4'
    : ''

  const params = [payload.learnerId, payload.amount, payload.paymentDate]
  if (paymentColumns.has('note')) params.push(payload.note || '')

  const result = await pool.query(
    `
      SELECT p.id
      FROM payments p
      INNER JOIN payments_learner_lnk learner_link
        ON learner_link.payment_id = p.id
      WHERE learner_link.learner_id = $1
        AND COALESCE(p.amount, 0) = $2
        AND p.payment_date = $3
        ${noteSql}
      LIMIT 1
    `,
    params
  )

  return result.rows[0]?.id || null
}

async function insertLinkRow(pool, tableName, linkColumns, paymentId, targetColumn, targetId) {
  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  pushColumn('payment_id', paymentId)
  pushColumn(targetColumn, targetId)
  if (linkColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (linkColumns.has('created_at')) pushColumn('created_at', new Date())
  if (linkColumns.has('updated_at')) pushColumn('updated_at', new Date())

  await pool.query(
    `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    insertValues
  )
}

async function createPaymentIfNotExists(pool, receipt, options) {
  const {
    paymentColumns,
    learnerLinkColumns,
    tenantLinkColumns,
    tenantId,
    mapping,
    learnerColumns,
  } = options

  const learnerId = await getLearnerId(pool, receipt.userId, learnerColumns)
  if (!learnerId) {
    return { status: 'skipped-learner', learnerId: null }
  }

  const existingPaymentId = await findExistingPayment(pool, {
    learnerId,
    amount: receipt.amount,
    paymentDate: receipt.paymentDate,
    note: receipt.note,
  }, paymentColumns, learnerLinkColumns)

  if (existingPaymentId) {
    mapping[receipt.receiptId] = existingPaymentId
    return { status: 'skipped-existing', learnerId, paymentId: existingPaymentId }
  }

  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  if (paymentColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (paymentColumns.has('amount')) pushColumn('amount', receipt.amount)
  if (paymentColumns.has('payment_date')) pushColumn('payment_date', receipt.paymentDate)
  if (paymentColumns.has('method')) pushColumn('method', receipt.method)
  if (paymentColumns.has('note')) pushColumn('note', receipt.note || null)
  if (paymentColumns.has('created_at')) pushColumn('created_at', receipt.createdAt)
  if (paymentColumns.has('updated_at')) pushColumn('updated_at', receipt.updatedAt)

  const result = await pool.query(
    `INSERT INTO payments (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues
  )

  const paymentId = result.rows[0]?.id || null
  if (!paymentId) {
    throw new Error(`Failed to create payment for receipt ${receipt.receiptId}`)
  }

  await insertLinkRow(pool, 'payments_learner_lnk', learnerLinkColumns, paymentId, 'learner_id', learnerId)
  await insertLinkRow(pool, 'payments_tenant_lnk', tenantLinkColumns, paymentId, 'tenant_id', tenantId)

  mapping[receipt.receiptId] = paymentId
  return { status: 'created', learnerId, paymentId }
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
    const receiptCollection = mongoDatabase.collection(RECEIPT_COLLECTION_NAME)
    const receipts = await loadReceipts(receiptCollection)
    log(`Using Mongo database: ${mongoDatabaseName}`)
    log(`Found ${receipts.length} receipts from ${RECEIPT_COLLECTION_NAME}`)

    await pgPool.query('SELECT NOW()')
    log('Postgres connected')

    const learnerColumns = await getTableColumns(pgPool, 'learners')
    const paymentColumns = await getTableColumns(pgPool, 'payments')
    const learnerLinkColumns = await getTableColumns(pgPool, 'payments_learner_lnk')
    const tenantLinkColumns = await getTableColumns(pgPool, 'payments_tenant_lnk')
    log('Detected learners columns:', Array.from(learnerColumns).sort())
    log('Detected payments columns:', Array.from(paymentColumns).sort())
    log('Detected payments_learner_lnk columns:', Array.from(learnerLinkColumns).sort())
    log('Detected payments_tenant_lnk columns:', Array.from(tenantLinkColumns).sort())

    if (!paymentColumns.has('amount') || !paymentColumns.has('payment_date')) {
      throw new Error('The payments table does not have the expected amount/payment_date columns')
    }

    if (!learnerLinkColumns.has('payment_id') || !learnerLinkColumns.has('learner_id')) {
      throw new Error('The payments_learner_lnk table does not have payment_id/learner_id as expected')
    }

    if (!tenantLinkColumns.has('payment_id') || !tenantLinkColumns.has('tenant_id')) {
      throw new Error('The payments_tenant_lnk table does not have payment_id/tenant_id as expected')
    }

    for (const receipt of receipts) {
      if (!receipt.receiptId) {
        invalidCount += 1
        warn('[WARN] Missing receipt _id, skipped row')
        continue
      }

      if (!receipt.userId) {
        invalidCount += 1
        warn(`[WARN] Missing userId for receipt ${receipt.receiptId}, skipped row`)
        continue
      }

      if (!(receipt.amount > 0)) {
        invalidCount += 1
        warn(`[WARN] Invalid amount for receipt ${receipt.receiptId}, skipped row`)
        continue
      }

      if (!receipt.paymentDate) {
        invalidCount += 1
        warn(`[WARN] Invalid createdAt for receipt ${receipt.receiptId}, skipped row`)
        continue
      }

      const result = await createPaymentIfNotExists(pgPool, receipt, {
        paymentColumns,
        learnerLinkColumns,
        tenantLinkColumns,
        tenantId,
        mapping,
        learnerColumns,
      })

      if (result.status === 'created') {
        createdCount += 1
        const learnerLabel = await getLearnerDisplay(pgPool, result.learnerId, learnerColumns)
        log(`[CREATE] payment for learner ${learnerLabel}`)
      } else if (result.status === 'skipped-existing') {
        skippedCount += 1
        const learnerLabel = await getLearnerDisplay(pgPool, result.learnerId, learnerColumns)
        log(`[SKIP] exists payment for learner ${learnerLabel}`)
      } else if (result.status === 'skipped-learner') {
        skippedCount += 1
        warn(`[WARN] Learner not found for old user ${receipt.userId}`)
      }
    }

    log(`Total payments created: ${createdCount}`)
    log(`Total payments skipped: ${skippedCount}`)
    log(`Total invalid rows skipped: ${invalidCount}`)
    log(`Mapping entries created: ${Object.keys(mapping).length}`)
    writeMappingFile(mapping)
    log(`Mapping file written: ${MAPPING_OUTPUT_FILE_PATH}`)
    log(`Migration finished in ${Date.now() - startedAt}ms`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Payment migration failed:`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await mongoClient.close().catch(() => undefined)
    await pgPool.end().catch(() => undefined)
    log('Connections closed')
  }
}

main()