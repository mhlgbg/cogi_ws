import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
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
  getAdmissionV1ErrorMessage,
  getPublicAdmissionCampaign,
  lookupCandidateExamScore,
  resendAdmissionV1ApplicationCode,
  sendCandidateExamScoreReport,
} from '../services/admissionV1Service'
import './admission-v1.css'

const DEFAULT_SCORE_REPORT_TEMPLATE = `<div style="font-family:'Times New Roman',serif; max-width:800px; margin:0 auto; padding:24px; color:#111; border:1px solid #d9d9d9; background:#fff;">

  <div style="text-align:center; line-height:1.4;">
    <div style="font-size:15px; font-weight:bold;">UBND PHƯỜNG VIỆT HƯNG</div>
    <div style="font-size:16px; font-weight:bold;">TRƯỜNG THCS CHẤT LƯỢNG CAO CHU VĂN AN</div>
    <div style="margin-top:8px; font-size:13px;">--------------------</div>
  </div>

  <div style="text-align:center; margin-top:18px;">
    <div style="font-size:22px; font-weight:bold; color:#0d47a1;">PHIẾU BÁO ĐIỂM</div>
    <div style="font-size:16px; font-weight:bold; margin-top:4px;">Kỳ tuyển sinh vào lớp 6 - Năm học 2026 - 2027</div>
    <div style="font-size:14px; margin-top:4px;">Vòng 2: Kiểm tra đánh giá năng lực</div>
  </div>

  <div style="margin-top:22px; padding:14px 16px; border:1px solid #bcd0f7; border-left:5px solid #0d6efd; border-radius:8px; background:#f5f9ff;">
    <table style="width:100%; border-collapse:collapse; font-size:15px;">
      <tr><td style="width:32%; padding:5px 0;"><b>Họ và tên học sinh:</b></td><td>{{fullName}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Ngày sinh:</b></td><td>{{dateOfBirth}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Trường Tiểu học:</b></td><td>{{primarySchool}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Mã học sinh:</b></td><td>{{studentCode}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Mã hồ sơ:</b></td><td>{{applicationCode}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Số báo danh:</b></td><td><b>{{candidateNumber}}</b></td></tr>
      <tr><td style="padding:5px 0;"><b>Phòng thi:</b></td><td>{{examRoom}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Địa điểm thi:</b></td><td>{{examLocation}}</td></tr>
    </table>
  </div>

  <div style="margin-top:24px;">
    <table style="width:100%; border-collapse:collapse; font-size:15px; text-align:center;">
      <thead>
        <tr style="background:#0d6efd; color:white;">
          <th style="border:1px solid #999; padding:10px;">Môn</th>
          <th style="border:1px solid #999; padding:10px;">Điểm</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:1px solid #999; padding:10px; text-align:left;">Toán</td><td style="border:1px solid #999; padding:10px;">{{mathScore}}</td></tr>
        <tr><td style="border:1px solid #999; padding:10px; text-align:left;">Tiếng Việt</td><td style="border:1px solid #999; padding:10px;">{{vietnameseScore}}</td></tr>
        <tr><td style="border:1px solid #999; padding:10px; text-align:left;">Tiếng Anh</td><td style="border:1px solid #999; padding:10px;">{{englishScore}}</td></tr>
        <tr><td style="border:1px solid #999; padding:10px; text-align:left;">Điểm khuyến khích</td><td style="border:1px solid #999; padding:10px;">{{incentiveScore}}</td></tr>
        <tr style="background:#fff3cd; font-weight:bold;">
          <td style="border:1px solid #999; padding:12px; text-align:left;">Tổng điểm</td>
          <td style="border:1px solid #999; padding:12px; font-size:18px; color:#c00000;">{{totalScore}}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="margin-top:20px; padding:12px 14px; background:#f8f9fa; border-left:4px solid #6c757d; border-radius:6px; font-size:14px; line-height:1.6;">
    <b>Ghi chú:</b><br/>
    Phiếu báo điểm dùng để thông báo kết quả kiểm tra đánh giá năng lực của thí sinh trong kỳ tuyển sinh vào lớp 6 năm học 2026 - 2027.
    Phụ huynh vui lòng tiếp tục theo dõi các thông báo tiếp theo của Nhà trường trên hệ thống tuyển sinh.
  </div>

  <div style="margin-top:28px; display:flex; justify-content:space-between; align-items:flex-start; font-size:14px;">
    <div>
      <b>Ngày tra cứu:</b> {{lookupDate}}<br/>
      <b>Trạng thái thí sinh:</b> {{candidateExamStatus}}
    </div>
    <div style="text-align:center; min-width:220px;">
      <i>Hà Nội, ngày {{day}} tháng {{month}} năm {{year}}</i><br/>
      <b>TRƯỜNG THCS CLC CHU VĂN AN</b>
    </div>
  </div>

</div>`

