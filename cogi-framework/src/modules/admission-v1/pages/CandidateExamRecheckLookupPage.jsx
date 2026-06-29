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
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import useTenantPageTitle from '../../../utils/useTenantPageTitle'
import AdmissionV1Hero from '../components/AdmissionV1Hero'
import {
  getAdmissionV1ErrorMessage,
  getPublicAdmissionCampaign,
  lookupCandidateExamScore,
} from '../services/admissionV1Service'
import './admission-v1.css'

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

function isRecheckEnabled(value) {
  if (value === true || value === 1) return true
  const normalized = normalizeText(value).toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'co' || normalized === 'có'
}

function normalizeScoreNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasScoreChanged(oldScore, newScore) {
  const oldValue = normalizeScoreNumber(oldScore)
  const newValue = normalizeScoreNumber(newScore)
  if (oldValue === null || newValue === null) return false
  return oldValue !== newValue
}

export default function CandidateExamRecheckLookupPage() {
  useTenantPageTitle('Tra cứu phúc khảo của vòng 2')
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const resolvedTenantCode = useMemo(
    () => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(),
    [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode],
  )

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lookupSubmitting, setLookupSubmitting] = useState(false)
  const [studentCode, setStudentCode] = useState('')
  const [applicationCode, setApplicationCode] = useState('')
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

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

    try {
      const payload = await lookupCandidateExamScore({
        campaignCode,
        studentCode: normalizedStudentCode,
        applicationCode: normalizedApplicationCode,
      }, resolvedTenantCode)

      setResult(payload || null)
    } catch (error) {
      setResult(null)
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể tra cứu kết quả phúc khảo'))
    } finally {
      setLookupSubmitting(false)
    }
  }

  const candidate = result?.candidate

  const recheckSubjects = []
  if (isRecheckEnabled(candidate?.recheckMath)) {
    recheckSubjects.push({
      name: 'Toán',
      oldScore: formatScore(candidate?.mathScore),
      newScore: formatScore(candidate?.recheckMathScore),
      hasChange: hasScoreChanged(candidate?.mathScore, candidate?.recheckMathScore),
    })
  }
  if (isRecheckEnabled(candidate?.recheckVietnamese)) {
    recheckSubjects.push({
      name: 'Tiếng Việt',
      oldScore: formatScore(candidate?.vietnameseScore),
      newScore: formatScore(candidate?.recheckVietnameseScore),
      hasChange: hasScoreChanged(candidate?.vietnameseScore, candidate?.recheckVietnameseScore),
    })
  }
  if (isRecheckEnabled(candidate?.recheckEnglish)) {
    recheckSubjects.push({
      name: 'Tiếng Anh',
      oldScore: formatScore(candidate?.englishScore),
      newScore: formatScore(candidate?.recheckEnglishScore),
      hasChange: hasScoreChanged(candidate?.englishScore, candidate?.recheckEnglishScore),
    })
  }

  const hasRecheck = recheckSubjects.length > 0
  const hasAnyChange = recheckSubjects.some((subject) => subject.hasChange)

  // Tính tổng điểm cũ (trước phúc khảo)
  const oldTotal = useMemo(() => {
    if (!candidate) return null
    let total = 0
    const math = Number(candidate.mathScore || 0)
    const vietnamese = Number(candidate.vietnameseScore || 0)
    const english = Number(candidate.englishScore || 0)
    const incentive = Number(candidate.incentiveScore || 0)
    total = math + vietnamese + english + incentive
    return total
  }, [candidate])

  return (
    <div className='admission-v1-shell py-4 py-lg-5'>
      <CContainer fluid className='admission-v1-content px-3 px-lg-4'>
        <AdmissionV1Hero campaign={campaign} campaignCode={campaignCode} resolvedTenantCode={resolvedTenantCode} allowAutoLoad={false} />

        <CCard className='admission-v1-card mb-4'>
          <CCardBody className='p-4 p-lg-5'>
            <div className='admission-v1-step-chip mb-3'>Tra cứu phúc khảo của vòng 2</div>
            <div className='fw-semibold fs-4 mb-2'>Tra cứu phúc khảo của vòng 2</div>
            <div className='text-body-secondary'>Phụ huynh vui lòng nhập mã học sinh và mã hồ sơ để tra cứu kết quả phúc khảo.</div>
          </CCardBody>
        </CCard>

        {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}

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
                  <div className='fw-semibold fs-5 mb-3'>Tra cứu phúc khảo</div>
                  <CForm onSubmit={handleLookup}>
                    <div className='mb-3'>
                      <label className='form-label fw-semibold' htmlFor='recheck-student-code'>Mã học sinh</label>
                      <CFormInput id='recheck-student-code' value={studentCode} onChange={(e) => setStudentCode(e.target.value)} placeholder='Nhập mã học sinh' autoComplete='off' disabled={lookupSubmitting} />
                    </div>
                    <div className='mb-4'>
                      <label className='form-label fw-semibold' htmlFor='recheck-application-code'>Mã hồ sơ</label>
                      <CFormInput id='recheck-application-code' value={applicationCode} onChange={(e) => setApplicationCode(e.target.value)} placeholder='Nhập mã hồ sơ' autoComplete='off' disabled={lookupSubmitting} />
                    </div>
                    <div className='admission-v1-actions'>
                      <CButton type='submit' color='success' disabled={lookupSubmitting}>{lookupSubmitting ? 'Đang tra cứu...' : 'Tra cứu phúc khảo'}</CButton>
                    </div>
                  </CForm>
                </CCardBody>
              </CCard>
            </CCol>

            <CCol xs={12} xl={7}>
              <CCard className='admission-v1-card h-100'>
                <CCardBody className='p-4 p-lg-5'>
                  {!result && !errorMessage && (
                    <div className='text-body-secondary'>Kết quả tra cứu sẽ hiển thị ở đây.</div>
                  )}

                  {result && candidate && (
                    <>
                      <h6 className='mb-3'>Thông tin thí sinh</h6>
                      <table className='table table-borderless table-sm mb-3'>
                        <tbody>
                          <tr><td style={{ width: '40%' }}><strong>Họ và tên:</strong></td><td>{normalizeText(candidate?.fullName) || '-'}</td></tr>
                          <tr><td><strong>Ngày sinh:</strong></td><td>{formatDate(candidate?.dateOfBirth)}</td></tr>
                          <tr><td><strong>Mã học sinh:</strong></td><td>{normalizeText(candidate?.studentCode) || '-'}</td></tr>
                          <tr><td><strong>Mã hồ sơ:</strong></td><td>{normalizeText(candidate?.applicationCode) || '-'}</td></tr>
                          <tr><td><strong>Số báo danh:</strong></td><td>{normalizeText(candidate?.candidateNumber) || '-'}</td></tr>
                        </tbody>
                      </table>

                      {!hasRecheck && (
                        <CAlert color='info'>Bạn không có phúc khảo nào.</CAlert>
                      )}

                      {hasRecheck && (
                        <>
                          <h6 className='mb-3'>Kết quả phúc khảo</h6>
                          <CTable bordered hover responsive className='mb-3'>
                            <CTableHead>
                              <CTableRow>
                                <CTableHeaderCell>Môn học</CTableHeaderCell>
                                <CTableHeaderCell className='text-center'>Điểm trước phúc khảo</CTableHeaderCell>
                                <CTableHeaderCell className='text-center'>Điểm sau phúc khảo</CTableHeaderCell>
                                <CTableHeaderCell className='text-center'>Kết quả</CTableHeaderCell>
                              </CTableRow>
                            </CTableHead>
                            <CTableBody>
                              {recheckSubjects.map((subject, index) => (
                                <CTableRow key={index}>
                                  <CTableDataCell>{subject.name}</CTableDataCell>
                                  <CTableDataCell className='text-center'>{subject.oldScore}</CTableDataCell>
                                  <CTableDataCell className='text-center'>{subject.newScore}</CTableDataCell>
                                  <CTableDataCell className='text-center'>{subject.hasChange ? <span className='badge bg-success'>Có thay đổi</span> : <span className='badge bg-secondary'>Không đổi</span>}</CTableDataCell>
                                </CTableRow>
                              ))}
                            </CTableBody>
                          </CTable>

                          {hasAnyChange ? (
                            <CAlert color='warning'><strong>Tổng điểm:</strong><div className='mt-2'><span className='me-3'>Trước phúc khảo: <strong>{formatScore(oldTotal)}</strong></span><span>Sau phúc khảo: <strong className='text-primary' style={{ fontSize: '1.1em' }}>{formatScore(candidate?.totalScore)}</strong></span></div></CAlert>
                          ) : (
                            <CAlert color='info'>Điểm các môn phúc khảo không thay đổi. Tổng điểm giữ nguyên: <strong>{formatScore(candidate?.totalScore)}</strong></CAlert>
                          )}
                        </>
                      )}
                    </>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        )}
      </CContainer>
    </div>
  )
}
