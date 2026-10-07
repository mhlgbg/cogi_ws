import api from '../../../api/axios'
import { resolveMediaUrl } from '../../../utils/mediaUrl'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

function normalizeMedia(value) {
  if (!value || typeof value !== 'object') return null
  return {
    ...value,
    url: resolveMediaUrl(value.url || ''),
  }
}

function normalizeOwner(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: value.id,
    username: String(value.username || '').trim(),
    email: String(value.email || '').trim(),
    fullName: String(value.fullName || '').trim(),
  }
}

function normalizeTenant(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: value.id,
    code: String(value.code || '').trim(),
    name: String(value.name || '').trim(),
  }
}

function normalizeCampaign(row) {
  if (!row || typeof row !== 'object') return null
  return {
    ...row,
    width: Number(row.width || 1080) || 1080,
    height: Number(row.height || 1080) || 1080,
    photoAreaX: Number(row.photoAreaX || 0) || 0,
    photoAreaY: Number(row.photoAreaY || 0) || 0,
    photoAreaWidth: Number(row.photoAreaWidth || row.width || 1080) || Number(row.width || 1080) || 1080,
    photoAreaHeight: Number(row.photoAreaHeight || row.height || 1080) || Number(row.height || 1080) || 1080,
    minZoom: Number(row.minZoom || 0.5) || 0.5,
    maxZoom: Number(row.maxZoom || 4) || 4,
    defaultZoom: Number(row.defaultZoom || 1) || 1,
    defaultOffsetX: Number(row.defaultOffsetX || 0) || 0,
    defaultOffsetY: Number(row.defaultOffsetY || 0) || 0,
    outsideOverlayOpacity: Number(row.outsideOverlayOpacity || 0.45) || 0.45,
    outputQuality: Number(row.outputQuality || 0.92) || 0.92,
    allowRotate: row.allowRotate !== false,
    frameImage: normalizeMedia(row.frameImage),
    ownerUser: normalizeOwner(row.ownerUser),
    tenant: normalizeTenant(row.tenant),
    publicUrl: String(row.publicUrl || '').trim(),
    publicPath: String(row.publicPath || '').trim(),
  }
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function getPhotoFrameCampaignFormOptions() {
  const response = await api.get('/photo-frame-campaign-management/campaigns/form-options')
  return unwrapSuccess(response?.data)
}

export async function getPhotoFrameCampaigns(params = {}) {
  const response = await api.get('/photo-frame-campaign-management/campaigns', { params })
  const payload = unwrapSuccess(response?.data) || {}
  return {
    ...payload,
    data: Array.isArray(payload?.data) ? payload.data.map(normalizeCampaign).filter(Boolean) : [],
  }
}

export async function getPhotoFrameCampaignDetail(id) {
  const response = await api.get(`/photo-frame-campaign-management/campaigns/${id}`)
  return normalizeCampaign(unwrapSuccess(response?.data))
}

export async function createPhotoFrameCampaign(payload) {
  const response = await api.post('/photo-frame-campaign-management/campaigns', payload)
  return normalizeCampaign(unwrapSuccess(response?.data))
}

export async function updatePhotoFrameCampaign(id, payload) {
  const response = await api.put(`/photo-frame-campaign-management/campaigns/${id}`, payload)
  return normalizeCampaign(unwrapSuccess(response?.data))
}

export async function togglePhotoFrameCampaignStatus(id, payload = {}) {
  const response = await api.post(`/photo-frame-campaign-management/campaigns/${id}/toggle-status`, payload)
  return normalizeCampaign(unwrapSuccess(response?.data))
}

export async function deletePhotoFrameCampaign(id) {
  const response = await api.delete(`/photo-frame-campaign-management/campaigns/${id}`)
  return unwrapSuccess(response?.data)
}

export async function uploadPhotoFrameMedia(file) {
  const formData = new FormData()
  formData.append('files', file)

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  const rows = Array.isArray(response?.data) ? response.data.map(normalizeMedia).filter(Boolean) : []
  return rows[0] || null
}