import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFeature } from '../contexts/FeatureContext'
import { useTenant } from '../contexts/TenantContext'

function toInitials(input) {
  const text = String(input || '').trim()
  if (!text) return 'T'
  const parts = text.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'T'
}

export default function AppHeader({ onToggleSidebar }) {
  const navigate = useNavigate()
  const auth = useAuth()
  const tenant = useTenant()
  const feature = useFeature()

  const roleText = (feature?.roles || [])
    .map((role) => role?.label || role?.name || role?.code)
    .filter(Boolean)
    .join(', ')

  const tenantName = tenant?.currentTenant?.tenantShortName
    || tenant?.currentTenant?.tenantName
    || tenant?.currentTenant?.tenantCode
    || '-'

  const tenantCode = tenant?.currentTenant?.tenantCode
    ? `(${tenant.currentTenant.tenantCode})`
    : ''

  const tenantLogoUrl = tenant?.currentTenant?.tenantLogoUrl || ''
  const userDisplayName = auth?.user?.fullName
    ? `${auth.user.fullName} (${auth?.user?.username || auth?.user?.email || 'Unknown user'})`
    : auth?.user?.username || auth?.user?.email || 'Unknown user'

  const handleSwitchTenant = () => {
    tenant?.clearTenant?.()
    navigate('/choose-tenant', { replace: true })
  }

  const handleLogout = () => {
    auth?.logout?.()
    navigate('/login', { replace: true })
  }

  return (
    <header className="tenant-header">
      <div className="tenant-header-left">
        <button type="button" className="tenant-header-sidebar-toggle" onClick={onToggleSidebar}>
          ☰
        </button>
        {/*
        {tenantLogoUrl ? (
          <img src={tenantLogoUrl} alt={tenantName} className="tenant-header-logo" />
        ) : (
          <div className="tenant-header-logo tenant-header-logo-fallback">{toInitials(tenantName)}</div>
        )}
        */}
        <div className="tenant-header-meta">
          <div className="tenant-header-user">
            Xin chào: {userDisplayName}
          </div>
          <div className="tenant-header-tenant">
            Đang ở không gian số của: {tenantName} {tenantCode}
          </div>
          <div className="tenant-header-roles">(Các) Vai trò: {roleText || '-'}</div>
        </div>
      </div>

      <div className="tenant-header-actions">
        <button type="button" onClick={handleSwitchTenant} className="tenant-header-action">
          Đổi tenant
        </button>
        <button type="button" onClick={handleLogout} className="tenant-header-action">
          Đăng xuất
        </button>
      </div>
    </header>
  )
}
