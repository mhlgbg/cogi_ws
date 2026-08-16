import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  assignExamRoundAllocation,
  autoAssignExamRoundAllocation,
  getExamRoundAllocationCapacity,
  getExamRoundCandidateListDetail,
  listExamRoundAllocationUnassigned,
  listExamRoundCandidateLists,
  previewExamRoundAutoAllocation,
  reassignExamRoundCandidate,
  unassignExamRoundCandidates,
} from '../services/examRoundApi'
import { formatDateTime, formatMoney, getApiMessage, normalizeStatus } from '../utils/examRoundUi'
import { getPaymentStatusBadge } from '../utils/learnerExamUi'

function SummaryCard({ label, value, color = 'secondary', helper = '' }) {
  return (
    <CCard className='h-100'>
      <CCardBody>
        <div className='small text-body-secondary mb-1'>{label}</div>
        <div className={`fs-4 fw-semibold text-${color}`}>{value}</div>
        {helper ? <div className='small text-body-secondary mt-1'>{helper}</div> : null}
      </CCardBody>
    </CCard>
  )
}

function getAllocationApiMessage(error, fallback) {
  const code = String(error?.response?.data?.code || error?.response?.data?.error?.code || '').trim()
  const mapped = {
    EXAM_ROUND_NOT_FOUND: 'Không tìm thấy đợt thi trong tenant hiện tại.',
    EXAM_CANDIDATE_ALLOCATION_NOT_ALLOWED: 'Đợt thi hiện chưa cho phép phân bổ thí sinh.',
    EXAM_SCHEDULE_NOT_AVAILABLE_FOR_ALLOCATION: 'Ca thi chưa sẵn sàng để nhận thí sinh.',
    EXAM_SCHEDULE_CAPACITY_FULL: 'Ca thi đã đủ chỗ.',
    EXAM_SCHEDULE_CAPACITY_INSUFFICIENT: 'Tổng sức chứa hiện chưa đủ để phân bổ hết.',
    EXAM_SCHEDULE_COMPONENT_MISMATCH: 'Ca thi không cùng kỹ năng với thí sinh được chọn.',
    EXAM_REGISTRATION_NOT_ACCEPTED: 'Hồ sơ đăng ký chưa được duyệt nên chưa thể phân bổ.',
    EXAM_REGISTRATION_COMPONENT_NOT_ELIGIBLE: 'Registration-component chưa đủ điều kiện để phân bổ.',
    EXAM_REGISTRATION_COMPONENT_ALREADY_ASSIGNED: 'Registration-component đã được phân vào một ca khác.',
    LEARNER_EXAM_SCHEDULE_CONFLICT: 'Learner đang bị trùng thời gian với một ca thi khác.',
    EXAM_CANDIDATE_LIST_LOCKED: 'Candidate list của ca này đang bị khóa.',
    EXAM_CANDIDATE_CANNOT_BE_UNASSIGNED: 'Candidate hiện không thể bỏ phân bổ.',
    EXAM_CANDIDATE_NOT_FOUND: 'Không tìm thấy candidate phù hợp.',
    EXAM_CANDIDATE_LIST_NOT_FOUND: 'Không tìm thấy candidate list phù hợp.',
    EXAM_SCHEDULE_NOT_FOUND: 'Không tìm thấy ca thi phù hợp.',
    UNKNOWN_FIELDS: 'Biểu mẫu gửi lên có trường không hợp lệ.',
  }[code]
  return mapped || getApiMessage(error, fallback)
}

function buildReasonState() {
  return {
    reason: '',
    error: '',
    submitting: false,
  }
}

