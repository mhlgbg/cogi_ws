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
  cancelExamRoundSchedule,
  cloneExamRoundSchedule,
  createExamRoundSchedule,
  generateExamRoundSchedules,
  getExamRoundSchedule,
  getExamRoundScheduleSummary,
  getExamRoundVenueRoomConfiguration,
  listExamRoundSchedules,
  updateExamRoundSchedule,
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

function getScheduleApiMessage(error, fallback) {
  const code = String(error?.response?.data?.code || error?.response?.data?.error?.code || '').trim()
  const mapped = {
    EXAM_ROUND_NOT_FOUND: 'Không tìm thấy đợt thi trong tenant hiện tại.',
    EXAM_SCHEDULE_NOT_FOUND: 'Không tìm thấy ca thi phù hợp.',
    EXAM_ROOM_NOT_FOUND: 'Không tìm thấy phòng thi phù hợp.',
    EXAM_ROOM_INACTIVE: 'Phòng thi đang ngừng sử dụng.',
    EXAM_VENUE_INACTIVE: 'Địa điểm của phòng thi đang ngừng sử dụng.',
    EXAM_ROOM_NOT_ALLOWED_FOR_ROUND: 'Phòng thi này chưa được cấu hình cho đợt thi.',
    EXAM_ROUND_COMPONENT_INACTIVE: 'Kỹ năng/môn snapshot hiện không còn active để lập lịch.',
    EXAM_SCHEDULE_INVALID_TIME: 'Thời gian ca thi không hợp lệ.',
    EXAM_ROUND_EXAM_WINDOW_NOT_CONFIGURED: 'Đợt thi chưa cấu hình đủ khung thời gian thi.',
    EXAM_SCHEDULE_OUTSIDE_EXAM_WINDOW: 'Ca thi nằm ngoài khung thời gian thi của đợt.',
    EXAM_ROOM_SCHEDULE_CONFLICT: 'Phòng thi đã bị trùng lịch trong khoảng thời gian chọn.',
    EXAM_SCHEDULE_CAPACITY_EXCEEDS_ROOM: 'Sức chứa ca thi không được vượt sức chứa phòng.',
    INVALID_EXAM_SCHEDULE_CAPACITY: 'Sức chứa ca thi không hợp lệ.',
    EXAM_SCHEDULE_IN_USE: 'Ca thi này đang có dependency và chưa thể đổi phần cốt lõi.',
    EXAM_SCHEDULE_ALREADY_ASSIGNED: 'Ca thi đã có dữ liệu gán và chưa thể hủy.',
    EXAM_SCHEDULE_HAS_CANDIDATES: 'Ca thi đã có candidate/candidate list và chưa thể hủy.',
  }[code]
  return mapped || getApiMessage(error, fallback)
}

function getScheduleStatusMeta(status) {
  const normalized = String(status || '').trim().toLowerCase()
  return {
    draft: { color: 'secondary', label: 'Nháp' },
    scheduled: { color: 'info', label: 'Đã lên lịch' },
    published: { color: 'success', label: 'Đã publish' },
    in_progress: { color: 'primary', label: 'Đang diễn ra' },
    completed: { color: 'success', label: 'Hoàn thành' },
    postponed: { color: 'warning', label: 'Hoãn' },
    cancelled: { color: 'danger', label: 'Đã hủy' },
  }[normalized] || { color: 'secondary', label: normalized || '-' }
}

function buildScheduleForm() {
  return {
    subjectId: '',
    examRoundComponentId: '',
    examRoomId: '',
    startAt: '',
    endAt: '',
    capacity: '',
    code: '',
    note: '',
  }
}

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function groupSchedulesByDay(items = []) {
  const map = new Map()
  for (const item of items) {
    const date = item?.startAt ? new Date(item.startAt) : null
    const key = date && !Number.isNaN(date.getTime())
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      : 'unknown'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([dateKey, itemsForDay]) => ({
    dateKey,
    items: itemsForDay.slice().sort((left, right) => Date.parse(left?.startAt || '') - Date.parse(right?.startAt || '')),
  }))
}

function addMinutes(isoValue, minutes) {
  const start = Date.parse(isoValue || '')
  if (!Number.isFinite(start)) return null
  return new Date(start + (minutes * 60 * 1000)).toISOString()
}

function combineDateTime(dateText, timeText) {
  const normalizedDate = String(dateText || '').trim()
  const normalizedTime = String(timeText || '').trim()
  if (!normalizedDate || !normalizedTime) return null
  const value = new Date(`${normalizedDate}T${normalizedTime}:00`)
  if (Number.isNaN(value.getTime())) return null
  return value.toISOString()
}

