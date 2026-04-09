const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')
const { Pool } = require('pg')
const { v4: uuidv4 } = require('uuid')

const ENV_FILE_PATH = path.resolve(__dirname, '..', '.env')
const CLASS_MAPPING_FILE_PATH = path.resolve(__dirname, 'migrate-classes.mapping.json')
const FEE_SHEET_MAPPING_FILE_PATH = path.resolve(__dirname, 'migrate-feesheets.mapping.json')
const FEE_ITEM_MAPPING_FILE_PATH = path.resolve(__dirname, 'migrate-feeitems.mapping.json')
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

function writeMappingFile(mapping) {
  fs.writeFileSync(FEE_ITEM_MAPPING_FILE_PATH, JSON.stringify(mapping, null, 2), 'utf8')
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

function normalizeSourceCode(value) {
  return String(value || '').trim()
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeFeeItemStatus(status, amount, paidAmount) {
  const normalized = String(status || '').trim().toLowerCase()
  if (['unpaid', 'partial', 'paid'].includes(normalized)) return normalized
  if (paidAmount <= 0) return 'unpaid'
  if (paidAmount < amount) return 'partial'
  return 'paid'
}

function createClassMappingKey(mongoClassId, itemCode) {
  return `${mongoClassId}_${itemCode}`
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

    const existingMongoClassId = enrollmentMap.get(userId)
    if (existingMongoClassId !== mongoClassId) {
      throw new Error(`User ${userId} belongs to multiple Mongo classes: ${existingMongoClassId} and ${mongoClassId}`)
    }
  })

  return enrollmentMap
}

