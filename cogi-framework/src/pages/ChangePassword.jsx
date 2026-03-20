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

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setError('')

    if (newPassword !== confirmNewPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    setBusy(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        password: newPassword,
        passwordConfirmation: confirmNewPassword,
      })
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (requestError) {
      const status = requestError?.response?.status
      if (status === 404) {
        setError('Không tìm thấy endpoint đổi mật khẩu. Vui lòng kiểm tra API Strapi.')
      } else {
        setError(
          requestError?.response?.data?.error?.message
            || requestError?.response?.data?.message
            || requestError?.message
            || 'Không thể đổi mật khẩu'
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <CContainer className="py-5">
      <CRow className="justify-content-center">
        <CCol md={6} style={{ maxWidth: 500, width: '100%' }}>
          <CCard>
            <CCardHeader><b>Alpha Internal</b> - Đổi mật khẩu</CCardHeader>
            <CCardBody>
              {success ? (
                <div className="d-flex flex-column align-items-start">
                  <div className="text-success mb-3">Đổi mật khẩu thành công.</div>
                  <Link to="/" className="btn btn-primary">Về dashboard</Link>
                </div>
              ) : (
                <CForm onSubmit={onSubmit}>
                  <div className="mb-3">
                    <CFormLabel>Mật khẩu hiện tại</CFormLabel>
                    <CFormInput
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      required
                    />
                  </div>

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
                      value={confirmNewPassword}
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                      required
                    />
                  </div>

                  {error ? <div className="text-danger mb-3">{error}</div> : null}

                  <div className="d-flex gap-2">
                    <CButton type="submit" color="primary" disabled={busy}>
                      {busy ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                    </CButton>
                    <Link to="/" className="btn btn-outline-secondary">Hủy</Link>
                  </div>
                </CForm>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}
