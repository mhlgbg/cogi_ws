const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

process.env.STRAVA_SYNC_RUNNER_ENABLED = 'false'
process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'false'

let app
let learningService
let importService

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadService(relativePath) {
  const modulePath = path.join(__dirname, '..', 'dist', ...relativePath.split('/'))
  delete require.cache[require.resolve(modulePath)]
  const loaded = require(modulePath)
  return loaded.default || loaded
}

function entityRef(row) {
  return row?.documentId || row?.id || null
}

async function destroyEntity(uid, id) {
  if (!id) return
  try {
    await app.db.query(uid).delete({ where: { id } })
  } catch {
    // ignore cleanup failures in dev DB
  }
}

async function createTenant(label) {
  return app.db.query('api::tenant.tenant').create({
    data: {
      name: `Tenant ${label}`,
      code: label,
      tenantStatus: 'active',
      siteTitle: `Tenant ${label}`,
    },
    select: ['id', 'code', 'name'],
  })
}

async function createSubject(tenantId, code) {
  return app.db.query('api::subject.subject').create({
    data: {
      code,
      title: code,
      subjectStatus: 'active',
      tenant: tenantId,
    },
    select: ['id', 'code', 'title'],
  })
}

async function createFileAsset(tenantId, label, mimeType = 'image/png', extension = '.png', moduleKey = 'question-bank') {
  return app.db.query('api::file-asset.file-asset').create({
    data: {
      tenant: tenantId,
      moduleKey,
      originalName: `${label}${extension}`,
      fileName: `${label}${extension}`,
      extension: extension.replace(/^\./, ''),
      mimeType,
      size: '1',
      provider: 'local',
      relativePath: `tenants/test/${moduleKey}/${label}${extension}`,
      url: `/storage/tenants/test/${moduleKey}/${label}${extension}`,
      uploadedBy: null,
      isPublic: true,
      status: 'ACTIVE',
      metadata: null,
    },
    select: ['id', 'documentId', 'code', 'fileName'],
  })
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  learningService = loadService('src/api/learning-management/services/learning-management.js')
  importService = loadService('src/api/learning-package-import/services/learning-package-import.js')
})

after(async () => {
  if (app) await app.destroy()
})

test('Learning package import keeps existing question image when package sends null', async () => {
  const cleanup = []
  const key = uniqueKey('learning-package-import')
  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const subject = await createSubject(tenant.id, `${key}-ENG`)
  cleanup.push(() => destroyEntity('api::subject.subject', subject.id))
  const originalImage = await createFileAsset(tenant.id, `${key}-question-image`)
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', originalImage.id))
  const replacementImage = await createFileAsset(tenant.id, `${key}-question-image-2`)
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', replacementImage.id))

  const question = await learningService.createQuestion({
    code: `${key}-Q01`,
    title: `${key}-Q01`,
    questionText: 'Original question text',
    questionImageAsset: entityRef(originalImage),
    type: 'single_choice',
    subject: subject.id,
    questionStatus: 'draft',
    options: [
      { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
      { label: 'B', value: 'B', content: 'Option B', isCorrect: false, order: 2 },
    ],
  }, tenant.id)
  cleanup.push(() => destroyEntity('api::question.question', question.id))

  const preview = await importService.previewPackage({
    packageInfo: { code: `${key}-PKG`, subject: subject.code },
    questions: [
      {
        code: question.code,
        title: question.title,
        questionText: 'Updated question text from package',
        questionImageAssetCode: null,
        importMeta: { questionImageMediaKey: 'PET1-T3-P1-R-PT2-Q06-IMAGE' },
        type: 'single_choice',
        options: [
          { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
          { label: 'B', value: 'B', content: 'Option B', isCorrect: false, order: 2 },
        ],
      },
    ],
    learningObjects: [],
  }, tenant.id, null)
  assert.equal(preview.canImport, true)

  await importService.importPackage({
    packageInfo: { code: `${key}-PKG-2`, subject: subject.code },
    questions: [
      {
        code: question.code,
        title: question.title,
        questionText: 'Updated question text from package',
        questionImageAssetCode: null,
        importMeta: { questionImageMediaKey: 'PET1-T3-P1-R-PT2-Q06-IMAGE' },
        type: 'single_choice',
        options: [
          { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
          { label: 'B', value: 'B', content: 'Option B', isCorrect: false, order: 2 },
        ],
      },
    ],
    learningObjects: [],
  }, tenant.id, null)

  const persistedAfterNullImport = await learningService.updateQuestion(entityRef(question), {}, tenant.id)
  assert.equal(persistedAfterNullImport.questionImageAssetCode, originalImage.code || null)

  await importService.importPackage({
    packageInfo: { code: `${key}-PKG-3`, subject: subject.code },
    questions: [
      {
        code: question.code,
        title: question.title,
        questionText: 'Updated question text from package again',
        questionImageAssetCode: replacementImage.code,
        type: 'single_choice',
        options: [
          { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
          { label: 'B', value: 'B', content: 'Option B', isCorrect: false, order: 2 },
        ],
      },
    ],
    learningObjects: [],
  }, tenant.id, null)

  const persistedAfterCodeImport = await learningService.updateQuestion(entityRef(question), {}, tenant.id)
  assert.equal(persistedAfterCodeImport.questionImageAssetCode, replacementImage.code || null)

  while (cleanup.length > 0) {
    const job = cleanup.pop()
    await job()
  }
})