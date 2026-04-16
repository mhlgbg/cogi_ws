import { useEffect } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'
import { buildTenantUrl } from '../utils/tenantRouting'

function buildLoginFallbackPath(tenantCode, isMainDomain) {
  return buildTenantUrl('/login', { tenantCode, isMainDomain }) || '/login'
}

function buildChooseTenantFallbackPath(tenantCode) {
  const searchParams = new URLSearchParams()
  const normalizedTenantCode = String(tenantCode || '').trim()
  if (normalizedTenantCode) {
    searchParams.set('tenantCode', normalizedTenantCode)
  }

  const query = searchParams.toString()
  return query ? `/choose-tenant?${query}` : '/choose-tenant'
}

export default function TenantEntryRedirect() {
  const auth = useAuth()
  const tenant = useTenant()
  const location = useLocation()
  const params = useParams()

  const requestedTenantCode = String(params?.tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim()
  const nextIsMainDomain = Boolean(tenant?.isMainDomain)

  useEffect(() => {
    if (!tenant?.hasResolvedTenant && !tenant?.isResolvingTenant) {
      tenant?.resolveTenantAccess?.(requestedTenantCode ? { tenantCode: requestedTenantCode } : {})
    }
  }, [requestedTenantCode, tenant?.hasResolvedTenant, tenant?.isResolvingTenant])

  if (tenant?.isResolvingTenant) {
    return <div>Đang xác định tenant...</div>
  }

  if (!tenant?.hasResolvedTenant) {
    if (auth?.isAuthenticated) {
      return <Navigate to={buildChooseTenantFallbackPath(requestedTenantCode)} replace />
    }

    return <Navigate to={buildLoginFallbackPath(requestedTenantCode, nextIsMainDomain)} replace />
  }

  const targetPath = tenant?.resolvePublicRoutePath?.({
    tenantCode: requestedTenantCode,
    isMainDomain: nextIsMainDomain,
    fallbackToLogin: true,
  })

  if (!targetPath || targetPath === location.pathname) {
    return <Navigate to={buildLoginFallbackPath(requestedTenantCode, nextIsMainDomain)} replace />
  }

  return <Navigate to={targetPath} replace />
}