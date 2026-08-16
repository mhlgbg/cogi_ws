import api from '../../../api/axios'
import {
  buildOutcomeStandardListParams,
  normalizeOutcomeStandard,
  normalizeOutcomeStandardListResponse,
} from '../utils/outcomeStandardUi'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data
  }
  return payload?.data !== undefined ? payload.data : payload
}

export const outcomeStandardQueryKeys = {
  list: (params = {}) => ['outcomeStandards', 'list', params],
  detail: (id) => ['outcomeStandards', 'detail', String(id || '')],
}

export async function listOutcomeStandards(params = {}) {
  const response = await api.get('/exam-round-configuration-outcomes', { params: buildOutcomeStandardListParams(params) })
  return normalizeOutcomeStandardListResponse(response.data)
}

export async function getOutcomeStandard(id) {
  const response = await api.get(`/exam-round-configuration-outcomes/${id}`)
  return normalizeOutcomeStandard(unwrapSuccess(response.data))
}

export async function createOutcomeStandard(payload) {
  const response = await api.post('/exam-round-configuration-outcomes', payload)
  return normalizeOutcomeStandard(unwrapSuccess(response.data))
}

export async function updateOutcomeStandard(id, payload) {
  const response = await api.patch(`/exam-round-configuration-outcomes/${id}`, payload)
  return normalizeOutcomeStandard(unwrapSuccess(response.data))
}

export async function setOutcomeStandardActive(id, isActive) {
  const response = await api.patch(`/exam-round-configuration-outcomes/${id}`, { isActive: isActive === true })
  return normalizeOutcomeStandard(unwrapSuccess(response.data))
}