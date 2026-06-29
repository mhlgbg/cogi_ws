const fs = require('fs')
const path = require('path')
const fse = require('fs-extra')
const { Pool } = require('pg')
const mime = require('mime-types')
const crypto = require('crypto')

const ENV_FILE_PATH = path.resolve(__dirname, '..', '.env')
const PUBLIC_UPLOADS_ROOT = path.resolve(__dirname, '..', 'public', 'uploads')
const DEFAULT_BATCH_SIZE = 100
const ADMISSION_APPLICATION_TABLE = 'admission_applications'
const TENANT_TABLE = 'tenants'
const CAMPAIGN_TABLE = 'campaigns'
const TENANT_COLUMN_CANDIDATES = ['tenant_id', 'tenants_id']
const CAMPAIGN_COLUMN_CANDIDATES = ['campaign_id', 'campaigns_id']
const ADMISSION_APPLICATION_COLUMN_CANDIDATES = ['admission_application_id', 'admission_applications_id', 'entity_id', 'source_id']
const TENANT_LINK_COLUMN_CANDIDATES = ['tenant_id', 'tenants_id', 'inv_tenant_id', 'target_id']
const CAMPAIGN_LINK_COLUMN_CANDIDATES = ['campaign_id', 'campaigns_id', 'inv_campaign_id', 'target_id']

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

function createPostgresPool() {
  return new Pool({
    host: requireEnv('PG_HOST', 'DATABASE_HOST'),
    port: Number.parseInt(requireEnv('PG_PORT', 'DATABASE_PORT'), 10),
    database: requireEnv('PG_DATABASE', 'DATABASE_NAME'),
    user: requireEnv('PG_USER', 'DATABASE_USERNAME'),
    password: requireEnv('PG_PASSWORD', 'DATABASE_PASSWORD'),
  })
}

function parseArgs(argv) {
  const options = {
    mode: 'dry-run',
    tenant: '',
    campaign: '',
    limit: 0,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim()
    if (!arg) continue

    if (arg === '--dry-run') {
      options.mode = 'dry-run'
      continue
    }

    if (arg === '--apply') {
      options.mode = 'apply'
      continue
    }

    if (arg === '--tenant') {
      options.tenant = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    if (arg === '--campaign') {
      options.campaign = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    if (arg === '--limit') {
      const parsed = Number.parseInt(String(argv[index + 1] || '').trim(), 10)
      options.limit = Number.isInteger(parsed) && parsed > 0 ? parsed : 0
      index += 1
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0)
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function printHelpAndExit(code) {
  console.log([
    'Usage: node ./scripts/migrate-admission-dataurl-files.js [options]',
    '',
    'Options:',
    '  --dry-run               Scan only. This is the default mode.',
    '  --apply                 Write files and update admission applications.',
    '  --tenant <id|code>      Restrict to one tenant id or code.',
    '  --campaign <code>       Restrict to one campaign code.',
    '  --limit <number>        Max applications to process.',
    '  --help                  Show this message.',
  ].join('\n'))
  process.exit(code)
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeSegment(value, fallback = 'file') {
  const text = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return text || fallback
}

function getFileExtension(fileName, mimeType) {
  const rawName = String(fileName || '').trim()
  const parsedExt = path.extname(rawName).toLowerCase()
  if (parsedExt) return parsedExt

  const mimeExt = mime.extension(String(mimeType || '').trim().toLowerCase())
  return mimeExt ? `.${mimeExt}` : ''
}

function parseDataUrl(dataUrl) {
  const text = String(dataUrl || '').trim()
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([a-z0-9+/=\r\n]+)$/i.exec(text)
  if (!match) {
    throw new Error('Invalid dataUrl format')
  }

  const mimeType = String(match[1] || '').trim().toLowerCase() || 'application/octet-stream'
  const base64Payload = String(match[2] || '').replace(/\s+/g, '')
  if (!base64Payload) {
    throw new Error('Missing base64 payload')
  }

  return {
    mimeType,
    buffer: Buffer.from(base64Payload, 'base64'),
  }
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item))
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]))
  }
  return value
}

function shouldSkipMigratedFile(value) {
  return isRecord(value) && Boolean(String(value.url || '').trim()) && Boolean(value.migratedFromDataUrl)
}

