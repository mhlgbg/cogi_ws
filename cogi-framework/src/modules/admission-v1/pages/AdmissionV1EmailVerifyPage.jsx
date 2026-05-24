import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CForm,
  CFormInput,
  CContainer,
  CSpinner,
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import AdmissionV1Hero from '../components/AdmissionV1Hero'
import AdmissionV1GuideModal from '../components/AdmissionV1GuideModal'
import {
  buildAdmissionV1Path,
  getAdmissionV1ErrorMessage,
  getPublicAdmissionCampaign,
  openAdmissionV1Session,
  resendAdmissionV1ApplicationCode,
  storeAdmissionV1Token,
} from '../services/admissionV1Service'
import './admission-v1.css'

export default function AdmissionV1EmailVerifyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const resolvedTenantCode = useMemo(
    () => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(),
    [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode],
  )

  const statePayload = location.state || {}
  const [campaign, setCampaign] = useState(statePayload?.campaign || null)
  const [studentCode, setStudentCode] = useState(String(statePayload?.studentCode || '').trim())
  const [applicationCode, setApplicationCode] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [loading, setLoading] = useState(!statePayload?.campaign)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState(
    statePayload?.justSent
      ? `Chúng tôi vừa gửi mã hồ sơ vào ${statePayload?.maskedEmail || 'email đã đăng ký'}. Vui lòng kiểm tra email và nhập mã để tiếp tục.`
      : '',
  )

  useEffect(() => {
    let isCancelled = false

    async function loadCampaign() {
      try {
        if (campaign) return

        const payload = await getPublicAdmissionCampaign(campaignCode, resolvedTenantCode)
        if (isCancelled) return
        setCampaign(payload || null)
      } catch (error) {
        if (isCancelled) return
        setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể tải thông tin kỳ tuyển sinh'))
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadCampaign()

    return () => {
      isCancelled = true
    }
  }, [campaign, campaignCode, resolvedTenantCode])

  async function handleOpenSession(event) {
    event.preventDefault()

    const normalizedStudentCode = String(studentCode || '').trim()
    const normalizedApplicationCode = String(applicationCode || '').trim()
    if (!normalizedStudentCode || !normalizedApplicationCode) {
      setErrorMessage('Vui lòng nhập mã học sinh và mã hồ sơ')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const payload = await openAdmissionV1Session({
        campaignCode,
        studentCode: normalizedStudentCode,
        applicationCode: normalizedApplicationCode,
      }, resolvedTenantCode)

      const token = String(payload?.token || '').trim()
      if (!token) {
        throw new Error('Không thể mở phiên hồ sơ tuyển sinh')
      }

      storeAdmissionV1Token(campaignCode, token, resolvedTenantCode)

      const targetPath = payload?.permissions?.canEdit
        ? buildAdmissionV1Path(campaignCode, 'ho-so', resolvedTenantCode)
        : buildAdmissionV1Path(campaignCode, 'theo-doi', resolvedTenantCode)

      navigate(targetPath, {
        replace: true,
        state: {
          session: payload,
        },
      })
    } catch (error) {
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể mở hồ sơ bằng mã đã nhập'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResendCode(event) {
    event.preventDefault()

    const normalizedStudentCode = String(studentCode || '').trim()
    const normalizedEmail = String(resendEmail || '').trim().toLowerCase()
    if (!normalizedStudentCode || !normalizedEmail) {
      setErrorMessage('Vui lòng nhập mã học sinh và email đã đăng ký')
      return
    }

    setResending(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const payload = await resendAdmissionV1ApplicationCode({
        campaignCode,
        studentCode: normalizedStudentCode,
        email: normalizedEmail,
      }, resolvedTenantCode)

      setSuccessMessage(`Chúng tôi đã gửi lại mã hồ sơ vào ${payload?.maskedEmail || normalizedEmail}. Vui lòng kiểm tra email để tiếp tục.`)
    } catch (error) {
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể cấp lại mã hồ sơ'))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className='admission-v1-shell py-4 py-lg-5'>
      <CContainer fluid className='admission-v1-content px-3 px-lg-4'>
        <AdmissionV1Hero campaign={campaign} campaignCode={campaignCode} resolvedTenantCode={resolvedTenantCode} allowAutoLoad={false} />

        <CCard className='admission-v1-card'>
          <CCardBody className='p-4 p-lg-5'>
                {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}
                {successMessage ? <CAlert color='success'>{successMessage}</CAlert> : null}

                {loading ? (
                  <div className='text-center py-5'>
                    <CSpinner />
                  </div>
                ) : (
                  <>
                    <div className='admission-v1-form-head mb-4'>
                      <div>
                        <div className='fw-semibold fs-4 mb-2'>{campaign?.name || 'Kỳ tuyển sinh'}</div>
                        <div className='text-body-secondary'>Mã kỳ: {campaign?.code || '-'}</div>
                      </div>
                      <div className='admission-v1-actions'>
                        <CButton type='button' color='light' onClick={() => setShowGuideModal(true)} disabled={submitting || resending}>
                          Xem lại hướng dẫn
                        </CButton>
                      </div>
                    </div>

                    <CForm onSubmit={handleOpenSession}>
                      <div className='mb-3'>
                        <label className='form-label fw-semibold' htmlFor='admission-v1-code-student-code'>Mã học sinh</label>
                        <CFormInput
                          id='admission-v1-code-student-code'
                          value={studentCode}
                          onChange={(event) => setStudentCode(event.target.value)}
                          placeholder='Ví dụ: HS240015'
                          autoComplete='off'
                          disabled={submitting || resending}
                        />
                      </div>

                      <div className='mb-4'>
                        <label className='form-label fw-semibold' htmlFor='admission-v1-application-code'>Mã hồ sơ</label>
                        <CFormInput
                          id='admission-v1-application-code'
                          value={applicationCode}
                          onChange={(event) => setApplicationCode(event.target.value)}
                          placeholder='Ví dụ: TENANT0123'
                          autoComplete='off'
                          disabled={submitting || resending}
                        />
                      </div>

                      <div className='admission-v1-actions'>
                        <CButton type='button' color='light' onClick={() => navigate(buildAdmissionV1Path(campaignCode, '', resolvedTenantCode))} disabled={submitting || resending}>
                          Quay lại
                        </CButton>
                        <CButton type='submit' color='success' disabled={submitting || resending}>
                          {submitting ? 'Đang mở hồ sơ...' : 'Tiếp tục vào hồ sơ'}
                        </CButton>
                      </div>
                    </CForm>

                    <hr className='my-4' />

                    <div className='fw-semibold fs-5 mb-3'>Quên mã hồ sơ?</div>
                    <div className='text-body-secondary mb-3'>Nhập email đã đăng ký để hệ thống gửi lại mã hồ sơ của học sinh trong kỳ tuyển sinh này.</div>
                    <CForm onSubmit={handleResendCode}>
                      <div className='mb-3'>
                        <label className='form-label fw-semibold' htmlFor='admission-v1-resend-email'>Email đã đăng ký</label>
                        <CFormInput
                          id='admission-v1-resend-email'
                          type='email'
                          value={resendEmail}
                          onChange={(event) => setResendEmail(event.target.value)}
                          placeholder={statePayload?.maskedEmail ? `Ví dụ: ${statePayload.maskedEmail}` : 'Nhập email phụ huynh'}
                          autoComplete='email'
                          disabled={submitting || resending}
                        />
                      </div>

                      <div className='admission-v1-actions'>
                        <CButton type='submit' color='secondary' disabled={submitting || resending}>
                          {resending ? 'Đang gửi lại...' : 'Gửi lại mã hồ sơ'}
                        </CButton>
                      </div>
                    </CForm>
                  </>
                )}
          </CCardBody>
        </CCard>
      </CContainer>

      <AdmissionV1GuideModal
        visible={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        campaign={campaign}
        fallbackContent='Phụ huynh nhập mã hồ sơ đã nhận qua email để mở form khai hồ sơ hoặc xem tiến độ xét tuyển.'
      />
    </div>
  )
}