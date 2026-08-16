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

function normalizeParentClub(value) {
  if (!value || typeof value !== 'object') return null

  return {
    id: normalizePositiveId(value.id),
    documentId: toText(value.documentId),
    code: toText(value.code),
    name: toText(value.name),
    slug: toText(value.slug),
    clubType: toText(value.clubType),
    status: toText(value.status),
  }
}

function normalizeSportsClub(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    id: normalizePositiveId(raw.id),
    documentId: toText(raw.documentId),
    code: toText(raw.code),
    name: toText(raw.name),
    shortName: toText(raw.shortName),
    slug: toText(raw.slug),
    clubType: toText(raw.clubType) || 'club',
    sportType: toText(raw.sportType) || 'running',
    description: toText(raw.description),
    logo: normalizeMedia(raw.logo),
    coverImage: normalizeMedia(raw.coverImage),
    status: toText(raw.status) || 'active',
    joinPolicy: toText(raw.joinPolicy) || 'approval',
    foundedAt: raw.foundedAt || null,
    contactPhone: toText(raw.contactPhone),
    contactEmail: toText(raw.contactEmail),
    address: toText(raw.address),
    website: toText(raw.website),
    parentClub: normalizeParentClub(raw.parentClub),
    childClubs: Array.isArray(raw.childClubs) ? raw.childClubs.map(normalizeParentClub).filter(Boolean) : [],
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

function normalizeCollection(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows.map(normalizeSportsClub).filter(Boolean)
}

function normalizePagination(payload) {
  return payload?.meta?.pagination || {
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  }
}

function buildListParams({ page = 1, pageSize = 10, search = '', status = '', clubType = '', sportType = '', joinPolicy = '', parentClub = '', rootOnly = '', sort = 'updatedAt:desc' } = {}) {
  const params = { page, pageSize, sort }
  if (toText(search)) params.search = toText(search)
  if (toText(status)) params.status = toText(status)
  if (toText(clubType)) params.clubType = toText(clubType)
  if (toText(sportType)) params.sportType = toText(sportType)
  if (toText(joinPolicy)) params.joinPolicy = toText(joinPolicy)
  if (parentClub !== '' && parentClub !== null && parentClub !== undefined) params.parentClub = parentClub
  if (rootOnly !== '' && rootOnly !== null && rootOnly !== undefined) params.rootOnly = rootOnly
  return params
}

export function getSportsClubApiMessage(error, fallback = 'Không thể xử lý câu lạc bộ thể thao.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function listSportsClubs(params = {}) {
  const response = await api.get('/sports/clubs', { params: buildListParams(params) })
  return {
    rows: normalizeCollection(response.data),
    pagination: normalizePagination(response.data),
  }
}

export async function getSportsClub(id) {
  const response = await api.get(`/sports/clubs/${id}`)
  return normalizeSportsClub(unwrapSuccess(response.data))
}

export async function createSportsClub(payload) {
  const response = await api.post('/sports/clubs', { data: payload })
  return normalizeSportsClub(unwrapSuccess(response.data))
}

export async function updateSportsClub(id, payload) {
  const response = await api.put(`/sports/clubs/${id}`, { data: payload })
  return normalizeSportsClub(unwrapSuccess(response.data))
}

export async function activateSportsClub(id) {
  const response = await api.post(`/sports/clubs/${id}/activate`, {})
  return normalizeSportsClub(unwrapSuccess(response.data))
}

export async function deactivateSportsClub(id) {
  const response = await api.post(`/sports/clubs/${id}/deactivate`, {})
  return normalizeSportsClub(unwrapSuccess(response.data))
}

export async function uploadSportsClubMedia(file) {
  return uploadTenantWebsiteMedia(file)
}