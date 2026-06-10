import { matchPath } from 'react-router-dom'
import { allModuleRoutes } from '../modules'
import { tenantStaticRoutes } from '../router/tenantStaticRoutes'

const TENANT_TITLE_KEYS = {
  siteTitle: 'tenantSiteTitle',
  titleSuffix: 'tenantTitleSuffix',
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizePathname(pathname) {
  const normalized = normalizeText(pathname)
  if (!normalized) return '/'
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function stripTenantPrefix(pathname) {
  const normalized = normalizePathname(pathname)
  const stripped = normalized.replace(/^\/t\/[^/]+(?=\/|$)/, '')
  return stripped || '/'
}

function countStaticSegments(path) {
  return normalizePathname(path)
    .split('/')
    .filter(Boolean)
    .filter((segment) => !segment.startsWith(':')).length
}

function countParamSegments(path) {
  return normalizePathname(path)
    .split('/')
    .filter(Boolean)
    .filter((segment) => segment.startsWith(':')).length
}

function readTenantTitleStateFromStorage() {
  return {
    siteTitle: normalizeText(localStorage.getItem(TENANT_TITLE_KEYS.siteTitle)),
    titleSuffix: normalizeText(localStorage.getItem(TENANT_TITLE_KEYS.titleSuffix)),
    tenantName: normalizeText(localStorage.getItem('tenantName')),
    tenantShortName: normalizeText(localStorage.getItem('tenantShortName')),
  }
}

export function resolveTenantDisplayName(tenant) {
  const resolvedTenant = tenant?.resolvedTenant || {}
  const currentTenant = tenant?.currentTenant || {}
  const storedTenant = readTenantTitleStateFromStorage()

  return normalizeText(resolvedTenant?.settings?.titleSuffix)
    || normalizeText(currentTenant?.settings?.titleSuffix)
    || normalizeText(resolvedTenant?.titleSuffix)
    || normalizeText(currentTenant?.titleSuffix)
    || storedTenant.titleSuffix
    || normalizeText(resolvedTenant?.settings?.siteTitle)
    || normalizeText(currentTenant?.settings?.siteTitle)
    || normalizeText(resolvedTenant?.siteTitle)
    || normalizeText(currentTenant?.siteTitle)
    || storedTenant.siteTitle
    || normalizeText(resolvedTenant?.tenantName)
    || normalizeText(currentTenant?.tenantName)
    || storedTenant.tenantName
    || storedTenant.tenantShortName
    || 'COGI'
}

export function setTenantPageTitle(pageTitle, tenant) {
  const routeTitle = normalizeText(pageTitle)
  const tenantDisplayName = resolveTenantDisplayName(tenant)

  document.title = routeTitle
    ? `${routeTitle} | ${tenantDisplayName}`
    : tenantDisplayName
}

export function resolveTenantRouteTitle(pathname) {
  const normalizedPathname = stripTenantPrefix(pathname)
  const routePool = [...tenantStaticRoutes, ...allModuleRoutes]

  const matches = routePool
    .filter((route) => normalizeText(route?.path))
    .map((route) => ({
      route,
      match: matchPath({ path: route.path, end: true }, normalizedPathname),
    }))
    .filter((entry) => entry.match)

  if (matches.length === 0) {
    return ''
  }

  matches.sort((left, right) => {
    const leftPath = normalizePathname(left.route.path)
    const rightPath = normalizePathname(right.route.path)
    const leftStaticSegments = countStaticSegments(leftPath)
    const rightStaticSegments = countStaticSegments(rightPath)
    if (leftStaticSegments !== rightStaticSegments) {
      return rightStaticSegments - leftStaticSegments
    }

    const leftParamSegments = countParamSegments(leftPath)
    const rightParamSegments = countParamSegments(rightPath)
    if (leftParamSegments !== rightParamSegments) {
      return leftParamSegments - rightParamSegments
    }

    return rightPath.length - leftPath.length
  })

  return normalizeText(matches[0]?.route?.title)
}

export function persistTenantTitleSettings(tenant) {
  const siteTitle = normalizeText(tenant?.siteTitle || tenant?.settings?.siteTitle)
  const titleSuffix = normalizeText(tenant?.titleSuffix || tenant?.settings?.titleSuffix)

  localStorage.setItem(TENANT_TITLE_KEYS.siteTitle, siteTitle)
  localStorage.setItem(TENANT_TITLE_KEYS.titleSuffix, titleSuffix)
}

export function clearTenantTitleSettings() {
  localStorage.removeItem(TENANT_TITLE_KEYS.siteTitle)
  localStorage.removeItem(TENANT_TITLE_KEYS.titleSuffix)
}