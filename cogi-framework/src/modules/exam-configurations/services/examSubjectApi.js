import api from '../../../api/axios'
import {
  buildExamSubjectListParams,
  normalizeExamSubject,
  normalizeExamSubjectListResponse,
} from '../utils/examSubjectUi'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data
  }
  return payload?.data !== undefined ? payload.data : payload
}

export const examSubjectQueryKeys = {
  list: (params = {}) => ['examSubjects', 'list', params],
  detail: (id) => ['examSubjects', 'detail', String(id || '')],
}

export async function listExamSubjects(params = {}) {
  const response = await api.get('/exam-round-configuration-subjects', { params: buildExamSubjectListParams(params) })
  return normalizeExamSubjectListResponse(response.data)
}

export async function getExamSubject(id) {
  const response = await api.get(`/exam-round-configuration-subjects/${id}`)
  return normalizeExamSubject(unwrapSuccess(response.data))
}

export async function createExamSubject(payload) {
  const response = await api.post('/exam-round-configuration-subjects', payload)
  return normalizeExamSubject(unwrapSuccess(response.data))
}

export async function updateExamSubject(id, payload) {
  const response = await api.patch(`/exam-round-configuration-subjects/${id}`, payload)
  return normalizeExamSubject(unwrapSuccess(response.data))
}

export async function setExamSubjectActive(id, isActive) {
  const response = await api.patch(`/exam-round-configuration-subjects/${id}`, { isActive: isActive === true })
  return normalizeExamSubject(unwrapSuccess(response.data))
}

export async function replaceExamSubjectComponents(id, componentIds) {
  const response = await api.put(`/exam-round-configuration-subjects/${id}/components`, { componentIds })
  return normalizeExamSubject(unwrapSuccess(response.data))
}

export async function updateExamSubjectComponent(subjectId, subjectComponentId, payload) {
  const response = await api.patch(`/exam-round-configuration-subjects/${subjectId}/components/${subjectComponentId}`, payload)
  return normalizeExamSubject(unwrapSuccess(response.data))
}