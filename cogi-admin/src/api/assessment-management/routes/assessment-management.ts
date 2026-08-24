const ASSESSMENT_MANAGE_POLICY = {
  name: 'global::has-tenant-permission',
  config: { key: 'learning.assessment.manage' },
};

export default {
  routes: [
    { method: 'GET', path: '/assessment-management/assessments', handler: 'assessment-management.listAssessments', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'GET', path: '/assessment-management/assessments/:id', handler: 'assessment-management.getAssessment', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'POST', path: '/assessment-management/assessments', handler: 'assessment-management.createAssessment', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'PUT', path: '/assessment-management/assessments/:id', handler: 'assessment-management.updateAssessment', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'POST', path: '/assessment-management/assessments/:id/archive', handler: 'assessment-management.archiveAssessment', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'DELETE', path: '/assessment-management/assessments/:id', handler: 'assessment-management.deleteAssessment', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },

    { method: 'GET', path: '/assessment-management/assessment-versions', handler: 'assessment-management.listAssessmentVersions', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'GET', path: '/assessment-management/assessment-versions/:id', handler: 'assessment-management.getAssessmentVersion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'GET', path: '/assessment-management/assessment-versions/:id/validate', handler: 'assessment-management.validateAssessmentVersion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'GET', path: '/assessment-management/assessment-versions/:versionId/speaking-criteria', handler: 'assessment-management.listAssessmentSpeakingCriteria', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'POST', path: '/assessment-management/assessment-versions/:versionId/speaking-criteria', handler: 'assessment-management.createAssessmentSpeakingCriterion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'POST', path: '/assessment-management/assessment-versions', handler: 'assessment-management.createAssessmentVersion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'PUT', path: '/assessment-management/assessment-versions/:id', handler: 'assessment-management.updateAssessmentVersion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'POST', path: '/assessment-management/assessment-versions/:id/publish', handler: 'assessment-management.publishAssessmentVersion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'POST', path: '/assessment-management/assessment-versions/:id/retire', handler: 'assessment-management.retireAssessmentVersion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'POST', path: '/assessment-management/assessment-versions/:id/clone', handler: 'assessment-management.cloneAssessmentVersion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'DELETE', path: '/assessment-management/assessment-versions/:id', handler: 'assessment-management.deleteAssessmentVersion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'PUT', path: '/assessment-management/assessment-speaking-criteria/:id', handler: 'assessment-management.updateAssessmentSpeakingCriterion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'DELETE', path: '/assessment-management/assessment-speaking-criteria/:id', handler: 'assessment-management.deleteAssessmentSpeakingCriterion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },

    { method: 'POST', path: '/assessment-management/assessment-versions/:versionId/sections', handler: 'assessment-management.createAssessmentSection', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'PUT', path: '/assessment-management/assessment-sections/:id', handler: 'assessment-management.updateAssessmentSection', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'DELETE', path: '/assessment-management/assessment-sections/:id', handler: 'assessment-management.deleteAssessmentSection', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'POST', path: '/assessment-management/assessment-versions/:versionId/sections/reorder', handler: 'assessment-management.reorderAssessmentSections', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },

    { method: 'POST', path: '/assessment-management/assessment-sections/:sectionId/questions', handler: 'assessment-management.addAssessmentQuestion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'PUT', path: '/assessment-management/assessment-questions/:id', handler: 'assessment-management.updateAssessmentQuestion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'DELETE', path: '/assessment-management/assessment-questions/:id', handler: 'assessment-management.removeAssessmentQuestion', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
    { method: 'POST', path: '/assessment-management/assessment-sections/:sectionId/questions/reorder', handler: 'assessment-management.reorderAssessmentQuestions', config: { auth: false, policies: [ASSESSMENT_MANAGE_POLICY] } },
  ],
};
