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
      code: `${label}`,
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
    select: ['id', 'username', 'email', 'fullName'],
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
  if (!matched) {
    throw new Error(`Expected rejection matching ${expectedPattern}`)
  }
}

async function createQuestionSeries(tenantId, subjectId, skillId, prefix, count, questionStatus = 'active', stimulus = null, type = 'single_choice') {
  const rows = []
  for (let index = 1; index <= count; index += 1) {
    const code = `${prefix}${String(index).padStart(2, '0')}`
    const row = await learningService.createQuestion({
      code,
      title: code,
      questionText: `${code} question text`,
      questionTextType: 'plain_text',
      type,
      subject: subjectId,
      skills: [skillId],
      stimulus: stimulus ? entityRef(stimulus) : null,
      questionStatus,
      options: type === 'essay' ? [] : [
        { label: 'A', value: 'A', content: 'Option A', isCorrect: true, order: 1 },
        { label: 'B', value: 'B', content: 'Option B', isCorrect: false, order: 2 },
      ],
    }, tenantId)
    rows.push(row)
  }
  return rows
}

async function createQuestionWithImageOptions(tenantId, subjectId, skillId, prefix, imageAssets = []) {
  return learningService.createQuestion({
    code: `${prefix}-IMG`,
    title: `${prefix}-IMG`,
    questionText: '<p>Suzie needs to get some fairly cheap sports clothes for wearing at the gym.</p><p>She\'s in a hurry, so doesn\'t want to spend too long shopping.</p>',
    questionTextType: 'html',
    questionImageAsset: entityRef(imageAssets[3]) || null,
    type: 'single_choice',
    subject: subjectId,
    skills: [skillId],
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'A', content: 'Dog', isCorrect: true, order: 1, imageAsset: entityRef(imageAssets[0]) },
      { label: 'B', value: 'B', content: 'Cat', isCorrect: false, order: 2, imageAsset: entityRef(imageAssets[1]) },
      { label: 'C', value: 'C', content: 'Fish', isCorrect: false, order: 3, imageAsset: entityRef(imageAssets[2]) },
    ],
  }, tenantId)
}

