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
    slug: toText(value.slug),
    clubType: toText(value.clubType),
    sportType: toText(value.sportType),
    status: toText(value.status),
    parentClub: value.parentClub && typeof value.parentClub === 'object'
      ? {
          id: normalizePositiveId(value.parentClub.id),
          documentId: toText(value.parentClub.documentId),
          code: toText(value.parentClub.code),
          name: toText(value.parentClub.name),
          shortName: toText(value.parentClub.shortName),
        }
      : null,
    logo: normalizeMedia(value.logo),
    assignedAt: value.assignedAt || null,
    assignmentNote: toText(value.assignmentNote),
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
    gender: toText(value.gender),
    dateOfBirth: value.dateOfBirth || null,
    birthYear: Number.isInteger(Number(value.birthYear)) ? Number(value.birthYear) : null,
    contactPhone: toText(value.contactPhone),
    contactEmail: toText(value.contactEmail),
    avatar: normalizeMedia(value.avatar),
  }
}

function normalizeMembership(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    memberCode: toText(value.memberCode),
    oldMemberCode: toText(value.oldMemberCode),
    status: toText(value.status),
    role: toText(value.role),
    positionTitle: toText(value.positionTitle),
    joinedAt: value.joinedAt || null,
    leftAt: value.leftAt || null,
    source: toText(value.source),
    sourceReference: toText(value.sourceReference),
    joinMessage: toText(value.joinMessage),
    note: toText(value.note),
    approvedAt: value.approvedAt || null,
    approvedBy: value.approvedBy && typeof value.approvedBy === 'object'
      ? {
          id: normalizePositiveId(value.approvedBy.id),
          documentId: toText(value.approvedBy.documentId),
          username: toText(value.approvedBy.username),
          email: toText(value.approvedBy.email),
          fullName: toText(value.approvedBy.fullName),
        }
      : null,
    sportsProfile: normalizeProfile(value.sportsProfile),
    club: normalizeClub(value.club),
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
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
    submittedAt: value.submittedAt || null,
    revokedAt: value.revokedAt || null,
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
    source: toText(value.source) || 'manual',
    sourceReference: toText(value.sourceReference),
    evidence: Array.isArray(value.evidence) ? value.evidence.map(normalizeMedia).filter(Boolean) : [],
    note: toText(value.note),
    status: toText(value.status) || 'active',
    verifiedAt: value.verifiedAt || null,
    verifiedBy: value.verifiedBy && typeof value.verifiedBy === 'object'
      ? {
          id: normalizePositiveId(value.verifiedBy.id),
          documentId: toText(value.verifiedBy.documentId),
          username: toText(value.verifiedBy.username),
          email: toText(value.verifiedBy.email),
          fullName: toText(value.verifiedBy.fullName),
        }
      : null,
    revokedAt: value.revokedAt || null,
    revokedBy: value.revokedBy && typeof value.revokedBy === 'object'
      ? {
          id: normalizePositiveId(value.revokedBy.id),
          documentId: toText(value.revokedBy.documentId),
          username: toText(value.revokedBy.username),
          email: toText(value.revokedBy.email),
          fullName: toText(value.revokedBy.fullName),
        }
      : null,
    revokeReason: toText(value.revokeReason),
    sportsProfile: normalizeProfile(value.sportsProfile),
    club: normalizeClub(value.club),
    clubMembership: normalizeMembership(value.clubMembership),
    submission: normalizeAchievementReference(value.submission),
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
    evidence: Array.isArray(value.evidence) ? value.evidence.map(normalizeMedia).filter(Boolean) : [],
    source: toText(value.source) || 'other',
    sourceReference: toText(value.sourceReference),
    status: toText(value.status) || 'draft',
    submittedBy: value.submittedBy && typeof value.submittedBy === 'object'
      ? {
          id: normalizePositiveId(value.submittedBy.id),
          documentId: toText(value.submittedBy.documentId),
          username: toText(value.submittedBy.username),
          email: toText(value.submittedBy.email),
          fullName: toText(value.submittedBy.fullName),
        }
      : null,
    submittedAt: value.submittedAt || null,
    reviewedBy: value.reviewedBy && typeof value.reviewedBy === 'object'
      ? {
          id: normalizePositiveId(value.reviewedBy.id),
          documentId: toText(value.reviewedBy.documentId),
          username: toText(value.reviewedBy.username),
          email: toText(value.reviewedBy.email),
          fullName: toText(value.reviewedBy.fullName),
        }
      : null,
    reviewedAt: value.reviewedAt || null,
    reviewNote: toText(value.reviewNote),
    note: toText(value.note),
    sportsProfile: normalizeProfile(value.sportsProfile),
    club: normalizeClub(value.club),
    clubMembership: normalizeMembership(value.clubMembership),
    achievement: normalizeAchievementReference(value.achievement),
    sourceAchievement: normalizeAchievementReference(value.sourceAchievement),
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  }
}

