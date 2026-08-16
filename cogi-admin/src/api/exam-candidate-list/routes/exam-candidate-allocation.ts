const EXAM_CANDIDATE_MANAGE_POLICY = { name: 'global::has-tenant-permission', config: { keys: ['exam-candidate.manage', 'exam-round.manage'] } };
const EXAM_CANDIDATE_READ_POLICY = { name: 'global::has-tenant-permission', config: { keys: ['exam-candidate.manage', 'exam-round.manage', 'exam-round.approve'] } };
const EXAM_CANDIDATE_APPROVE_POLICY = { name: 'global::has-tenant-permission', config: { keys: ['exam-candidate.approve', 'exam-round.approve'] } };

export default {
  routes: [
    { method: 'GET', path: '/exam-rounds/:id/allocation/unassigned', handler: 'exam-candidate-allocation.unassigned', config: { auth: false, policies: [EXAM_CANDIDATE_READ_POLICY] } },
    { method: 'GET', path: '/exam-rounds/:id/allocation/capacity', handler: 'exam-candidate-allocation.capacity', config: { auth: false, policies: [EXAM_CANDIDATE_READ_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/allocation/preview', handler: 'exam-candidate-allocation.preview', config: { auth: false, policies: [EXAM_CANDIDATE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/allocation/auto-assign', handler: 'exam-candidate-allocation.autoAssign', config: { auth: false, policies: [EXAM_CANDIDATE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/allocation/assign', handler: 'exam-candidate-allocation.assign', config: { auth: false, policies: [EXAM_CANDIDATE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/allocation/reassign', handler: 'exam-candidate-allocation.reassign', config: { auth: false, policies: [EXAM_CANDIDATE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/allocation/unassign', handler: 'exam-candidate-allocation.unassign', config: { auth: false, policies: [EXAM_CANDIDATE_MANAGE_POLICY] } },
    { method: 'GET', path: '/exam-rounds/:id/candidate-lists', handler: 'exam-candidate-allocation.listCandidateLists', config: { auth: false, policies: [EXAM_CANDIDATE_READ_POLICY] } },
    { method: 'GET', path: '/exam-rounds/:id/candidate-lists/:candidateListId', handler: 'exam-candidate-allocation.detailCandidateList', config: { auth: false, policies: [EXAM_CANDIDATE_READ_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/candidate-lists/:candidateListId/generate-sequence', handler: 'exam-candidate-allocation.generateSequence', config: { auth: false, policies: [EXAM_CANDIDATE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/candidate-lists/:candidateListId/finalize', handler: 'exam-candidate-allocation.finalize', config: { auth: false, policies: [EXAM_CANDIDATE_APPROVE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/candidate-lists/:candidateListId/reopen', handler: 'exam-candidate-allocation.reopen', config: { auth: false, policies: [EXAM_CANDIDATE_APPROVE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/candidate-lists/:candidateListId/submit-for-approval', handler: 'exam-candidate-allocation.submitForApproval', config: { auth: false, policies: [EXAM_CANDIDATE_MANAGE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/candidate-lists/:candidateListId/approve', handler: 'exam-candidate-allocation.approve', config: { auth: false, policies: [EXAM_CANDIDATE_APPROVE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/candidate-lists/:candidateListId/return-to-draft', handler: 'exam-candidate-allocation.returnToDraft', config: { auth: false, policies: [EXAM_CANDIDATE_APPROVE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/candidate-lists/:candidateListId/lock', handler: 'exam-candidate-allocation.lock', config: { auth: false, policies: [EXAM_CANDIDATE_APPROVE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/candidate-lists/:candidateListId/unlock', handler: 'exam-candidate-allocation.unlock', config: { auth: false, policies: [EXAM_CANDIDATE_APPROVE_POLICY] } },
    { method: 'POST', path: '/exam-rounds/:id/candidate-lists/:candidateListId/generate-numbers', handler: 'exam-candidate-allocation.generateNumbers', config: { auth: false, policies: [EXAM_CANDIDATE_MANAGE_POLICY] } },
  ],
};