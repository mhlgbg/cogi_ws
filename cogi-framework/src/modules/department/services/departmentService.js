import api from '../../../api/axios'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toNumberOrDefault(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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

function normalizeDepartment(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null

  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    name: toText(entity.name),
    code: toText(entity.code),
    slug: toText(entity.slug),
    scopeType: toText(entity.scopeType) || 'DEPARTMENT',
    isActive: entity.isActive !== false,
    description: toText(entity.description),
    sortOrder: toNumberOrDefault(entity.sortOrder, 0),
    manager: normalizeRelation(entity.manager),
    parent: normalizeRelation(entity.parent),
    tenant: normalizeRelation(entity.tenant),
    updatedAt: entity.updatedAt || null,
  }
}

function normalizeEmployee(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null

  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    name: toText(entity.name) || toText(entity.fullName) || toText(entity.code) || `Employee #${entity.id}`,
    code: toText(entity.code),
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

export async function getDepartments(params = {}, options = {}) {
  const response = await api.get('/departments', {
    params,
    headers: options.headers,
  })

  return parseCollection(response).map(normalizeDepartment).filter(Boolean)
}

export async function getDepartmentPage(params = {}, options = {}) {
  const response = await api.get('/departments', {
    params,
    headers: options.headers,
  })

  return {
    rows: parseCollection(response).map(normalizeDepartment).filter(Boolean),
    pagination: parsePagination(response),
  }
}

export async function getDepartmentById(id, options = {}) {
  const response = await api.get(`/departments/${id}`, {
    params: options.params,
    headers: options.headers,
  })

  return normalizeDepartment(parseSingle(response))
}

export async function createDepartment(payload, options = {}) {
  const response = await api.post('/departments', { data: payload }, {
    headers: options.headers,
  })

  return normalizeDepartment(parseSingle(response))
}

export async function updateDepartment(id, payload, options = {}) {
  const response = await api.put(`/departments/${id}`, { data: payload }, {
    headers: options.headers,
  })

  return normalizeDepartment(parseSingle(response))
}

export async function deleteDepartment(id, options = {}) {
  const response = await api.delete(`/departments/${id}`, {
    headers: options.headers,
  })

  return parseSingle(response)
}

export async function getDepartmentOptions(options = {}) {
  const rows = await getDepartments(
    {
      'pagination[page]': 1,
      'pagination[pageSize]': 500,
      'sort[0]': 'sortOrder:asc',
      'sort[1]': 'name:asc',
      ...(options.params || {}),
    },
    options,
  )

  return rows.map((item) => ({
    id: item.id,
    documentId: item.documentId,
    name: item.name,
    code: item.code,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
  }))
}

export async function getEmployeeOptions(options = {}) {
  const response = await api.get('/employees', {
    headers: options.headers,
    params: {
      'pagination[page]': 1,
      'pagination[pageSize]': 500,
      'sort[0]': 'name:asc',
      ...(options.params || {}),
    },
  })

  return parseCollection(response).map(normalizeEmployee).filter(Boolean)
}
