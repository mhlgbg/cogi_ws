import axios from 'axios'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1339/api'

const CONTEXT_HEADER_EXCLUDED_PATHS = new Set([
	'/api/auth/local',
	'/api/auth/invite',
	'/api/auth/activate',
	'/api/auth/set-password',
	'/api/auth/forgot-password-safe',
	'/api/auth/reset-password',
	'/api/auth/forgot-password',
	'/api/tenants/by-code',
	'/api/admission-campaigns/by-code',
])

const CONTEXT_HEADER_EXCLUDED_PREFIXES = [
	'/api/tenants/by-code/',
	'/tenants/by-code/',
	'/api/admission-campaigns/by-code/',
	'/admission-campaigns/by-code/',
]

function readStoredToken() {
	return localStorage.getItem('authJwt') || ''
}

function readStoredTenantCode() {
	return String(localStorage.getItem('tenantCode') || '').trim()
}

function shouldSkipContextHeaders(url) {
	if (!url) return false

	let pathname = ''
	try {
		pathname = new URL(url, 'http://localhost').pathname
	} catch {
		return false
	}

	const normalizedPath = pathname.replace(/\/+$/, '') || '/'
	const apiPathVariant = normalizedPath.startsWith('/api')
		? normalizedPath
		: `/api${normalizedPath}`

	return (
		CONTEXT_HEADER_EXCLUDED_PATHS.has(normalizedPath)
		|| CONTEXT_HEADER_EXCLUDED_PATHS.has(apiPathVariant)
		|| CONTEXT_HEADER_EXCLUDED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix) || apiPathVariant.startsWith(prefix))
	)
}

const api = axios.create({
	baseURL: apiBaseUrl,
	headers: {
		'Content-Type': 'application/json',
	},
})

api.interceptors.request.use((config) => {
	const nextConfig = { ...config }
	nextConfig.headers = nextConfig.headers || {}
	const skipContextHeaders = shouldSkipContextHeaders(nextConfig.url)

	const token = readStoredToken()
	if (!skipContextHeaders && token && !nextConfig.headers.Authorization) {
		nextConfig.headers.Authorization = `Bearer ${token}`
	}

	const tenantCode = readStoredTenantCode()
	if (!skipContextHeaders && tenantCode && !nextConfig.headers['x-tenant-code']) {
		nextConfig.headers['x-tenant-code'] = tenantCode
	}

	return nextConfig
})

api.interceptors.response.use(
	(response) => response,
	(error) => {
		if (import.meta.env.DEV) {
			const method = String(error?.config?.method || 'GET').toUpperCase()
			const baseURL = String(error?.config?.baseURL || '')
			const urlPath = String(error?.config?.url || '')
			const status = error?.response?.status
			const responseBody = error?.response?.data
			const requestPayload = error?.config?.data

			console.error('[API ERROR]', {
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

export default api
