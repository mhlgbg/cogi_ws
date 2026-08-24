const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

process.env.STRAVA_SYNC_RUNNER_ENABLED = 'false'
process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'false'

let app
let learningService
let assessmentService
let runtimeService
let scoringService
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
    data: { name: `Tenant ${label}`, code: label, tenantStatus: 'active', siteTitle: `Tenant ${label}` },
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
    select: ['id', 'username', 'email', 'fullName'],
  })
}

async function createSubject(tenantId, code) {
  return app.db.query('api::subject.subject').create({
    data: { code, title: code, subjectStatus: 'active', tenant: tenantId },
    select: ['id', 'documentId', 'code', 'title'],
  })
}

async function createSkill(tenantId, subjectId, code, title) {
  return app.db.query('api::skill.skill').create({
    data: { code, title, level: 'understand', skillStatus: 'active', subject: subjectId, tenant: tenantId },
    select: ['id', 'documentId', 'code', 'title'],
  })
}

async function createFileAsset(tenantId, label, mimeType = 'audio/mpeg', extension = '.mp3', moduleKey = 'assessment-scoring') {
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
    select: ['id', 'documentId', 'code', 'url', 'mimeType'],
  })
}

async function expectReject(action, expectedPattern) {
  let matched = false
  try {
    await action()
  } catch (error) {
    matched = expectedPattern.test(String(error?.message || error))
    if (!matched) throw error
  }
  if (!matched) throw new Error(`Expected rejection matching ${expectedPattern}`)
}

async function createQuestion(tenantId, subjectId, skillId, payload) {
  return learningService.createQuestion({
    subject: subjectId,
    skills: [skillId],
    questionStatus: 'active',
    ...payload,
  }, tenantId)
}

async function cleanupScoringTree(tenantId) {
  const answerScores = await app.db.query('api::assessment-answer-score.assessment-answer-score').findMany({ where: { tenant: { id: { $eq: tenantId } } }, select: ['id'] })
  for (const row of answerScores || []) await destroyEntity('api::assessment-answer-score.assessment-answer-score', row.id)

  const results = await app.db.query('api::assessment-result.assessment-result').findMany({ where: { tenant: { id: { $eq: tenantId } } }, select: ['id'] })
  for (const row of results || []) await destroyEntity('api::assessment-result.assessment-result', row.id)

  const placementRules = await app.db.query('api::assessment-placement-rule.assessment-placement-rule').findMany({ where: { tenant: { id: { $eq: tenantId } } }, select: ['id'] })
  for (const row of placementRules || []) await destroyEntity('api::assessment-placement-rule.assessment-placement-rule', row.id)
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  learningService = loadService('src/api/learning-management/services/learning-management.js')
  assessmentService = loadService('src/api/assessment-management/services/assessment-management.js')
  runtimeService = strapi.service('api::assessment-runtime.assessment-runtime')
  scoringService = strapi.service('api::assessment-scoring.assessment-scoring')
  const authenticatedRole = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] })
  authenticatedRoleId = Number(authenticatedRole?.id || 0)
  assert.ok(authenticatedRoleId > 0)
})

after(async () => {
  if (app) await app.destroy()
})

