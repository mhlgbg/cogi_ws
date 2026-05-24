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

export async function updatePlatformTenantStatus(id, status) {
  const response = await platformApi.patch(`/platform/tenants/${id}/status`, { status })
  return response?.data?.data || null
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