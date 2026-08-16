import api from '../../../api/axios'
import {
  normalizeCollectionData,
  normalizeExamProgramCollection,
  normalizeExamRound,
  normalizePagination,
} from '../utils/examRoundUi'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data
  }
  return payload?.data !== undefined ? payload.data : payload
}

function buildExamRoundListParams({ page = 1, pageSize = 10, search = '', status = '', examProgramId = '', registrationMode = '', registrationStartFrom = '', registrationStartTo = '' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'updatedAt:desc',
    'sort[1]': 'id:desc',
    'populate[examProgram][fields][0]': 'code',
    'populate[examProgram][fields][1]': 'name',
  }

  const keyword = String(search || '').trim()
  if (keyword) {
    params['filters[$or][0][code][$containsi]'] = keyword
    params['filters[$or][1][name][$containsi]'] = keyword
  }

  if (status) params['filters[status][$eq]'] = status
  if (examProgramId) params['filters[examProgram][id][$eq]'] = examProgramId
  if (registrationMode) params['filters[registrationMode][$eq]'] = registrationMode
  if (registrationStartFrom) params['filters[registrationStartAt][$gte]'] = registrationStartFrom
  if (registrationStartTo) params['filters[registrationStartAt][$lte]'] = registrationStartTo

  return params
}

function buildExamRoundDetailParams() {
  return {
    'populate[examProgram][fields][0]': 'code',
    'populate[examProgram][fields][1]': 'name',
    'populate[submittedBy][fields][0]': 'username',
    'populate[submittedBy][fields][1]': 'fullName',
    'populate[submittedBy][fields][2]': 'email',
    'populate[approvedBy][fields][0]': 'username',
    'populate[approvedBy][fields][1]': 'fullName',
    'populate[approvedBy][fields][2]': 'email',
    'populate[returnedBy][fields][0]': 'username',
    'populate[returnedBy][fields][1]': 'fullName',
    'populate[returnedBy][fields][2]': 'email',
    'populate[registrationOpenedBy][fields][0]': 'username',
    'populate[registrationOpenedBy][fields][1]': 'fullName',
    'populate[registrationOpenedBy][fields][2]': 'email',
    'populate[registrationPausedBy][fields][0]': 'username',
    'populate[registrationPausedBy][fields][1]': 'fullName',
    'populate[registrationPausedBy][fields][2]': 'email',
    'populate[registrationResumedBy][fields][0]': 'username',
    'populate[registrationResumedBy][fields][1]': 'fullName',
    'populate[registrationResumedBy][fields][2]': 'email',
    'populate[registrationClosedBy][fields][0]': 'username',
    'populate[registrationClosedBy][fields][1]': 'fullName',
    'populate[registrationClosedBy][fields][2]': 'email',
    'populate[examRoundSubjects][fields][0]': 'status',
    'populate[examRoundComponents][fields][0]': 'status',
  }
}

function buildExamProgramLookupParams(search = '') {
  const params = {
    page: 1,
    pageSize: 200,
    isActive: 'true',
    'sort[0]': 'name:asc',
    'sort[1]': 'code:asc',
  }

  const keyword = String(search || '').trim()
  if (keyword) {
    params['filters[$or][0][code][$containsi]'] = keyword
    params['filters[$or][1][name][$containsi]'] = keyword
  }

  return params
}

export async function getExamRounds(params = {}) {
  const response = await api.get('/exam-rounds', { params: buildExamRoundListParams(params) })
  return {
    rows: normalizeCollectionData(response.data),
    pagination: normalizePagination(response.data),
  }
}

export async function getExamRound(id) {
  const response = await api.get(`/exam-rounds/${id}`, { params: buildExamRoundDetailParams() })
  return normalizeExamRound(unwrapSuccess(response.data))
}

export async function getExamProgramsLookup(search = '') {
  const response = await api.get('/exam-round-configuration-programs', { params: buildExamProgramLookupParams(search) })
  return normalizeExamProgramCollection(response.data)
}

export async function createExamRound(payload) {
  const response = await api.post('/exam-rounds/create-from-program', payload)
  return unwrapSuccess(response.data)
}

export async function submitExamRoundForApproval(id, payload = {}) {
  const response = await api.post(`/exam-rounds/${id}/submit-for-approval`, payload)
  return unwrapSuccess(response.data)
}

export async function approveExamRound(id, payload = {}) {
  const response = await api.post(`/exam-rounds/${id}/approve`, payload)
  return unwrapSuccess(response.data)
}

export async function returnExamRoundToDraft(id, payload = {}) {
  const response = await api.post(`/exam-rounds/${id}/return-to-draft`, payload)
  return unwrapSuccess(response.data)
}

