import api from '../../../api/axios'
import {
  buildExamProgramListParams,
  normalizeExamProgram,
  normalizeExamProgramListResponse,
} from '../utils/examProgramUi'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data
  }
  return payload?.data !== undefined ? payload.data : payload
}

export const examProgramQueryKeys = {
  list: (params = {}) => ['examPrograms', 'list', params],
  detail: (id) => ['examPrograms', 'detail', String(id || '')],
}

export async function listExamPrograms(params = {}) {
  const response = await api.get('/exam-round-configuration-programs', { params: buildExamProgramListParams(params) })
  return normalizeExamProgramListResponse(response.data)
}

export async function getExamProgram(id) {
  const response = await api.get(`/exam-round-configuration-programs/${id}`)
  return normalizeExamProgram(unwrapSuccess(response.data))
}

export async function createExamProgram(payload) {
  const response = await api.post('/exam-round-configuration-programs', payload)
  return normalizeExamProgram(unwrapSuccess(response.data))
}

export async function updateExamProgram(id, payload) {
  const response = await api.patch(`/exam-round-configuration-programs/${id}`, payload)
  return normalizeExamProgram(unwrapSuccess(response.data))
}

export async function setExamProgramActive(id, isActive) {
  const response = await api.patch(`/exam-round-configuration-programs/${id}`, { isActive: isActive === true })
  return normalizeExamProgram(unwrapSuccess(response.data))
}

export async function replaceExamProgramSubjects(id, subjectIds) {
  const response = await api.put(`/exam-round-configuration-programs/${id}/subjects`, { subjectIds })
  return normalizeExamProgram(unwrapSuccess(response.data))
}

export async function updateExamProgramSubject(programId, programSubjectId, payload) {
  const response = await api.patch(`/exam-round-configuration-programs/${programId}/subjects/${programSubjectId}`, payload)
  return normalizeExamProgram(unwrapSuccess(response.data))
}