const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')
const { Pool } = require('pg')
const { v4: uuidv4 } = require('uuid')

const ENV_FILE_PATH = path.resolve(__dirname, '..', '.env')
const MAPPING_OUTPUT_FILE_PATH = path.resolve(__dirname, 'migrate-feesheets.mapping.json')
const DEFAULT_MONGO_DATABASE_NAME = 'vtf'
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

function normalizeSourceCode(value) {
  return String(value || '').trim()
}

function normalizeDateOnly(value) {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function getDefaultFromDate() {
  const configured = normalizeDateOnly(getEnv('MIGRATION_FEE_SHEET_FROM_DATE'))
  if (configured) return configured

  const now = new Date()
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return firstDay.toISOString().slice(0, 10)
}

function getDefaultToDate() {
  const configured = normalizeDateOnly(getEnv('MIGRATION_FEE_SHEET_TO_DATE'))
  if (configured) return configured

  const now = new Date()
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return lastDay.toISOString().slice(0, 10)
}

function writeMappingFile(mapping) {
  fs.writeFileSync(MAPPING_OUTPUT_FILE_PATH, JSON.stringify(mapping, null, 2), 'utf8')
}

async function getSourceCodes(collection) {
  const sourceCodes = await collection.distinct('sourceCode')
  return sourceCodes.map((sourceCode) => normalizeSourceCode(sourceCode))
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

function resolveFeeSheetLookup(feeSheetColumns) {
  if (feeSheetColumns.has('code')) {
    return {
      columnName: 'code',
      valueFactory: (sourceCode) => sourceCode,
    }
  }

  if (feeSheetColumns.has('note')) {
    return {
      columnName: 'note',
      valueFactory: (sourceCode) => sourceCode,
    }
  }

  if (feeSheetColumns.has('name')) {
    return {
      columnName: 'name',
      valueFactory: (sourceCode) => `Học phí ${sourceCode}`,
    }
  }

  throw new Error('The fee_sheets table does not have a usable lookup column (expected code, note, or name)')
}

async function findExistingFeeSheet(pool, sourceCode, feeSheetColumns) {
  const lookup = resolveFeeSheetLookup(feeSheetColumns)
  const result = await pool.query(
    `SELECT id FROM fee_sheets WHERE LOWER(${lookup.columnName}) = LOWER($1) LIMIT 1`,
    [lookup.valueFactory(sourceCode)]
  )

  return result.rows[0]?.id || null
}

async function insertTenantLink(pool, feeSheetId, tenantId, linkColumns) {
  const existing = await pool.query(
    'SELECT 1 FROM fee_sheets_tenant_lnk WHERE fee_sheet_id = $1 AND tenant_id = $2 LIMIT 1',
    [feeSheetId, tenantId]
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

  pushColumn('fee_sheet_id', feeSheetId)
  pushColumn('tenant_id', tenantId)
  if (linkColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (linkColumns.has('created_at')) pushColumn('created_at', new Date())
  if (linkColumns.has('updated_at')) pushColumn('updated_at', new Date())

  await pool.query(
    `INSERT INTO fee_sheets_tenant_lnk (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    insertValues
  )
}

async function createFeeSheetIfNotExists(pool, sourceCode, options) {
  const { feeSheetColumns, feeSheetTenantLinkColumns, tenantId, mapping, defaultFromDate, defaultToDate } = options
  const existingFeeSheetId = await findExistingFeeSheet(pool, sourceCode, feeSheetColumns)

  if (existingFeeSheetId) {
    mapping[sourceCode] = existingFeeSheetId
    log(`[SKIP] exists ${sourceCode}`)
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

  if (feeSheetColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (feeSheetColumns.has('name')) pushColumn('name', `Học phí ${sourceCode}`)
  if (feeSheetColumns.has('code')) pushColumn('code', sourceCode)
  if (feeSheetColumns.has('note')) pushColumn('note', sourceCode)
  if (feeSheetColumns.has('from_date')) pushColumn('from_date', defaultFromDate)
  if (feeSheetColumns.has('to_date')) pushColumn('to_date', defaultToDate)
  if (feeSheetColumns.has('status')) pushColumn('status', 'draft')
  if (feeSheetColumns.has('created_at')) pushColumn('created_at', new Date())
  if (feeSheetColumns.has('updated_at')) pushColumn('updated_at', new Date())

  const result = await pool.query(
    `INSERT INTO fee_sheets (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues
  )

  const feeSheetId = result.rows[0]?.id || null
  if (!feeSheetId) {
    throw new Error(`Failed to create fee sheet for sourceCode ${sourceCode}`)
  }

  await insertTenantLink(pool, feeSheetId, tenantId, feeSheetTenantLinkColumns)
  mapping[sourceCode] = feeSheetId
  log(`[CREATE] FeeSheet: ${sourceCode}`)
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
  const defaultFromDate = getDefaultFromDate()
  const defaultToDate = getDefaultToDate()

  try {
    await mongoClient.connect()
    log('Mongo connected')

    const mongoDatabaseName = getMongoDatabaseName()
    const mongoDatabase = mongoClient.db(mongoDatabaseName)
    const debtCollection = mongoDatabase.collection(DEBT_COLLECTION_NAME)
    const sourceCodes = await getSourceCodes(debtCollection)
    log(`Using Mongo database: ${mongoDatabaseName}`)
    log(`Found ${sourceCodes.length} distinct sourceCode values from ${DEBT_COLLECTION_NAME}`)

    await pgPool.query('SELECT NOW()')
    log('Postgres connected')

    const feeSheetColumns = await getTableColumns(pgPool, 'fee_sheets')
    const feeSheetTenantLinkColumns = await getTableColumns(pgPool, 'fee_sheets_tenant_lnk')
    log('Detected fee_sheets columns:', Array.from(feeSheetColumns).sort())
    log('Detected fee_sheets_tenant_lnk columns:', Array.from(feeSheetTenantLinkColumns).sort())
    log(`Default fee sheet period: ${defaultFromDate} -> ${defaultToDate}`)

    if (!feeSheetColumns.has('name')) {
      throw new Error('The fee_sheets table does not have the expected name column')
    }

    if (!feeSheetColumns.has('from_date') || !feeSheetColumns.has('to_date')) {
      throw new Error('The fee_sheets table does not have the expected from_date/to_date columns')
    }

    if (!feeSheetTenantLinkColumns.has('fee_sheet_id') || !feeSheetTenantLinkColumns.has('tenant_id')) {
      throw new Error('The fee_sheets_tenant_lnk table does not have fee_sheet_id/tenant_id as expected')
    }

    for (const sourceCode of sourceCodes) {
      if (!sourceCode) {
        invalidCount += 1
        warn('[WARN] sourceCode is null or empty, skipped row')
        continue
      }

      const result = await createFeeSheetIfNotExists(pgPool, sourceCode, {
        feeSheetColumns,
        feeSheetTenantLinkColumns,
        tenantId,
        mapping,
        defaultFromDate,
        defaultToDate,
      })

      if (result === 'created') createdCount += 1
      else skippedCount += 1
    }

    log(`Total fee sheets created: ${createdCount}`)
    log(`Total fee sheets skipped: ${skippedCount}`)
    log(`Total invalid rows skipped: ${invalidCount}`)
    log(`Mapping entries created: ${Object.keys(mapping).length}`)
    writeMappingFile(mapping)
    log(`Mapping file written: ${MAPPING_OUTPUT_FILE_PATH}`)
    log(`Migration finished in ${Date.now() - startedAt}ms`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] FeeSheet migration failed:`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await mongoClient.close().catch(() => undefined)
    await pgPool.end().catch(() => undefined)
    log('Connections closed')
  }
}

main()