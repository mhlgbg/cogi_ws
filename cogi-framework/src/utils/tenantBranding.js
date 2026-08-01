import api from '../api/axios'
import { resolveMediaUrl } from './mediaUrl'

function isLocalhostBrowser() {
  if (typeof window === 'undefined') return false
  const hostname = String(window.location.hostname || '').trim().toLowerCase()
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function readTenantCodeFromPath() {
  if (typeof window === 'undefined') return ''

  const pathname = String(window.location.pathname || '').trim()
  const match = pathname.match(/^\/t\/([^/]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]).trim() : ''
}

function readKnownTenantCode() {
  if (typeof window === 'undefined') return ''
  return String(localStorage.getItem('tenantCode') || '').trim() || readTenantCodeFromPath()
}

function toAbsoluteUrl(url) {
  return resolveMediaUrl(url)
}

const ICON_SELECTOR = "link[rel='icon'], link[rel='shortcut icon']"
let defaultFaviconSnapshot = null

function snapshotDefaultFavicon() {
  if (typeof document === 'undefined') return null
  if (defaultFaviconSnapshot) return defaultFaviconSnapshot

  const favicon = document.querySelector(ICON_SELECTOR)
  defaultFaviconSnapshot = {
    href: String(favicon?.getAttribute('href') || '').trim(),
    type: String(favicon?.getAttribute('type') || '').trim(),
  }

  return defaultFaviconSnapshot
}

function listIconLinks() {
  if (typeof document === 'undefined') return []
  return Array.from(document.querySelectorAll(ICON_SELECTOR))
}

function ensurePrimaryIconLink() {
  if (typeof document === 'undefined') return null

  const links = listIconLinks()
  const primary = links[0] || document.createElement('link')
  if (!links[0]) {
    primary.setAttribute('rel', 'icon')
    document.head.appendChild(primary)
  }

  links.slice(1).forEach((link) => link.parentNode?.removeChild(link))
  return primary
}

function inferMimeType(url) {
  const raw = String(url || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw.endsWith('.svg')) return 'image/svg+xml'
  if (raw.endsWith('.png')) return 'image/png'
  if (raw.endsWith('.webp')) return 'image/webp'
  if (raw.endsWith('.ico')) return 'image/x-icon'
  return ''
}

function resolveMediaMime(media) {
  if (!media || typeof media !== 'object') return ''
  return String(
    media?.mime
    || media?.attributes?.mime
    || media?.data?.mime
    || media?.data?.attributes?.mime
    || media?.formats?.small?.mime
    || media?.formats?.thumbnail?.mime
    || '',
  ).trim()
}

function collectMediaCandidates(media) {
  const candidates = []

  const pushCandidate = (url, mime = '') => {
    const absoluteUrl = toAbsoluteUrl(url)
    if (!absoluteUrl) return
    if (candidates.some((item) => item.url === absoluteUrl)) return
    candidates.push({ url: absoluteUrl, mime: String(mime || '').trim() })
  }

  if (!media) return candidates
  if (typeof media === 'string') {
    pushCandidate(media)
    return candidates
  }

  pushCandidate(media?.formats?.small?.url, media?.formats?.small?.mime || media?.mime)
  pushCandidate(media?.formats?.thumbnail?.url, media?.formats?.thumbnail?.mime || media?.mime)
  pushCandidate(media?.resolvedUrl, resolveMediaMime(media))
  pushCandidate(media?.url, resolveMediaMime(media))
  pushCandidate(media?.attributes?.formats?.small?.url, media?.attributes?.formats?.small?.mime || media?.attributes?.mime)
  pushCandidate(media?.attributes?.formats?.thumbnail?.url, media?.attributes?.formats?.thumbnail?.mime || media?.attributes?.mime)
  pushCandidate(media?.attributes?.url, media?.attributes?.mime)
  pushCandidate(media?.data?.attributes?.formats?.small?.url, media?.data?.attributes?.formats?.small?.mime || media?.data?.attributes?.mime)
  pushCandidate(media?.data?.attributes?.formats?.thumbnail?.url, media?.data?.attributes?.formats?.thumbnail?.mime || media?.data?.attributes?.mime)
  pushCandidate(media?.data?.attributes?.url, media?.data?.attributes?.mime)
  pushCandidate(Array.isArray(media) ? media[0]?.url : '', Array.isArray(media) ? media[0]?.mime : '')

  return candidates
}

export function resolveTenantFavicon(tenant) {
  const faviconCandidates = collectMediaCandidates(
    tenant?.favicon
    || tenant?.tenantFavicon
    || tenant?.tenantFaviconUrl
    || tenant?.faviconUrl,
  )
  const logoCandidates = collectMediaCandidates(
    tenant?.logo
    || tenant?.tenantLogo
    || tenant?.tenantLogoUrl
    || tenant?.logoUrl,
  )

  return {
    primary: faviconCandidates[0] || null,
    fallback: logoCandidates[0] || null,
    candidates: [...faviconCandidates, ...logoCandidates],
  }
}

function preloadFavicon(url, options = {}) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }

    const nextUrl = String(url || '').trim()
    if (!nextUrl) {
      resolve(false)
      return
    }

    const image = new window.Image()
    const finish = (result) => {
      image.onload = null
      image.onerror = null
      resolve(result)
    }

    image.onload = () => finish(true)
    image.onerror = () => finish(false)
    if (typeof options?.isCancelled === 'function' && options.isCancelled()) {
      finish(false)
      return
    }
    image.src = nextUrl
  })
}

