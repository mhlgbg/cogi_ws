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

function normalizeUser(value) {
  if (!value || typeof value !== 'object') return null

  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    username: toText(value.username),
    email: toText(value.email),
    fullName: toText(value.fullName),
    phone: toText(value.phone),
    blocked: typeof value.blocked === 'boolean' ? value.blocked : null,
    confirmed: typeof value.confirmed === 'boolean' ? value.confirmed : null,
  }
}

function normalizeLinkedSportsProfile(value) {
  if (!value || typeof value !== 'object') return null

  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    code: toText(value.code),
    fullName: toText(value.fullName),
    displayName: toText(value.displayName),
    status: toText(value.status) || 'active',
  }
}

function normalizeSportsProfile(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    id: normalizePositiveId(raw.id),
    documentId: toText(raw.documentId),
    code: toText(raw.code),
    fullName: toText(raw.fullName),
    displayName: toText(raw.displayName),
    gender: toText(raw.gender) || 'unspecified',
    dateOfBirth: raw.dateOfBirth || null,
    birthYear: Number.isInteger(Number(raw.birthYear)) ? Number(raw.birthYear) : null,
    hometown: toText(raw.hometown),
    bio: toText(raw.bio),
    contactPhone: toText(raw.contactPhone),
    contactEmail: toText(raw.contactEmail),
    status: toText(raw.status) || 'active',
    source: toText(raw.source),
    sourceReference: toText(raw.sourceReference),
    avatar: normalizeMedia(raw.avatar),
    user: normalizeUser(raw.user),
    hasUser: Boolean(raw.hasUser || raw.user?.id),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

function normalizeCollection(payload, mapper = normalizeSportsProfile) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows.map(mapper).filter(Boolean)
}

function normalizeLinkableUser(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    userTenantId: normalizePositiveId(raw.userTenantId),
    userTenantStatus: toText(raw.userTenantStatus),
    joinedAt: raw.joinedAt || null,
    label: toText(raw.label),
    user: normalizeUser(raw.user),
    linkedSportsProfile: normalizeLinkedSportsProfile(raw.linkedSportsProfile),
    canLink: Boolean(raw.canLink),
    linkBlockedReason: toText(raw.linkBlockedReason),
  }
}

function normalizePagination(payload) {
  return payload?.meta?.pagination || {
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  }
}

function buildListParams({ page = 1, pageSize = 10, search = '', status = '', gender = '', birthYear = '', hasUser = '', sort = 'updatedAt:desc' } = {}) {
  const params = { page, pageSize, sort }
  if (toText(search)) params.search = toText(search)
  if (toText(status)) params.status = toText(status)
  if (toText(gender)) params.gender = toText(gender)
  if (birthYear !== '' && birthYear !== null && birthYear !== undefined) params.birthYear = birthYear
  if (hasUser !== '' && hasUser !== null && hasUser !== undefined) params.hasUser = hasUser
  return params
}

export function getSportsProfileApiMessage(error, fallback = 'Không thể xử lý hồ sơ thể thao.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function listSportsProfiles(params = {}) {
  const response = await api.get('/sports/profiles', { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data),
    pagination: normalizePagination(response.data),
  }
}

export async function getSportsProfile(id) {
  const response = await api.get(`/sports/profiles/${id}`)
  return normalizeSportsProfile(unwrapSuccess(response.data))
}

export async function createSportsProfile(payload) {
  const response = await api.post('/sports/profiles', { data: payload })
  return normalizeSportsProfile(unwrapSuccess(response.data))
}

export async function updateSportsProfile(id, payload) {
  const response = await api.put(`/sports/profiles/${id}`, { data: payload })
  return normalizeSportsProfile(unwrapSuccess(response.data))
}

export async function activateSportsProfile(id) {
  const response = await api.post(`/sports/profiles/${id}/activate`, {})
  return normalizeSportsProfile(unwrapSuccess(response.data))
}

export async function deactivateSportsProfile(id) {
  const response = await api.post(`/sports/profiles/${id}/deactivate`, {})
  return normalizeSportsProfile(unwrapSuccess(response.data))
}

export async function listLinkableUsersForSportsProfile(id, params = {}) {
  const response = await api.get(`/sports/profiles/${id}/linkable-users`, {
    params: {
      keyword: toText(params.keyword),
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
  return {
    rows: normalizeCollection(response.data, normalizeLinkableUser),
    pagination: normalizePagination(response.data),
  }
}

export async function linkSportsProfileUser(id, payload) {
  const response = await api.post(`/sports/profiles/${id}/link-user`, payload)
  return normalizeSportsProfile(unwrapSuccess(response.data))
}

export async function unlinkSportsProfileUser(id) {
  const response = await api.post(`/sports/profiles/${id}/unlink-user`, {})
  return normalizeSportsProfile(unwrapSuccess(response.data))
}

export async function uploadSportsProfileAvatar(file) {
  const formData = new FormData()
  formData.append('files', file)

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  const first = Array.isArray(response?.data) ? response.data[0] : null
  return normalizeMedia(first)
}