function isLegacyDataUrlFile(value) {
  return isRecord(value)
    && !Array.isArray(value)
    && typeof value.name === 'string'
    && typeof value.type === 'string'
    && String(value.dataUrl || '').trim().startsWith('data:')
}

function createMigratedFileMeta({ file, url, mimeType, migratedAt }) {
  const next = { ...file }
  delete next.dataUrl

  return {
    ...next,
    name: String(file.name || '').trim() || 'Tep dinh kem',
    size: Number.isFinite(Number(file.size)) ? Number(file.size) : undefined,
    type: String(file.type || '').trim() || mimeType,
    mime: mimeType,
    url,
    migratedFromDataUrl: true,
    migratedAt,
  }
}

function resolveRelativeUploadPath({ tenantCode, campaignCode, applicationId, fieldPath, fileName, mimeType, index }) {
  const timestamp = Date.now()
  const suffix = crypto.randomBytes(3).toString('hex')
  const extension = getFileExtension(fileName, mimeType)
  const safeNameBase = normalizeSegment(path.basename(String(fileName || '').trim(), extension), 'file')
  const safeField = normalizeSegment(fieldPath.replace(/\./g, '-').replace(/\[(\d+)\]/g, '-$1'), 'field')
  const safeTenant = normalizeSegment(tenantCode, 'tenant')
  const safeCampaign = normalizeSegment(campaignCode, 'campaign')
  const nextFileName = `${safeField}-${index}-${safeNameBase}-${timestamp}-${suffix}${extension}`

  return path.posix.join(
    'admissions',
    safeTenant,
    safeCampaign,
    String(applicationId),
    nextFileName,
  )
}

function createSummary() {
  return {
    totalApplicationsScanned: 0,
    applicationsNeedingMigration: 0,
    filesFound: 0,
    filesMigrated: 0,
    filesSkipped: 0,
    errors: 0,
  }
}

async function listTableColumns(pool, tableName) {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1
    `,
    [tableName]
  )

  return new Set((result.rows || []).map((row) => String(row.column_name || '').trim()).filter(Boolean))
}

async function tableExists(pool, tableName) {
  const result = await pool.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = $1
      LIMIT 1
    `,
    [tableName]
  )

  return (result.rowCount || 0) > 0
}

function toSingularTableName(tableName) {
  return tableName.endsWith('s') ? tableName.slice(0, -1) : tableName
}

async function resolveRelationStorage(pool, options) {
  const directColumn = options.directColumnCandidates.find((column) => options.baseColumns.has(column)) || null
  if (directColumn) {
    return {
      mode: 'direct-column',
      directColumn,
    }
  }

  const singularBase = toSingularTableName(options.baseTable)
  const singularTarget = toSingularTableName(options.targetTable)
  const linkTableCandidates = [
    `${options.baseTable}_${options.relationName}_lnk`,
    `${singularBase}_${options.relationName}_lnk`,
    `${options.baseTable}_${singularTarget}_lnk`,
    `${singularBase}_${singularTarget}_lnk`,
    `${options.targetTable}_${options.baseTable}_lnk`,
    `${options.targetTable}_${singularBase}_lnk`,
  ]

  for (const linkTable of linkTableCandidates) {
    if (!(await tableExists(pool, linkTable))) continue

    const columns = await listTableColumns(pool, linkTable)
    const baseLinkColumn = options.baseLinkColumnCandidates.find((column) => columns.has(column)) || null
    const targetLinkColumn = options.targetLinkColumnCandidates.find((column) => columns.has(column)) || null

    if (baseLinkColumn && targetLinkColumn) {
      return {
        mode: 'link-table',
        linkTable,
        baseLinkColumn,
        targetLinkColumn,
      }
    }
  }

  return { mode: 'none' }
}