async function cleanupRuntimeTree(tenantId) {
  const answers = await app.db.query('api::assessment-answer.assessment-answer').findMany({ where: { tenant: { id: { $eq: tenantId } } }, select: ['id'] })
  for (const row of answers || []) await destroyEntity('api::assessment-answer.assessment-answer', row.id)

  const attempts = await app.db.query('api::assessment-attempt.assessment-attempt').findMany({ where: { tenant: { id: { $eq: tenantId } } }, select: ['id'] })
  for (const row of attempts || []) await destroyEntity('api::assessment-attempt.assessment-attempt', row.id)
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

test('Assessment runtime foundation supports start, save, audio, resume, submit, expiry, and snapshot isolation', async () => {
  const cleanup = []
  const key = uniqueKey('assessment-runtime')
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

  const audioFile = await createFileAsset(tenantA.id, `${key}-audio`, 'audio/mpeg', '.mp3', 'assessment-runtime')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', audioFile.id))
  const stimulusImageFile = await createFileAsset(tenantA.id, `${key}-stimulus-image`, 'image/png', '.png', 'question-bank')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', stimulusImageFile.id))
  const optionImageA = await createFileAsset(tenantA.id, `${key}-option-a`, 'image/png', '.png', 'question-bank')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', optionImageA.id))
  const optionImageB = await createFileAsset(tenantA.id, `${key}-option-b`, 'image/png', '.png', 'question-bank')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', optionImageB.id))
  const optionImageC = await createFileAsset(tenantA.id, `${key}-option-c`, 'image/png', '.png', 'question-bank')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', optionImageC.id))
  const questionImageFile = await createFileAsset(tenantA.id, `${key}-question-image`, 'image/png', '.png', 'question-bank')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', questionImageFile.id))
  const questionImageFileReplacement = await createFileAsset(tenantA.id, `${key}-question-image-replacement`, 'image/png', '.png', 'question-bank')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', questionImageFileReplacement.id))
  const audioStimulus = await learningService.createQuestionStimulus({
    code: `${key}-AUDIO-STIMULUS`,
    title: 'Audio stimulus',
    type: 'audio',
    instruction: 'Listen carefully',
    audioAsset: entityRef(audioFile),
    imageAsset: entityRef(stimulusImageFile),
    stimulusStatus: 'active',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', audioStimulus.id))
  const sharedAudioStimulus = await learningService.createQuestionStimulus({
    code: `${key}-PART-AUDIO-STIMULUS`,
    title: 'Shared part audio stimulus',
    type: 'audio',
    instruction: 'Listen to the whole part first',
    audioAsset: entityRef(audioFile),
    stimulusStatus: 'active',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', sharedAudioStimulus.id))

  const readingStimulus = await learningService.createQuestionStimulus({
    code: `${key}-READING-STIMULUS`,
    title: 'Baking',
    type: 'text',
    contentType: 'html',
    content: '<h2 style="text-align:center;">Baking</h2><script>alert(1)</script><p>My grandmother loves making bread and cakes...</p>',
    stimulusStatus: 'active',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', readingStimulus.id))

  const listeningQuestions = await createQuestionSeries(tenantA.id, subjectA.id, listeningSkill.id, 'S', 9, 'active', audioStimulus)
  const readingQuestions = await createQuestionSeries(tenantA.id, subjectA.id, readingSkill.id, 'R', 9, 'active', readingStimulus)
  const imageOptionQuestion = await createQuestionWithImageOptions(tenantA.id, subjectA.id, readingSkill.id, key, [optionImageA, optionImageB, optionImageC, questionImageFile])
  const languageQuestions = await createQuestionSeries(tenantA.id, subjectA.id, languageSkill.id, 'L', 5)
  const writingQuestions = await createQuestionSeries(tenantA.id, subjectA.id, writingSkill.id, 'W', 1, 'active', null, 'essay')
  const draftQuestion = await createQuestionSeries(tenantA.id, subjectA.id, readingSkill.id, 'D', 1, 'draft')
  const tenantBQuestion = await createQuestionSeries(tenantB.id, subjectB.id, listeningSkillB.id, 'X', 1)
  for (const row of [...listeningQuestions, ...readingQuestions, imageOptionQuestion, ...languageQuestions, ...writingQuestions, ...draftQuestion, ...tenantBQuestion]) {
    cleanup.push(() => destroyEntity('api::question.question', row.id))
  }

  const assessment = await assessmentService.createAssessment({ code: `${key}-VTF-LEVEL-S`, name: 'Runtime Assessment', subject: subjectA.id, assessmentType: 'placement', status: 'draft' }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', assessment.id))
  const version = await assessmentService.createAssessmentVersion({ code: `${key}-VTF-LEVEL-S-V3`, version: 3, title: 'Runtime Secondary', assessment: assessment.id, versionStatus: 'draft', durationMinutes: 20, gradeFrom: 6, gradeTo: 9, candidateLevelFrom: 'A1', candidateLevelTo: 'B1', resultMode: 'provisional', requiresSpeaking: true, requiresTeacherConfirmation: true }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', version.id))
  const sectionListening = await assessmentService.createAssessmentSection({ assessmentVersion: version.id, code: 'LISTENING', title: 'Listening', order: 1, skill: listeningSkill.id, stimulus: entityRef(sharedAudioStimulus), questionDisplayMode: 'all', instruction: 'There are seven questions in this part.\nFor each question, choose the correct answer A, B or C.', instructionContentType: 'plain_text', instructionImageAsset: entityRef(questionImageFile) }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionListening.id))
  const sectionReading = await assessmentService.createAssessmentSection({ assessmentVersion: version.id, code: 'READING', title: 'Reading', order: 2, skill: readingSkill.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionReading.id))
  const sectionLanguage = await assessmentService.createAssessmentSection({ assessmentVersion: version.id, code: 'LANGUAGE_IN_USE', title: 'Language in Use', order: 3, skill: languageSkill.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionLanguage.id))
  const sectionWriting = await assessmentService.createAssessmentSection({ assessmentVersion: version.id, code: 'WRITING', title: 'Writing', order: 4, skill: writingSkill.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', sectionWriting.id))

  const createdAssessmentQuestions = []
  for (let index = 0; index < listeningQuestions.length; index += 1) createdAssessmentQuestions.push(await assessmentService.addAssessmentQuestion({ section: sectionListening.id, question: listeningQuestions[index].id, order: index + 1, points: 1, required: true, audioPlayLimit: 2, allowSeek: false }, tenantA.id))
  for (let index = 0; index < readingQuestions.length; index += 1) createdAssessmentQuestions.push(await assessmentService.addAssessmentQuestion({ section: sectionReading.id, question: readingQuestions[index].id, order: index + 1, points: 1, required: true }, tenantA.id))
  createdAssessmentQuestions.push(await assessmentService.addAssessmentQuestion({ section: sectionReading.id, question: imageOptionQuestion.id, order: readingQuestions.length + 1, points: 1, required: true }, tenantA.id))
  for (let index = 0; index < languageQuestions.length; index += 1) createdAssessmentQuestions.push(await assessmentService.addAssessmentQuestion({ section: sectionLanguage.id, question: languageQuestions[index].id, order: index + 1, points: 1, required: true }, tenantA.id))
  createdAssessmentQuestions.push(await assessmentService.addAssessmentQuestion({ section: sectionWriting.id, question: writingQuestions[0].id, order: 1, points: 5, required: true, minWords: 35, maxWords: 50 }, tenantA.id))
  createdAssessmentQuestions.push(await assessmentService.addAssessmentQuestion({ section: sectionReading.id, question: draftQuestion[0].id, order: 10, points: 1, required: false }, tenantA.id))
  for (const row of createdAssessmentQuestions) cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', row.id))

  await assessmentService.updateAssessmentVersion(entityRef(version), { versionStatus: 'published' }, tenantA.id)

  const started = await runtimeService.startAssessmentAttempt(entityRef(version), { sourceType: 'campaign', sourceRef: `${key}-campaign`, resumeExisting: true }, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  assert.equal(started.attempt.status, 'in_progress')
  assert.equal(started.candidateDefinition.version.totalQuestions, 26)
  assert.equal(started.candidateDefinition.sections.length, 4)
  assert.equal(started.candidateDefinition.sections[0].stimulus.code, sharedAudioStimulus.code)
  assert.equal(started.candidateDefinition.sections[0].questionDisplayMode, 'all')
  assert.equal(started.candidateDefinition.sections[0].instructionContentType, 'plain_text')
  assert.equal(started.candidateDefinition.sections[0].instructionImage.code, questionImageFile.code || '')
  assert.equal(started.candidateDefinition.sections[0].listenLimit, started.candidateDefinition.sections[0].audioPlayLimit)
  assert.match(started.candidateDefinition.sections[0].stimulus.audioAsset.runtimeUrl, /\/api\/assessment-runtime\/assessment-attempts\/.+\/audio\?mediaToken=/)
  assert.ok(!('correctAnswer' in started.candidateDefinition.sections[0].questions[0].question))
  assert.ok(!('isCorrect' in started.candidateDefinition.sections[0].questions[0].question.options[0]))
  assert.match(started.candidateDefinition.sections[0].questions[0].question.stimulus.imageAsset.url, /\/api\/storage\/files\/.+\/download\?mediaToken=/)
  assert.doesNotMatch(started.candidateDefinition.sections[0].questions[0].question.stimulus.imageAsset.url, /\/storage\/tenants\//)
  assert.match(started.candidateDefinition.sections[0].questions[0].question.stimulus.audioAsset.runtimeUrl, /\/api\/assessment-runtime\/assessment-attempts\/.+\/audio\?mediaToken=/)

  const runtimeImageQuestion = started.candidateDefinition.sections.find((item) => item.code === 'READING').questions.find((item) => item.question?.code === imageOptionQuestion.code)
  assert.ok(runtimeImageQuestion)
  assert.equal(runtimeImageQuestion.question.options.length, 3)
  assert.equal(runtimeImageQuestion.question.questionImageAsset.code, questionImageFile.code || '')
  assert.equal(runtimeImageQuestion.question.questionTextType, 'html')
  assert.match(runtimeImageQuestion.question.questionText, /<p>Suzie needs to get some fairly cheap sports clothes for wearing at the gym\.<\/p>/)
  assert.match(runtimeImageQuestion.question.questionImageAsset.url, /\/api\/storage\/files\/.+\/download\?mediaToken=/)
  for (const option of runtimeImageQuestion.question.options) {
    assert.match(option.imageAsset.url, /\/api\/storage\/files\/.+\/download\?mediaToken=/)
    assert.doesNotMatch(option.imageAsset.url, /\/storage\/tenants\//)
  }

  const runtimeReadingQuestion = started.candidateDefinition.sections.find((item) => item.code === 'READING').questions[0]
  assert.equal(runtimeReadingQuestion.question.stimulus.contentType, 'html')
  assert.match(runtimeReadingQuestion.question.stimulus.content, /<h2 style="text-align:center">Baking<\/h2>/)
  assert.doesNotMatch(runtimeReadingQuestion.question.stimulus.content, /<script/i)

  const resumedStart = await runtimeService.startAssessmentAttempt(entityRef(version), { sourceType: 'campaign', sourceRef: `${key}-campaign`, resumeExisting: true }, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  assert.equal(resumedStart.attempt.code, started.attempt.code)

  const firstListeningQuestion = started.candidateDefinition.sections.find((item) => item.code === 'LISTENING').questions[0]
  const firstReadingQuestion = started.candidateDefinition.sections.find((item) => item.code === 'READING').questions[0]
  const writingQuestion = started.candidateDefinition.sections.find((item) => item.code === 'WRITING').questions[0]

  const firstPlay = await runtimeService.registerAssessmentAudioPlay(started.attempt.id, firstListeningQuestion.assessmentQuestionId, {}, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })

  const saveOne = await runtimeService.saveAssessmentAnswer(started.attempt.id, firstListeningQuestion.assessmentQuestionId, { answerData: { selectedOptionIds: [firstListeningQuestion.question.options[0].id] }, progressState: { currentSectionCode: 'LISTENING', currentAssessmentQuestionId: firstListeningQuestion.assessmentQuestionId } }, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  assert.equal(saveOne.answer.answerData.selectedOptionIds.length, 1)

  const secondPlay = await runtimeService.registerAssessmentAudioPlay(started.attempt.id, firstListeningQuestion.assessmentQuestionId, {}, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  const saveAgain = await runtimeService.saveAssessmentAnswer(started.attempt.id, firstListeningQuestion.assessmentQuestionId, { answerData: { selectedOptionIds: [firstListeningQuestion.question.options[1].id] }, timeSpentDelta: 12 }, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  assert.equal(saveAgain.answer.answerData.selectedOptionIds[0], firstListeningQuestion.question.options[1].id)
  const persistedAttempt = await app.db.query('api::assessment-attempt.assessment-attempt').findOne({ where: { code: { $eq: started.attempt.code } }, select: ['id'] })
  const answerRows = await app.db.query('api::assessment-answer.assessment-answer').findMany({ where: { tenant: { id: { $eq: tenantA.id } }, attempt: { id: { $eq: Number(persistedAttempt?.id || 0) } } }, select: ['id'] })
  assert.equal(answerRows.length, 1)

  assert.equal(firstPlay.audioPlayCount, 1)
  assert.equal(secondPlay.audioPlayCount, 2)
  await expectReject(() => runtimeService.registerAssessmentAudioPlay(started.attempt.id, firstListeningQuestion.assessmentQuestionId, {}, tenantA.id, { authUserId: userA.id, allowManagerAccess: true }), /Audio play limit exceeded/i)

  const resumed = await runtimeService.resumeAssessmentAttempt(started.attempt.id, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  assert.ok(resumed.answers.some((item) => item.assessmentQuestionId === firstListeningQuestion.assessmentQuestionId))
  assert.equal(resumed.progress.answeredCount, 1)
  assert.match(resumed.candidateDefinition.sections[0].questions[0].question.stimulus.imageAsset.url, /\/api\/storage\/files\/.+\/download\?mediaToken=/)
  assert.equal(resumed.candidateDefinition.sections[0].stimulus.code, sharedAudioStimulus.code)
  assert.equal(resumed.candidateDefinition.sections[0].instructionImage.code, questionImageFile.code || '')

  const legacyAttempt = await app.db.query('api::assessment-attempt.assessment-attempt').create({
    data: {
      code: `${key}-LEGACY`,
      assessment: assessment.id,
      assessmentVersion: version.id,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      tenant: tenantA.id,
      definitionSnapshot: {
        snapshotVersion: 1,
        version: { totalQuestions: 1 },
        sections: [
          {
            code: 'LEGACY',
            questions: [
              {
                assessmentQuestionId: 'legacy-q1',
                question: {
                  code: 'LEGACY-Q1',
                  type: 'single_choice',
                  options: [
                    {
                      label: 'A',
                      value: 'A',
                      imageAsset: {
                        fileName: 'legacy.png',
                        mimeType: 'image/png',
                        relativePath: 'tenants/test/question-bank/legacy.png',
                        url: '/storage/tenants/test/question-bank/legacy.png',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      scoringSnapshot: { sections: [] },
    },
  })
  cleanup.push(() => destroyEntity('api::assessment-attempt.assessment-attempt', legacyAttempt.id))
  const resumedLegacy = await runtimeService.getAssessmentAttempt(legacyAttempt.id, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  assert.equal(resumedLegacy.candidateDefinition.sections[0].questions[0].question.options[0].imageAsset.url, '/storage/tenants/test/question-bank/legacy.png')

  await expectReject(() => runtimeService.submitAssessmentAttempt(started.attempt.id, tenantA.id, { authUserId: userA.id, allowManagerAccess: true }), /Missing required answers/i)

  const originalReadingText = firstReadingQuestion.question.questionText
  const originalListeningInstruction = resumed.candidateDefinition.sections[0].instruction
  await learningService.updateQuestion(entityRef(readingQuestions[0]), { questionText: 'MUTATED QUESTION TEXT' }, tenantA.id)
  await learningService.updateQuestion(entityRef(imageOptionQuestion), { questionImageAsset: entityRef(questionImageFileReplacement) }, tenantA.id)
  await assessmentService.updateAssessmentSection(entityRef(sectionListening), { questionDisplayMode: 'single', instruction: '<p>Mutated after start</p>', stimulus: null, assessmentVersion: entityRef(version), code: 'LISTENING', title: 'Listening', order: 1, skill: entityRef(listeningSkill) }, tenantA.id)
  const resumedAfterMutation = await runtimeService.resumeAssessmentAttempt(started.attempt.id, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  const resumedReadingQuestion = resumedAfterMutation.candidateDefinition.sections.find((item) => item.code === 'READING').questions[0]
  assert.equal(resumedReadingQuestion.question.questionText, originalReadingText)
  const resumedImageQuestion = resumedAfterMutation.candidateDefinition.sections.find((item) => item.code === 'READING').questions.find((question) => question.question?.code === imageOptionQuestion.code)
  assert.equal(resumedImageQuestion.question.questionImageAsset.code, questionImageFile.code || '')
  assert.equal(resumedAfterMutation.candidateDefinition.sections[0].stimulus.code, sharedAudioStimulus.code)
  assert.equal(resumedAfterMutation.candidateDefinition.sections[0].questionDisplayMode, 'all')
  assert.equal(resumedAfterMutation.candidateDefinition.sections[0].instruction, originalListeningInstruction)
  assert.equal(resumedAfterMutation.candidateDefinition.sections[0].instructionImage.code, questionImageFile.code || '')

  for (const section of resumedAfterMutation.candidateDefinition.sections) {
    for (const question of section.questions) {
      if (question?.question?.stimulus?.audioAsset) {
        await runtimeService.registerAssessmentAudioPlay(started.attempt.id, question.assessmentQuestionId, {}, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
      }
      const answerData = question.question.type === 'essay'
        ? { text: 'This is a completed essay answer with enough words to count.' }
        : { selectedOptionIds: [question.question.options[0].id] }
      await runtimeService.saveAssessmentAnswer(started.attempt.id, question.assessmentQuestionId, { answerData }, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
    }
  }

  const submitted = await runtimeService.submitAssessmentAttempt(started.attempt.id, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  assert.equal(submitted.attempt.status, 'submitted')
  await expectReject(() => runtimeService.saveAssessmentAnswer(started.attempt.id, firstReadingQuestion.assessmentQuestionId, { answerData: { selectedOptionIds: [firstReadingQuestion.question.options[0].id] } }, tenantA.id, { authUserId: userA.id, allowManagerAccess: true }), /already submitted/i)

  const shortAssessment = await assessmentService.createAssessment({ code: `${key}-SHORT`, name: 'Short Assessment', subject: subjectA.id, assessmentType: 'practice', status: 'draft' }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', shortAssessment.id))
  const shortVersion = await assessmentService.createAssessmentVersion({ code: `${key}-SHORT-V1`, version: 1, title: 'Short Version', assessment: shortAssessment.id, versionStatus: 'published', durationMinutes: 1 }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', shortVersion.id))
  const shortSection = await assessmentService.createAssessmentSection({ assessmentVersion: shortVersion.id, code: 'SHORT', title: 'Short', order: 1, skill: listeningSkill.id }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', shortSection.id))
  const shortAssessmentQuestion = await assessmentService.addAssessmentQuestion({ section: shortSection.id, question: listeningQuestions[0].id, order: 1, points: 1, required: true, audioPlayLimit: 2 }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-question.assessment-question', shortAssessmentQuestion.id))
  const shortAttempt = await runtimeService.startAssessmentAttempt(entityRef(shortVersion), { resumeExisting: false }, tenantA.id, { authUserId: userA.id, allowManagerAccess: true })
  await app.db.query('api::assessment-attempt.assessment-attempt').update({ where: { id: Number(shortAttempt.attempt.id) }, data: { startedAt: new Date(Date.now() - 3600 * 1000).toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString() } })
  await expectReject(() => runtimeService.saveAssessmentAnswer(shortAttempt.attempt.id, shortAttempt.candidateDefinition.sections[0].questions[0].assessmentQuestionId, { answerData: { selectedOptionIds: [shortAttempt.candidateDefinition.sections[0].questions[0].question.options[0].id] } }, tenantA.id, { authUserId: userA.id, allowManagerAccess: true }), /expired/i)
  await expectReject(() => runtimeService.registerAssessmentAudioPlay(shortAttempt.attempt.id, shortAttempt.candidateDefinition.sections[0].questions[0].assessmentQuestionId, {}, tenantA.id, { authUserId: userA.id, allowManagerAccess: true }), /expired/i)
  await expectReject(() => runtimeService.submitAssessmentAttempt(shortAttempt.attempt.id, tenantA.id, { authUserId: userA.id, allowManagerAccess: true }), /expired/i)

  await expectReject(() => runtimeService.startAssessmentAttempt(entityRef(version), { learner: entityRef(subjectB), resumeExisting: false }, tenantB.id, { authUserId: userA.id, allowManagerAccess: true }), /learner is invalid|does not belong/i)
  await expectReject(() => runtimeService.startAssessmentAttempt(entityRef(version), { resumeExisting: false }, tenantB.id, { authUserId: userA.id, allowManagerAccess: true }), /Assessment Version not found|does not belong/i)

  await cleanupRuntimeTree(tenantA.id)
  await cleanupRuntimeTree(tenantB.id)
  while (cleanup.length > 0) {
    const job = cleanup.pop()
    await job()
  }
})