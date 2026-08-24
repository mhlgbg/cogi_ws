const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  const cleanup = [];
  try {
    const result = await strapi.db.query('api::assessment-result.assessment-result').findOne({
      where: { isCurrent: true, provisionalLevel: { $eq: 'A1' } },
      populate: {
        tenant: { select: ['id'] },
        assessmentVersion: { select: ['id', 'documentId', 'code', 'candidateLevelFrom', 'candidateLevelTo', 'ceilingLevel', 'requiresSpeaking', 'requiresTeacherConfirmation'] },
      },
      orderBy: [{ scoredAt: 'desc' }, { id: 'desc' }],
    });
    if (!result?.id) throw new Error('No suitable provisional result found');

    const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] });
    const tempUser = await strapi.db.query('plugin::users-permissions.user').create({
      data: {
        username: `speaking-review-${Date.now()}`,
        email: `speaking-review-${Date.now()}@example.com`,
        password: 'Pass1234!',
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: role.id,
      },
      select: ['id'],
    });
    cleanup.push(async () => strapi.db.query('plugin::users-permissions.user').delete({ where: { id: tempUser.id } }).catch(() => {}));

    const criterion1 = await strapi.db.query('api::assessment-speaking-criterion.assessment-speaking-criterion').create({
      data: { assessmentVersion: result.assessmentVersion.id, code: 'FLUENCY', label: 'Fluency', order: 1, maxScore: 5, status: 'active', tenant: result.tenant.id },
      select: ['id'],
    });
    const criterion2 = await strapi.db.query('api::assessment-speaking-criterion.assessment-speaking-criterion').create({
      data: { assessmentVersion: result.assessmentVersion.id, code: 'VOCABULARY', label: 'Vocabulary', order: 2, maxScore: 5, status: 'active', tenant: result.tenant.id },
      select: ['id'],
    });
    cleanup.push(async () => strapi.db.query('api::assessment-speaking-criterion.assessment-speaking-criterion').delete({ where: { id: criterion2.id } }).catch(() => {}));
    cleanup.push(async () => strapi.db.query('api::assessment-speaking-criterion.assessment-speaking-criterion').delete({ where: { id: criterion1.id } }).catch(() => {}));

    const scoring = strapi.service('api::assessment-scoring.assessment-scoring');
    const review = await scoring.createSpeakingReviewForResult(result.id, result.tenant.id, { authUserId: tempUser.id });
    cleanup.push(async () => strapi.db.query('api::assessment-speaking-review.assessment-speaking-review').delete({ where: { id: Number(review.id) } }).catch(() => {}));

    const started = await scoring.startSpeakingReview(review.id, result.tenant.id, { authUserId: tempUser.id });

    let invalidCriterionRejected = false;
    try {
      await scoring.saveSpeakingReview(review.id, {
        criteriaScores: [
          { code: 'FLUENCY', score: 6 },
          { code: 'VOCABULARY', score: 4 },
        ],
      }, result.tenant.id, { authUserId: tempUser.id });
    } catch (error) {
      invalidCriterionRejected = /maxScore/i.test(String(error?.message || error));
    }

    let confirmBlockedBeforeSpeaking = false;
    try {
      await scoring.confirmAssessmentPlacement(result.id, { confirmedLevel: 'A2', confirmationNote: 'blocked before speaking complete' }, result.tenant.id, { authUserId: tempUser.id });
    } catch (error) {
      confirmBlockedBeforeSpeaking = /speaking review/i.test(String(error?.message || error));
    }

    const draftSaved = await scoring.saveSpeakingReview(review.id, {
      criteriaScores: [
        { code: 'FLUENCY', score: 3 },
        { code: 'VOCABULARY', score: 4 },
      ],
      strengths: 'Good confidence',
      areasForImprovement: 'Need more range',
      reviewNotes: 'Draft speaking notes',
      suggestedLevel: 'A2',
    }, result.tenant.id, { authUserId: tempUser.id });

    await strapi.db.query('api::assessment-speaking-criterion.assessment-speaking-criterion').update({ where: { id: criterion1.id }, data: { label: 'Fluency Updated' } });
    const snapshotStable = Array.isArray(draftSaved.criteriaSnapshot) && draftSaved.criteriaSnapshot[0]?.label === 'Fluency';

    const completed = await scoring.completeSpeakingReview(review.id, {
      criteriaScores: [
        { code: 'FLUENCY', score: 3 },
        { code: 'VOCABULARY', score: 4 },
      ],
      strengths: 'Good confidence',
      areasForImprovement: 'Need more range',
      reviewNotes: 'Completed speaking notes',
      suggestedLevel: 'A2',
    }, result.tenant.id, { authUserId: tempUser.id });

    let candidateRangeGuard = false;
    try {
      await scoring.confirmAssessmentPlacement(result.id, { confirmedLevel: 'B2', confirmationNote: 'range check' }, result.tenant.id, { authUserId: tempUser.id });
    } catch (error) {
      candidateRangeGuard = /candidateLevelTo|candidateLevelFrom/i.test(String(error?.message || error));
    }

    let ceilingGuard = false;
    try {
      await scoring.confirmAssessmentPlacement(result.id, { confirmedLevel: 'C1', confirmationNote: 'ceiling check' }, result.tenant.id, { authUserId: tempUser.id });
    } catch (error) {
      ceilingGuard = /ceilingLevel/i.test(String(error?.message || error));
    }

    const confirmed = await scoring.confirmAssessmentPlacement(result.id, { confirmedLevel: 'A2', confirmedLabel: 'A2 Confirmed', confirmationNote: 'Teacher confirmed A2' }, result.tenant.id, { authUserId: tempUser.id });
    cleanup.push(async () => strapi.db.query('api::assessment-placement-confirmation.assessment-placement-confirmation').delete({ where: { id: Number(confirmed.id) } }).catch(() => {}));

    const reconfirmed = await scoring.confirmAssessmentPlacement(result.id, { confirmedLevel: 'A1', confirmedLabel: 'A1 Confirmed', confirmationNote: 'Teacher re-confirmed A1' }, result.tenant.id, { authUserId: tempUser.id });
    cleanup.push(async () => strapi.db.query('api::assessment-placement-confirmation.assessment-placement-confirmation').delete({ where: { id: Number(reconfirmed.id) } }).catch(() => {}));

    const confirmationHistory = await scoring.getPlacementConfirmationForResult(result.id, result.tenant.id);
    const currentResult = await scoring.getAssessmentResultDetail(result.id, result.tenant.id);

    let crossTenantProtected = false;
    try {
      await scoring.getAssessmentResultDetail(result.id, Number(result.tenant.id) + 999999);
    } catch (error) {
      crossTenantProtected = /not found/i.test(String(error?.message || error));
    }

    console.log(JSON.stringify({
      createSpeakingReview: Boolean(review?.id),
      startSpeakingReview: started?.status === 'in_review',
      saveSpeakingDraft: draftSaved?.status === 'in_review',
      invalidCriterionRejected,
      completeSpeaking: completed?.status === 'completed',
      confirmBlockedBeforeSpeaking,
      confirmPlacement: confirmed?.status === 'confirmed',
      provisionalPreserved: currentResult?.result?.provisionalLevel === 'A1',
      candidateRangeGuard,
      ceilingGuard,
      confirmationHistory: Array.isArray(confirmationHistory?.history) && confirmationHistory.history.some((item) => item.status === 'superseded') && confirmationHistory.history.some((item) => item.status === 'confirmed'),
      criteriaSnapshotStability: snapshotStable,
      crossTenantProtected,
    }, null, 2));
  } finally {
    for (const job of cleanup.reverse()) {
      await job();
    }
  }
})().catch((error) => { console.error(error); process.exit(1); });
