import api from '../../../api/axios'

function unwrapPayload(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

function normalizeConfig(row) {
  if (!row || typeof row !== 'object') return null

  return {
    id: row.id,
    name: String(row.name || '').trim(),
    description: String(row.description || '').trim(),
    status: String(row.status || 'draft').trim().toLowerCase() || 'draft',
    headerConfig: row.headerConfig && typeof row.headerConfig === 'object' ? row.headerConfig : {},
    sidebarConfig: row.sidebarConfig && typeof row.sidebarConfig === 'object' ? row.sidebarConfig : { items: [] },
    feedConfig: row.feedConfig && typeof row.feedConfig === 'object' ? row.feedConfig : {},
    policyConfig: row.policyConfig && typeof row.policyConfig === 'object' ? row.policyConfig : {},
    effectiveFrom: row.effectiveFrom || null,
    effectiveTo: row.effectiveTo || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    createdBy: row.createdBy || null,
    updatedBy: row.updatedBy || null,
  }
}

function normalizeManagementListPayload(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data.map(normalizeConfig).filter(Boolean) : []
  return {
    data: rows,
    meta: payload?.meta || null,
  }
}

function normalizeCommunitySnapshotPayload(payload) {
  const data = unwrapPayload(payload)
  if (!data || typeof data !== 'object') {
    return {
      mode: 'active',
      tenant: null,
      config: null,
      hasActiveConfig: false,
    }
  }

  return {
    mode: String(data.mode || 'active').trim().toLowerCase() || 'active',
    tenant: data.tenant || null,
    config: normalizeConfig(data.config),
    hasActiveConfig: data.hasActiveConfig === true || Boolean(data.config),
  }
}

export async function getCommunityConfigFormOptions() {
  const response = await api.get('/community-config-management/configs/form-options')
  return unwrapPayload(response.data)
}

export async function getCommunityConfigs(params = {}) {
  const response = await api.get('/community-config-management/configs', { params })
  return normalizeManagementListPayload(response.data)
}

export async function getCommunityConfigDetail(id) {
  const response = await api.get(`/community-config-management/configs/${id}`)
  return normalizeConfig(unwrapPayload(response.data))
}

export async function createCommunityConfig(payload) {
  const response = await api.post('/community-config-management/configs', payload)
  return normalizeConfig(unwrapPayload(response.data))
}

export async function updateCommunityConfig(id, payload) {
  const response = await api.put(`/community-config-management/configs/${id}`, payload)
  return normalizeConfig(unwrapPayload(response.data))
}

export async function activateCommunityConfig(id) {
  const response = await api.post(`/community-config-management/configs/${id}/activate`)
  return normalizeConfig(unwrapPayload(response.data))
}

export async function archiveCommunityConfig(id) {
  const response = await api.post(`/community-config-management/configs/${id}/archive`)
  return normalizeConfig(unwrapPayload(response.data))
}

export async function cloneCommunityConfig(id) {
  const response = await api.post(`/community-config-management/configs/${id}/clone`)
  return normalizeConfig(unwrapPayload(response.data))
}

export async function getCommunityConfigPreview(id) {
  const response = await api.get(`/community-config-management/configs/${id}/preview`)
  return normalizeCommunitySnapshotPayload(response.data)
}

export async function getActiveCommunityConfig() {
  const response = await api.get('/community/active-config')
  return normalizeCommunitySnapshotPayload(response.data)
}

