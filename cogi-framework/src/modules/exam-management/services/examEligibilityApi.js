import api from '../../../api/axios'
import {
  normalizeExamEligibility,
  normalizeExamEligibilityCollection,
  normalizeEligibilitySummary,
  normalizeLearnerLookupCollection,
  normalizePagination,
} from '../utils/examEligibilityUi'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data
  }
  return payload?.data !== undefined ? payload.data : payload
}

function buildEligibilityListParams({ page = 1, pageSize = 20, search = '', eligibilityStatus = '', source = '', registrationState = '' } = {}) {
  const params = {
    page,
    pageSize,
  }
  if (String(search || '').trim()) params.search = String(search || '').trim()
  if (eligibilityStatus) params.eligibilityStatus = eligibilityStatus
  if (source) params.source = source
  if (registrationState) params.registrationState = registrationState
  return params
}

function buildLearnerLookupParams({ page = 1, pageSize = 20, search = '', excludeExisting = true } = {}) {
  const params = {
    page,
    pageSize,
    excludeExisting: excludeExisting ? 'true' : 'false',
  }
  if (String(search || '').trim()) params.search = String(search || '').trim()
  return params
}

export async function listExamEligibilities(examRoundId, params = {}) {
  const response = await api.get(`/exam-rounds/${examRoundId}/eligibilities`, { params: buildEligibilityListParams(params) })
  return {
    rows: normalizeExamEligibilityCollection(response.data),
    pagination: normalizePagination(response.data),
    summary: normalizeEligibilitySummary(response.data),
    management: response?.data?.meta?.management || null,
  }
}

export async function getExamEligibility(examRoundId, id) {
  const response = await api.get(`/exam-rounds/${examRoundId}/eligibilities/${id}`)
  return normalizeExamEligibility(unwrapSuccess(response.data))
}

export async function createExamEligibility(examRoundId, payload) {
  const response = await api.post(`/exam-rounds/${examRoundId}/eligibilities`, payload)
  return normalizeExamEligibility(unwrapSuccess(response.data))
}

export async function bulkCreateExamEligibilities(examRoundId, payload) {
  const response = await api.post(`/exam-rounds/${examRoundId}/eligibilities/bulk`, payload)
  return unwrapSuccess(response.data)
}

export async function updateExamEligibility(examRoundId, id, payload) {
  const response = await api.put(`/exam-rounds/${examRoundId}/eligibilities/${id}`, payload)
  return normalizeExamEligibility(unwrapSuccess(response.data))
}

export async function deleteExamEligibility(examRoundId, id) {
  const response = await api.delete(`/exam-rounds/${examRoundId}/eligibilities/${id}`)
  return unwrapSuccess(response.data)
}

export async function markExamEligibilityIneligible(examRoundId, id, payload) {
  const response = await api.post(`/exam-rounds/${examRoundId}/eligibilities/${id}/mark-ineligible`, payload)
  return unwrapSuccess(response.data)
}

export async function downloadExamEligibilityImportTemplate() {
  const response = await api.get('/exam-rounds/eligibilities/import-template', {
    responseType: 'blob',
  })

  const headerValue = String(response.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)

  return {
    blob: response.data,
    fileName: matchedName?.[1] || 'exam-eligibility-import-template.xlsx',
  }
}

export async function previewExamEligibilityImport(examRoundId, file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post(`/exam-rounds/${examRoundId}/eligibilities/import/preview`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return unwrapSuccess(response.data)
}

export async function commitExamEligibilityImport(examRoundId, file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post(`/exam-rounds/${examRoundId}/eligibilities/import/commit`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return unwrapSuccess(response.data)
}

export async function listLearnersForEligibility(examRoundId, params = {}) {
  const response = await api.get(`/exam-rounds/${examRoundId}/eligibility-learners`, { params: buildLearnerLookupParams(params) })
  return {
    rows: normalizeLearnerLookupCollection(response.data),
    pagination: normalizePagination(response.data),
    management: response?.data?.meta?.management || null,
  }
}