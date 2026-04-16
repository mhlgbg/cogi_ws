import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'

function normalizePath(path) {
  const rawPath = String(path || '').trim()
  if (!rawPath) return ''
  if (/^https?:\/\//i.test(rawPath)) {
    try {
      return new URL(rawPath).pathname || '/'
    } catch {
      return rawPath
    }
  }

  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`
}

function isPublicOrAuthPath(path) {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) return false

  if (
    normalizedPath === '/'
    || normalizedPath === '/login'
    || normalizedPath === '/forgot-password'
    || normalizedPath === '/reset-password'
    || normalizedPath === '/activate'
    || normalizedPath === '/set-password'
  ) {
    return true
  }

  return normalizedPath === '/dang-ky-tuyen-sinh' || normalizedPath.startsWith('/dang-ky-tuyen-sinh/')
}

function buildChooseTenantPath(tenantCode, redirectPath) {
  const nextSearchParams = new URLSearchParams()
  const nextTenantCode = String(tenantCode || '').trim()
  if (nextTenantCode) nextSearchParams.set('tenantCode', nextTenantCode)
  if (redirectPath && !isPublicOrAuthPath(redirectPath)) nextSearchParams.set('redirect', redirectPath)

  return nextSearchParams.toString()
    ? `/choose-tenant?${nextSearchParams.toString()}`
    : '/choose-tenant'
}

export default function Login() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [searchParams] = useSearchParams()
  const auth = useAuth()
  const tenant = useTenant()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const redirectPath = useMemo(() => {
    const rawRedirect = String(searchParams.get('redirect') || '').trim()
    return rawRedirect.startsWith('/') ? rawRedirect : ''
  }, [searchParams])
  const resolvedTenantCode = String(
    tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '',
  ).trim()

  if (auth?.isAuthenticated) {
    if (tenant?.isResolvingTenant) {
      return <div>Đang xác định tenant...</div>
    }

    if (tenant?.hasTenant) {
      const authenticatedTarget = redirectPath && !isPublicOrAuthPath(redirectPath)
        ? redirectPath
        : tenant?.resolveProtectedRoutePath?.({
          tenantCode: resolvedTenantCode,
          isMainDomain: tenant?.isMainDomain,
        }) || '/dashboard'

      return <Navigate to={authenticatedTarget} replace />
    }

    return <Navigate to={buildChooseTenantPath(resolvedTenantCode, redirectPath)} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const nextIdentifier = identifier.trim()
    if (!nextIdentifier || !password) {
      setError('Vui lòng nhập đầy đủ identifier và password.')
      return
    }

    setLoading(true)

    try {
      const response = await api.post('/auth/local', {
        identifier: nextIdentifier,
        password,
      })

      const { jwt, user } = response?.data || {}

      if (!jwt || !user) {
        setError('Dữ liệu đăng nhập không hợp lệ.')
        return
      }

      if (auth && typeof auth.login === 'function') {
        auth.login(jwt, user)
      } else {
        localStorage.setItem('authJwt', jwt)
        localStorage.setItem('authUser', JSON.stringify(user))
      }

      const nextChooseTenantPath = buildChooseTenantPath(resolvedTenantCode, redirectPath)

      navigate(nextChooseTenantPath)
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.error?.message
      setError(apiMessage || 'Đăng nhập thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

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
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '380px',
          background: '#fff',
          padding: '24px',
          borderRadius: '10px',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h2 style={{ margin: 0, marginBottom: '8px', textAlign: 'center' }}>
          Đăng nhập hệ thống
        </h2>

        <label htmlFor="identifier">Identifier</label>
        <input
          id="identifier"
          type="text"
          placeholder="Username hoặc email"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          style={{ padding: '10px 12px' }}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Nhập mật khẩu"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          style={{ padding: '10px 12px' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Link to="/forgot-password" style={{ fontSize: '14px' }}>
            Quên mật khẩu?
          </Link>
        </div>

        {error && (
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

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '4px',
            padding: '10px 12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}