async function resolveAdmissionStorage(pool) {
  const columns = await listTableColumns(pool, ADMISSION_APPLICATION_TABLE)

  if (!columns.has('id') || !columns.has('form_data')) {
    throw new Error(`Table ${ADMISSION_APPLICATION_TABLE} is missing required columns id/form_data`)
  }

  const tenant = await resolveRelationStorage(pool, {
    baseTable: ADMISSION_APPLICATION_TABLE,
    targetTable: TENANT_TABLE,
    relationName: 'tenant',
    baseColumns: columns,
    directColumnCandidates: TENANT_COLUMN_CANDIDATES,
    baseLinkColumnCandidates: ADMISSION_APPLICATION_COLUMN_CANDIDATES,
    targetLinkColumnCandidates: TENANT_LINK_COLUMN_CANDIDATES,
  })

  const campaign = await resolveRelationStorage(pool, {
    baseTable: ADMISSION_APPLICATION_TABLE,
    targetTable: CAMPAIGN_TABLE,
    relationName: 'campaign',
    baseColumns: columns,
    directColumnCandidates: CAMPAIGN_COLUMN_CANDIDATES,
    baseLinkColumnCandidates: ADMISSION_APPLICATION_COLUMN_CANDIDATES,
    targetLinkColumnCandidates: CAMPAIGN_LINK_COLUMN_CANDIDATES,
  })

  return {
    tenant,
    campaign,
  }
}

function createApplicationResult(row) {
  return {
    applicationId: row.id,
    applicationCode: row.application_code,
    tenantCode: row.tenant_code,
    campaignCode: row.campaign_code,
    changed: false,
    filesFound: 0,
    filesMigrated: 0,
    filesSkipped: 0,
    errors: 0,
    warnings: [],
  }
}

async function ensureWrittenFile(absolutePath, buffer) {
  await fse.ensureDir(path.dirname(absolutePath))
  await fse.writeFile(absolutePath, buffer)
}

async function removeWrittenFiles(pathsToDelete) {
  for (const filePath of pathsToDelete) {
    if (!filePath) continue
    try {
      await fse.remove(filePath)
    } catch {
      // ignore cleanup failure
    }
  }
}

async function migrateValue(value, context) {
  if (Array.isArray(value)) {
    const nextArray = []
    for (let index = 0; index < value.length; index += 1) {
      nextArray.push(await migrateValue(value[index], { ...context, path: `${context.path}[${index}]` }))
    }
    return nextArray
  }

  if (!isRecord(value)) {
    return value
  }

  if (shouldSkipMigratedFile(value)) {
    context.result.filesSkipped += 1
    context.summary.filesSkipped += 1
    return { ...value }
  }

  if (String(value.url || '').trim() && !String(value.dataUrl || '').trim()) {
    context.result.filesSkipped += 1
    context.summary.filesSkipped += 1
    return { ...value }
  }

  if (isLegacyDataUrlFile(value)) {
    context.result.filesFound += 1
    context.summary.filesFound += 1

    const fileName = String(value.name || '').trim() || 'Tep dinh kem'
    const fieldPath = context.path || 'formData'
    const declaredType = String(value.type || '').trim().toLowerCase()

    try {
      const parsed = parseDataUrl(value.dataUrl)
      const mimeType = parsed.mimeType || declaredType || 'application/octet-stream'
      const relativeUploadPath = resolveRelativeUploadPath({
        tenantCode: context.row.tenant_code,
        campaignCode: context.row.campaign_code,
        applicationId: context.row.id,
        fieldPath,
        fileName,
        mimeType,
        index: context.fileIndexRef.current,
      })
      context.fileIndexRef.current += 1

      const absoluteUploadPath = path.resolve(PUBLIC_UPLOADS_ROOT, relativeUploadPath)
      const publicUrl = `/uploads/${relativeUploadPath.replace(/\\/g, '/')}`
      const migratedAt = new Date().toISOString()

      log(`Application ${context.row.id} file candidate`, {
        fieldPath,
        fileName,
        mimeType,
        estimatedSize: parsed.buffer.length,
        mode: context.options.mode,
      })

      if (context.options.mode === 'apply') {
        await ensureWrittenFile(absoluteUploadPath, parsed.buffer)
        context.writtenFiles.push(absoluteUploadPath)
      }

      context.result.changed = true
      context.result.filesMigrated += 1
      context.summary.filesMigrated += 1

      return createMigratedFileMeta({
        file: value,
        url: publicUrl,
        mimeType,
        migratedAt,
      })
    } catch (error) {
      context.result.errors += 1
      context.summary.errors += 1
      warn(`Application ${context.row.id} file migration failed`, {
        fieldPath,
        fileName,
        error: error instanceof Error ? error.message : String(error),
      })
      return { ...value }
    }
  }

  const nextRecord = {}
  const entries = Object.entries(value)
  for (const [key, item] of entries) {
    const nextPath = context.path ? `${context.path}.${key}` : key
    nextRecord[key] = await migrateValue(item, { ...context, path: nextPath })
  }
  return nextRecord
}

