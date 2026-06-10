import axios from 'axios'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1339/api'

function readStoredToken() {
  return localStorage.getItem('authJwt') || ''
}

const platformApi = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

platformApi.interceptors.request.use((config) => {
  const nextConfig = { ...config }
  nextConfig.headers = nextConfig.headers || {}

  const token = readStoredToken()
  if (token && !nextConfig.headers.Authorization) {
    nextConfig.headers.Authorization = `Bearer ${token}`
  }

  if (nextConfig.headers['x-tenant-code']) {
    delete nextConfig.headers['x-tenant-code']
  }

  return nextConfig
})

platformApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (import.meta.env.DEV) {
      const method = String(error?.config?.method || 'GET').toUpperCase()
      const baseURL = String(error?.config?.baseURL || '')
      const urlPath = String(error?.config?.url || '')
      const status = error?.response?.status
      const responseBody = error?.response?.data
      const requestPayload = error?.config?.data

      console.error('[PLATFORM API ERROR]', {
        method,
        url: `${baseURL}${urlPath}`,
        status,
        responseBody,
        requestPayload,
      })
    }

    return Promise.reject(error)
  },
)

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function getPlatformTenants() {
  const response = await platformApi.get('/platform/tenants')
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

export async function createPlatformTenant(payload) {
  const response = await platformApi.post('/platform/tenants', payload)
  return response?.data?.data || null
}

export async function updatePlatformTenant(id, payload) {
  const response = await platformApi.put(`/platform/tenants/${id}`, payload)
  return response?.data?.data || null
}

export async function uploadPlatformTenantLogo(file) {
  const formData = new FormData()
  formData.append('files', file)

  const response = await platformApi.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  const rows = Array.isArray(response?.data) ? response.data : []
  return rows[0] || null
}

export async function getPlatformFeatures({ groupId, groupCode } = {}) {
  const response = await platformApi.get('/platform/features', {
    params: {
      ...(groupId ? { groupId } : {}),
      ...(groupCode ? { groupCode } : {}),
    },
  })

  return response?.data?.data || {
    featureGroups: [],
    features: [],
    filters: {
      groupId: null,
      groupCode: null,
    },
  }
}

export async function createPlatformFeature(payload) {
  const response = await platformApi.post('/platform/features', payload)
  return response?.data?.data || null
}

export async function updatePlatformFeature(featureId, payload) {
  const response = await platformApi.put(`/platform/features/${featureId}`, payload)
  return response?.data?.data || null
}

export async function getPlatformSettings() {
  const response = await platformApi.get('/platform/settings')
  return response?.data?.data || {
    settings: [],
    groups: [],
  }
}

export async function updatePlatformSetting(key, payload) {
  const response = await platformApi.put(`/platform/settings/${encodeURIComponent(key)}`, payload)
  return response?.data?.data || null
}

export async function getPlatformFeatureRoles(featureId) {
  const response = await platformApi.get(`/platform/features/${featureId}/roles`)
  return response?.data?.data || {
    feature: null,
    activeRoles: [],
    inactiveRoles: [],
    unassignedRoles: [],
  }
}

export async function activatePlatformFeatureRole(featureId, roleId) {
  const response = await platformApi.post(`/platform/features/${featureId}/roles/${roleId}/activate`)
  return response?.data?.data || null
}

export async function deactivatePlatformFeatureRole(featureId, roleId) {
  const response = await platformApi.post(`/platform/features/${featureId}/roles/${roleId}/deactivate`)
  return response?.data?.data || null
}

export async function updatePlatformTenantStatus(id, status) {
  const response = await platformApi.patch(`/platform/tenants/${id}/status`, { status })
  return response?.data?.data || null
}

export async function getPlatformTenantFeatures(id) {
  const response = await platformApi.get(`/platform/tenants/${id}/features`)
  return response?.data?.data || {
    tenant: null,
    assigned: [],
    available: [],
  }
}

export async function updatePlatformTenantFeature(tenantId, featureId, isEnabled) {
  const response = await platformApi.patch(`/platform/tenants/${tenantId}/features/${featureId}`, {
    isEnabled,
  })
  return response?.data?.data || null
}

export async function getPlatformTenantRoles(id) {
  const response = await platformApi.get(`/platform/tenants/${id}/roles`)
  return response?.data?.data || {
    tenant: null,
    activeRoles: [],
    inactiveRoles: [],
    unassignedRoles: [],
  }
}

export async function getPlatformTenantAdmins(id) {
  const response = await platformApi.get(`/platform/tenants/${id}/tenant-admins`)
  return response?.data?.data || {
    tenant: null,
    tenantAdminRoleCode: '',
    tenantAdminRole: null,
    admins: [],
  }
}

export async function invitePlatformTenantAdmin(tenantId, identifier) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/tenant-admins/invite`, {
    identifier,
  })

  return response?.data || {
    ok: true,
    message: 'Da moi/gan user lam Tenant Admin thanh cong.',
    data: null,
  }
}

export async function inactivePlatformTenantAdmin(tenantId, assignmentId) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/tenant-admins/${assignmentId}/inactive`)
  return response?.data || {
    ok: true,
    message: 'Da inactive Tenant Admin thanh cong.',
    data: null,
  }
}

export async function activatePlatformTenantAdmin(tenantId, assignmentId) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/tenant-admins/${assignmentId}/activate`)
  return response?.data || {
    ok: true,
    message: 'Da kich hoat lai Tenant Admin thanh cong.',
    data: null,
  }
}

export async function activatePlatformTenantRole(tenantId, roleId) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/roles/${roleId}/activate`)
  return response?.data?.data || null
}

export async function deactivatePlatformTenantRole(tenantId, roleId) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/roles/${roleId}/deactivate`)
  return response?.data?.data || null
}

export async function getPlatformTenantStorageConfigs(tenantId) {
  const response = await platformApi.get(`/platform/tenants/${tenantId}/storage-configs`)
  return response?.data?.data || {
    tenant: null,
    storageConfigs: [],
  }
}

export async function createPlatformTenantStorageConfig(tenantId, payload) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/storage-configs`, payload)
  return response?.data?.data || {
    tenant: null,
    storageConfigs: [],
  }
}

export async function updatePlatformTenantStorageConfig(tenantId, storageConfigId, payload) {
  const response = await platformApi.put(`/platform/tenants/${tenantId}/storage-configs/${storageConfigId}`, payload)
  return response?.data?.data || {
    tenant: null,
    storageConfigs: [],
  }
}

export async function updatePlatformTenantDefaultStorageConfig(tenantId, storageDefaultConfigId) {
  const response = await platformApi.patch(`/platform/tenants/${tenantId}/storage-default-config`, {
    storageDefaultConfigId,
  })
  return response?.data?.data || {
    tenant: null,
    storageConfigs: [],
  }
}

export async function getPermissionDebug({ userId, tenantCode }) {
  const response = await platformApi.get('/platform/permission-debug', {
    params: {
      userId,
      tenantCode,
    },
  })

  return {
    roles: Array.isArray(response?.data?.roles) ? response.data.roles : [],
    features: Array.isArray(response?.data?.features) ? response.data.features : [],
  }
}

export default platformApi