export default function ExamRoundSchedulesTab({ round, permissions, onRefresh }) {
  const canManage = permissions?.canManage === true
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [summary, setSummary] = useState(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 10,
    keyword: '',
    subjectId: '',
    componentId: '',
    venueId: '',
    roomId: '',
    dateFrom: '',
    dateTo: '',
    status: '',
  })
  const [viewMode, setViewMode] = useState('list')
  const [roomConfig, setRoomConfig] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [formTarget, setFormTarget] = useState(null)
  const [formValues, setFormValues] = useState(buildScheduleForm())
  const [formError, setFormError] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateValues, setGenerateValues] = useState({ date: '', startTime: '', roomId: '', componentIds: [] })
  const [generateError, setGenerateError] = useState('')
  const [generateSubmitting, setGenerateSubmitting] = useState(false)

  const subjectOptions = useMemo(() => (Array.isArray(round?.subjects) ? round.subjects : []).filter((item) => normalizeStatus(item?.status) === 'active'), [round?.subjects])
  const componentOptions = useMemo(() => subjectOptions.flatMap((subject) => Array.isArray(subject.components) ? subject.components.filter((component) => normalizeStatus(component?.status) === 'active').map((component) => ({ ...component, subjectId: subject.id, subjectName: subject.nameSnapshot })) : []), [subjectOptions])
  const venueOptions = useMemo(() => Array.isArray(roomConfig?.selectedVenues) ? roomConfig.selectedVenues : [], [roomConfig?.selectedVenues])
  const roomOptions = useMemo(() => Array.isArray(roomConfig?.selectedRooms) ? roomConfig.selectedRooms : [], [roomConfig?.selectedRooms])
  const filteredRoomOptions = useMemo(() => {
    const venueId = Number(filters.venueId || 0)
    if (!venueId) return roomOptions
    return roomOptions.filter((item) => Number(item?.examVenue?.id || 0) === venueId)
  }, [filters.venueId, roomOptions])
  const formComponentOptions = useMemo(() => {
    const subjectId = Number(formValues.subjectId || 0)
    if (!subjectId) return componentOptions
    return componentOptions.filter((item) => Number(item?.subjectId || 0) === subjectId)
  }, [componentOptions, formValues.subjectId])
  const formRoomOptions = useMemo(() => {
    const subjectComponent = componentOptions.find((item) => Number(item?.id || 0) === Number(formValues.examRoundComponentId || 0))
    void subjectComponent
    return roomOptions
  }, [componentOptions, formValues.examRoundComponentId, roomOptions])
  const groupedRows = useMemo(() => groupSchedulesByDay(rows), [rows])
  const scheduledComponentIdSet = useMemo(() => new Set(rows.map((item) => Number(item?.component?.id || 0)).filter(Boolean)), [rows])
  const generateComponentCandidates = useMemo(() => componentOptions.map((component) => {
    const scheduleCount = rows.filter((item) => Number(item?.component?.id || 0) === Number(component?.id || 0) && normalizeStatus(item?.status) !== 'cancelled').length
    const duration = Number(component?.durationMinutes || 0)
    const effectiveDuration = Number.isInteger(duration) && duration > 0 ? duration : 60
    return {
      ...component,
      scheduleCount,
      willCreate: scheduleCount === 0,
      effectiveDuration,
      usesFallbackDuration: !(Number.isInteger(duration) && duration > 0),
    }
  }), [componentOptions, rows])
  const generatePreview = useMemo(() => {
    const startAt = combineDateTime(generateValues.date, generateValues.startTime)
    const selectedComponentIds = Array.isArray(generateValues.componentIds) && generateValues.componentIds.length > 0
      ? generateValues.componentIds.map((item) => Number(item || 0)).filter(Boolean)
      : generateComponentCandidates.filter((item) => item.willCreate).map((item) => Number(item.id || 0)).filter(Boolean)
    const room = roomOptions.find((item) => Number(item?.id || 0) === Number(generateValues.roomId || 0)) || null
    return generateComponentCandidates
      .filter((component) => selectedComponentIds.includes(Number(component.id || 0)))
      .map((component) => ({
        component,
        startAt,
        endAt: startAt ? addMinutes(startAt, component.effectiveDuration) : null,
        room,
        status: component.willCreate ? 'Sẽ tạo' : `Bỏ qua (${component.scheduleCount} ca đã có)`,
      }))
  }, [generateValues.date, generateValues.startTime, generateValues.roomId, generateValues.componentIds, generateComponentCandidates, roomOptions])

  useEffect(() => {
    if (!round?.id) return
    loadBoard()
    loadRoomConfiguration()
  }, [round?.id])

  useEffect(() => {
    if (!round?.id) return
    loadList(filters)
  }, [round?.id, filters.page, filters.pageSize, filters.subjectId, filters.componentId, filters.venueId, filters.roomId, filters.status])

  async function loadBoard() {
    await Promise.all([loadSummary(), loadList(filters)])
  }

  async function loadSummary() {
    if (!round?.id) return
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const data = await getExamRoundScheduleSummary(round.id)
      setSummary(data || null)
    } catch (requestError) {
      setSummary(null)
      setSummaryError(getScheduleApiMessage(requestError, 'Không tải được tổng quan lịch thi.'))
    } finally {
      setSummaryLoading(false)
    }
  }

  async function loadList(nextFilters = filters) {
    if (!round?.id) return
    setListLoading(true)
    setListError('')
    try {
      const result = await listExamRoundSchedules(round.id, {
        page: nextFilters.page,
        pageSize: nextFilters.pageSize,
        ...(String(nextFilters.keyword || '').trim() ? { search: String(nextFilters.keyword || '').trim() } : {}),
        ...(String(nextFilters.subjectId || '').trim() ? { subjectId: nextFilters.subjectId } : {}),
        ...(String(nextFilters.componentId || '').trim() ? { componentId: nextFilters.componentId } : {}),
        ...(String(nextFilters.venueId || '').trim() ? { venueId: nextFilters.venueId } : {}),
        ...(String(nextFilters.roomId || '').trim() ? { roomId: nextFilters.roomId } : {}),
        ...(String(nextFilters.dateFrom || '').trim() ? { dateFrom: new Date(nextFilters.dateFrom).toISOString() } : {}),
        ...(String(nextFilters.dateTo || '').trim() ? { dateTo: new Date(nextFilters.dateTo).toISOString() } : {}),
        ...(String(nextFilters.status || '').trim() ? { status: nextFilters.status } : {}),
      })
      setRows(Array.isArray(result?.data) ? result.data : [])
      setPagination(result?.pagination || { page: 1, pageSize: nextFilters.pageSize || 10, total: 0, pageCount: 1 })
      if (!summary && result?.summary) setSummary(result.summary)
    } catch (requestError) {
      setRows([])
      setPagination({ page: nextFilters.page || 1, pageSize: nextFilters.pageSize || 10, total: 0, pageCount: 1 })
      setListError(getScheduleApiMessage(requestError, 'Không tải được danh sách lịch thi.'))
    } finally {
      setListLoading(false)
    }
  }

  async function loadRoomConfiguration() {
    if (!round?.id) return
    try {
      const data = await getExamRoundVenueRoomConfiguration(round.id)
      setRoomConfig(data || null)
    } catch {}
  }

  async function openDetail(scheduleId) {
    if (!round?.id || !scheduleId) return
    setShowDetail(true)
    setDetailLoading(true)
    setDetailError('')
    try {
      const data = await getExamRoundSchedule(round.id, scheduleId)
      setDetail(data || null)
    } catch (requestError) {
      setDetail(null)
      setDetailError(getScheduleApiMessage(requestError, 'Không tải được chi tiết ca thi.'))
    } finally {
      setDetailLoading(false)
    }
  }

  function openCreate() {
    setFormMode('create')
    setFormTarget(null)
    setFormValues(buildScheduleForm())
    setFormError('')
    setShowForm(true)
  }

  function openGenerate() {
    setGenerateValues({ date: '', startTime: '', roomId: '', componentIds: generateComponentCandidates.filter((item) => item.willCreate).map((item) => Number(item.id || 0)) })
    setGenerateError('')
    setShowGenerateModal(true)
  }

  function openEdit(item) {
    setFormMode('edit')
    setFormTarget(item)
    const matchedComponent = componentOptions.find((component) => Number(component?.id || 0) === Number(item?.component?.id || 0))
    setFormValues({
      subjectId: matchedComponent?.subjectId ? String(matchedComponent.subjectId) : '',
      examRoundComponentId: item?.component?.id ? String(item.component.id) : '',
      examRoomId: item?.examRoom?.id ? String(item.examRoom.id) : '',
      startAt: toDateInput(item?.startAt),
      endAt: toDateInput(item?.endAt),
      capacity: item?.capacity ? String(item.capacity) : '',
      code: item?.externalExamCode || '',
      note: item?.note || '',
    })
    setFormError('')
    setShowForm(true)
  }

  function openClone(item) {
    setFormMode('clone')
    setFormTarget(item)
    const matchedComponent = componentOptions.find((component) => Number(component?.id || 0) === Number(item?.component?.id || 0))
    setFormValues({
      subjectId: matchedComponent?.subjectId ? String(matchedComponent.subjectId) : '',
      examRoundComponentId: item?.component?.id ? String(item.component.id) : '',
      examRoomId: item?.examRoom?.id ? String(item.examRoom.id) : '',
      startAt: toDateInput(item?.startAt),
      endAt: toDateInput(item?.endAt),
      capacity: item?.capacity ? String(item.capacity) : '',
      code: '',
      note: item?.note || '',
    })
    setFormError('')
    setShowForm(true)
  }

  async function submitForm() {
    if (!round?.id || formSubmitting) return
    setFormSubmitting(true)
    setFormError('')
    try {
      const payload = {
        examRoundComponentId: Number(formValues.examRoundComponentId || 0) || null,
        examRoomId: Number(formValues.examRoomId || 0) || null,
        startAt: formValues.startAt ? new Date(formValues.startAt).toISOString() : null,
        endAt: formValues.endAt ? new Date(formValues.endAt).toISOString() : null,
        capacity: formValues.capacity === '' ? null : Number(formValues.capacity || 0),
        code: String(formValues.code || '').trim() || null,
        note: String(formValues.note || '').trim() || null,
      }
      if (formMode === 'create') {
        await createExamRoundSchedule(round.id, payload)
      } else if (formMode === 'edit' && formTarget?.id) {
        await updateExamRoundSchedule(round.id, formTarget.id, payload)
      } else if (formMode === 'clone' && formTarget?.id) {
        await cloneExamRoundSchedule(round.id, formTarget.id, payload)
      }
      setShowForm(false)
      await Promise.all([loadSummary(), loadList(filters)])
      await onRefresh?.()
    } catch (requestError) {
      setFormError(getScheduleApiMessage(requestError, 'Không thể lưu ca thi.'))
    } finally {
      setFormSubmitting(false)
    }
  }

  function openCancel(item) {
    setCancelTarget(item)
    setCancelReason('')
    setCancelError('')
    setShowCancelDialog(true)
  }

  async function submitCancel() {
    if (!round?.id || !cancelTarget?.id || cancelSubmitting) return
    setCancelSubmitting(true)
    setCancelError('')
    try {
      await cancelExamRoundSchedule(round.id, cancelTarget.id, { reason: cancelReason })
      setShowCancelDialog(false)
      await Promise.all([loadSummary(), loadList(filters)])
      await onRefresh?.()
    } catch (requestError) {
      setCancelError(getScheduleApiMessage(requestError, 'Không thể hủy ca thi.'))
    } finally {
      setCancelSubmitting(false)
    }
  }

  async function submitGenerate() {
    if (!round?.id || generateSubmitting) return
    setGenerateSubmitting(true)
    setGenerateError('')
    try {
      const payload = {
        date: generateValues.date,
        startTime: generateValues.startTime,
        roomId: generateValues.roomId ? Number(generateValues.roomId) : null,
        componentIds: Array.isArray(generateValues.componentIds) && generateValues.componentIds.length > 0 ? generateValues.componentIds.map((item) => Number(item || 0)).filter(Boolean) : undefined,
      }
      const result = await generateExamRoundSchedules(round.id, payload)
      void result
      setShowGenerateModal(false)
      await Promise.all([loadSummary(), loadList(filters)])
      await onRefresh?.()
    } catch (requestError) {
      setGenerateError(getScheduleApiMessage(requestError, 'Không thể sinh tự động ca thi.'))
    } finally {
      setGenerateSubmitting(false)
    }
  }

  function resetFilters() {
    setFilters({
      page: 1,
      pageSize: 10,
      keyword: '',
      subjectId: '',
      componentId: '',
      venueId: '',
      roomId: '',
      dateFrom: '',
      dateTo: '',
      status: '',
    })
  }

  return (
    <div className='d-flex flex-column gap-4'>
      {summaryError ? <CAlert color='warning'>{summaryError}</CAlert> : null}
      {listError ? <CAlert color='danger'>{listError}</CAlert> : null}
      {Array.isArray(summary?.blockingReasons) && summary.blockingReasons.length > 0 ? <CAlert color='warning'>Chưa sẵn sàng cho bước phân bổ: {summary.blockingReasons.join(', ')}</CAlert> : null}
      {Array.isArray(summary?.unscheduledComponentItems) && summary.unscheduledComponentItems.length > 0 ? (
        <CAlert color='info'>Kỹ năng chưa có lịch: {summary.unscheduledComponentItems.map((item) => item?.nameSnapshot || '-').join(', ')}</CAlert>
      ) : null}

      <CRow className='g-3'>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Tổng ca thi' value={summaryLoading ? '...' : (summary?.total ?? 0)} color='info' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Môn đã có lịch' value={summaryLoading ? '...' : (summary?.subjectsScheduled ?? 0)} color='success' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Kỹ năng đã có lịch' value={summaryLoading ? '...' : (summary?.componentsScheduled ?? 0)} color='success' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Phòng dùng' value={summaryLoading ? '...' : (summary?.roomsInUse ?? 0)} color='info' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Tổng sức chứa' value={summaryLoading ? '...' : formatMoney(summary?.totalCapacity ?? 0)} color='success' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Sẵn sàng phân bổ' value={summaryLoading ? '...' : (summary?.readyForAllocation ? 'Có' : 'Chưa')} color={summary?.readyForAllocation ? 'success' : 'warning'} /></CCol>
      </CRow>

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <strong>Lịch thi</strong>
          <div className='d-flex gap-2 flex-wrap'>
            <CButton color={viewMode === 'list' ? 'primary' : 'secondary'} variant={viewMode === 'list' ? undefined : 'outline'} size='sm' onClick={() => setViewMode('list')}>Danh sách</CButton>
            <CButton color={viewMode === 'day' ? 'primary' : 'secondary'} variant={viewMode === 'day' ? undefined : 'outline'} size='sm' onClick={() => setViewMode('day')}>Theo ngày</CButton>
            {canManage ? <CButton color='secondary' size='sm' variant='outline' onClick={openGenerate}>Sinh tự động ca thi</CButton> : null}
            {canManage ? <CButton color='primary' size='sm' onClick={openCreate}>Tạo ca thi</CButton> : null}
          </div>
        </CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end mb-4'>
            <CCol lg={3} md={6}><CFormLabel>Tìm kiếm</CFormLabel><CFormInput value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder='Mã ca, ghi chú...' /></CCol>
            <CCol lg={2} md={6}><CFormLabel>Môn</CFormLabel><CFormSelect value={filters.subjectId} onChange={(event) => { const nextSubjectId = event.target.value; setFilters((current) => ({ ...current, page: 1, subjectId: nextSubjectId, componentId: current.componentId && !componentOptions.some((item) => String(item.subjectId) === String(nextSubjectId) && String(item.id) === String(current.componentId)) ? '' : current.componentId })) }}><option value=''>Tất cả</option>{subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.nameSnapshot}</option>)}</CFormSelect></CCol>
            <CCol lg={2} md={6}><CFormLabel>Kỹ năng</CFormLabel><CFormSelect value={filters.componentId} onChange={(event) => setFilters((current) => ({ ...current, page: 1, componentId: event.target.value }))}><option value=''>Tất cả</option>{componentOptions.filter((item) => !filters.subjectId || String(item.subjectId) === String(filters.subjectId)).map((component) => <option key={component.id} value={component.id}>{component.nameSnapshot}</option>)}</CFormSelect></CCol>
            <CCol lg={2} md={6}><CFormLabel>Địa điểm</CFormLabel><CFormSelect value={filters.venueId} onChange={(event) => setFilters((current) => ({ ...current, page: 1, venueId: event.target.value, roomId: '' }))}><option value=''>Tất cả</option>{venueOptions.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</CFormSelect></CCol>
            <CCol lg={2} md={6}><CFormLabel>Phòng</CFormLabel><CFormSelect value={filters.roomId} onChange={(event) => setFilters((current) => ({ ...current, page: 1, roomId: event.target.value }))}><option value=''>Tất cả</option>{filteredRoomOptions.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</CFormSelect></CCol>
            <CCol lg={1} md={6}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, page: 1, status: event.target.value }))}><option value=''>Tất cả</option><option value='draft'>Nháp</option><option value='published'>Published</option><option value='cancelled'>Đã hủy</option></CFormSelect></CCol>
            <CCol lg={3} md={6}><CFormLabel>Từ ngày</CFormLabel><CFormInput type='datetime-local' value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></CCol>
            <CCol lg={3} md={6}><CFormLabel>Đến ngày</CFormLabel><CFormInput type='datetime-local' value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></CCol>
            <CCol xs={12}><div className='d-flex gap-2 flex-wrap'><CButton color='primary' onClick={() => loadList({ ...filters, page: 1 })}>Tìm</CButton><CButton color='secondary' variant='outline' onClick={resetFilters}>Xóa bộ lọc</CButton><CButton color='secondary' variant='outline' onClick={() => { loadSummary(); loadList(filters) }}>Làm mới</CButton></div></CCol>
          </CRow>

          {listLoading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải lịch thi...</div> : null}

          {viewMode === 'list' ? (
            <>
              <div className='d-none d-md-block'>
                <CTable responsive hover align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Mã ca</CTableHeaderCell>
                      <CTableHeaderCell>Môn</CTableHeaderCell>
                      <CTableHeaderCell>Kỹ năng</CTableHeaderCell>
                      <CTableHeaderCell>Ngày thi</CTableHeaderCell>
                      <CTableHeaderCell>Thời gian</CTableHeaderCell>
                      <CTableHeaderCell>Địa điểm</CTableHeaderCell>
                      <CTableHeaderCell>Phòng</CTableHeaderCell>
                      <CTableHeaderCell>Sức chứa</CTableHeaderCell>
                      <CTableHeaderCell>Đã phân</CTableHeaderCell>
                      <CTableHeaderCell>Còn chỗ</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 && !listLoading ? <CTableRow><CTableDataCell colSpan={12} className='text-center text-body-secondary py-4'>Chưa có ca thi nào trong đợt hiện tại.</CTableDataCell></CTableRow> : null}
                    {rows.map((item) => {
                      const statusMeta = getScheduleStatusMeta(item.status)
                      return (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{item.externalExamCode || '-'}</CTableDataCell>
                          <CTableDataCell>{item.subject?.nameSnapshot || '-'}</CTableDataCell>
                          <CTableDataCell>{item.component?.nameSnapshot || '-'}</CTableDataCell>
                          <CTableDataCell>{item.startAt ? formatDateTime(item.startAt).slice(0, 10) : '-'}</CTableDataCell>
                          <CTableDataCell>{`${formatDateTime(item.startAt)} - ${formatDateTime(item.endAt)}`}</CTableDataCell>
                          <CTableDataCell>{item.examVenue?.name || '-'}</CTableDataCell>
                          <CTableDataCell>{item.examRoom?.name || '-'}</CTableDataCell>
                          <CTableDataCell>{formatMoney(item.capacity || 0)}</CTableDataCell>
                          <CTableDataCell>{formatMoney(item.assignedCount || 0)}</CTableDataCell>
                          <CTableDataCell>{formatMoney(item.availableCapacity || 0)}</CTableDataCell>
                          <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                          <CTableDataCell><div className='d-flex gap-2 flex-wrap'><CButton color='secondary' size='sm' variant='outline' onClick={() => openDetail(item.id)}>Xem</CButton>{canManage ? <CButton color='secondary' size='sm' variant='outline' onClick={() => openEdit(item)}>Sửa</CButton> : null}{canManage ? <CButton color='secondary' size='sm' variant='outline' onClick={() => openClone(item)}>Nhân bản</CButton> : null}{canManage && normalizeStatus(item.status) !== 'cancelled' ? <CButton color='danger' size='sm' variant='outline' onClick={() => openCancel(item)}>Hủy</CButton> : null}</div></CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              </div>
              <div className='d-flex d-md-none flex-column gap-3'>
                {rows.length === 0 && !listLoading ? <div className='text-center text-body-secondary py-4'>Chưa có ca thi nào trong đợt hiện tại.</div> : null}
                {rows.map((item) => {
                  const statusMeta = getScheduleStatusMeta(item.status)
                  return (
                    <CCard key={item.id}><CCardBody className='d-flex flex-column gap-2'>
                      <div className='d-flex justify-content-between gap-2'>
                        <div><div className='fw-semibold'>{item.component?.nameSnapshot || '-'}</div><div className='small text-body-secondary'>{item.externalExamCode || item.subject?.nameSnapshot || '-'}</div></div>
                        <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                      </div>
                      <div className='small'>{`${formatDateTime(item.startAt)} - ${formatDateTime(item.endAt)}`}</div>
                      <div className='small text-body-secondary'>{item.examVenue?.name || '-'} · {item.examRoom?.name || '-'} · {formatMoney(item.capacity || 0)} chỗ</div>
                      <div className='small text-body-secondary'>Đã phân {formatMoney(item.assignedCount || 0)} · Còn {formatMoney(item.availableCapacity || 0)}</div>
                      <div className='d-flex gap-2 flex-wrap mt-1'><CButton color='secondary' size='sm' variant='outline' onClick={() => openDetail(item.id)}>Xem</CButton>{canManage ? <CButton color='secondary' size='sm' variant='outline' onClick={() => openEdit(item)}>Sửa</CButton> : null}{canManage ? <CButton color='secondary' size='sm' variant='outline' onClick={() => openClone(item)}>Nhân bản</CButton> : null}{canManage && normalizeStatus(item.status) !== 'cancelled' ? <CButton color='danger' size='sm' variant='outline' onClick={() => openCancel(item)}>Hủy</CButton> : null}</div>
                    </CCardBody></CCard>
                  )
                })}
              </div>
            </>
          ) : (
            <div className='d-flex flex-column gap-3'>
              {groupedRows.length === 0 && !listLoading ? <div className='text-center text-body-secondary py-4'>Chưa có ca thi nào trong đợt hiện tại.</div> : null}
              {groupedRows.map((group) => (
                <CCard key={group.dateKey}>
                  <CCardHeader><strong>{group.dateKey === 'unknown' ? 'Chưa xác định ngày' : group.dateKey}</strong></CCardHeader>
                  <CCardBody className='d-flex flex-column gap-3'>
                    {group.items.map((item) => {
                      const statusMeta = getScheduleStatusMeta(item.status)
                      return (
                        <div key={item.id} className='border rounded p-3'>
                          <div className='d-flex justify-content-between gap-2 flex-wrap'>
                            <div><div className='fw-semibold'>{item.component?.nameSnapshot || '-'}</div><div className='small text-body-secondary'>{item.subject?.nameSnapshot || '-'} · {item.externalExamCode || '-'}</div></div>
                            <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                          </div>
                          <div className='small mt-2'>{`${formatDateTime(item.startAt)} - ${formatDateTime(item.endAt)}`}</div>
                          <div className='small text-body-secondary'>{item.examVenue?.name || '-'} · {item.examRoom?.name || '-'} · {formatMoney(item.capacity || 0)} chỗ</div>
                          <div className='d-flex gap-2 flex-wrap mt-2'><CButton color='secondary' size='sm' variant='outline' onClick={() => openDetail(item.id)}>Xem</CButton>{canManage ? <CButton color='secondary' size='sm' variant='outline' onClick={() => openEdit(item)}>Sửa</CButton> : null}{canManage ? <CButton color='secondary' size='sm' variant='outline' onClick={() => openClone(item)}>Nhân bản</CButton> : null}</div>
                        </div>
                      )
                    })}
                  </CCardBody>
                </CCard>
              ))}
            </div>
          )}

          <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mt-3'>
            <div className='small text-body-secondary'>Trang {pagination.page || 1}/{pagination.pageCount || 1} · Tổng {pagination.total || 0} ca</div>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' disabled={(pagination.page || 1) <= 1 || listLoading} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))}>Trang trước</CButton>
              <CButton color='secondary' variant='outline' disabled={(pagination.page || 1) >= (pagination.pageCount || 1) || listLoading} onClick={() => setFilters((current) => ({ ...current, page: Math.min(pagination.pageCount || 1, (current.page || 1) + 1) }))}>Trang sau</CButton>
            </div>
          </div>
        </CCardBody>
      </CCard>

      <CModal visible={showDetail} onClose={() => setShowDetail(false)} size='lg' scrollable>
        <CModalHeader><CModalTitle>Chi tiết ca thi</CModalTitle></CModalHeader>
        <CModalBody>
          {detailError ? <CAlert color='danger'>{detailError}</CAlert> : null}
          {detailLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết...</div> : null}
          {!detailLoading && detail ? (
            <CRow className='g-3'>
              <CCol md={6}><div className='small text-body-secondary'>Mã ca</div><div className='fw-semibold'>{detail.externalExamCode || '-'}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Trạng thái</div><div><CBadge color={getScheduleStatusMeta(detail.status).color}>{getScheduleStatusMeta(detail.status).label}</CBadge></div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Môn</div><div>{detail.subject?.nameSnapshot || '-'}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Kỹ năng</div><div>{detail.component?.nameSnapshot || '-'}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Bắt đầu</div><div>{formatDateTime(detail.startAt)}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Kết thúc</div><div>{formatDateTime(detail.endAt)}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Địa điểm</div><div>{detail.examVenue?.name || '-'}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Phòng</div><div>{detail.examRoom?.name || '-'}</div></CCol>
              <CCol md={4}><div className='small text-body-secondary'>Sức chứa phòng</div><div>{formatMoney(detail.examRoom?.capacity || 0)}</div></CCol>
              <CCol md={4}><div className='small text-body-secondary'>Sức chứa ca</div><div>{formatMoney(detail.capacity || 0)}</div></CCol>
              <CCol md={4}><div className='small text-body-secondary'>Còn chỗ</div><div>{formatMoney(detail.availableCapacity || 0)}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Đã phân</div><div>{formatMoney(detail.assignedCount || 0)}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Note</div><div style={{ whiteSpace: 'pre-wrap' }}>{detail.note || '-'}</div></CCol>
              {Array.isArray(detail.warnings) && detail.warnings.length > 0 ? <CCol xs={12}><CAlert color='warning' className='mb-0'>{detail.warnings.map((item) => item.message).join(' · ')}</CAlert></CCol> : null}
            </CRow>
          ) : null}
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowDetail(false)}>Đóng</CButton></CModalFooter>
      </CModal>

      <CModal visible={showForm} onClose={() => setShowForm(false)} size='lg' scrollable>
        <CModalHeader><CModalTitle>{formMode === 'create' ? 'Tạo ca thi' : formMode === 'edit' ? 'Chỉnh sửa ca thi' : 'Nhân bản ca thi'}</CModalTitle></CModalHeader>
        <CModalBody>
          {formError ? <CAlert color='danger'>{formError}</CAlert> : null}
          <CRow className='g-3'>
            <CCol md={6}><CFormLabel>Môn</CFormLabel><CFormSelect value={formValues.subjectId} onChange={(event) => setFormValues((current) => ({ ...current, subjectId: event.target.value, examRoundComponentId: '' }))}><option value=''>Chọn môn</option>{subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.nameSnapshot}</option>)}</CFormSelect></CCol>
            <CCol md={6}><CFormLabel>Kỹ năng</CFormLabel><CFormSelect value={formValues.examRoundComponentId} onChange={(event) => setFormValues((current) => ({ ...current, examRoundComponentId: event.target.value }))}><option value=''>Chọn kỹ năng</option>{formComponentOptions.map((component) => <option key={component.id} value={component.id}>{component.nameSnapshot}</option>)}</CFormSelect></CCol>
            <CCol md={6}><CFormLabel>Phòng thi</CFormLabel><CFormSelect value={formValues.examRoomId} onChange={(event) => setFormValues((current) => ({ ...current, examRoomId: event.target.value, capacity: current.capacity || String(roomOptions.find((room) => String(room.id) === String(event.target.value))?.capacity || '') }))}><option value=''>Chọn phòng</option>{formRoomOptions.map((room) => <option key={room.id} value={room.id}>{`${room.examVenue?.name || '-'} - ${room.name || '-'} (${room.capacity || 0})`}</option>)}</CFormSelect></CCol>
            <CCol md={6}><CFormLabel>Mã ca</CFormLabel><CFormInput value={formValues.code} onChange={(event) => setFormValues((current) => ({ ...current, code: event.target.value }))} placeholder='Tùy chọn' /></CCol>
            <CCol md={6}><CFormLabel>Bắt đầu</CFormLabel><CFormInput type='datetime-local' value={formValues.startAt} onChange={(event) => setFormValues((current) => ({ ...current, startAt: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Kết thúc</CFormLabel><CFormInput type='datetime-local' value={formValues.endAt} onChange={(event) => setFormValues((current) => ({ ...current, endAt: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Sức chứa ca</CFormLabel><CFormInput type='number' min={1} value={formValues.capacity} onChange={(event) => setFormValues((current) => ({ ...current, capacity: event.target.value }))} placeholder='Mặc định theo phòng' /></CCol>
            <CCol xs={12}><CFormLabel>Ghi chú</CFormLabel><CFormTextarea rows={3} value={formValues.note} onChange={(event) => setFormValues((current) => ({ ...current, note: event.target.value }))} /></CCol>
          </CRow>
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowForm(false)} disabled={formSubmitting}>Đóng</CButton><CButton color='primary' onClick={submitForm} disabled={formSubmitting}>{formSubmitting ? 'Đang lưu...' : formMode === 'create' ? 'Tạo ca thi' : formMode === 'edit' ? 'Lưu thay đổi' : 'Nhân bản ca thi'}</CButton></CModalFooter>
      </CModal>

      <CModal visible={showCancelDialog} onClose={() => setShowCancelDialog(false)}>
        <CModalHeader><CModalTitle>Hủy ca thi</CModalTitle></CModalHeader>
        <CModalBody>
          {cancelError ? <CAlert color='danger'>{cancelError}</CAlert> : null}
          <div className='mb-3'><div className='small text-body-secondary'>Ca thi</div><div className='fw-semibold'>{cancelTarget?.externalExamCode || cancelTarget?.component?.nameSnapshot || '-'}</div><div className='small text-body-secondary'>{cancelTarget?.examRoom?.name || '-'} · {formatDateTime(cancelTarget?.startAt)}</div></div>
          <CFormLabel>Lý do hủy</CFormLabel>
          <CFormTextarea rows={4} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowCancelDialog(false)} disabled={cancelSubmitting}>Đóng</CButton><CButton color='danger' onClick={submitCancel} disabled={cancelSubmitting}>{cancelSubmitting ? 'Đang hủy...' : 'Hủy ca thi'}</CButton></CModalFooter>
      </CModal>

      <CModal visible={showGenerateModal} onClose={() => setShowGenerateModal(false)} size='xl' scrollable>
        <CModalHeader><CModalTitle>Sinh tự động ca thi</CModalTitle></CModalHeader>
        <CModalBody>
          {generateError ? <CAlert color='danger'>{generateError}</CAlert> : null}
          <CRow className='g-3 mb-4'>
            <CCol md={4}><CFormLabel>Ngày thi</CFormLabel><CFormInput type='date' value={generateValues.date} onChange={(event) => setGenerateValues((current) => ({ ...current, date: event.target.value }))} /></CCol>
            <CCol md={4}><CFormLabel>Giờ bắt đầu</CFormLabel><CFormInput type='time' value={generateValues.startTime} onChange={(event) => setGenerateValues((current) => ({ ...current, startTime: event.target.value }))} /></CCol>
            <CCol md={4}><CFormLabel>Phòng mặc định</CFormLabel><CFormSelect value={generateValues.roomId} onChange={(event) => setGenerateValues((current) => ({ ...current, roomId: event.target.value }))}><option value=''>Chưa chọn phòng</option>{roomOptions.filter((item) => item.isActive === true && item.examVenue?.isActive === true).map((room) => <option key={room.id} value={room.id}>{`${room.examVenue?.name || '-'} - ${room.name || '-'} (${room.capacity || 0})`}</option>)}</CFormSelect></CCol>
            <CCol xs={12}><CAlert color='info' className='mb-0'>Thời gian kết thúc của từng ca được tính theo thời lượng đã cấu hình của kỹ năng. Nếu kỹ năng chưa có thời lượng, hệ thống sử dụng mặc định 60 phút.</CAlert></CCol>
          </CRow>

          <div className='mb-3'><div className='fw-semibold mb-2'>Phạm vi kỹ năng</div><div className='d-flex flex-column gap-2'>{generateComponentCandidates.map((component) => <div key={component.id} className='border rounded p-3'><div className='d-flex justify-content-between gap-3 flex-wrap'><CFormCheck checked={generateValues.componentIds.includes(Number(component.id || 0))} onChange={(event) => setGenerateValues((current) => ({ ...current, componentIds: event.target.checked ? [...current.componentIds, Number(component.id || 0)] : current.componentIds.filter((item) => Number(item) !== Number(component.id || 0)) }))} label={<span><strong>{component.nameSnapshot}</strong> <span className='text-body-secondary'>{component.subjectName || ''}</span></span>} /><div className='d-flex gap-2 flex-wrap'>{component.willCreate ? <CBadge color='success'>Sẽ tạo</CBadge> : <CBadge color='secondary'>Bỏ qua</CBadge>}{component.usesFallbackDuration ? <CBadge color='warning'>Dùng mặc định 60 phút</CBadge> : null}</div></div><div className='small text-body-secondary mt-2'>{component.scheduleCount > 0 ? `Đã có ${component.scheduleCount} ca thi` : `Chưa có ca thi`} · thời lượng {component.effectiveDuration} phút</div></div>)}</div></div>

          <div>
            <div className='fw-semibold mb-2'>Preview</div>
            <CTable responsive align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Môn</CTableHeaderCell>
                  <CTableHeaderCell>Kỹ năng</CTableHeaderCell>
                  <CTableHeaderCell>Bắt đầu</CTableHeaderCell>
                  <CTableHeaderCell>Thời lượng</CTableHeaderCell>
                  <CTableHeaderCell>Kết thúc</CTableHeaderCell>
                  <CTableHeaderCell>Phòng</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {generatePreview.length === 0 ? <CTableRow><CTableDataCell colSpan={7} className='text-center text-body-secondary py-3'>Chưa có kỹ năng nào được chọn để sinh ca.</CTableDataCell></CTableRow> : null}
                {generatePreview.map((item) => <CTableRow key={item.component.id}><CTableDataCell>{item.component.subjectName || '-'}</CTableDataCell><CTableDataCell>{item.component.nameSnapshot || '-'}</CTableDataCell><CTableDataCell>{item.startAt ? formatDateTime(item.startAt) : '-'}</CTableDataCell><CTableDataCell><div>{item.component.effectiveDuration} phút</div>{item.component.usesFallbackDuration ? <CBadge color='warning'>Dùng mặc định 60 phút</CBadge> : null}</CTableDataCell><CTableDataCell>{item.endAt ? formatDateTime(item.endAt) : '-'}</CTableDataCell><CTableDataCell>{item.room?.name || 'Chưa chọn phòng'}</CTableDataCell><CTableDataCell>{item.status}</CTableDataCell></CTableRow>)}
              </CTableBody>
            </CTable>
          </div>
        </CModalBody>
        <CModalFooter><CButton color='secondary' variant='outline' onClick={() => setShowGenerateModal(false)} disabled={generateSubmitting}>Đóng</CButton><CButton color='primary' onClick={submitGenerate} disabled={generateSubmitting}>{generateSubmitting ? 'Đang sinh...' : 'Sinh tự động ca thi'}</CButton></CModalFooter>
      </CModal>
    </div>
  )
}