export default function ExamRoundAllocationTab({ round, permissions, onRefresh }) {
  const canManage = permissions?.canManage === true
  const [componentId, setComponentId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [unassignedLoading, setUnassignedLoading] = useState(false)
  const [unassignedError, setUnassignedError] = useState('')
  const [unassignedRows, setUnassignedRows] = useState([])
  const [unassignedPagination, setUnassignedPagination] = useState({ page: 1, pageSize: 20, total: 0, pageCount: 1 })
  const [capacityLoading, setCapacityLoading] = useState(false)
  const [capacityError, setCapacityError] = useState('')
  const [capacityRows, setCapacityRows] = useState([])
  const [capacitySummary, setCapacitySummary] = useState(null)
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState([])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignScheduleId, setAssignScheduleId] = useState('')
  const [assignError, setAssignError] = useState('')
  const [assignSubmitting, setAssignSubmitting] = useState(false)
  const [showAutoModal, setShowAutoModal] = useState(false)
  const [autoPreview, setAutoPreview] = useState(null)
  const [autoPreviewLoading, setAutoPreviewLoading] = useState(false)
  const [autoPreviewError, setAutoPreviewError] = useState('')
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  const [expandedScheduleId, setExpandedScheduleId] = useState(null)
  const [candidateListDetails, setCandidateListDetails] = useState({})
  const [candidateListLoadingId, setCandidateListLoadingId] = useState(null)
  const [candidateListError, setCandidateListError] = useState('')
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveTarget, setMoveTarget] = useState(null)
  const [moveScheduleId, setMoveScheduleId] = useState('')
  const [moveState, setMoveState] = useState(buildReasonState())
  const [showUnassignModal, setShowUnassignModal] = useState(false)
  const [unassignTarget, setUnassignTarget] = useState(null)
  const [unassignState, setUnassignState] = useState(buildReasonState())

  const subjectOptions = useMemo(() => Array.isArray(round?.subjects) ? round.subjects.filter((item) => normalizeStatus(item?.status) === 'active') : [], [round?.subjects])
  const componentOptions = useMemo(() => subjectOptions.flatMap((subject) => Array.isArray(subject.components) ? subject.components.filter((component) => normalizeStatus(component?.status) === 'active').map((component) => ({ ...component, subjectId: subject.id, subjectName: subject.nameSnapshot })) : []), [subjectOptions])
  const selectedComponent = useMemo(() => componentOptions.find((item) => String(item.id) === String(componentId)) || null, [componentId, componentOptions])
  const relatedSchedules = useMemo(() => capacityRows.filter((item) => !componentId || String(item?.component?.id) === String(componentId)), [capacityRows, componentId])
  const requiredCandidates = useMemo(() => {
    const assigned = relatedSchedules.reduce((total, item) => total + (Number(item?.assignedCount || 0) || 0), 0)
    return assigned + unassignedRows.length
  }, [relatedSchedules, unassignedRows])
  const allocatedCandidates = useMemo(() => relatedSchedules.reduce((total, item) => total + (Number(item?.assignedCount || 0) || 0), 0), [relatedSchedules])
  const totalScheduleCapacity = useMemo(() => relatedSchedules.reduce((total, item) => total + (Number(item?.capacity || 0) || 0), 0), [relatedSchedules])
  const remainingCapacity = useMemo(() => relatedSchedules.reduce((total, item) => total + (Number(item?.availableCapacity || 0) || 0), 0), [relatedSchedules])
  const shortage = useMemo(() => Math.max(requiredCandidates - totalScheduleCapacity, 0), [requiredCandidates, totalScheduleCapacity])
  const scheduleLookup = useMemo(() => new Map(relatedSchedules.map((item) => [Number(item?.scheduleId || 0), item])), [relatedSchedules])
  const selectableSchedules = useMemo(() => relatedSchedules.filter((item) => Number(item?.availableCapacity || 0) > 0), [relatedSchedules])

  useEffect(() => {
    if (!componentId && componentOptions.length > 0) {
      setComponentId(String(componentOptions[0].id))
    }
  }, [componentId, componentOptions])

  useEffect(() => {
    if (!round?.id || !componentId) return
    loadUnassigned(1)
    loadCapacity()
  }, [round?.id, componentId])

  async function loadUnassigned(page = unassignedPagination.page, nextKeyword = keyword) {
    if (!round?.id || !componentId) return
    setUnassignedLoading(true)
    setUnassignedError('')
    try {
      const result = await listExamRoundAllocationUnassigned(round.id, {
        page,
        pageSize: unassignedPagination.pageSize,
        examRoundComponentId: componentId,
        ...(String(nextKeyword || '').trim() ? { learnerCode: String(nextKeyword).trim(), learnerName: String(nextKeyword).trim() } : {}),
      })
      setUnassignedRows(Array.isArray(result?.data) ? result.data : [])
      setUnassignedPagination(result?.pagination || { page, pageSize: 20, total: 0, pageCount: 1 })
      setSelectedUnassignedIds([])
    } catch (requestError) {
      setUnassignedRows([])
      setUnassignedError(getAllocationApiMessage(requestError, 'Không tải được danh sách thí sinh chưa phân.'))
    } finally {
      setUnassignedLoading(false)
    }
  }

  async function loadCapacity() {
    if (!round?.id || !componentId) return
    setCapacityLoading(true)
    setCapacityError('')
    try {
      const result = await getExamRoundAllocationCapacity(round.id, {
        componentId,
      })
      setCapacityRows(Array.isArray(result?.data) ? result.data : [])
      setCapacitySummary(result?.summary || null)
    } catch (requestError) {
      setCapacityRows([])
      setCapacitySummary(null)
      setCapacityError(getAllocationApiMessage(requestError, 'Không tải được sức chứa và tình trạng phân bổ.'))
    } finally {
      setCapacityLoading(false)
    }
  }

  async function refreshBoard() {
    await Promise.all([loadUnassigned(unassignedPagination.page), loadCapacity(), onRefresh?.()])
  }

  function toggleUnassigned(id) {
    setSelectedUnassignedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function openAssignModal(scheduleId = '') {
    setAssignScheduleId(String(scheduleId || ''))
    setAssignError('')
    setShowAssignModal(true)
  }

  async function submitAssign() {
    if (!round?.id || !assignScheduleId || selectedUnassignedIds.length === 0 || assignSubmitting) return
    setAssignSubmitting(true)
    setAssignError('')
    try {
      await assignExamRoundAllocation(round.id, {
        assignments: selectedUnassignedIds.map((examRegistrationComponentId) => ({
          examRegistrationComponentId,
          examScheduleId: Number(assignScheduleId),
        })),
      })
      setShowAssignModal(false)
      await refreshBoard()
    } catch (requestError) {
      setAssignError(getAllocationApiMessage(requestError, 'Không thể phân thí sinh vào ca thi đã chọn.'))
    } finally {
      setAssignSubmitting(false)
    }
  }

  async function openAutoModal() {
    if (!round?.id || !componentId) return
    setShowAutoModal(true)
    setAutoPreview(null)
    setAutoPreviewError('')
    setAutoPreviewLoading(true)
    try {
      const preview = await previewExamRoundAutoAllocation(round.id, {
        examRoundComponentIds: [Number(componentId)],
        strategy: 'fill_sequentially',
        sortLearnersBy: 'learner_code',
        dryRun: true,
      })
      setAutoPreview(preview || null)
    } catch (requestError) {
      setAutoPreview(null)
      setAutoPreviewError(getAllocationApiMessage(requestError, 'Không tạo được preview phân bổ tự động.'))
    } finally {
      setAutoPreviewLoading(false)
    }
  }

  async function submitAutoAssign() {
    if (!round?.id || !componentId || autoSubmitting) return
    setAutoSubmitting(true)
    setAutoPreviewError('')
    try {
      await autoAssignExamRoundAllocation(round.id, {
        examRoundComponentIds: [Number(componentId)],
        strategy: 'fill_sequentially',
        sortLearnersBy: 'learner_code',
      })
      setShowAutoModal(false)
      await refreshBoard()
    } catch (requestError) {
      setAutoPreviewError(getAllocationApiMessage(requestError, 'Không thể phân bổ tự động.'))
    } finally {
      setAutoSubmitting(false)
    }
  }

  async function toggleScheduleDetail(scheduleId) {
    if (!round?.id) return
    if (expandedScheduleId === scheduleId) {
      setExpandedScheduleId(null)
      return
    }
    setExpandedScheduleId(scheduleId)
    if (candidateListDetails[scheduleId]) return
    setCandidateListLoadingId(scheduleId)
    setCandidateListError('')
    try {
      const lists = await listExamRoundCandidateLists(round.id, { scheduleId })
      const first = Array.isArray(lists?.data) ? lists.data[0] : null
      if (!first?.id) {
        setCandidateListDetails((current) => ({ ...current, [scheduleId]: { candidateList: null, detail: null } }))
      } else {
        const detail = await getExamRoundCandidateListDetail(round.id, first.id, { pageSize: 1000 })
        setCandidateListDetails((current) => ({ ...current, [scheduleId]: { candidateList: first, detail } }))
      }
    } catch (requestError) {
      setCandidateListError(getAllocationApiMessage(requestError, 'Không tải được danh sách thí sinh đã phân của ca thi.'))
    } finally {
      setCandidateListLoadingId(null)
    }
  }

  function openMoveModal(candidate, scheduleId) {
    setMoveTarget({ candidate, scheduleId })
    setMoveScheduleId('')
    setMoveState(buildReasonState())
    setShowMoveModal(true)
  }

  async function submitMove() {
    if (!round?.id || !moveTarget?.candidate?.id || !moveScheduleId || moveState.submitting) return
    setMoveState((current) => ({ ...current, submitting: true, error: '' }))
    try {
      await reassignExamRoundCandidate(round.id, {
        examCandidateId: Number(moveTarget.candidate.id),
        targetExamScheduleId: Number(moveScheduleId),
        reason: moveState.reason,
      })
      setShowMoveModal(false)
      setCandidateListDetails({})
      await refreshBoard()
    } catch (requestError) {
      setMoveState((current) => ({ ...current, submitting: false, error: getAllocationApiMessage(requestError, 'Không thể chuyển ca cho thí sinh.') }))
      return
    }
    setMoveState((current) => ({ ...current, submitting: false }))
  }

  function openUnassignModal(candidate, scheduleId) {
    setUnassignTarget({ candidate, scheduleId })
    setUnassignState(buildReasonState())
    setShowUnassignModal(true)
  }

  async function submitUnassign() {
    if (!round?.id || !unassignTarget?.candidate?.id || unassignState.submitting) return
    setUnassignState((current) => ({ ...current, submitting: true, error: '' }))
    try {
      await unassignExamRoundCandidates(round.id, {
        examCandidateIds: [Number(unassignTarget.candidate.id)],
        reason: unassignState.reason,
      })
      setShowUnassignModal(false)
      setCandidateListDetails({})
      await refreshBoard()
    } catch (requestError) {
      setUnassignState((current) => ({ ...current, submitting: false, error: getAllocationApiMessage(requestError, 'Không thể bỏ phân bổ thí sinh.') }))
      return
    }
    setUnassignState((current) => ({ ...current, submitting: false }))
  }

  const scheduleCards = relatedSchedules.map((schedule) => {
    const detailWrapper = candidateListDetails[schedule.scheduleId] || null
    const detail = detailWrapper?.detail || null
    return { schedule, detail }
  })

  return (
    <div className='d-flex flex-column gap-4'>
      {unassignedError ? <CAlert color='danger'>{unassignedError}</CAlert> : null}
      {capacityError ? <CAlert color='danger'>{capacityError}</CAlert> : null}
      {candidateListError ? <CAlert color='warning'>{candidateListError}</CAlert> : null}

      <CCard>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol lg={4} md={6}>
              <CFormLabel>Môn</CFormLabel>
              <CFormSelect
                value={selectedComponent?.subjectId ? String(selectedComponent.subjectId) : ''}
                onChange={(event) => {
                  const subjectId = event.target.value
                  const nextComponent = componentOptions.find((item) => String(item.subjectId) === String(subjectId))
                  setComponentId(nextComponent?.id ? String(nextComponent.id) : '')
                }}
              >
                <option value=''>Chọn môn</option>
                {subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.nameSnapshot}</option>)}
              </CFormSelect>
            </CCol>
            <CCol lg={4} md={6}>
              <CFormLabel>Kỹ năng</CFormLabel>
              <CFormSelect value={componentId} onChange={(event) => setComponentId(event.target.value)}>
                <option value=''>Chọn kỹ năng</option>
                {componentOptions.filter((item) => !selectedComponent?.subjectId || item.subjectId === selectedComponent.subjectId).map((component) => <option key={component.id} value={component.id}>{component.nameSnapshot}</option>)}
              </CFormSelect>
            </CCol>
            <CCol lg={4} md={12}>
              <CFormLabel>Tìm learner</CFormLabel>
              <div className='d-flex gap-2'>
                <CFormInput value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder='Mã learner / họ tên / mã hồ sơ' />
                <CButton color='primary' onClick={() => loadUnassigned(1, keyword)}>Tìm</CButton>
              </div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      <CRow className='g-3'>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Cần phân' value={formatMoney(requiredCandidates)} color='dark' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Đã phân' value={formatMoney(allocatedCandidates)} color='success' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Chưa phân' value={formatMoney(unassignedRows.length)} color='warning' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Sức chứa' value={formatMoney(totalScheduleCapacity)} color='info' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Còn chỗ' value={formatMoney(remainingCapacity)} color='info' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Thiếu chỗ' value={formatMoney(shortage)} color={shortage > 0 ? 'danger' : 'success'} /></CCol>
      </CRow>

      <CRow className='g-4'>
        <CCol xl={5}>
          <CCard className='h-100'>
            <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
              <strong>Chưa phân vào ca</strong>
              <div className='d-flex gap-2'>
                {canManage ? <CButton color='secondary' size='sm' variant='outline' disabled={!componentId} onClick={openAutoModal}>Phân bổ tự động</CButton> : null}
                {canManage ? <CButton color='primary' size='sm' disabled={selectedUnassignedIds.length === 0} onClick={() => openAssignModal()}>Phân vào ca</CButton> : null}
              </div>
            </CCardHeader>
            <CCardBody>
              {unassignedLoading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải thí sinh chưa phân...</div> : null}
              <div className='d-flex flex-column gap-3'>
                {unassignedRows.length === 0 && !unassignedLoading ? <div className='text-body-secondary text-center py-4'>Không còn registration-component chưa phân cho kỹ năng hiện tại.</div> : null}
                {unassignedRows.map((row) => {
                  const paymentBadge = getPaymentStatusBadge(row.paymentStatus)
                  return (
                    <div key={row.registrationComponentId} className='border rounded p-3'>
                      <div className='d-flex justify-content-between gap-2 flex-wrap'>
                        <CFormCheck checked={selectedUnassignedIds.includes(row.registrationComponentId)} onChange={() => toggleUnassigned(row.registrationComponentId)} label={<span><strong>{row.learner?.fullName || '-'}</strong> <span className='text-body-secondary'>{row.learner?.code || '-'}</span></span>} />
                        <CBadge color={paymentBadge.color}>{paymentBadge.label}</CBadge>
                      </div>
                      <div className='small text-body-secondary mt-2'>{row.registrationCode || '-'} · {row.subject?.nameSnapshot || '-'} · {row.component?.nameSnapshot || '-'}</div>
                      <div className='small text-body-secondary'>{[row.learner?.className, row.learner?.major].filter(Boolean).join(' · ') || '-'}</div>
                      {Array.isArray(row.conflictWarnings) && row.conflictWarnings.length > 0 ? <div className='small text-danger mt-1'>Có cảnh báo trùng lịch learner</div> : null}
                    </div>
                  )
                })}
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={7}>
          <CCard className='h-100'>
            <CCardHeader><strong>Các ca thi của kỹ năng</strong></CCardHeader>
            <CCardBody>
              {capacityLoading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải sức chứa ca thi...</div> : null}
              <div className='d-flex flex-column gap-3'>
                {scheduleCards.length === 0 && !capacityLoading ? <div className='text-body-secondary text-center py-4'>Chưa có ca thi nào cho kỹ năng hiện tại.</div> : null}
                {scheduleCards.map(({ schedule, detail }) => (
                  <CCard key={schedule.scheduleId} className='border'>
                    <CCardBody>
                      <div className='d-flex justify-content-between gap-3 flex-wrap'>
                        <div>
                          <div className='fw-semibold'>{schedule.component?.nameSnapshot || '-'} {schedule.room?.name ? `· ${schedule.room.name}` : ''}</div>
                          <div className='small text-body-secondary'>{formatDateTime(schedule.startAt)} - {formatDateTime(schedule.endAt)}</div>
                          <div className='small text-body-secondary'>{schedule.venue?.name || '-'} · {schedule.room?.name || '-'} · {formatMoney(schedule.capacity || 0)} chỗ</div>
                        </div>
                        <div className='text-end'>
                          <div className='fw-semibold'>{formatMoney(schedule.assignedCount || 0)}/{formatMoney(schedule.capacity || 0)}</div>
                          <div className='small text-body-secondary'>Còn {formatMoney(schedule.availableCapacity || 0)} chỗ</div>
                        </div>
                      </div>
                      {Array.isArray(schedule.warnings) && schedule.warnings.length > 0 ? <div className='small text-warning mt-2'>{schedule.warnings.map((item) => item.message).join(' · ')}</div> : null}
                      <div className='d-flex gap-2 flex-wrap mt-3'>
                        {canManage ? <CButton color='primary' size='sm' disabled={selectedUnassignedIds.length === 0 || Number(schedule.availableCapacity || 0) <= 0} onClick={() => openAssignModal(schedule.scheduleId)}>Phân vào ca này</CButton> : null}
                        <CButton color='secondary' size='sm' variant='outline' onClick={() => toggleScheduleDetail(schedule.scheduleId)}>{expandedScheduleId === schedule.scheduleId ? 'Ẩn danh sách' : 'Xem danh sách đã phân'}</CButton>
                      </div>
                      {expandedScheduleId === schedule.scheduleId ? (
                        <div className='mt-3'>
                          {candidateListLoadingId === schedule.scheduleId ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải danh sách đã phân...</div> : null}
                          {detail && Array.isArray(detail.candidates) && detail.candidates.length === 0 ? <div className='text-body-secondary'>Chưa có thí sinh nào được phân vào ca này.</div> : null}
                          {detail && Array.isArray(detail.candidates) && detail.candidates.length > 0 ? (
                            <div className='d-flex flex-column gap-2'>
                              {detail.candidates.map((candidate) => (
                                <div key={candidate.id} className='border rounded p-2'>
                                  <div className='d-flex justify-content-between gap-2 flex-wrap'>
                                    <div>
                                      <div className='fw-semibold'>{candidate.learner?.fullName || '-'}</div>
                                      <div className='small text-body-secondary'>{candidate.learner?.code || '-'} · {candidate.registrationCode || '-'}</div>
                                    </div>
                                    {canManage ? <div className='d-flex gap-2 flex-wrap'><CButton color='secondary' size='sm' variant='outline' onClick={() => openMoveModal(candidate, schedule.scheduleId)}>Chuyển ca</CButton><CButton color='danger' size='sm' variant='outline' onClick={() => openUnassignModal(candidate, schedule.scheduleId)}>Bỏ phân bổ</CButton></div> : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </CCardBody>
                  </CCard>
                ))}
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CModal visible={showAssignModal} onClose={() => setShowAssignModal(false)}>
        <CModalHeader><CModalTitle>Phân vào ca thi</CModalTitle></CModalHeader>
        <CModalBody>
          {assignError ? <CAlert color='danger'>{assignError}</CAlert> : null}
          <div className='mb-3 small text-body-secondary'>Đã chọn {selectedUnassignedIds.length} registration-component chưa phân.</div>
          <CFormLabel>Ca thi</CFormLabel>
          <CFormSelect value={assignScheduleId} onChange={(event) => setAssignScheduleId(event.target.value)}>
            <option value=''>Chọn ca thi</option>
            {selectableSchedules.map((schedule) => <option key={schedule.scheduleId} value={schedule.scheduleId}>{`${formatDateTime(schedule.startAt)} · ${schedule.room?.name || '-'} · còn ${schedule.availableCapacity || 0} chỗ`}</option>)}
          </CFormSelect>
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowAssignModal(false)} disabled={assignSubmitting}>Đóng</CButton><CButton color='primary' onClick={submitAssign} disabled={assignSubmitting || !assignScheduleId}>{assignSubmitting ? 'Đang phân...' : 'Xác nhận phân bổ'}</CButton></CModalFooter>
      </CModal>

      <CModal visible={showAutoModal} onClose={() => setShowAutoModal(false)} size='lg' scrollable>
        <CModalHeader><CModalTitle>Phân bổ tự động</CModalTitle></CModalHeader>
        <CModalBody>
          {autoPreviewError ? <CAlert color='danger'>{autoPreviewError}</CAlert> : null}
          {autoPreviewLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tạo preview...</div> : null}
          {!autoPreviewLoading && autoPreview ? (
            <>
              <CRow className='g-3 mb-3'>
                <CCol md={3}><SummaryCard label='Cần phân' value={formatMoney(requiredCandidates)} color='dark' /></CCol>
                <CCol md={3}><SummaryCard label='Dự kiến phân được' value={formatMoney(Array.isArray(autoPreview.assignments) ? autoPreview.assignments.length : 0)} color='success' /></CCol>
                <CCol md={3}><SummaryCard label='Dự kiến còn lại' value={formatMoney(Array.isArray(autoPreview.unassigned) ? autoPreview.unassigned.length : 0)} color='warning' /></CCol>
                <CCol md={3}><SummaryCard label='Sức chứa còn lại' value={formatMoney(remainingCapacity)} color='info' /></CCol>
              </CRow>
              <div className='fw-semibold mb-2'>Preview sử dụng ca thi</div>
              <CTable responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Ca thi</CTableHeaderCell>
                    <CTableHeaderCell>Dự kiến thêm</CTableHeaderCell>
                    <CTableHeaderCell>Sức chứa còn lại</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {Object.entries(autoPreview.capacitySummary || {}).map(([scheduleId, count]) => {
                    const schedule = scheduleLookup.get(Number(scheduleId || 0))
                    return <CTableRow key={scheduleId}><CTableDataCell>{schedule ? `${formatDateTime(schedule.startAt)} · ${schedule.room?.name || '-'}` : `#${scheduleId}`}</CTableDataCell><CTableDataCell>{formatMoney(count)}</CTableDataCell><CTableDataCell>{schedule ? formatMoney(schedule.availableCapacity || 0) : '-'}</CTableDataCell></CTableRow>
                  })}
                </CTableBody>
              </CTable>
              {Array.isArray(autoPreview.unassigned) && autoPreview.unassigned.length > 0 ? <CAlert color='warning' className='mt-3 mb-0'>Còn {autoPreview.unassigned.length} registration-component chưa phân được vì thiếu chỗ hoặc conflict thời gian.</CAlert> : null}
            </>
          ) : null}
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowAutoModal(false)} disabled={autoSubmitting}>Đóng</CButton><CButton color='primary' onClick={submitAutoAssign} disabled={autoSubmitting || autoPreviewLoading || !autoPreview}>{autoSubmitting ? 'Đang phân bổ...' : 'Phân bổ tự động'}</CButton></CModalFooter>
      </CModal>

      <CModal visible={showMoveModal} onClose={() => setShowMoveModal(false)}>
        <CModalHeader><CModalTitle>Chuyển ca cho thí sinh</CModalTitle></CModalHeader>
        <CModalBody>
          {moveState.error ? <CAlert color='danger'>{moveState.error}</CAlert> : null}
          <div className='mb-3'><div className='small text-body-secondary'>Thí sinh</div><div className='fw-semibold'>{moveTarget?.candidate?.learner?.fullName || '-'}</div><div className='small text-body-secondary'>{moveTarget?.candidate?.learner?.code || '-'}</div></div>
          <CFormLabel>Ca đích</CFormLabel>
          <CFormSelect value={moveScheduleId} onChange={(event) => setMoveScheduleId(event.target.value)}>
            <option value=''>Chọn ca đích</option>
            {selectableSchedules.filter((schedule) => Number(schedule.scheduleId) !== Number(moveTarget?.scheduleId || 0)).map((schedule) => <option key={schedule.scheduleId} value={schedule.scheduleId}>{`${formatDateTime(schedule.startAt)} · ${schedule.room?.name || '-'} · còn ${schedule.availableCapacity || 0} chỗ`}</option>)}
          </CFormSelect>
          <div className='mt-3'>
            <CFormLabel>Lý do</CFormLabel>
            <CFormTextarea rows={3} value={moveState.reason} onChange={(event) => setMoveState((current) => ({ ...current, reason: event.target.value }))} />
          </div>
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowMoveModal(false)} disabled={moveState.submitting}>Đóng</CButton><CButton color='primary' onClick={submitMove} disabled={moveState.submitting || !moveScheduleId || !moveState.reason.trim()}>{moveState.submitting ? 'Đang chuyển...' : 'Xác nhận chuyển ca'}</CButton></CModalFooter>
      </CModal>

      <CModal visible={showUnassignModal} onClose={() => setShowUnassignModal(false)}>
        <CModalHeader><CModalTitle>Bỏ phân bổ</CModalTitle></CModalHeader>
        <CModalBody>
          {unassignState.error ? <CAlert color='danger'>{unassignState.error}</CAlert> : null}
          <div className='mb-3'><div className='small text-body-secondary'>Thí sinh</div><div className='fw-semibold'>{unassignTarget?.candidate?.learner?.fullName || '-'}</div><div className='small text-body-secondary'>{unassignTarget?.candidate?.learner?.code || '-'}</div></div>
          <CFormLabel>Lý do</CFormLabel>
          <CFormTextarea rows={3} value={unassignState.reason} onChange={(event) => setUnassignState((current) => ({ ...current, reason: event.target.value }))} />
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowUnassignModal(false)} disabled={unassignState.submitting}>Đóng</CButton><CButton color='danger' onClick={submitUnassign} disabled={unassignState.submitting || !unassignState.reason.trim()}>{unassignState.submitting ? 'Đang bỏ phân...' : 'Xác nhận bỏ phân bổ'}</CButton></CModalFooter>
      </CModal>
    </div>
  )
}
