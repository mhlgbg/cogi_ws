import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data
  return payload
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function getAssessments(params = {}) {
  const res = await api.get('/assessment-management/assessments', { params })
  return unwrapSuccess(res.data)
}

export async function getAssessment(id) {
  const res = await api.get(`/assessment-management/assessments/${id}`)
  return unwrapSuccess(res.data)
}

export async function createAssessment(data) {
  const res = await api.post('/assessment-management/assessments', data)
  return unwrapSuccess(res.data)
}

export async function updateAssessment(id, data) {
  const res = await api.put(`/assessment-management/assessments/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function archiveAssessment(id) {
  const res = await api.post(`/assessment-management/assessments/${id}/archive`)
  return unwrapSuccess(res.data)
}

export async function deleteAssessment(id) {
  const res = await api.delete(`/assessment-management/assessments/${id}`)
  return unwrapSuccess(res.data)
}

export async function getAssessmentVersions(params = {}) {
  const res = await api.get('/assessment-management/assessment-versions', { params })
  return unwrapSuccess(res.data)
}

export async function getAssessmentVersion(id) {
  const res = await api.get(`/assessment-management/assessment-versions/${id}`)
  return unwrapSuccess(res.data)
}

export async function validateAssessmentVersion(id) {
  const res = await api.get(`/assessment-management/assessment-versions/${id}/validate`)
  return unwrapSuccess(res.data)
}

export async function createAssessmentVersion(data) {
  const res = await api.post('/assessment-management/assessment-versions', data)
  return unwrapSuccess(res.data)
}

export async function updateAssessmentVersion(id, data) {
  const res = await api.put(`/assessment-management/assessment-versions/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function publishAssessmentVersion(id) {
  const res = await api.post(`/assessment-management/assessment-versions/${id}/publish`)
  return unwrapSuccess(res.data)
}

export async function retireAssessmentVersion(id) {
  const res = await api.post(`/assessment-management/assessment-versions/${id}/retire`)
  return unwrapSuccess(res.data)
}

export async function cloneAssessmentVersion(id, data) {
  const res = await api.post(`/assessment-management/assessment-versions/${id}/clone`, data)
  return unwrapSuccess(res.data)
}

export async function deleteAssessmentVersion(id) {
  const res = await api.delete(`/assessment-management/assessment-versions/${id}`)
  return unwrapSuccess(res.data)
}

export async function createAssessmentSection(versionId, data) {
  const res = await api.post(`/assessment-management/assessment-versions/${versionId}/sections`, data)
  return unwrapSuccess(res.data)
}

export async function updateAssessmentSection(id, data) {
  const res = await api.put(`/assessment-management/assessment-sections/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteAssessmentSection(id) {
  const res = await api.delete(`/assessment-management/assessment-sections/${id}`)
  return unwrapSuccess(res.data)
}

export async function reorderAssessmentSections(versionId, items) {
  const res = await api.post(`/assessment-management/assessment-versions/${versionId}/sections/reorder`, { items })
  return unwrapSuccess(res.data)
}

export async function addAssessmentQuestion(sectionId, data) {
  const res = await api.post(`/assessment-management/assessment-sections/${sectionId}/questions`, data)
  return unwrapSuccess(res.data)
}

export async function updateAssessmentQuestion(id, data) {
  const res = await api.put(`/assessment-management/assessment-questions/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function removeAssessmentQuestion(id) {
  const res = await api.delete(`/assessment-management/assessment-questions/${id}`)
  return unwrapSuccess(res.data)
}

export async function reorderAssessmentQuestions(sectionId, items) {
  const res = await api.post(`/assessment-management/assessment-sections/${sectionId}/questions/reorder`, { items })
  return unwrapSuccess(res.data)
}

export async function getAssessmentResults(params = {}) {
  const res = await api.get('/assessment-scoring/assessment-results', { params })
  return unwrapSuccess(res.data)
}

export async function getAssessmentResultDetail(id) {
  const res = await api.get(`/assessment-scoring/assessment-results/${id}`)
  return unwrapSuccess(res.data)
}

export async function getAssessmentResultCandidatePreview(id) {
  const res = await api.get(`/assessment-scoring/assessment-results/${id}/candidate-preview`)
  return unwrapSuccess(res.data)
}

export async function setManualAnswerScore(id, data) {
  const res = await api.post(`/assessment-scoring/assessment-answer-scores/${id}/manual-score`, data)
  return unwrapSuccess(res.data)
}

export async function recalculateAssessmentResult(id) {
  const res = await api.post(`/assessment-scoring/assessment-results/${id}/recalculate`)
  return unwrapSuccess(res.data)
}

export async function rescoreAssessmentAttempt(attemptId, data = {}) {
  const res = await api.post(`/assessment-scoring/assessment-attempts/${attemptId}/rescore`, data)
  return unwrapSuccess(res.data)
}

export async function getAssessmentPlacementRules(params = {}) {
  const res = await api.get('/assessment-scoring/assessment-placement-rules', { params })
  return unwrapSuccess(res.data)
}

export async function createAssessmentPlacementRule(data) {
  const res = await api.post('/assessment-scoring/assessment-placement-rules', data)
  return unwrapSuccess(res.data)
}

export async function updateAssessmentPlacementRule(id, data) {
  const res = await api.put(`/assessment-scoring/assessment-placement-rules/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteAssessmentPlacementRule(id) {
  const res = await api.delete(`/assessment-scoring/assessment-placement-rules/${id}`)
  return unwrapSuccess(res.data)
}

export async function getAssessmentSpeakingCriteria(versionId, params = {}) {
  const res = await api.get(`/assessment-management/assessment-versions/${versionId}/speaking-criteria`, { params })
  return unwrapSuccess(res.data)
}

export async function createAssessmentSpeakingCriterion(versionId, data) {
  const res = await api.post(`/assessment-management/assessment-versions/${versionId}/speaking-criteria`, data)
  return unwrapSuccess(res.data)
}

export async function updateAssessmentSpeakingCriterion(id, data) {
  const res = await api.put(`/assessment-management/assessment-speaking-criteria/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteAssessmentSpeakingCriterion(id) {
  const res = await api.delete(`/assessment-management/assessment-speaking-criteria/${id}`)
  return unwrapSuccess(res.data)
}

export async function getSpeakingReviewForResult(resultId) {
  const res = await api.get(`/assessment-scoring/assessment-results/${resultId}/speaking-review`)
  return unwrapSuccess(res.data)
}

export async function createSpeakingReviewForResult(resultId) {
  const res = await api.post(`/assessment-scoring/assessment-results/${resultId}/speaking-review`)
  return unwrapSuccess(res.data)
}

export async function startSpeakingReview(id) {
  const res = await api.post(`/assessment-scoring/assessment-speaking-reviews/${id}/start`)
  return unwrapSuccess(res.data)
}

export async function saveSpeakingReview(id, data) {
  const res = await api.put(`/assessment-scoring/assessment-speaking-reviews/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function completeSpeakingReview(id, data) {
  const res = await api.post(`/assessment-scoring/assessment-speaking-reviews/${id}/complete`, data)
  return unwrapSuccess(res.data)
}

export async function getPlacementConfirmationForResult(resultId) {
  const res = await api.get(`/assessment-scoring/assessment-results/${resultId}/placement-confirmation`)
  return unwrapSuccess(res.data)
}

export async function confirmAssessmentPlacement(resultId, data) {
  const res = await api.post(`/assessment-scoring/assessment-results/${resultId}/placement-confirmation`, data)
  return unwrapSuccess(res.data)
}