function setDocumentFavicon(candidate) {
  const snapshot = snapshotDefaultFavicon()
  const favicon = ensurePrimaryIconLink()
  if (!favicon) return

  const nextUrl = String(candidate?.url || '').trim()
  if (!nextUrl) {
    resetTenantFavicon()
    return
  }

  const nextType = String(candidate?.mime || inferMimeType(nextUrl) || '').trim()
  favicon.setAttribute('rel', 'icon')
  favicon.setAttribute('href', nextUrl)
  if (nextType) favicon.setAttribute('type', nextType)
  else if (snapshot?.type) favicon.removeAttribute('type')
}

export function resetTenantFavicon() {
  const snapshot = snapshotDefaultFavicon()
  const favicon = ensurePrimaryIconLink()
  if (!favicon || !snapshot?.href) return

  favicon.setAttribute('rel', 'icon')
  favicon.setAttribute('href', snapshot.href)
  if (snapshot.type) favicon.setAttribute('type', snapshot.type)
  else favicon.removeAttribute('type')
}

export async function applyTenantFavicon(tenant, options = {}) {
  const { candidates } = resolveTenantFavicon(tenant)
  if (!candidates.length) {
    resetTenantFavicon()
    return false
  }

  for (const candidate of candidates) {
    if (typeof options?.isCancelled === 'function' && options.isCancelled()) {
      return false
    }

    const ok = await preloadFavicon(candidate.url, options)
    if (typeof options?.isCancelled === 'function' && options.isCancelled()) {
      return false
    }
    if (!ok) continue

    setDocumentFavicon(candidate)
    return true
  }

  resetTenantFavicon()
  return false
}

export async function fetchTenantBranding() {
  if (!readKnownTenantCode() && isLocalhostBrowser()) {
    return {
      displayName: '',
      domain: '',
      logo: '',
      logoUrl: '',
      favicon: '',
      faviconUrl: '',
      siteTitle: '',
      defaultPageTitle: '',
      titleSuffix: '',
    }
  }

  const response = await api.get('/tenant/me')
  const payload = response?.data || {}

  return {
    displayName: String(payload?.displayName || '').trim(),
    domain: String(payload?.domain || '').trim(),
    logo: payload?.logo || '',
    logoUrl: toAbsoluteUrl(payload?.logo || ''),
    favicon: payload?.favicon || '',
    faviconUrl: toAbsoluteUrl(payload?.favicon || ''),
    siteTitle: String(payload?.siteTitle || '').trim(),
    defaultPageTitle: String(payload?.defaultPageTitle || '').trim(),
    titleSuffix: String(payload?.titleSuffix || '').trim(),
  }
}

export function setPageTitle(pageTitle, tenant) {
  const resolvedPageTitle = String(pageTitle || '').trim()
  const siteTitle = String(tenant?.siteTitle || '').trim()
  const defaultPageTitle = String(tenant?.defaultPageTitle || '').trim()
  const titleSuffix = String(tenant?.titleSuffix || '').trim()

  if (resolvedPageTitle) {
    document.title = `${resolvedPageTitle}${titleSuffix ? ` | ${titleSuffix}` : ''}`
    return
  }

  document.title = defaultPageTitle || siteTitle || 'Website'
}

export function applyTenantBranding(branding, fallbackTitle) {
  setPageTitle(fallbackTitle, branding)
  void applyTenantFavicon(branding)
}