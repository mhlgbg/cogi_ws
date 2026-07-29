import axios from 'axios'

function resolvePublicApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim()

  if (typeof window !== 'undefined') {
    const hostname = String(window.location.hostname || '').trim().toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:1339/api'
    }
  }

  return configured || 'http://localhost:1339/api'
}

const publicApiBaseUrl = resolvePublicApiBaseUrl()

const publicApi = axios.create({
  baseURL: publicApiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default publicApi