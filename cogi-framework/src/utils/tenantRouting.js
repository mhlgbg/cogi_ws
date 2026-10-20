function normalizeHost(host) {
  const rawHost = String(host || '').trim().toLowerCase()
  if (!rawHost) return ''

  const withoutProtocol = rawHost.replace(/^https?:\/\//, '')
  const firstHost = withoutProtocol.split('/')[0]?.split(',')[0]?.trim() || ''
  if (!firstHost) return ''

  if (firstHost.startsWith('[')) {
    const endBracketIndex = firstHost.indexOf(']')
    return endBracketIndex > 0 ? firstHost.slice(1, endBracketIndex) : firstHost
  }

  const colonIndex = firstHost.indexOf(':')
  return colonIndex > -1 ? firstHost.slice(0, colonIndex) : firstHost
}

export function getMainDomain() {
  return normalizeHost(import.meta.env.VITE_MAIN_DOMAIN || import.meta.env.MAIN_DOMAIN || '')
}

export function isBrowserOnMainDomain() {
  const configuredMainDomain = getMainDomain()
  if (!configuredMainDomain || typeof window === 'undefined') return false
  return normalizeHost(window.location.host) === configuredMainDomain
}

function normalizeInternalPath(path) {
  const rawPath = String(path || '').trim()
  if (!rawPath) return ''
  if (/^https?:\/\//i.test(rawPath)) return rawPath
  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`
}

export function buildTenantUrl(path, options = {}) {
  const normalizedPath = normalizeInternalPath(path)
  if (!normalizedPath || /^https?:\/\//i.test(normalizedPath)) return normalizedPath

  const tenantCode = String(options?.tenantCode || '').trim()
  const isMainDomain = Boolean(options?.isMainDomain)
  if (!isMainDomain || !tenantCode) {
    return normalizedPath
  }

  const tenantPrefix = `/t/${encodeURIComponent(tenantCode)}`
  if (normalizedPath === tenantPrefix || normalizedPath.startsWith(`${tenantPrefix}/`)) {
    return normalizedPath
  }

  if (normalizedPath === '/') {
    return tenantPrefix
  }

  return `${tenantPrefix}${normalizedPath}`
}

function isSafeTenantHomeUrl(value) {
  const rawUrl = String(value || '').trim()
  if (!rawUrl) return false
  if (rawUrl.startsWith('//')) return false

  const lowerUrl = rawUrl.toLowerCase()
  if (/^(javascript:|data:|vbscript:)/i.test(lowerUrl)) return false

  const schemeMatch = lowerUrl.match(/^([a-z][a-z0-9+.-]*):/)
  if (schemeMatch && !/^https?:$/.test(schemeMatch[1])) return false

  return /^https?:\/\//i.test(rawUrl)
    || rawUrl.startsWith('/')
    || rawUrl.startsWith('./')
    || rawUrl.startsWith('../')
}

export function resolveTenantHomeLink(config = {}, options = {}) {
  const source = config && typeof config === 'object' ? config : {}
  const settings = source.settings && typeof source.settings === 'object' ? source.settings : {}
  const nested = source.tenantHomeLink && typeof source.tenantHomeLink === 'object' ? source.tenantHomeLink : settings.tenantHomeLink
  const homeLink = nested && typeof nested === 'object' ? nested : (source.tenantHomeLink || source.homeLink || settings.homeLink || {})
  const enabled = homeLink.enabled !== false
  const url = String(homeLink.url || homeLink.homeUrl || '').trim()
  if (!enabled || !url || !isSafeTenantHomeUrl(url)) {
    return null
  }

  const tenantCode = String(options?.tenantCode || source.tenantCode || '').trim()
  const isMainDomain = typeof options?.isMainDomain === 'boolean' ? options.isMainDomain : Boolean(source.isMainDomain)

  const resolvedUrl = /^https?:\/\//i.test(url)
    ? url
    : buildTenantUrl(url, { tenantCode, isMainDomain }) || url

  return {
    enabled: true,
    url: resolvedUrl,
    label: String(homeLink.label || 'Về trang chủ').trim() || 'Về trang chủ',
    logoClickable: homeLink.logoClickable !== false,
    showInSidebar: homeLink.showInSidebar !== false,
    showInCommunityHeader: homeLink.showInCommunityHeader !== false,
  }
}