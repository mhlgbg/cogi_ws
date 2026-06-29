import React from 'react'
import PublicChatWidget from './PublicChatWidget.jsx'
import { useTenant } from '../../contexts/TenantContext'

export default function PublicChatShell({ children, tenantCode: propTenantCode = '', tenantSlug: propTenantSlug = '' }) {
  const tenant = useTenant()
  const resolvedTenantCode = String(propTenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim()
  const resolvedTenantSlug = String(propTenantSlug || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim()

  return (
    <>
      {children}
      <PublicChatWidget tenantCode={resolvedTenantCode} tenantSlug={resolvedTenantSlug} />
    </>
  )
}
