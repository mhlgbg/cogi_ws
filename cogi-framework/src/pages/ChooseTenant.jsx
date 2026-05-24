import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'
import { resolveMediaUrl } from '../utils/mediaUrl'
import { buildTenantUrl } from '../utils/tenantRouting'

let chooseTenantEffectRuns = 0
let chooseTenantRequestRuns = 0

function resolveApiOrigin() {
  const explicitBase = String(import.meta.env.VITE_API_BASE_URL || '').trim()
  if (explicitBase) {
    const normalized = explicitBase.replace(/\/+$/, '')
    return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized
  }

  return 'http://localhost:1339'
}

function toAbsoluteUrl(url) {
  return resolveMediaUrl(url)
}

function extractTenantLogoUrl(tenant) {
  const directFromMedia = toAbsoluteUrl(tenant?.logo?.url)
  if (directFromMedia) return directFromMedia

  const directFromMediaAttrs = toAbsoluteUrl(tenant?.logo?.attributes?.url)
  if (directFromMediaAttrs) return directFromMediaAttrs

  const firstFromMediaArray = toAbsoluteUrl(Array.isArray(tenant?.logo) ? tenant.logo[0]?.url : '')
  if (firstFromMediaArray) return firstFromMediaArray

  const direct = toAbsoluteUrl(tenant?.logoUrl)
  if (direct) return direct

  const fromLogoUrl = toAbsoluteUrl(tenant?.logo?.url)
  if (fromLogoUrl) return fromLogoUrl

  const fromLogoDataUrl = toAbsoluteUrl(tenant?.logo?.data?.url)
  if (fromLogoDataUrl) return fromLogoDataUrl

  const fromLogoDataAttrs = toAbsoluteUrl(tenant?.logo?.data?.attributes?.url)
  if (fromLogoDataAttrs) return fromLogoDataAttrs

  const fromLogoAttrs = toAbsoluteUrl(tenant?.logo?.attributes?.url)
  if (fromLogoAttrs) return fromLogoAttrs

  return ''
}

function toInitials(input) {
  const text = String(input || '').trim()
  if (!text) return 'T'
  const parts = text.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'T'
}

function mapTenantForContext(item) {
  const tenant = item?.tenant || {}
  return {
    tenantCode: tenant?.code || '',
    tenantName: tenant?.name || tenant?.label || '',
    tenantShortName: tenant?.shortName || '',
    tenantLogo: tenant?.logo || null,
    tenantLogoUrl: extractTenantLogoUrl(tenant),
    tenantId: tenant?.id,
    userTenantId: item?.userTenantId,
    defaultFeatureCode: tenant?.defaultFeatureCode || '',
    defaultPublicRoute: tenant?.defaultPublicRoute || '',
    defaultProtectedRoute: tenant?.defaultProtectedRoute || '',
    isMainDomain: item?.isMainDomain,
    roles: Array.isArray(item?.roles) ? item.roles : [],
  }
}

function resolveTenantLandingPath(tenantItem) {
  const defaultProtectedRoute = String(tenantItem?.defaultProtectedRoute || '').trim()
  if (defaultProtectedRoute.startsWith('/')) return defaultProtectedRoute

  const routePath = String(tenantItem?.defaultFeatureCode || '').trim()
  return routePath.startsWith('/') ? routePath : '/dashboard'
}

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

function buildLoginPath(tenantCode, redirectPath, isMainDomain) {
  const searchParams = new URLSearchParams()
  const normalizedRedirectPath = String(redirectPath || '').trim()
  if (normalizedRedirectPath && normalizedRedirectPath.startsWith('/')) {
    searchParams.set('redirect', normalizedRedirectPath)
  }

  const loginPath = buildTenantUrl('/login', { tenantCode, isMainDomain }) || '/login'
  const query = searchParams.toString()
  return query ? `${loginPath}?${query}` : loginPath
}

