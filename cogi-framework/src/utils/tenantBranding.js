import api from '../api/axios'

function toAbsoluteUrl(url) {
  const rawUrl = String(url || '').trim()
  if (!rawUrl) return ''
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl

  try {
    const apiBase = String(api.defaults.baseURL || window.location.origin)
    const origin = new URL(apiBase, window.location.origin).origin
    return new URL(rawUrl, origin).toString()
  } catch {
    return rawUrl
  }
}

export async function fetchTenantBranding() {
  const response = await api.get('/tenant/me')
  const payload = response?.data || {}

  return {
    displayName: String(payload?.displayName || '').trim(),
    domain: String(payload?.domain || '').trim(),
    logo: toAbsoluteUrl(payload?.logo || ''),
  }
}

export function applyTenantBranding(branding, fallbackTitle) {
  const displayName = String(branding?.displayName || '').trim()
  const domain = String(branding?.domain || '').trim()
  const resolvedTitle = displayName || domain || fallbackTitle

  if (resolvedTitle) {
    document.title = resolvedTitle
  }

  const logoUrl = String(branding?.logo || '').trim()
  if (!logoUrl) return

  let favicon = document.querySelector("link[rel='icon']")
  if (!favicon) {
    favicon = document.createElement('link')
    favicon.setAttribute('rel', 'icon')
    document.head.appendChild(favicon)
  }

  favicon.setAttribute('href', logoUrl)
}