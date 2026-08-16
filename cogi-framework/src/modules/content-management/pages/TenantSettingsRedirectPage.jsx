import { Navigate, useParams } from 'react-router-dom'

export default function TenantSettingsRedirectPage() {
  const { tenantCode } = useParams()
  const target = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/tenant/settings/website` : '/tenant/settings/website'
  return <Navigate to={target} replace />
}