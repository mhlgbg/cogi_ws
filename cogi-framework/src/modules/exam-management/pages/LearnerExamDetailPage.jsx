import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CRow,
  CSpinner,
} from '@coreui/react'
import { getLearnerExamRound, normalizeCurrentLearnerApiMessage } from '../services/learnerExamApi'
import { formatDateTime, formatMoney, getPaymentCalculationMethodLabel, getRegistrationModeLabel, getSubjectCalculationMethodLabel } from '../utils/examRoundUi'
import { getLearnerActionLabel, getLearnerExamReasonLabel, getLearnerExamStatusMeta } from '../utils/learnerExamUi'
import { buildLearnerExamFeeSummary, shouldShowLearnerExamComponentFee, shouldShowLearnerExamSubjectFee } from '../utils/learnerExamFeeUi'

function SpinnerCenter() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CSpinner /></div>
}

function InfoCard({ label, value }) {
  return (
    <CCard className='h-100'>
      <CCardBody>
        <div className='small text-body-secondary'>{label}</div>
        <div className='fw-semibold'>{value || '-'}</div>
      </CCardBody>
    </CCard>
  )
}

export default function LearnerExamDetailPage() {
  const navigate = useNavigate()
  const { id, tenantCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [support, setSupport] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getLearnerExamRound(id)
        if (!mounted) return
        setDetail(result || null)
        setSupport(result?.support || null)
      } catch (requestError) {
        if (!mounted) return
        setDetail(null)
        setError(normalizeCurrentLearnerApiMessage(requestError, 'Không tải được chi tiết đợt thi cho learner.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  if (loading) return <SpinnerCenter />
  if (!detail) {
    return (
      <CContainer fluid className='py-4'>
        <CAlert color='danger'>{error || 'Không tìm thấy đợt thi phù hợp.'}</CAlert>
        <CButton color='secondary' variant='outline' onClick={() => navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams` : '/learner/exams')}>Quay lại danh sách</CButton>
      </CContainer>
    )
  }

  const reasonLabel = getLearnerExamReasonLabel(detail?.availability?.reasonCode)
  const feeSummary = buildLearnerExamFeeSummary({ configuration: detail?.configuration, feePreview: detail?.feePreview })
  const showSubjectFee = shouldShowLearnerExamSubjectFee({ configuration: detail?.configuration, feePreview: detail?.feePreview })
  const showComponentFee = shouldShowLearnerExamComponentFee({ configuration: detail?.configuration, feePreview: detail?.feePreview })
  const statusMeta = getLearnerExamStatusMeta({
    ...detail?.examRound,
    learnerState: detail?.learnerState,
    availabilityState: detail?.availability?.availabilityState,
    requiresLearnerCreation: detail?.availability?.requiresLearnerCreation,
    registrationWindowState: detail?.availability?.registrationWindowState,
    canRegister: detail?.availability?.canRegister,
    existingRegistration: detail?.existingRegistration,
  })
  const actionLabel = getLearnerActionLabel({
    existingRegistration: detail?.existingRegistration,
    canRegister: detail?.availability?.canRegister,
    requiresLearnerCreation: detail?.availability?.requiresLearnerCreation,
  })
  const registerPath = detail?.availability?.requiresLearnerCreation
    ? (tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams/${id}/register/profile` : `/learner/exams/${id}/register/profile`)
    : (tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams/${id}/register` : `/learner/exams/${id}/register`)

  return (
    <CContainer fluid className='py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='small text-body-secondary'>{detail?.examRound?.code || '-'}</div>
          <div className='fs-4 fw-semibold'>{detail?.examRound?.name || '-'}</div>
          <div className='mt-2'><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams` : '/learner/exams')}>Quay lại danh sách</CButton>
          {detail?.existingRegistration?.id ? <CButton color='info' onClick={() => navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exam-registrations/${detail.existingRegistration.id}` : `/learner/exam-registrations/${detail.existingRegistration.id}`)}>Xem hồ sơ đăng ký</CButton> : null}
          {!detail?.existingRegistration?.id && actionLabel ? <CButton color='primary' disabled={!detail?.availability?.canRegister} onClick={() => navigate(registerPath)}>{actionLabel}</CButton> : null}
        </div>
      </div>

      {!detail?.learner ? <CAlert color='info'>Tài khoản của bạn hiện chưa được liên kết với hồ sơ người học. Bạn vẫn có thể xem đợt thi mở và sẽ khai thông tin người học khi bắt đầu đăng ký các đợt không giới hạn đối tượng.</CAlert> : null}
      {reasonLabel && !detail?.availability?.canRegister && !detail?.existingRegistration?.id ? <CAlert color='warning'>{reasonLabel}</CAlert> : null}

      <CRow className='g-3 mb-4'>
        <CCol lg={3} md={6}><InfoCard label='Thời gian đăng ký' value={`${formatDateTime(detail?.examRound?.registrationStartAt)} - ${formatDateTime(detail?.examRound?.registrationEndAt)}`} /></CCol>
        <CCol lg={3} md={6}><InfoCard label='Thời gian thi' value={`${formatDateTime(detail?.examRound?.examStartAt)} - ${formatDateTime(detail?.examRound?.examEndAt)}`} /></CCol>
        <CCol lg={3} md={6}><InfoCard label='Chế độ đăng ký' value={getRegistrationModeLabel(detail?.examRound?.registrationMode)} /></CCol>
        <CCol lg={3} md={6}><InfoCard label='Lệ phí' value={feeSummary.mode === 'free' ? 'Miễn phí' : feeSummary.totalAmount === null || feeSummary.totalAmount === undefined ? getPaymentCalculationMethodLabel(detail?.configuration?.paymentCalculationMethod) : `${formatMoney(feeSummary.totalAmount)} ${feeSummary.currency || 'VND'}`} /></CCol>
      </CRow>

      <CRow className='g-4'>
        <CCol xl={4}>
          <CCard className='h-100'>
            <CCardHeader><strong>Thông tin chung</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'><div className='small text-body-secondary'>Người học</div><div>{detail?.learner ? `${detail.learner.fullName || '-'} - ${detail.learner.code || '-'}` : 'Chưa liên kết hồ sơ người học'}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Năm học / Học kỳ</div><div>{detail?.examRound?.academicYear || '-'} / {detail?.examRound?.semester || '-'}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Điều kiện hiện tại</div><div>{detail?.eligibility?.status || (detail?.eligibility?.registrationMode === 'open' ? 'Không bắt buộc' : 'Chưa xác định')}</div></div>
              <div><div className='small text-body-secondary'>Lý do</div><div>{reasonLabel || detail?.eligibility?.reason || '-'}</div></div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={4}>
          <CCard className='h-100'>
            <CCardHeader><strong>Quy tắc đăng ký</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'><div className='small text-body-secondary'>Cho phép chọn môn</div><div>{detail?.configuration?.allowSubjectSelection ? 'Có' : 'Không'}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Cho phép chọn kỹ năng</div><div>{detail?.configuration?.allowComponentSelection ? 'Có' : 'Không'}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Yêu cầu xác nhận thanh toán</div><div>{detail?.configuration?.requireConfirmedPayment ? 'Có' : 'Không'}</div></div>
              <div><div className='small text-body-secondary'>Hướng dẫn</div><div style={{ whiteSpace: 'pre-wrap' }}>{detail?.examRound?.instructions || 'Chưa có hướng dẫn.'}</div></div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={4}>
          <CCard className='h-100'>
            <CCardHeader><strong>Hồ sơ đăng ký</strong></CCardHeader>
            <CCardBody>
              {detail?.existingRegistration?.registrationCode ? (
                <>
                  <div className='mb-3'><div className='small text-body-secondary'>Mã hồ sơ</div><div>{detail.existingRegistration.registrationCode}</div></div>
                  <div className='mb-3'><div className='small text-body-secondary'>Trạng thái hồ sơ</div><div>{detail.existingRegistration.registrationStatus || '-'}</div></div>
                  <div className='mb-3'><div className='small text-body-secondary'>Trạng thái thanh toán</div><div>{detail.existingRegistration.paymentStatus || '-'}</div></div>
                  <div><div className='small text-body-secondary'>Thời gian đăng ký</div><div>{formatDateTime(detail.existingRegistration.registeredAt)}</div></div>
                </>
              ) : <div className='text-body-secondary'>Bạn chưa có hồ sơ đăng ký cho đợt thi này.</div>}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xs={12}>
          <CCard>
            <CCardHeader><strong>Cấu trúc đợt thi</strong></CCardHeader>
            <CCardBody>
              <CRow className='g-3'>
                {Array.isArray(detail?.subjects) && detail.subjects.length > 0 ? detail.subjects.map((subject) => (
                  <CCol key={subject.examRoundSubjectId} xl={6}>
                    <div className='border rounded p-3 h-100'>
                      <div className='fw-semibold mb-2'>{subject.nameSnapshot}</div>
                      <div className='small text-body-secondary mb-2'>Quy tắc: {getSubjectCalculationMethodLabel(subject?.calculationRule?.method)}</div>
                      <div className='small text-body-secondary mb-2'>Môn {subject.isRequired ? 'bắt buộc' : 'tự chọn'}{subject.allowSeparateRegistration ? ' · cho phép đăng ký riêng' : ''}</div>
                      {showSubjectFee ? <div className='small text-body-secondary mb-3'>Lệ phí môn: {subject.fee === null || typeof subject.fee === 'undefined' ? '-' : `${formatMoney(subject.fee)} VND`}</div> : null}
                      <div className='d-flex flex-column gap-2'>
                        {Array.isArray(subject.components) && subject.components.length > 0 ? subject.components.map((component) => (
                          <div key={component.examRoundComponentId} className='border rounded p-2 bg-body-tertiary'>
                            <div className='fw-semibold'>{component.nameSnapshot}</div>
                            <div className='small text-body-secondary'>Thời lượng: {component.durationMinutes ? `${component.durationMinutes} phút` : '-'}</div>
                            <div className='small text-body-secondary'>{component.isRequired ? 'Bắt buộc' : 'Tự chọn'}{component.allowSeparateRegistration ? ' · cho phép đăng ký riêng' : ''}</div>
                            {showComponentFee ? <div className='small text-body-secondary'>Lệ phí: {component.fee === null || typeof component.fee === 'undefined' ? '-' : `${formatMoney(component.fee)} VND`}</div> : null}
                          </div>
                        )) : <div className='text-body-secondary'>Chưa có kỹ năng/phần thi.</div>}
                      </div>
                    </div>
                  </CCol>
                )) : <CCol xs={12}><div className='text-body-secondary'>Chưa có cấu trúc đợt thi khả dụng.</div></CCol>}
              </CRow>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}