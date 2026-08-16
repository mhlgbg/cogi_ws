import api from '../../../api/axios'
import {
  normalizeCreateLearnerExamRegistrationResult,
  normalizeCurrentLearner,
  getCurrentLearnerApiMessage,
  normalizeLearnerExamRegistrationDetail,
  normalizeLearnerRegistrationOptions,
  normalizeLearnerProfileContext,
  normalizeLearnerExamRoundCollection,
  normalizeLearnerExamRoundDetail,
  normalizeLearnerSupport,
  normalizePagination,
} from '../utils/learnerExamUi'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data
  }
  return payload?.data !== undefined ? payload.data : payload
}

function buildListParams({ page = 1, pageSize = 12, search = '' } = {}) {
  const params = { page, pageSize }
  if (String(search || '').trim()) params.search = String(search || '').trim()
  return params
}

export async function getCurrentLearner() {
  const response = await api.get('/learner/me')
  const data = unwrapSuccess(response.data)
  return {
    user: data?.user || null,
    learner: normalizeCurrentLearner(data?.learner),
    learnerState: data?.learnerState || 'missing',
    support: normalizeLearnerSupport(data?.support),
  }
}

export async function listLearnerExamRounds(params = {}) {
  const response = await api.get('/learner/exam-rounds', { params: buildListParams(params) })
  return {
    rows: normalizeLearnerExamRoundCollection(response.data),
    pagination: normalizePagination(response.data),
    user: response.data?.user || null,
    learner: normalizeCurrentLearner(response.data?.learner),
    learnerState: response.data?.learnerState || 'missing',
    support: normalizeLearnerSupport(response.data?.support),
    serverNow: response.data?.meta?.serverNow || null,
  }
}

export async function getLearnerExamRound(id) {
  const response = await api.get(`/learner/exam-rounds/${id}`)
  return normalizeLearnerExamRoundDetail(unwrapSuccess(response.data))
}

export async function getLearnerProfileContext(examRoundId) {
  const response = await api.get(`/learner/exam-rounds/${examRoundId}/learner-profile-context`)
  return normalizeLearnerProfileContext(unwrapSuccess(response.data))
}

export async function createLearnerProfileForExamRound(examRoundId, payload) {
  const response = await api.post(`/learner/exam-rounds/${examRoundId}/create-profile`, payload)
  return unwrapSuccess(response.data)
}

export async function getLearnerRegistrationOptions(examRoundId) {
  const response = await api.get(`/learner/exam-rounds/${examRoundId}/registration-options`)
  return normalizeLearnerRegistrationOptions(unwrapSuccess(response.data))
}

export async function createLearnerExamRegistration(examRoundId, payload) {
  const response = await api.post(`/learner/exam-rounds/${examRoundId}/register`, payload)
  return normalizeCreateLearnerExamRegistrationResult(unwrapSuccess(response.data))
}

export async function getLearnerExamRegistration(id) {
  const response = await api.get(`/learner/exam-registrations/${id}`)
  return normalizeLearnerExamRegistrationDetail(unwrapSuccess(response.data))
}

export async function uploadExamRegistrationPaymentEvidence(registrationId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post(`/learner/exam-registrations/${registrationId}/payment-evidence`, formData)
  return unwrapSuccess(response.data)
}

export async function reportExamRegistrationPayment(registrationId, payload) {
  const response = await api.post(`/learner/exam-registrations/${registrationId}/report-payment`, payload)
  return unwrapSuccess(response.data)
}

export { getCurrentLearnerApiMessage as normalizeCurrentLearnerApiMessage }