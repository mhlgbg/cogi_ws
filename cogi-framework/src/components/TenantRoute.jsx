import { useEffect, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'
import { buildTenantUrl } from '../utils/tenantRouting'

function buildLoginRedirectPath(tenantCode, location, isMainDomain) {
  const searchParams = new URLSearchParams()
  const redirectTarget = `${location.pathname || '/'}${location.search || ''}`
  if (redirectTarget.startsWith('/')) {
    searchParams.set('redirect', redirectTarget)
  }

  const loginPath = buildTenantUrl('/login', { tenantCode, isMainDomain }) || '/login'
  const query = searchParams.toString()
  return query ? `${loginPath}?${query}` : loginPath
}

function buildChooseTenantRedirectPath(tenantCode, location) {
  const searchParams = new URLSearchParams()
  const redirectTarget = `${location.pathname || '/'}${location.search || ''}`
  if (redirectTarget.startsWith('/')) {
    searchParams.set('redirect', redirectTarget)
  }

  const normalizedTenantCode = String(tenantCode || '').trim()
  if (normalizedTenantCode) {
    searchParams.set('tenantCode', normalizedTenantCode)
  }

  const query = searchParams.toString()
  return query ? `/choose-tenant?${query}` : '/choose-tenant'
}

export default function TenantRoute({ children, requireAuth = true }) {
  const auth = useAuth()
  const tenant = useTenant()
  const location = useLocation()
  const params = useParams()
  const [hasCheckedTenant, setHasCheckedTenant] = useState(false)
  const requestedTenantCode = String(params?.tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim()
  const nextIsMainDomain = Boolean(tenant?.isMainDomain)
  const isTenantEntryPath = location.pathname === '/' || (requestedTenantCode && location.pathname === `/t/${requestedTenantCode}`)

  useEffect(() => {
    let cancelled = false

    async function ensureTenant() {
      setHasCheckedTenant(false)
      await tenant?.resolveTenantAccess?.({ tenantCode: requestedTenantCode })
      if (!cancelled) {
        setHasCheckedTenant(true)
      }
    }

    ensureTenant()

    return () => {
      cancelled = true
    }
  }, [location.pathname, location.search, requestedTenantCode, tenant?.hasResolvedTenant, tenant?.hasTenant])

  if (tenant?.isResolvingTenant || !hasCheckedTenant) {
    return <div>Đang xác định tenant...</div>
  }

  if (isTenantEntryPath && tenant?.hasResolvedTenant) {
    const entryTarget = tenant?.resolvePublicRoutePath?.({
      tenantCode: requestedTenantCode,
      isMainDomain: nextIsMainDomain,
      fallbackToLogin: !auth?.isAuthenticated,
    })

    if (entryTarget && entryTarget !== location.pathname) {
      return <Navigate to={entryTarget} replace />
    }
  }

  if (!requireAuth) {
    return <>{children}</>
  }

  if (requireAuth && !auth?.isAuthenticated) {
    return <Navigate to={buildLoginRedirectPath(requestedTenantCode, location, nextIsMainDomain)} replace />
  }

  if (!tenant?.hasResolvedTenant) {
    if (auth?.isAuthenticated) {
      return <Navigate to={buildChooseTenantRedirectPath(requestedTenantCode, location)} replace />
    }

    return <Navigate to={buildLoginRedirectPath(requestedTenantCode, location, nextIsMainDomain)} replace />
  }

  if (requireAuth && !tenant?.hasTenant) {
    return <Navigate to={buildChooseTenantRedirectPath(requestedTenantCode, location)} replace />
  }

  return <>{children}</>
}