function normalizeHistory(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    eventType: toText(value.eventType),
    eventAt: value.eventAt || null,
    fromStatus: toText(value.fromStatus),
    toStatus: toText(value.toStatus),
    fromRole: toText(value.fromRole),
    toRole: toText(value.toRole),
    fromPositionTitle: toText(value.fromPositionTitle),
    toPositionTitle: toText(value.toPositionTitle),
    note: toText(value.note),
    metadata: value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata) ? value.metadata : null,
    source: toText(value.source),
    performedBy: value.performedBy && typeof value.performedBy === 'object'
      ? {
          id: normalizePositiveId(value.performedBy.id),
          documentId: toText(value.performedBy.documentId),
          username: toText(value.performedBy.username),
          email: toText(value.performedBy.email),
          fullName: toText(value.performedBy.fullName),
        }
      : null,
  }
}

function normalizeHistoryMutationResult(payload) {
  const unwrapped = unwrapSuccess(payload)
  if (!unwrapped || typeof unwrapped !== 'object') {
    return {
      history: null,
      membership: null,
      success: Boolean(payload?.success),
    }
  }

  if ('history' in unwrapped || 'membership' in unwrapped) {
    return {
      history: normalizeHistory(unwrapped.history),
      membership: normalizeMembership(unwrapped.membership),
      success: Boolean(payload?.success),
    }
  }

  return {
    history: normalizeHistory(unwrapped),
    membership: null,
    success: Boolean(payload?.success),
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

function buildListParams(params = {}) {
  const next = { ...params }
  Object.keys(next).forEach((key) => {
    if (next[key] === '' || next[key] === null || typeof next[key] === 'undefined') {
      delete next[key]
    }
  })
  return next
}

export function getSportsClubManagementApiMessage(error, fallback = 'Không thể xử lý khu vực quản lý Club.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function listMyManagedClubs() {
  const response = await api.get('/sports/my-managed-clubs')
  return normalizeCollection(response.data, normalizeClub)
}

export async function getMyManagedClub(clubId) {
  const response = await api.get(`/sports/my-managed-clubs/${clubId}`)
  return normalizeClub(unwrapSuccess(response.data))
}

export async function listManagedClubMembers(clubId, params = {}) {
  const response = await api.get(`/sports/my-managed-clubs/${clubId}/members`, { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data, normalizeMembership),
    pagination: normalizePagination(response.data),
  }
}

export async function listManagedClubProfileOptions(clubId, params = {}) {
  const response = await api.get(`/sports/my-managed-clubs/${clubId}/profile-options`, { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data, normalizeProfile),
    pagination: normalizePagination(response.data),
  }
}

export async function createManagedClubProfile(clubId, payload) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/profiles`, { data: payload })
  return normalizeProfile(unwrapSuccess(response.data))
}

export async function createManagedClubMember(clubId, payload) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/members`, { data: payload })
  return normalizeMembership(unwrapSuccess(response.data))
}

export async function getManagedClubMember(clubId, membershipId) {
  const response = await api.get(`/sports/my-managed-clubs/${clubId}/members/${membershipId}`)
  return normalizeMembership(unwrapSuccess(response.data))
}

export async function updateManagedClubMember(clubId, membershipId, payload) {
  const response = await api.put(`/sports/my-managed-clubs/${clubId}/members/${membershipId}`, { data: payload })
  return normalizeMembership(unwrapSuccess(response.data))
}

