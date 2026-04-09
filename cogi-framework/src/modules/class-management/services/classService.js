import api from '../../../api/axios'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeEntity(raw) {
  if (!raw || typeof raw !== 'object') return null

  if (raw.attributes && typeof raw.attributes === 'object') {
    return {
      id: raw.id,
      ...raw.attributes,
      documentId: raw.attributes.documentId || raw.documentId || '',
    }
  }

  return raw
}

function normalizeRelation(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) {
    return raw.map(normalizeRelation).filter(Boolean)
  }
  if (raw.data !== undefined) {
    return normalizeRelation(raw.data)
  }
  return normalizeEntity(raw)
}

function readClassStatus(entity) {
  return toText(entity?.classStatus || entity?.status) || 'active'
}

function readEnrollmentStatus(entity) {
  return toText(entity?.enrollmentStatus || entity?.status) || 'active'
}

function normalizeClass(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null

  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    name: toText(entity.name),
    subjectCode: toText(entity.subjectCode),
    subject: toText(entity.subject),
    classStatus: readClassStatus(entity),
    status: readClassStatus(entity),
    mainTeacher: normalizeRelation(entity.mainTeacher),
    updatedAt: entity.updatedAt || null,
  }
}

function normalizeEnrollment(raw) {
  if (!raw || typeof raw !== 'object') return null

  const learner = raw.learner || raw.student || null

  return {
    id: raw.id,
    learner: learner
      ? {
          id: learner.id,
          code: toText(learner.code),
          username: toText(learner.username),
          email: toText(learner.email),
          fullName: toText(learner.fullName),
        }
      : null,
    joinDate: raw.joinDate || null,
    leaveDate: raw.leaveDate || null,
    enrollmentStatus: readEnrollmentStatus(raw),
    status: readEnrollmentStatus(raw),
    updatedAt: raw.updatedAt || null,
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

export async function getClassPage({ page = 1, pageSize = 10, q = '', status = '' } = {}) {
  const normalizedStatus = String(status || '').trim()
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    q: String(q || '').trim(),
    classStatus: normalizedStatus,
    status: normalizedStatus,
    'populate[0]': 'mainTeacher',
  }

  const response = await api.get('/classes', { params })
  return {
    rows: parseCollection(response).map(normalizeClass).filter(Boolean),
    pagination: parsePagination(response),
  }
}

export async function getClassFormOptions() {
  const response = await api.get('/classes/form-options')
  const teachers = Array.isArray(response?.data?.data?.teachers) ? response.data.data.teachers : []
  return teachers.map((item) => ({
    id: item.id,
    label: item.label || item.fullName || item.username || item.email || `User #${item.id}`,
    username: toText(item.username),
    email: toText(item.email),
    fullName: toText(item.fullName),
  }))
}

export async function createClass(payload) {
  const data = payload?.status && !payload?.classStatus
    ? { ...payload, classStatus: payload.status }
    : payload

  const response = await api.post('/classes', { data })
  return normalizeClass(parseSingle(response))
}

export async function updateClass(id, payload) {
  const data = payload?.status && !payload?.classStatus
    ? { ...payload, classStatus: payload.status }
    : payload

  const response = await api.put(`/classes/${id}`, { data })
  return normalizeClass(parseSingle(response))
}

export async function deleteClass(id) {
  return api.delete(`/classes/${id}`)
}

export async function getClassById(id) {
  const response = await api.get(`/classes/${id}`)
  return normalizeClass(parseSingle(response))
}

export async function getClassEnrollmentOptions(classId) {
  const response = await api.get(`/classes/${classId}/enrollment-options`)
  return {
    learners: Array.isArray(response?.data?.data?.learners)
      ? response.data.data.learners
      : (Array.isArray(response?.data?.data?.students) ? response.data.data.students : []),
    roles: Array.isArray(response?.data?.data?.roles) ? response.data.data.roles : [],
  }
}

export async function getClassEnrollments(classId, { page = 1, pageSize = 10, q = '', status = '' } = {}) {
  const normalizedStatus = String(status || '').trim()
  const response = await api.get(`/classes/${classId}/enrollments`, {
    params: {
      'pagination[page]': page,
      'pagination[pageSize]': pageSize,
      q: String(q || '').trim(),
      enrollmentStatus: normalizedStatus,
      status: normalizedStatus,
    },
  })

  return {
    rows: (Array.isArray(response?.data?.data) ? response.data.data : []).map(normalizeEnrollment).filter(Boolean),
    meta: response?.data?.meta || { page: 1, pageSize: 10, pageCount: 1, total: 0 },
  }
}

export async function createEnrollment(classId, payload) {
  const data = payload?.status && !payload?.enrollmentStatus
    ? { ...payload, enrollmentStatus: payload.status }
    : payload

  const response = await api.post(`/classes/${classId}/enrollments`, { data })
  return normalizeEnrollment(response?.data?.data || null)
}

export async function updateEnrollment(classId, enrollmentId, payload) {
  const data = payload?.status && !payload?.enrollmentStatus
    ? { ...payload, enrollmentStatus: payload.status }
    : payload

  const response = await api.put(`/classes/${classId}/enrollments/${enrollmentId}`, { data })
  return normalizeEnrollment(response?.data?.data || null)
}

export async function deleteEnrollment(classId, enrollmentId) {
  return api.delete(`/classes/${classId}/enrollments/${enrollmentId}`)
}

export async function importClassEnrollments(classId, formData) {
  const response = await api.post(`/classes/${classId}/enrollments/import`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response?.data?.data || null
}