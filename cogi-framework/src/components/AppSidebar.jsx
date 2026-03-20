import { NavLink } from 'react-router-dom'
import { useTenant } from '../contexts/TenantContext'

function toInitials(input) {
  const text = String(input || '').trim()
  if (!text) return 'T'

  const parts = text.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'T'
}

function SidebarItem({ item, onNavigate }) {
  const isRoot = item.path === '/'

  return (
    <NavLink
      to={item.path}
      end={isRoot}
      className={({ isActive }) => [
        'tenant-sidebar-link',
        isActive ? 'active' : '',
      ].filter(Boolean).join(' ')}
      onClick={onNavigate}
    >
      <span className="tenant-sidebar-link-dot">•</span>
      <span className="tenant-sidebar-link-label">{item.name}</span>
    </NavLink>
  )
}

export default function AppSidebar({
  navItems = [],
  collapsed = false,
  mobileOpen = false,
  onCloseMobile,
}) {
  const tenant = useTenant()
  const groups = Array.isArray(navItems) ? navItems : []
  const tenantName = tenant?.currentTenant?.tenantShortName
    || tenant?.currentTenant?.tenantName
    || tenant?.currentTenant?.tenantCode
    || 'Tenant'
  const tenantCode = tenant?.currentTenant?.tenantCode || ''
  const tenantLogoUrl = tenant?.currentTenant?.tenantLogoUrl || ''

  const sidebarClassName = [
    'tenant-sidebar',
    collapsed ? 'is-collapsed' : '',
    mobileOpen ? 'is-mobile-open' : '',
  ].filter(Boolean).join(' ')

  const handleNavigate = () => {
    if (typeof onCloseMobile === 'function') {
      onCloseMobile()
    }
  }

  return (
    <aside className={sidebarClassName}>
      <div className="tenant-sidebar-header">
        {tenantLogoUrl ? (
          <img src={tenantLogoUrl} alt={tenantName} className="tenant-sidebar-logo" />
        ) : (
          <div className="tenant-sidebar-logo tenant-sidebar-logo-fallback">{toInitials(tenantName)}</div>
        )}

        <div className="tenant-sidebar-brand-text">
          <div className="tenant-sidebar-brand-name">{tenantName}</div>
          <div className="tenant-sidebar-brand-sub">{tenantCode || 'No tenant code'}</div>
        </div>

        {mobileOpen ? (
          <button type="button" className="tenant-sidebar-mobile-close" onClick={onCloseMobile}>×</button>
        ) : null}
      </div>

      <div className="tenant-sidebar-nav">
        <div className="tenant-sidebar-group-title">Menu</div>

        {groups.length === 0 && (
          <p className="tenant-sidebar-empty">Chưa có menu theo feature.</p>
        )}

        {groups
          .filter((group) => Array.isArray(group?.items) && group.items.length > 0)
          .map((group) => (
            <div key={group.code || group.name} className="tenant-sidebar-group">
              <div className="tenant-sidebar-group-title">{group.name}</div>

              <div className="tenant-sidebar-item-list">
                {group.items.map((item) => (
                  <SidebarItem key={item.key} item={item} onNavigate={handleNavigate} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </aside>
  )
}
