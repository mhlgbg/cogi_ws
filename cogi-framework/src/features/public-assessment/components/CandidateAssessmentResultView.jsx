import { useMemo } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CContainer, CRow } from '@coreui/react'
import { formatDateTime } from '../../../modules/learning-management/utils/questionBankUi'
import { getCefrLabel } from '../../../modules/assessments/components/assessmentUi'

export function getWorkflowStateLabel(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'scoring') return 'Đang xử lý kết quả'
  if (normalized === 'manual_scoring_pending') return 'Đang hoàn tất chấm bài'
  if (normalized === 'speaking_pending') return 'Chờ Speaking'
  if (normalized === 'speaking_in_review') return 'Speaking đang được đánh giá'
  if (normalized === 'confirmation_pending') return 'Chờ xác nhận'
  if (normalized === 'confirmed') return 'Đã xác nhận'
  if (normalized === 'expired') return 'Đã hết hạn'
  if (normalized === 'cancelled') return 'Đã hủy'
  if (normalized === 'provisional_ready') return 'Kết quả sơ bộ đã sẵn sàng'
  return 'Bài đã nộp'
}

export function getWorkflowStateColor(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'confirmed') return 'success'
  if (normalized === 'cancelled' || normalized === 'expired') return 'danger'
  if (normalized === 'provisional_ready') return 'info'
  return 'warning'
}

function formatScorePair(score, maxScore) {
  if (score === null || score === undefined) return '-'
  if (maxScore === null || maxScore === undefined) return String(score)
  return `${score} / ${maxScore}`
}

function buildTimelineSteps(payload) {
  const version = payload?.version || {}
  const speaking = payload?.speaking || null
  const confirmation = payload?.confirmation || null
  const steps = [
    { key: 'online', label: 'Bài online', value: payload?.result?.provisionalLevel ? getCefrLabel(payload.result.provisionalLevel) : payload?.result?.status ? 'Đã hoàn thành' : 'Đang xử lý', completed: Boolean(payload?.result) },
  ]
  if (version?.requiresSpeaking !== false) {
    steps.push({
      key: 'speaking',
      label: 'Speaking',
      value: speaking?.suggestedLevel ? getCefrLabel(speaking.suggestedLevel) : speaking?.status === 'completed' ? 'Đã hoàn thành' : speaking?.status === 'in_review' ? 'Đang đánh giá' : 'Đang chờ',
      completed: speaking?.status === 'completed',
      active: speaking?.status === 'in_review',
    })
  }
  if (version?.requiresTeacherConfirmation !== false) {
    steps.push({
      key: 'confirmation',
      label: 'Xác nhận',
      value: confirmation?.confirmedLevel ? getCefrLabel(confirmation.confirmedLevel) : confirmation?.status === 'confirmed' ? 'Đã xác nhận' : 'Chưa có',
      completed: confirmation?.status === 'confirmed',
    })
  }
  return steps
}

