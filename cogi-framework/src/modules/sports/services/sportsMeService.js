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

function normalizeBasicUser(value) {
  if (!value || typeof value !== 'object') return null
  return {
    username: toText(value.username),
    email: toText(value.email),
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

function normalizeAchievementReference(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    title: toText(value.title),
    status: toText(value.status),
    verifiedAt: value.verifiedAt || null,
  }
}

function normalizeProfile(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    code: toText(value.code),
    fullName: toText(value.fullName),
    displayName: toText(value.displayName),
    avatar: normalizeMedia(value.avatar),
    gender: toText(value.gender) || 'unspecified',
    dateOfBirth: value.dateOfBirth || null,
    birthYear: Number.isInteger(Number(value.birthYear)) ? Number(value.birthYear) : null,
    hometown: toText(value.hometown),
    bio: toText(value.bio),
    contactPhone: toText(value.contactPhone),
    contactEmail: toText(value.contactEmail),
    status: toText(value.status) || 'active',
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
    user: normalizeBasicUser(value.user),
  }
}

function normalizeSummary(value) {
  if (!value || typeof value !== 'object') return { activeClubCount: 0, activeAchievementCount: 0, pendingSubmissionCount: 0 }
  return {
    activeClubCount: Number(value.activeClubCount || 0),
    activeAchievementCount: Number(value.activeAchievementCount || 0),
    pendingSubmissionCount: Number(value.pendingSubmissionCount || 0),
  }
}

function normalizeMembership(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    memberCode: toText(value.memberCode),
    oldMemberCode: toText(value.oldMemberCode),
    status: toText(value.status) || 'active',
    role: toText(value.role) || 'member',
    positionTitle: toText(value.positionTitle),
    joinedAt: value.joinedAt || null,
    leftAt: value.leftAt || null,
    source: toText(value.source),
    sourceReference: toText(value.sourceReference),
    joinMessage: toText(value.joinMessage),
    club: normalizeClub(value.club),
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  }
}

function normalizeHistory(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    eventType: toText(value.eventType) || 'other',
    eventAt: value.eventAt || null,
    fromStatus: toText(value.fromStatus),
    toStatus: toText(value.toStatus),
    fromRole: toText(value.fromRole),
    toRole: toText(value.toRole),
    fromPositionTitle: toText(value.fromPositionTitle),
    toPositionTitle: toText(value.toPositionTitle),
    source: toText(value.source),
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  }
}

function normalizeAchievement(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    title: toText(value.title),
    description: toText(value.description),
    achievementType: toText(value.achievementType) || 'other',
    sportType: toText(value.sportType),
    achievedAt: value.achievedAt || null,
    resultValue: value.resultValue === null || value.resultValue === undefined || value.resultValue === '' ? null : Number(value.resultValue),
    resultUnit: toText(value.resultUnit),
    resultText: toText(value.resultText),
    status: toText(value.status) || 'active',
    source: toText(value.source) || 'manual',
    sourceReference: toText(value.sourceReference),
    evidence: Array.isArray(value.evidence) ? value.evidence.map(normalizeMedia).filter(Boolean) : [],
    verifiedAt: value.verifiedAt || null,
    revokedAt: value.revokedAt || null,
    revokeReason: toText(value.revokeReason),
    club: normalizeClub(value.club),
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  }
}

function normalizeSubmission(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    title: toText(value.title),
    description: toText(value.description),
    achievementType: toText(value.achievementType) || 'other',
    sportType: toText(value.sportType),
    achievedAt: value.achievedAt || null,
    resultValue: value.resultValue === null || value.resultValue === undefined || value.resultValue === '' ? null : Number(value.resultValue),
    resultUnit: toText(value.resultUnit),
    resultText: toText(value.resultText),
    source: toText(value.source) || 'other',
    sourceReference: toText(value.sourceReference),
    status: toText(value.status) || 'draft',
    submittedAt: value.submittedAt || null,
    reviewedAt: value.reviewedAt || null,
    reviewNote: toText(value.reviewNote),
    evidence: Array.isArray(value.evidence) ? value.evidence.map(normalizeMedia).filter(Boolean) : [],
    club: normalizeClub(value.club),
    achievement: normalizeAchievementReference(value.achievement),
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  }
}

export function getSportsMeApiMessage(error, fallback = 'Không thể xử lý hồ sơ thể thao của tôi.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export function getSportsMeApiCode(error) {
  return toText(error?.response?.data?.error?.code)
}

export async function getMySportsProfile() {
  const response = await api.get('/sports/me')
  const data = unwrapSuccess(response.data)
  return {
    profile: normalizeProfile(data?.profile),
    summary: normalizeSummary(data?.summary),
  }
}

export async function createMySportsProfile(payload) {
  const response = await api.post('/sports/me', { data: payload })
  const data = unwrapSuccess(response.data)
  return {
    profile: normalizeProfile(data?.profile),
    summary: normalizeSummary(data?.summary),
  }
}

export async function updateMySportsProfile(payload) {
  const response = await api.put('/sports/me', { data: payload })
  const data = unwrapSuccess(response.data)
  return {
    profile: normalizeProfile(data?.profile),
    summary: normalizeSummary(data?.summary),
  }
}

export async function uploadMySportsProfileAvatar(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post('/sports/me/avatar-upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return normalizeMedia(unwrapSuccess(response.data))
}

export async function listMySportsClubs(params = {}) {
  const response = await api.get('/sports/me/clubs', { params })
  const rows = Array.isArray(response.data?.data) ? response.data.data : []
  return rows.map(normalizeMembership).filter(Boolean)
}

export async function getMySportsClubMembership(id) {
  const response = await api.get(`/sports/me/clubs/${id}`)
  return normalizeMembership(unwrapSuccess(response.data))
}

export async function listMySportsClubMembershipHistory(id) {
  const response = await api.get(`/sports/me/clubs/${id}/history`)
  const data = unwrapSuccess(response.data)
  return {
    membership: normalizeMembership(data?.membership),
    rows: Array.isArray(data?.rows) ? data.rows.map(normalizeHistory).filter(Boolean) : [],
  }
}

export async function listMySportsAchievements(params = {}) {
  const response = await api.get('/sports/me/achievements', { params })
  const rows = Array.isArray(response.data?.data) ? response.data.data : []
  return rows.map(normalizeAchievement).filter(Boolean)
}

export async function getMySportsAchievement(id) {
  const response = await api.get(`/sports/me/achievements/${id}`)
  return normalizeAchievement(unwrapSuccess(response.data))
}

export async function listMySportsAchievementSubmissions(params = {}) {
  const response = await api.get('/sports/me/achievement-submissions', { params })
  const rows = Array.isArray(response.data?.data) ? response.data.data : []
  return rows.map(normalizeSubmission).filter(Boolean)
}

export async function getMySportsAchievementSubmission(id) {
  const response = await api.get(`/sports/me/achievement-submissions/${id}`)
  return normalizeSubmission(unwrapSuccess(response.data))
}