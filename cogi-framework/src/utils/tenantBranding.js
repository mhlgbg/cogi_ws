import api from '../api/axios'
import { resolveMediaUrl } from './mediaUrl'

function toAbsoluteUrl(url) {
  return resolveMediaUrl(url)
}

export async function fetchTenantBranding() {
  const response = await api.get('/tenant/me')
  const payload = response?.data || {}

  return {
    displayName: String(payload?.displayName || '').trim(),
    domain: String(payload?.domain || '').trim(),
    logo: toAbsoluteUrl(payload?.logo || ''),
    favicon: toAbsoluteUrl(payload?.favicon || payload?.logo || ''),
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

  const faviconUrl = String(branding?.favicon || branding?.logo || '').trim()
  if (!faviconUrl) return

  let favicon = document.querySelector("link[rel='icon']")
  if (!favicon) {
    favicon = document.createElement('link')
    favicon.setAttribute('rel', 'icon')
    document.head.appendChild(favicon)
  }

  favicon.setAttribute('href', faviconUrl)
}