import { useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setBusy(true)

    try {
      await api.post('/auth/forgot-password-safe', { email: email.trim() })
      setSuccess('Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.')
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error?.message
          || requestError?.response?.data?.message
          || requestError?.message
          || 'Không thể gửi yêu cầu đặt lại mật khẩu'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <CContainer className="py-5">
      <CRow className="justify-content-center">
        <CCol md={5}>
          <CCard>
            <CCardHeader><b>Alpha Internal</b> - Quên mật khẩu</CCardHeader>
            <CCardBody>
              <CForm onSubmit={onSubmit}>
                <div className="mb-3">
                  <CFormLabel>Email</CFormLabel>
                  <CFormInput
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                {error ? <div className="text-danger mb-3">{error}</div> : null}
                {success ? <div className="text-success mb-3">{success}</div> : null}

                <div className="d-flex flex-column align-items-start">
                  <CButton type="submit" color="primary" disabled={busy}>
                    {busy ? 'Đang gửi...' : 'Gửi yêu cầu đặt lại mật khẩu'}
                  </CButton>
                  <Link to="/login" className="btn btn-link p-0 mt-2">Quay lại đăng nhập</Link>
                </div>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}
