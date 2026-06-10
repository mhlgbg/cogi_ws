import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CListGroup,
  CListGroupItem,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import useTenantPageTitle from '../../../utils/useTenantPageTitle'
import AdmissionV1Hero from '../components/AdmissionV1Hero'
import {
  buildAdmissionExamCardPath,
  buildAdmissionV1Path,
  getAdmissionV1ErrorMessage,
  getApplicationStatusGuideKey,
  getPublicAdmissionCampaign,
  lookupAdmissionV1Result,
  openAdmissionV1Session,
  resendAdmissionV1ApplicationCode,
  storeAdmissionV1Token,
} from '../services/admissionV1Service'
import './admission-v1.css'

function getGuideColor(color) {
  const normalized = String(color || '').trim().toLowerCase()
  if (['success', 'danger', 'warning', 'info', 'secondary', 'primary'].includes(normalized)) {
    return normalized
  }

  return 'secondary'
}

export default function AdmissionResultLookupPage() {
  useTenantPageTitle('Tra cứu tuyển sinh')
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const resolvedTenantCode = useMemo(
    () => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(),
    [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode],
  )

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lookupSubmitting, setLookupSubmitting] = useState(false)
  const [openingApplication, setOpeningApplication] = useState(false)
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [studentCode, setStudentCode] = useState('')
  const [applicationCode, setApplicationCode] = useState('')
  const [forgotStudentCode, setForgotStudentCode] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  function resetLookupState() {
    setStudentCode('')
    setApplicationCode('')
    setForgotStudentCode('')
    setForgotEmail('')
    setResult(null)
    setErrorMessage('')
    setSuccessMessage('')
  }

  useEffect(() => {
    let isCancelled = false

    async function loadCampaign() {
      setLoading(true)
      setErrorMessage('')

      try {
        const payload = await getPublicAdmissionCampaign(campaignCode, resolvedTenantCode)
        if (!isCancelled) {
          setCampaign(payload || null)
        }
      } catch (error) {
        if (!isCancelled) {
          if (error?.response?.status === 404) {
            setCampaign(null)
            setErrorMessage(`Không tìm thấy kỳ tuyển sinh ${String(campaignCode || '').trim() || ''}`.trim())
          } else {
            setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể tải thông tin kỳ tuyển sinh'))
          }
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

  async function handleLookup(event) {
    event.preventDefault()

    const normalizedStudentCode = String(studentCode || '').trim()
    const normalizedApplicationCode = String(applicationCode || '').trim()
    if (!normalizedStudentCode || !normalizedApplicationCode) {
      setErrorMessage('Vui lòng nhập mã học sinh và mã hồ sơ')
      return
    }

    setLookupSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const payload = await lookupAdmissionV1Result({
        campaignCode,
        studentCode: normalizedStudentCode,
        applicationCode: normalizedApplicationCode,
      }, resolvedTenantCode)

      setResult(payload || null)
      setForgotStudentCode(normalizedStudentCode)
    } catch (error) {
      setResult(null)
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể tra cứu hồ sơ tuyển sinh'))
    } finally {
      setLookupSubmitting(false)
    }
  }

  async function handleOpenExistingApplication() {
    if (openingApplication || !result?.application?.studentCode || !result?.application?.applicationCode) return

    setOpeningApplication(true)
    setErrorMessage('')

    try {
      const payload = await openAdmissionV1Session({
        campaignCode,
        studentCode: result.application.studentCode,
        applicationCode: result.application.applicationCode,
      }, resolvedTenantCode)

      const token = String(payload?.token || '').trim()
      if (!token) {
        throw new Error('Không thể mở hồ sơ hiện tại')
      }

      storeAdmissionV1Token(campaignCode, token, resolvedTenantCode)
      const targetPath = payload?.permissions?.canEdit
        ? buildAdmissionV1Path(campaignCode, 'ho-so', resolvedTenantCode)
        : buildAdmissionV1Path(campaignCode, 'theo-doi', resolvedTenantCode)

      navigate(targetPath, {
        replace: false,
        state: {
          session: payload,
        },
      })
    } catch (error) {
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể mở hồ sơ hiện tại'))
    } finally {
      setOpeningApplication(false)
    }
  }

  async function handleForgotCode(event) {
    event.preventDefault()

    const normalizedStudentCode = String(forgotStudentCode || studentCode || '').trim()
    const normalizedEmail = String(forgotEmail || '').trim().toLowerCase()
    if (!normalizedStudentCode || !normalizedEmail) {
      setErrorMessage('Vui lòng nhập mã học sinh và email đã đăng ký')
      return
    }

    setForgotSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await resendAdmissionV1ApplicationCode({
        campaignCode,
        studentCode: normalizedStudentCode,
        email: normalizedEmail,
      }, resolvedTenantCode)
      setSuccessMessage('Nếu thông tin khớp với hồ sơ đã đăng ký, mã hồ sơ sẽ được gửi lại tới email của phụ huynh.')
      setShowForgotModal(false)
      setForgotEmail('')
    } catch (error) {
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể gửi lại mã hồ sơ'))
    } finally {
      setForgotSubmitting(false)
    }
  }

  const statusGuide = result?.statusGuide || null
  const application = result?.application || null
  const guideKey = getApplicationStatusGuideKey(application)
  const guideColor = getGuideColor(statusGuide?.color)
  const canOpenNeedUpdate = guideKey === 'need_update' && Boolean(application?.applicationCode)
  const shouldShowPendingNote = guideKey === 'submitted' || guideKey === 'reviewing'
  const examCard = result?.examCard || null
  const canViewExamCard = guideKey === 'accepted' && examCard?.canView === true && Boolean(application?.studentCode) && Boolean(application?.applicationCode)
  const examCardNotice = guideKey === 'accepted' ? String(examCard?.message || '').trim() : ''

  function handleOpenExamCard() {
    if (!application?.studentCode || !application?.applicationCode) return
    const targetPath = buildAdmissionExamCardPath(campaignCode, resolvedTenantCode, {
      studentCode: application.studentCode,
      applicationCode: application.applicationCode,
    })
    window.open(targetPath, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className='admission-v1-shell py-4 py-lg-5'>
      <CContainer fluid className='admission-v1-content px-3 px-lg-4'>
        <AdmissionV1Hero campaign={campaign} campaignCode={campaignCode} resolvedTenantCode={resolvedTenantCode} allowAutoLoad={false} />

        <CCard className='admission-v1-card mb-4'>
          <CCardBody className='p-4 p-lg-5'>
            <div className='admission-v1-step-chip mb-3'>Tra cứu kết quả tuyển sinh</div>
            <div className='fw-semibold fs-4 mb-2'>{campaign?.name || 'Kỳ tuyển sinh'}</div>
            <div className='text-body-secondary'>
              Chào mừng Quý phụ huynh đến với trang tra cứu kết quả xét duyệt hồ sơ và theo dõi các thông tin tiếp theo của kỳ tuyển sinh.
            </div>
          </CCardBody>
        </CCard>

        {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}
        {successMessage ? <CAlert color='success'>{successMessage}</CAlert> : null}

        {loading ? (
          <CCard className='admission-v1-card'>
            <CCardBody className='p-4 p-lg-5 text-center py-5'>
              <CSpinner />
            </CCardBody>
          </CCard>
        ) : (
          <CRow className='g-4'>
            <CCol xs={12} xl={5}>
              <CCard className='admission-v1-card h-100'>
                <CCardBody className='p-4 p-lg-5'>
                  <div className='fw-semibold fs-5 mb-3'>Tra cứu hồ sơ</div>
                  <CForm onSubmit={handleLookup}>
                    <div className='mb-3'>
                      <label className='form-label fw-semibold' htmlFor='admission-result-student-code'>Mã học sinh</label>
                      <CFormInput
                        id='admission-result-student-code'
                        value={studentCode}
                        onChange={(event) => {
                          setStudentCode(event.target.value)
                          setForgotStudentCode(event.target.value)
                        }}
                        placeholder='Nhập mã học sinh'
                        autoComplete='off'
                        disabled={lookupSubmitting || openingApplication}
                      />
                    </div>

                    <div className='mb-4'>
                      <label className='form-label fw-semibold' htmlFor='admission-result-application-code'>Mã hồ sơ</label>
                      <CFormInput
                        id='admission-result-application-code'
                        value={applicationCode}
                        onChange={(event) => setApplicationCode(event.target.value)}
                        placeholder='Nhập mã hồ sơ'
                        autoComplete='off'
                        disabled={lookupSubmitting || openingApplication}
                      />
                    </div>

                    <div className='admission-v1-actions'>
                      <CButton type='submit' color='success' disabled={lookupSubmitting || openingApplication}>
                        {lookupSubmitting ? 'Đang tra cứu...' : 'Tra cứu hồ sơ'}
                      </CButton>
                      <CButton type='button' color='light' onClick={() => setShowForgotModal(true)} disabled={lookupSubmitting || openingApplication}>
                        Quên mã hồ sơ?
                      </CButton>
                    </div>
                  </CForm>
                </CCardBody>
              </CCard>
            </CCol>

            <CCol xs={12} xl={7}>
              <CCard className='admission-v1-card h-100'>
                <CCardBody className='p-4 p-lg-5'>
                  {result ? (
                    <>
                      <div className='admission-v1-form-head mb-4'>
                        <div>
                          <div className='fw-semibold fs-5'>{application?.studentName || '-'}</div>
                          <div className='text-body-secondary small'>Mã học sinh: {application?.studentCode || '-'}</div>
                          <div className='text-body-secondary small'>Mã hồ sơ: {application?.applicationCode || '-'}</div>
                        </div>
                        <div className='d-flex align-items-center gap-2 flex-wrap justify-content-end'>
                          {canViewExamCard ? (
                            <CButton
                              color='danger'
                              onClick={handleOpenExamCard}
                              style={{ color: '#facc15', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.01em' }}
                            >
                              <span aria-hidden='true' style={{ marginRight: '8px', fontSize: '1.1em', lineHeight: 1 }}>🖨</span>
                              <span>Xem / In / Xuất PDF thẻ dự kiểm tra</span>
                            </CButton>
                          ) : null}
                          <CBadge color={guideColor}>{statusGuide?.title || 'Trạng thái hồ sơ'}</CBadge>
                        </div>
                      </div>

                      <CAlert color={guideColor} className='mb-4'>
                        <div className='fw-semibold mb-1'>{statusGuide?.title || 'Kết quả tra cứu'}</div>
                        <div>{statusGuide?.message || ''}</div>
                      </CAlert>

                      {Array.isArray(statusGuide?.nextSteps) && statusGuide.nextSteps.length > 0 ? (
                        <>
                          <div className='fw-semibold fs-6 mb-2'>Thông tin tiếp theo</div>
                          <CListGroup className='mb-4'>
                            {statusGuide.nextSteps.map((item, index) => (
                              <CListGroupItem key={`${index}-${item}`}>{item}</CListGroupItem>
                            ))}
                          </CListGroup>
                        </>
                      ) : null}

                      {shouldShowPendingNote ? (
                        <CAlert color='info' className='mb-4'>
                          Nhà trường đang rà soát hồ sơ. Phụ huynh vui lòng quay lại sau hoặc theo dõi thông báo tiếp theo.
                        </CAlert>
                      ) : null}

                      {examCardNotice ? (
                        <CAlert color={examCard?.status === 'pending' ? 'warning' : 'info'} className='mb-4'>
                          {examCardNotice}
                        </CAlert>
                      ) : null}

                      <div className='admission-v1-actions'>
                        {canOpenNeedUpdate ? (
                          <CButton color='warning' disabled={openingApplication} onClick={handleOpenExistingApplication}>
                            {openingApplication ? 'Đang mở hồ sơ...' : 'Vào hồ sơ để bổ sung'}
                          </CButton>
                        ) : null}
                        <CButton color='light' onClick={resetLookupState}>
                          Tra cứu hồ sơ khác
                        </CButton>
                      </div>
                    </>
                  ) : (
                    <div className='admission-v1-step-note'>
                      Phụ huynh vui lòng nhập mã học sinh và mã hồ sơ để xem kết quả xét duyệt và hướng dẫn tiếp theo.
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        )}
      </CContainer>

      <CModal visible={showForgotModal} onClose={() => !forgotSubmitting && setShowForgotModal(false)} alignment='center'>
        <CModalHeader>
          <CModalTitle>Gửi lại mã hồ sơ</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleForgotCode}>
          <CModalBody>
            <div className='mb-3'>
              <label className='form-label fw-semibold' htmlFor='admission-result-forgot-student-code'>Mã học sinh</label>
              <CFormInput
                id='admission-result-forgot-student-code'
                value={forgotStudentCode}
                onChange={(event) => setForgotStudentCode(event.target.value)}
                placeholder='Nhập mã học sinh'
                autoComplete='off'
                disabled={forgotSubmitting}
              />
            </div>
            <div>
              <label className='form-label fw-semibold' htmlFor='admission-result-forgot-email'>Email đã đăng ký</label>
              <CFormInput
                id='admission-result-forgot-email'
                type='email'
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                placeholder='Nhập email phụ huynh'
                autoComplete='email'
                disabled={forgotSubmitting}
              />
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton type='button' color='secondary' variant='outline' onClick={() => setShowForgotModal(false)} disabled={forgotSubmitting}>
              Đóng
            </CButton>
            <CButton type='submit' color='primary' disabled={forgotSubmitting}>
              {forgotSubmitting ? 'Đang gửi...' : 'Gửi lại mã hồ sơ'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </div>
  )
}