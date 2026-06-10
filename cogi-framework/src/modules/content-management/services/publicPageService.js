import api from '../../../api/axios'
import { resolveMediaUrl } from '../../../utils/mediaUrl'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

function normalizeRelation(value) {
  if (!value) return null

  if (value.data && typeof value.data === 'object') {
    const row = value.data
    if (row.attributes && typeof row.attributes === 'object') {
      return {
        id: row.id,
        ...row.attributes,
      }
    }

    return row
  }

  if (value.attributes && typeof value.attributes === 'object') {
    return {
      id: value.id,
      ...value.attributes,
    }
  }

  return value
}

function normalizeMedia(value) {
  if (!value) return null

  const relation = normalizeRelation(value)
  if (!relation || typeof relation !== 'object') return relation

  return {
    ...relation,
    url: resolveMediaUrl(relation.url),
    attributes: relation.attributes
      ? {
        ...relation.attributes,
        url: resolveMediaUrl(relation.attributes.url),
      }
      : relation.attributes,
  }
}

function normalizePublicPage(row) {
  if (!row || typeof row !== 'object') return null

  const base = row.attributes && typeof row.attributes === 'object'
    ? { id: row.id, ...row.attributes }
    : row

  const leadCampaign = normalizeRelation(base.leadCampaign)
  const formTemplate = normalizeRelation(leadCampaign?.formTemplate)

  return {
    ...base,
    publicPageStatus: base.publicPageStatus || base.status || 'draft',
    status: base.publicPageStatus || base.status || 'draft',
    seoImage: normalizeMedia(base.seoImage),
    leadCampaign: leadCampaign
      ? {
        ...leadCampaign,
        leadCampaignStatus: leadCampaign.leadCampaignStatus || leadCampaign.status || 'draft',
        formTemplate,
      }
      : null,
  }
}

function normalizePayload(payload) {
  if (Array.isArray(payload?.data)) {
    return {
      data: payload.data.map(normalizePublicPage).filter(Boolean),
      meta: payload?.meta || null,
    }
  }

  if (payload?.data && typeof payload.data === 'object') {
    return {
      ...payload,
      data: normalizePublicPage(payload.data),
    }
  }

  return {
    data: [],
    meta: payload?.meta || null,
  }
}

export async function getPublicPages(params = {}) {
  const res = await api.get('/public-page-management/pages', { params })
  return unwrapSuccess(res.data)
}

export async function getPublicPageFormOptions() {
  const res = await api.get('/public-page-management/pages/form-options')
  return unwrapSuccess(res.data)
}

export async function getPublicPageDetail(id) {
  const res = await api.get(`/public-page-management/pages/${id}`)
  return unwrapSuccess(res.data)
}

export async function createPublicPage(payload) {
  const res = await api.post('/public-page-management/pages', payload)
  return unwrapSuccess(res.data)
}

export async function updatePublicPage(id, payload) {
  const res = await api.put(`/public-page-management/pages/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function softDeletePublicPage(id, payload = {}) {
  const res = await api.delete(`/public-page-management/pages/${id}`, { data: payload })
  return unwrapSuccess(res.data)
}

export async function restorePublicPage(id, payload = {}) {
  const res = await api.post(`/public-page-management/pages/${id}/restore`, payload)
  return unwrapSuccess(res.data)
}

export async function uploadPublicPageMedia(files = []) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const res = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  const rows = Array.isArray(res?.data) ? res.data.map(normalizeMedia).filter(Boolean) : []
  return rows
}

export async function getPublicPageBySlug(slug) {
  const res = await api.get('/public-pages', {
    params: {
      'filters[slug][$eq]': String(slug || '').trim(),
      'pagination[page]': 1,
      'pagination[pageSize]': 1,
      populate: '*',
      status: 'published',
    },
  })
  return normalizePayload(res.data)
}

export async function submitPublicLeadCampaign(code, data = {}) {
  const res = await api.post(`/public/lead-campaigns/${encodeURIComponent(String(code || '').trim())}/submit`, { data })
  return unwrapSuccess(res.data)
}

export function getMediaUrl(value) {
  return String(value?.url || value?.attributes?.url || '').trim()
}
