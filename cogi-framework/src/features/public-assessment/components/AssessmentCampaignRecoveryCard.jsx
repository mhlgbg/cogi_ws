import { useMemo, useState } from 'react'
import { CAlert, CButton, CCard, CCardBody, CFormInput, CFormLabel } from '@coreui/react'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export default function AssessmentCampaignRecoveryCard({
  title = 'Xác thực để tiếp tục',
  description = 'Nhập email đã dùng khi đăng ký để tiếp tục bài kiểm tra hoặc xem lại kết quả.',
  submitLabel = 'Xác nhận',
  initialEmail = '',
  loading = false,
  error = '',
  message = '',
  requestOtpLabel = 'Gửi mã xác thực',
  onRequestOtp,
  onSubmit,
}) {
  const [email, setEmail] = useState(initialEmail || '')
  const [otpRequested, setOtpRequested] = useState(false)
  const [otp, setOtp] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [localError, setLocalError] = useState('')
  const normalizedEmail = useMemo(() => toText(email).toLowerCase(), [email])

  async function handleRequestOtp() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setLocalError('Vui lòng nhập email hợp lệ.')
      return
    }
    setLocalError('')
    const payload = await onRequestOtp?.({ email: normalizedEmail })
    setChallengeId(String(payload?.challengeId || ''))
    setOtpRequested(true)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setLocalError('Vui lòng nhập email hợp lệ.')
      return
    }
    if (toText(otp).length !== 6) {
      setLocalError('Vui lòng nhập mã OTP gồm 6 chữ số.')
      return
    }
    if (!challengeId) {
      setLocalError('Vui lòng yêu cầu mã xác thực mới.')
      return
    }
    setLocalError('')
    onSubmit?.({ email: normalizedEmail, otp: toText(otp), challengeId })
  }

  return (
    <CCard className='assessment-form-card assessment-card'>
      <CCardBody className='p-4 p-md-5'>
        <div className='assessment-section-title'>{title}</div>
        <p className='assessment-section-lead mb-4'>{description}</p>
        {message ? <CAlert color='success'>{message}</CAlert> : null}
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {localError ? <CAlert color='warning'>{localError}</CAlert> : null}
        <form onSubmit={handleSubmit} noValidate>
          <div className='assessment-form-grid assessment-form-grid--single assessment-form-grid--compact'>
            <div className='assessment-form-field'>
              <CFormLabel className='assessment-form-label'>Email</CFormLabel>
              <CFormInput type='email' value={email} onChange={(event) => setEmail(event.target.value)} placeholder='name@example.com' autoComplete='email' />
            </div>
            {otpRequested ? (
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label'>Mã OTP</CFormLabel>
                <CFormInput value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode='numeric' placeholder='123456' autoComplete='one-time-code' />
                  <div className='assessment-form-label-helper'>Vui lòng nhập mã xác thực gồm 6 chữ số đã được gửi qua email.</div>
              </div>
            ) : null}
          </div>
          <div className='assessment-form-actions d-flex flex-wrap gap-2 mt-4'>
              {!otpRequested ? <CButton type='button' color='secondary' variant='outline' onClick={handleRequestOtp} disabled={loading}>{requestOtpLabel}</CButton> : null}
            {otpRequested ? <CButton type='submit' color='primary' className='assessment-primary-cta' disabled={loading}>{loading ? 'Đang xác thực...' : submitLabel}</CButton> : null}
          </div>
        </form>
      </CCardBody>
    </CCard>
  )
}