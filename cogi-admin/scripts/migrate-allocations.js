const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')
const { Pool } = require('pg')
const { v4: uuidv4 } = require('uuid')

const ENV_FILE_PATH = path.resolve(__dirname, '..', '.env')
const PAYMENT_MAPPING_FILE_PATH = path.resolve(__dirname, 'migrate-payments.mapping.json')
const FEE_ITEM_MAPPING_FILE_PATH = path.resolve(__dirname, 'migrate-feeitems.mapping.json')
const DEFAULT_MONGO_DATABASE_NAME = 'vtf'
const DEFAULT_RECEIPT_DETAIL_COLLECTION_NAME = 'receiptDetails'
const DEFAULT_TENANT_ID = 1
const DEFAULT_DEBUG_INVALID_LIMIT = 20

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

function getReceiptDetailCollectionName() {
  return getEnv('MIGRATION_RECEIPT_DETAIL_COLLECTION') || DEFAULT_RECEIPT_DETAIL_COLLECTION_NAME
}

function getDebugInvalidLimit() {
  const parsed = Number(getEnv('MIGRATION_DEBUG_INVALID_LIMIT'))
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_DEBUG_INVALID_LIMIT
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
  if (value === null || value === undefined) return fallback

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/,/g, '')
    if (!normalized) return fallback

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  if (typeof value === 'object') {
    if (value && typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
      const stringValue = String(value.toString()).trim()
      if (stringValue && stringValue !== '[object Object]') {
        const parsed = Number(stringValue.replace(/,/g, ''))
        if (Number.isFinite(parsed)) return parsed
      }
    }

    if (Object.prototype.hasOwnProperty.call(value, '$numberDecimal')) {
      const parsed = Number(String(value.$numberDecimal || '').replace(/,/g, ''))
      if (Number.isFinite(parsed)) return parsed
    }

    if (Object.prototype.hasOwnProperty.call(value, '$numberInt')) {
      const parsed = Number(String(value.$numberInt || '').replace(/,/g, ''))
      if (Number.isFinite(parsed)) return parsed
    }

    if (Object.prototype.hasOwnProperty.call(value, '$numberLong')) {
      const parsed = Number(String(value.$numberLong || '').replace(/,/g, ''))
      if (Number.isFinite(parsed)) return parsed
    }
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function summarizeValue(value) {
  if (value === null) return { type: 'null', value: null }
  if (value === undefined) return { type: 'undefined', value: undefined }
  if (typeof value !== 'object') return { type: typeof value, value }

  return {
    type: value?._bsontype || value?.constructor?.name || 'object',
    value: typeof value.toString === 'function' ? String(value.toString()) : value,
    keys: Object.keys(value).slice(0, 10),
  }
}

function normalizeDateTime(value) {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function loadJsonMapping(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} mapping file not found: ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(content)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid ${label} mapping file content: ${filePath}`)
  }

  return parsed
}

async function loadReceiptDetails(collection) {
  const rows = await collection.find({}, {
    projection: {
      _id: 1,
      receiptId: 1,
      debtId: 1,
      paidAmount: 1,
      amount: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  }).toArray()

  return rows.map((row) => ({
    receiptDetailId: normalizeMongoId(row?._id),
    receiptId: normalizeMongoId(row?.receiptId),
    debtId: normalizeMongoId(row?.debtId),
    amount: toNumber(row?.paidAmount ?? row?.amount, 0),
    amountRaw: row?.paidAmount ?? row?.amount,
    createdAt: normalizeDateTime(row?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDateTime(row?.updatedAt ?? row?.createdAt) || new Date().toISOString(),
  }))
}

async function resolveReceiptDetailCollection(db) {
  const requestedName = getReceiptDetailCollectionName()
  const collectionInfos = await db.listCollections({}, { nameOnly: true }).toArray()
  const collectionNames = collectionInfos.map((item) => String(item?.name || ''))

  const candidateNames = [
    requestedName,
    'receiptdetails',
    'receipt_details',
    'receipt-detail',
    'receipt-details',
  ].filter(Boolean)

  const exactMatch = candidateNames.find((candidate) => collectionNames.includes(candidate))
  if (exactMatch) {
    return {
      collection: db.collection(exactMatch),
      collectionName: exactMatch,
      receiptRelatedCollections: collectionNames.filter((name) => /receipt/i.test(name)),
    }
  }

  const fuzzyMatch = collectionNames.find((name) => {
    const normalized = name.replace(/[^a-z0-9]/gi, '').toLowerCase()
    return normalized === 'receiptdetails'
  })

  return {
    collection: fuzzyMatch ? db.collection(fuzzyMatch) : db.collection(requestedName),
    collectionName: fuzzyMatch || requestedName,
    receiptRelatedCollections: collectionNames.filter((name) => /receipt/i.test(name)),
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

function hasRequiredColumns(columns, requiredColumns) {
  return requiredColumns.every((columnName) => columns.has(columnName))
}

async function insertLinkRow(pool, tableName, linkColumns, sourceColumn, sourceId, targetColumn, targetId) {
  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  pushColumn(sourceColumn, sourceId)
  pushColumn(targetColumn, targetId)
  if (linkColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (linkColumns.has('created_at')) pushColumn('created_at', new Date())
  if (linkColumns.has('updated_at')) pushColumn('updated_at', new Date())

  await pool.query(
    `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    insertValues
  )
}

