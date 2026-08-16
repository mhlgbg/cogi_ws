import api from '../../../api/axios'
import { uploadTenantWebsiteMedia } from '../../content-management/services/tenantWebsiteSettingsService'
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

function normalizeAchievement(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: normalizePositiveId(raw.id),
    documentId: toText(raw.documentId),
    title: toText(raw.title),
    description: toText(raw.description),
    achievementType: toText(raw.achievementType) || 'other',
    sportType: toText(raw.sportType),
    achievedAt: raw.achievedAt || null,
    resultValue: raw.resultValue === null || raw.resultValue === undefined || raw.resultValue === '' ? null : Number(raw.resultValue),
    resultUnit: toText(raw.resultUnit),
    resultText: toText(raw.resultText),
    source: toText(raw.source) || 'manual',
    sourceReference: toText(raw.sourceReference),
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map(normalizeMedia).filter(Boolean) : [],
    note: toText(raw.note),
    verifiedAt: raw.verifiedAt || null,
    verifiedBy: normalizeUser(raw.verifiedBy),
    status: toText(raw.status) || 'active',
    sportsProfile: normalizeProfile(raw.sportsProfile),
    club: normalizeClub(raw.club),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

function normalizeCollection(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows.map(normalizeAchievement).filter(Boolean)
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

export function getSportsAchievementApiMessage(error, fallback = 'Không thể xử lý Sports Achievement.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function listSportsAchievements(params = {}) {
  const response = await api.get('/sports/achievements', { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data),
    pagination: normalizePagination(response.data),
  }
}

export async function getSportsAchievement(id) {
  const response = await api.get(`/sports/achievements/${id}`)
  return normalizeAchievement(unwrapSuccess(response.data))
}

export async function createSportsAchievement(payload) {
  const response = await api.post('/sports/achievements', { data: payload })
  return normalizeAchievement(unwrapSuccess(response.data))
}

export async function updateSportsAchievement(id, payload) {
  const response = await api.put(`/sports/achievements/${id}`, { data: payload })
  return normalizeAchievement(unwrapSuccess(response.data))
}

export async function uploadSportsAchievementEvidence(file) {
  return uploadTenantWebsiteMedia(file)
}