export async function openExamRoundRegistration(id, payload = {}) {
  const response = await api.post(`/exam-rounds/${id}/open-registration`, payload)
  return unwrapSuccess(response.data)
}

export async function pauseExamRoundRegistration(id, payload = {}) {
  const response = await api.post(`/exam-rounds/${id}/pause-registration`, payload)
  return unwrapSuccess(response.data)
}

export async function resumeExamRoundRegistration(id, payload = {}) {
  const response = await api.post(`/exam-rounds/${id}/resume-registration`, payload)
  return unwrapSuccess(response.data)
}

export async function closeExamRoundRegistration(id, payload = {}) {
  const response = await api.post(`/exam-rounds/${id}/close-registration`, payload)
  return unwrapSuccess(response.data)
}

export async function updateExamRoundStructure(id, payload = {}) {
  const response = await api.put(`/exam-rounds/${id}/structure`, payload)
  return unwrapSuccess(response.data)
}

export async function listExamRoundPaymentProfiles(params = {}) {
  const response = await api.get('/exam-round-payment-profiles', { params })
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

export async function uploadExamRoundPaymentMedia(file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/exam-rounds/payment-media-upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response?.data?.data || null
}

export async function applyExamRoundPaymentProfile(id, paymentProfileId) {
  const response = await api.post(`/exam-rounds/${id}/apply-payment-profile`, { paymentProfileId })
  return unwrapSuccess(response.data)
}

export async function updateExamRoundPaymentSettings(id, payload = {}) {
  const response = await api.put(`/exam-rounds/${id}/payment-settings`, payload)
  return unwrapSuccess(response.data)
}

export async function getExamRoundPaymentSummary(roundId) {
  const response = await api.get(`/exam-rounds/${roundId}/payment-summary`)
  return unwrapSuccess(response.data)
}

export async function listExamRoundPayments(roundId, params = {}) {
  const response = await api.get(`/exam-rounds/${roundId}/payments`, { params })
  return {
    data: Array.isArray(response?.data?.data) ? response.data.data : [],
    pagination: normalizePagination(response?.data),
  }
}

export async function getExamRoundPaymentDetail(roundId, registrationId) {
  const response = await api.get(`/exam-rounds/${roundId}/registrations/${registrationId}/payment-detail`)
  return unwrapSuccess(response.data)
}

export async function confirmExamRegistrationPayment(roundId, registrationId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/registrations/${registrationId}/confirm-payment`, payload)
  return unwrapSuccess(response.data)
}

export async function rejectExamRegistrationPaymentReport(roundId, registrationId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/registrations/${registrationId}/reject-payment-report`, payload)
  return unwrapSuccess(response.data)
}

export async function getExamRoundReviewSummary(roundId) {
  const response = await api.get(`/exam-rounds/${roundId}/review-summary`)
  return unwrapSuccess(response.data)
}

export async function listExamRoundReviews(roundId, params = {}) {
  const response = await api.get(`/exam-rounds/${roundId}/reviews`, { params })
  return {
    data: Array.isArray(response?.data?.data) ? response.data.data : [],
    pagination: normalizePagination(response?.data),
    summary: response?.data?.meta?.summary || null,
  }
}

export async function getExamRoundReviewDetail(roundId, registrationId) {
  const response = await api.get(`/exam-rounds/${roundId}/reviews/${registrationId}`)
  return unwrapSuccess(response.data)
}

export async function approveExamRegistration(roundId, registrationId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/registrations/${registrationId}/approve`, payload)
  return unwrapSuccess(response.data)
}

export async function returnExamRegistration(roundId, registrationId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/registrations/${registrationId}/return`, payload)
  return unwrapSuccess(response.data)
}

export async function rejectExamRegistration(roundId, registrationId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/registrations/${registrationId}/reject`, payload)
  return unwrapSuccess(response.data)
}

export async function getExamRoundVenueRoomConfiguration(roundId) {
  const response = await api.get(`/exam-rounds/${roundId}/venue-room-configuration`)
  return unwrapSuccess(response.data)
}

export async function updateExamRoundVenuesRooms(roundId, payload = {}) {
  const response = await api.put(`/exam-rounds/${roundId}/venues-rooms`, payload)
  return unwrapSuccess(response.data)
}

export async function createExamVenueForRound(roundId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/venues`, payload)
  return unwrapSuccess(response.data)
}

