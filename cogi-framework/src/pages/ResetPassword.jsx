import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CFormLabel,
  CRow,
} from '@coreui/react'
import api from '../api/axios'
import { applyTenantBranding, fetchTenantBranding } from '../utils/tenantBranding'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const code = (searchParams.get('code') || '').trim()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let isCancelled = false

    async function loadTenantBranding() {
      try {
        const branding = await fetchTenantBranding()
        if (!isCancelled) {
          applyTenantBranding(branding, 'Đặt lại mật khẩu')
        }
      } catch {
        if (!isCancelled) {
          document.title = 'Đặt lại mật khẩu'
        }
      }
    }

    loadTenantBranding()

    return () => {
      isCancelled = true
    }
  }, [])

  async function onSubmit(event) {
    event.preventDefault()
    setError('')

    if (!newPassword || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    if (!code) {
      setError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')
      return
    }

    setBusy(true)
    try {
      await api.post('/auth/reset-password', {
        code,
        password: newPassword,
        passwordConfirmation: confirmPassword,
      })
      setSuccess(true)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error?.message
          || requestError?.response?.data?.message
          || requestError?.message
          || 'Không thể đặt lại mật khẩu'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <CContainer className="py-5">
      <CRow className="justify-content-center">
        <CCol md={6} style={{ maxWidth: 500, width: '100%' }}>
          <CCard>
            <CCardHeader><b>Đặt lại mật khẩu</b></CCardHeader>
            <CCardBody>
              {success ? (
                <div className="d-flex flex-column align-items-start">
                  <div className="text-success mb-3">Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.</div>
                  <Link to="/login" className="btn btn-primary">Về trang đăng nhập</Link>
                </div>
              ) : (
                <CForm onSubmit={onSubmit}>
                  <div className="mb-3">
                    <CFormLabel>Mật khẩu mới</CFormLabel>
                    <CFormInput
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <CFormLabel>Xác nhận mật khẩu mới</CFormLabel>
                    <CFormInput
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                  </div>

                  {error ? <div className="text-danger mb-3">{error}</div> : null}

                  <CButton type="submit" color="primary" disabled={busy}>
                    {busy ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                  </CButton>
                </CForm>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}
