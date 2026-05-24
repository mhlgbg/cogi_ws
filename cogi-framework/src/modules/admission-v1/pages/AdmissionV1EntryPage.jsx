import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import AdmissionV1Hero from '../components/AdmissionV1Hero'
import {
  buildAdmissionV1Path,
  getAdmissionV1ErrorMessage,
  getPublicAdmissionCampaign,
  lookupAdmissionV1Access,
} from '../services/admissionV1Service'
import './admission-v1.css'

function hasHtmlContent(value) {
  return /<[^>]+>/.test(String(value || ''))
}

function renderCampaignGuidance(campaign) {
  if (campaign?.description) {
    if (hasHtmlContent(campaign.description)) {
      return <div dangerouslySetInnerHTML={{ __html: campaign.description }} />
    }

    return <div className='text-body-secondary' style={{ whiteSpace: 'pre-line' }}>{campaign.description}</div>
  }

  return (
    <div className='text-body-secondary'>Hệ thống tuyển sinh trực tuyến hỗ trợ phụ huynh:<br />
      - Đăng ký hồ sơ tuyển sinh<br />
      - Nhận mã hồ sơ qua email<br />
      - Theo dõi tình trạng xử lý hồ sơ<br />
      - Cập nhật thông tin theo yêu cầu của nhà trường</div>
  )
}

