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

function normalizeSportsProfile(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    code: toText(value.code),
    fullName: toText(value.fullName),
    displayName: toText(value.displayName),
    contactPhone: toText(value.contactPhone),
    contactEmail: toText(value.contactEmail),
    avatar: normalizeMedia(value.avatar),
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
    logo: normalizeMedia(value.logo),
  }
}

function normalizeApprovedBy(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    username: toText(value.username),
    email: toText(value.email),
    fullName: toText(value.fullName),
  }
}

function normalizeClubMembership(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: normalizePositiveId(raw.id),
    documentId: toText(raw.documentId),
    memberCode: toText(raw.memberCode),
    oldMemberCode: toText(raw.oldMemberCode),
    status: toText(raw.status) || 'active',
    role: toText(raw.role) || 'member',
    positionTitle: toText(raw.positionTitle),
    joinedAt: raw.joinedAt || null,
    leftAt: raw.leftAt || null,
    source: toText(raw.source),
    sourceReference: toText(raw.sourceReference),
    joinMessage: toText(raw.joinMessage),
    note: toText(raw.note),
    approvedAt: raw.approvedAt || null,
    approvedBy: normalizeApprovedBy(raw.approvedBy),
    sportsProfile: normalizeSportsProfile(raw.sportsProfile),
    club: normalizeClub(raw.club),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

function normalizeCollection(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows.map(normalizeClubMembership).filter(Boolean)
}

function normalizePagination(payload) {
  return payload?.meta?.pagination || {
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  }
}

function buildListParams({ page = 1, pageSize = 10, search = '', status = '', role = '', club = '', sportsProfile = '', source = '', hasMemberCode = '', sort = 'updatedAt:desc' } = {}) {
  const params = { page, pageSize, sort }
  if (toText(search)) params.search = toText(search)
  if (toText(status)) params.status = toText(status)
  if (toText(role)) params.role = toText(role)
  if (toText(club)) params.club = toText(club)
  if (toText(sportsProfile)) params.sportsProfile = toText(sportsProfile)
  if (toText(source)) params.source = toText(source)
  if (hasMemberCode !== '' && hasMemberCode !== null && hasMemberCode !== undefined) params.hasMemberCode = hasMemberCode
  return params
}

export function getClubMembershipApiMessage(error, fallback = 'Không thể xử lý quan hệ thành viên CLB.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function listClubMemberships(params = {}) {
  const response = await api.get('/sports/memberships', { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data),
    pagination: normalizePagination(response.data),
  }
}

export async function getClubMembership(id) {
  const response = await api.get(`/sports/memberships/${id}`)
  return normalizeClubMembership(unwrapSuccess(response.data))
}

export async function createClubMembership(payload) {
  const response = await api.post('/sports/memberships', { data: payload })
  return normalizeClubMembership(unwrapSuccess(response.data))
}

export async function updateClubMembership(id, payload) {
  const response = await api.put(`/sports/memberships/${id}`, { data: payload })
  return normalizeClubMembership(unwrapSuccess(response.data))
}

export async function activateClubMembership(id) {
  const response = await api.post(`/sports/memberships/${id}/activate`, {})
  return normalizeClubMembership(unwrapSuccess(response.data))
}

export async function deactivateClubMembership(id) {
  const response = await api.post(`/sports/memberships/${id}/deactivate`, {})
  return normalizeClubMembership(unwrapSuccess(response.data))
}

export async function leaveClubMembership(id) {
  const response = await api.post(`/sports/memberships/${id}/leave`, {})
  return normalizeClubMembership(unwrapSuccess(response.data))
}

export async function suspendClubMembership(id) {
  const response = await api.post(`/sports/memberships/${id}/suspend`, {})
  return normalizeClubMembership(unwrapSuccess(response.data))
}