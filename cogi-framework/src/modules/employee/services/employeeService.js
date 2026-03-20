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

function normalizeEmployee(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null

  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    employeeCode: toText(entity.employeeCode),
    fullName: toText(entity.fullName),
    gender: toText(entity.gender),
    dateOfBirth: entity.dateOfBirth || '',
    phone: toText(entity.phone),
    workEmail: toText(entity.workEmail),
    personalEmail: toText(entity.personalEmail),
    address: toText(entity.address),
    joinDate: entity.joinDate || '',
    officialDate: entity.officialDate || '',
    status: toText(entity.status) || 'active',
    note: toText(entity.note),
    avatar: normalizeRelation(entity.avatar),
    currentDepartment: normalizeRelation(entity.currentDepartment),
    currentPosition: normalizeRelation(entity.currentPosition),
    currentManager: normalizeRelation(entity.currentManager),
    user: normalizeRelation(entity.user),
    updatedAt: entity.updatedAt || null,
  }
}

function normalizeHistory(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null

  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    startDate: entity.startDate || '',
    endDate: entity.endDate || '',
    assignmentType: toText(entity.assignmentType) || 'official',
    isPrimary: Boolean(entity.isPrimary),
    isCurrent: Boolean(entity.isCurrent),
    decisionNo: toText(entity.decisionNo),
    note: toText(entity.note),
    employee: normalizeRelation(entity.employee),
    department: normalizeRelation(entity.department),
    position: normalizeRelation(entity.position),
    manager: normalizeRelation(entity.manager),
    updatedAt: entity.updatedAt || null,
  }
}

function normalizeOptionRow(raw, labelFields = ['name', 'code']) {
  const entity = normalizeEntity(raw)
  if (!entity) return null

  let label = ''
  for (const field of labelFields) {
    const text = toText(entity?.[field])
    if (text) {
      label = text
      break
    }
  }

  if (!label) {
    label = `#${entity.id}`
  }

  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    label,
    ...entity,
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

export async function uploadAvatar(file) {
  const formData = new FormData()
  formData.append('files', file)

  const response = await api.post('/upload', formData)
  const rows = Array.isArray(response?.data) ? response.data : []
  const first = rows[0]
  return first?.id ? Number(first.id) : null
}

export async function getEmployeePage(params = {}, options = {}) {
  const response = await api.get('/employees', {
    params,
    headers: options.headers,
  })

  return {
    rows: parseCollection(response).map(normalizeEmployee).filter(Boolean),
    pagination: parsePagination(response),
  }
}

export async function createEmployee(payload, options = {}) {
  const response = await api.post('/employees', { data: payload }, {
    headers: options.headers,
  })

  return normalizeEmployee(parseSingle(response))
}

export async function updateEmployee(id, payload, options = {}) {
  const response = await api.put(`/employees/${id}`, { data: payload }, {
    headers: options.headers,
  })

  return normalizeEmployee(parseSingle(response))
}

export async function deleteEmployee(id, options = {}) {
  const response = await api.delete(`/employees/${id}`, {
    headers: options.headers,
  })

  return parseSingle(response)
}

export async function getEmployeeHistoryPage(params = {}, options = {}) {
  const response = await api.get('/employee-histories', {
    params,
    headers: options.headers,
  })

  return {
    rows: parseCollection(response).map(normalizeHistory).filter(Boolean),
    pagination: parsePagination(response),
  }
}

export async function createEmployeeHistory(payload, options = {}) {
  const response = await api.post('/employee-histories', { data: payload }, {
    headers: options.headers,
  })

  return normalizeHistory(parseSingle(response))
}

export async function updateEmployeeHistory(id, payload, options = {}) {
  const response = await api.put(`/employee-histories/${id}`, { data: payload }, {
    headers: options.headers,
  })

  return normalizeHistory(parseSingle(response))
}

export async function getDepartmentOptions(options = {}) {
  const response = await api.get('/departments', {
    headers: options.headers,
    params: {
      'pagination[page]': 1,
      'pagination[pageSize]': 500,
      'sort[0]': 'name:asc',
      ...(options.params || {}),
    },
  })

  return parseCollection(response)
    .map((row) => normalizeOptionRow(row, ['name', 'code']))
    .filter(Boolean)
}

export async function getPositionOptions(options = {}) {
  const response = await api.get('/positions', {
    headers: options.headers,
    params: {
      'pagination[page]': 1,
      'pagination[pageSize]': 500,
      'sort[0]': 'name:asc',
      ...(options.params || {}),
    },
  })

  return parseCollection(response)
    .map((row) => normalizeOptionRow(row, ['name', 'code']))
    .filter(Boolean)
}

export async function getManagerOptions(options = {}) {
  const response = await api.get('/employees', {
    headers: options.headers,
    params: {
      'pagination[page]': 1,
      'pagination[pageSize]': 500,
      'sort[0]': 'fullName:asc',
      ...(options.params || {}),
    },
  })

  return parseCollection(response)
    .map((row) => normalizeEmployee(row))
    .filter(Boolean)
}

export async function getUserOptions(options = {}) {
  const response = await api.get('/account/tenant-users', {
    headers: options.headers,
  })

  // endpoint returns { data: [{id, username, email}, ...] }
  const rows = Array.isArray(response?.data?.data) ? response.data.data : []
  return rows
    .filter((row) => row?.id)
    .map((row) => ({
      id: row.id,
      documentId: row.documentId || '',
      label: row.username || row.email || `User #${row.id}`,
      username: row.username || '',
      email: row.email || '',
    }))
}

export function toApiId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function toAbsoluteMediaUrl(url) {
  if (!url) return ''
  if (String(url).startsWith('http')) return String(url)

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
  if (!apiBaseUrl) return String(url)

  const normalizedPath = String(url).startsWith('/') ? String(url) : `/${String(url)}`
  const hostBase = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl
  return `${hostBase}${normalizedPath}`
}

export function formatDateDDMMYYYY(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${day}/${month}/${year}`
}

export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'secondary' },
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'probation', label: 'Probation', color: 'info' },
  { value: 'official', label: 'Official', color: 'primary' },
  { value: 'maternity_leave', label: 'Maternity Leave', color: 'warning' },
  { value: 'unpaid_leave', label: 'Unpaid Leave', color: 'warning' },
  { value: 'resigned', label: 'Resigned', color: 'danger' },
  { value: 'retired', label: 'Retired', color: 'dark' },
]

export const ASSIGNMENT_TYPE_OPTIONS = [
  { value: 'official', label: 'Official', color: 'primary' },
  { value: 'concurrent', label: 'Concurrent', color: 'info' },
  { value: 'temporary', label: 'Temporary', color: 'warning' },
  { value: 'promotion', label: 'Promotion', color: 'success' },
  { value: 'transfer', label: 'Transfer', color: 'secondary' },
]

export function getStatusMeta(status) {
  return STATUS_OPTIONS.find((item) => item.value === status) || { label: status || '-', color: 'secondary' }
}

export function getAssignmentTypeMeta(type) {
  return ASSIGNMENT_TYPE_OPTIONS.find((item) => item.value === type) || { label: type || '-', color: 'secondary' }
}

export function toEntityKey(entity) {
  if (!entity || typeof entity !== 'object') return ''
  return toText(entity.documentId) || toText(entity.id)
}
