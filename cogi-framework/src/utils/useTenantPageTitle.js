import { useEffect } from 'react'
import { useTenant } from '../contexts/TenantContext'
import { setPageTitle } from './tenantBranding'

export default function useTenantPageTitle(pageTitle) {
  const tenant = useTenant()

  useEffect(() => {
    setPageTitle(pageTitle, tenant?.resolvedTenant || tenant?.currentTenant)
  }, [pageTitle, tenant])
}