export default function CandidateAssessmentResultView({ payload, refreshing = false, onRefresh, onBack, previewMode = false }) {
  const workflowState = payload?.workflowState || ''
  const timelineSteps = useMemo(() => buildTimelineSteps(payload), [payload])
  const primaryLevel = payload?.confirmation?.confirmedLevel || payload?.result?.provisionalLevel || ''
  const primaryTitle = payload?.confirmation?.confirmedLevel ? 'Kết quả đã xác nhận' : payload?.result?.provisionalLevel ? 'Kết quả sơ bộ' : 'Kết quả đánh giá'

  return (
    <CContainer className='assessment-public-shell py-3'>
      <div className='d-grid gap-4'>
        {previewMode ? <CAlert color='info'>Đây là bản xem trước giao diện kết quả dành cho thí sinh. Dữ liệu quản trị và đáp án đúng đã được ẩn.</CAlert> : null}
        {!payload ? <CAlert color='warning'>Không tìm thấy lượt làm bài.</CAlert> : (
          <>
            <CCard className='assessment-card'>
              <CCardBody className='p-4 p-lg-5'>
                <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
                  <div>
                    <div className='assessment-badge mb-3'>{getWorkflowStateLabel(workflowState)}</div>
                    <h1 className='assessment-section-title mb-2'>Kết quả đánh giá</h1>
                    <p className='assessment-section-lead mb-3'>{payload?.assessment?.name || payload?.assessment?.code || '-'}</p>
                    <div className='small text-body-secondary'>{payload?.attempt?.candidateName || '-'}</div>
                    <div className='small text-body-secondary'>{`Mã lượt làm: ${payload?.attempt?.code || '-'}`}</div>
                    <div className='small text-body-secondary'>{`Nộp lúc: ${formatDateTime(payload?.attempt?.submittedAt)}`}</div>
                  </div>
                  <div className='text-end'>
                    <CBadge color={getWorkflowStateColor(workflowState)}>{getWorkflowStateLabel(workflowState)}</CBadge>
                  </div>
                </div>

                <CRow className='g-3 align-items-stretch'>
                  <CCol lg={7}>
                    <div className='border rounded-4 p-4 h-100 bg-white'>
                      <div className='small text-body-secondary mb-2'>{primaryTitle.toUpperCase()}</div>
                      <div style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', fontWeight: 800, lineHeight: 1 }}>{primaryLevel ? getCefrLabel(primaryLevel) : '—'}</div>
                      {payload?.confirmation?.confirmedLabel || payload?.result?.placementLabel ? <div className='mt-2 fw-semibold'>{payload?.confirmation?.confirmedLabel || payload?.result?.placementLabel}</div> : null}
                      <p className='assessment-section-lead mt-3 mb-0'>{payload?.statusBanner?.message || ''}</p>
                    </div>
                  </CCol>
                  <CCol lg={5}>
                    <div className='border rounded-4 p-4 h-100 bg-white'>
                      <div className='small text-body-secondary mb-3'>Tiến trình kết quả</div>
                      <div className='d-grid gap-3'>
                        {timelineSteps.map((step, index) => (
                          <div key={step.key} className='d-flex gap-3 align-items-start'>
                            <div style={{ width: 30, height: 30, borderRadius: 999, background: step.completed ? '#198754' : step.active ? '#f59f00' : '#dee2e6', color: step.completed || step.active ? '#fff' : '#495057', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: '0 0 auto' }}>{index + 1}</div>
                            <div>
                              <div className='fw-semibold'>{step.label}</div>
                              <div className='small text-body-secondary'>{step.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

            <CAlert color={getWorkflowStateColor(workflowState)}>{payload?.statusBanner?.title || getWorkflowStateLabel(workflowState)}</CAlert>

            {(payload?.confirmation?.confirmedLevel || payload?.result?.provisionalLevel || payload?.speaking?.suggestedLevel) ? (
              <CCard className='assessment-card'>
                <CCardBody className='p-4'>
                  <div className='small text-body-secondary mb-3'>So sánh kết quả</div>
                  <CRow className='g-3'>
                    <CCol md={4}><div className='assessment-chip'><div className='assessment-chip-title'>Online sơ bộ</div><div className='assessment-chip-subtitle'>{payload?.result?.provisionalLevel ? getCefrLabel(payload.result.provisionalLevel) : 'Chưa có'}</div></div></CCol>
                    {payload?.version?.requiresSpeaking !== false ? <CCol md={4}><div className='assessment-chip'><div className='assessment-chip-title'>Speaking</div><div className='assessment-chip-subtitle'>{payload?.speaking?.suggestedLevel ? getCefrLabel(payload.speaking.suggestedLevel) : payload?.speaking?.status === 'completed' ? 'Đã hoàn thành' : 'Đang chờ'}</div></div></CCol> : null}
                    <CCol md={4}><div className='assessment-chip'><div className='assessment-chip-title'>Mức xác nhận</div><div className='assessment-chip-subtitle'>{payload?.confirmation?.confirmedLevel ? getCefrLabel(payload.confirmation.confirmedLevel) : 'Chưa có'}</div></div></CCol>
                  </CRow>
                </CCardBody>
              </CCard>
            ) : null}

            {payload?.revealScores ? (
              <CCard className='assessment-card'>
                <CCardBody className='p-4'>
                  <CRow className='g-3'>
                    <CCol md={4}><div className='assessment-chip'><div className='assessment-chip-title'>Điểm</div><div className='assessment-chip-subtitle'>{formatScorePair(payload?.result?.rawScore, payload?.result?.maxScore)}</div></div></CCol>
                    <CCol md={4}><div className='assessment-chip'><div className='assessment-chip-title'>Tỷ lệ</div><div className='assessment-chip-subtitle'>{payload?.result?.percentage !== null && payload?.result?.percentage !== undefined ? `${payload.result.percentage}%` : '-'}</div></div></CCol>
                    <CCol md={4}><div className='assessment-chip'><div className='assessment-chip-title'>Mức</div><div className='assessment-chip-subtitle'>{primaryLevel ? getCefrLabel(primaryLevel) : '-'}</div></div></CCol>
                  </CRow>
                  {Array.isArray(payload?.result?.sectionScores) && payload.result.sectionScores.length > 0 ? (
                    <div className='mt-4'>
                      <div className='small text-body-secondary mb-3'>Chi tiết điểm theo phần</div>
                      <div className='d-grid gap-2'>
                        {payload.result.sectionScores.map((section) => (
                          <div key={section.sectionCode} className='d-flex justify-content-between gap-3 border rounded-3 p-3 bg-white'>
                            <div className='fw-semibold'>{section.title || section.sectionCode}</div>
                            <div className='text-body-secondary'>{section.rawScore === null || section.rawScore === undefined ? 'Đang chờ' : formatScorePair(section.rawScore, section.maxScore)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CCardBody>
              </CCard>
            ) : null}

            {(onRefresh || onBack) ? (
              <div className='d-flex flex-wrap gap-2'>
                {onRefresh ? <CButton color='primary' className='assessment-primary-cta' onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Đang làm mới...' : 'Làm mới trạng thái'}</CButton> : null}
                {onBack ? <CButton color='secondary' variant='outline' className='assessment-primary-cta' onClick={onBack}>Về bài làm</CButton> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </CContainer>
  )
}
