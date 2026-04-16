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

export default function ProtectedRoute({ children, requireTenant = true }) {
  const auth = useAuth()
  const tenant = useTenant()
  const location = useLocation()
  const params = useParams()
  const requestedTenantCode = String(params?.tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim()
  const nextIsMainDomain = Boolean(tenant?.isMainDomain)

  if (!auth?.isAuthenticated) {
    return <Navigate to={buildLoginRedirectPath(requestedTenantCode, location, nextIsMainDomain)} replace />
  }

  if (requireTenant && !tenant?.hasTenant) {
    return <Navigate to={buildChooseTenantRedirectPath(requestedTenantCode, location)} replace />
  }

  return <>{children}</>
}