function normalizeText(value) {
  return String(value || '').trim()
}

function formatDate(value) {
  const text = normalizeText(value)
  if (!text) return '-'
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '-'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  if (Number.isInteger(parsed)) return String(parsed)
  return String(Number(parsed.toFixed(2)))
}

function formatCandidateStatus(value) {
  const normalized = normalizeText(value).toLowerCase()
  if (normalized === 'draft') return 'Chưa sẵn sàng'
  if (normalized === 'ready') return 'Sẵn sàng'
  if (normalized === 'card_downloaded') return 'Đã tải thẻ'
  if (normalized === 'checked_in') return 'Đã điểm danh'
  if (normalized === 'absent') return 'Vắng thi'
  if (normalized === 'completed') return 'Đã hoàn thành'
  if (normalized === 'cancelled') return 'Đã hủy'
  return normalizeText(value) || '-'
}

function buildLookupContext(candidate, campaign) {
  const now = new Date()
  return {
    fullName: normalizeText(candidate?.fullName) || '-',
    dateOfBirth: formatDate(candidate?.dateOfBirth),
    primarySchool: normalizeText(candidate?.primarySchool) || '-',
    studentCode: normalizeText(candidate?.studentCode) || '-',
    applicationCode: normalizeText(candidate?.applicationCode) || '-',
    candidateNumber: normalizeText(candidate?.candidateNumber) || '-',
    examRoom: normalizeText(candidate?.examRoom) || '-',
    examLocation: normalizeText(candidate?.examLocation) || '-',
    mathScore: formatScore(candidate?.mathScore),
    vietnameseScore: formatScore(candidate?.vietnameseScore),
    englishScore: formatScore(candidate?.englishScore),
    incentiveScore: formatScore(candidate?.incentiveScore),
    totalScore: formatScore(candidate?.totalScore),
    candidateExamStatus: formatCandidateStatus(candidate?.candidateExamStatus),
    campaignName: normalizeText(campaign?.name) || '-',
    lookupDate: new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now),
    day: String(now.getDate()).padStart(2, '0'),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  }
}

function applyTemplate(template, context) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_matched, key) => {
    return String(context?.[key] ?? '-')
  })
}

