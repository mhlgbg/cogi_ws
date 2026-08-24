import { useEffect, useMemo, useRef, useState } from 'react'
import { CAlert, CButton, CCard, CCardBody, CContainer } from '@coreui/react'
import { useNavigate, useParams } from 'react-router-dom'
import AssessmentProgress from '../components/AssessmentProgress'
import { buildCampaignRegisterPath, buildCampaignSoundCheckPath } from '../utils/assessmentRoutes'
import { getFlowState, patchFlowState } from '../utils/assessmentFlowStorage'
import { maskEmail, OTP_DEMO_CODE, OTP_LOCK_SECONDS, OTP_RESEND_SECONDS } from '../utils/assessmentRuntime'
import { maskPhone } from '../utils/assessmentCampaignFlow'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0))
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0')
  const seconds = String(safe % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function OtpInput({ value, setValue, disabled }) {
  const inputsRef = useRef([])
  const values = useMemo(() => {
    const padded = `${toText(value)}      `.slice(0, 6)
    return padded.split('')
  }, [value])

  function focusIndex(index) {
    const next = inputsRef.current[index]
    if (next?.focus) next.focus()
    if (next?.select) next.select()
  }

  function applyDigits(digits) {
    const normalized = String(digits || '').replace(/\D/g, '').slice(0, 6)
    setValue(normalized)
    const nextIndex = Math.min(5, normalized.length)
    window.requestAnimationFrame(() => focusIndex(nextIndex))
  }

  return (
    <div className='assessment-otp-grid'>
      {values.map((digit, index) => (
        <input
          key={`otp-${index}`}
          ref={(node) => { inputsRef.current[index] = node }}
          className='assessment-otp-input'
          inputMode='numeric'
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit === ' ' ? '' : digit}
          disabled={disabled}
          aria-label={`Mã xác thực số ${index + 1}`}
          onChange={(event) => {
            const raw = event.target.value.replace(/\D/g, '')
            if (!raw) {
              const nextChars = values.map((item) => (item === ' ' ? '' : item))
              nextChars[index] = ''
              setValue(nextChars.join('').replace(/\s/g, '').slice(0, 6))
              return
            }
            const nextChars = values.map((item) => (item === ' ' ? '' : item))
            nextChars[index] = raw[0]
            const nextValue = nextChars.join('').replace(/\s/g, '').slice(0, 6)
            setValue(nextValue)
            if (raw[0] && index < 5) focusIndex(index + 1)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !values[index] && index > 0) {
              focusIndex(index - 1)
            }
            if (event.key === 'ArrowLeft' && index > 0) focusIndex(index - 1)
            if (event.key === 'ArrowRight' && index < 5) focusIndex(index + 1)
          }}
          onPaste={(event) => {
            event.preventDefault()
            applyDigits(event.clipboardData.getData('text'))
          }}
        />
      ))}
    </div>
  )
}