export default function AdmissionV1EntryPage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const [campaign, setCampaign] = useState(null)
  const resolvedTenantCode = useMemo(
    () => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(),
    [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode],
  )
  const [studentCode, setStudentCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [entryStep, setEntryStep] = useState('intro')
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const hasCampaign = Boolean(campaign?.code)

  useEffect(() => {
    let isCancelled = false

    async function loadCampaign() {
      setLoading(true)
      setErrorMessage('')

      try {
        const payload = await getPublicAdmissionCampaign(campaignCode, resolvedTenantCode)
        if (isCancelled) return
        setCampaign(payload || null)
      } catch (error) {
        if (isCancelled) return
        if (error?.response?.status === 404) {
          setCampaign(null)
          setErrorMessage(`Không tìm thấy kỳ tuyển sinh ${String(campaignCode || '').trim() || ''}`.trim())
        } else {
          setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể tải thông tin kỳ tuyển sinh'))
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    if (campaignCode) {
      loadCampaign()
    } else {
      setLoading(false)
      setErrorMessage('Không tìm thấy kỳ tuyển sinh')
    }

    return () => {
      isCancelled = true
    }
  }, [campaignCode, resolvedTenantCode])

  async function handleSubmit(event) {
    event.preventDefault()

    const normalizedStudentCode = String(studentCode || '').trim()
    if (!normalizedStudentCode) {
      setErrorMessage('Vui lòng nhập mã học sinh')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    try {
      const payload = await lookupAdmissionV1Access({
        campaignCode,
        studentCode: normalizedStudentCode,
      }, resolvedTenantCode)

      if (payload?.exists) {
        navigate(buildAdmissionV1Path(campaignCode, 'ma-ho-so', resolvedTenantCode), {
          state: {
            studentCode: normalizedStudentCode,
            learner: payload?.learner || null,
            campaign: payload?.campaign || campaign,
            maskedEmail: payload?.maskedEmail || '',
            canResendCode: payload?.canResendCode === true,
          },
        })
        return
      }

      navigate(buildAdmissionV1Path(campaignCode, 'nguoi-khai', resolvedTenantCode), {
        state: {
          campaign: payload?.campaign || campaign || null,
          studentCode: normalizedStudentCode,
        },
      })
    } catch (error) {
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể tiếp tục tra cứu hồ sơ tuyển sinh'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenCodeStep() {
    setErrorMessage('')
    setEntryStep('student-code')
  }

  function handleBackToGuide() {
    setErrorMessage('')
    setEntryStep('intro')
  }

  return (
    <div className='admission-v1-shell py-4 py-lg-5'>
      <CContainer fluid className='admission-v1-content px-3 px-lg-4'>
        <AdmissionV1Hero campaign={campaign} campaignCode={campaignCode} resolvedTenantCode={resolvedTenantCode} allowAutoLoad={false} />

        {loading ? (
          <CCard className='admission-v1-card'>
            <CCardBody className='p-4 p-lg-5 text-center py-5'>
              <CSpinner />
            </CCardBody>
          </CCard>
        ) : !hasCampaign ? (
          <CCard className='admission-v1-card'>
            <CCardBody className='p-4 p-lg-5'>
              {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}
              <div className='text-body-secondary'>Không thể mở trang tuyển sinh vì không tìm thấy kỳ tuyển sinh tương ứng.</div>
            </CCardBody>
          </CCard>
        ) : entryStep === 'intro' ? (
          <CCard className='admission-v1-card'>
            <CCardBody className='p-4 p-lg-5'>
              {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}

              <div className='admission-v1-step-chip mb-3'>Bước 1: Xem hướng dẫn</div>
              <div className='mb-4'>
                <div className='fw-semibold fs-4 mb-2'>{campaign?.name || 'Kỳ tuyển sinh'}</div>
                <div className='text-body-secondary'>Mã kỳ: {campaign?.code || '-'}</div>
              </div>

              <div className='admission-v1-step-note mb-4'>
                Phụ huynh vui lòng đọc kỹ mô tả của kỳ tuyển sinh, chuẩn bị sẵn mã học sinh và các thông tin cần thiết trước khi sang bước tiếp theo.
              </div>

              <div className='fw-semibold fs-5 mb-3'>Hướng dẫn tuyển sinh</div>
              <div className='mb-4'>
                {renderCampaignGuidance(campaign)}
              </div>

              <div className='admission-v1-actions'>
                <CButton color='success' onClick={handleOpenCodeStep}>Sang bước tiếp theo</CButton>
              </div>
            </CCardBody>
          </CCard>
        ) : (
          <CRow className='g-4'>
            <CCol xs={12}>
              <CCard className='admission-v1-card'>
                <CCardBody className='p-4 p-lg-5'>
                  {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}

                  <div className='admission-v1-form-head mb-4'>
                    <div>
                      <div className='admission-v1-step-chip mb-3'>Bước 2: Nhập mã học sinh</div>
                      <div className='fw-semibold fs-4 mb-2'>{campaign?.name || 'Kỳ tuyển sinh'}</div>
                      <div className='text-body-secondary'>Mã kỳ: {campaign?.code || '-'}</div>
                    </div>

                    <div className='admission-v1-actions'>
                      <CButton color='light' onClick={() => setShowGuideModal(true)}>Xem lại hướng dẫn</CButton>
                      <CButton color='light' variant='outline' onClick={handleBackToGuide}>Quay lại bước 1</CButton>
                    </div>
                  </div>

                  <CForm onSubmit={handleSubmit}>
                    <div className='admission-v1-step-note mb-4'>
                      Nhập mã học sinh để tiếp tục đăng ký hoặc theo dõi tình trạng hồ sơ tuyển sinh trực tuyến.
                    </div>

                    <div className='mb-4'>
                      <label className='form-label fw-semibold' htmlFor='admission-v1-student-code'>Mã học sinh</label>
                      <CFormInput
                        id='admission-v1-student-code'
                        value={studentCode}
                        onChange={(event) => setStudentCode(event.target.value)}
                        placeholder='Nhập mã học sinh'
                        autoComplete='off'
                        disabled={submitting}
                      />
                      <div className='form-text'>Mã học sinh được cấp trong phiếu đăng ký tuyển sinh của trường Tiểu học (Mã định danh Bộ giáo dục).</div>
                    </div>

                    <div className='admission-v1-actions'>
                      <CButton type='submit' color='success' disabled={submitting}>
                        {submitting ? 'Đang xử lý...' : 'Tiếp tục'}
                      </CButton>
                    </div>
                  </CForm>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        )}
      </CContainer>

      <CModal visible={showGuideModal} onClose={() => setShowGuideModal(false)} alignment='center' size='lg'>
        <CModalHeader>
          <CModalTitle>Hướng dẫn kỳ tuyển sinh</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <div className='fw-semibold'>{campaign?.name || 'Kỳ tuyển sinh'}</div>
            <div className='text-body-secondary'>Mã kỳ: {campaign?.code || '-'}</div>
          </div>
          {renderCampaignGuidance(campaign)}
        </CModalBody>
      </CModal>
    </div>
  )
}