export async function activateManagedClubMember(clubId, membershipId) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/members/${membershipId}/activate`, {})
  return normalizeMembership(unwrapSuccess(response.data))
}

export async function deactivateManagedClubMember(clubId, membershipId, payload = {}) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/members/${membershipId}/deactivate`, { data: payload })
  return normalizeMembership(unwrapSuccess(response.data))
}

export async function leaveManagedClubMember(clubId, membershipId, payload = {}) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/members/${membershipId}/leave`, { data: payload })
  return normalizeMembership(unwrapSuccess(response.data))
}

export async function reactivateManagedClubMember(clubId, membershipId, payload = {}) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/members/${membershipId}/reactivate`, { data: payload })
  return normalizeMembership(unwrapSuccess(response.data))
}

export async function rejoinManagedClubMember(clubId, membershipId, payload = {}) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/members/${membershipId}/rejoin`, { data: payload })
  return normalizeMembership(unwrapSuccess(response.data))
}

export async function listManagedClubMemberHistory(clubId, membershipId, params = {}) {
  const response = await api.get(`/sports/my-managed-clubs/${clubId}/members/${membershipId}/history`, { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data, normalizeHistory),
    pagination: normalizePagination(response.data),
  }
}

export async function createManagedClubMemberHistory(clubId, membershipId, payload) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/members/${membershipId}/history`, { data: payload })
  return normalizeHistoryMutationResult(response.data)
}

export async function updateManagedClubMemberHistory(clubId, membershipId, historyId, payload) {
  const response = await api.put(`/sports/my-managed-clubs/${clubId}/members/${membershipId}/history/${historyId}`, { data: payload })
  return normalizeHistoryMutationResult(response.data)
}

export async function deleteManagedClubMemberHistory(clubId, membershipId, historyId) {
  const response = await api.delete(`/sports/my-managed-clubs/${clubId}/members/${membershipId}/history/${historyId}`)
  return {
    ...response?.data,
    membership: normalizeMembership(response?.data?.membership),
  }
}

export async function listManagedClubAchievementProfileOptions(clubId, params = {}) {
  const response = await api.get(`/sports/my-managed-clubs/${clubId}/achievement-profile-options`, { params: buildListParams(params) })
  return normalizeCollection(response.data, normalizeMembership)
}

export async function listManagedClubAchievementSubmissions(clubId, params = {}) {
  const response = await api.get(`/sports/my-managed-clubs/${clubId}/achievement-submissions`, { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data, normalizeSubmission),
    pagination: normalizePagination(response.data),
  }
}

export async function getManagedClubAchievementSubmission(clubId, submissionId) {
  const response = await api.get(`/sports/my-managed-clubs/${clubId}/achievement-submissions/${submissionId}`)
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function createManagedClubAchievementSubmission(clubId, payload) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/achievement-submissions`, { data: payload })
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function updateManagedClubAchievementSubmission(clubId, submissionId, payload) {
  const response = await api.put(`/sports/my-managed-clubs/${clubId}/achievement-submissions/${submissionId}`, { data: payload })
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function submitManagedClubAchievementSubmission(clubId, submissionId) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/achievement-submissions/${submissionId}/submit`, {})
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function verifyManagedClubAchievementSubmission(clubId, submissionId, payload = {}) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/achievement-submissions/${submissionId}/verify`, { data: payload })
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function rejectManagedClubAchievementSubmission(clubId, submissionId, payload = {}) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/achievement-submissions/${submissionId}/reject`, { data: payload })
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function listManagedClubAchievements(clubId, params = {}) {
  const response = await api.get(`/sports/my-managed-clubs/${clubId}/achievements`, { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data, normalizeAchievement),
    pagination: normalizePagination(response.data),
  }
}

export async function getManagedClubAchievement(clubId, achievementId) {
  const response = await api.get(`/sports/my-managed-clubs/${clubId}/achievements/${achievementId}`)
  return normalizeAchievement(unwrapSuccess(response.data))
}

export async function revokeManagedClubAchievement(clubId, achievementId, payload = {}) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/achievements/${achievementId}/revoke`, { data: payload })
  return normalizeAchievement(unwrapSuccess(response.data))
}

export async function createManagedClubAchievementCorrectionSubmission(clubId, achievementId) {
  const response = await api.post(`/sports/my-managed-clubs/${clubId}/achievements/${achievementId}/create-correction-submission`, {})
  return normalizeSubmission(unwrapSuccess(response.data))
}