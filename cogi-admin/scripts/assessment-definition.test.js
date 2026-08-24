const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

process.env.STRAVA_SYNC_RUNNER_ENABLED = 'false'
process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'false'

let app
let learningService
let assessmentService
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
    // ignore cleanup issues in dev DB
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
    select: ['id'],
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
    select: ['id', 'code', 'title'],
  })
}

async function createQuestionViaService(tenantId, payload) {
  return learningService.createQuestion(payload, tenantId)
}

async function createStimulusViaService(tenantId, payload) {
  return learningService.createQuestionStimulus(payload, tenantId)
}

async function expectReject(action, expectedPattern) {
  let matched = false
  try {
    await action()
  } catch (error) {
    matched = expectedPattern.test(String(error?.message || error))
    if (!matched) throw error
  }
  if (!matched) {
    throw new Error(`Expected rejection matching ${expectedPattern}`)
  }
}

async function cleanupAssessmentTree(tenantId) {
  const versions = await app.db.query('api::assessment-version.assessment-version').findMany({
    where: { tenant: { id: { $eq: tenantId } } },
    select: ['id'],
  })
  const versionIds = (versions || []).map((item) => Number(item.id)).filter((value) => Number.isInteger(value) && value > 0)

  const sections = versionIds.length > 0
    ? await app.db.query('api::assessment-section.assessment-section').findMany({
        where: { tenant: { id: { $eq: tenantId } } },
        select: ['id'],
      })
    : []
  const sectionIds = (sections || []).map((item) => Number(item.id)).filter((value) => Number.isInteger(value) && value > 0)

  const assessmentQuestions = sectionIds.length > 0
    ? await app.db.query('api::assessment-question.assessment-question').findMany({
        where: { tenant: { id: { $eq: tenantId } } },
        select: ['id'],
      })
    : []

  for (const item of assessmentQuestions || []) {
    await destroyEntity('api::assessment-question.assessment-question', item.id)
  }
  for (const item of sections || []) {
    await destroyEntity('api::assessment-section.assessment-section', item.id)
  }
  for (const item of versions || []) {
    await destroyEntity('api::assessment-version.assessment-version', item.id)
  }

  const assessments = await app.db.query('api::assessment.assessment').findMany({
    where: { tenant: { id: { $eq: tenantId } } },
    select: ['id'],
  })
  for (const item of assessments || []) {
    await destroyEntity('api::assessment.assessment', item.id)
  }
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  learningService = loadService('src/api/learning-management/services/learning-management.js')
  assessmentService = loadService('src/api/assessment-management/services/assessment-management.js')
  const authenticatedRole = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] })
  authenticatedRoleId = Number(authenticatedRole?.id || 0)
  assert.ok(authenticatedRoleId > 0, 'authenticated role must exist')
})

after(async () => {
  if (app) await app.destroy()
})

