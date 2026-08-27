import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data
  return payload
}

export function getRuntimeApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export function getRuntimeApiDetails(error) {
  return error?.response?.data?.error?.details || error?.response?.data?.details || null
}

function buildRequestConfig(options = {}) {
  const nextOptions = options && typeof options === 'object' ? options : {}
  const tenantCode = String(nextOptions?.tenantCode || '').trim()
  const publicAccessToken = String(nextOptions?.publicAccessToken || '').trim()
  const headers = {
    ...(nextOptions?.headers || {}),
  }
  if (tenantCode && !headers['x-tenant-code']) headers['x-tenant-code'] = tenantCode
  if (publicAccessToken && !headers['x-assessment-public-token']) headers['x-assessment-public-token'] = publicAccessToken
  return Object.keys(headers).length > 0 ? { ...nextOptions, headers } : nextOptions
}

export async function startAssessmentAttempt(versionId, data = {}) {
  const res = await api.post(`/assessment-runtime/assessment-versions/${versionId}/attempts/start`, data)
  return unwrapSuccess(res.data)
}

export async function getAssessmentAttempt(attemptId, options = {}) {
  const res = await api.get(`/assessment-runtime/assessment-attempts/${attemptId}`, buildRequestConfig(options))
  return unwrapSuccess(res.data)
}

export async function getAssessmentAttemptResult(attemptId, options = {}) {
  const res = await api.get(`/assessment-runtime/assessment-attempts/${attemptId}/result`, buildRequestConfig(options))
  return unwrapSuccess(res.data)
}

export async function resumeAssessmentAttempt(attemptId, options = {}) {
  const res = await api.post(`/assessment-runtime/assessment-attempts/${attemptId}/resume`, {}, buildRequestConfig(options))
  return unwrapSuccess(res.data)
}

export async function saveAssessmentAnswer(attemptId, assessmentQuestionId, data = {}, options = {}) {
  const res = await api.put(`/assessment-runtime/assessment-attempts/${attemptId}/answers/${assessmentQuestionId}`, data, buildRequestConfig(options))
  return unwrapSuccess(res.data)
}

export async function registerAssessmentAudioPlay(attemptId, assessmentQuestionId, data = {}, options = {}) {
  const res = await api.post(`/assessment-runtime/assessment-attempts/${attemptId}/questions/${assessmentQuestionId}/audio-play`, data, buildRequestConfig(options))
  return unwrapSuccess(res.data)
}

export async function markAudioListenRequirementSatisfied(attemptId, assessmentQuestionId, data = {}, options = {}) {
  const res = await api.post(`/assessment-runtime/assessment-attempts/${attemptId}/questions/${assessmentQuestionId}/audio-listen-satisfied`, data, buildRequestConfig(options))
  return unwrapSuccess(res.data)
}

export async function updateAssessmentProgress(attemptId, data = {}, options = {}) {
  const res = await api.put(`/assessment-runtime/assessment-attempts/${attemptId}/progress`, data, buildRequestConfig(options))
  return unwrapSuccess(res.data)
}

export async function submitAssessmentAttempt(attemptId, options = {}) {
  const res = await api.post(`/assessment-runtime/assessment-attempts/${attemptId}/submit`, {}, buildRequestConfig(options))
  return unwrapSuccess(res.data)
}