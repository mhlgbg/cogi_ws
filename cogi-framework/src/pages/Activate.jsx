import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { applyTenantBranding, fetchTenantBranding } from '../utils/tenantBranding'

export default function Activate() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const token = (searchParams.get('token') || '').trim()

  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isCancelled = false

    async function loadTenantBranding() {
      try {
        const branding = await fetchTenantBranding()
        if (!isCancelled) {
          applyTenantBranding(branding, 'Kích hoạt tài khoản')
        }
      } catch {
        if (!isCancelled) {
          document.title = 'Kích hoạt tài khoản'
        }
      }
    }

    loadTenantBranding()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function activateAccount() {
      if (!token) {
        setStatus('error')
        setMessage('Liên kết kích hoạt không hợp lệ')
        return
      }

      setStatus('loading')
      setMessage('')

      try {
        const res = await api.post('/auth/activate', { token })
        const resetPasswordToken = (res?.data?.resetPasswordToken || '').trim()

        if (!isCancelled) {
          setStatus('success')
          setMessage('Tài khoản đã được kích hoạt thành công')
          // Use activation token as source of truth. Backend set-password supports activation token fallback.
          const setPasswordToken = token || resetPasswordToken
          navigate(`/set-password?token=${encodeURIComponent(setPasswordToken)}`)
        }
      } catch (err) {
        if (!isCancelled) {
          const apiMessage =
            err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            'Kích hoạt tài khoản thất bại'

          setStatus('error')
          setMessage(apiMessage)
        }
      }
    }

    activateAccount()

    return () => {
      isCancelled = true
    }
  }, [token, navigate])

  return (
    <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 16px' }}>
      {status === 'loading' ? <p>Đang xử lý...</p> : null}
      {status === 'success' ? <p>{message}</p> : null}
      {status === 'error' ? <p>{message}</p> : null}

      <button type="button" onClick={() => navigate('/login')}>
        Đi đến đăng nhập
      </button>
    </div>
  )
}
