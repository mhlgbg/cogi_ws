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