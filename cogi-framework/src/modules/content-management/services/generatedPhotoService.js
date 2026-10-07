import api from '../../../api/axios'
import { buildProtectedFileUrl } from '../../../utils/mediaUrl'

function normalizeTenantCode(tenantCode) {
  return String(tenantCode || '').trim()
}

function readStoredToken() {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem('authJwt') || '').trim()
}

function withPublicGeneratedPhotoHeaders(config = {}, tenantCode = '') {
  const normalizedTenantCode = normalizeTenantCode(tenantCode)
  const token = readStoredToken()
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      ...(normalizedTenantCode ? { 'x-tenant-code': normalizedTenantCode } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
}

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data
  return payload
}

function normalizeImage(image) {
  if (!image || typeof image !== 'object') return null
  return {
    ...image,
    resolvedUrl: buildProtectedFileUrl({
      fileAssetId: image.fileAssetId || image.id,
      storageProvider: image.storageProvider || image.provider,
      url: image.url,
    }) || image.url,
  }
}

function normalizeGeneratedPhoto(row) {
  if (!row || typeof row !== 'object') return null
  return {
    ...row,
    fileSize: Number(row.fileSize || 0) || 0,
    image: normalizeImage(row.image),
  }
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function savePublicGeneratedPhoto(slug, payload = {}, tenantCode = '') {
  const formData = new FormData()
  if (payload.file) {
    formData.append('file', payload.file, payload.file.name || 'generated-photo.png')
  }
  if (payload.sessionId) formData.append('sessionId', String(payload.sessionId).trim())
  formData.append('consentPublicGallery', payload.consentPublicGallery ? 'true' : 'false')
  if (payload.outputFormat) formData.append('outputFormat', String(payload.outputFormat).trim())

  const response = await api.post(
    `/public/photo-frame-campaigns/${encodeURIComponent(String(slug || '').trim())}/generated-photos`,
    formData,
    withPublicGeneratedPhotoHeaders({}, tenantCode),
  )
  return normalizeGeneratedPhoto(unwrapSuccess(response?.data))
}

export async function getCampaignGeneratedPhotos(campaignId, params = {}) {
  const response = await api.get(`/photo-frame-campaign-management/campaigns/${encodeURIComponent(String(campaignId || '').trim())}/generated-photos`, { params })
  const payload = unwrapSuccess(response?.data) || {}
  return {
    ...payload,
    data: Array.isArray(payload?.data) ? payload.data.map(normalizeGeneratedPhoto).filter(Boolean) : [],
  }
}

export async function getCampaignGeneratedPhotoSummary(campaignId) {
  const response = await api.get(`/photo-frame-campaign-management/campaigns/${encodeURIComponent(String(campaignId || '').trim())}/generated-photo-summary`)
  return unwrapSuccess(response?.data) || { counts: {} }
}

export async function updateGeneratedPhotoStatus(id, status) {
  const response = await api.patch(`/photo-frame-campaign-management/generated-photos/${encodeURIComponent(String(id || '').trim())}/status`, { status })
  return normalizeGeneratedPhoto(unwrapSuccess(response?.data))
}

export async function deleteGeneratedPhoto(id) {
  const response = await api.delete(`/photo-frame-campaign-management/generated-photos/${encodeURIComponent(String(id || '').trim())}`)
  return unwrapSuccess(response?.data)
}