import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'

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
    roles: Array.isArray(item?.roles) ? item.roles : [],
  }
}

export default function ChooseTenant() {
  const navigate = useNavigate()
  const auth = useAuth()
  const tenantContext = useTenant()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenants, setTenants] = useState([])
  const [resolvedUser, setResolvedUser] = useState(null)

  useEffect(() => {
    const fetchTenantContext = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await api.get('/auth/my-tenant-context')

        const user = response?.data?.user || null
        const tenantItems = Array.isArray(response?.data?.tenants) ? response.data.tenants : []

        setResolvedUser(user)
        setTenants(tenantItems)

        if (tenantItems.length === 1) {
          const selected = mapTenantForContext(tenantItems[0])
          tenantContext?.selectTenant?.(selected)
          navigate('/', { replace: true })
        }
      } catch (requestError) {
        const apiMessage = requestError?.response?.data?.error?.message
        setError(apiMessage || 'Không thể tải danh sách tenant. Vui lòng thử lại.')
      } finally {
        setLoading(false)
      }
    }

    fetchTenantContext()
  }, [auth?.token, navigate, tenantContext])

  const handleSelectTenant = (item) => {
    const selected = mapTenantForContext(item)
    tenantContext?.selectTenant?.(selected)
    navigate('/', { replace: true })
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
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tenants.map((item) => {
              const tenant = item?.tenant || {}
              const roles = Array.isArray(item?.roles) ? item.roles : []
              const tenantName = tenant?.name || tenant?.label || 'Unknown Tenant'
              const tenantLogoUrl = extractTenantLogoUrl(tenant)

              return (
                <div
                  key={item?.userTenantId || `${tenant?.id}-${tenant?.code}`}
                  style={{
                    border: '1px solid #e1e4ea',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {tenantLogoUrl ? (
                      <img
                        src={tenantLogoUrl}
                        alt={tenantName}
                        style={{
                          width: '36px',
                          height: '36px',
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
                          width: '36px',
                          height: '36px',
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

                    <strong>{tenantName}</strong>
                  </div>
                  <div>code: {tenant?.code || '-'}</div>
                  <div>userTenant: {item?.label || '-'}</div>
                  <div>
                    roles:{' '}
                    {roles.length > 0
                      ? roles.map((role) => role?.label || role?.name || role?.code).filter(Boolean).join(', ')
                      : '-'}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectTenant(item)}
                    style={{
                      marginTop: '4px',
                      width: 'fit-content',
                      padding: '8px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    Vào tenant này
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}