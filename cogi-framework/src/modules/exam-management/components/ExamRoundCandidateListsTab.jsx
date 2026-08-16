import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
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
  finalizeExamRoundCandidateList,
  generateExamRoundCandidateListSequence,
  getExamRoundCandidateListDetail,
  listExamRoundCandidateLists,
  reopenExamRoundCandidateList,
} from '../services/examRoundApi'
import { formatDateTime, formatMoney, getApiMessage, normalizeStatus } from '../utils/examRoundUi'

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

function getCandidateListStatusMeta(item) {
  const normalized = String(item?.status || item?.approvalStatus || '').trim().toLowerCase()
  if (normalized === 'finalized') return { color: 'success', label: 'Đã chốt' }
  if (normalized === 'draft') return { color: 'secondary', label: 'Nháp' }
  if (normalized === 'pending_approval') return { color: 'warning', label: 'Chờ duyệt' }
  return { color: 'secondary', label: normalized || '-' }
}

function getCandidateListApiMessage(error, fallback) {
  const code = String(error?.response?.data?.code || error?.response?.data?.error?.code || '').trim()
  const mapped = {
    EXAM_CANDIDATE_LIST_NOT_FOUND: 'Không tìm thấy danh sách thi phù hợp.',
    CANDIDATE_LIST_NOT_READY: 'Danh sách thi hiện chưa sẵn sàng để chốt.',
    CANDIDATE_LIST_FINALIZED: 'Danh sách thi đã chốt nên không thể chỉnh sửa theo cách này.',
    CANDIDATE_LIST_NOT_FINALIZED: 'Danh sách thi hiện chưa ở trạng thái đã chốt.',
    CANDIDATE_LIST_HAS_ATTENDANCE: 'Danh sách đã phát sinh điểm danh nên không thể mở lại.',
    CANDIDATE_LIST_HAS_RESULTS: 'Danh sách đã phát sinh kết quả nên không thể mở lại.',
    REOPEN_REASON_REQUIRED: 'Bạn cần nhập lý do mở lại danh sách.',
    SEQUENCE_NUMBER_ALREADY_EXISTS: 'Danh sách này đã có thứ tự, cần xác nhận ghi đè nếu muốn tạo lại.',
    EMPTY_CANDIDATE_LIST: 'Danh sách đang rỗng nên chưa thể chốt.',
  }[code]
  return mapped || getApiMessage(error, fallback)
}