export default function ChooseTenant() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const auth = useAuth()
  const tenantContext = useTenant()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenants, setTenants] = useState([])
  const [resolvedUser, setResolvedUser] = useState(null)
  const requestedTenantCode = useMemo(
    () => String(searchParams.get('tenantCode') || '').trim().toLowerCase(),
    [searchParams],
  )
  const redirectPath = useMemo(() => {
    const rawRedirect = String(searchParams.get('redirect') || '').trim()
    return rawRedirect.startsWith('/') ? rawRedirect : ''
  }, [searchParams])
  function resolvePostSelectionPath(selectedTenant) {
    if (redirectPath && !isPublicOrAuthPath(redirectPath)) return redirectPath
    return tenantContext?.resolveProtectedRoutePath?.({
      tenantCode: selectedTenant?.tenantCode,
      isMainDomain: tenantContext?.isMainDomain,
    }) || resolveTenantLandingPath(selectedTenant)
  }

  useEffect(() => {
    chooseTenantEffectRuns += 1
    console.info('[ChooseTenant] effect-trigger', {
      effectRuns: chooseTenantEffectRuns,
      hasAuthToken: Boolean(auth?.token),
      requestedTenantCode,
      redirectPath,
      hasResolvedTenant: Boolean(tenantContext?.resolvedTenant?.tenantCode),
      hasCurrentTenant: Boolean(tenantContext?.currentTenant?.tenantCode),
    })

    const fetchTenantContext = async () => {
      chooseTenantRequestRuns += 1
      const requestLabel = `[ChooseTenant.my-tenant-context] #${chooseTenantRequestRuns}`

      setLoading(true)
      setError('')
      console.count('[ChooseTenant] my-tenant-context call-count')
      console.time(requestLabel)

      try {
        console.info('[ChooseTenant] request-start', {
          requestRuns: chooseTenantRequestRuns,
          url: '/auth/my-tenant-context',
          requestedTenantCode,
          redirectPath,
        })
        const response = await api.get('/auth/my-tenant-context')

        const user = response?.data?.user || null
        const tenantItems = Array.isArray(response?.data?.tenants) ? response.data.tenants : []
        let responseBytes = -1
        try {
          responseBytes = new Blob([JSON.stringify(response?.data ?? null)]).size
        } catch {
          responseBytes = -1
        }

        console.info('[ChooseTenant] request-success', {
          requestRuns: chooseTenantRequestRuns,
          tenantCount: tenantItems.length,
          responseBytes,
        })

        setResolvedUser(user)
        setTenants(tenantItems)

        const matchedTenantItem = requestedTenantCode
          ? tenantItems.find((item) => String(item?.tenant?.code || '').trim().toLowerCase() === requestedTenantCode)
          : null

        if (matchedTenantItem) {
          const selected = mapTenantForContext(matchedTenantItem)
          tenantContext?.selectTenant?.(selected)
          navigate(resolvePostSelectionPath(selected), { replace: true })
          return
        }

        if (tenantItems.length === 1) {
          const selected = mapTenantForContext(tenantItems[0])
          tenantContext?.selectTenant?.(selected)
          navigate(resolvePostSelectionPath(selected), { replace: true })
        }
      } catch (requestError) {
        console.info('[ChooseTenant] request-error', {
          requestRuns: chooseTenantRequestRuns,
          status: requestError?.response?.status || null,
          message: requestError?.response?.data?.error?.message || requestError?.message || 'Unknown error',
        })
        if (requestError?.response?.status === 401) {
          auth?.logout?.()
          tenantContext?.clearTenant?.()
          navigate(
            buildLoginPath(requestedTenantCode, redirectPath, tenantContext?.isMainDomain),
            { replace: true },
          )
          return
        }

        const apiMessage = requestError?.response?.data?.error?.message
        setError(apiMessage || 'Không thể tải danh sách tenant. Vui lòng thử lại.')
      } finally {
        console.timeEnd(requestLabel)
        setLoading(false)
      }
    }

    fetchTenantContext()
  }, [auth?.token, navigate, redirectPath, requestedTenantCode, tenantContext])

  const handleSelectTenant = (item) => {
    const selected = mapTenantForContext(item)
    tenantContext?.selectTenant?.(selected)
    navigate(resolvePostSelectionPath(selected), { replace: true })
  }

  const displayUserName = resolvedUser?.username || resolvedUser?.email || auth?.user?.username || auth?.user?.email || 'bạn'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f6fa',
        padding: '16px',
      }}
    >
      <style>
        {`
          .choose-tenant-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .choose-tenant-card {
            border: 1px solid #e1e4ea;
            border-radius: 10px;
            padding: 14px;
            display: flex;
            align-items: center;
            gap: 12px;
            background: #fff;
            min-height: 84px;
          }

          .choose-tenant-name-button {
            border: 0;
            background: transparent;
            padding: 0;
            margin: 0;
            text-align: left;
            cursor: pointer;
            font-size: 16px;
            font-weight: 700;
            color: #1f2937;
            line-height: 1.4;
          }

          .choose-tenant-name-button:hover {
            color: #0d6efd;
          }

          .choose-tenant-meta {
            color: #667085;
            font-weight: 500;
          }

          @media (min-width: 992px) {
            .choose-tenant-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
        `}
      </style>
      <div
        style={{
          width: '100%',
          maxWidth: '1080px',
          background: '#fff',
          borderRadius: '10px',
          padding: '24px',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Chọn đơn vị làm việc</h2>
        <p style={{ marginTop: 0, color: '#555' }}>
          Xin chào {displayUserName}, vui lòng chọn tenant để tiếp tục
        </p>

        {loading && <p>Đang tải danh sách tenant...</p>}

        {!loading && error && (
          <div
            style={{
              color: '#b00020',
              background: '#ffe8ea',
              border: '1px solid #ffcdd2',
              borderRadius: '6px',
              padding: '8px 10px',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && tenants.length === 0 && (
          <p>Tài khoản của bạn chưa được cấp tenant nào</p>
        )}

        {!loading && !error && tenants.length > 1 && (
          <div className='choose-tenant-grid'>
            {tenants.map((item) => {
              const tenant = item?.tenant || {}
              const roles = Array.isArray(item?.roles) ? item.roles : []
              const tenantName = tenant?.name || tenant?.label || 'Unknown Tenant'
              const tenantLogoUrl = extractTenantLogoUrl(tenant)
              const rolesText = roles
                .map((role) => role?.label || role?.name || role?.code)
                .filter(Boolean)
                .join(', ')
              const tenantMeta = [tenant?.code || '', rolesText].filter(Boolean).join(' - ')

              return (
                <div
                  key={item?.userTenantId || `${tenant?.id}-${tenant?.code}`}
                  className='choose-tenant-card'
                >
                  {tenantLogoUrl ? (
                    <img
                      src={tenantLogoUrl}
                      alt={tenantName}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        objectFit: 'contain',
                        border: '1px solid #d7deea',
                        background: '#fff',
                        flex: '0 0 auto',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#e2e8f0',
                        color: '#1f2937',
                        fontWeight: 700,
                        border: '1px solid #d7deea',
                        flex: '0 0 auto',
                      }}
                    >
                      {toInitials(tenantName)}
                    </div>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <button
                      type='button'
                      className='choose-tenant-name-button'
                      onClick={() => handleSelectTenant(item)}
                      title={`Vào tenant ${tenantName}`}
                    >
                      {tenantName}
                      {tenantMeta ? <span className='choose-tenant-meta'> ({tenantMeta})</span> : null}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}