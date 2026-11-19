import api from '../../../api/axios'

function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload && typeof payload === 'object' && 'results' in payload ? payload.results : (payload?.data ?? payload)
}

export async function listExamCampaigns(params = {}) {
  const response = await api.get('/exam-campaigns', { params })
  return unwrap(response.data)
}

export async function getExamCampaign(id) {
  const response = await api.get(`/exam-campaigns/${id}`)
  return unwrap(response.data)
}

export async function createExamCampaign(payload) {
  const response = await api.post('/exam-campaigns', { data: payload })
  return unwrap(response.data)
}

export async function updateExamCampaign(id, payload) {
  const response = await api.put(`/exam-campaigns/${id}`, { data: payload })
  return unwrap(response.data)
}

export async function listExamSlots(params = {}) {
  const response = await api.get('/exam-slots', { params })
  return unwrap(response.data)
}

export async function getExamSlot(id) {
  const response = await api.get(`/exam-slots/${id}`)
  return unwrap(response.data)
}

export async function createExamSlot(payload) {
  const response = await api.post('/exam-slots', { data: payload })
  return unwrap(response.data)
}

export async function updateExamSlot(id, payload) {
  const response = await api.put(`/exam-slots/${id}`, { data: payload })
  return unwrap(response.data)
}

export async function listAssessmentSessions(params = {}) {
  const response = await api.get('/assessment-sessions', { params })
  return unwrap(response.data)
}

export async function createAssessmentSession(payload) {
  const response = await api.post('/assessment-sessions', { data: payload })
  return unwrap(response.data)
}

export async function updateAssessmentSession(id, payload) {
  const response = await api.put(`/assessment-sessions/${id}`, { data: payload })
  return unwrap(response.data)
}

export async function cloneAssessmentSession(id, payload = {}) {
  const response = await api.post(`/assessment-sessions/${id}/clone`, { data: payload })
  return unwrap(response.data)
}

export async function listSessionExamForms(sessionId) {
  const response = await api.get(`/assessment-sessions/${sessionId}/exam-forms`)
  return unwrap(response.data)
}

export async function createSessionExamForm(sessionId, payload = {}) {
  const response = await api.post('/session-exam-forms', {
    data: {
      assessmentSession: sessionId,
      ...payload,
    },
  })
  return unwrap(response.data)
}

export async function deleteSessionExamForm(formId) {
  const response = await api.delete(`/session-exam-forms/${formId}`)
  return unwrap(response.data)
}

export async function checkSessionExamForms(sessionId) {
  const response = await api.post(`/assessment-sessions/${sessionId}/check-exam-forms`)
  return unwrap(response.data)
}

export async function finalizeSessionExamForms(sessionId) {
  const response = await api.post(`/assessment-sessions/${sessionId}/finalize-exam-forms`)
  return unwrap(response.data)
}

export async function previewApplySessionExamForms(sessionId, payload) {
  const response = await api.post(`/assessment-sessions/${sessionId}/exam-forms/apply/preview`, { data: payload })
  return unwrap(response.data)
}

export async function confirmApplySessionExamForms(sessionId, payload) {
  const response = await api.post(`/assessment-sessions/${sessionId}/exam-forms/apply/confirm`, { data: payload })
  return unwrap(response.data)
}

export async function markAssessmentSessionReady(id) {
  const response = await api.post(`/assessment-sessions/${id}/mark-ready`)
  return unwrap(response.data)
}

export async function getAssessmentSession(id) {
  const response = await api.get(`/assessment-sessions/${id}`)
  return unwrap(response.data)
}

export async function listSessionCandidates(sessionId, params = {}) {
  const response = await api.get(`/assessment-sessions/${sessionId}/candidates`, { params })
  return response?.data || {}
}

export async function downloadSessionCandidateTemplate(sessionId) {
  const path = sessionId
    ? `/assessment-sessions/${sessionId}/candidates/template`
    : '/assessment-sessions/candidates/template'
  const response = await api.get(path, {
    responseType: 'blob',
  })
  const headerValue = String(response.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)
  return {
    blob: response.data,
    fileName: matchedName?.[1] || 'assessment-session-candidates-template.xlsx',
  }
}

export async function previewSessionCandidateImport(sessionId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const path = sessionId
    ? `/assessment-sessions/${sessionId}/candidates/import/preview`
    : '/assessment-sessions/candidates/import/preview'
  const response = await api.post(path, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return unwrap(response.data)
}

export async function confirmSessionCandidateImport(sessionId, payload) {
  const path = sessionId
    ? `/assessment-sessions/${sessionId}/candidates/import/confirm`
    : '/assessment-sessions/candidates/import/confirm'
  const response = await api.post(path, { data: payload })
  return unwrap(response.data)
}

export async function lookupSessionCandidateLearner(sessionId, studentCode) {
  const response = await api.get(`/assessment-sessions/${sessionId}/candidates/lookup-learner`, {
    params: { studentCode },
  })
  return unwrap(response.data)
}

export async function addSessionCandidateManual(sessionId, payload) {
  const response = await api.post(`/assessment-sessions/${sessionId}/candidates`, { data: payload })
  return unwrap(response.data)
}

export async function removeSessionCandidate(sessionId, candidateId) {
  const response = await api.delete(`/assessment-sessions/${sessionId}/candidates/${candidateId}`)
  return unwrap(response.data)
}
