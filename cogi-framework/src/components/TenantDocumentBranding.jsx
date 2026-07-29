import { useEffect, useRef } from 'react'
import { useTenant } from '../contexts/TenantContext'
import { applyTenantFavicon, resetTenantFavicon } from '../utils/tenantBranding'

export default function TenantDocumentBranding() {
  const tenant = useTenant()
  const generationRef = useRef(0)

  useEffect(() => {
    const nextTenant = tenant?.resolvedTenant?.tenantCode
      ? tenant.resolvedTenant
      : (!tenant?.isResolvingTenant && tenant?.currentTenant?.tenantCode ? tenant.currentTenant : null)

    const generation = generationRef.current + 1
    generationRef.current = generation
    let cancelled = false

    if (!nextTenant) {
      resetTenantFavicon()
      return () => {
        cancelled = true
      }
    }

    void applyTenantFavicon(nextTenant, {
      generation,
      isCancelled: () => cancelled || generationRef.current !== generation,
    })

    return () => {
      cancelled = true
    }
  }, [tenant?.resolvedTenant, tenant?.currentTenant, tenant?.isResolvingTenant])

  return null
}