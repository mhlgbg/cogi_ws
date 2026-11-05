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

function loadLearningService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'learning-management', 'services', 'learning-management.js')
  delete require.cache[require.resolve(modulePath)]
  return require(modulePath)
}

function loadAssessmentService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'assessment-management', 'services', 'assessment-management.js')
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
      uploadedBy: authenticatedRoleId > 0 ? null : null,
      isPublic: true,
      status: 'ACTIVE',
      metadata: null,
    },
    populate: {
      tenant: { select: ['id', 'code', 'name'] },
      uploadedBy: { select: ['id', 'username', 'email'] },
    },
  })
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
      username: `${label}`,
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

async function createGrade(tenantId, code) {
  return app.db.query('api::grade.grade').create({
    data: {
      code,
      title: code,
      gradeStatus: 'active',
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

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  app = await createStrapi(appContext).load()
  learningService = loadLearningService()
  assessmentService = loadAssessmentService()
  const authenticatedRole = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] })
  authenticatedRoleId = Number(authenticatedRole?.id || 0)
  assert.ok(authenticatedRoleId > 0, 'authenticated role must exist')
})

after(async () => {
  if (app) await app.destroy()
})

test('Case 1, 3, 4, 5, 6, 7: question stimulus foundation works with tenant isolation and delete protection', async () => {
  const cleanup = []
  const key = uniqueKey('stimulus')
  const tenantA = await createTenant(`${key}-tenant-a`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenantA.id))
  const tenantB = await createTenant(`${key}-tenant-b`)
  cleanup.push(() => destroyEntity('api::tenant.tenant', tenantB.id))

  const userA = await createUser(`${key}-user-a`)
  cleanup.push(() => destroyEntity('plugin::users-permissions.user', userA.id))

  const subjectA = await createSubject(tenantA.id, `${key}-english`)
  cleanup.push(() => destroyEntity('api::subject.subject', subjectA.id))
  const gradeA = await createGrade(tenantA.id, `${key}-g35`)
  cleanup.push(() => destroyEntity('api::grade.grade', gradeA.id))
  const listeningSkill = await createSkill(tenantA.id, subjectA.id, `${key}-listening`, 'Listening')
  cleanup.push(() => destroyEntity('api::skill.skill', listeningSkill.id))

  const audioFile = await createFileAsset(tenantA.id, `${key}-audio`, 'audio/mpeg', '.mp3')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', audioFile.id))

  const imageFile = await createFileAsset(tenantA.id, `${key}-image`, 'image/png', '.png')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', imageFile.id))

  const optionAImage = await createFileAsset(tenantA.id, `${key}-option-a`, 'image/png', '.png')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', optionAImage.id))

  const optionBImage = await createFileAsset(tenantA.id, `${key}-option-b`, 'image/png', '.png')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', optionBImage.id))

  const optionCImage = await createFileAsset(tenantA.id, `${key}-option-c`, 'image/png', '.png')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', optionCImage.id))

  const outsiderAudioFile = await createFileAsset(tenantB.id, `${key}-outsider-audio`, 'audio/mpeg', '.mp3')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', outsiderAudioFile.id))

  const outsiderImageFile = await createFileAsset(tenantB.id, `${key}-outsider-image`, 'image/png', '.png')
  cleanup.push(() => destroyEntity('api::file-asset.file-asset', outsiderImageFile.id))

  const audioStimulus = await learningService.createQuestionStimulus({
    code: `${key}-audio-stimulus`,
    title: 'Listening M01',
    type: 'audio',
    instruction: 'Listen and answer questions 1-3.',
    audioAsset: audioFile.id,
    stimulusStatus: 'active',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', audioStimulus.id))

  const readingStimulus = await learningService.createQuestionStimulus({
    code: `${key}-reading-stimulus`,
    title: 'Reading passage',
    type: 'text',
    content: 'This is a shared reading passage.',
    stimulusStatus: 'active',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', readingStimulus.id))

  const htmlStimulus = await learningService.createQuestionStimulus({
    code: `${key}-html-stimulus`,
    title: 'Baking',
    type: 'text',
    contentType: 'html',
    content: '<h2 style="text-align:center;">Baking</h2><script>alert(1)</script><p>My grandmother loves making bread and cakes...</p>',
    stimulusStatus: 'active',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', htmlStimulus.id))

  const mixedStimulus = await learningService.createQuestionStimulus({
    code: `${key}-mixed-stimulus`,
    title: 'Mixed passage',
    type: 'mixed',
    content: 'Look and listen.',
    imageAsset: imageFile.id,
    stimulusStatus: 'active',
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', mixedStimulus.id))

  const audioQuestion = await learningService.createQuestion({
    code: `${key}-q-audio`,
    title: 'Audio question',
    questionText: 'What do you hear?',
    questionTextType: 'plain_text',
    type: 'single_choice',
    stimulus: audioStimulus.id,
    subject: subjectA.id,
    grade: gradeA.id,
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'a', content: 'Cat' },
      { label: 'B', value: 'b', content: 'Monkey' },
      { label: 'C', value: 'c', content: 'Fish' },
    ],
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question.question', audioQuestion.id))

  const imageOptionQuestion = await learningService.createQuestion({
    code: `${key}-q-image-option`,
    title: 'Image options question',
    questionText: 'Pick the correct picture.',
    questionTextType: 'plain_text',
    type: 'single_choice',
    stimulus: audioStimulus.id,
    subject: subjectA.id,
    grade: gradeA.id,
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'a', imageAsset: optionAImage.id },
      { label: 'B', value: 'b', imageAsset: optionBImage.id },
      { label: 'C', value: 'c', imageAsset: optionCImage.id },
    ],
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question.question', imageOptionQuestion.id))

  const sharedQ1 = await learningService.createQuestion({
    code: `${key}-q-read-1`,
    questionText: 'Reading Q1',
    type: 'single_choice',
    stimulus: readingStimulus.id,
    subject: subjectA.id,
    grade: gradeA.id,
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'a', content: 'One' },
      { label: 'B', value: 'b', content: 'Two' },
    ],
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question.question', sharedQ1.id))

  assert.equal(readingStimulus.contentType, 'plain_text')
  assert.equal(htmlStimulus.contentType, 'html')
  assert.match(htmlStimulus.content, /<h2 style="text-align:center">Baking<\/h2>/)
  assert.doesNotMatch(htmlStimulus.content, /<script/i)

  const sharedQ2 = await learningService.createQuestion({
    code: `${key}-q-read-2`,
    questionText: 'Reading Q2',
    type: 'single_choice',
    stimulus: readingStimulus.id,
    subject: subjectA.id,
    grade: gradeA.id,
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'a', content: 'One' },
      { label: 'B', value: 'b', content: 'Two' },
    ],
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question.question', sharedQ2.id))

  const sharedQ3 = await learningService.createQuestion({
    code: `${key}-q-read-3`,
    questionText: 'Reading Q3',
    type: 'single_choice',
    stimulus: readingStimulus.id,
    subject: subjectA.id,
    grade: gradeA.id,
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'a', content: 'One' },
      { label: 'B', value: 'b', content: 'Two' },
    ],
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question.question', sharedQ3.id))

  const standaloneQuestion = await learningService.createQuestion({
    code: `${key}-q-standalone`,
    questionText: '<p>Suzie needs to get some fairly cheap sports clothes for wearing at the gym.</p><script>alert(1)</script><p>She\'s in a hurry, so doesn\'t want to spend too long shopping.</p>',
    questionTextType: 'html',
    type: 'single_choice',
    subject: subjectA.id,
    grade: gradeA.id,
    questionStatus: 'active',
    options: [
      { label: 'A', value: 'a', content: 'Yes' },
      { label: 'B', value: 'b', content: 'No' },
    ],
  }, tenantA.id)
  cleanup.push(() => destroyEntity('api::question.question', standaloneQuestion.id))

  const listResult = await learningService.getQuestions({ q: key, page: 1, pageSize: 20 }, tenantA.id)
  const listRows = Array.isArray(listResult?.data) ? listResult.data : []
  const loadedImageOptionQuestion = listRows.find((item) => item.code === imageOptionQuestion.code)
  assert.equal(loadedImageOptionQuestion?.stimulus?.code, audioStimulus.code)
  assert.equal(loadedImageOptionQuestion?.options?.length, 3)
  assert.ok(loadedImageOptionQuestion?.stimulus?.audioAsset?.url)
  assert.ok(loadedImageOptionQuestion?.options?.every((item) => item.imageAsset && item.imageAsset.url))

  const readingDetail = await learningService.getQuestionStimulusDetail(readingStimulus.id, tenantA.id)
  assert.equal(readingDetail.questions.length, 3)
  assert.deepEqual(readingDetail.questions.map((item) => item.code).sort(), [sharedQ1.code, sharedQ2.code, sharedQ3.code].sort())

  const assessment = await assessmentService.createAssessment({ code: `${key}-assessment`, name: 'Stimulus usage assessment', subject: subjectA.id, assessmentType: 'practice', status: 'draft' }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment.assessment', assessment.id))
  const version = await assessmentService.createAssessmentVersion({ code: `${key}-assessment-v1`, version: 1, title: 'Stimulus usage version', assessment: assessment.id, versionStatus: 'draft', durationMinutes: 15 }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-version.assessment-version', version.id))
  const section = await assessmentService.createAssessmentSection({ assessmentVersion: version.id, code: 'P1', title: 'Part 1', order: 1, skill: listeningSkill.id, stimulus: audioStimulus.id, questionDisplayMode: 'all' }, tenantA.id)
  cleanup.push(() => destroyEntity('api::assessment-section.assessment-section', section.id))

  const linkedUsage = await learningService.getQuestionStimulusUsage(audioStimulus.id, tenantA.id)
  assert.equal(linkedUsage.questionCount, 2)
  assert.equal(linkedUsage.partCount, 1)
  assert.equal(linkedUsage.totalLiveReferences, 3)
  assert.equal(linkedUsage.parts[0]?.code, 'P1')

  const mixedDetail = await learningService.getQuestionStimulusDetail(mixedStimulus.id, tenantA.id)
  assert.equal(mixedDetail.type, 'mixed')
  assert.ok(mixedDetail.imageAsset)
  assert.equal(mixedDetail.content, 'Look and listen.')

  const standaloneLoaded = listRows.find((item) => item.code === standaloneQuestion.code)
  assert.equal(standaloneLoaded?.stimulus || null, null)
  assert.equal(audioQuestion.questionTextType, 'plain_text')
  assert.equal(standaloneLoaded?.questionTextType, 'html')
  assert.match(standaloneLoaded?.questionText || '', /<p>Suzie needs to get some fairly cheap sports clothes for wearing at the gym\.<\/p>/)
  assert.doesNotMatch(standaloneLoaded?.questionText || '', /<script/i)

  const outsiderStimulus = await learningService.createQuestionStimulus({
    code: `${key}-outsider`,
    type: 'text',
    content: 'Outsider stimulus',
    stimulusStatus: 'active',
  }, tenantB.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', outsiderStimulus.id))

  await assert.rejects(
    () => learningService.createQuestion({
      code: `${key}-cross-tenant-question`,
      questionText: 'Cross tenant should fail',
      type: 'single_choice',
      stimulus: outsiderStimulus.id,
      subject: subjectA.id,
      grade: gradeA.id,
      options: [{ label: 'A', value: 'a', content: 'A' }],
    }, tenantA.id),
    /stimulus does not belong to current tenant/i,
  )

  await assert.rejects(
    () => learningService.createQuestionStimulus({
      code: `${key}-cross-tenant-audio`,
      type: 'audio',
      audioAsset: outsiderAudioFile.id,
      stimulusStatus: 'active',
    }, tenantA.id),
    /audioAsset does not belong to current tenant/i,
  )

  await assert.rejects(
    () => learningService.createQuestion({
      code: `${key}-cross-tenant-option-image`,
      questionText: 'Cross tenant option image should fail',
      type: 'single_choice',
      subject: subjectA.id,
      grade: gradeA.id,
      options: [{ label: 'A', value: 'a', imageAsset: outsiderImageFile.id }],
    }, tenantA.id),
    /imageAsset does not belong to current tenant/i,
  )

  const tenantAStimulusList = await learningService.listQuestionStimuli({ q: key, page: 1, pageSize: 20 }, tenantA.id)
  const tenantAStimulusCodes = (tenantAStimulusList.data || []).map((item) => item.code)
  assert.ok(!tenantAStimulusCodes.includes(outsiderStimulus.code))

  await assert.rejects(
    () => learningService.deleteQuestionStimulus(audioStimulus.id, tenantA.id),
    /still used by 2 question\(s\) and 1 part\(s\)/i,
  )

  await learningService.updateQuestion(audioQuestion.id, { stimulus: null }, tenantA.id)
  await learningService.updateQuestion(imageOptionQuestion.id, { stimulus: null }, tenantA.id)
  const partOnlyUsage = await learningService.getQuestionStimulusUsage(audioStimulus.id, tenantA.id)
  assert.equal(partOnlyUsage.questionCount, 0)
  assert.equal(partOnlyUsage.partCount, 1)
  assert.equal(partOnlyUsage.totalLiveReferences, 1)

  await assessmentService.updateAssessmentSection(section.id, { assessmentVersion: version.id, code: 'P1', title: 'Part 1', order: 1, skill: listeningSkill.id, stimulus: null, questionDisplayMode: 'all' }, tenantA.id)
  const orphanUsage = await learningService.getQuestionStimulusUsage(audioStimulus.id, tenantA.id)
  assert.equal(orphanUsage.questionCount, 0)
  assert.equal(orphanUsage.partCount, 0)
  assert.equal(orphanUsage.totalLiveReferences, 0)
  assert.equal(orphanUsage.media.audioAsset.canDelete, true)

  const deletedStimulus = await learningService.deleteQuestionStimulus(audioStimulus.id, tenantA.id, { deleteUnusedMedia: true })
  assert.equal(Array.isArray(deletedStimulus.deletedMediaAssetIds), true)
  const softDeletedAudioFile = await app.db.query('api::file-asset.file-asset').findOne({ where: { id: audioFile.id }, select: ['id', 'status', 'isDeleted'] })
  assert.equal(softDeletedAudioFile?.status, 'DELETED')
  assert.equal(softDeletedAudioFile?.isDeleted, true)

  await assert.rejects(
    () => learningService.createQuestionStimulus({
      code: `${key}-audio-stimulus`,
      type: 'text',
      content: 'Duplicate code in same tenant',
      stimulusStatus: 'draft',
    }, tenantA.id),
    /code already exists in this tenant/i,
  )

  const duplicateCodeOtherTenant = await learningService.createQuestionStimulus({
    code: `${key}-audio-stimulus`,
    type: 'text',
    content: 'Same code in different tenant',
    stimulusStatus: 'active',
  }, tenantB.id)
  cleanup.push(() => destroyEntity('api::question-stimulus.question-stimulus', duplicateCodeOtherTenant.id))

  await assert.rejects(
    () => learningService.createQuestionStimulus({
      code: `${key}-invalid-active-audio`,
      type: 'audio',
      stimulusStatus: 'active',
    }, tenantA.id),
    /Active audio stimulus must include audioAsset/i,
  )

  await assert.rejects(
    () => learningService.createQuestionStimulus({
      code: `${key}-invalid-active-image`,
      type: 'image',
      stimulusStatus: 'active',
    }, tenantA.id),
    /Active image stimulus must include imageAsset/i,
  )

  await assert.rejects(
    () => learningService.createQuestionStimulus({
      code: `${key}-invalid-active-text`,
      type: 'text',
      stimulusStatus: 'active',
    }, tenantA.id),
    /Active text stimulus must include content/i,
  )

  await assert.rejects(
    () => learningService.createQuestionStimulus({
      code: `${key}-invalid-active-mixed`,
      type: 'mixed',
      stimulusStatus: 'active',
    }, tenantA.id),
    /Active mixed stimulus must include content, audioAsset, or imageAsset/i,
  )

  while (cleanup.length > 0) {
    const job = cleanup.pop()
    await job()
  }
})