export async function createExamRoomForRound(roundId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/rooms`, payload)
  return unwrapSuccess(response.data)
}

export async function getExamRoundScheduleSummary(roundId) {
  const response = await api.get(`/exam-rounds/${roundId}/schedule-summary`)
  return unwrapSuccess(response.data)
}

export async function listExamRoundSchedules(roundId, params = {}) {
  const response = await api.get(`/exam-rounds/${roundId}/schedules`, { params })
  return {
    data: Array.isArray(response?.data?.data) ? response.data.data : [],
    pagination: normalizePagination(response?.data),
    summary: response?.data?.meta?.summary || null,
  }
}

export async function getExamRoundSchedule(roundId, scheduleId) {
  const response = await api.get(`/exam-rounds/${roundId}/schedules/${scheduleId}`)
  return unwrapSuccess(response.data)
}

export async function createExamRoundSchedule(roundId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/schedules`, payload)
  return unwrapSuccess(response.data)
}

export async function generateExamRoundSchedules(roundId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/schedules/generate`, payload)
  return unwrapSuccess(response.data)
}

export async function updateExamRoundSchedule(roundId, scheduleId, payload = {}) {
  const response = await api.put(`/exam-rounds/${roundId}/schedules/${scheduleId}`, payload)
  return unwrapSuccess(response.data)
}

export async function cloneExamRoundSchedule(roundId, scheduleId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/schedules/${scheduleId}/clone`, payload)
  return unwrapSuccess(response.data)
}

export async function cancelExamRoundSchedule(roundId, scheduleId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/schedules/${scheduleId}/cancel`, payload)
  return unwrapSuccess(response.data)
}

export async function listExamRoundAllocationUnassigned(roundId, params = {}) {
  const response = await api.get(`/exam-rounds/${roundId}/allocation/unassigned`, { params })
  return {
    data: Array.isArray(response?.data?.data) ? response.data.data : [],
    pagination: normalizePagination(response?.data),
  }
}

export async function getExamRoundAllocationCapacity(roundId, params = {}) {
  const response = await api.get(`/exam-rounds/${roundId}/allocation/capacity`, { params })
  return {
    data: Array.isArray(response?.data?.data) ? response.data.data : [],
    summary: response?.data?.meta?.summary || null,
  }
}

export async function previewExamRoundAutoAllocation(roundId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/allocation/preview`, payload)
  return unwrapSuccess(response.data)
}

export async function autoAssignExamRoundAllocation(roundId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/allocation/auto-assign`, payload)
  return unwrapSuccess(response.data)
}

export async function assignExamRoundAllocation(roundId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/allocation/assign`, payload)
  return unwrapSuccess(response.data)
}

export async function reassignExamRoundCandidate(roundId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/allocation/reassign`, payload)
  return unwrapSuccess(response.data)
}

export async function unassignExamRoundCandidates(roundId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/allocation/unassign`, payload)
  return unwrapSuccess(response.data)
}

export async function listExamRoundCandidateLists(roundId, params = {}) {
  const response = await api.get(`/exam-rounds/${roundId}/candidate-lists`, { params })
  return {
    data: Array.isArray(response?.data?.data) ? response.data.data : [],
    pagination: normalizePagination(response?.data),
    summary: response?.data?.meta?.summary || null,
  }
}

export async function getExamRoundCandidateListDetail(roundId, candidateListId, params = {}) {
  const response = await api.get(`/exam-rounds/${roundId}/candidate-lists/${candidateListId}`, { params })
  return unwrapSuccess(response.data)
}

export async function generateExamRoundCandidateListSequence(roundId, candidateListId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/candidate-lists/${candidateListId}/generate-sequence`, payload)
  return unwrapSuccess(response.data)
}

export async function finalizeExamRoundCandidateList(roundId, candidateListId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/candidate-lists/${candidateListId}/finalize`, payload)
  return unwrapSuccess(response.data)
}

export async function reopenExamRoundCandidateList(roundId, candidateListId, payload = {}) {
  const response = await api.post(`/exam-rounds/${roundId}/candidate-lists/${candidateListId}/reopen`, payload)
  return unwrapSuccess(response.data)
}

export async function listExamRoundRegistrations(roundId, params = {}) {
  const response = await api.get('/exam-registrations/review', {
    params: {
      examRoundId: roundId,
      ...params,
    },
  })
  return {
    data: Array.isArray(response?.data?.data) ? response.data.data : [],
    pagination: normalizePagination(response?.data),
    summary: response?.data?.meta?.summary || null,
  }
}

export async function getExamRoundRegistrationDetail(_roundId, registrationId) {
  const response = await api.get(`/exam-registrations/${registrationId}/review`)
  return unwrapSuccess(response.data)
}