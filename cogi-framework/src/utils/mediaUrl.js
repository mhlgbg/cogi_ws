import api from '../api/axios'

function getWindowOrigin() {
  if (typeof window === 'undefined') {
    return 'http://localhost'
  }

  return String(window.location.origin || 'http://localhost')
}

export function getApiOrigin() {
  try {
    const apiBase = String(api.defaults.baseURL || getWindowOrigin()).trim()
    return new URL(apiBase, getWindowOrigin()).origin
  } catch {
    return getWindowOrigin()
  }
}

export function toAbsoluteUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw

  try {
    return new URL(raw, getApiOrigin()).toString()
  } catch {
    return raw
  }
}

export function resolveMediaUrl(url) {
  return toAbsoluteUrl(url)
}

function readStoredJwt() {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem('authJwt') || '').trim()
}

function readAdmissionV1SessionToken() {
  if (typeof window === 'undefined') return ''

  const pathname = String(window.location.pathname || '').trim()
  const tenantMatch = pathname.match(/^\/t\/([^/]+)\/dang-ky-tuyen-sinh-v1\/([^/]+)/i)
  const directMatch = pathname.match(/^\/dang-ky-tuyen-sinh-v1\/([^/]+)/i)

  let tenantCode = ''
  let campaignCode = ''

  if (tenantMatch) {
    tenantCode = decodeURIComponent(String(tenantMatch[1] || '').trim()).toLowerCase()
    campaignCode = decodeURIComponent(String(tenantMatch[2] || '').trim()).toLowerCase()
  } else if (directMatch) {
    campaignCode = decodeURIComponent(String(directMatch[1] || '').trim()).toLowerCase()
  }

  if (!campaignCode) return ''

  const storageKey = `admission-v1-session:${tenantCode}:${campaignCode}`
  return String(window.sessionStorage.getItem(storageKey) || '').trim()
}

export function buildProtectedFileUrl(fileMeta) {
  if (!fileMeta || typeof fileMeta !== 'object') {
    return resolveMediaUrl(fileMeta)
  }

  const rawUrl = String(fileMeta.url || fileMeta.dataUrl || '').trim()
  const fileAssetId = Number(fileMeta.fileAssetId || 0)
  const storageProvider = String(fileMeta.storageProvider || '').trim().toLowerCase()

  if (!rawUrl) return ''
  if (!rawUrl.startsWith('/storage/')) return resolveMediaUrl(rawUrl)
  if (!Number.isInteger(fileAssetId) || fileAssetId <= 0) return resolveMediaUrl(rawUrl)
  if (storageProvider && storageProvider !== 'local') return resolveMediaUrl(rawUrl)

  const jwt = readStoredJwt()
  if (jwt) {
    return toAbsoluteUrl(`/api/storage/files/${fileAssetId}/download?jwt=${encodeURIComponent(jwt)}`)
  }

  const admissionToken = readAdmissionV1SessionToken()
  if (admissionToken) {
    return toAbsoluteUrl(`/api/storage/files/${fileAssetId}/download?token=${encodeURIComponent(admissionToken)}`)
  }

  return resolveMediaUrl(rawUrl)
}

export function isDataUrl(url) {
  return /^data:/i.test(String(url || '').trim())
}

export async function createObjectUrlFromUrl(url) {
  const nextUrl = String(url || '').trim()
  if (!nextUrl || typeof window === 'undefined') return ''

  const response = await fetch(nextUrl, { credentials: 'include' })
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status}`)
  }

  const blob = await response.blob()
  return window.URL.createObjectURL(blob)
}

export async function createObjectUrlFromDataUrl(url) {
  const nextUrl = String(url || '').trim()
  if (!isDataUrl(nextUrl) || typeof window === 'undefined') return ''

  return createObjectUrlFromUrl(nextUrl)
}

export async function openUrlInNewTab(url) {
  const nextUrl = String(url || '').trim()
  if (!nextUrl || typeof window === 'undefined') return false

  if (!isDataUrl(nextUrl)) {
    const openedWindow = window.open(nextUrl, '_blank')
    if (openedWindow) {
      openedWindow.opener = null
      return true
    }

    return false
  }

  const openedWindow = window.open('', '_blank')
  if (openedWindow) {
    openedWindow.opener = null
  }

  try {
    const objectUrl = await createObjectUrlFromDataUrl(nextUrl)
    if (!objectUrl) {
      if (openedWindow && !openedWindow.closed) {
        openedWindow.close()
      }

      return false
    }

    if (openedWindow) {
      openedWindow.location.replace(objectUrl)
    } else {
      const fallbackWindow = window.open(objectUrl, '_blank')
      if (fallbackWindow) {
        fallbackWindow.opener = null
      }
    }

    window.setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl)
    }, 60000)

    return true
  } catch {
    if (openedWindow && !openedWindow.closed) {
      openedWindow.close()
    }

    return false
  }
}