test('Assessment definition model layer supports versioned test definitions over the question bank', async () => {
  const cleanup = []
  const key = uniqueKey('assessment')
  const tenantA = await createTenant(`${key}-tenant-a`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenantA.id))
  const tenantB = await createTenant(`${key}-tenant-b`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenantB.id))

  const userA = await createUser(`${key}-user-a`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', userA.id))

  const subjectA = await createSubject(tenantA.id, 'ENG')
  cleanup.push(() => destroyEntity('api::subject.subject', subjectA.id))
  const subjectB = await createSubject(tenantB.id, 'ENG')
  cleanup.push(() => destroyEntity('api::subject.subject', subjectB.id))

  const skillListeningA = await createSkill(tenantA.id, subjectA.id, 'ENG-LISTENING', 'Listening')
  cleanup.push(() => destroyEntity('api::skill.skill', skillListeningA.id))
  const skillReadingA = await createSkill(tenantA.id, subjectA.id, 'ENG-READING', 'Reading')
  cleanup.push(() => destroyEntity('api::skill.skill', skillReadingA.id))
  const skillLanguageA = await createSkill(tenantA.id, subjectA.id, 'ENG-LANGUAGE', 'Language in Use')
  cleanup.push(() => destroyEntity('api::skill.skill', skillLanguageA.id))
  const skillWritingA = await createSkill(tenantA.id, subjectA.id, 'ENG-WRITING', 'Writing')
  cleanup.push(() => destroyEntity('api::skill.skill', skillWritingA.id))
  const skillListeningB = await createSkill(tenantB.id, subjectB.id, 'ENG-LISTENING', 'Listening')
  cleanup.push(() => destroyEntity('api::skill.skill', skillListeningB.id))

  const stimulusA = await createStimulusViaService(tenantA.id, {
    code: `${key}-H01-AUDIO`,
    title: 'H01 audio stimulus',
    type: 'audio',
    stimulusStatus: 'draft',
  })
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', stimulusA.id))

  const listeningQuestionA = await createQuestionViaService(tenantA.id, {
    code: 'H01',
    title: 'Listening H01',
    questionText: 'What is the student problem?',
    type: 'single_choice',
    subject: subjectA.id,
    skills: [skillListeningA.id],
    stimulus: stimulusA.id,
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
      { label: 'B', value: 'B', content: 'Option B', isCorrect: false, order: 2 },
    ],
  })
  cleanup.push(() => destroyEntity('api::question.question', listeningQuestionA.id))

  const essayQuestionA = await createQuestionViaService(tenantA.id, {
    code: 'H-W01',
    title: 'Writing H01',
    questionText: 'Write 50-70 words about a topic.',
    type: 'essay',
    subject: subjectA.id,
    skills: [skillWritingA.id],
    questionStatus: 'active',
  })
  cleanup.push(() => destroyEntity('api::question.question', essayQuestionA.id))

  const listeningQuestionB = await createQuestionViaService(tenantB.id, {
    code: 'H01',
    title: 'Listening H01 Tenant B',
    questionText: 'Other tenant question',
    type: 'single_choice',
    subject: subjectB.id,
    skills: [skillListeningB.id],
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
    ],
  })
  cleanup.push(() => destroyEntity('api::question.question', listeningQuestionB.id))

  const results = {}

  const assessmentM = await assessmentService.createAssessment({ code: 'VTF-LEVEL-M', name: 'VitaminFun Mini Level Check', assessmentType: 'placement', status: 'draft', subject: subjectA.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', assessmentM.id))
  results.assessmentCrud = 'PASS'

  const versionM = await assessmentService.createAssessmentVersion({
    code: 'VTF-LEVEL-M-V3',
    version: 3,
    title: 'Golden Pilot v3 · Mini Level Check — Grade 1–2',
    assessment: assessmentM.id,
    versionStatus: 'draft',
    durationMinutes: 10,
    gradeFrom: 1,
    gradeTo: 2,
    candidateLevelFrom: 'PRE_A1',
    candidateLevelTo: 'A1',
    resultMode: 'provisional',
    requiresSpeaking: true,
    requiresTeacherConfirmation: true,
    instructions: 'Mini instructions',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', versionM.id))

  const assessmentP = await assessmentService.createAssessment({ code: 'VTF-LEVEL-P', name: 'VitaminFun Primary Level Check', assessmentType: 'placement', status: 'draft', subject: subjectA.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', assessmentP.id))
  const versionP = await assessmentService.createAssessmentVersion({ code: 'VTF-LEVEL-P-V3', version: 3, title: 'Golden Pilot v3 · Primary Level Check — Grade 3–5', assessment: assessmentP.id, versionStatus: 'draft', durationMinutes: 18, gradeFrom: 3, gradeTo: 5, candidateLevelFrom: 'PRE_A1', candidateLevelTo: 'A2', resultMode: 'provisional', requiresSpeaking: true, requiresTeacherConfirmation: true }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', versionP.id))

  const assessmentS = await assessmentService.createAssessment({ code: 'VTF-LEVEL-S', name: 'VitaminFun Secondary Level Check', assessmentType: 'placement', status: 'draft', subject: subjectA.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', assessmentS.id))
  const versionS = await assessmentService.createAssessmentVersion({ code: 'VTF-LEVEL-S-V3', version: 3, title: 'Golden Pilot v3 · Secondary Level Check — Grade 6–9', assessment: assessmentS.id, versionStatus: 'draft', durationMinutes: 20, gradeFrom: 6, gradeTo: 9, candidateLevelFrom: 'A1', candidateLevelTo: 'B1', resultMode: 'provisional', requiresSpeaking: true, requiresTeacherConfirmation: true }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', versionS.id))

  const assessmentH = await assessmentService.createAssessment({ code: 'VTF-LEVEL-H', name: 'VitaminFun High School Level Check', assessmentType: 'placement', status: 'draft', subject: subjectA.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', assessmentH.id))
  const versionH = await assessmentService.createAssessmentVersion({ code: 'VTF-LEVEL-H-V3', version: 3, title: 'Golden Pilot v3 · High School Level Check — Grade 10–12', assessment: assessmentH.id, versionStatus: 'draft', durationMinutes: 20, gradeFrom: 10, gradeTo: 12, candidateLevelFrom: 'A2', candidateLevelTo: 'B2', resultMode: 'provisional', requiresSpeaking: true, requiresTeacherConfirmation: true, ceilingLevel: 'B2' }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', versionH.id))
  results.versionCrud = 'PASS'

  const sectionListening = await assessmentService.createAssessmentSection({ assessmentVersion: versionH.id, code: 'LISTENING', title: 'Listening', order: 1, skill: skillListeningA.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionListening.id))
  const sectionReading = await assessmentService.createAssessmentSection({ assessmentVersion: versionH.id, code: 'READING', title: 'Reading', order: 2, skill: skillReadingA.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionReading.id))
  const sectionLanguage = await assessmentService.createAssessmentSection({ assessmentVersion: versionH.id, code: 'LANGUAGE_IN_USE', title: 'Language in Use', order: 3, skill: skillLanguageA.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionLanguage.id))
  const sectionWriting = await assessmentService.createAssessmentSection({ assessmentVersion: versionH.id, code: 'WRITING', title: 'Writing', order: 4, skill: skillWritingA.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionWriting.id))
  await assessmentService.reorderAssessmentSections(versionH.id, { items: [
    { id: sectionListening.id, order: 1 },
    { id: sectionReading.id, order: 2 },
    { id: sectionLanguage.id, order: 3 },
    { id: sectionWriting.id, order: 4 },
  ] }, tenantA.id)
  results.sectionReorder = 'PASS'

  const assessmentQuestionListening = await assessmentService.addAssessmentQuestion({ section: sectionListening.id, question: listeningQuestionA.id, order: 1, points: 1, required: true }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', assessmentQuestionListening.id))
  results.addQuestion = 'PASS'

  await expectReject(
    () => assessmentService.addAssessmentQuestion({ section: sectionListening.id, question: listeningQuestionA.id, order: 2 }, tenantA.id),
    /already assigned to this section/i,
  )
  results.duplicateQuestionGuard = 'PASS'

  const assessmentQuestionListeningOtherVersion = await assessmentService.addAssessmentQuestion({ section: sectionListening.id, question: essayQuestionA.id, order: 2, points: 1, required: false }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', assessmentQuestionListeningOtherVersion.id))

  const versionHOther = await assessmentService.cloneAssessmentVersion(versionH.id, { code: 'VTF-LEVEL-H-V4', version: 4, title: 'Golden Pilot v4 · High School Level Check — Grade 10–12' }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', versionHOther.id))

  const versionHOtherDetail = await assessmentService.getAssessmentVersionDetail(versionHOther.id, tenantA.id)
  const clonedListeningSection = versionHOtherDetail.sections.find((item) => item.code === 'LISTENING')
  assert.ok(clonedListeningSection)
  results.sameQuestionAcrossVersions = 'PASS'

  const updatedListeningConfig = await assessmentService.updateAssessmentQuestion(assessmentQuestionListening.id, {
    audioPlayLimit: 2,
    allowSeek: false,
    points: 1,
    required: true,
    order: 1,
    section: sectionListening.id,
    question: listeningQuestionA.id,
  }, tenantA.id)
  assert.equal(updatedListeningConfig.audioPlayLimit, 2)
  assert.equal(updatedListeningConfig.allowSeek, false)
  results.audioConfig = 'PASS'

  const assessmentQuestionWriting = await assessmentService.addAssessmentQuestion({ section: sectionWriting.id, question: essayQuestionA.id, order: 1, points: 5, required: true, minWords: 35, maxWords: 50 }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', assessmentQuestionWriting.id))
  assert.equal(assessmentQuestionWriting.minWords, 35)
  assert.equal(assessmentQuestionWriting.maxWords, 50)
  results.writingConfig = 'PASS'

  await expectReject(
    () => assessmentService.updateAssessmentQuestion(assessmentQuestionWriting.id, { section: sectionWriting.id, question: essayQuestionA.id, order: 1, minWords: 70, maxWords: 50 }, tenantA.id),
    /minWords must be less than or equal to maxWords/i,
  )
  results.invalidWordsGuard = 'PASS'

  await expectReject(
    () => assessmentService.createAssessment({ code: 'X-TENANT', name: 'Invalid subject tenant', subject: subjectB.id }, tenantA.id),
    /subject does not belong to current tenant/i,
  )
  await expectReject(
    () => assessmentService.createAssessmentSection({ assessmentVersion: versionH.id, code: 'BAD', title: 'Bad', order: 5, skill: skillListeningB.id }, tenantA.id),
    /skill does not belong to current tenant/i,
  )
  await expectReject(
    () => assessmentService.addAssessmentQuestion({ section: sectionListening.id, question: listeningQuestionB.id, order: 9 }, tenantA.id),
    /question does not belong to current tenant/i,
  )
  results.crossTenantGuards = 'PASS'

  const published = await assessmentService.publishAssessmentVersion(versionH.id, tenantA.id)
  assert.equal(published.versionStatus, 'published')
  results.publish = 'PASS'

  await expectReject(
    () => assessmentService.updateAssessmentVersion(versionH.id, { title: 'Changed after publish' }, tenantA.id),
    /cannot be modified structurally/i,
  )
  await expectReject(
    () => assessmentService.createAssessmentSection({ assessmentVersion: versionH.id, code: 'EXTRA', title: 'Extra', order: 5 }, tenantA.id),
    /Only draft assessment versions can be structurally modified/i,
  )
  results.publishedImmutability = 'PASS'

  const removedQuestionId = assessmentQuestionListeningOtherVersion.id
  await assessmentService.removeAssessmentQuestion(removedQuestionId, tenantA.id)
  const persistedQuestion = await app.db.query('api::question.question').findOne({ where: { id: essayQuestionA.id }, select: ['id', 'code'] })
  assert.ok(persistedQuestion?.id)
  results.removeRelationKeepsQuestion = 'PASS'

  const highSchoolVersion = await assessmentService.getAssessmentVersionDetail(versionH.id, tenantA.id)
  assert.equal(highSchoolVersion.ceilingLevel, 'B2')
  results.b2Ceiling = 'PASS'

  await cleanupAssessmentTree(tenantA.id)
  await cleanupAssessmentTree(tenantB.id)

  while (cleanup.length > 0) {
    const job = cleanup.pop()
    await job()
  }

  assert.deepEqual(results, {
    assessmentCrud: 'PASS',
    versionCrud: 'PASS',
    sectionReorder: 'PASS',
    addQuestion: 'PASS',
    duplicateQuestionGuard: 'PASS',
    sameQuestionAcrossVersions: 'PASS',
    audioConfig: 'PASS',
    writingConfig: 'PASS',
    invalidWordsGuard: 'PASS',
    crossTenantGuards: 'PASS',
    publish: 'PASS',
    publishedImmutability: 'PASS',
    removeRelationKeepsQuestion: 'PASS',
    b2Ceiling: 'PASS',
  })
})

test('Assessment validation counts and section question ordering remain consistent', async () => {
  const cleanup = []
  const key = uniqueKey('assessment-count')
  const tenant = await createTenant(`${key}-tenant`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenant.id))
  const user = await createUser(`${key}-user`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', user.id))
  const subject = await createSubject(tenant.id, `${key}-ENG`)
  cleanup.push(() => destroyEntity('api::subject.subject', subject.id))
  const listeningSkill = await createSkill(tenant.id, subject.id, `${key}-LISTENING`, 'Listening')
  cleanup.push(() => destroyEntity('api::skill.skill', listeningSkill.id))
  const readingSkill = await createSkill(tenant.id, subject.id, `${key}-READING`, 'Reading')
  cleanup.push(() => destroyEntity('api::skill.skill', readingSkill.id))
  const languageSkill = await createSkill(tenant.id, subject.id, `${key}-LANGUAGE`, 'Language in Use')
  cleanup.push(() => destroyEntity('api::skill.skill', languageSkill.id))
  const writingSkill = await createSkill(tenant.id, subject.id, `${key}-WRITING`, 'Writing')
  cleanup.push(() => destroyEntity('api::skill.skill', writingSkill.id))

  async function createQuestionSeries(prefix, count, skillId, questionStatus = 'active') {
    const created = []
    for (let index = 1; index <= count; index += 1) {
      const code = `${prefix}${String(index).padStart(2, '0')}`
      const question = await createQuestionViaService(tenant.id, {
        code,
        title: code,
        questionText: `${code} question text`,
        type: 'single_choice',
        subject: subject.id,
        skills: [skillId],
        questionStatus,
        options: [
          { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
          { label: 'B', value: 'B', content: 'Option B', isCorrect: false, order: 2 },
        ],
      })
      created.push(question)
      cleanup.push(() => destroyEntity('api::question.question', question.id))
    }
    return created
  }

  const emptyAssessment = await assessmentService.createAssessment({ code: `${key}-EMPTY`, name: 'Empty Assessment', subject: subject.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', emptyAssessment.id))
  const emptyVersion = await assessmentService.createAssessmentVersion({ code: `${key}-EMPTY-V1`, version: 1, title: 'Empty Version', assessment: emptyAssessment.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', emptyVersion.id))
  for (const [order, code, title, skillId] of [[1, 'LISTENING', 'Listening', listeningSkill.id], [2, 'READING', 'Reading', readingSkill.id], [3, 'LANGUAGE', 'Language in Use', languageSkill.id], [4, 'WRITING', 'Writing', writingSkill.id]]) {
    const section = await assessmentService.createAssessmentSection({ assessmentVersion: emptyVersion.id, code, title, order, skill: skillId }, tenant.id)
    cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', section.id))
  }
  const emptyValidation = await assessmentService.validateAssessmentVersion(emptyVersion.id, tenant.id)
  assert.equal(emptyValidation.summary.totalSections, 4)
  assert.equal(emptyValidation.summary.totalQuestions, 0)
  assert.ok(emptyValidation.checks.some((item) => item.key === 'questions' && item.level === 'error'))
  assert.ok(emptyValidation.checks.some((item) => item.key === 'question-status' && item.level === 'info'))

  const populatedAssessment = await assessmentService.createAssessment({ code: `${key}-FULL`, name: 'Full Assessment', subject: subject.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', populatedAssessment.id))
  const populatedVersion = await assessmentService.createAssessmentVersion({ code: `${key}-FULL-V1`, version: 1, title: 'Full Version', assessment: populatedAssessment.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', populatedVersion.id))
  const listeningSection = await assessmentService.createAssessmentSection({ assessmentVersion: populatedVersion.id, code: 'LISTENING', title: 'Listening', order: 1, skill: listeningSkill.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', listeningSection.id))
  const readingSection = await assessmentService.createAssessmentSection({ assessmentVersion: populatedVersion.id, code: 'READING', title: 'Reading', order: 2, skill: readingSkill.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', readingSection.id))
  const languageSection = await assessmentService.createAssessmentSection({ assessmentVersion: populatedVersion.id, code: 'LANGUAGE_IN_USE', title: 'Language in Use', order: 3, skill: languageSkill.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', languageSection.id))
  const writingSection = await assessmentService.createAssessmentSection({ assessmentVersion: populatedVersion.id, code: 'WRITING', title: 'Writing', order: 4, skill: writingSkill.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', writingSection.id))

  const listeningQuestions = await createQuestionSeries('S', 9, listeningSkill.id)
  const readingQuestions = await createQuestionSeries('R', 9, readingSkill.id)
  const languageQuestions = await createQuestionSeries('L', 5, languageSkill.id)
  const writingQuestions = await createQuestionSeries('W', 1, writingSkill.id)

  for (let index = 0; index < listeningQuestions.length; index += 1) {
    const row = await assessmentService.addAssessmentQuestion({ section: listeningSection.id, question: listeningQuestions[index].id, order: index + 1, points: 1, required: true }, tenant.id)
    cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', row.id))
  }
  for (let index = 0; index < readingQuestions.length; index += 1) {
    const row = await assessmentService.addAssessmentQuestion({ section: readingSection.id, question: readingQuestions[index].id, order: index + 1, points: 1, required: true }, tenant.id)
    cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', row.id))
  }
  for (let index = 0; index < languageQuestions.length; index += 1) {
    const row = await assessmentService.addAssessmentQuestion({ section: languageSection.id, question: languageQuestions[index].id, order: index + 1, points: 1, required: true }, tenant.id)
    cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', row.id))
  }
  {
    const row = await assessmentService.addAssessmentQuestion({ section: writingSection.id, question: writingQuestions[0].id, order: 1, points: 1, required: true }, tenant.id)
    cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', row.id))
  }

  const populatedValidation = await assessmentService.validateAssessmentVersion(populatedVersion.id, tenant.id)
  assert.equal(populatedValidation.summary.totalSections, 4)
  assert.equal(populatedValidation.summary.totalQuestions, 24)
  assert.ok(populatedValidation.checks.some((item) => item.key === 'questions' && item.level === 'success'))
  assert.ok(populatedValidation.checks.some((item) => item.key === 'question-status' && item.level === 'success'))

  const populatedDetail = await assessmentService.getAssessmentVersionDetail(populatedVersion.id, tenant.id)
  const populatedListeningSection = populatedDetail.sections.find((item) => item.code === 'LISTENING')
  assert.deepEqual((populatedListeningSection?.assessmentQuestions || []).map((item) => item.question?.code), ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09'])

  const orderAssessment = await assessmentService.createAssessment({ code: `${key}-ORDER`, name: 'Order Assessment', subject: subject.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', orderAssessment.id))
  const orderVersion = await assessmentService.createAssessmentVersion({ code: `${key}-ORDER-V1`, version: 1, title: 'Order Version', assessment: orderAssessment.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', orderVersion.id))
  const orderSection = await assessmentService.createAssessmentSection({ assessmentVersion: orderVersion.id, code: 'ORDER', title: 'Order', order: 1, skill: listeningSkill.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', orderSection.id))
  const appendQuestions = await createQuestionSeries('Q', 6, listeningSkill.id)

  for (let index = 0; index < 3; index += 1) {
    const row = await assessmentService.addAssessmentQuestion({ section: orderSection.id, question: appendQuestions[index].id, order: index + 1, points: 1, required: true }, tenant.id)
    cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', row.id))
  }
  for (let index = 3; index < 6; index += 1) {
    const row = await assessmentService.addAssessmentQuestion({ section: orderSection.id, question: appendQuestions[index].id, order: index + 1, points: 1, required: true }, tenant.id)
    cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', row.id))
  }

  let orderDetail = await assessmentService.getAssessmentVersionDetail(orderVersion.id, tenant.id)
  let orderSectionDetail = orderDetail.sections.find((item) => item.code === 'ORDER')
  assert.deepEqual((orderSectionDetail?.assessmentQuestions || []).map((item) => item.question?.code), ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06'])

  const reorderedIds = ['Q01', 'Q02', 'Q03', 'Q04', 'Q06', 'Q05'].map((code, index) => {
    const item = (orderSectionDetail?.assessmentQuestions || []).find((row) => row.question?.code === code)
    return { id: entityRef(item), order: index + 1 }
  })
  await assessmentService.reorderAssessmentQuestions(orderSection.id, { items: reorderedIds }, tenant.id)
  orderDetail = await assessmentService.getAssessmentVersionDetail(orderVersion.id, tenant.id)
  orderSectionDetail = orderDetail.sections.find((item) => item.code === 'ORDER')
  assert.deepEqual((orderSectionDetail?.assessmentQuestions || []).map((item) => item.question?.code), ['Q01', 'Q02', 'Q03', 'Q04', 'Q06', 'Q05'])

  const inactiveAssessment = await assessmentService.createAssessment({ code: `${key}-STATUS`, name: 'Status Assessment', subject: subject.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', inactiveAssessment.id))
  const inactiveVersion = await assessmentService.createAssessmentVersion({ code: `${key}-STATUS-V1`, version: 1, title: 'Status Version', assessment: inactiveAssessment.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', inactiveVersion.id))
  const inactiveSection = await assessmentService.createAssessmentSection({ assessmentVersion: inactiveVersion.id, code: 'STATUS', title: 'Status', order: 1, skill: listeningSkill.id }, tenant.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', inactiveSection.id))
  const activeStatusQuestions = await createQuestionSeries('A', 2, listeningSkill.id, 'active')
  const draftStatusQuestions = await createQuestionSeries('D', 1, listeningSkill.id, 'draft')
  for (const [index, question] of [...activeStatusQuestions, ...draftStatusQuestions].entries()) {
    const row = await assessmentService.addAssessmentQuestion({ section: inactiveSection.id, question: question.id, order: index + 1, points: 1, required: true }, tenant.id)
    cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', row.id))
  }
  const inactiveValidation = await assessmentService.validateAssessmentVersion(inactiveVersion.id, tenant.id)
  assert.equal(inactiveValidation.summary.totalQuestions, 3)
  assert.ok(inactiveValidation.checks.some((item) => item.key === 'question-status' && item.level === 'warning'))

  await cleanupAssessmentTree(tenant.id)
  while (cleanup.length > 0) {
    const job = cleanup.pop()
    await job()
  }
})
