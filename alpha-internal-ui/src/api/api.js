import axios from "axios"

function normalizeApiBaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl

  try {
    const parsed = new URL(rawUrl)
    const path = parsed.pathname.replace(/\/+$/, "")

    if (!path || path === "/") {
      parsed.pathname = "/api"
      return parsed.toString().replace(/\/$/, "")
    }

    return parsed.toString().replace(/\/$/, "")
  } catch {
    return rawUrl
  }
}

const AUTH_HEADER_EXCLUDED_PATHS = new Set([
  "/api/auth/local",
  "/api/auth/activate",
  "/api/auth/reset-password",
  "/api/auth/forgot-password",
])

function shouldSkipAuthHeader(url) {
  if (!url) return false

  let pathname = ""
  try {
    pathname = new URL(url, "http://localhost").pathname
  } catch {
    return false
  }

  const normalizedPath = pathname.replace(/\/+$/, "") || "/"
  const apiPathVariant = normalizedPath.startsWith("/api")
    ? normalizedPath
    : `/api${normalizedPath}`

  return (
    AUTH_HEADER_EXCLUDED_PATHS.has(normalizedPath) ||
    AUTH_HEADER_EXCLUDED_PATHS.has(apiPathVariant)
  )
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token && !shouldSkipAuthHeader(config.url)) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("token")
      localStorage.removeItem("me")
      localStorage.removeItem("permissionKeys")
      localStorage.removeItem("iamRole")
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login"
      }
    }
    return Promise.reject(err)
  }
)

export default api