test('Assessment scoring foundation produces provisional results, pending writing, rules, and rescoring from snapshot', async () => {
  const cleanup = []
  const key = uniqueKey('assessment-scoring')
  const tenantA = await createTenant(`${key}-tenant-a`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenantA.id))
  const tenantB = await createTenant(`${key}-tenant-b`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenantB.id))
  const userA = await createUser(`${key}-user-a`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', userA.id))
  const subjectA = await createSubject(tenantA.id, `${key}-ENG`)
  cleanup.push(() => destroyEntity('api::subject.subject', subjectA.id))
  const subjectB = await createSubject(tenantB.id, `${key}-ENG`)
  cleanup.push(() => destroyEntity('api::subject.subject', subjectB.id))
  const listeningSkill = await createSkill(tenantA.id, subjectA.id, `${key}-LISTEN`, 'Listening')
  cleanup.push(() => destroyEntity('api::skill.skill', listeningSkill.id))
  const readingSkill = await createSkill(tenantA.id, subjectA.id, `${key}-READ`, 'Reading')
  cleanup.push(() => destroyEntity('api::skill.skill', readingSkill.id))
  const languageSkill = await createSkill(tenantA.id, subjectA.id, `${key}-LANG`, 'Language in Use')
  cleanup.push(() => destroyEntity('api::skill.skill', languageSkill.id))
  const writingSkill = await createSkill(tenantA.id, subjectA.id, `${key}-WRITE`, 'Writing')
  cleanup.push(() => destroyEntity('api::skill.skill', writingSkill.id))
  const listeningSkillB = await createSkill(tenantB.id, subjectB.id, `${key}-LISTEN-B`, 'Listening B')
  cleanup.push(() => destroyEntity('api::skill.skill', listeningSkillB.id))

  const audioFile = await createFileAsset(tenantA.id, `${key}-audio`)
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', audioFile.id))
  const audioStimulus = await learningService.createQuestionStimulus({
    code: `${key}-AUDIO-STIMULUS`,
    title: 'Audio stimulus',
    type: 'audio',
    instruction: 'Listen carefully',
    audioAsset: entityRef(audioFile),
    stimulusStatus: 'active',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', audioStimulus.id))

  const listeningQuestions = []
  for (let index = 1; index <= 9; index += 1) {
    const code = `S${String(index).padStart(2, '0')}`
    const row = await createQuestion(tenantA.id, subjectA.id, listeningSkill.id, {
      code,
      title: code,
      questionText: `${code} text`,
      type: 'single_choice',
      stimulus: entityRef(audioStimulus),
      options: [
        { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
        { label: 'B', value: 'B', content: 'Option B', isCorrect: false, order: 2 },
      ],
    })
    listeningQuestions.push(row)
    cleanup.push(() => destroyEntity('api::question.question', row.id))
  }

  const readingQuestions = []
  for (let index = 10; index <= 18; index += 1) {
    const code = `S${String(index).padStart(2, '0')}`
    const row = await createQuestion(tenantA.id, subjectA.id, readingSkill.id, {
      code,
      title: code,
      questionText: `${code} text`,
      type: 'single_choice',
      options: [
        { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
        { label: 'B', value: 'B', content: 'Option B', isCorrect: false, order: 2 },
      ],
    })
    readingQuestions.push(row)
    cleanup.push(() => destroyEntity('api::question.question', row.id))
  }

  const languageQuestions = []
  for (let index = 19; index <= 23; index += 1) {
    const code = `S${String(index).padStart(2, '0')}`
    const row = await createQuestion(tenantA.id, subjectA.id, languageSkill.id, {
      code,
      title: code,
      questionText: `${code} text`,
      type: index === 19 ? 'multiple_choice' : 'single_choice',
      options: index === 19
        ? [
            { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
            { label: 'B', value: 'B', content: 'Option B', isCorrect: true, order: 2 },
            { label: 'C', value: 'C', content: 'Option C', isCorrect: false, order: 3 },
          ]
        : [
            { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
            { label: 'B', value: 'B', content: 'Option B', isCorrect: false, order: 2 },
          ],
    })
    languageQuestions.push(row)
    cleanup.push(() => destroyEntity('api::question.question', row.id))
  }

  const writingQuestion = await createQuestion(tenantA.id, subjectA.id, writingSkill.id, {
    code: 'S-W01',
    title: 'S-W01',
    questionText: 'Write 35-50 words.',
    type: 'essay',
    options: [],
  })
  cleanup.push(() => destroyEntity('api::question.question', writingQuestion.id))

  const tenantBQuestion = await createQuestion(tenantB.id, subjectB.id, listeningSkillB.id, {
    code: 'B-Q01',
    title: 'B-Q01',
    questionText: 'Other tenant',
    type: 'single_choice',
    options: [{ label: 'A', value: 'A', content: 'A', isCorrect: true, order: 1 }],
  })
  cleanup.push(() => destroyEntity('api::question.question', tenantBQuestion.id))

  const assessment = await assessmentService.createAssessment({ code: `${key}-S`, name: 'VitaminFun S', subject: subjectA.id, assessmentType: 'placement', status: 'draft' }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', assessment.id))
  const version = await assessmentService.createAssessmentVersion({
    code: `${key}-S-V3`,
    version: 3,
    title: 'VitaminFun Secondary',
    assessment: assessment.id,
    versionStatus: 'draft',
    durationMinutes: 20,
    gradeFrom: 6,
    gradeTo: 9,
    candidateLevelFrom: 'A1',
    candidateLevelTo: 'B1',
    resultMode: 'provisional',
    requiresSpeaking: true,
    requiresTeacherConfirmation: true,
    ceilingLevel: 'A2',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', version.id))
  const sectionListening = await assessmentService.createAssessmentSection({ assessmentVersion: version.id, code: 'LISTENING', title: 'Listening', order: 1, skill: listeningSkill.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionListening.id))
  const sectionReading = await assessmentService.createAssessmentSection({ assessmentVersion: version.id, code: 'READING', title: 'Reading', order: 2, skill: readingSkill.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionReading.id))
  const sectionLanguage = await assessmentService.createAssessmentSection({ assessmentVersion: version.id, code: 'LANGUAGE_IN_USE', title: 'Language in Use', order: 3, skill: languageSkill.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionLanguage.id))
  const sectionWriting = await assessmentService.createAssessmentSection({ assessmentVersion: version.id, code: 'WRITING', title: 'Writing', order: 4, skill: writingSkill.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionWriting.id))

  const assessmentQuestions = []
  for (const [index, row] of listeningQuestions.entries()) assessmentQuestions.push(await assessmentService.addAssessmentQuestion({ section: sectionListening.id, question: row.id, order: index + 1, points: 1, required: true, audioPlayLimit: 2, allowSeek: false }, tenantA.id))
  for (const [index, row] of readingQuestions.entries()) assessmentQuestions.push(await assessmentService.addAssessmentQuestion({ section: sectionReading.id, question: row.id, order: index + 1, points: 1, required: true }, tenantA.id))
  for (const [index, row] of languageQuestions.entries()) assessmentQuestions.push(await assessmentService.addAssessmentQuestion({ section: sectionLanguage.id, question: row.id, order: index + 1, points: 1, required: true }, tenantA.id))
  assessmentQuestions.push(await assessmentService.addAssessmentQuestion({ section: sectionWriting.id, question: writingQuestion.id, order: 1, points: 1, required: true, minWords: 35, maxWords: 50 }, tenantA.id))
  for (const row of assessmentQuestions) cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', row.id))

  await assessmentService.publishAssessmentVersion(entityRef(version), tenantA.id)

  const started = await runtimeService.startAssessmentAttempt(entityRef(version), { sourceType: 'admin', resumeExisting: false }, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  const allQuestions = started.candidateDefinition.sections.flatMap((section) => section.questions)
  const s01Question = allQuestions.find((item) => item.question.code === 'S01')
  const s01OriginalCorrectOptionId = s01Question?.question?.options?.[0]?.id || null
  for (const item of allQuestions) {
    const answerData = item.question.type === 'essay'
      ? { text: 'Essay answer for manual scoring.' }
      : item.question.type === 'multiple_choice'
        ? { selectedOptionIds: [item.question.options[0].id, item.question.options[1].id] }
        : { selectedOptionIds: [item.question.code === 'S02' ? item.question.options[1].id : item.question.options[0].id] }
    await runtimeService.saveAssessmentAnswer(started.attempt.id, item.assessmentQuestionId, { answerData }, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  }

  const submitted = await runtimeService.submitAssessmentAttempt(started.attempt.id, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  assert.equal(submitted.attempt.status, 'submitted')

  const result = await scoringService.getAssessmentResult(started.attempt.id, tenantA.id)
  assert.ok(result.id)
  assert.equal(result.objectiveMaxScore, 23)
  assert.equal(result.configuredTotalMaxScore, 24)
  assert.equal(result.pendingManualCount, 1)
  assert.equal(result.provisionalLevel, null)
  assert.equal(result.answerScores.length, 24)
  assert.ok(result.answerScores.some((item) => item.question?.code === 'S02' && item.awardedPoints === 0 && item.isCorrect === false))
  assert.ok(result.answerScores.some((item) => item.question?.code === 'S01' && item.awardedPoints === 1 && item.isCorrect === true))
  assert.ok(result.answerScores.some((item) => item.question?.code === 'S19' && item.status === 'auto_scored' && item.awardedPoints === 1))
  assert.ok(result.answerScores.some((item) => item.question?.code === 'S-W01' && item.status === 'pending' && item.scoringMethod === 'manual'))

  const listedInitial = await scoringService.listAssessmentResults({ q: started.attempt.code }, tenantA.id)
  assert.equal(listedInitial.data.length, 1)
  assert.equal(listedInitial.data[0].pendingManualCount, 1)
  assert.equal(listedInitial.data[0].attempt.code, started.attempt.code)

  const detailInitial = await scoringService.getAssessmentResultDetail(result.id, tenantA.id)
  const writingReview = detailInitial.manualScoringItems.find((item) => item.questionCode === 'S-W01')
  assert.ok(writingReview)
  assert.equal(writingReview.status, 'pending')
  assert.equal(writingReview.minWords, 35)
  assert.equal(writingReview.maxWords, 50)
  assert.ok(writingReview.wordCount > 0)
  assert.equal(detailInitial.placementContext.hasActiveRules, false)

  await expectReject(() => scoringService.setManualAnswerScore(writingReview.answerScoreId, { awardedPoints: 2 }, tenantA.id, { authUserId: userA.id }), /less than or equal to maxPoints/i)

  const manuallyScored = await scoringService.setManualAnswerScore(writingReview.answerScoreId, { awardedPoints: 1, manualScoreNote: 'Reviewed by admin.' }, tenantA.id, { authUserId: userA.id })
  assert.equal(manuallyScored.result.id, result.id)
  assert.equal(manuallyScored.result.pendingManualCount, 0)
  assert.equal(manuallyScored.result.rawScore, 23)
  assert.equal(manuallyScored.result.maxScore, 24)
  assert.equal(manuallyScored.result.status, 'partially_scored')
  assert.equal(manuallyScored.result.provisionalLevel, null)
  assert.equal(manuallyScored.answerScore.status, 'manual_scored')
  assert.equal(manuallyScored.answerScore.scoringMethod, 'manual')
  assert.equal(manuallyScored.answerScore.awardedPoints, 1)

  const rowsAfterManual = await app.db.query('api::assessment-result.assessment-result').findMany({ where: { tenant: { id: { $eq: tenantA.id } } }, select: ['id', 'code', 'isCurrent'] })
  assert.equal(rowsAfterManual.length, 1)
  assert.equal(rowsAfterManual[0].code, result.code)
  assert.equal(rowsAfterManual[0].isCurrent, true)

  const detailAfterManual = await scoringService.getAssessmentResultDetail(result.id, tenantA.id)
  const writingAfterManual = detailAfterManual.reviewItems.find((item) => item.questionCode === 'S-W01')
  assert.equal(detailAfterManual.result.pendingManualCount, 0)
  assert.equal(detailAfterManual.result.configuredTotalMaxScore, 24)
  assert.equal(writingAfterManual.status, 'manual_scored')
  assert.equal(writingAfterManual.awardedPoints, 1)
  assert.equal(writingAfterManual.manualScoreNote, 'Reviewed by admin.')

  const idempotent = await scoringService.scoreAssessmentAttempt(started.attempt.id, tenantA.id, { scoringVersion: 1 })
  assert.equal(idempotent.code, result.code)

  const ruleA2 = await scoringService.createAssessmentPlacementRule({
    assessmentVersion: version.id,
    code: `${key}-A2`,
    label: 'A2 band',
    order: 1,
    ruleType: 'percentage',
    scoreBasis: 'objective_only',
    minPercentage: 0,
    maxPercentage: 94,
    level: 'A2',
    placementBandCode: 'A2_SOLID',
    placementLabel: 'A2 - Solid',
    status: 'active',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-placement-rule.assessment-placement-rule', ruleA2.id))

  await expectReject(() => scoringService.createAssessmentPlacementRule({
    assessmentVersion: version.id,
    code: `${key}-OVERLAP`,
    label: 'Overlap band',
    order: 2,
    ruleType: 'percentage',
    scoreBasis: 'objective_only',
    minPercentage: 90,
    maxPercentage: 100,
    level: 'B1',
    status: 'active',
  }, tenantA.id), /overlaps an existing active rule/i)

  await scoringService.updateAssessmentPlacementRule(ruleA2.id, {
    assessmentVersion: version.id,
    code: `${key}-B1`,
    label: 'B1 band',
    order: 1,
    ruleType: 'percentage',
    scoreBasis: 'objective_only',
    minPercentage: 0,
    maxPercentage: 100,
    level: 'B1',
    placementBandCode: 'B1_SOLID',
    placementLabel: 'B1 - Solid',
    status: 'active',
  }, tenantA.id)

  const recalculated = await scoringService.recalculateAssessmentResult(result.id, tenantA.id)
  assert.equal(recalculated.code, result.code)
  assert.equal(recalculated.isCurrent, true)
  assert.equal(recalculated.provisionalLevel, 'A2')
  assert.equal(recalculated.placementBandCode, 'B1_SOLID')
  assert.ok(String(recalculated.placementNotes || '').includes('ceiling'))

  const listedAfterRecalculate = await scoringService.listAssessmentResults({ hasManualPending: false, assessmentVersion: version.id }, tenantA.id)
  assert.equal(listedAfterRecalculate.data.length, 1)
  assert.equal(listedAfterRecalculate.data[0].pendingManualCount, 0)
  assert.equal(listedAfterRecalculate.data[0].provisionalLevel, 'A2')

  const rescored = await scoringService.rescoreAssessmentAttempt(started.attempt.id, tenantA.id, { scoringVersion: 2 })
  assert.notEqual(rescored.code, result.code)
  assert.equal(rescored.isCurrent, true)
  assert.equal(rescored.provisionalLevel, 'A2')
  assert.equal(rescored.placementBandCode, 'B1_SOLID')
  assert.ok(String(rescored.placementNotes || '').includes('ceiling'))

  const historyAfterRescore = await scoringService.getAssessmentResultDetail(rescored.id, tenantA.id)
  assert.equal(historyAfterRescore.history.length, 2)
  assert.equal(historyAfterRescore.history[0].isCurrent, true)
  assert.equal(historyAfterRescore.history[1].code, result.code)

  const oldResultRow = await app.db.query('api::assessment-result.assessment-result').findOne({ where: { id: Number(result.id) }, select: ['status', 'isCurrent'] })
  assert.equal(oldResultRow.status, 'superseded')
  assert.equal(oldResultRow.isCurrent, false)

  await learningService.updateQuestion(entityRef(listeningQuestions[0]), {
    code: listeningQuestions[0].code,
    title: listeningQuestions[0].title,
    questionText: listeningQuestions[0].questionText,
    type: 'single_choice',
    subject: subjectA.id,
    skills: [listeningSkill.id],
    stimulus: entityRef(audioStimulus),
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'A', content: 'Option A', isCorrect: false, order: 1 },
      { label: 'B', value: 'B', content: 'Option B', isCorrect: true, order: 2 },
    ],
  }, tenantA.id)

  const rescoredAfterMutation = await scoringService.rescoreAssessmentAttempt(started.attempt.id, tenantA.id, { scoringVersion: 3 })
  const s01Score = rescoredAfterMutation.answerScores.find((item) => item.question?.code === 'S01')
  assert.equal(s01Score.awardedPoints, 1)

  const detailAfterMutation = await scoringService.getAssessmentResultDetail(rescoredAfterMutation.id, tenantA.id)
  const s01ReviewAfterMutation = detailAfterMutation.reviewItems.find((item) => item.questionCode === 'S01')
  assert.ok(Array.isArray(s01ReviewAfterMutation.correctOptionIds))
  assert.ok(s01ReviewAfterMutation.correctOptionIds.includes(s01OriginalCorrectOptionId))

  await expectReject(() => scoringService.getAssessmentResult(started.attempt.id, tenantB.id), /not found/i)
  await expectReject(() => scoringService.getAssessmentResultDetail(rescoredAfterMutation.id, tenantB.id), /not found/i)

  await cleanupScoringTree(tenantA.id)
  await cleanupScoringTree(tenantB.id)
  while (cleanup.length > 0) {
    const job = cleanup.pop()
    await job()
  }
})