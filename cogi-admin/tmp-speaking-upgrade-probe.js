const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  const cleanup = [];
  try {
    const results = await strapi.db.query('api::assessment-result.assessment-result').findMany({
      where: { isCurrent: true },
      populate: { tenant: { select: ['id'] }, assessmentVersion: { select: ['id', 'code', 'candidateLevelFrom', 'candidateLevelTo', 'ceilingLevel'] } },
      orderBy: [{ scoredAt: 'desc' }, { id: 'desc' }],
      limit: 20,
    });
    let result = null;
    for (const row of results) {
      const review = await strapi.db.query('api::assessment-speaking-review.assessment-speaking-review').findOne({ where: { assessmentResult: { id: { $eq: row.id } } }, select: ['id'] });
      if (!review?.id) { result = row; break; }
    }
    if (!result?.id) throw new Error('No fresh result found');
    const otherResult = results.find((row) => Number(row?.tenant?.id || 0) !== Number(result?.tenant?.id || 0)) || null;
    const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] });
    const tempUser = await strapi.db.query('plugin::users-permissions.user').create({ data: { username: `speaking-upgrade-${Date.now()}`, email: `speaking-upgrade-${Date.now()}@example.com`, password: 'Pass1234!', provider: 'local', confirmed: true, blocked: false, role: role.id }, select: ['id'] });
    cleanup.push(async () => strapi.db.query('plugin::users-permissions.user').delete({ where: { id: tempUser.id } }).catch(() => {}));
    const criterionCodes = ['FLUENCY','VOCABULARY','GRAMMAR','PRONUNCIATION','INTERACTION'];
    const criterionIds = [];
    for (const [index, code] of criterionCodes.entries()) {
      const row = await strapi.db.query('api::assessment-speaking-criterion.assessment-speaking-criterion').create({ data: { assessmentVersion: result.assessmentVersion.id, code, label: code, description: `${code} desc`, guidance: `${code} guide`, order: index + 1, maxScore: 5, required: true, status: 'active', tenant: result.tenant.id }, select: ['id'] });
      criterionIds.push(row.id);
    }
    cleanup.push(async () => { for (const id of criterionIds.reverse()) { await strapi.db.query('api::assessment-speaking-criterion.assessment-speaking-criterion').delete({ where: { id } }).catch(() => {}); } });

    const scoring = strapi.service('api::assessment-scoring.assessment-scoring');
    const review = await scoring.createSpeakingReviewForResult(result.id, result.tenant.id, { authUserId: tempUser.id });
    cleanup.push(async () => strapi.db.query('api::assessment-speaking-review.assessment-speaking-review').delete({ where: { id: Number(review.id) } }).catch(() => {}));
    const started = await scoring.startSpeakingReview(review.id, result.tenant.id, { authUserId: tempUser.id });

    let criterionMaxValidation = false;
    try {
      await scoring.saveSpeakingReview(review.id, { reviewMode: 'live', criteriaScores: [{ criterionCode: 'FLUENCY', score: 5.5 }] }, result.tenant.id, { authUserId: tempUser.id });
    } catch (error) {
      criterionMaxValidation = /maxScore/i.test(String(error?.message || error));
    }

    const recordingDraft = await scoring.saveSpeakingReview(review.id, {
      reviewMode: 'recording',
      criteriaScores: [
        { criterionCode: 'FLUENCY', score: 3 },
        { criterionCode: 'VOCABULARY', score: 4 },
        { criterionCode: 'GRAMMAR', score: 3 },
        { criterionCode: 'PRONUNCIATION', score: 4 },
        { criterionCode: 'INTERACTION', score: 3 },
      ],
      strengths: 'Strong interaction',
      areasForImprovement: 'Grammar consistency',
      reviewNotes: 'Draft notes',
      suggestedLevel: 'A2',
    }, result.tenant.id, { authUserId: tempUser.id });

    let requiredCriteriaValidation = false;
    try {
      await scoring.completeSpeakingReview(review.id, {
        reviewMode: 'live',
        criteriaScores: [
          { criterionCode: 'FLUENCY', score: 3 },
          { criterionCode: 'VOCABULARY', score: 4 },
          { criterionCode: 'GRAMMAR', score: 3 },
          { criterionCode: 'PRONUNCIATION', score: 4 },
        ],
        suggestedLevel: 'A2',
      }, result.tenant.id, { authUserId: tempUser.id });
    } catch (error) {
      requiredCriteriaValidation = /Score is required|criterion/i.test(String(error?.message || error));
    }

    const fakeForeignAsset = otherResult ? await strapi.db.query('api::file-asset.file-asset').create({
      data: {
        tenant: otherResult.tenant.id,
        moduleKey: 'assessment-speaking-review',
        originalName: 'foreign-speaking.mp3',
        fileName: 'foreign-speaking.mp3',
        extension: 'mp3',
        mimeType: 'audio/mpeg',
        size: '1',
        provider: 'local',
        relativePath: 'tenants/test/assessment-speaking-review/foreign-speaking.mp3',
        url: '/storage/tenants/test/assessment-speaking-review/foreign-speaking.mp3',
        uploadedBy: null,
        isPublic: true,
        status: 'ACTIVE',
      },
      select: ['id'],
    }) : null;
    if (fakeForeignAsset?.id) cleanup.push(async () => strapi.db.query('api::file-asset.file-asset').delete({ where: { id: fakeForeignAsset.id } }).catch(() => {}));

    let crossTenantRecordingAsset = false;
    if (fakeForeignAsset?.id) {
      try {
        await scoring.saveSpeakingReview(review.id, { reviewMode: 'recording', recordingAsset: fakeForeignAsset.id }, result.tenant.id, { authUserId: tempUser.id });
      } catch (error) {
        crossTenantRecordingAsset = /recordingAsset|current tenant/i.test(String(error?.message || error));
      }
    }

    const completed = await scoring.completeSpeakingReview(review.id, {
      reviewMode: 'recording',
      criteriaScores: [
        { criterionCode: 'FLUENCY', score: 3 },
        { criterionCode: 'VOCABULARY', score: 4 },
        { criterionCode: 'GRAMMAR', score: 3 },
        { criterionCode: 'PRONUNCIATION', score: 4 },
        { criterionCode: 'INTERACTION', score: 3 },
      ],
      strengths: 'Strong interaction',
      areasForImprovement: 'Grammar consistency',
      reviewNotes: 'Completed notes',
      suggestedLevel: 'A2',
    }, result.tenant.id, { authUserId: tempUser.id });

    let completedReadOnly = false;
    try {
      await scoring.saveSpeakingReview(review.id, { reviewNotes: 'Should fail after complete' }, result.tenant.id, { authUserId: tempUser.id });
    } catch (error) {
      completedReadOnly = /read-only/i.test(String(error?.message || error));
    }

    console.log(JSON.stringify({
      fixtureResultId: result.id,
      liveReview: review?.reviewMode === 'live' || review?.status === 'pending',
      recordingReview: recordingDraft?.reviewMode === 'recording',
      draftSaveReload: recordingDraft?.status === 'in_review' && recordingDraft?.suggestedLevel === 'A2',
      criterionMaxValidation,
      requiredCriteriaValidation,
      overallScore: completed?.overallScore === 17 && Number(completed?.overallMaxScore || completed?.maxScore || 0) === 25 && Number(completed?.percentage || 0) === 68,
      manualSuggestedLevel: completed?.suggestedLevel === 'A2',
      completeReview: completed?.status === 'completed',
      completedReadOnly,
      snapshotStability: Array.isArray(completed?.criteriaSnapshot) && completed.criteriaSnapshot[0]?.guidance === 'FLUENCY guide' && completed.criteriaSnapshot[0]?.required === true,
      crossTenantRecordingAsset,
    }, null, 2));
  } finally {
    for (const job of cleanup.reverse()) await job();
  }
})().catch((error) => { console.error(error); process.exit(1); });
