const fs = require('fs')
const path = require('path')
const crypto = require('node:crypto')
const bcrypt = require('bcryptjs')
const { Client } = require('pg')

const BASE_URL = String(process.env.STRAPI_BASE_URL || 'http://localhost:1340').replace(/\/+$/, '')
const HTTP_TIMEOUT_MS = Number(process.env.PROBE_HTTP_TIMEOUT_MS || 10000)
const TMP_DIR = path.join(__dirname, '..', '.tmp')
const RUN_ID = `PROBE_EXAM_REG_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`
const CREATED_AT = new Date().toISOString()

const argv = process.argv.slice(2)
const options = {
  setupOnly: argv.includes('--setup-only'),
  keepFixtures: argv.includes('--keep-fixtures'),
  dryRun: argv.includes('--dry-run'),
  cleanupOnly: argv.includes('--cleanup'),
  cleanupManifestFile: (() => {
    const index = argv.indexOf('--cleanup')
    return index >= 0 ? argv[index + 1] || '' : ''
  })(),
}

if (options.setupOnly) {
  options.keepFixtures = true
}

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

const env = {}
for (const rawLine of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || line.startsWith('#')) continue
  const idx = line.indexOf('=')
  if (idx === -1) continue
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
}

const manifest = {
  runId: RUN_ID,
  createdAt: CREATED_AT,
  baseUrl: BASE_URL,
  dryRun: options.dryRun === true,
  externalFixture: {
    tenantIds: [],
    mediaIds: [],
  },
  tenantIds: [],
  userIds: [],
  learnerIds: [],
  roundIds: [],
  subjectIds: [],
  componentIds: [],
  eligibilityIds: [],
  registrationIds: [],
  registrationComponentIds: [],
  mediaIds: [],
  registrationSubjectIds: [],
  userTenantIds: [],
  userTenantRoleIds: [],
  programIds: [],
  examSubjectCatalogIds: [],
  examComponentCatalogIds: [],
  records: {
    tenants: [],
    users: [],
    learners: [],
    programs: [],
    examSubjects: [],
    examComponents: [],
    rounds: [],
    roundSubjects: [],
    roundComponents: [],
    eligibilities: [],
    registrations: [],
    registrationSubjects: [],
    registrationComponents: [],
    media: [],
    userTenants: [],
    userTenantRoles: [],
  },
}

const manifestFilePath = path.join(TMP_DIR, `probe-exam-registration-${manifest.runId}.json`)
const cases = []
const cleanupSummary = []

function logSection(section, message) {
  console.log(`[${section}] ${message}`)
}

function addCase(name, status, httpStatus, businessCode, recordCount, note) {
  cases.push({ name, status, httpStatus, businessCode, recordCount, note })
}

function printCaseSummary() {
  console.log('Case | PASS/FAIL/SKIP | HTTP status | Business code | Record count | Ghi chú')
  for (const item of cases) {
    console.log([
      item.name,
      item.status,
      item.httpStatus ?? '-',
      item.businessCode ?? '-',
      item.recordCount ?? '-',
      item.note ?? '-',
    ].join(' | '))
  }
}

function printCleanupSummary() {
  if (cleanupSummary.length === 0) return
  console.log('Entity | Created | Deleted | Remaining | Status')
  for (const item of cleanupSummary) {
    console.log([
      item.entity,
      item.created,
      item.deleted,
      item.remaining,
      item.status,
    ].join(' | '))
  }
}

function saveManifest(filePath = manifestFilePath) {
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2))
}

function ensureArrayValue(target, key, value) {
  if (!Number.isInteger(Number(value)) || Number(value) <= 0) return
  const parsed = Number(value)
  if (!Array.isArray(target[key])) target[key] = []
  if (!target[key].includes(parsed)) {
    target[key].push(parsed)
  }
}

function recordManifestEntry(category, shape, idArrayName) {
  if (!shape || !Number.isInteger(Number(shape.id)) || Number(shape.id) <= 0) return shape
  const entry = { ...shape, runId: manifest.runId }
  if (!Array.isArray(manifest.records[category])) {
    manifest.records[category] = []
  }
  if (!manifest.records[category].some((item) => Number(item.id) === Number(entry.id))) {
    manifest.records[category].push(entry)
  }
  if (idArrayName) {
    ensureArrayValue(manifest, idArrayName, entry.id)
  }
  saveManifest()
  return shape
}

function removeFileIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    // keep manifest when deletion fails
  }
}

function randomCode(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

function randomDocumentId() {
  return crypto.randomBytes(12).toString('hex')
}

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString()
}

function maskAccount(value) {
  const text = String(value || '').trim()
  if (!text) return null
  return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`
}

function parseResponseBody(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function unwrapPayload(data) {
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return data.data
  }
  if (data && typeof data === 'object' && 'data' in data) {
    return data.data
  }
  return data
}

async function createDbClient() {
  const client = new Client({
    host: env.DATABASE_HOST,
    port: Number(env.DATABASE_PORT || 5432),
    database: env.DATABASE_NAME,
    user: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    ssl: String(env.DATABASE_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  })
  await client.connect()
  return client
}

async function httpRequest(method, pathname, optionsInput = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
  try {
    const response = await fetch(`${BASE_URL}${pathname}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(optionsInput.headers || {}),
      },
      body: typeof optionsInput.body === 'undefined' ? undefined : JSON.stringify(optionsInput.body),
      signal: controller.signal,
    })
    const text = await response.text()
    const data = parseResponseBody(text)
    return { response, data }
  } finally {
    clearTimeout(timer)
  }
}

async function ensureServerReady() {
  logSection('SETUP', `Checking live server at ${BASE_URL}`)
  let adminResponse
  try {
    adminResponse = await httpRequest('GET', '/admin')
  } catch (error) {
    addCase('Server ready', 'FAIL', null, 'SERVER_NOT_READY', null, String(error?.message || error))
    return false
  }

  if (adminResponse.response.status !== 200) {
    addCase('Server ready', 'FAIL', adminResponse.response.status, 'SERVER_NOT_READY', null, `Expected 200 from ${BASE_URL}/admin`)
    return false
  }

  addCase('Server ready', 'PASS', 200, null, null, BASE_URL)
  return true
}

