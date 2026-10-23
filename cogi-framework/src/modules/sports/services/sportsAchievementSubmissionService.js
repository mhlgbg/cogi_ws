import api from '../../../api/axios'
import { uploadTenantStorageFile } from '../../content-management/services/tenantStorageService'
import { buildProtectedFileUrl, resolveMediaUrl } from '../../../utils/mediaUrl'

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

  const rawUrl = toText(value.url || value.attributes?.url || value.resolvedUrl || value.relativePath)
  const fileAssetId = normalizePositiveId(
    value.fileAssetId
    || value.provider_metadata?.bridgedFromFileAssetId
    || value.providerMetadata?.bridgedFromFileAssetId
    || value.attributes?.fileAssetId
    || value.attributes?.provider_metadata?.bridgedFromFileAssetId
    || value.attributes?.providerMetadata?.bridgedFromFileAssetId
  )
  const provider = toText(value.provider || value.attributes?.provider).toLowerCase()

  return {
    id: normalizePositiveId(value.id),
    fileAssetId,
    name: toText(value.name || value.originalName || value.fileName),
    provider,
    url: buildProtectedFileUrl({
      fileAssetId,
      storageProvider: provider,
      url: rawUrl,
    }) || resolveMediaUrl(rawUrl) || '',
    mime: toText(value.mime || value.mimeType),
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

function normalizeSubmission(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: normalizePositiveId(raw.id),
    documentId: toText(raw.documentId),
    title: toText(raw.title),
    eventCode: toText(raw.eventCode),
    raceType: toText(raw.raceType),
    bib: toText(raw.bib),
    distancePending: Boolean(raw.distancePending),
    description: toText(raw.description),
    achievementType: toText(raw.achievementType) || 'other',
    sportType: toText(raw.sportType),
    achievedAt: raw.achievedAt || null,
    resultValue: raw.resultValue === null || raw.resultValue === undefined || raw.resultValue === '' ? null : Number(raw.resultValue),
    distanceKm: raw.distanceKm === null || raw.distanceKm === undefined || raw.distanceKm === '' ? null : Number(raw.distanceKm),
    durationSeconds: raw.durationSeconds === null || raw.durationSeconds === undefined || raw.durationSeconds === '' ? null : Number(raw.durationSeconds),
    resultUnit: toText(raw.resultUnit),
    resultText: toText(raw.resultText),
    source: toText(raw.source) || 'other',
    sourceReference: toText(raw.sourceReference),
    status: toText(raw.status) || 'draft',
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map(normalizeMedia).filter(Boolean) : [],
    submittedBy: normalizeUser(raw.submittedBy),
    submittedAt: raw.submittedAt || null,
    reviewedBy: normalizeUser(raw.reviewedBy),
    reviewedAt: raw.reviewedAt || null,
    reviewNote: toText(raw.reviewNote),
    note: toText(raw.note),
    sportsProfile: normalizeProfile(raw.sportsProfile),
    club: normalizeClub(raw.club),
    achievement: normalizeAchievementReference(raw.achievement),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

function normalizeCollection(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows.map(normalizeSubmission).filter(Boolean)
}

function normalizePagination(payload) {
  return payload?.meta?.pagination || {
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  }
}

function buildListParams(params = {}) {
  const next = { ...params }
  Object.keys(next).forEach((key) => {
    if (next[key] === '' || next[key] === null || typeof next[key] === 'undefined') delete next[key]
  })
  return next
}

export function getSportsAchievementSubmissionApiMessage(error, fallback = 'Không thể xử lý Sports Achievement Submission.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function listSportsAchievementSubmissions(params = {}) {
  const response = await api.get('/sports/achievement-submissions', { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data),
    pagination: normalizePagination(response.data),
  }
}

export async function getSportsAchievementSubmission(id) {
  const response = await api.get(`/sports/achievement-submissions/${id}`)
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function createSportsAchievementSubmission(payload) {
  const response = await api.post('/sports/achievement-submissions', { data: payload })
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function updateSportsAchievementSubmission(id, payload) {
  const response = await api.put(`/sports/achievement-submissions/${id}`, { data: payload })
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function submitSportsAchievementSubmission(id) {
  const response = await api.post(`/sports/achievement-submissions/${id}/submit`, {})
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function verifySportsAchievementSubmission(id, payload = {}) {
  const response = await api.post(`/sports/achievement-submissions/${id}/verify`, { data: payload })
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function rejectSportsAchievementSubmission(id, payload = {}) {
  const response = await api.post(`/sports/achievement-submissions/${id}/reject`, { data: payload })
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function cancelSportsAchievementSubmission(id) {
  const response = await api.post(`/sports/achievement-submissions/${id}/cancel`, {})
  return normalizeSubmission(unwrapSuccess(response.data))
}

export async function uploadSportsAchievementSubmissionEvidence(file, options = {}) {
  if (!file) return null

  const uploaded = await uploadTenantStorageFile({
    file,
    moduleKey: options.moduleKey || 'sports-achievement-submission',
    featureKey: options.featureKey || 'sports-achievement-submission.manage',
    entityType: options.entityType || 'sports-achievement-submission',
    entityId: options.entityId ? String(options.entityId).trim() : undefined,
    isPublic: true,
  })

  return normalizeMedia(uploaded)
}
