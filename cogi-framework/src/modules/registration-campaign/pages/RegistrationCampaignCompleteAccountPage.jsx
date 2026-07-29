import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CContainer, CForm, CFormInput, CFormLabel, CSpinner } from '@coreui/react'
import { useAuth } from '../../../contexts/AuthContext'
import { useTenant } from '../../../contexts/TenantContext'
import { buildTenantUrl } from '../../../utils/tenantRouting'
import { completePublicRegistrationAccount, getApiMessage } from '../services/registrationCampaignPublicService'

export default function RegistrationCampaignCompleteAccountPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const tenant = useTenant()
  const { tenantCode } = useParams()
  const [searchParams] = useSearchParams()
  const token = String(searchParams.get('token') || '').trim()
  const resolvedTenantCode = useMemo(() => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(), [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode])
  const [form, setForm] = useState({ fullName: '', password: '', passwordConfirmation: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!token) {
      navigate(buildTenantUrl('/', { tenantCode: resolvedTenantCode, isMainDomain: tenant?.isMainDomain }), { replace: true })
    }
  }, [navigate, resolvedTenantCode, tenant?.isMainDomain, token])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setResult(null)
    try {
      const result = await completePublicRegistrationAccount({
        token,
        fullName: form.fullName,
        password: form.password,
        passwordConfirmation: form.passwordConfirmation,
      }, resolvedTenantCode)

      if (result?.completionBlocked) {
        setResult(result)
        return
      }

      if (result?.jwt && result?.user) {
        auth?.login?.(result.jwt, result.user)
      }

      const targetPath = buildTenantUrl(result?.redirectPath || '/dashboard', { tenantCode: resolvedTenantCode, isMainDomain: tenant?.isMainDomain })
      navigate(targetPath, { replace: true })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể hoàn tất tài khoản'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='py-4 py-lg-5'>
      <CContainer style={{ maxWidth: 760 }}>
        <CCard>
          <CCardBody className='p-4 p-lg-5'>
            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            {result?.message ? <CAlert color='warning'>{result.message}</CAlert> : null}
            <div className='fs-4 fw-semibold mb-3'>Hoàn tất tài khoản</div>
            <div className='text-body-secondary mb-4'>Email của bạn đã được xác minh. Hãy đặt mật khẩu để hoàn tất tham gia chiến dịch.</div>
            {result?.completionBlocked ? <div className='text-body-secondary mb-4'>Tài khoản có thể đã được tạo nhưng chiến dịch chưa thể hoàn tất cấp quyền tự động. Vui lòng liên hệ quản trị viên.</div> : null}
            <CForm onSubmit={handleSubmit}>
              <div className='mb-3'>
                <CFormLabel>Họ và tên</CFormLabel>
                <CFormInput value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} placeholder='Nhập họ và tên' />
              </div>
              <div className='mb-3'>
                <CFormLabel>Mật khẩu</CFormLabel>
                <CFormInput type='password' value={form.password} onChange={(event) => updateField('password', event.target.value)} placeholder='Ít nhất 8 ký tự' />
              </div>
              <div className='mb-4'>
                <CFormLabel>Nhập lại mật khẩu</CFormLabel>
                <CFormInput type='password' value={form.passwordConfirmation} onChange={(event) => updateField('passwordConfirmation', event.target.value)} placeholder='Nhập lại mật khẩu' />
              </div>
              <div className='d-flex justify-content-end'>
                <CButton type='submit' color='primary' disabled={submitting}>{submitting ? 'Đang hoàn tất...' : 'Hoàn tất tài khoản'}</CButton>
              </div>
            </CForm>
          </CCardBody>
        </CCard>
      </CContainer>
    </div>
  )
}