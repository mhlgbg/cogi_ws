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

function normalizePosition(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null

  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    code: toText(entity.code),
    name: toText(entity.name),
    slug: toText(entity.slug),
    level: toNumberOrDefault(entity.level, 1),
    isLeadership: Boolean(entity.isLeadership),
    isActive: entity.isActive !== false,
    description: toText(entity.description),
    updatedAt: entity.updatedAt || null,
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

export async function getPositionPage(params = {}, options = {}) {
  const response = await api.get('/positions', {
    params,
    headers: options.headers,
  })

  return {
    rows: parseCollection(response).map(normalizePosition).filter(Boolean),
    pagination: parsePagination(response),
  }
}

export async function createPosition(payload, options = {}) {
  const response = await api.post('/positions', { data: payload }, {
    headers: options.headers,
  })

  return normalizePosition(parseSingle(response))
}

export async function updatePosition(id, payload, options = {}) {
  const response = await api.put(`/positions/${id}`, { data: payload }, {
    headers: options.headers,
  })

  return normalizePosition(parseSingle(response))
}

export async function deletePosition(id, options = {}) {
  const response = await api.delete(`/positions/${id}`, {
    headers: options.headers,
  })

  return parseSingle(response)
}