export default function AssessmentVerifyPage() {
  const navigate = useNavigate()
  const { tenantCode, campaignCode } = useParams()
  const [otpValue, setOtpValue] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [tick, setTick] = useState(nowSeconds())
  const [flowState, setFlowState] = useState(() => getFlowState())

  const registerPath = buildCampaignRegisterPath(tenantCode, campaignCode)
  const soundCheckPath = buildCampaignSoundCheckPath(tenantCode, campaignCode)
  const isSameFlow = flowState?.tenantCode === tenantCode && flowState?.campaignCode === campaignCode
  const beforeStartData = isSameFlow ? (flowState?.beforeStartData || null) : null
  const verification = flowState?.verification || {}
  const assessment = flowState?.assessment || {}
  const returnToPath = toText(verification?.returnToPath)
  const hasRequiredState = Boolean(isSameFlow && verification?.target)
  const lockedUntil = Number(verification.lockedUntil || 0)
  const resendAvailableAt = Number(verification.resendAvailableAt || 0)
  const failedAttempts = Number(verification.failedAttempts || 0)
  const isLocked = lockedUntil > tick
  const resendRemaining = Math.max(0, resendAvailableAt - tick)
  const isEmailVerification = verification?.method === 'email'
  const displayTarget = isEmailVerification ? maskEmail(verification?.target || '') : maskPhone(verification?.target || '')

  useEffect(() => {
    const timer = window.setInterval(() => setTick(nowSeconds()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  function syncState(nextState) {
    setFlowState(nextState)
    return nextState
  }

  function handleResend() {
    const nextState = patchFlowState({
      verification: {
        ...(flowState?.verification || {}),
        resendAvailableAt: nowSeconds() + OTP_RESEND_SECONDS,
        failedAttempts: 0,
        lockedUntil: 0,
      },
    })
    syncState(nextState)
    setOtpValue('')
    setError('')
    setMessage('Mã xác thực mới đã được gửi.')
    if (import.meta.env.DEV) {
      console.info('[AssessmentVerifyPage] OTP demo', OTP_DEMO_CODE)
    }
  }

  function handleVerify() {
    if (isLocked) return
    const normalized = toText(otpValue)
    if (normalized.length < 6) {
      setError('Vui lòng nhập đầy đủ mã xác thực gồm 6 chữ số.')
      return
    }
    if (normalized !== OTP_DEMO_CODE) {
      const nextAttempts = failedAttempts + 1
      const locked = nextAttempts >= 5 ? nowSeconds() + OTP_LOCK_SECONDS : 0
      const nextState = patchFlowState({
        verification: {
          ...(flowState?.verification || {}),
          failedAttempts: nextAttempts,
          lockedUntil: locked,
          resendAvailableAt: verification.resendAvailableAt || nowSeconds() + OTP_RESEND_SECONDS,
          emailVerified: false,
        },
      })
      syncState(nextState)
      setError(nextAttempts >= 5 ? 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 10 phút.' : 'Mã xác thực chưa đúng. Vui lòng kiểm tra và thử lại.')
      return
    }

    const nextState = patchFlowState({
      verification: {
        ...(flowState?.verification || {}),
        emailVerified: isEmailVerification,
        phoneVerified: !isEmailVerification,
        verifiedAt: new Date().toISOString(),
        failedAttempts: 0,
        lockedUntil: 0,
        returnToPath: returnToPath || '',
      },
      assessment: {
        ...(flowState?.assessment || {}),
        soundConfirmed: Boolean(assessment.soundConfirmed),
      },
      participation: {
        ...(flowState?.participation || {}),
        status: 'verified',
      },
    })
    syncState(nextState)
    setError('')
    setMessage(returnToPath ? 'Xác thực thành công. Đang quay lại trang kết quả...' : 'Xác thực thành công. Đang chuyển sang bước kiểm tra âm thanh...')
    window.setTimeout(() => navigate(returnToPath || soundCheckPath), 300)
  }

  if (!hasRequiredState) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CCard className='assessment-card'>
          <CCardBody className='p-4 p-md-5 text-center'>
            <div className='assessment-section-title'>Thông tin đăng ký chưa đầy đủ</div>
            <p className='assessment-section-lead mb-4'>Vui lòng quay lại bước nhập thông tin để tiếp tục.</p>
            <CButton color='primary' className='assessment-primary-cta' onClick={() => navigate(registerPath)}>QUAY LẠI NHẬP THÔNG TIN</CButton>
          </CCardBody>
        </CCard>
      </CContainer>
    )
  }

  return (
    <CContainer className='assessment-public-shell py-3 py-md-4'>
      <CCard className='assessment-card'>
        <CCardBody className='p-4 p-md-5'>
          <AssessmentProgress currentStep={2} totalSteps={6} label='Xác thực email' />
          <div className='assessment-section-title'>Xác thực email</div>
          <p className='assessment-section-lead mb-2'>Chúng tôi đã gửi mã xác thực gồm 6 chữ số tới:</p>
          <div className='fw-semibold fs-5 mb-4'>{displayTarget}</div>

          {import.meta.env.DEV ? <div className='assessment-secondary-note mb-3'>DEV only: OTP demo là {OTP_DEMO_CODE}</div> : null}
          {message ? <CAlert color='success'>{message}</CAlert> : null}
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          {isLocked ? <CAlert color='warning'>Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau {formatCountdown(lockedUntil - tick)}.</CAlert> : null}

          <OtpInput value={otpValue} setValue={setOtpValue} disabled={isLocked} />

          <div className='d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-4'>
            <div>
              <div className='assessment-secondary-note'>Chưa nhận được mã?</div>
              {resendRemaining > 0
                ? <div className='assessment-secondary-note'>Gửi lại mã sau {formatCountdown(resendRemaining)}</div>
                : <button type='button' className='btn btn-link p-0 text-decoration-none fw-semibold' onClick={handleResend}>GỬI LẠI MÃ</button>}
            </div>
            <div className='d-flex gap-3 flex-wrap'>
              <button type='button' className='btn btn-link p-0 text-decoration-none' onClick={() => navigate(registerPath)}>Email chưa đúng? Sửa thông tin</button>
              <CButton color='primary' className='assessment-primary-cta' onClick={handleVerify} disabled={isLocked}>XÁC THỰC & TIẾP TỤC</CButton>
            </div>
          </div>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}