async function loadDebts(collection) {
  const rows = await collection.find({}, {
    projection: {
      _id: 1,
      userId: 1,
      itemCode: 1,
      sourceCode: 1,
      quantity: 1,
      unitPrice: 1,
      discountPercent: 1,
      discountAmount: 1,
      amount: 1,
      paidAmount: 1,
      status: 1,
    },
  }).toArray()

  return rows.map((row) => ({
    debtId: normalizeMongoId(row?._id),
    userId: normalizeMongoId(row?.userId),
    itemCode: normalizeItemCode(row?.itemCode),
    sourceCode: normalizeSourceCode(row?.sourceCode),
    quantity: toNumber(row?.quantity, 0),
    unitPrice: toNumber(row?.unitPrice, 0),
    discountPercent: toNumber(row?.discountPercent, 0),
    discountAmount: toNumber(row?.discountAmount, 0),
    amount: toNumber(row?.amount, 0),
    paidAmount: toNumber(row?.paidAmount, 0),
    status: String(row?.status || '').trim(),
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

function hasRequiredColumns(columns, requiredColumns) {
  return requiredColumns.every((columnName) => columns.has(columnName))
}

async function detectFeeItemStorage(pool) {
  const feeItemColumns = await getTableColumns(pool, 'fee_items')
  const learnerLinkColumns = await getTableColumns(pool, 'fee_items_learner_lnk')
  const tenantLinkColumns = await getTableColumns(pool, 'fee_items_tenant_lnk')
  const feeSheetClassLinkColumns = await getTableColumns(pool, 'fee_items_fee_sheet_class_lnk')
  const classLinkColumns = await getTableColumns(pool, 'fee_items_class_lnk')
  const feeSheetLinkColumns = await getTableColumns(pool, 'fee_items_fee_sheet_lnk')

  const usesFeeSheetClass = hasRequiredColumns(feeSheetClassLinkColumns, ['fee_item_id', 'fee_sheet_class_id'])
  const usesDirectLinks = hasRequiredColumns(classLinkColumns, ['fee_item_id', 'class_id'])
    && hasRequiredColumns(feeSheetLinkColumns, ['fee_item_id', 'fee_sheet_id'])

  if (!usesFeeSheetClass && !usesDirectLinks) {
    throw new Error('Unable to determine fee item relation storage. Expected fee_items_fee_sheet_class_lnk or direct class/fee_sheet link tables.')
  }

  return {
    feeItemColumns,
    learnerLinkColumns,
    tenantLinkColumns,
    feeSheetClassLinkColumns,
    classLinkColumns,
    feeSheetLinkColumns,
    relationMode: usesFeeSheetClass ? 'feeSheetClass' : 'direct',
  }
}

async function detectFeeSheetClassStorage(pool) {
  const feeSheetClassColumns = await getTableColumns(pool, 'fee_sheet_classes')
  const feeSheetLinkColumns = await getTableColumns(pool, 'fee_sheet_classes_fee_sheet_lnk')
  const classLinkColumns = await getTableColumns(pool, 'fee_sheet_classes_class_lnk')
  const tenantLinkColumns = await getTableColumns(pool, 'fee_sheet_classes_tenant_lnk')

  return {
    feeSheetClassColumns,
    feeSheetLinkColumns,
    classLinkColumns,
    tenantLinkColumns,
  }
}

async function getLearnerRecord(pool, oldUserId, learnerColumns) {
  if (!oldUserId) return null
  if (!learnerColumns.has('old_user_id')) {
    throw new Error('The learners table does not have old_user_id')
  }

  const selectColumns = ['id']
  if (learnerColumns.has('code')) selectColumns.push('code')
  if (learnerColumns.has('full_name')) selectColumns.push('full_name')

  const result = await pool.query(
    `SELECT ${selectColumns.join(', ')} FROM learners WHERE old_user_id = $1 LIMIT 1`,
    [oldUserId]
  )

  return result.rows[0] || null
}

async function getClassName(pool, classId, classColumns) {
  if (!classColumns.has('name')) return String(classId)

  const result = await pool.query('SELECT name FROM classes WHERE id = $1 LIMIT 1', [classId])
  return result.rows[0]?.name || String(classId)
}

async function findExistingFeeSheetClass(pool, feeSheetId, classId) {
  const result = await pool.query(
    `
      SELECT fsc.id
      FROM fee_sheet_classes fsc
      INNER JOIN fee_sheet_classes_fee_sheet_lnk fee_sheet_link
        ON fee_sheet_link.fee_sheet_class_id = fsc.id
      INNER JOIN fee_sheet_classes_class_lnk class_link
        ON class_link.fee_sheet_class_id = fsc.id
      WHERE fee_sheet_link.fee_sheet_id = $1
        AND class_link.class_id = $2
      LIMIT 1
    `,
    [feeSheetId, classId]
  )

  return result.rows[0]?.id || null
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

async function ensureFeeSheetClass(pool, payload, options) {
  const { feeSheetClassColumns, feeSheetLinkColumns, classLinkColumns, tenantLinkColumns, tenantId, classColumns, classNameCache } = options
  const existingFeeSheetClassId = await findExistingFeeSheetClass(pool, payload.feeSheetId, payload.classId)
  if (existingFeeSheetClassId) return existingFeeSheetClassId

  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  let className = classNameCache.get(payload.classId)
  if (!className) {
    className = await getClassName(pool, payload.classId, classColumns)
    classNameCache.set(payload.classId, className)
  }

  if (feeSheetClassColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (feeSheetClassColumns.has('class_name_snapshot')) pushColumn('class_name_snapshot', className)
  if (feeSheetClassColumns.has('status')) pushColumn('status', 'draft')
  if (feeSheetClassColumns.has('created_at')) pushColumn('created_at', new Date())
  if (feeSheetClassColumns.has('updated_at')) pushColumn('updated_at', new Date())

  const result = await pool.query(
    `INSERT INTO fee_sheet_classes (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues
  )

  const feeSheetClassId = result.rows[0]?.id || null
  if (!feeSheetClassId) {
    throw new Error(`Failed to create fee_sheet_class for class ${payload.classId} and fee sheet ${payload.feeSheetId}`)
  }

  await insertLinkRow(pool, 'fee_sheet_classes_fee_sheet_lnk', feeSheetLinkColumns, 'fee_sheet_class_id', feeSheetClassId, 'fee_sheet_id', payload.feeSheetId)
  await insertLinkRow(pool, 'fee_sheet_classes_class_lnk', classLinkColumns, 'fee_sheet_class_id', feeSheetClassId, 'class_id', payload.classId)
  await insertLinkRow(pool, 'fee_sheet_classes_tenant_lnk', tenantLinkColumns, 'fee_sheet_class_id', feeSheetClassId, 'tenant_id', tenantId)

  return feeSheetClassId
}

async function findExistingFeeItem(pool, payload, relationMode) {
  if (relationMode === 'feeSheetClass') {
    const result = await pool.query(
      `
        SELECT fi.id
        FROM fee_items fi
        INNER JOIN fee_items_learner_lnk learner_link
          ON learner_link.fee_item_id = fi.id
        INNER JOIN fee_items_fee_sheet_class_lnk fee_sheet_class_link
          ON fee_sheet_class_link.fee_item_id = fi.id
        WHERE learner_link.learner_id = $1
          AND fee_sheet_class_link.fee_sheet_class_id = $2
        LIMIT 1
      `,
      [payload.learnerId, payload.feeSheetClassId]
    )

    return result.rows[0]?.id || null
  }

  const result = await pool.query(
    `
      SELECT fi.id
      FROM fee_items fi
      INNER JOIN fee_items_learner_lnk learner_link
        ON learner_link.fee_item_id = fi.id
      INNER JOIN fee_items_class_lnk class_link
        ON class_link.fee_item_id = fi.id
      INNER JOIN fee_items_fee_sheet_lnk fee_sheet_link
        ON fee_sheet_link.fee_item_id = fi.id
      WHERE learner_link.learner_id = $1
        AND class_link.class_id = $2
        AND fee_sheet_link.fee_sheet_id = $3
      LIMIT 1
    `,
    [payload.learnerId, payload.classId, payload.feeSheetId]
  )

  return result.rows[0]?.id || null
}

async function insertFeeItemBaseRow(pool, feeItemColumns, payload) {
  const insertColumns = []
  const insertValues = []
  const placeholders = []

  function pushColumn(columnName, value) {
    insertColumns.push(columnName)
    insertValues.push(value)
    placeholders.push(`$${insertValues.length}`)
  }

  if (feeItemColumns.has('document_id')) pushColumn('document_id', uuidv4())
  if (feeItemColumns.has('sessions')) pushColumn('sessions', payload.quantity)
  if (feeItemColumns.has('unit_price')) pushColumn('unit_price', payload.unitPrice)
  if (feeItemColumns.has('discount_percent')) pushColumn('discount_percent', payload.discountPercent)
  if (feeItemColumns.has('discount_amount')) pushColumn('discount_amount', payload.discountAmount)
  if (feeItemColumns.has('amount')) pushColumn('amount', payload.amount)
  if (feeItemColumns.has('paid_amount')) pushColumn('paid_amount', payload.paidAmount)
  if (feeItemColumns.has('status')) pushColumn('status', payload.status)
  if (feeItemColumns.has('learner_code_snapshot')) pushColumn('learner_code_snapshot', payload.learnerCodeSnapshot)
  if (feeItemColumns.has('learner_name_snapshot')) pushColumn('learner_name_snapshot', payload.learnerNameSnapshot)
  if (feeItemColumns.has('note')) pushColumn('note', `sourceCode=${payload.sourceCode};itemCode=${payload.itemCode}`)
  if (feeItemColumns.has('created_at')) pushColumn('created_at', new Date())
  if (feeItemColumns.has('updated_at')) pushColumn('updated_at', new Date())

  const result = await pool.query(
    `INSERT INTO fee_items (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues
  )

  return result.rows[0]?.id || null
}

async function createFeeItemIfNotExists(pool, payload, options) {
  const {
    relationMode,
    feeItemColumns,
    learnerLinkColumns,
    tenantLinkColumns,
    feeSheetClassLinkColumns,
    classLinkColumns,
    feeSheetLinkColumns,
    tenantId,
  } = options

  const existingFeeItemId = await findExistingFeeItem(pool, payload, relationMode)
  if (existingFeeItemId) {
    log(`[SKIP] exists FeeItem user ${payload.userId} - class ${payload.className} - sheet ${payload.sourceCode}`)
    return { status: 'skipped', feeItemId: existingFeeItemId }
  }

  const feeItemId = await insertFeeItemBaseRow(pool, feeItemColumns, payload)
  if (!feeItemId) {
    throw new Error(`Failed to create fee item for user ${payload.userId} and sourceCode ${payload.sourceCode}`)
  }

  await insertLinkRow(pool, 'fee_items_learner_lnk', learnerLinkColumns, 'fee_item_id', feeItemId, 'learner_id', payload.learnerId)
  await insertLinkRow(pool, 'fee_items_tenant_lnk', tenantLinkColumns, 'fee_item_id', feeItemId, 'tenant_id', tenantId)

  if (relationMode === 'feeSheetClass') {
    await insertLinkRow(pool, 'fee_items_fee_sheet_class_lnk', feeSheetClassLinkColumns, 'fee_item_id', feeItemId, 'fee_sheet_class_id', payload.feeSheetClassId)
  } else {
    await insertLinkRow(pool, 'fee_items_class_lnk', classLinkColumns, 'fee_item_id', feeItemId, 'class_id', payload.classId)
    await insertLinkRow(pool, 'fee_items_fee_sheet_lnk', feeSheetLinkColumns, 'fee_item_id', feeItemId, 'fee_sheet_id', payload.feeSheetId)
  }

  log(`[CREATE] FeeItem user ${payload.userId} - class ${payload.className} - sheet ${payload.sourceCode}`)
  return { status: 'created', feeItemId }
}

async function main() {
  const startedAt = Date.now()
  loadEnvFile()

  const mongoClient = createMongoClient()
  const pgPool = createPostgresPool()
  const feeItemMapping = {}

  let createdCount = 0
  let skippedCount = 0
  let invalidCount = 0
  const tenantId = getOptionalNumberEnv('MIGRATION_TENANT_ID') || DEFAULT_TENANT_ID
  const classMapping = loadJsonMapping(CLASS_MAPPING_FILE_PATH, 'Class')
  const feeSheetMapping = loadJsonMapping(FEE_SHEET_MAPPING_FILE_PATH, 'FeeSheet')
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
    log(`Found ${debts.length} debts from ${DEBT_COLLECTION_NAME}`)
    log(`Loaded ${Object.keys(classMapping).length} class mapping entries`)
    log(`Loaded ${Object.keys(feeSheetMapping).length} fee sheet mapping entries`)

    await pgPool.query('SELECT NOW()')
    log('Postgres connected')

    const learnerColumns = await getTableColumns(pgPool, 'learners')
    const classColumns = await getTableColumns(pgPool, 'classes')
    const feeItemStorage = await detectFeeItemStorage(pgPool)
    const feeSheetClassStorage = feeItemStorage.relationMode === 'feeSheetClass'
      ? await detectFeeSheetClassStorage(pgPool)
      : null

    log('Detected learners columns:', Array.from(learnerColumns).sort())
    log('Detected classes columns:', Array.from(classColumns).sort())
    log('Detected fee_items columns:', Array.from(feeItemStorage.feeItemColumns).sort())
    log('Detected fee_items_learner_lnk columns:', Array.from(feeItemStorage.learnerLinkColumns).sort())
    log('Detected fee_items_tenant_lnk columns:', Array.from(feeItemStorage.tenantLinkColumns).sort())
    log(`Detected fee item relation mode: ${feeItemStorage.relationMode}`)

    if (!hasRequiredColumns(feeItemStorage.learnerLinkColumns, ['fee_item_id', 'learner_id'])) {
      throw new Error('The fee_items_learner_lnk table does not have fee_item_id/learner_id as expected')
    }

    if (!hasRequiredColumns(feeItemStorage.tenantLinkColumns, ['fee_item_id', 'tenant_id'])) {
      throw new Error('The fee_items_tenant_lnk table does not have fee_item_id/tenant_id as expected')
    }

    if (feeItemStorage.relationMode === 'feeSheetClass') {
      log('Detected fee_sheet_classes columns:', Array.from(feeSheetClassStorage.feeSheetClassColumns).sort())
      log('Detected fee_sheet_classes_fee_sheet_lnk columns:', Array.from(feeSheetClassStorage.feeSheetLinkColumns).sort())
      log('Detected fee_sheet_classes_class_lnk columns:', Array.from(feeSheetClassStorage.classLinkColumns).sort())
      log('Detected fee_sheet_classes_tenant_lnk columns:', Array.from(feeSheetClassStorage.tenantLinkColumns).sort())

      if (!hasRequiredColumns(feeSheetClassStorage.feeSheetLinkColumns, ['fee_sheet_class_id', 'fee_sheet_id'])) {
        throw new Error('The fee_sheet_classes_fee_sheet_lnk table does not have fee_sheet_class_id/fee_sheet_id as expected')
      }

      if (!hasRequiredColumns(feeSheetClassStorage.classLinkColumns, ['fee_sheet_class_id', 'class_id'])) {
        throw new Error('The fee_sheet_classes_class_lnk table does not have fee_sheet_class_id/class_id as expected')
      }

      if (!hasRequiredColumns(feeSheetClassStorage.tenantLinkColumns, ['fee_sheet_class_id', 'tenant_id'])) {
        throw new Error('The fee_sheet_classes_tenant_lnk table does not have fee_sheet_class_id/tenant_id as expected')
      }
    }

    for (const debt of debts) {
      if (!debt.debtId) {
        invalidCount += 1
        warn('[WARN] Missing debt _id, skipped debt row')
        continue
      }

      if (!debt.userId) {
        invalidCount += 1
        warn('[WARN] Missing userId, skipped debt row')
        continue
      }

      if (!debt.itemCode) {
        invalidCount += 1
        warn(`[WARN] Missing itemCode, skipped debt row for user ${debt.userId}`)
        continue
      }

      if (!debt.sourceCode) {
        invalidCount += 1
        warn(`[WARN] Missing sourceCode, skipped debt row for user ${debt.userId}`)
        continue
      }

      const mongoClassId = enrollmentMap.get(debt.userId)
      if (!mongoClassId) {
        skippedCount += 1
        warn(`[WARN] Mongo class not found for user ${debt.userId}`)
        continue
      }

      const classId = classMapping[createClassMappingKey(mongoClassId, debt.itemCode)] || null
      if (!classId) {
        skippedCount += 1
        warn(`[WARN] Class not found for mapping key ${createClassMappingKey(mongoClassId, debt.itemCode)}`)
        continue
      }

      const feeSheetId = feeSheetMapping[debt.sourceCode] || null
      if (!feeSheetId) {
        skippedCount += 1
        warn(`[WARN] FeeSheet not found for sourceCode ${debt.sourceCode}`)
        continue
      }

      const learner = await getLearnerRecord(pgPool, debt.userId, learnerColumns)
      if (!learner?.id) {
        skippedCount += 1
        warn(`[WARN] Learner not found for old user ${debt.userId}`)
        continue
      }

      let className = classNameCache.get(classId)
      if (!className) {
        className = await getClassName(pgPool, classId, classColumns)
        classNameCache.set(classId, className)
      }

      const quantity = Math.max(0, Math.trunc(debt.quantity))
      const unitPrice = Math.max(0, debt.unitPrice)
      const discountPercent = Math.max(0, debt.discountPercent)
      const discountAmount = Math.max(0, debt.discountAmount)
      const computedGross = roundMoney(quantity * unitPrice)
      const fallbackAmount = roundMoney(Math.max(0, computedGross - discountAmount))
      const amount = Math.max(0, debt.amount || fallbackAmount)
      const paidAmount = Math.max(0, debt.paidAmount)
      const status = normalizeFeeItemStatus(debt.status, amount, paidAmount)

      const payload = {
        userId: debt.userId,
        itemCode: debt.itemCode,
        sourceCode: debt.sourceCode,
        learnerId: learner.id,
        learnerCodeSnapshot: learner.code || null,
        learnerNameSnapshot: learner.full_name || null,
        classId,
        className,
        feeSheetId,
        quantity,
        unitPrice,
        discountPercent,
        discountAmount,
        amount,
        paidAmount,
        status,
        feeSheetClassId: null,
      }

      if (feeItemStorage.relationMode === 'feeSheetClass') {
        payload.feeSheetClassId = await ensureFeeSheetClass(pgPool, {
          classId,
          feeSheetId,
        }, {
          feeSheetClassColumns: feeSheetClassStorage.feeSheetClassColumns,
          feeSheetLinkColumns: feeSheetClassStorage.feeSheetLinkColumns,
          classLinkColumns: feeSheetClassStorage.classLinkColumns,
          tenantLinkColumns: feeSheetClassStorage.tenantLinkColumns,
          tenantId,
          classColumns,
          classNameCache,
        })
      }

      const result = await createFeeItemIfNotExists(pgPool, payload, {
        relationMode: feeItemStorage.relationMode,
        feeItemColumns: feeItemStorage.feeItemColumns,
        learnerLinkColumns: feeItemStorage.learnerLinkColumns,
        tenantLinkColumns: feeItemStorage.tenantLinkColumns,
        feeSheetClassLinkColumns: feeItemStorage.feeSheetClassLinkColumns,
        classLinkColumns: feeItemStorage.classLinkColumns,
        feeSheetLinkColumns: feeItemStorage.feeSheetLinkColumns,
        tenantId,
      })

      if (result?.feeItemId) {
        feeItemMapping[debt.debtId] = result.feeItemId
      }

      if (result?.status === 'created') createdCount += 1
      else skippedCount += 1
    }

    log(`Total fee items created: ${createdCount}`)
    log(`Total fee items skipped: ${skippedCount}`)
    log(`Total invalid rows skipped: ${invalidCount}`)
    log(`Fee item mapping entries created: ${Object.keys(feeItemMapping).length}`)
    writeMappingFile(feeItemMapping)
    log(`Mapping file written: ${FEE_ITEM_MAPPING_FILE_PATH}`)
    log(`Migration finished in ${Date.now() - startedAt}ms`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] FeeItem migration failed:`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await mongoClient.close().catch(() => undefined)
    await pgPool.end().catch(() => undefined)
    log('Connections closed')
  }
}

main()