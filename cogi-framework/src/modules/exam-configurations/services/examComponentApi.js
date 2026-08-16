import api from '../../../api/axios'
import {
  normalizeExamComponent,
  normalizeExamComponentCollection,
  normalizeExamConfigurationPagination,
} from '../utils/examConfigurationUi'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data
  }
  return payload?.data !== undefined ? payload.data : payload
}

function buildExamComponentListParams({ page = 1, pageSize = 10, search = '', componentType = '', examMethod = '', isActive = '' } = {}) {
  const params = {
    page,
    pageSize,
    'sort[0]': 'displayOrder:asc',
    'sort[1]': 'name:asc',
    'sort[2]': 'id:asc',
  }

  const keyword = String(search || '').trim()
  if (keyword) params.search = keyword
  if (componentType) params.componentType = componentType
  if (examMethod) params.examMethod = examMethod
  if (isActive) params.isActive = isActive

  return params
}

export async function getExamComponents(params = {}) {
  const response = await api.get('/exam-round-configuration-components', { params: buildExamComponentListParams(params) })
  return {
    rows: normalizeExamComponentCollection(response.data),
    pagination: normalizeExamConfigurationPagination(response.data),
  }
}

export async function getExamComponent(id) {
  const response = await api.get(`/exam-round-configuration-components/${id}`)
  return normalizeExamComponent(unwrapSuccess(response.data))
}

export async function createExamComponent(payload) {
  const response = await api.post('/exam-round-configuration-components', payload)
  return normalizeExamComponent(unwrapSuccess(response.data))
}

export async function updateExamComponent(id, payload) {
  const response = await api.patch(`/exam-round-configuration-components/${id}`, payload)
  return normalizeExamComponent(unwrapSuccess(response.data))
}

export async function setExamComponentActive(id, isActive) {
  const response = await api.patch(`/exam-round-configuration-components/${id}`, { isActive: isActive === true })
  return normalizeExamComponent(unwrapSuccess(response.data))
}