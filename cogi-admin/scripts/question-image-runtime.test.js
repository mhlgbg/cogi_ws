const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

process.env.STRAVA_SYNC_RUNNER_ENABLED = 'false'
process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'false'

let app
let learningService
let assessmentService
let runtimeService
let authenticatedRoleId = 0

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function entityRef(row) {
  return row?.documentId || row?.id || null
}

function loadService(relativePath) {
  const modulePath = path.join(__dirname, '..', 'dist', ...relativePath.split('/'))
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
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

async function createUser(label) {
  return app.db.query('plugin::users-permissions.user').create({
    data: {
      username: label,
      email: `${label}@example.com`,
      password: 'Pass1234!',
      provider: 'local',
      confirmed: true,
      blocked: false,
      fullName: `User ${label}`,
      role: authenticatedRoleId,
    },
    select: ['id', 'username'],
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
    select: ['id', 'documentId', 'code', 'title'],
  })
}

async function createSkill(tenantId, subjectId, code, title) {
  return app.db.query('api::skill.skill').create({
    data: {
      code,
      title,
      level: 'understand',
      skillStatus: 'active',
      subject: subjectId,
      tenant: tenantId,
    },
    select: ['id', 'documentId', 'code', 'title'],
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
    select: ['id', 'documentId', 'code', 'url', 'fileName', 'mimeType'],
  })
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  learningService = loadService('src/api/learning-management/services/learning-management.js')
  assessmentService = loadService('src/api/assessment-management/services/assessment-management.js')
  runtimeService = strapi.service('api::assessment-runtime.assessment-runtime')
  const authenticatedRole = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] })
  authenticatedRoleId = Number(authenticatedRole?.id || 0)
  assert.ok(authenticatedRoleId > 0)
})

after(async () => {
  if (app) await app.destroy()
})

test('Question image flows from question bank to assessment version and runtime snapshot', async () => {
  const cleanup = []
  const key = uniqueKey('question-image-runtime')
  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const user = await createUser(`${key}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))
  const subject = await createSubject(tenant.id, `${key}-ENG`)
  cleanup.push(() => destroyEntity('api::subject.subject', subject.id))
  const skill = await createSkill(tenant.id, subject.id, `${key}-READ`, 'Reading')
  cleanup.push(() => destroyEntity('api::skill.skill', skill.id))
  const stimulusImage = await createFileAsset(tenant.id, `${key}-stimulus-image`)
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', stimulusImage.id))
  const questionImage = await createFileAsset(tenant.id, `${key}-question-image`)
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', questionImage.id))
  const questionImageUpdated = await createFileAsset(tenant.id, `${key}-question-image-updated`)
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', questionImageUpdated.id))

  const stimulus = await learningService.createQuestionStimulus({
    code: `${key}-STIM`,
    title: 'Shared clothes stimulus',
    type: 'image',
    instruction: 'Clothes Shops A-H',
    imageAsset: entityRef(stimulusImage),
    stimulusStatus: 'active',
  }, tenant.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', stimulus.id))

  const question = await learningService.createQuestion({
    code: 'PET1-T3-P1-R-PT2-Q06',
    title: 'PET Reading Part 2 Q06',
    questionText: 'George has to buy some new jeans...',
    questionImageAsset: entityRef(questionImage),
    type: 'single_choice',
    subject: subject.id,
    skills: [skill.id],
    stimulus: entityRef(stimulus),
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'A', content: 'Shop A', isCorrect: true, order: 1 },
      { label: 'B', value: 'B', content: 'Shop B', isCorrect: false, order: 2 },
    ],
  }, tenant.id)
  cleanup.push(() => destroyEntity('api::question.question', question.id))

  assert.equal(question.questionImageAssetCode, questionImage.code || null)

  const assessment = await assessmentService.createAssessment({ code: `${key}-ASM`, name: 'Question image assessment', subject: subject.id, assessmentType: 'practice', status: 'draft' }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', assessment.id))
  const version = await assessmentService.createAssessmentVersion({ code: `${key}-ASM-V1`, version: 1, title: 'Version 1', assessment: assessment.id, versionStatus: 'draft', durationMinutes: 15 }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', version.id))
  const section = await assessmentService.createAssessmentSection({ assessmentVersion: version.id, code: 'READING', title: 'Reading', order: 1, skill: skill.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', section.id))
  const assessmentQuestion = await assessmentService.addAssessmentQuestion({ section: section.id, question: question.id, order: 1, points: 1, required: true }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', assessmentQuestion.id))

  const versionDetail = await assessmentService.getAssessmentVersionDetail(version.id, tenant.id)
  const versionQuestion = versionDetail.sections[0].assessmentQuestions[0].question
  assert.equal(versionQuestion.questionImageAssetCode, questionImage.code || null)
  assert.equal(versionQuestion.questionImageAsset.code, questionImage.code || null)
  assert.equal(versionQuestion.stimulus.imageAsset.code, stimulusImage.code || null)

  await assessmentService.updateAssessmentVersion(entityRef(version), { versionStatus: 'published' }, tenant.id)
  const started = await runtimeService.startAssessmentAttempt(entityRef(version), { sourceType: 'admin_test', sourceRef: key, resumeExisting: false }, tenant.id, { authUserId: user.id, allowManagerAccess: true })
  const runtimeQuestion = started.candidateDefinition.sections[0].questions[0].question
  assert.equal(runtimeQuestion.questionImageAsset.code, questionImage.code || null)
  assert.match(runtimeQuestion.questionImageAsset.url, /\/api\/storage\/files\/.+\/download\?mediaToken=/)
  assert.match(runtimeQuestion.stimulus.imageAsset.url, /\/api\/storage\/files\/.+\/download\?mediaToken=/)

  await learningService.updateQuestion(entityRef(question), { questionImageAsset: entityRef(questionImageUpdated) }, tenant.id)
  const resumed = await runtimeService.resumeAssessmentAttempt(started.attempt.id, tenant.id, { authUserId: user.id, allowManagerAccess: true })
  const resumedQuestion = resumed.candidateDefinition.sections[0].questions[0].question
  assert.equal(resumedQuestion.questionImageAsset.code, questionImage.code || null)

  while (cleanup.length > 0) {
    const job = cleanup.pop()
    await job()
  }
})