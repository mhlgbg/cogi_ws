const ASSESSMENT_SCORING_POLICY = {
  name: 'global::has-tenant-permission',
  config: { key: 'learning.assessment.manage' },
};

export default {
  routes: [
    { method: 'GET', path: '/assessment-scoring/assessment-results', handler: 'assessment-scoring.listAssessmentResults', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'GET', path: '/assessment-scoring/assessment-results/:id', handler: 'assessment-scoring.getAssessmentResultDetail', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'GET', path: '/assessment-scoring/assessment-results/:id/candidate-preview', handler: 'assessment-scoring.getCandidatePreviewForAssessmentResult', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'GET', path: '/assessment-scoring/assessment-results/:id/speaking-review', handler: 'assessment-scoring.getSpeakingReviewForResult', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'POST', path: '/assessment-scoring/assessment-results/:id/speaking-review', handler: 'assessment-scoring.createSpeakingReviewForResult', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'GET', path: '/assessment-scoring/assessment-results/:id/placement-confirmation', handler: 'assessment-scoring.getPlacementConfirmationForResult', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'POST', path: '/assessment-scoring/assessment-results/:id/placement-confirmation', handler: 'assessment-scoring.confirmAssessmentPlacement', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'GET', path: '/assessment-scoring/assessment-attempts/:attemptId/result', handler: 'assessment-scoring.getAssessmentResult', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'POST', path: '/assessment-scoring/assessment-attempts/:attemptId/score', handler: 'assessment-scoring.scoreAssessmentAttempt', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'POST', path: '/assessment-scoring/assessment-answer-scores/:id/manual-score', handler: 'assessment-scoring.setManualAnswerScore', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'POST', path: '/assessment-scoring/assessment-speaking-reviews/:id/start', handler: 'assessment-scoring.startSpeakingReview', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'PUT', path: '/assessment-scoring/assessment-speaking-reviews/:id', handler: 'assessment-scoring.saveSpeakingReview', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'POST', path: '/assessment-scoring/assessment-speaking-reviews/:id/complete', handler: 'assessment-scoring.completeSpeakingReview', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'POST', path: '/assessment-scoring/assessment-attempts/:attemptId/rescore', handler: 'assessment-scoring.rescoreAssessmentAttempt', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'POST', path: '/assessment-scoring/assessment-results/:id/recalculate', handler: 'assessment-scoring.recalculateAssessmentResult', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'GET', path: '/assessment-scoring/assessment-placement-rules', handler: 'assessment-scoring.listAssessmentPlacementRules', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'POST', path: '/assessment-scoring/assessment-placement-rules', handler: 'assessment-scoring.createAssessmentPlacementRule', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'PUT', path: '/assessment-scoring/assessment-placement-rules/:id', handler: 'assessment-scoring.updateAssessmentPlacementRule', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
    { method: 'DELETE', path: '/assessment-scoring/assessment-placement-rules/:id', handler: 'assessment-scoring.deleteAssessmentPlacementRule', config: { auth: false, policies: [ASSESSMENT_SCORING_POLICY] } },
  ],
};