export default function ExamRoundCandidateListsTab({ round, permissions, onRefresh }) {
  const canManage = permissions?.canManage === true
  const canApprove = permissions?.canApprove === true || permissions?.canManage === true
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [summary, setSummary] = useState(null)
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 10,
    keyword: '',
    componentId: '',
    subjectId: '',
    roomId: '',
    venueId: '',
    status: '',
  })
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [showFinalize, setShowFinalize] = useState(false)
  const [showReopen, setShowReopen] = useState(false)
  const [showSequence, setShowSequence] = useState(false)
  const [actionTarget, setActionTarget] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [overwriteSequence, setOverwriteSequence] = useState(false)

  const subjectOptions = useMemo(() => Array.isArray(round?.subjects) ? round.subjects.filter((item) => normalizeStatus(item?.status) === 'active') : [], [round?.subjects])
  const componentOptions = useMemo(() => subjectOptions.flatMap((subject) => Array.isArray(subject.components) ? subject.components.filter((component) => normalizeStatus(component?.status) === 'active').map((component) => ({ ...component, subjectId: subject.id, subjectName: subject.nameSnapshot })) : []), [subjectOptions])

  useEffect(() => {
    if (!round?.id) return
    loadLists(filters)
  }, [round?.id, filters.page, filters.pageSize, filters.componentId, filters.subjectId, filters.roomId, filters.venueId, filters.status])

  async function loadLists(nextFilters = filters) {
    if (!round?.id) return
    setLoading(true)
    setError('')
    try {
      const result = await listExamRoundCandidateLists(round.id, {
        page: nextFilters.page,
        pageSize: nextFilters.pageSize,
        ...(String(nextFilters.keyword || '').trim() ? { search: String(nextFilters.keyword).trim() } : {}),
        ...(String(nextFilters.componentId || '').trim() ? { componentId: nextFilters.componentId } : {}),
        ...(String(nextFilters.subjectId || '').trim() ? { subjectId: nextFilters.subjectId } : {}),
        ...(String(nextFilters.roomId || '').trim() ? { roomId: nextFilters.roomId } : {}),
        ...(String(nextFilters.venueId || '').trim() ? { venueId: nextFilters.venueId } : {}),
        ...(String(nextFilters.status || '').trim() ? { approvalStatus: nextFilters.status === 'finalized' ? 'approved' : nextFilters.status } : {}),
      })
      const data = Array.isArray(result?.data) ? result.data : []
      setRows(data)
      setPagination(result?.pagination || { page: 1, pageSize: nextFilters.pageSize || 10, total: 0, pageCount: 1 })
      const finalized = data.filter((item) => item?.status === 'finalized').length
      const draft = data.filter((item) => item?.status !== 'finalized').length
      const withIssues = data.filter((item) => item?.readyToFinalize !== true).length
      const readyForAttendance = data.filter((item) => item?.readyForAttendance === true).length
      const totalCandidates = data.reduce((total, item) => total + (Number(item?.activeCandidateCount || 0) || 0), 0)
      const uniqueLearners = totalCandidates
      setSummary({
        totalLists: Number(result?.summary?.totalLists || data.length || 0),
        draft,
        finalized,
        totalCandidates,
        uniqueLearners,
        withIssues,
        readyForAttendance,
      })
    } catch (requestError) {
      setRows([])
      setSummary(null)
      setPagination({ page: 1, pageSize: nextFilters.pageSize || 10, total: 0, pageCount: 1 })
      setError(getCandidateListApiMessage(requestError, 'Không tải được danh sách thi của đợt.'))
    } finally {
      setLoading(false)
    }
  }

  async function openDetail(item) {
    if (!round?.id || !item?.id) return
    setShowDetail(true)
    setDetailLoading(true)
    setDetailError('')
    try {
      const data = await getExamRoundCandidateListDetail(round.id, item.id, { pageSize: 1000 })
      setDetail(data || null)
    } catch (requestError) {
      setDetail(null)
      setDetailError(getCandidateListApiMessage(requestError, 'Không tải được chi tiết danh sách thi.'))
    } finally {
      setDetailLoading(false)
    }
  }

  async function refreshAll() {
    await Promise.all([loadLists(filters), onRefresh?.()])
    if (detail?.id) {
      try {
        const fresh = await getExamRoundCandidateListDetail(round.id, detail.id, { pageSize: 1000 })
        setDetail(fresh || null)
      } catch {}
    }
  }

  function openFinalize(item) {
    setActionTarget(item)
    setActionNote('')
    setActionError('')
    setShowFinalize(true)
  }

  function openReopen(item) {
    setActionTarget(item)
    setReopenReason('')
    setActionNote('')
    setActionError('')
    setShowReopen(true)
  }

  function openSequence(item) {
    setActionTarget(item)
    setActionError('')
    setOverwriteSequence(false)
    setShowSequence(true)
  }

  async function submitFinalize() {
    if (!round?.id || !actionTarget?.id || actionSubmitting) return
    setActionSubmitting(true)
    setActionError('')
    try {
      await finalizeExamRoundCandidateList(round.id, actionTarget.id, {
        ...(String(actionNote || '').trim() ? { note: String(actionNote).trim() } : {}),
      })
      setShowFinalize(false)
      await refreshAll()
    } catch (requestError) {
      setActionError(getCandidateListApiMessage(requestError, 'Không thể chốt danh sách thi.'))
    } finally {
      setActionSubmitting(false)
    }
  }

  async function submitReopen() {
    if (!round?.id || !actionTarget?.id || actionSubmitting) return
    setActionSubmitting(true)
    setActionError('')
    try {
      await reopenExamRoundCandidateList(round.id, actionTarget.id, {
        reason: reopenReason,
        ...(String(actionNote || '').trim() ? { note: String(actionNote).trim() } : {}),
      })
      setShowReopen(false)
      await refreshAll()
    } catch (requestError) {
      setActionError(getCandidateListApiMessage(requestError, 'Không thể mở lại danh sách thi.'))
    } finally {
      setActionSubmitting(false)
    }
  }

  async function submitSequence() {
    if (!round?.id || !actionTarget?.id || actionSubmitting) return
    setActionSubmitting(true)
    setActionError('')
    try {
      await generateExamRoundCandidateListSequence(round.id, actionTarget.id, {
        sortBy: 'full_name',
        overwriteExisting: overwriteSequence,
      })
      setShowSequence(false)
      await refreshAll()
    } catch (requestError) {
      setActionError(getCandidateListApiMessage(requestError, 'Không thể sinh thứ tự thi.'))
    } finally {
      setActionSubmitting(false)
    }
  }

  return (
    <div className='d-flex flex-column gap-4'>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CRow className='g-3'>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Ca có danh sách' value={formatMoney(summary?.totalLists || 0)} color='info' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Danh sách nháp' value={formatMoney(summary?.draft || 0)} color='warning' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Đã chốt' value={formatMoney(summary?.finalized || 0)} color='success' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Lượt thi' value={formatMoney(summary?.totalCandidates || 0)} color='dark' helper='Không phải learner unique' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Có lỗi' value={formatMoney(summary?.withIssues || 0)} color='danger' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Sẵn sàng điểm danh' value={formatMoney(summary?.readyForAttendance || 0)} color='success' /></CCol>
      </CRow>

      <CCard>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol lg={3} md={6}><CFormLabel>Tìm kiếm</CFormLabel><CFormInput value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder='Mã list, tên list...' /></CCol>
            <CCol lg={3} md={6}><CFormLabel>Môn</CFormLabel><CFormSelect value={filters.subjectId} onChange={(event) => setFilters((current) => ({ ...current, page: 1, subjectId: event.target.value, componentId: '' }))}><option value=''>Tất cả</option>{subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.nameSnapshot}</option>)}</CFormSelect></CCol>
            <CCol lg={3} md={6}><CFormLabel>Kỹ năng</CFormLabel><CFormSelect value={filters.componentId} onChange={(event) => setFilters((current) => ({ ...current, page: 1, componentId: event.target.value }))}><option value=''>Tất cả</option>{componentOptions.filter((item) => !filters.subjectId || String(item.subjectId) === String(filters.subjectId)).map((component) => <option key={component.id} value={component.id}>{component.nameSnapshot}</option>)}</CFormSelect></CCol>
            <CCol lg={3} md={6}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, page: 1, status: event.target.value }))}><option value=''>Tất cả</option><option value='draft'>Nháp</option><option value='finalized'>Đã chốt</option></CFormSelect></CCol>
            <CCol xs={12}><div className='d-flex gap-2 flex-wrap'><CButton color='primary' onClick={() => loadLists({ ...filters, page: 1 })}>Tìm</CButton><CButton color='secondary' variant='outline' onClick={() => setFilters({ page: 1, pageSize: 10, keyword: '', componentId: '', subjectId: '', roomId: '', venueId: '', status: '' })}>Xóa bộ lọc</CButton></div></CCol>
          </CRow>
        </CCardBody>
      </CCard>

      <CCard>
        <CCardHeader><strong>Danh sách thi theo ca</strong></CCardHeader>
        <CCardBody>
          {loading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải danh sách thi...</div> : null}
          <div className='d-none d-md-block'>
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Danh sách</CTableHeaderCell>
                  <CTableHeaderCell>Môn</CTableHeaderCell>
                  <CTableHeaderCell>Kỹ năng</CTableHeaderCell>
                  <CTableHeaderCell>Ngày thi</CTableHeaderCell>
                  <CTableHeaderCell>Thời gian</CTableHeaderCell>
                  <CTableHeaderCell>Phòng</CTableHeaderCell>
                  <CTableHeaderCell>Số thí sinh</CTableHeaderCell>
                  <CTableHeaderCell>Sức chứa</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Sẵn sàng</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 && !loading ? <CTableRow><CTableDataCell colSpan={11} className='text-center text-body-secondary py-4'>Chưa có thí sinh được phân bổ vào các ca thi.</CTableDataCell></CTableRow> : null}
                {rows.map((item) => {
                  const statusMeta = getCandidateListStatusMeta(item)
                  return (
                    <CTableRow key={item.id}>
                      <CTableDataCell><div className='fw-semibold'>{item.code || '-'}</div><div className='small text-body-secondary'>{item.name || '-'}</div></CTableDataCell>
                      <CTableDataCell>{item.schedule?.id ? (componentOptions.find((entry) => String(entry.id) === String(item.component?.id))?.subjectName || '-') : '-'}</CTableDataCell>
                      <CTableDataCell>{item.component?.nameSnapshot || '-'}</CTableDataCell>
                      <CTableDataCell>{item.schedule?.startAt ? formatDateTime(item.schedule.startAt).slice(0, 10) : '-'}</CTableDataCell>
                      <CTableDataCell>{`${formatDateTime(item.schedule?.startAt)} - ${formatDateTime(item.schedule?.endAt)}`}</CTableDataCell>
                      <CTableDataCell>{item.room?.name || '-'}</CTableDataCell>
                      <CTableDataCell>{formatMoney(item.activeCandidateCount || 0)}</CTableDataCell>
                      <CTableDataCell>{formatMoney(item.capacity || 0)}</CTableDataCell>
                      <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                      <CTableDataCell>{item.readyToFinalize ? <CBadge color='success'>Sẵn sàng</CBadge> : <CBadge color='warning'>Còn lỗi</CBadge>}</CTableDataCell>
                      <CTableDataCell><div className='d-flex gap-2 flex-wrap'><CButton color='secondary' size='sm' variant='outline' onClick={() => openDetail(item)}>Xem danh sách</CButton>{canManage && item.status !== 'finalized' ? <CButton color='secondary' size='sm' variant='outline' onClick={() => openSequence(item)}>Sinh thứ tự</CButton> : null}{canApprove && item.status !== 'finalized' ? <CButton color='success' size='sm' onClick={() => openFinalize(item)}>Chốt</CButton> : null}{canApprove && item.status === 'finalized' ? <CButton color='warning' size='sm' variant='outline' onClick={() => openReopen(item)}>Mở lại</CButton> : null}</div></CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          </div>
          <div className='d-flex d-md-none flex-column gap-3'>
            {rows.length === 0 && !loading ? <div className='text-center text-body-secondary py-4'>Chưa có thí sinh được phân bổ vào các ca thi.</div> : null}
            {rows.map((item) => {
              const statusMeta = getCandidateListStatusMeta(item)
              return (
                <CCard key={item.id}><CCardBody className='d-flex flex-column gap-2'>
                  <div className='d-flex justify-content-between gap-2'><div><div className='fw-semibold'>{item.code || '-'}</div><div className='small text-body-secondary'>{item.component?.nameSnapshot || '-'}</div></div><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></div>
                  <div className='small text-body-secondary'>{formatDateTime(item.schedule?.startAt)} · {item.room?.name || '-'}</div>
                  <div className='small text-body-secondary'>{formatMoney(item.activeCandidateCount || 0)}/{formatMoney(item.capacity || 0)} thí sinh</div>
                  <div className='d-flex gap-2 flex-wrap mt-1'><CButton color='secondary' size='sm' variant='outline' onClick={() => openDetail(item)}>Xem</CButton>{canManage && item.status !== 'finalized' ? <CButton color='secondary' size='sm' variant='outline' onClick={() => openSequence(item)}>Thứ tự</CButton> : null}{canApprove && item.status !== 'finalized' ? <CButton color='success' size='sm' onClick={() => openFinalize(item)}>Chốt</CButton> : null}{canApprove && item.status === 'finalized' ? <CButton color='warning' size='sm' variant='outline' onClick={() => openReopen(item)}>Mở lại</CButton> : null}</div>
                </CCardBody></CCard>
              )
            })}
          </div>
        </CCardBody>
      </CCard>

      <CModal visible={showDetail} onClose={() => setShowDetail(false)} size='xl' scrollable>
        <CModalHeader><CModalTitle>Chi tiết danh sách thi</CModalTitle></CModalHeader>
        <CModalBody>
          {detailError ? <CAlert color='danger'>{detailError}</CAlert> : null}
          {detailLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết...</div> : null}
          {!detailLoading && detail ? (
            <CRow className='g-4'>
              <CCol lg={6}><CCard className='h-100'><CCardHeader><strong>Thông tin ca thi</strong></CCardHeader><CCardBody><div className='mb-2'><div className='small text-body-secondary'>Danh sách</div><div className='fw-semibold'>{detail.code || '-'}</div></div><div className='mb-2'><div className='small text-body-secondary'>Kỹ năng</div><div>{detail.component?.nameSnapshot || '-'}</div></div><div className='mb-2'><div className='small text-body-secondary'>Ngày giờ</div><div>{formatDateTime(detail.schedule?.startAt)} - {formatDateTime(detail.schedule?.endAt)}</div></div><div><div className='small text-body-secondary'>Phòng</div><div>{detail.room?.name || '-'} · {detail.venue?.name || '-'}</div></div></CCardBody></CCard></CCol>
              <CCol lg={6}><CCard className='h-100'><CCardHeader><strong>Trạng thái danh sách</strong></CCardHeader><CCardBody><div className='mb-2'><div className='small text-body-secondary'>Trạng thái</div><div><CBadge color={getCandidateListStatusMeta(detail).color}>{getCandidateListStatusMeta(detail).label}</CBadge></div></div><div className='mb-2'><div className='small text-body-secondary'>Số thí sinh</div><div>{formatMoney(detail.activeCandidateCount || 0)} / {formatMoney(detail.capacity || 0)}</div></div><div className='mb-2'><div className='small text-body-secondary'>Ready to finalize</div><div>{detail.readiness?.readyToFinalize ? 'Có' : 'Chưa'}</div></div><div className='mb-2'><div className='small text-body-secondary'>Ready for attendance</div><div>{detail.readiness?.readyForAttendance ? 'Có' : 'Chưa'}</div></div><div><div className='small text-body-secondary'>Blocking reasons</div><div style={{ whiteSpace: 'pre-wrap' }}>{Array.isArray(detail.blockingReasons) && detail.blockingReasons.length > 0 ? detail.blockingReasons.join(', ') : '-'}</div></div></CCardBody></CCard></CCol>
              <CCol xs={12}><CCard><CCardHeader><strong>Danh sách thí sinh</strong></CCardHeader><CCardBody><CTable responsive><CTableHead><CTableRow><CTableHeaderCell>STT</CTableHeaderCell><CTableHeaderCell>SBD</CTableHeaderCell><CTableHeaderCell>Mã hồ sơ</CTableHeaderCell><CTableHeaderCell>Mã learner</CTableHeaderCell><CTableHeaderCell>Họ tên</CTableHeaderCell><CTableHeaderCell>Trạng thái</CTableHeaderCell></CTableRow></CTableHead><CTableBody>{Array.isArray(detail.candidates) && detail.candidates.length > 0 ? detail.candidates.slice().sort((left, right) => (Number(left?.sequenceNumber || 0) || 999999) - (Number(right?.sequenceNumber || 0) || 999999)).map((candidate) => <CTableRow key={candidate.id}><CTableDataCell>{candidate.sequenceNumber || '-'}</CTableDataCell><CTableDataCell>{candidate.candidateNumber || '-'}</CTableDataCell><CTableDataCell>{candidate.registrationCode || '-'}</CTableDataCell><CTableDataCell>{candidate.learner?.code || '-'}</CTableDataCell><CTableDataCell>{candidate.learner?.fullName || '-'}</CTableDataCell><CTableDataCell>{candidate.candidateStatus || '-'}</CTableDataCell></CTableRow>) : <CTableRow><CTableDataCell colSpan={6} className='text-center text-body-secondary py-3'>Danh sách hiện chưa có thí sinh.</CTableDataCell></CTableRow>}</CTableBody></CTable></CCardBody></CCard></CCol>
            </CRow>
          ) : null}
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowDetail(false)}>Đóng</CButton></CModalFooter>
      </CModal>

      <CModal visible={showSequence} onClose={() => setShowSequence(false)}>
        <CModalHeader><CModalTitle>Sinh thứ tự thi</CModalTitle></CModalHeader>
        <CModalBody>
          {actionError ? <CAlert color='danger'>{actionError}</CAlert> : null}
          <div className='mb-3'>Thứ tự hiện tại sẽ được thay thế nếu bạn bật ghi đè.</div>
          <CFormCheck label='Ghi đè thứ tự đã có' checked={overwriteSequence} onChange={(event) => setOverwriteSequence(event.target.checked)} />
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowSequence(false)} disabled={actionSubmitting}>Đóng</CButton><CButton color='primary' onClick={submitSequence} disabled={actionSubmitting}>{actionSubmitting ? 'Đang sinh...' : 'Sinh thứ tự'}</CButton></CModalFooter>
      </CModal>

      <CModal visible={showFinalize} onClose={() => setShowFinalize(false)}>
        <CModalHeader><CModalTitle>Chốt danh sách thi</CModalTitle></CModalHeader>
        <CModalBody>
          {actionError ? <CAlert color='danger'>{actionError}</CAlert> : null}
          <div className='mb-3'><div className='small text-body-secondary'>Kỹ năng</div><div className='fw-semibold'>{actionTarget?.component?.nameSnapshot || '-'}</div><div className='small text-body-secondary'>{formatDateTime(actionTarget?.schedule?.startAt)} · {actionTarget?.room?.name || '-'}</div></div>
          <div className='mb-3'><div className='small text-body-secondary'>Số thí sinh / sức chứa</div><div>{formatMoney(actionTarget?.activeCandidateCount || 0)} / {formatMoney(actionTarget?.capacity || 0)}</div></div>
          <div className='mb-3'><div className='small text-body-secondary'>Readiness</div><div>{actionTarget?.readyToFinalize ? 'Sẵn sàng' : 'Chưa sẵn sàng'}</div></div>
          <CAlert color='warning'>Sau khi chốt, danh sách sẽ được khóa để sử dụng cho điểm danh.</CAlert>
          <CFormLabel>Ghi chú</CFormLabel>
          <CFormTextarea rows={3} value={actionNote} onChange={(event) => setActionNote(event.target.value)} />
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowFinalize(false)} disabled={actionSubmitting}>Đóng</CButton><CButton color='success' onClick={submitFinalize} disabled={actionSubmitting}>{actionSubmitting ? 'Đang chốt...' : 'Chốt danh sách'}</CButton></CModalFooter>
      </CModal>

      <CModal visible={showReopen} onClose={() => setShowReopen(false)}>
        <CModalHeader><CModalTitle>Mở lại danh sách thi</CModalTitle></CModalHeader>
        <CModalBody>
          {actionError ? <CAlert color='danger'>{actionError}</CAlert> : null}
          <CAlert color='warning'>Danh sách sau khi mở lại có thể tiếp tục thay đổi phân bổ. Chỉ thực hiện khi chưa phát sinh điểm danh hoặc kết quả thi.</CAlert>
          <CFormLabel>Lý do mở lại</CFormLabel>
          <CFormTextarea rows={3} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
          <div className='mt-3'><CFormLabel>Ghi chú</CFormLabel><CFormTextarea rows={3} value={actionNote} onChange={(event) => setActionNote(event.target.value)} /></div>
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowReopen(false)} disabled={actionSubmitting}>Đóng</CButton><CButton color='warning' onClick={submitReopen} disabled={actionSubmitting || !String(reopenReason || '').trim()}>{actionSubmitting ? 'Đang mở lại...' : 'Mở lại danh sách'}</CButton></CModalFooter>
      </CModal>
    </div>
  )
}