export default function CandidateExamScoreLookupPage() {
  useTenantPageTitle('Tra cứu điểm')
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const resolvedTenantCode = useMemo(
    () => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(),
    [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode],
  )

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lookupSubmitting, setLookupSubmitting] = useState(false)
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [sendReportSubmitting, setSendReportSubmitting] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [showSendReportModal, setShowSendReportModal] = useState(false)
  const [studentCode, setStudentCode] = useState('')
  const [applicationCode, setApplicationCode] = useState('')
  const [forgotStudentCode, setForgotStudentCode] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

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

    const normalizedStudentCode = normalizeText(studentCode)
    const normalizedApplicationCode = normalizeText(applicationCode)
    if (!normalizedStudentCode || !normalizedApplicationCode) {
      setErrorMessage('Vui lòng nhập mã học sinh và mã hồ sơ')
      return
    }

    setLookupSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const payload = await lookupCandidateExamScore({
        campaignCode,
        studentCode: normalizedStudentCode,
        applicationCode: normalizedApplicationCode,
      }, resolvedTenantCode)

      setResult(payload || null)
      setForgotStudentCode(normalizedStudentCode)
    } catch (error) {
      setResult(null)
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể tra cứu điểm'))
    } finally {
      setLookupSubmitting(false)
    }
  }

  async function handleForgotCode(event) {
    event.preventDefault()

    const normalizedStudentCode = normalizeText(forgotStudentCode || studentCode)
    const normalizedEmail = normalizeText(forgotEmail).toLowerCase()
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

  async function handleSendScoreReport() {
    if (!result?.candidate) return

    setSendReportSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const payload = await sendCandidateExamScoreReport({
        campaignCode,
        studentCode: normalizeText(result?.candidate?.studentCode || studentCode),
        applicationCode: normalizeText(result?.candidate?.applicationCode || applicationCode),
      }, resolvedTenantCode)

      setResult((prev) => ({
        ...(prev || {}),
        scoreReportMail: {
          ...(prev?.scoreReportMail || {}),
          registeredEmail: payload?.registeredEmail || prev?.scoreReportMail?.registeredEmail || '',
          isSent: Boolean(payload?.isSent),
          sentAt: payload?.sentAt || null,
        },
      }))
      setSuccessMessage('Phiếu báo điểm đã được gửi tới email đã đăng ký.')
      setShowSendReportModal(false)
    } catch (error) {
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể gửi phiếu báo điểm'))
    } finally {
      setSendReportSubmitting(false)
    }
  }

  const scoreReportHtml = useMemo(() => {
    if (!result?.candidate) return ''
    const template = normalizeText(campaign?.scoreReportTemplateHtml) || DEFAULT_SCORE_REPORT_TEMPLATE
    return applyTemplate(template, buildLookupContext(result.candidate, result.campaign || campaign))
  }, [campaign, result])

  const scoreReportMail = result?.scoreReportMail || null
  const canOpenSendScoreReport = Boolean(result?.candidate)
  const canSendScoreReport = Boolean(scoreReportMail?.registeredEmail) && !Boolean(scoreReportMail?.isSent) && !sendReportSubmitting

  return (
    <div className='admission-v1-shell py-4 py-lg-5'>
      <CContainer fluid className='admission-v1-content px-3 px-lg-4'>
        <AdmissionV1Hero campaign={campaign} campaignCode={campaignCode} resolvedTenantCode={resolvedTenantCode} allowAutoLoad={false} />

        <CCard className='admission-v1-card mb-4'>
          <CCardBody className='p-4 p-lg-5'>
            <div className='admission-v1-step-chip mb-3'>Tra cứu điểm vòng 2</div>
            <div className='fw-semibold fs-4 mb-2'>Chào mừng Quý phụ huynh và thí sinh đến với trang tra cứu kết quả kiểm tra đánh giá năng lực.</div>
            <div className='text-body-secondary'>Phụ huynh vui lòng nhập mã học sinh và mã hồ sơ để tra cứu kết quả.</div>
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
                  <div className='fw-semibold fs-5 mb-3'>Tra cứu điểm</div>
                  <CForm onSubmit={handleLookup}>
                    <div className='mb-3'>
                      <label className='form-label fw-semibold' htmlFor='candidate-score-student-code'>Mã học sinh</label>
                      <CFormInput
                        id='candidate-score-student-code'
                        value={studentCode}
                        onChange={(event) => {
                          setStudentCode(event.target.value)
                          setForgotStudentCode(event.target.value)
                        }}
                        placeholder='Nhập mã học sinh'
                        autoComplete='off'
                        disabled={lookupSubmitting}
                      />
                    </div>

                    <div className='mb-4'>
                      <label className='form-label fw-semibold' htmlFor='candidate-score-application-code'>Mã hồ sơ</label>
                      <CFormInput
                        id='candidate-score-application-code'
                        value={applicationCode}
                        onChange={(event) => setApplicationCode(event.target.value)}
                        placeholder='Nhập mã hồ sơ'
                        autoComplete='off'
                        disabled={lookupSubmitting}
                      />
                    </div>

                    <div className='admission-v1-actions'>
                      <CButton type='submit' color='success' disabled={lookupSubmitting}>
                        {lookupSubmitting ? 'Đang tra cứu...' : 'Tra cứu điểm'}
                      </CButton>
                      <CButton type='button' color='light' onClick={() => setShowForgotModal(true)} disabled={lookupSubmitting}>
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
                  {result?.candidate ? (
                    <>
                      <div dangerouslySetInnerHTML={{ __html: scoreReportHtml }} />
                      <div className='mt-4 pt-3 border-top d-flex flex-column gap-2 align-items-start'>
                        <div className='small text-body-secondary'>
                          Email đăng ký: <strong>{scoreReportMail?.registeredEmail || 'Chưa có email đăng ký hợp lệ'}</strong>
                        </div>
                        <div className='small text-body-secondary'>
                          Tình trạng gửi phiếu báo điểm: <strong>{scoreReportMail?.isSent ? `Đã gửi${scoreReportMail?.sentAt ? ` lúc ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(scoreReportMail.sentAt))}` : ''}` : 'Chưa gửi'}</strong>
                        </div>
                        <CButton color='primary' onClick={() => setShowSendReportModal(true)} disabled={!canOpenSendScoreReport}>
                          Gửi email phiếu báo điểm
                        </CButton>
                      </div>
                    </>
                  ) : (
                    <div className='text-body-secondary'>Kết quả tra cứu điểm sẽ hiển thị tại đây sau khi nhập đúng mã học sinh và mã hồ sơ.</div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        )}

        <CModal visible={showForgotModal} onClose={() => !forgotSubmitting && setShowForgotModal(false)}>
          <CModalHeader>
            <CModalTitle>Gửi lại mã hồ sơ</CModalTitle>
          </CModalHeader>
          <CForm onSubmit={handleForgotCode}>
            <CModalBody>
              <div className='mb-3'>
                <label className='form-label fw-semibold' htmlFor='candidate-score-forgot-student-code'>Mã học sinh</label>
                <CFormInput
                  id='candidate-score-forgot-student-code'
                  value={forgotStudentCode}
                  onChange={(event) => setForgotStudentCode(event.target.value)}
                  placeholder='Nhập mã học sinh'
                  autoComplete='off'
                  disabled={forgotSubmitting}
                />
              </div>
              <div>
                <label className='form-label fw-semibold' htmlFor='candidate-score-forgot-email'>Email đã đăng ký</label>
                <CFormInput
                  id='candidate-score-forgot-email'
                  type='email'
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  placeholder='Nhập email phụ huynh đã đăng ký'
                  autoComplete='email'
                  disabled={forgotSubmitting}
                />
              </div>
            </CModalBody>
            <CModalFooter>
              <CButton color='secondary' variant='outline' onClick={() => setShowForgotModal(false)} disabled={forgotSubmitting}>Hủy</CButton>
              <CButton type='submit' color='primary' disabled={forgotSubmitting}>{forgotSubmitting ? 'Đang gửi...' : 'Gửi lại mã hồ sơ'}</CButton>
            </CModalFooter>
          </CForm>
        </CModal>

        <CModal visible={showSendReportModal} onClose={() => !sendReportSubmitting && setShowSendReportModal(false)} backdrop='static'>
          <CModalHeader>
            <CModalTitle>Gửi email phiếu báo điểm</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <div className='mb-3'>
              <div className='fw-semibold'>Email đã đăng ký</div>
              <div>{scoreReportMail?.registeredEmail || 'Chưa có email đăng ký hợp lệ'}</div>
            </div>
            <div>
              <div className='fw-semibold'>Tình trạng gửi</div>
              <div>{scoreReportMail?.isSent ? 'Đã gửi thư báo điểm' : 'Chưa gửi thư báo điểm'}</div>
            </div>
            {!scoreReportMail?.registeredEmail ? (
              <CAlert color='warning' className='mt-3 mb-0'>Không tìm thấy email đăng ký hợp lệ để gửi phiếu báo điểm.</CAlert>
            ) : null}
            {scoreReportMail?.isSent ? (
              <CAlert color='info' className='mt-3 mb-0'>Phiếu báo điểm đã được gửi trước đó nên hệ thống sẽ không gửi lại.</CAlert>
            ) : null}
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={() => setShowSendReportModal(false)} disabled={sendReportSubmitting}>
              {scoreReportMail?.isSent ? 'Đóng' : 'Hủy'}
            </CButton>
            <CButton color='primary' onClick={handleSendScoreReport} disabled={!canSendScoreReport}>
              {sendReportSubmitting ? 'Đang gửi...' : 'OK'}
            </CButton>
          </CModalFooter>
        </CModal>
      </CContainer>
    </div>
  )
}