import api from '../../../api/axios'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizePositiveId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizePerformedBy(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    username: toText(value.username),
    email: toText(value.email),
    fullName: toText(value.fullName),
  }
}

function normalizeClubMembershipHistory(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: normalizePositiveId(raw.id),
    documentId: toText(raw.documentId),
    eventType: toText(raw.eventType) || 'other',
    eventAt: raw.eventAt || null,
    fromStatus: toText(raw.fromStatus),
    toStatus: toText(raw.toStatus),
    fromRole: toText(raw.fromRole),
    toRole: toText(raw.toRole),
    fromPositionTitle: toText(raw.fromPositionTitle),
    toPositionTitle: toText(raw.toPositionTitle),
    note: toText(raw.note),
    metadata: raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : null,
    source: toText(raw.source),
    performedBy: normalizePerformedBy(raw.performedBy),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

function normalizeCollection(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows.map(normalizeClubMembershipHistory).filter(Boolean)
}

function normalizePagination(payload) {
  return payload?.meta?.pagination || {
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  }
}

export async function listMembershipHistory(membershipId, params = {}) {
  const response = await api.get(`/sports/memberships/${membershipId}/history`, { params })
  return {
    rows: normalizeCollection(response.data),
    pagination: normalizePagination(response.data),
  }
}