async function findExistingAllocation(pool, paymentId, feeItemId) {
  const result = await pool.query(
    `
      SELECT allocation.id
      FROM payment_allocations allocation
      INNER JOIN payment_allocations_payment_lnk payment_link
        ON payment_link.payment_allocation_id = allocation.id
      INNER JOIN payment_allocations_fee_item_lnk fee_item_link
        ON fee_item_link.payment_allocation_id = allocation.id
      WHERE payment_link.payment_id = $1
        AND fee_item_link.fee_item_id = $2
      LIMIT 1
    `,
    [paymentId, feeItemId]
  )

  return result.rows[0]?.id || null
}

async function createAllocationIfNotExists(pool, receiptDetail, options) {
  const {
    allocationColumns,
    paymentLinkColumns,
    feeItemLinkColumns,
    tenantLinkColumns,
    paymentId,
    feeItemId,
    tenantId,
  } = options

  const existingAllocationId = await findExistingAllocation(pool, paymentId, feeItemId)
  if (existingAllocationId) {
    return { status: 'skipped-existing', allocationId: existingAllocationId }
  }

  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  if (allocationColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (allocationColumns.has('amount')) pushColumn('amount', receiptDetail.amount)
  if (allocationColumns.has('created_at')) pushColumn('created_at', receiptDetail.createdAt)
  if (allocationColumns.has('updated_at')) pushColumn('updated_at', receiptDetail.updatedAt)

  const result = await pool.query(
    `INSERT INTO payment_allocations (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues
  )

  const allocationId = result.rows[0]?.id || null
  if (!allocationId) {
    throw new Error(`Failed to create allocation for receiptDetail ${receiptDetail.receiptDetailId}`)
  }

  await insertLinkRow(pool, 'payment_allocations_payment_lnk', paymentLinkColumns, 'payment_allocation_id', allocationId, 'payment_id', paymentId)
  await insertLinkRow(pool, 'payment_allocations_fee_item_lnk', feeItemLinkColumns, 'payment_allocation_id', allocationId, 'fee_item_id', feeItemId)
  await insertLinkRow(pool, 'payment_allocations_tenant_lnk', tenantLinkColumns, 'payment_allocation_id', allocationId, 'tenant_id', tenantId)

  return { status: 'created', allocationId }
}

async function main() {
  const startedAt = Date.now()
  loadEnvFile()

  const mongoClient = createMongoClient()
  const pgPool = createPostgresPool()

  let createdCount = 0
  let skippedCount = 0
  let invalidCount = 0
  let invalidAmountDebugCount = 0
  const tenantId = getOptionalNumberEnv('MIGRATION_TENANT_ID') || DEFAULT_TENANT_ID
  const debugInvalidLimit = getDebugInvalidLimit()
  const paymentMapping = loadJsonMapping(PAYMENT_MAPPING_FILE_PATH, 'Payment')
  const feeItemMapping = loadJsonMapping(FEE_ITEM_MAPPING_FILE_PATH, 'FeeItem')

  try {
    await mongoClient.connect()
    log('Mongo connected')

    const mongoDatabaseName = getMongoDatabaseName()
    const mongoDatabase = mongoClient.db(mongoDatabaseName)
    const resolvedCollection = await resolveReceiptDetailCollection(mongoDatabase)
    const receiptDetails = await loadReceiptDetails(resolvedCollection.collection)
    log(`Using Mongo database: ${mongoDatabaseName}`)
    log(`Using receipt detail collection: ${resolvedCollection.collectionName}`)
    if (resolvedCollection.receiptRelatedCollections.length > 0) {
      log('Available receipt-related collections:', resolvedCollection.receiptRelatedCollections)
    }
    log(`Found ${receiptDetails.length} receiptDetails from ${resolvedCollection.collectionName}`)
    log(`Loaded ${Object.keys(paymentMapping).length} payment mapping entries`)
    log(`Loaded ${Object.keys(feeItemMapping).length} fee item mapping entries`)

    await pgPool.query('SELECT NOW()')
    log('Postgres connected')

    const allocationColumns = await getTableColumns(pgPool, 'payment_allocations')
    const paymentLinkColumns = await getTableColumns(pgPool, 'payment_allocations_payment_lnk')
    const feeItemLinkColumns = await getTableColumns(pgPool, 'payment_allocations_fee_item_lnk')
    const tenantLinkColumns = await getTableColumns(pgPool, 'payment_allocations_tenant_lnk')

    log('Detected payment_allocations columns:', Array.from(allocationColumns).sort())
    log('Detected payment_allocations_payment_lnk columns:', Array.from(paymentLinkColumns).sort())
    log('Detected payment_allocations_fee_item_lnk columns:', Array.from(feeItemLinkColumns).sort())
    log('Detected payment_allocations_tenant_lnk columns:', Array.from(tenantLinkColumns).sort())

    if (!allocationColumns.has('amount')) {
      throw new Error('The payment_allocations table does not have the expected amount column')
    }

    if (!hasRequiredColumns(paymentLinkColumns, ['payment_allocation_id', 'payment_id'])) {
      throw new Error('The payment_allocations_payment_lnk table does not have payment_allocation_id/payment_id as expected')
    }

    if (!hasRequiredColumns(feeItemLinkColumns, ['payment_allocation_id', 'fee_item_id'])) {
      throw new Error('The payment_allocations_fee_item_lnk table does not have payment_allocation_id/fee_item_id as expected')
    }

    if (!hasRequiredColumns(tenantLinkColumns, ['payment_allocation_id', 'tenant_id'])) {
      throw new Error('The payment_allocations_tenant_lnk table does not have payment_allocation_id/tenant_id as expected')
    }

    for (const receiptDetail of receiptDetails) {
      if (!receiptDetail.receiptDetailId) {
        invalidCount += 1
        warn('[WARN] Missing receiptDetail _id, skipped row')
        continue
      }

      if (!receiptDetail.receiptId) {
        invalidCount += 1
        warn(`[WARN] Missing receiptId for receiptDetail ${receiptDetail.receiptDetailId}, skipped row`)
        continue
      }

      if (!receiptDetail.debtId) {
        invalidCount += 1
        warn(`[WARN] Missing debtId for receiptDetail ${receiptDetail.receiptDetailId}, skipped row`)
        continue
      }

      if (!(receiptDetail.amount > 0)) {
        invalidCount += 1
        warn(`[WARN] Invalid amount for receiptDetail ${receiptDetail.receiptDetailId}, skipped row`)
        if (invalidAmountDebugCount < debugInvalidLimit) {
          invalidAmountDebugCount += 1
          warn('[DEBUG] Invalid amount payload:', {
            receiptDetailId: receiptDetail.receiptDetailId,
            receiptId: receiptDetail.receiptId,
            debtId: receiptDetail.debtId,
            amount: summarizeValue(receiptDetail.amountRaw),
          })
        }
        continue
      }

      const paymentId = paymentMapping[receiptDetail.receiptId] || null
      if (!paymentId) {
        skippedCount += 1
        warn(`[WARN] Payment not found for receipt ${receiptDetail.receiptId}`)
        continue
      }

      const feeItemId = feeItemMapping[receiptDetail.debtId] || null
      if (!feeItemId) {
        skippedCount += 1
        warn(`[WARN] FeeItem not found for debt ${receiptDetail.debtId}`)
        continue
      }

      const result = await createAllocationIfNotExists(pgPool, receiptDetail, {
        allocationColumns,
        paymentLinkColumns,
        feeItemLinkColumns,
        tenantLinkColumns,
        paymentId,
        feeItemId,
        tenantId,
      })

      if (result.status === 'created') {
        createdCount += 1
        log(`[CREATE] allocation payment ${paymentId} → feeItem ${feeItemId}`)
      } else {
        skippedCount += 1
        log(`[SKIP] exists allocation payment ${paymentId} → feeItem ${feeItemId}`)
      }
    }

    log(`Total allocations created: ${createdCount}`)
    log(`Total allocations skipped: ${skippedCount}`)
    log(`Total invalid rows skipped: ${invalidCount}`)
    log(`Migration finished in ${Date.now() - startedAt}ms`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Allocation migration failed:`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await mongoClient.close().catch(() => undefined)
    await pgPool.end().catch(() => undefined)
    log('Connections closed')
  }
}

main()