import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'
import { buildTenantUrl, isBrowserOnMainDomain } from '../utils/tenantRouting'

const TenantContext = createContext(null)

function normalizePath(path) {
  const rawPath = String(path || '').trim()
  if (!rawPath) return ''
  if (/^https?:\/\//i.test(rawPath)) {
    try {
      return new URL(rawPath).pathname || '/'
    } catch {
      return rawPath
    }
  }

  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`
}

function isPublicOrAuthPath(path) {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) return false

  if (
    normalizedPath === '/'
    || normalizedPath === '/login'
    || normalizedPath === '/forgot-password'
    || normalizedPath === '/reset-password'
    || normalizedPath === '/activate'
    || normalizedPath === '/set-password'
  ) {
    return true
  }

  return normalizedPath === '/dang-ky-tuyen-sinh' || normalizedPath.startsWith('/dang-ky-tuyen-sinh/')
}

function resolveApiOrigin() {
  const explicitBase = String(import.meta.env.VITE_API_BASE_URL || '').trim()
  if (explicitBase) {
    const normalized = explicitBase.replace(/\/+$/, '')
    return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized
  }

  return 'http://localhost:1339'
}

function toAbsoluteUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (!raw.startsWith('/')) return raw
  return `${resolveApiOrigin()}${raw}`
}

function extractTenantLogoUrlFromMedia(logo) {
  if (!logo) return ''

  const direct = toAbsoluteUrl(logo?.url)
  if (direct) return direct

  const attrs = toAbsoluteUrl(logo?.attributes?.url)
  if (attrs) return attrs

  const dataDirect = toAbsoluteUrl(logo?.data?.url)
  if (dataDirect) return dataDirect

  const dataAttrs = toAbsoluteUrl(logo?.data?.attributes?.url)
  if (dataAttrs) return dataAttrs

  const firstArray = toAbsoluteUrl(Array.isArray(logo) ? logo[0]?.url : '')
  if (firstArray) return firstArray

  return ''
}

function readTenantFromStorage() {
  const tenantCode = localStorage.getItem('tenantCode')
  const tenantName = localStorage.getItem('tenantName')
  const tenantShortName = localStorage.getItem('tenantShortName')
  const tenantLogoUrl = localStorage.getItem('tenantLogoUrl')
  const tenantLogoRaw = localStorage.getItem('tenantLogo')
  const tenantIdRaw = localStorage.getItem('tenantId')
  const userTenantIdRaw = localStorage.getItem('userTenantId')
  const defaultFeatureCode = localStorage.getItem('defaultFeatureCode')
  const defaultPublicRoute = localStorage.getItem('defaultPublicRoute')
  const defaultProtectedRoute = localStorage.getItem('defaultProtectedRoute')
  const isMainDomainRaw = localStorage.getItem('isMainDomain')
  const tenantRolesRaw = localStorage.getItem('tenantRoles')

  if (!tenantCode || !tenantName || !tenantIdRaw || !userTenantIdRaw) {
    return null
  }

  const tenantId = Number(tenantIdRaw)
  const userTenantId = Number(userTenantIdRaw)
  if (!Number.isFinite(tenantId) || !Number.isFinite(userTenantId)) {
    return null
  }

  let roles = []
  if (tenantRolesRaw) {
    try {
      const parsedRoles = JSON.parse(tenantRolesRaw)
      roles = Array.isArray(parsedRoles) ? parsedRoles : []
    } catch {
      roles = []
    }
  }

  let tenantLogo = null
  if (tenantLogoRaw) {
    try {
      tenantLogo = JSON.parse(tenantLogoRaw)
    } catch {
      tenantLogo = null
    }
  }

  const normalizedTenantLogoUrl = toAbsoluteUrl(tenantLogoUrl) || extractTenantLogoUrlFromMedia(tenantLogo)

  return {
    tenantCode,
    tenantName,
    tenantShortName: tenantShortName || '',
    tenantLogo: tenantLogo || null,
    tenantLogoUrl: normalizedTenantLogoUrl,
    tenantId,
    userTenantId,
    defaultFeatureCode: defaultFeatureCode || '',
    defaultPublicRoute: defaultPublicRoute || '',
    defaultProtectedRoute: defaultProtectedRoute || '',
    isMainDomain: isMainDomainRaw === 'true' || isBrowserOnMainDomain(),
    roles,
  }
}

function normalizeTenantContextPayload(payload) {
  return {
    tenantCode: String(payload?.code || '').trim(),
    tenantName: String(payload?.name || payload?.displayName || '').trim(),
    tenantLogoUrl: toAbsoluteUrl(payload?.logo || ''),
    defaultPublicRoute: String(payload?.defaultPublicRoute || '').trim(),
    defaultProtectedRoute: String(payload?.defaultProtectedRoute || '').trim(),
    isMainDomain: isBrowserOnMainDomain(),
  }
}

function mergeTenantState(baseTenant, resolvedTenant) {
  const base = baseTenant && typeof baseTenant === 'object' ? baseTenant : {}
  const resolved = resolvedTenant && typeof resolvedTenant === 'object' ? resolvedTenant : {}

  return {
    tenantCode: String(resolved.tenantCode || base.tenantCode || '').trim(),
    tenantName: String(resolved.tenantName || base.tenantName || '').trim(),
    tenantShortName: String(base.tenantShortName || '').trim(),
    tenantLogo: base.tenantLogo || null,
    tenantLogoUrl: toAbsoluteUrl(resolved.tenantLogoUrl || base.tenantLogoUrl || ''),
    tenantId: Number(base.tenantId),
    userTenantId: Number(base.userTenantId),
    defaultFeatureCode: String(base.defaultFeatureCode || '').trim(),
    defaultPublicRoute: String(resolved.defaultPublicRoute || base.defaultPublicRoute || '').trim(),
    defaultProtectedRoute: String(resolved.defaultProtectedRoute || base.defaultProtectedRoute || '').trim(),
    isMainDomain: typeof resolved.isMainDomain === 'boolean' ? resolved.isMainDomain : Boolean(base.isMainDomain),
    roles: Array.isArray(base.roles) ? base.roles : [],
  }
}

export function useTenant() {
  return useContext(TenantContext)
}

export default function TenantContextProvider({ children }) {
  const auth = useAuth()
  const [currentTenant, setCurrentTenant] = useState(() => readTenantFromStorage())
  const [resolvedTenant, setResolvedTenant] = useState(() => readTenantFromStorage())
  const [isResolvingTenant, setIsResolvingTenant] = useState(false)
  const [isMainDomain, setIsMainDomain] = useState(() => readTenantFromStorage()?.isMainDomain ?? isBrowserOnMainDomain())

  const selectTenant = (tenantContextItem) => {
    const nextTenant = {
      tenantCode: String(tenantContextItem?.tenantCode || '').trim(),
      tenantName: String(tenantContextItem?.tenantName || '').trim(),
      tenantShortName: String(tenantContextItem?.tenantShortName || '').trim(),
      tenantLogo: tenantContextItem?.tenantLogo || null,
      tenantLogoUrl: toAbsoluteUrl(tenantContextItem?.tenantLogoUrl || '') || extractTenantLogoUrlFromMedia(tenantContextItem?.tenantLogo),
      tenantId: Number(tenantContextItem?.tenantId),
      userTenantId: Number(tenantContextItem?.userTenantId),
      defaultFeatureCode: String(tenantContextItem?.defaultFeatureCode || '').trim(),
      defaultPublicRoute: String(tenantContextItem?.defaultPublicRoute || '').trim(),
      defaultProtectedRoute: String(tenantContextItem?.defaultProtectedRoute || '').trim(),
      isMainDomain: isBrowserOnMainDomain(),
      roles: Array.isArray(tenantContextItem?.roles) ? tenantContextItem.roles : [],
    }

    if (
      !nextTenant.tenantCode
      || !nextTenant.tenantName
      || !Number.isFinite(nextTenant.tenantId)
      || !Number.isFinite(nextTenant.userTenantId)
    ) {
      return
    }

    localStorage.setItem('tenantCode', nextTenant.tenantCode)
    localStorage.setItem('tenantName', nextTenant.tenantName)
    localStorage.setItem('tenantShortName', nextTenant.tenantShortName)
    localStorage.setItem('tenantLogoUrl', nextTenant.tenantLogoUrl)
    localStorage.setItem('tenantLogo', JSON.stringify(nextTenant.tenantLogo || null))
    localStorage.setItem('tenantId', String(nextTenant.tenantId))
    localStorage.setItem('userTenantId', String(nextTenant.userTenantId))
    localStorage.setItem('defaultFeatureCode', nextTenant.defaultFeatureCode)
    localStorage.setItem('defaultPublicRoute', nextTenant.defaultPublicRoute)
    localStorage.setItem('defaultProtectedRoute', nextTenant.defaultProtectedRoute)
    localStorage.setItem('isMainDomain', String(nextTenant.isMainDomain))
    localStorage.setItem('tenantRoles', JSON.stringify(nextTenant.roles))

    setCurrentTenant(nextTenant)
    setResolvedTenant((previous) => mergeTenantState(nextTenant, previous))
    setIsMainDomain(nextTenant.isMainDomain)
  }

  const clearTenant = () => {
    localStorage.removeItem('tenantCode')
    localStorage.removeItem('tenantName')
    localStorage.removeItem('tenantShortName')
    localStorage.removeItem('tenantLogoUrl')
    localStorage.removeItem('tenantLogo')
    localStorage.removeItem('tenantId')
    localStorage.removeItem('userTenantId')
    localStorage.removeItem('defaultFeatureCode')
    localStorage.removeItem('defaultPublicRoute')
    localStorage.removeItem('defaultProtectedRoute')
    localStorage.removeItem('isMainDomain')
    localStorage.removeItem('tenantRoles')
    localStorage.removeItem('featureContext')
    setCurrentTenant(null)
    setResolvedTenant(null)
    setIsMainDomain(isBrowserOnMainDomain())
  }

  async function resolveTenantAccess(options = {}) {
    setIsResolvingTenant(true)

    try {
      const requestedTenantCode = String(options?.tenantCode || '').trim()
      const requestConfig = requestedTenantCode
        ? {
          headers: {
            'x-tenant-code': requestedTenantCode,
          },
        }
        : undefined

      const response = await api.get('/tenant-context', requestConfig)
      const resolved = normalizeTenantContextPayload(response?.data)
      if (!resolved.tenantCode) {
        setResolvedTenant((previous) => previous || null)
        return null
      }

      setIsMainDomain(isBrowserOnMainDomain())

      setResolvedTenant((previous) => mergeTenantState(currentTenant || previous, resolved))

      setCurrentTenant((previous) => {
        if (!previous) return previous
        if (String(previous.tenantCode || '').trim().toLowerCase() !== resolved.tenantCode.toLowerCase()) {
          return previous
        }

        const nextTenant = mergeTenantState(previous, resolved)
        localStorage.setItem('tenantName', nextTenant.tenantName)
        localStorage.setItem('tenantLogoUrl', nextTenant.tenantLogoUrl)
        localStorage.setItem('defaultPublicRoute', nextTenant.defaultPublicRoute)
        localStorage.setItem('defaultProtectedRoute', nextTenant.defaultProtectedRoute)
        localStorage.setItem('isMainDomain', String(nextTenant.isMainDomain))
        return nextTenant
      })

      return resolved
    } catch {
      setResolvedTenant((previous) => previous || currentTenant || null)
      return null
    } finally {
      setIsResolvingTenant(false)
    }
  }

  function resolvePublicRoutePath(options = {}) {
    const sourceTenant = resolvedTenant || currentTenant || {}
    const tenantCode = String(options?.tenantCode || sourceTenant?.tenantCode || '').trim()
    const fallbackToLogin = Boolean(options?.fallbackToLogin)
    const configuredPath = String(sourceTenant?.defaultPublicRoute || '').trim()
    const nextIsMainDomain = typeof options?.isMainDomain === 'boolean' ? options.isMainDomain : isMainDomain

    if (configuredPath) {
      return buildTenantUrl(configuredPath, { tenantCode, isMainDomain: nextIsMainDomain })
    }

    if (fallbackToLogin) {
      return buildTenantUrl('/login', { tenantCode, isMainDomain: nextIsMainDomain })
    }

    return buildTenantUrl('/', { tenantCode, isMainDomain: nextIsMainDomain })
  }

  function resolveProtectedRoutePath(options = {}) {
    const sourceTenant = currentTenant || resolvedTenant || {}
    const tenantCode = String(options?.tenantCode || sourceTenant?.tenantCode || '').trim()
    const nextIsMainDomain = typeof options?.isMainDomain === 'boolean' ? options.isMainDomain : isMainDomain
    const configuredProtectedPath = String(sourceTenant?.defaultProtectedRoute || '').trim()
    const configuredFeaturePath = String(sourceTenant?.defaultFeatureCode || '').trim()
    const nextPath = !isPublicOrAuthPath(configuredProtectedPath) && configuredProtectedPath
      ? configuredProtectedPath
      : configuredFeaturePath || '/dashboard'
    const shouldForceTenantPath = Boolean(options?.forceTenantPath)

    return buildTenantUrl(nextPath, {
      tenantCode,
      isMainDomain: shouldForceTenantPath ? nextIsMainDomain : false,
    })
  }

  useEffect(() => {
    if (!auth?.isAuthenticated) {
      clearTenant()
    }
  }, [auth?.isAuthenticated])

  useEffect(() => {
    let cancelled = false

    async function hydrateTenantContext() {
      if (!currentTenant?.tenantCode) {
        return
      }

      try {
        setIsResolvingTenant(true)
        const response = await api.get('/tenant-context', {
          headers: currentTenant?.tenantCode
            ? {
              'x-tenant-code': currentTenant.tenantCode,
            }
            : undefined,
        })
        if (cancelled) return

        const resolved = normalizeTenantContextPayload(response?.data)
        if (!resolved.tenantCode) {
          return
        }

        setIsMainDomain(isBrowserOnMainDomain())

        setResolvedTenant((previous) => mergeTenantState(currentTenant || previous, resolved))

        setCurrentTenant((previous) => {
          if (!previous) return previous
          if (String(previous.tenantCode || '').trim().toLowerCase() !== resolved.tenantCode.toLowerCase()) {
            return previous
          }

          const nextTenant = {
            ...previous,
            tenantName: resolved.tenantName || previous.tenantName,
            tenantLogoUrl: resolved.tenantLogoUrl || previous.tenantLogoUrl,
            defaultPublicRoute: resolved.defaultPublicRoute || previous.defaultPublicRoute,
            defaultProtectedRoute: resolved.defaultProtectedRoute || previous.defaultProtectedRoute,
          }

          localStorage.setItem('tenantName', nextTenant.tenantName)
          localStorage.setItem('tenantLogoUrl', nextTenant.tenantLogoUrl)
          localStorage.setItem('defaultPublicRoute', nextTenant.defaultPublicRoute)
          localStorage.setItem('defaultProtectedRoute', nextTenant.defaultProtectedRoute)
          localStorage.setItem('isMainDomain', String(nextTenant.isMainDomain))

          return nextTenant
        })
      } catch {
        // Keep existing selected tenant state if tenant-context hydration fails.
      } finally {
        if (!cancelled) {
          setIsResolvingTenant(false)
        }
      }
    }

    hydrateTenantContext()

    return () => {
      cancelled = true
    }
  }, [currentTenant?.tenantCode])

  const value = useMemo(
    () => ({
      currentTenant,
      resolvedTenant,
      hasTenant: Boolean(currentTenant?.tenantCode),
      hasResolvedTenant: Boolean(resolvedTenant?.tenantCode || currentTenant?.tenantCode),
      isResolvingTenant,
      isMainDomain,
      resolveTenantAccess,
      resolvePublicRoutePath,
      resolveProtectedRoutePath,
      selectTenant,
      clearTenant,
    }),
    [currentTenant, resolvedTenant, isResolvingTenant, isMainDomain],
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export { TenantContext }