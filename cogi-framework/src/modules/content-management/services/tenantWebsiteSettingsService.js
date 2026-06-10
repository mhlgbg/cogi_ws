import api from '../../../api/axios'
import { resolveMediaUrl } from '../../../utils/mediaUrl'

function normalizePositiveId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizeMedia(value) {
  if (!value || typeof value !== 'object') return null

  return {
    id: normalizePositiveId(value.id),
    name: String(value.name || '').trim() || null,
    url: resolveMediaUrl(String(value.url || value.attributes?.url || '').trim()) || '',
  }
}

function normalizeStorageConfig(value) {
  if (!value || typeof value !== 'object') return null

  return {
    id: normalizePositiveId(value.id),
    name: String(value.name || '').trim(),
    provider: String(value.provider || 'local').trim().toLowerCase() || 'local',
    basePath: String(value.basePath || '').trim(),
    publicBaseUrl: String(value.publicBaseUrl || '').trim(),
    quotaGB: String(value.quotaGB ?? '5').trim() || '5',
    usedBytes: String(value.usedBytes ?? '0').trim() || '0',
    isDefault: Boolean(value.isDefault),
    isActive: value.isActive !== false,
    settings: value.settings ?? null,
    notes: String(value.notes || '').trim(),
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  }
}

function normalizeWebsiteSettingsPayload(payload) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload
  const storageConfigs = Array.isArray(data?.storageConfigs)
    ? data.storageConfigs.map(normalizeStorageConfig).filter(Boolean)
    : []

  return {
    siteTitle: String(data?.siteTitle || '').trim(),
    defaultPageTitle: String(data?.defaultPageTitle || '').trim(),
    titleSuffix: String(data?.titleSuffix || '').trim(),
    siteShortTitle: String(data?.siteShortTitle || '').trim(),
    siteDescription: String(data?.siteDescription || '').trim(),
    siteKeywords: String(data?.siteKeywords || '').trim(),
    siteLogo: normalizeMedia(data?.siteLogo),
    defaultMetaImage: normalizeMedia(data?.defaultMetaImage),
    favicon: normalizeMedia(data?.favicon),
    chatAvatar: normalizeMedia(data?.chatAvatar),
    storageDefaultConfigId: normalizePositiveId(data?.storageDefaultConfigId),
    storageConfigs,
  }
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function getTenantWebsiteSettings() {
  const response = await api.get('/tenant/settings/website')
  return normalizeWebsiteSettingsPayload(response?.data)
}

export async function updateTenantWebsiteSettings(payload) {
  const response = await api.put('/tenant/settings/website', { data: payload })
  return normalizeWebsiteSettingsPayload(response?.data)
}

export async function createTenantWebsiteStorageConfig(payload) {
  const response = await api.post('/tenant/settings/website/storage-configs', { data: payload })
  return normalizeWebsiteSettingsPayload(response?.data)
}

export async function updateTenantWebsiteStorageConfig(id, payload) {
  const response = await api.put(`/tenant/settings/website/storage-configs/${id}`, { data: payload })
  return normalizeWebsiteSettingsPayload(response?.data)
}

export async function uploadTenantWebsiteMedia(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post('/tenant/settings/website/media-upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return normalizeMedia(response?.data?.data || response?.data)
}