function buildBaseQuery(filters, storage, limit, offset) {
  const whereClauses = []
  const values = []
  const tenantJoinSql = storage.tenant.mode === 'direct-column'
    ? `LEFT JOIN ${TENANT_TABLE} t ON t.id = aa.${storage.tenant.directColumn}`
    : storage.tenant.mode === 'link-table'
      ? `LEFT JOIN ${storage.tenant.linkTable} tenant_link ON tenant_link.${storage.tenant.baseLinkColumn} = aa.id
         LEFT JOIN ${TENANT_TABLE} t ON t.id = tenant_link.${storage.tenant.targetLinkColumn}`
      : ''
  const campaignJoinSql = storage.campaign.mode === 'direct-column'
    ? `LEFT JOIN ${CAMPAIGN_TABLE} c ON c.id = aa.${storage.campaign.directColumn}`
    : storage.campaign.mode === 'link-table'
      ? `LEFT JOIN ${storage.campaign.linkTable} campaign_link ON campaign_link.${storage.campaign.baseLinkColumn} = aa.id
         LEFT JOIN ${CAMPAIGN_TABLE} c ON c.id = campaign_link.${storage.campaign.targetLinkColumn}`
      : ''
  const tenantCodeSelect = storage.tenant.mode === 'direct-column'
    ? `COALESCE(t.code, aa.${storage.tenant.directColumn}::text) AS tenant_code`
    : storage.tenant.mode === 'link-table'
      ? `COALESCE(t.code, tenant_link.${storage.tenant.targetLinkColumn}::text) AS tenant_code`
      : `NULL::text AS tenant_code`
  const campaignCodeSelect = storage.campaign.mode === 'direct-column'
    ? `COALESCE(c.code, aa.${storage.campaign.directColumn}::text) AS campaign_code`
    : storage.campaign.mode === 'link-table'
      ? `COALESCE(c.code, campaign_link.${storage.campaign.targetLinkColumn}::text) AS campaign_code`
      : `NULL::text AS campaign_code`
  const tenantIdSelect = storage.tenant.mode === 'direct-column'
    ? `aa.${storage.tenant.directColumn} AS tenant_ref`
    : storage.tenant.mode === 'link-table'
      ? `tenant_link.${storage.tenant.targetLinkColumn} AS tenant_ref`
      : `NULL::integer AS tenant_ref`
  const campaignIdSelect = storage.campaign.mode === 'direct-column'
    ? `aa.${storage.campaign.directColumn} AS campaign_ref`
    : storage.campaign.mode === 'link-table'
      ? `campaign_link.${storage.campaign.targetLinkColumn} AS campaign_ref`
      : `NULL::integer AS campaign_ref`

  if (filters.tenant) {
    if (storage.tenant.mode === 'none') {
      throw new Error(`Tenant filter requested but no tenant relation storage was found for ${ADMISSION_APPLICATION_TABLE}`)
    }

    values.push(filters.tenant)
    const index = values.length
    if (storage.tenant.mode === 'direct-column') {
      whereClauses.push(`(aa.${storage.tenant.directColumn}::text = $${index} OR LOWER(t.code) = LOWER($${index}))`)
    } else {
      whereClauses.push(`(tenant_link.${storage.tenant.targetLinkColumn}::text = $${index} OR LOWER(t.code) = LOWER($${index}))`)
    }
  }

  if (filters.campaign) {
    if (storage.campaign.mode === 'none') {
      throw new Error(`Campaign filter requested but no campaign relation storage was found for ${ADMISSION_APPLICATION_TABLE}`)
    }

    values.push(filters.campaign)
    const index = values.length
    if (storage.campaign.mode === 'direct-column') {
      whereClauses.push(`(aa.${storage.campaign.directColumn}::text = $${index} OR LOWER(c.code) = LOWER($${index}))`)
    } else {
      whereClauses.push(`(campaign_link.${storage.campaign.targetLinkColumn}::text = $${index} OR LOWER(c.code) = LOWER($${index}))`)
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  values.push(limit)
  const limitIndex = values.length
  values.push(offset)
  const offsetIndex = values.length

  return {
    sql: `
      SELECT
        aa.id,
        aa.application_code,
        aa.form_data,
        aa.review_snapshot,
        aa.updated_at,
        ${tenantIdSelect},
        ${campaignIdSelect},
        ${tenantCodeSelect},
        ${campaignCodeSelect}
      FROM ${ADMISSION_APPLICATION_TABLE} aa
      ${tenantJoinSql}
      ${campaignJoinSql}
      ${whereSql}
      ORDER BY aa.id ASC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    values,
  }
}

async function updateApplication(client, row, nextFormData) {
  await client.query(
    `
      UPDATE admission_applications
      SET form_data = $2, review_snapshot = NULL, updated_at = NOW()
      WHERE id = $1
    `,
    [row.id, nextFormData]
  )
}

async function processApplication(client, row, options, summary, writtenFiles) {
  const result = createApplicationResult(row)
  summary.totalApplicationsScanned += 1

  const sourceFormData = isRecord(row.form_data) ? row.form_data : Array.isArray(row.form_data) ? row.form_data : null
  if (!sourceFormData) {
    return result
  }

  const fileIndexRef = { current: 0 }
  const migratedFormData = await migrateValue(cloneValue(sourceFormData), {
    row,
    options,
    summary,
    result,
    path: '',
    fileIndexRef,
    writtenFiles,
  })

  if (result.changed) {
    summary.applicationsNeedingMigration += 1
  }

  if (options.mode === 'apply' && result.changed) {
    await updateApplication(client, row, migratedFormData)
  }

  return result
}

async function main() {
  loadEnvFile()
  const options = parseArgs(process.argv.slice(2))
  const pool = createPostgresPool()
  const summary = createSummary()

  log('Starting admission dataUrl migration', {
    mode: options.mode,
    tenant: options.tenant || null,
    campaign: options.campaign || null,
    limit: options.limit || null,
  })

  try {
    const storage = await resolveAdmissionStorage(pool)
    log('Detected admission relation storage', storage)
    const batchSize = options.limit > 0 ? Math.min(options.limit, DEFAULT_BATCH_SIZE) : DEFAULT_BATCH_SIZE
    let offset = 0
    let processed = 0

    while (true) {
      const remaining = options.limit > 0 ? options.limit - processed : batchSize
      if (options.limit > 0 && remaining <= 0) break

      const queryLimit = options.limit > 0 ? Math.min(batchSize, remaining) : batchSize
      const query = buildBaseQuery(options, storage, queryLimit, offset)
      const rows = await pool.query(query.sql, query.values)
      const batch = rows.rows || []
      if (batch.length === 0) break

      for (const row of batch) {
        const client = await pool.connect()
        const writtenFiles = []
        try {
          if (options.mode === 'apply') {
            await client.query('BEGIN')
          }

          const result = await processApplication(client, row, options, summary, writtenFiles)

          if (options.mode === 'apply') {
            await client.query('COMMIT')
          }

          if (result.changed || result.errors > 0) {
            log(`Application ${row.id} processed`, {
              applicationCode: row.application_code,
              filesFound: result.filesFound,
              filesMigrated: result.filesMigrated,
              filesSkipped: result.filesSkipped,
              errors: result.errors,
            })
          }
        } catch (error) {
          if (options.mode === 'apply') {
            try {
              await client.query('ROLLBACK')
            } catch {
              // ignore rollback failure
            }

            await removeWrittenFiles(writtenFiles)
          }

          summary.errors += 1
          warn(`Application ${row.id} processing failed`, {
            applicationCode: row.application_code,
            error: error instanceof Error ? error.message : String(error),
          })
        } finally {
          client.release()
        }

        processed += 1
      }

      offset += batch.length
    }

    log('Admission dataUrl migration completed', summary)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] Admission dataUrl migration failed:`)
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})