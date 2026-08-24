const ASSESSMENT_RUNTIME_POLICY = {
  name: 'global::has-tenant-permission',
  config: { key: 'learning.assessment.manage' },
};

export default {
  routes: [
    { method: 'GET', path: '/assessment-runtime/assessment-attempts', handler: 'assessment-runtime.listAssessmentAttempts', config: { auth: false, policies: [ASSESSMENT_RUNTIME_POLICY] } },
    { method: 'POST', path: '/assessment-runtime/assessment-versions/:versionId/attempts/start', handler: 'assessment-runtime.startAssessmentAttempt', config: { auth: false, policies: [ASSESSMENT_RUNTIME_POLICY] } },
    { method: 'GET', path: '/assessment-runtime/assessment-attempts/:id', handler: 'assessment-runtime.getAssessmentAttempt', config: { auth: false } },
    { method: 'GET', path: '/assessment-runtime/assessment-attempts/:id/result', handler: 'assessment-runtime.getCandidateAssessmentResult', config: { auth: false } },
    { method: 'POST', path: '/assessment-runtime/assessment-attempts/:id/resume', handler: 'assessment-runtime.resumeAssessmentAttempt', config: { auth: false } },
    { method: 'PUT', path: '/assessment-runtime/assessment-attempts/:id/answers/:assessmentQuestionId', handler: 'assessment-runtime.saveAssessmentAnswer', config: { auth: false } },
    { method: 'POST', path: '/assessment-runtime/assessment-attempts/:id/questions/:assessmentQuestionId/audio-play', handler: 'assessment-runtime.registerAssessmentAudioPlay', config: { auth: false } },
    { method: 'PUT', path: '/assessment-runtime/assessment-attempts/:id/progress', handler: 'assessment-runtime.updateAssessmentProgress', config: { auth: false } },
    { method: 'POST', path: '/assessment-runtime/assessment-attempts/:id/submit', handler: 'assessment-runtime.submitAssessmentAttempt', config: { auth: false } },
  ],
};