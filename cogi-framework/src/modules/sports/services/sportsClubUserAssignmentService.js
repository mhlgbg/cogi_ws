import api from '../../../api/axios'
import { resolveMediaUrl } from '../../../utils/mediaUrl'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizePositiveId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) return payload.data
  return payload?.data !== undefined ? payload.data : payload
}

function normalizeMedia(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    name: toText(value.name),
    url: resolveMediaUrl(toText(value.url || value.attributes?.url)) || '',
    mime: toText(value.mime),
  }
}

function normalizeClub(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    code: toText(value.code),
    name: toText(value.name),
    shortName: toText(value.shortName),
    status: toText(value.status),
    logo: normalizeMedia(value.logo),
  }
}

function normalizeUser(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    username: toText(value.username),
    email: toText(value.email),
    fullName: toText(value.fullName),
    phone: toText(value.phone),
  }
}

function normalizeAssignment(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: normalizePositiveId(raw.id),
    documentId: toText(raw.documentId),
    status: toText(raw.status) || 'active',
    assignedAt: raw.assignedAt || null,
    note: toText(raw.note),
    club: normalizeClub(raw.club),
    user: normalizeUser(raw.user),
    assignedBy: normalizeUser(raw.assignedBy),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

function normalizeAssignableUser(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    userTenantId: normalizePositiveId(raw.userTenantId),
    userTenantStatus: toText(raw.userTenantStatus),
    joinedAt: raw.joinedAt || null,
    label: toText(raw.label),
    activeRoleIds: Array.isArray(raw.activeRoleIds) ? raw.activeRoleIds : [],
    user: normalizeUser(raw.user),
  }
}

function normalizeCollection(payload, mapper) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows.map(mapper).filter(Boolean)
}

function normalizePagination(payload) {
  return payload?.meta?.pagination || payload?.meta || {
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  }
}

function buildListParams({ page = 1, pageSize = 10, search = '', club = '', user = '', status = '', activeOnly = '', sort = 'assignedAt:desc' } = {}) {
  const params = { page, pageSize, sort }
  if (toText(search)) params.search = toText(search)
  if (toText(club)) params.club = toText(club)
  if (toText(user)) params.user = toText(user)
  if (toText(status)) params.status = toText(status)
  if (activeOnly !== '' && activeOnly !== null && activeOnly !== undefined) params.activeOnly = activeOnly
  return params
}

export function getSportsClubUserAssignmentApiMessage(error, fallback = 'Không thể xử lý phân công quản lý CLB.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function listSportsClubUserAssignments(params = {}) {
  const response = await api.get('/sports/club-user-assignments', { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data, normalizeAssignment),
    pagination: normalizePagination(response.data),
  }
}

export async function getSportsClubUserAssignment(id) {
  const response = await api.get(`/sports/club-user-assignments/${id}`)
  return normalizeAssignment(unwrapSuccess(response.data))
}

export async function createSportsClubUserAssignment(payload) {
  const response = await api.post('/sports/club-user-assignments', { data: payload })
  return normalizeAssignment(unwrapSuccess(response.data))
}

export async function updateSportsClubUserAssignment(id, payload) {
  const response = await api.put(`/sports/club-user-assignments/${id}`, { data: payload })
  return normalizeAssignment(unwrapSuccess(response.data))
}

export async function activateSportsClubUserAssignment(id) {
  const response = await api.post(`/sports/club-user-assignments/${id}/activate`, {})
  return normalizeAssignment(unwrapSuccess(response.data))
}

export async function deactivateSportsClubUserAssignment(id) {
  const response = await api.post(`/sports/club-user-assignments/${id}/deactivate`, {})
  return normalizeAssignment(unwrapSuccess(response.data))
}

export async function listAssignableClubManagers(params = {}) {
  const response = await api.get('/sports/club-user-assignments/assignable-users', { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data, normalizeAssignableUser),
    pagination: normalizePagination(response.data),
  }
}