async function detectUserRoleLinkTable(client) {
  const result = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('up_users_role_lnk', 'up_users_roles_lnk')
    order by table_name asc
  `)
  return result.rows[0]?.table_name || null
}

async function resolveRoles(client) {
  const authenticated = await client.query(`select id from up_roles where type = 'authenticated' order by id asc limit 1`)
  const featureRole = await client.query(`
    select r.id
    from up_roles r
    join role_features rf on rf.role_id = r.id
    join role_features_feature_lnk rff on rff.role_feature_id = rf.id
    join features f on f.id = rff.feature_id
    where f.key = 'exam-registration.self'
    order by r.id asc
    limit 1
  `)
  return {
    authenticatedRoleId: Number(authenticated.rows[0]?.id || 0) || null,
    featureRoleId: Number(featureRole.rows[0]?.id || 0) || null,
  }
}

async function insertRow(client, table, data) {
  if (options.dryRun) {
    return { id: Math.floor(Math.random() * 1000000), ...data }
  }
  const columns = Object.keys(data)
  const values = Object.values(data)
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
  const sql = `insert into ${table} (${columns.join(', ')}) values (${placeholders}) returning *`
  const result = await client.query(sql, values)
  return result.rows[0]
}

async function insertLink(client, table, data) {
  await insertRow(client, table, data)
}

async function createProbeUser(client, optionsInput) {
  const passwordPlain = `P@ss_${crypto.randomBytes(4).toString('hex')}`
  const passwordHash = await bcrypt.hash(passwordPlain, 10)
  const user = await insertRow(client, 'up_users', {
    document_id: randomDocumentId(),
    username: optionsInput.username,
    email: optionsInput.email,
    full_name: optionsInput.fullName,
    provider: 'local',
    password: passwordHash,
    confirmed: true,
    blocked: false,
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })

  recordManifestEntry('users', {
    id: user.id,
    username: optionsInput.username,
    email: optionsInput.email,
  }, 'userIds')

  if (optionsInput.userRoleLinkTable && optionsInput.authenticatedRoleId) {
    await insertLink(client, optionsInput.userRoleLinkTable, {
      user_id: user.id,
      role_id: optionsInput.authenticatedRoleId,
    })
  }

  return { user, passwordPlain }
}

async function attachUserToTenant(client, userId, tenantId, featureRoleId, label) {
  const userTenant = await insertRow(client, 'user_tenants', {
    document_id: randomDocumentId(),
    user_tenant_status: 'active',
    is_default: true,
    joined_at: nowIso(),
    label,
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  await insertLink(client, 'user_tenants_user_lnk', { user_tenant_id: userTenant.id, user_id: userId })
  await insertLink(client, 'user_tenants_tenant_lnk', { user_tenant_id: userTenant.id, tenant_id: tenantId, user_tenant_ord: 1 })

  const userTenantRole = await insertRow(client, 'user_tenant_roles', {
    document_id: randomDocumentId(),
    user_tenant_role_status: 'active',
    is_primary: true,
    assigned_at: nowIso(),
    label,
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  await insertLink(client, 'user_tenant_roles_user_tenant_lnk', { user_tenant_role_id: userTenantRole.id, user_tenant_id: userTenant.id, user_tenant_role_ord: 1 })
  await insertLink(client, 'user_tenant_roles_role_lnk', { user_tenant_role_id: userTenantRole.id, role_id: featureRoleId })

  recordManifestEntry('userTenants', { id: userTenant.id, label }, 'userTenantIds')
  recordManifestEntry('userTenantRoles', { id: userTenantRole.id, label }, 'userTenantRoleIds')

  return { userTenantId: userTenant.id, userTenantRoleId: userTenantRole.id }
}

async function createTenantFixture(client, code) {
  const tenant = await insertRow(client, 'tenants', {
    document_id: randomDocumentId(),
    name: `Probe Tenant ${code}`,
    code,
    tenant_status: 'active',
    site_title: `Probe Tenant ${code}`,
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  recordManifestEntry('tenants', { id: tenant.id, code }, 'tenantIds')
  return tenant
}

async function createLearnerFixture(client, tenantId, userId, code, fullName) {
  const learner = await insertRow(client, 'learners', {
    document_id: randomDocumentId(),
    code,
    full_name: fullName,
    date_of_birth: '2000-01-01',
    parent_phone: '0900000000',
    learner_status: 'active',
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  await insertLink(client, 'learners_user_lnk', { learner_id: learner.id, user_id: userId })
  await insertLink(client, 'learners_tenant_lnk', { learner_id: learner.id, tenant_id: tenantId })
  recordManifestEntry('learners', { id: learner.id, code }, 'learnerIds')
  return learner
}

async function createExamProgramFixture(client, tenantId, code) {
  const program = await insertRow(client, 'exam_programs', {
    document_id: randomDocumentId(),
    code,
    name: `Program ${code}`,
    passing_method: 'all_subjects_pass',
    fee_calculation_method: 'sum_subject_fees',
    default_fee: '0',
    is_active: true,
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  await insertLink(client, 'exam_programs_tenant_lnk', { exam_program_id: program.id, tenant_id: tenantId })
  recordManifestEntry('programs', { id: program.id, code }, 'programIds')
  return program
}

async function createExamSubjectFixture(client, tenantId, code, name) {
  const subject = await insertRow(client, 'exam_subjects', {
    document_id: randomDocumentId(),
    code,
    name,
    calculation_method: 'total',
    required_aggregate_score: '50',
    require_all_components: true,
    default_fee: '0',
    is_active: true,
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  await insertLink(client, 'exam_subjects_tenant_lnk', { exam_subject_id: subject.id, tenant_id: tenantId })
  recordManifestEntry('examSubjects', { id: subject.id, code }, 'examSubjectCatalogIds')
  return subject
}

async function createExamComponentFixture(client, tenantId, code, name, method) {
  const component = await insertRow(client, 'exam_components', {
    document_id: randomDocumentId(),
    code,
    name,
    component_type: 'skill',
    minimum_score: '0',
    maximum_score: '100',
    passing_score: '50',
    default_duration_minutes: 60,
    exam_method: method,
    is_active: true,
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  await insertLink(client, 'exam_components_tenant_lnk', { exam_component_id: component.id, tenant_id: tenantId })
  recordManifestEntry('examComponents', { id: component.id, code }, 'examComponentCatalogIds')
  return component
}

async function createUploadFileFixture(client, label) {
  const file = await insertRow(client, 'files', {
    document_id: randomDocumentId(),
    name: `${label}.png`,
    alternative_text: label,
    caption: label,
    width: 64,
    height: 64,
    formats: '{}',
    hash: `${label}-${crypto.randomBytes(4).toString('hex')}`,
    ext: '.png',
    mime: 'image/png',
    size: '1',
    url: `/uploads/${label}.png`,
    provider: 'local',
    folder_path: '/probe',
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  recordManifestEntry('media', { id: file.id, label, externalFixture: false }, 'mediaIds')
  return file
}

async function attachMorph(client, fileId, relatedType, relatedId, field) {
  await insertRow(client, 'files_related_mph', { file_id: fileId, related_id: relatedId, related_type: relatedType, field, order: 1 })
}

async function createRoundFixture(client, tenantId, programId, fileId, mode) {
  const code = randomCode(`${manifest.runId}_${mode}`).slice(0, 90)
  const round = await insertRow(client, 'exam_rounds', {
    document_id: randomDocumentId(),
    code,
    name: `Round ${code}`,
    academic_year: '2026-2027',
    semester: '1',
    registration_mode: mode === 'restricted' ? 'restricted' : 'open',
    registration_start_at: nowIso(-60 * 60 * 1000),
    registration_end_at: nowIso(60 * 60 * 1000),
    payment_start_at: nowIso(-60 * 60 * 1000),
    payment_end_at: nowIso(2 * 60 * 60 * 1000),
    exam_start_at: nowIso(24 * 60 * 60 * 1000),
    exam_end_at: nowIso(25 * 60 * 60 * 1000),
    payment_calculation_method: 'component_fee',
    fixed_fee: null,
    allow_subject_selection: true,
    allow_component_selection: true,
    require_confirmed_payment: false,
    allow_cancellation: false,
    instructions: '<p>Probe instruction</p>',
    payment_instructions: '<p>Probe payment instruction</p>',
    payment_method_snapshot: mode === 'free' ? null : 'bank_transfer',
    payment_profile_name_snapshot: mode === 'free' ? null : `Profile ${code}`,
    payment_profile_code_snapshot: mode === 'free' ? null : code,
    payment_bank_code_snapshot: mode === 'free' ? null : 'VCB',
    payment_bank_name_snapshot: mode === 'free' ? null : `Probe Bank ${code}`,
    payment_account_number_snapshot: mode === 'invalid' ? null : (mode === 'free' ? null : '001234560001'),
    payment_account_holder_snapshot: mode === 'free' ? null : `Holder ${code}`,
    payment_bank_branch_snapshot: mode === 'free' ? null : 'Main Branch',
    payment_currency_snapshot: mode === 'free' ? null : 'VND',
    payment_transfer_content_template_snapshot: mode === 'free' ? null : '{registrationCode} {learnerCode} {roundCode}',
    payment_instruction_snapshot: mode === 'free' ? null : '<p>Transfer instruction</p>',
    payment_support_phone_snapshot: mode === 'free' ? null : '0900999888',
    payment_support_email_snapshot: mode === 'free' ? null : 'probe@example.com',
    payment_profile_customized: false,
    status: 'registration_open',
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  await insertLink(client, 'exam_rounds_exam_program_lnk', { exam_round_id: round.id, exam_program_id: programId, exam_round_ord: 1 })
  await insertLink(client, 'exam_rounds_tenant_lnk', { exam_round_id: round.id, tenant_id: tenantId })
  if (mode !== 'free') {
    await attachMorph(client, fileId, 'api::exam-round.exam-round', round.id, 'paymentQrImageSnapshot')
  }
  recordManifestEntry('rounds', { id: round.id, code, mode }, 'roundIds')
  return round
}

async function createRoundSubjectFixture(client, tenantId, roundId, subjectId, name, isRequired, allowSeparate, fee) {
  const row = await insertRow(client, 'exam_round_subjects', {
    document_id: randomDocumentId(),
    name_snapshot: name,
    calculation_method_snapshot: 'total',
    required_aggregate_score_snapshot: '50',
    require_all_components_snapshot: isRequired ? true : false,
    rule_description_snapshot: null,
    fee,
    is_required: isRequired,
    allow_separate_registration: allowSeparate,
    display_order: isRequired ? 1 : 2,
    status: 'active',
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  const ord = isRequired ? 1 : 2
  await insertLink(client, 'exam_round_subjects_exam_round_lnk', { exam_round_subject_id: row.id, exam_round_id: roundId, exam_round_subject_ord: ord })
  await insertLink(client, 'exam_round_subjects_exam_subject_lnk', { exam_round_subject_id: row.id, exam_subject_id: subjectId, exam_round_subject_ord: ord })
  await insertLink(client, 'exam_round_subjects_tenant_lnk', { exam_round_subject_id: row.id, tenant_id: tenantId })
  recordManifestEntry('roundSubjects', { id: row.id, name, roundId }, 'subjectIds')
  return row
}

async function createRoundComponentFixture(client, tenantId, roundId, roundSubjectId, componentId, name, isRequired, allowSeparate, fee, examMethod, displayOrder) {
  const row = await insertRow(client, 'exam_round_components', {
    document_id: randomDocumentId(),
    name_snapshot: name,
    minimum_score_snapshot: '0',
    maximum_score_snapshot: '100',
    passing_score_snapshot: '50',
    elimination_score_snapshot: null,
    duration_minutes: examMethod === 'paper' ? 45 : 60,
    exam_method: examMethod,
    fee,
    is_required: isRequired,
    allow_separate_registration: allowSeparate,
    external_exam_code: null,
    display_order: displayOrder,
    status: 'active',
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  await insertLink(client, 'exam_round_components_exam_round_lnk', { exam_round_component_id: row.id, exam_round_id: roundId, exam_round_component_ord: displayOrder })
  await insertLink(client, 'exam_round_components_exam_round_subject_lnk', { exam_round_component_id: row.id, exam_round_subject_id: roundSubjectId, exam_round_component_ord: displayOrder })
  await insertLink(client, 'exam_round_components_exam_component_lnk', { exam_round_component_id: row.id, exam_component_id: componentId, exam_round_component_ord: displayOrder })
  await insertLink(client, 'exam_round_components_tenant_lnk', { exam_round_component_id: row.id, tenant_id: tenantId })
  recordManifestEntry('roundComponents', { id: row.id, name, roundId }, 'componentIds')
  return row
}

async function createEligibilityFixture(client, tenantId, roundId, learnerId, status) {
  const row = await insertRow(client, 'exam_eligibilities', {
    document_id: randomDocumentId(),
    source: 'manual',
    eligibility_status: status,
    reason: status === 'ineligible' ? 'Probe ineligible' : null,
    note: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    published_at: nowIso(),
  })
  await insertLink(client, 'exam_eligibilities_exam_round_lnk', { exam_eligibility_id: row.id, exam_round_id: roundId, exam_eligibility_ord: 1 })
  await insertLink(client, 'exam_eligibilities_learner_lnk', { exam_eligibility_id: row.id, learner_id: learnerId })
  await insertLink(client, 'exam_eligibilities_tenant_lnk', { exam_eligibility_id: row.id, tenant_id: tenantId })
  recordManifestEntry('eligibilities', { id: row.id, status, roundId }, 'eligibilityIds')
  return row
}

async function buildFixture(client) {
  logSection('SETUP', `Creating fixture for ${manifest.runId}`)
  const userRoleLinkTable = await detectUserRoleLinkTable(client)
  const { authenticatedRoleId, featureRoleId } = await resolveRoles(client)
  manifest.featureRoleId = featureRoleId
  manifest.authenticatedRoleId = authenticatedRoleId
   if (!featureRoleId) throw new Error('No role with feature exam-registration.self was found in DB')

   const tenant = await createTenantFixture(client, `${manifest.runId.toLowerCase()}_tenant`)
   const outsiderTenant = await createTenantFixture(client, `${manifest.runId.toLowerCase()}_tenant_other`)

   const ownerUserInfo = await createProbeUser(client, {
     username: `${manifest.runId.toLowerCase()}_owner`,
     email: `${manifest.runId.toLowerCase()}_owner@example.com`,
     fullName: 'Probe Owner',
     userRoleLinkTable,
     authenticatedRoleId,
   })
   const sameTenantUserInfo = await createProbeUser(client, {
     username: `${manifest.runId.toLowerCase()}_other`,
     email: `${manifest.runId.toLowerCase()}_other@example.com`,
     fullName: 'Probe Other',
     userRoleLinkTable,
     authenticatedRoleId,
   })
   const outsiderUserInfo = await createProbeUser(client, {
     username: `${manifest.runId.toLowerCase()}_outsider`,
     email: `${manifest.runId.toLowerCase()}_outsider@example.com`,
     fullName: 'Probe Outsider',
     userRoleLinkTable,
     authenticatedRoleId,
   })

   await attachUserToTenant(client, ownerUserInfo.user.id, tenant.id, featureRoleId, `${manifest.runId} owner membership`)
   await attachUserToTenant(client, sameTenantUserInfo.user.id, tenant.id, featureRoleId, `${manifest.runId} same-tenant membership`)
   await attachUserToTenant(client, outsiderUserInfo.user.id, outsiderTenant.id, featureRoleId, `${manifest.runId} outsider membership`)

   const ownerLearner = await createLearnerFixture(client, tenant.id, ownerUserInfo.user.id, `${manifest.runId}_LEARNER`, 'Probe Learner Owner')
   const sameTenantLearner = await createLearnerFixture(client, tenant.id, sameTenantUserInfo.user.id, `${manifest.runId}_LEARNER_B`, 'Probe Learner Other')
   const outsiderLearner = await createLearnerFixture(client, outsiderTenant.id, outsiderUserInfo.user.id, `${manifest.runId}_LEARNER_C`, 'Probe Learner Outsider')

   const program = await createExamProgramFixture(client, tenant.id, `${manifest.runId}_PROGRAM`)
   const subjectRequired = await createExamSubjectFixture(client, tenant.id, `${manifest.runId}_SUB_REQ`, 'Probe Subject Required')
   const subjectOptional = await createExamSubjectFixture(client, tenant.id, `${manifest.runId}_SUB_OPT`, 'Probe Subject Optional')
   const componentRequired = await createExamComponentFixture(client, tenant.id, `${manifest.runId}_CMP_REQ`, 'Probe Component Required', 'computer')
   const componentOptional = await createExamComponentFixture(client, tenant.id, `${manifest.runId}_CMP_OPT`, 'Probe Component Optional', 'paper')
   const qrFileA = await createUploadFileFixture(client, `${manifest.runId}_qr_a`)
   const qrFileB = await createUploadFileFixture(client, `${manifest.runId}_qr_b`)

   const paidRound = await createRoundFixture(client, tenant.id, program.id, qrFileA.id, 'paid')
   const freeRound = await createRoundFixture(client, tenant.id, program.id, qrFileA.id, 'free')
   const invalidRound = await createRoundFixture(client, tenant.id, program.id, qrFileA.id, 'invalid')
   const restrictedRound = await createRoundFixture(client, tenant.id, program.id, qrFileA.id, 'restricted')

   const paidSubjectRequired = await createRoundSubjectFixture(client, tenant.id, paidRound.id, subjectRequired.id, 'Probe Paid Subject Required', true, false, '70000')
   const paidSubjectOptional = await createRoundSubjectFixture(client, tenant.id, paidRound.id, subjectOptional.id, 'Probe Paid Subject Optional', false, true, '90000')
   const freeSubjectRequired = await createRoundSubjectFixture(client, tenant.id, freeRound.id, subjectRequired.id, 'Probe Free Subject Required', true, false, '0')
   const invalidSubjectRequired = await createRoundSubjectFixture(client, tenant.id, invalidRound.id, subjectRequired.id, 'Probe Invalid Subject Required', true, false, '70000')
   const restrictedSubjectRequired = await createRoundSubjectFixture(client, tenant.id, restrictedRound.id, subjectRequired.id, 'Probe Restricted Subject Required', true, false, '70000')

   const paidComponentRequired = await createRoundComponentFixture(client, tenant.id, paidRound.id, paidSubjectRequired.id, componentRequired.id, 'Probe Paid Component Required', true, false, '110000', 'computer', 1)
   const paidComponentOptional = await createRoundComponentFixture(client, tenant.id, paidRound.id, paidSubjectOptional.id, componentOptional.id, 'Probe Paid Component Optional', false, true, '130000', 'paper', 2)
   const freeComponentRequired = await createRoundComponentFixture(client, tenant.id, freeRound.id, freeSubjectRequired.id, componentRequired.id, 'Probe Free Component Required', true, false, '0', 'computer', 1)
   const invalidComponentRequired = await createRoundComponentFixture(client, tenant.id, invalidRound.id, invalidSubjectRequired.id, componentRequired.id, 'Probe Invalid Component Required', true, false, '110000', 'computer', 1)
   const restrictedComponentRequired = await createRoundComponentFixture(client, tenant.id, restrictedRound.id, restrictedSubjectRequired.id, componentRequired.id, 'Probe Restricted Component Required', true, false, '110000', 'computer', 1)

   await createEligibilityFixture(client, tenant.id, restrictedRound.id, ownerLearner.id, 'eligible')

   return {
     tenant,
     outsiderTenant,
     ownerUserInfo,
     sameTenantUserInfo,
     outsiderUserInfo,
     ownerLearner,
     sameTenantLearner,
     outsiderLearner,
     qrFileA,
     qrFileB,
     rounds: { paidRound, freeRound, invalidRound, restrictedRound },
     selections: {
       paid: {
         subjectIds: [paidSubjectRequired.id, paidSubjectOptional.id],
         componentIds: [paidComponentRequired.id, paidComponentOptional.id],
       },
       free: {
         subjectIds: [freeSubjectRequired.id],
         componentIds: [freeComponentRequired.id],
       },
       invalid: {
         subjectIds: [invalidSubjectRequired.id],
         componentIds: [invalidComponentRequired.id],
       },
       restricted: {
         subjectIds: [restrictedSubjectRequired.id],
         componentIds: [restrictedComponentRequired.id],
       },
     },
   }
 }

async function login(username, password, tenantCode) {
  const { response, data } = await httpRequest('POST', '/api/auth/local', {
    headers: { 'x-tenant-code': tenantCode },
    body: { identifier: username, password },
  })
  return { response, data }
}

async function countRegistrations(client, roundId, learnerId) {
  const result = await client.query(`
    select count(*)::int as count
    from exam_registrations er
    join exam_registrations_exam_round_lnk rl on rl.exam_registration_id = er.id
    join exam_registrations_learner_lnk ll on ll.exam_registration_id = er.id
    where rl.exam_round_id = $1 and ll.learner_id = $2
  `, [roundId, learnerId])
  return Number(result.rows[0]?.count || 0)
}

async function countRegistrationComponents(client, registrationId) {
  const result = await client.query(`select count(*)::int as count from exam_registration_components_exam_registration_lnk where exam_registration_id = $1`, [registrationId])
  return Number(result.rows[0]?.count || 0)
}

async function findRegistrationGraph(client, roundId, learnerId) {
  const registrations = await client.query(`
    select er.id, er.registration_code
    from exam_registrations er
    join exam_registrations_exam_round_lnk rl on rl.exam_registration_id = er.id
    join exam_registrations_learner_lnk ll on ll.exam_registration_id = er.id
    where rl.exam_round_id = $1 and ll.learner_id = $2
    order by er.id asc
  `, [roundId, learnerId])

  const registrationIds = registrations.rows.map((row) => Number(row.id)).filter(Boolean)
  if (registrationIds.length === 0) {
    return { registrationIds: [], subjectIds: [], componentIds: [] }
  }

  const subjectRows = await client.query(`
    select ers.id
    from exam_registration_subjects ers
    join exam_registration_subjects_exam_registration_lnk lnk on lnk.exam_registration_subject_id = ers.id
    where lnk.exam_registration_id = any($1::int[])
    order by ers.id asc
  `, [registrationIds])
  const componentRows = await client.query(`
    select erc.id
    from exam_registration_components erc
    join exam_registration_components_exam_registration_lnk lnk on lnk.exam_registration_component_id = erc.id
    where lnk.exam_registration_id = any($1::int[])
    order by erc.id asc
  `, [registrationIds])

  return {
    registrationIds,
    subjectIds: subjectRows.rows.map((row) => Number(row.id)).filter(Boolean),
    componentIds: componentRows.rows.map((row) => Number(row.id)).filter(Boolean),
  }
}

function recordRegistrationGraph(graph) {
  for (const id of graph.registrationIds || []) {
    recordManifestEntry('registrations', { id }, 'registrationIds')
  }
  for (const id of graph.subjectIds || []) {
    recordManifestEntry('registrationSubjects', { id }, 'registrationSubjectIds')
  }
  for (const id of graph.componentIds || []) {
    recordManifestEntry('registrationComponents', { id }, 'registrationComponentIds')
  }
}

async function updateRoundPaymentSnapshot(client, roundId, changes, fileId) {
  const sets = []
  const values = []
  let index = 1
  for (const [key, value] of Object.entries(changes)) {
    sets.push(`${key} = $${index++}`)
    values.push(value)
  }
  values.push(roundId)
  await client.query(`update exam_rounds set ${sets.join(', ')}, updated_at = now() where id = $${index}`, values)
  if (fileId) {
    await client.query(`delete from files_related_mph where related_type = 'api::exam-round.exam-round' and related_id = $1 and field = 'paymentQrImageSnapshot'`, [roundId])
    await attachMorph(client, fileId, 'api::exam-round.exam-round', roundId, 'paymentQrImageSnapshot')
  }
}

async function getMorphFileId(client, relatedType, relatedId) {
  const result = await client.query(`select file_id from files_related_mph where related_type = $1 and related_id = $2 and field = 'paymentQrImageSnapshot' order by id desc limit 1`, [relatedType, relatedId])
  return Number(result.rows[0]?.file_id || 0) || null
}

async function deleteByIds(client, table, ids) {
  const uniqueIds = Array.from(new Set((ids || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)))
  if (uniqueIds.length === 0) return 0
  const result = await client.query(`delete from ${table} where id = any($1::int[])`, [uniqueIds])
  return Number(result.rowCount || 0)
}

async function deleteLinkByColumn(client, table, column, ids) {
  const uniqueIds = Array.from(new Set((ids || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)))
  if (uniqueIds.length === 0) return 0
  const result = await client.query(`delete from ${table} where ${column} = any($1::int[])`, [uniqueIds])
  return Number(result.rowCount || 0)
}

async function countRemainingByIds(client, table, ids) {
  const uniqueIds = Array.from(new Set((ids || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)))
  if (uniqueIds.length === 0) return 0
  const result = await client.query(`select count(*)::int as count from ${table} where id = any($1::int[])`, [uniqueIds])
  return Number(result.rows[0]?.count || 0)
}

async function cleanupManifest(client, manifestInput) {
  const failures = []
  const deleteAndTrack = async (entity, table, ids, action) => {
    const created = Array.isArray(ids) ? ids.length : 0
    let deleted = 0
    let remaining = created
    try {
      deleted = await action()
      remaining = await countRemainingByIds(client, table, ids)
      cleanupSummary.push({ entity, created, deleted, remaining, status: remaining === 0 ? 'PASS' : 'FAIL' })
      if (remaining > 0) failures.push(`${entity} remaining=${remaining}`)
    } catch (error) {
      cleanupSummary.push({ entity, created, deleted, remaining, status: 'FAIL' })
      failures.push(`${entity} cleanup error: ${String(error?.message || error)}`)
    }
  }

  const registrationComponentIds = manifestInput.registrationComponentIds || []
  await deleteLinkByColumn(client, 'exam_registration_components_exam_registration_lnk', 'exam_registration_component_id', registrationComponentIds)
  await deleteLinkByColumn(client, 'exam_registration_components_exam_round_component_lnk', 'exam_registration_component_id', registrationComponentIds)
  await deleteLinkByColumn(client, 'exam_registration_components_exam_schedule_lnk', 'exam_registration_component_id', registrationComponentIds)
  await deleteLinkByColumn(client, 'exam_registration_components_source_result_lnk', 'exam_registration_component_id', registrationComponentIds)
  await deleteLinkByColumn(client, 'exam_registration_components_tenant_lnk', 'exam_registration_component_id', registrationComponentIds)
  await deleteAndTrack('exam-registration-component', 'exam_registration_components', registrationComponentIds, () => deleteByIds(client, 'exam_registration_components', registrationComponentIds))

  const registrationSubjectIds = manifestInput.registrationSubjectIds || []
  await deleteLinkByColumn(client, 'exam_registration_subjects_exam_registration_lnk', 'exam_registration_subject_id', registrationSubjectIds)
  await deleteLinkByColumn(client, 'exam_registration_subjects_exam_round_subject_lnk', 'exam_registration_subject_id', registrationSubjectIds)
  await deleteLinkByColumn(client, 'exam_registration_subjects_tenant_lnk', 'exam_registration_subject_id', registrationSubjectIds)
  await deleteAndTrack('exam-registration-subject', 'exam_registration_subjects', registrationSubjectIds, () => deleteByIds(client, 'exam_registration_subjects', registrationSubjectIds))

  const registrationIds = manifestInput.registrationIds || []
  await deleteLinkByColumn(client, 'exam_registrations_exam_round_lnk', 'exam_registration_id', registrationIds)
  await deleteLinkByColumn(client, 'exam_registrations_learner_lnk', 'exam_registration_id', registrationIds)
  await deleteLinkByColumn(client, 'exam_registrations_tenant_lnk', 'exam_registration_id', registrationIds)
  await deleteLinkByColumn(client, 'exam_registrations_reviewed_by_lnk', 'exam_registration_id', registrationIds)
  await deleteLinkByColumn(client, 'exam_registrations_accepted_by_lnk', 'exam_registration_id', registrationIds)
  await deleteLinkByColumn(client, 'exam_registrations_rejected_by_lnk', 'exam_registration_id', registrationIds)
  await deleteLinkByColumn(client, 'exam_registrations_payment_confirmed_by_lnk', 'exam_registration_id', registrationIds)
  await client.query(`delete from files_related_mph where related_type = 'api::exam-registration.exam-registration' and related_id = any($1::int[]) and field = 'paymentQrImageSnapshot'`, [registrationIds]).catch(() => {})
  await deleteAndTrack('exam-registration', 'exam_registrations', registrationIds, () => deleteByIds(client, 'exam_registrations', registrationIds))

  const eligibilityIds = manifestInput.eligibilityIds || []
  await deleteLinkByColumn(client, 'exam_eligibilities_exam_round_lnk', 'exam_eligibility_id', eligibilityIds)
  await deleteLinkByColumn(client, 'exam_eligibilities_learner_lnk', 'exam_eligibility_id', eligibilityIds)
  await deleteLinkByColumn(client, 'exam_eligibilities_tenant_lnk', 'exam_eligibility_id', eligibilityIds)
  await deleteAndTrack('exam-eligibility', 'exam_eligibilities', eligibilityIds, () => deleteByIds(client, 'exam_eligibilities', eligibilityIds))

  const roundComponentIds = manifestInput.componentIds || []
  await deleteLinkByColumn(client, 'exam_round_components_exam_round_lnk', 'exam_round_component_id', roundComponentIds)
  await deleteLinkByColumn(client, 'exam_round_components_exam_round_subject_lnk', 'exam_round_component_id', roundComponentIds)
  await deleteLinkByColumn(client, 'exam_round_components_exam_component_lnk', 'exam_round_component_id', roundComponentIds)
  await deleteLinkByColumn(client, 'exam_round_components_tenant_lnk', 'exam_round_component_id', roundComponentIds)
  await deleteAndTrack('exam-round-component', 'exam_round_components', roundComponentIds, () => deleteByIds(client, 'exam_round_components', roundComponentIds))

  const roundSubjectIds = manifestInput.subjectIds || []
  await deleteLinkByColumn(client, 'exam_round_subjects_exam_round_lnk', 'exam_round_subject_id', roundSubjectIds)
  await deleteLinkByColumn(client, 'exam_round_subjects_exam_subject_lnk', 'exam_round_subject_id', roundSubjectIds)
  await deleteLinkByColumn(client, 'exam_round_subjects_tenant_lnk', 'exam_round_subject_id', roundSubjectIds)
  await deleteAndTrack('exam-round-subject', 'exam_round_subjects', roundSubjectIds, () => deleteByIds(client, 'exam_round_subjects', roundSubjectIds))

  const roundIds = manifestInput.roundIds || []
  await deleteLinkByColumn(client, 'exam_rounds_exam_program_lnk', 'exam_round_id', roundIds)
  await deleteLinkByColumn(client, 'exam_rounds_tenant_lnk', 'exam_round_id', roundIds)
  await client.query(`delete from files_related_mph where related_type = 'api::exam-round.exam-round' and related_id = any($1::int[]) and field = 'paymentQrImageSnapshot'`, [roundIds]).catch(() => {})
  await deleteAndTrack('exam-round', 'exam_rounds', roundIds, () => deleteByIds(client, 'exam_rounds', roundIds))

  const examComponentCatalogIds = manifestInput.examComponentCatalogIds || []
  await deleteLinkByColumn(client, 'exam_components_tenant_lnk', 'exam_component_id', examComponentCatalogIds)
  await deleteAndTrack('exam-component', 'exam_components', examComponentCatalogIds, () => deleteByIds(client, 'exam_components', examComponentCatalogIds))

  const examSubjectCatalogIds = manifestInput.examSubjectCatalogIds || []
  await deleteLinkByColumn(client, 'exam_subjects_tenant_lnk', 'exam_subject_id', examSubjectCatalogIds)
  await deleteAndTrack('exam-subject', 'exam_subjects', examSubjectCatalogIds, () => deleteByIds(client, 'exam_subjects', examSubjectCatalogIds))

  const programIds = manifestInput.programIds || []
  await deleteLinkByColumn(client, 'exam_programs_tenant_lnk', 'exam_program_id', programIds)
  await deleteAndTrack('exam-program', 'exam_programs', programIds, () => deleteByIds(client, 'exam_programs', programIds))

  const learnerIds = manifestInput.learnerIds || []
  await deleteLinkByColumn(client, 'learners_user_lnk', 'learner_id', learnerIds)
  await deleteLinkByColumn(client, 'learners_tenant_lnk', 'learner_id', learnerIds)
  await deleteAndTrack('learner', 'learners', learnerIds, () => deleteByIds(client, 'learners', learnerIds))

  const userTenantRoleIds = manifestInput.userTenantRoleIds || []
  await deleteLinkByColumn(client, 'user_tenant_roles_role_lnk', 'user_tenant_role_id', userTenantRoleIds)
  await deleteLinkByColumn(client, 'user_tenant_roles_user_tenant_lnk', 'user_tenant_role_id', userTenantRoleIds)
  await deleteAndTrack('user-tenant-role', 'user_tenant_roles', userTenantRoleIds, () => deleteByIds(client, 'user_tenant_roles', userTenantRoleIds))

  const userTenantIds = manifestInput.userTenantIds || []
  await deleteLinkByColumn(client, 'user_tenants_user_lnk', 'user_tenant_id', userTenantIds)
  await deleteLinkByColumn(client, 'user_tenants_tenant_lnk', 'user_tenant_id', userTenantIds)
  await deleteAndTrack('user-tenant', 'user_tenants', userTenantIds, () => deleteByIds(client, 'user_tenants', userTenantIds))

  const userIds = manifestInput.userIds || []
  const userRoleLinkTable = await detectUserRoleLinkTable(client)
  if (userRoleLinkTable) {
    await deleteLinkByColumn(client, userRoleLinkTable, 'user_id', userIds)
  }
  await deleteAndTrack('user', 'up_users', userIds, () => deleteByIds(client, 'up_users', userIds))

  const mediaIds = (manifestInput.mediaIds || []).filter((id) => !manifestInput.externalFixture?.mediaIds?.includes(id))
  await client.query(`delete from files_related_mph where file_id = any($1::int[])`, [mediaIds]).catch(() => {})
  await deleteAndTrack('media', 'files', mediaIds, () => deleteByIds(client, 'files', mediaIds))

  const tenantIds = (manifestInput.tenantIds || []).filter((id) => !manifestInput.externalFixture?.tenantIds?.includes(id))
  await deleteAndTrack('tenant', 'tenants', tenantIds, () => deleteByIds(client, 'tenants', tenantIds))

  return { failures }
}

async function runProbeCases(client, fixture) {
  const unauthOptions = await httpRequest('GET', `/api/learner/exam-rounds/${fixture.rounds.paidRound.id}/registration-options`, {
    headers: { 'x-tenant-code': fixture.tenant.code },
  })
  addCase('Unauthorized options', unauthOptions.response.status === 401 ? 'PASS' : 'FAIL', unauthOptions.response.status, unauthOptions.data?.code || null, null, 'No token should return 401')

  const ownerLogin = await login(fixture.ownerUserInfo.user.username, fixture.ownerUserInfo.passwordPlain, fixture.tenant.code)
  if (ownerLogin.response.status !== 200 || !ownerLogin.data?.jwt) {
    addCase('Valid options', 'FAIL', ownerLogin.response.status, ownerLogin.data?.error?.name || ownerLogin.data?.code || null, null, 'Owner login failed')
    return { failed: true }
  }
  const ownerToken = ownerLogin.data.jwt
  const otherLogin = await login(fixture.sameTenantUserInfo.user.username, fixture.sameTenantUserInfo.passwordPlain, fixture.tenant.code)
  const outsiderLogin = await login(fixture.outsiderUserInfo.user.username, fixture.outsiderUserInfo.passwordPlain, fixture.outsiderTenant.code)

  const validOptions = await httpRequest('GET', `/api/learner/exam-rounds/${fixture.rounds.paidRound.id}/registration-options`, {
    headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-code': fixture.tenant.code },
  })
  const validOptionsPayload = unwrapPayload(validOptions.data)
  const optionsOk = validOptions.response.status === 200
    && validOptionsPayload?.learner?.code === fixture.ownerLearner.code
    && Array.isArray(validOptionsPayload?.subjects)
    && validOptionsPayload?.paymentConfigured === true
  addCase('Valid options', optionsOk ? 'PASS' : 'FAIL', validOptions.response.status, validOptions.data?.code || null, Array.isArray(validOptionsPayload?.subjects) ? validOptionsPayload.subjects.length : null, optionsOk ? 'Snapshot subjects/components returned' : 'Unexpected options payload')

  const freeOptions = await httpRequest('GET', `/api/learner/exam-rounds/${fixture.rounds.freeRound.id}/registration-options`, {
    headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-code': fixture.tenant.code },
  })
  const freeOptionsPayload = unwrapPayload(freeOptions.data)
  addCase('Free options', freeOptions.response.status === 200 && freeOptionsPayload?.paymentRequired === false ? 'PASS' : 'FAIL', freeOptions.response.status, freeOptions.data?.code || null, null, 'Free round should not require payment settings')

  const paidRegister = await httpRequest('POST', `/api/learner/exam-rounds/${fixture.rounds.paidRound.id}/register`, {
    headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-code': fixture.tenant.code },
    body: fixture.selections.paid,
  })
  const paidPayload = unwrapPayload(paidRegister.data)
  const paidRegistrationId = Number(paidPayload?.registration?.id || 0) || null
  const paidGraph = await findRegistrationGraph(client, fixture.rounds.paidRound.id, fixture.ownerLearner.id)
  recordRegistrationGraph(paidGraph)
  addCase('Paid registration', paidRegister.response.status === 200 ? 'PASS' : 'FAIL', paidRegister.response.status, paidRegister.data?.code || null, paidGraph.registrationIds.length, paidRegister.response.status === 200 ? `amountDue=${paidPayload?.fee?.amountDue} account=${maskAccount(paidPayload?.payment?.accountNumber)}` : 'Create failed')

  const freeRegister = await httpRequest('POST', `/api/learner/exam-rounds/${fixture.rounds.freeRound.id}/register`, {
    headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-code': fixture.tenant.code },
    body: fixture.selections.free,
  })
  const freePayload = unwrapPayload(freeRegister.data)
  const freeGraph = await findRegistrationGraph(client, fixture.rounds.freeRound.id, fixture.ownerLearner.id)
  recordRegistrationGraph(freeGraph)
  addCase('Free registration', freeRegister.response.status === 200 && freePayload?.registration?.paymentStatus === 'not_required' ? 'PASS' : 'FAIL', freeRegister.response.status, freeRegister.data?.code || null, freeGraph.registrationIds.length, 'Free round should not require payment')

  const invalidBefore = await countRegistrations(client, fixture.rounds.invalidRound.id, fixture.ownerLearner.id)
  const invalidRegister = await httpRequest('POST', `/api/learner/exam-rounds/${fixture.rounds.invalidRound.id}/register`, {
    headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-code': fixture.tenant.code },
    body: fixture.selections.invalid,
  })
  const invalidAfter = await countRegistrations(client, fixture.rounds.invalidRound.id, fixture.ownerLearner.id)
  addCase('Invalid payment settings', invalidRegister.response.status === 409 && invalidBefore === invalidAfter ? 'PASS' : 'FAIL', invalidRegister.response.status, invalidRegister.data?.code || null, invalidAfter, 'Round with fee but missing payment account must roll back')

  const doubleSubmit = await Promise.allSettled([
    httpRequest('POST', `/api/learner/exam-rounds/${fixture.rounds.restrictedRound.id}/register`, {
      headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-code': fixture.tenant.code },
      body: fixture.selections.restricted,
    }),
    httpRequest('POST', `/api/learner/exam-rounds/${fixture.rounds.restrictedRound.id}/register`, {
      headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-code': fixture.tenant.code },
      body: fixture.selections.restricted,
    }),
  ])
  const restrictedGraph = await findRegistrationGraph(client, fixture.rounds.restrictedRound.id, fixture.ownerLearner.id)
  recordRegistrationGraph(restrictedGraph)
  const doubleCodes = doubleSubmit.map((item) => item.status === 'fulfilled' ? item.value?.data?.code || item.value?.data?.error?.name || null : item.reason?.code || null).filter(Boolean)
  const doubleStatuses = doubleSubmit.map((item) => item.status === 'fulfilled' ? item.value.response.status : 0)
  const doubleOk = restrictedGraph.registrationIds.length === 1 && restrictedGraph.componentIds.length === 1
  addCase('Double submit', doubleOk ? 'PASS' : 'FAIL', doubleStatuses.join('/'), doubleCodes.join('/'), restrictedGraph.registrationIds.length, `componentCount=${restrictedGraph.componentIds.length}`)

  const paidDetail = await httpRequest('GET', `/api/learner/exam-registrations/${paidRegistrationId}`, {
    headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-code': fixture.tenant.code },
  })
  const paidDetailPayload = unwrapPayload(paidDetail.data)
  addCase('Paid detail', paidDetail.response.status === 200 ? 'PASS' : 'FAIL', paidDetail.response.status, paidDetail.data?.code || null, await countRegistrationComponents(client, paidRegistrationId), paidDetail.response.status === 200 ? `QR=${paidDetailPayload?.payment?.qrImage?.id || '-'}` : 'Detail failed')

  const beforePayment = paidDetailPayload?.payment || null
  await updateRoundPaymentSnapshot(client, fixture.rounds.paidRound.id, {
    payment_bank_name_snapshot: 'Changed Probe Bank',
    payment_account_number_snapshot: '009999999999',
    payment_account_holder_snapshot: 'Changed Holder',
    payment_transfer_content_template_snapshot: '{registrationCode} CHANGED',
  }, fixture.qrFileB.id)
  const ownerDetailAfter = await httpRequest('GET', `/api/learner/exam-registrations/${paidRegistrationId}`, {
    headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-code': fixture.tenant.code },
  })
  const ownerDetailAfterPayload = unwrapPayload(ownerDetailAfter.data)
  const immutableOk = ownerDetailAfter.response.status === 200
    && ownerDetailAfterPayload?.payment?.accountNumber === beforePayment?.accountNumber
    && ownerDetailAfterPayload?.payment?.accountHolder === beforePayment?.accountHolder
    && ownerDetailAfterPayload?.payment?.transferContent === beforePayment?.transferContent
  addCase('Snapshot immutable', immutableOk ? 'PASS' : 'FAIL', ownerDetailAfter.response.status, ownerDetailAfter.data?.code || null, null, immutableOk ? `still=${maskAccount(ownerDetailAfterPayload?.payment?.accountNumber)}` : 'Registration snapshot changed unexpectedly')

  const otherToken = otherLogin.data?.jwt || ''
  const outsiderToken = outsiderLogin.data?.jwt || ''
  const otherDetail = await httpRequest('GET', `/api/learner/exam-registrations/${paidRegistrationId}`, {
    headers: { Authorization: `Bearer ${otherToken}`, 'x-tenant-code': fixture.tenant.code },
  })
  const outsiderDetail = await httpRequest('GET', `/api/learner/exam-registrations/${paidRegistrationId}`, {
    headers: { Authorization: `Bearer ${outsiderToken}`, 'x-tenant-code': fixture.outsiderTenant.code },
  })
  const ownershipOk = [403, 404].includes(otherDetail.response.status) && [403, 404].includes(outsiderDetail.response.status)
  addCase('Ownership', ownershipOk ? 'PASS' : 'FAIL', `${otherDetail.response.status}/${outsiderDetail.response.status}`, otherDetail.data?.code || outsiderDetail.data?.code || null, null, 'Other users must not see owner registration')

  const roundQrFileId = await getMorphFileId(client, 'api::exam-round.exam-round', fixture.rounds.paidRound.id)
  const registrationQrFileId = await getMorphFileId(client, 'api::exam-registration.exam-registration', paidRegistrationId)
  const qrOk = Boolean(roundQrFileId && registrationQrFileId && registrationQrFileId !== fixture.qrFileB.id && ownerDetailAfterPayload?.payment?.qrImage?.id)
  addCase('QR snapshot', qrOk ? 'PASS' : 'FAIL', ownerDetailAfter.response.status, null, null, qrOk ? `relation snapshot fileId=${registrationQrFileId}` : 'QR snapshot relation missing or mutated')

  addCase('Email failure path', 'SKIP', null, null, null, 'Live server probe does not inject a failing mail adapter')

  return { failed: cases.some((item) => item.status === 'FAIL') }
}

async function runSetupOnly() {
  if (options.dryRun) {
    logSection('SETUP', 'Dry run: setup-only would create a dedicated fixture and manifest file')
    return 0
  }

  const serverReady = await ensureServerReady()
  if (!serverReady) {
    printCaseSummary()
    return 1
  }

  const client = await createDbClient()
  try {
    await buildFixture(client)
    logSection('SETUP', `Fixture manifest saved: ${manifestFilePath}`)
    printCaseSummary()
    return 0
  } finally {
    await client.end()
  }
}

async function runFull() {
  if (options.dryRun) {
    logSection('SETUP', `Dry run: would check ${BASE_URL}, create fixture with runId ${manifest.runId}, run HTTP cases, and cleanup unless --keep-fixtures is set`)
    return 0
  }

  const serverReady = await ensureServerReady()
  if (!serverReady) {
    printCaseSummary()
    return 1
  }

  const client = await createDbClient()
  let fixture = null
  let testFailure = false
  let cleanupFailure = false
  try {
    fixture = await buildFixture(client)
    const result = await runProbeCases(client, fixture)
    testFailure = result.failed === true
    return testFailure ? 1 : 0
  } catch (error) {
    testFailure = true
    addCase('Probe execution', 'FAIL', null, 'PROBE_EXECUTION_FAILED', null, String(error?.message || error))
    return 1
  } finally {
    if (!options.keepFixtures) {
      const { failures } = await cleanupManifest(client, manifest)
      cleanupFailure = failures.length > 0
      addCase('Cleanup', cleanupFailure ? 'FAIL' : 'PASS', null, cleanupFailure ? 'CLEANUP_FAILED' : null, null, cleanupFailure ? failures.join('; ') : 'All manifest-owned records removed')
      printCleanupSummary()
      if (!cleanupFailure) {
        removeFileIfExists(manifestFilePath)
      }
    } else {
      addCase('Cleanup', 'SKIP', null, null, null, `Fixtures kept for debug: ${manifestFilePath}`)
    }
    printCaseSummary()
    await client.end()
    if (cleanupFailure || testFailure) {
      process.exitCode = 1
    }
  }
}

async function runCleanupOnly() {
  if (!options.cleanupManifestFile) {
    console.error('Usage: node scripts/probe-exam-registration.js --cleanup <manifest-file>')
    return 1
  }
  const manifestPath = path.isAbsolute(options.cleanupManifestFile)
    ? options.cleanupManifestFile
    : path.resolve(process.cwd(), options.cleanupManifestFile)
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`)
    return 1
  }

  const manifestInput = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const client = await createDbClient()
  try {
    const { failures } = await cleanupManifest(client, manifestInput)
    printCleanupSummary()
    if (failures.length === 0) {
      removeFileIfExists(manifestPath)
      return 0
    }
    return 1
  } finally {
    await client.end()
  }
}

async function main() {
  saveManifest()

  if (options.cleanupOnly) {
    process.exitCode = await runCleanupOnly()
    return
  }

  let exitCode = 0
  if (options.setupOnly) {
    exitCode = await runSetupOnly()
  } else {
    exitCode = await runFull()
  }
  process.exitCode = exitCode
}

main().catch((error) => {
  addCase('Server ready', 'FAIL', null, 'SERVER_NOT_READY', null, String(error?.message || error))
  printCaseSummary()
  process.exitCode = 1
})
