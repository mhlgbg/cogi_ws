import publicApi from '../../../api/publicAxios'
import { resolveMediaUrl } from '../../../utils/mediaUrl'

function normalizeTenantCode(tenantCode) {
  return String(tenantCode || '').trim()
}

function withTenantHeaders(config = {}, tenantCode = '') {
  const normalizedTenantCode = normalizeTenantCode(tenantCode)
  if (!normalizedTenantCode) return config
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      'x-tenant-code': normalizedTenantCode,
    },
  }
}

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data
  return payload
}

function normalizeMedia(media) {
  if (!media || typeof media !== 'object') return null
  return {
    name: String(media.name || '').trim(),
    alternativeText: String(media.alternativeText || '').trim(),
    url: resolveMediaUrl(String(media.url || '').trim()),
    width: Number(media.width || 0) || null,
    height: Number(media.height || 0) || null,
    mime: String(media.mime || '').trim(),
    size: Number(media.size || 0) || null,
  }
}

function normalizeCampaign(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    name: String(raw.name || '').trim(),
    slug: String(raw.slug || '').trim(),
    description: String(raw.description || '').trim(),
    width: Number(raw.width || 1080) || 1080,
    height: Number(raw.height || 1080) || 1080,
    photoShape: String(raw.photoShape || 'rect').trim().toLowerCase() || 'rect',
    photoAreaX: Number(raw.photoAreaX || 0) || 0,
    photoAreaY: Number(raw.photoAreaY || 0) || 0,
    photoAreaWidth: Number(raw.photoAreaWidth || raw.width || 1080) || Number(raw.width || 1080) || 1080,
    photoAreaHeight: Number(raw.photoAreaHeight || raw.height || 1080) || Number(raw.height || 1080) || 1080,
    photoFitMode: String(raw.photoFitMode || 'cover').trim().toLowerCase() || 'cover',
    minZoom: Number(raw.minZoom || 0.5) || 0.5,
    maxZoom: Number(raw.maxZoom || 4) || 4,
    defaultZoom: Number(raw.defaultZoom || 1) || 1,
    defaultOffsetX: Number(raw.defaultOffsetX || 0) || 0,
    defaultOffsetY: Number(raw.defaultOffsetY || 0) || 0,
    allowRotate: raw.allowRotate !== false,
    showOutsidePhotoAreaInPreview: String(raw.showOutsidePhotoAreaInPreview || 'dim').trim().toLowerCase() || 'dim',
    outsideOverlayOpacity: Number(raw.outsideOverlayOpacity || 0.45) || 0.45,
    outputFormat: String(raw.outputFormat || 'png').trim().toLowerCase() || 'png',
    outputQuality: Number(raw.outputQuality || 0.92) || 0.92,
    status: String(raw.status || '').trim().toLowerCase(),
    startAt: raw.startAt || null,
    endAt: raw.endAt || null,
    generatedImageStorageMode: String(raw.generatedImageStorageMode || 'none').trim().toLowerCase(),
    frameImage: normalizeMedia(raw.frameImage),
    tenant: raw.tenant && typeof raw.tenant === 'object'
      ? {
          code: String(raw.tenant.code || '').trim(),
          name: String(raw.tenant.name || '').trim(),
          siteTitle: String(raw.tenant.siteTitle || '').trim(),
          slogan: String(raw.tenant.slogan || '').trim(),
          logoUrl: resolveMediaUrl(String(raw.tenant.logoUrl || '').trim()),
          faviconUrl: resolveMediaUrl(String(raw.tenant.faviconUrl || '').trim()),
        }
      : null,
  }
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function getPublicPhotoFrameCampaign(slug, tenantCode = '') {
  const response = await publicApi.get(
    `/public/photo-frame-campaigns/${encodeURIComponent(String(slug || '').trim())}`,
    withTenantHeaders({}, tenantCode),
  )

  const payload = unwrapSuccess(response?.data) || {}
  return {
    availability: payload?.availability || { code: 'inactive', message: '' },
    campaign: normalizeCampaign(payload?.campaign),
  }
}