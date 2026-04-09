import api from '../../../api/axios'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeLearner(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    id: raw.id,
    code: toText(raw.code),
    fullName: toText(raw.fullName),
    dateOfBirth: raw.dateOfBirth || null,
    parentName: toText(raw.parentName),
    parentPhone: toText(raw.parentPhone),
    status: toText(raw.status) || 'active',
    updatedAt: raw.updatedAt || null,
    user: raw.user
      ? {
          id: raw.user.id,
          username: toText(raw.user.username),
          email: toText(raw.user.email),
          fullName: toText(raw.user.fullName),
        }
      : null,
  }
}

function parseCollection(response) {
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

function parseSingle(response) {
  return response?.data?.data || null
}

function parsePagination(response) {
  return response?.data?.meta?.pagination || {
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  }
}

export async function getLearnerPage({ page = 1, pageSize = 10, q = '', status = '' } = {}) {
  const response = await api.get('/learners', {
    params: {
      'pagination[page]': page,
      'pagination[pageSize]': pageSize,
      q: String(q || '').trim(),
      status: String(status || '').trim(),
    },
  })

  return {
    rows: parseCollection(response).map(normalizeLearner).filter(Boolean),
    pagination: parsePagination(response),
  }
}

export async function getLearnerFormOptions() {
  const response = await api.get('/learners/form-options')
  return {
    users: Array.isArray(response?.data?.data?.users) ? response.data.data.users : [],
    roles: Array.isArray(response?.data?.data?.roles) ? response.data.data.roles : [],
  }
}

export async function createLearner(payload) {
  const response = await api.post('/learners', { data: payload })
  return normalizeLearner(parseSingle(response))
}

export async function updateLearner(id, payload) {
  const response = await api.put(`/learners/${id}`, { data: payload })
  return normalizeLearner(parseSingle(response))
}

export async function deleteLearner(id) {
  return api.delete(`/learners/${id}`)
}

export async function importLearners(formData) {
  const response = await api.post('/learners/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response?.data?.data || null
}