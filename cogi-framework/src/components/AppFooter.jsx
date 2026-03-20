import { useTenant } from '../contexts/TenantContext'

export default function AppFooter() {
  const tenant = useTenant()

  const tenantName = tenant?.currentTenant?.tenantShortName
    || tenant?.currentTenant?.tenantName
    || tenant?.currentTenant?.tenantCode
    || 'Tenant'

  return (
    <footer className="tenant-footer">
      <span>{tenantName}</span>
      <span className="tenant-footer-separator">•</span>
      <span>Powered by COGI Framework</span>
    </footer>
  )
}
