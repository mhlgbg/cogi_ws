import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const auth = useAuth()
  const tenant = useTenant()

  const currentTenant = tenant?.currentTenant
  const roles = Array.isArray(currentTenant?.roles) ? currentTenant.roles : []

  const handleSwitchTenant = () => {
    tenant?.clearTenant?.()
    navigate('/choose-tenant', { replace: true })
  }

  const handleLogout = () => {
    auth?.logout?.()
    navigate('/login', { replace: true })
  }

  const handleChangePassword = () => {
    navigate('/change-password')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '24px',
        background: '#f5f6fa',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          background: '#fff',
          borderRadius: '10px',
          padding: '24px',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h2 style={{ margin: 0 }}>Dashboard</h2>

        <div>
          <h3 style={{ marginBottom: '8px' }}>Thông tin user</h3>
          <div>username: {auth?.user?.username || '-'}</div>
          <div>email: {auth?.user?.email || '-'}</div>
        </div>

        <div>
          <h3 style={{ marginBottom: '8px' }}>Thông tin tenant hiện tại</h3>
          <div>tenantName: {currentTenant?.tenantName || '-'}</div>
          <div>tenantCode: {currentTenant?.tenantCode || '-'}</div>
          <div>tenantId: {currentTenant?.tenantId || '-'}</div>
          <div>userTenantId: {currentTenant?.userTenantId || '-'}</div>

        </div>

        <div>
          <h3 style={{ marginBottom: '8px' }}>Roles hiện tại</h3>
          {roles.length > 0 ? (
            <ul style={{ marginTop: 0 }}>
              {roles.map((role, index) => {
                const roleName = role?.label || role?.name || role?.code || `Role ${index + 1}`
                const roleKey = role?.id || role?.code || `${roleName}-${index}`

                return <li key={roleKey}>{roleName}</li>
              })}
            </ul>
          ) : (
            <div>-</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleChangePassword}
            style={{ padding: '8px 12px', cursor: 'pointer' }}
          >
            Đổi mật khẩu
          </button>

          <button
            type="button"
            onClick={handleSwitchTenant}
            style={{ padding: '8px 12px', cursor: 'pointer' }}
          >
            Đổi tenant
          </button>

          <button
            type="button"
            onClick={handleLogout}
            style={{ padding: '8px 12px', cursor: 'pointer' }}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}