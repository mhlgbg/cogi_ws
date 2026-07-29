import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CContainer, CFormInput, CSpinner } from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import { changePublicRegistrationEmail, getApiMessage, resendPublicRegistrationVerification } from '../services/registrationCampaignPublicService'

export default function RegistrationCampaignCheckEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const resolvedTenantCode = useMemo(() => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(), [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode])
  const statePayload = location.state || {}
  const registrationToken = String(statePayload?.registrationToken || searchParams.get('token') || '').trim()
  const maskedEmail = String(statePayload?.maskedEmail || searchParams.get('email') || '').trim()
  const [resending, setResending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(String(statePayload?.message || '').trim() || 'Chúng tôi đã gửi thư xác nhận tới email đã đăng ký. Vui lòng kiểm tra hộp thư và thư rác.')

  useEffect(() => {
    if (!registrationToken) {
      navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/join/${encodeURIComponent(campaignCode)}` : `/join/${encodeURIComponent(campaignCode)}`, { replace: true })
    }
  }, [campaignCode, navigate, registrationToken, tenantCode])

  async function handleResend() {
    setResending(true)
    setError('')
    try {
      const result = await resendPublicRegistrationVerification({ registrationToken }, resolvedTenantCode)
      setSuccess(result?.message || 'Đã xử lý yêu cầu gửi lại email xác minh.')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gửi lại email xác minh'))
    } finally {
      setResending(false)
    }
  }

  async function handleChangeEmail() {
    setEditing(true)
    setError('')
    try {
      const result = await changePublicRegistrationEmail({ registrationToken, newEmail: email }, resolvedTenantCode)
      setSuccess(result?.message || 'Đã cập nhật email và gửi lại thư xác minh.')
      setEmail('')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể đổi email'))
    } finally {
      setEditing(false)
    }
  }

  if (!registrationToken) {
    return (
      <div className='py-5 text-center'>
        <CSpinner />
      </div>
    )
  }

  return (
    <div className='py-4 py-lg-5'>
      <CContainer style={{ maxWidth: 760 }}>
        <CCard>
          <CCardBody className='p-4 p-lg-5'>
            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            {success ? <CAlert color='success'>{success}</CAlert> : null}
            <div className='fs-4 fw-semibold mb-2'>Kiểm tra email để tiếp tục</div>
            <div className='text-body-secondary mb-4'>Chúng tôi đã gửi thư xác nhận tới {maskedEmail || 'email đã đăng ký'}. Vui lòng kiểm tra hộp thư đến và thư rác.</div>
            <div className='d-flex flex-wrap gap-2 mb-4'>
              <CButton color='primary' onClick={handleResend} disabled={resending || editing}>{resending ? 'Đang gửi lại...' : 'Gửi lại email'}</CButton>
              <Link className='btn btn-light' to={tenantCode ? `/t/${encodeURIComponent(tenantCode)}/login` : '/login'}>Quay lại đăng nhập</Link>
            </div>
            <div className='border rounded p-3 bg-light'>
              <div className='fw-semibold mb-2'>Sửa email nếu nhập sai</div>
              <div className='small text-body-secondary mb-2'>Email mới sẽ được dùng để tạo lại link xác minh. Hệ thống không tiết lộ email đã có tài khoản hay chưa.</div>
              <div className='d-flex flex-column flex-md-row gap-2'>
                <CFormInput type='email' value={email} onChange={(event) => setEmail(event.target.value)} placeholder='Nhập email mới' />
                <CButton color='secondary' onClick={handleChangeEmail} disabled={editing || !String(email || '').trim()}>{editing ? 'Đang cập nhật...' : 'Sửa email'}</CButton>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </CContainer>
    </div>
  )
}