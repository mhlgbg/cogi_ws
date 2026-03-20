import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'

export default function TenantRoute({ children }) {
  const auth = useAuth()
  const tenant = useTenant()

  if (!auth?.isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!tenant?.hasTenant) {
    return <Navigate to="/choose-tenant" replace />
  }

  return <>{children}</>
}
