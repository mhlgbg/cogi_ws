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