import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CContainer,
  CForm,
  CFormInput,
  CSpinner,
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import AdmissionV1Hero from '../components/AdmissionV1Hero'
import AdmissionV1GuideModal from '../components/AdmissionV1GuideModal'
import {
  buildAdmissionV1Permissions,
  buildAdmissionV1Path,
  getAdmissionV1CampaignStatusMessage,
  getAdmissionV1ErrorMessage,
  getPublicAdmissionCampaign,
  startAdmissionV1Registration,
} from '../services/admissionV1Service'
import './admission-v1.css'

const INITIAL_FORM = {
  fullName: '',
  email: '',
  phone: '',
}

export default function AdmissionV1DeclarantPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const resolvedTenantCode = useMemo(
    () => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(),
    [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode],
  )

  const statePayload = location.state || {}
  const initialStudentCode = String(statePayload?.studentCode || '').trim()
  const [campaign, setCampaign] = useState(statePayload?.campaign || null)
  const [studentCode, setStudentCode] = useState(initialStudentCode)
  const [form, setForm] = useState(INITIAL_FORM)
  const [loading, setLoading] = useState(!statePayload?.campaign)
  const [submitting, setSubmitting] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const campaignStatusMessage = getAdmissionV1CampaignStatusMessage(campaign)
  const campaignPermissions = buildAdmissionV1Permissions(campaign, null)

  useEffect(() => {
    let cancelled = false

    async function loadCampaign() {
      if (campaign) return

      setLoading(true)
      setErrorMessage('')

      try {
        const payload = await getPublicAdmissionCampaign(campaignCode, resolvedTenantCode)
        if (cancelled) return
        setCampaign(payload || null)
      } catch (error) {
        if (cancelled) return
        setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể tải thông tin kỳ tuyển sinh'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadCampaign()

    return () => {
      cancelled = true
    }
  }, [campaign, campaignCode, resolvedTenantCode])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    if (errorMessage) setErrorMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const normalizedStudentCode = String(studentCode || '').trim()
    const fullName = String(form.fullName || '').trim()
    const email = String(form.email || '').trim().toLowerCase()
    const phone = String(form.phone || '').trim()

    if (!normalizedStudentCode) {
      setErrorMessage('Vui lòng nhập mã học sinh')
      return
    }

    if (!fullName || !email || !phone) {
      setErrorMessage('Vui lòng nhập đầy đủ họ tên, email và số điện thoại')
      return
    }

    if (!campaignPermissions.canCreate) {
      setErrorMessage(campaignStatusMessage || 'Kỳ tuyển sinh hiện chưa nhận hồ sơ mới')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    try {
      const payload = await startAdmissionV1Registration({
        campaignCode,
        studentCode: normalizedStudentCode,
        fullName,
        email,
        phone,
      }, resolvedTenantCode)

      navigate(buildAdmissionV1Path(campaignCode, 'ma-ho-so', resolvedTenantCode), {
        replace: true,
        state: {
          campaign: payload?.campaign || campaign || null,
          studentCode: normalizedStudentCode,
          maskedEmail: payload?.maskedEmail || '',
          justSent: payload?.applicationCodeSent === true,
          canResendCode: true,
        },
      })
    } catch (error) {
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể bắt đầu khai hồ sơ tuyển sinh'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='admission-v1-shell py-4 py-lg-5'>
      <CContainer fluid className='admission-v1-content px-3 px-lg-4'>
        <AdmissionV1Hero campaign={campaign} campaignCode={campaignCode} resolvedTenantCode={resolvedTenantCode} allowAutoLoad={false} />

        <CCard className='admission-v1-card'>
          <CCardBody className='p-4 p-lg-5'>
                {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}
                {campaignStatusMessage ? <CAlert color='warning'>{campaignStatusMessage}</CAlert> : null}

                {loading ? (
                  <div className='text-center py-5'>
                    <CSpinner />
                  </div>
                ) : (
                  <CForm onSubmit={handleSubmit}>
                    <div className='admission-v1-form-head mb-4'>
                      <div>
                        <div className='fw-semibold fs-4 mb-2'>{campaign?.name || 'Kỳ tuyển sinh'}</div>
                        <div className='text-body-secondary'>Mã kỳ: {campaign?.code || '-'}</div>
                      </div>
                      <div className='admission-v1-actions'>
                        <CButton type='button' color='light' onClick={() => setShowGuideModal(true)} disabled={submitting}>
                          Xem lại hướng dẫn
                        </CButton>
                      </div>
                    </div>

                    <div className='mb-4'>
                      <label className='form-label fw-semibold' htmlFor='admission-v1-new-student-code'>Mã học sinh</label>
                      <CFormInput
                        id='admission-v1-new-student-code'
                        value={studentCode}
                        onChange={(event) => setStudentCode(event.target.value)}
                        placeholder='Ví dụ: HS240015'
                        autoComplete='off'
                        disabled={submitting}
                      />
                    </div>

                    <div className='mb-3'>
                      <label className='form-label fw-semibold' htmlFor='admission-v1-parent-fullName'>Họ và tên người khai</label>
                      <CFormInput
                        id='admission-v1-parent-fullName'
                        name='fullName'
                        value={form.fullName}
                        onChange={handleChange}
                        placeholder='Nhập họ và tên phụ huynh hoặc người khai'
                        autoComplete='name'
                        disabled={submitting}
                      />
                    </div>

                    <div className='mb-3'>
                      <label className='form-label fw-semibold' htmlFor='admission-v1-parent-email'>Email</label>
                      <CFormInput
                        id='admission-v1-parent-email'
                        type='email'
                        name='email'
                        value={form.email}
                        onChange={handleChange}
                        placeholder='Nhập email nhận thông tin tuyển sinh'
                        autoComplete='email'
                        disabled={submitting}
                      />
                    </div>

                    <div className='mb-4'>
                      <label className='form-label fw-semibold' htmlFor='admission-v1-parent-phone'>Số điện thoại</label>
                      <CFormInput
                        id='admission-v1-parent-phone'
                        name='phone'
                        value={form.phone}
                        onChange={handleChange}
                        placeholder='Nhập số điện thoại liên hệ'
                        autoComplete='tel'
                        disabled={submitting}
                      />
                    </div>

                    <div className='admission-v1-actions'>
                      <CButton type='button' color='light' onClick={() => navigate(buildAdmissionV1Path(campaignCode, '', resolvedTenantCode))} disabled={submitting}>
                        Quay lại
                      </CButton>
                      <CButton type='submit' color='success' disabled={submitting || !campaignPermissions.canCreate}>
                        {submitting ? 'Đang mở form...' : 'Tiếp tục khai hồ sơ'}
                      </CButton>
                    </div>
                  </CForm>
                )}
          </CCardBody>
        </CCard>
      </CContainer>

      <AdmissionV1GuideModal
        visible={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        campaign={campaign}
        fallbackContent='Sau khi nhập thông tin người khai, hệ thống sẽ tạo hồ sơ draft, tạo hoặc cập nhật tài khoản phụ huynh, rồi gửi mã hồ sơ vào email để phụ huynh tiếp tục nhập hồ sơ.'
      />
    </div>
  )
}