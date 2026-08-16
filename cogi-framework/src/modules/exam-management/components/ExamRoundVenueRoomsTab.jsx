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
  createExamRoomForRound,
  createExamVenueForRound,
  getExamRoundVenueRoomConfiguration,
  updateExamRoundVenuesRooms,
} from '../services/examRoundApi'
import { formatMoney, getApiMessage, normalizeStatus, toText } from '../utils/examRoundUi'

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

function getVenueRoomApiMessage(error, fallback) {
  const code = String(error?.response?.data?.code || error?.response?.data?.error?.code || '').trim()
  const mapped = {
    EXAM_ROUND_NOT_FOUND: 'Không tìm thấy đợt thi trong tenant hiện tại.',
    EXAM_VENUE_NOT_FOUND: 'Không tìm thấy địa điểm thi phù hợp.',
    EXAM_ROOM_NOT_FOUND: 'Không tìm thấy phòng thi phù hợp.',
    EXAM_VENUE_INACTIVE: 'Địa điểm thi đang ngừng sử dụng nên không thể dùng cho cấu hình mới.',
    EXAM_ROOM_INACTIVE: 'Phòng thi đang ngừng sử dụng nên không thể dùng cho cấu hình mới.',
    EXAM_ROOM_INVALID_CAPACITY: 'Sức chứa phòng thi không hợp lệ.',
    EXAM_ROOM_NOT_IN_SELECTED_VENUE: 'Phòng thi phải thuộc một địa điểm đã chọn trong đợt thi.',
    EXAM_ROOM_IN_USE_BY_EXAM_SCHEDULE: 'Phòng thi đang được lịch thi sử dụng nên chưa thể bỏ khỏi đợt.',
    EXAM_VENUE_IN_USE_BY_EXAM_SCHEDULE: 'Địa điểm này đang được lịch thi sử dụng nên chưa thể bỏ khỏi đợt.',
    DUPLICATE_EXAM_VENUE: 'Danh sách địa điểm đang có phần tử trùng lặp.',
    DUPLICATE_EXAM_ROOM: 'Danh sách phòng thi đang có phần tử trùng lặp.',
    NO_ACTIVE_ROOMS: 'Đợt thi chưa có phòng active để chuẩn bị tạo lịch.',
    NO_SELECTED_VENUES: 'Đợt thi chưa có địa điểm thi nào được chọn.',
    ROOM_CAPACITY_INVALID: 'Có phòng thi có sức chứa không hợp lệ.',
    CROSS_TENANT_ACCESS: 'Bạn không có quyền truy cập dữ liệu tenant khác.',
    UNKNOWN_FIELDS: 'Biểu mẫu gửi lên có trường không hợp lệ.',
  }[code]
  return mapped || getApiMessage(error, fallback)
}

function buildVenueForm() {
  return {
    code: '',
    name: '',
    shortName: '',
    address: '',
    description: '',
    contactName: '',
    contactPhone: '',
    sortOrder: 0,
    isActive: true,
  }
}

function buildRoomForm(defaultVenueId = '') {
  return {
    examVenueId: defaultVenueId,
    code: '',
    name: '',
    floor: '',
    capacity: 30,
    roomType: 'standard',
    description: '',
    sortOrder: 0,
    isActive: true,
  }
}

function getRoomTypeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return {
    computer: 'Phòng máy',
    standard: 'Phòng tiêu chuẩn',
    oral: 'Phòng vấn đáp',
    practical: 'Phòng thực hành',
    other: 'Khác',
  }[normalized] || (normalized || '-')
}

export default function ExamRoundVenueRoomsTab({ round, permissions, onRefresh }) {
  const canManage = permissions?.canManage === true
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [config, setConfig] = useState(null)
  const [showVenuePicker, setShowVenuePicker] = useState(false)
  const [showRoomPicker, setShowRoomPicker] = useState(false)
  const [showVenueCreate, setShowVenueCreate] = useState(false)
  const [showRoomCreate, setShowRoomCreate] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [roomVenueFilter, setRoomVenueFilter] = useState('')
  const [draftVenueIds, setDraftVenueIds] = useState([])
  const [draftRoomIds, setDraftRoomIds] = useState([])
  const [venueForm, setVenueForm] = useState(buildVenueForm)
  const [roomForm, setRoomForm] = useState(buildRoomForm)
  const [modalError, setModalError] = useState('')
  const [modalSubmitting, setModalSubmitting] = useState(false)

  useEffect(() => {
    if (!round?.id) return
    loadConfiguration()
  }, [round?.id])

  const selectedVenueIds = useMemo(() => Array.isArray(config?.selectedVenues) ? config.selectedVenues.map((item) => Number(item.id || 0)).filter(Boolean) : [], [config?.selectedVenues])
  const selectedRoomIds = useMemo(() => Array.isArray(config?.selectedRooms) ? config.selectedRooms.map((item) => Number(item.id || 0)).filter(Boolean) : [], [config?.selectedRooms])
  const readiness = config?.readiness || null
  const summary = readiness?.summary || null

  const filteredAvailableVenues = useMemo(() => {
    const keyword = String(pickerSearch || '').trim().toLowerCase()
    const rows = Array.isArray(config?.availableVenues) ? config.availableVenues : []
    if (!keyword) return rows
    return rows.filter((item) => [item.code, item.name, item.shortName, item.address].some((value) => String(value || '').toLowerCase().includes(keyword)))
  }, [config?.availableVenues, pickerSearch])

  const filteredAvailableRooms = useMemo(() => {
    const keyword = String(pickerSearch || '').trim().toLowerCase()
    const venueId = Number(roomVenueFilter || 0) || 0
    const rows = Array.isArray(config?.availableRooms) ? config.availableRooms : []
    return rows.filter((item) => {
      if (venueId > 0 && Number(item?.examVenue?.id || 0) !== venueId) return false
      if (!keyword) return true
      return [item.code, item.name, item.floor, item.examVenue?.code, item.examVenue?.name].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [config?.availableRooms, pickerSearch, roomVenueFilter])

  async function loadConfiguration() {
    if (!round?.id) return
    setLoading(true)
    setError('')
    try {
      const data = await getExamRoundVenueRoomConfiguration(round.id)
      setConfig(data || null)
    } catch (requestError) {
      setConfig(null)
      setError(getVenueRoomApiMessage(requestError, 'Không tải được cấu hình địa điểm và phòng thi.'))
    } finally {
      setLoading(false)
    }
  }

  async function saveConfiguration(venueIds, roomIds) {
    if (!round?.id) return
    setSaving(true)
    setError('')
    try {
      const data = await updateExamRoundVenuesRooms(round.id, { venueIds, roomIds })
      setConfig(data || null)
      await onRefresh?.()
    } catch (requestError) {
      setError(getVenueRoomApiMessage(requestError, 'Không cập nhật được cấu hình địa điểm và phòng thi.'))
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  function openVenuePicker() {
    setPickerSearch('')
    setModalError('')
    setDraftVenueIds(selectedVenueIds)
    setShowVenuePicker(true)
  }

  function openRoomPicker() {
    setPickerSearch('')
    setRoomVenueFilter('')
    setModalError('')
    setDraftRoomIds(selectedRoomIds)
    setShowRoomPicker(true)
  }

  async function submitVenuePicker() {
    const nextVenueIds = Array.from(new Set(draftVenueIds.map((item) => Number(item || 0)).filter(Boolean)))
    const nextRoomIds = selectedRoomIds.filter((roomId) => {
      const room = (config?.availableRooms || []).find((item) => Number(item?.id || 0) === Number(roomId || 0))
      return nextVenueIds.includes(Number(room?.examVenue?.id || 0))
    })
    try {
      await saveConfiguration(nextVenueIds, nextRoomIds)
      setShowVenuePicker(false)
    } catch {}
  }

  async function submitRoomPicker() {
    const nextRoomIds = Array.from(new Set(draftRoomIds.map((item) => Number(item || 0)).filter(Boolean)))
    try {
      await saveConfiguration(selectedVenueIds, nextRoomIds)
      setShowRoomPicker(false)
    } catch {}
  }

  async function removeVenue(venueId) {
    const nextVenueIds = selectedVenueIds.filter((item) => Number(item) !== Number(venueId))
    const nextRoomIds = selectedRoomIds.filter((roomId) => {
      const room = (config?.selectedRooms || []).find((item) => Number(item?.id || 0) === Number(roomId || 0))
      return Number(room?.examVenue?.id || 0) !== Number(venueId)
    })
    await saveConfiguration(nextVenueIds, nextRoomIds)
  }

  async function removeRoom(roomId) {
    const nextRoomIds = selectedRoomIds.filter((item) => Number(item) !== Number(roomId))
    await saveConfiguration(selectedVenueIds, nextRoomIds)
  }

  async function submitVenueCreate() {
    if (!round?.id || modalSubmitting) return
    setModalSubmitting(true)
    setModalError('')
    try {
      const created = await createExamVenueForRound(round.id, {
        ...venueForm,
        sortOrder: Number(venueForm.sortOrder || 0) || 0,
      })
      const nextVenueIds = Array.from(new Set([...selectedVenueIds, Number(created?.id || 0)].filter(Boolean)))
      await saveConfiguration(nextVenueIds, selectedRoomIds)
      setVenueForm(buildVenueForm())
      setShowVenueCreate(false)
    } catch (requestError) {
      setModalError(getVenueRoomApiMessage(requestError, 'Không tạo được địa điểm thi.'))
    } finally {
      setModalSubmitting(false)
    }
  }

  async function submitRoomCreate() {
    if (!round?.id || modalSubmitting) return
    setModalSubmitting(true)
    setModalError('')
    try {
      const created = await createExamRoomForRound(round.id, {
        ...roomForm,
        examVenueId: Number(roomForm.examVenueId || 0) || null,
        capacity: Number(roomForm.capacity || 0) || 0,
        sortOrder: Number(roomForm.sortOrder || 0) || 0,
      })
      const venueId = Number(created?.examVenue?.id || roomForm.examVenueId || 0) || 0
      const nextVenueIds = Array.from(new Set([...selectedVenueIds, venueId].filter(Boolean)))
      const nextRoomIds = Array.from(new Set([...selectedRoomIds, Number(created?.id || 0)].filter(Boolean)))
      await saveConfiguration(nextVenueIds, nextRoomIds)
      setRoomForm(buildRoomForm(venueId ? String(venueId) : ''))
      setShowRoomCreate(false)
    } catch (requestError) {
      setModalError(getVenueRoomApiMessage(requestError, 'Không tạo được phòng thi.'))
    } finally {
      setModalSubmitting(false)
    }
  }

  const emptyState = !loading && (summary?.venueCount || 0) === 0 && (summary?.roomCount || 0) === 0

  return (
    <div className='d-flex flex-column gap-4'>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {Array.isArray(readiness?.warnings) && readiness.warnings.length > 0 ? (
        <div className='d-flex flex-column gap-2'>
          {readiness.warnings.map((warning) => <CAlert key={warning.code || warning.message} color='warning' className='mb-0'>{warning.message}</CAlert>)}
        </div>
      ) : null}

      <CRow className='g-3'>
        <CCol xl={3} md={6}><SummaryCard label='Địa điểm đã chọn' value={loading ? '...' : (summary?.venueCount ?? 0)} color='info' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Phòng đã chọn' value={loading ? '...' : (summary?.roomCount ?? 0)} color='info' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Tổng sức chứa' value={loading ? '...' : formatMoney(summary?.totalCapacity ?? 0)} color='success' helper='Sức chứa vật lý' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Sẵn sàng tạo lịch' value={loading ? '...' : (readiness?.readyForScheduling ? 'Có' : 'Chưa')} color={readiness?.readyForScheduling ? 'success' : 'warning'} /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Địa điểm inactive' value={loading ? '...' : (summary?.inactiveVenueCount ?? 0)} color='warning' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Phòng inactive' value={loading ? '...' : (summary?.inactiveRoomCount ?? 0)} color='warning' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Phòng sức chứa 0' value={loading ? '...' : (summary?.zeroCapacityRoomCount ?? 0)} color='danger' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Phòng active' value={loading ? '...' : (summary?.activeRoomCount ?? 0)} color='success' /></CCol>
      </CRow>

      {Array.isArray(readiness?.blockingReasons) && readiness.blockingReasons.length > 0 ? (
        <CAlert color='warning'>Chưa sẵn sàng cho bước tạo lịch: {readiness.blockingReasons.join(', ')}</CAlert>
      ) : null}

      {emptyState ? (
        <CCard>
          <CCardBody className='py-5 text-center'>
            <div className='fs-5 fw-semibold mb-2'>Đợt thi chưa được cấu hình địa điểm và phòng thi.</div>
            <div className='text-body-secondary mb-3'>Thông tin này sẽ được sử dụng khi xây dựng lịch thi ở bước tiếp theo.</div>
            <div className='d-flex justify-content-center gap-2 flex-wrap'>
              {canManage ? <CButton color='primary' onClick={openVenuePicker}>Chọn địa điểm & phòng</CButton> : null}
              {canManage ? <CButton color='secondary' variant='outline' onClick={() => { setModalError(''); setVenueForm(buildVenueForm()); setShowVenueCreate(true) }}>Tạo nhanh địa điểm</CButton> : null}
            </div>
          </CCardBody>
        </CCard>
      ) : null}

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <strong>Địa điểm sử dụng</strong>
          {canManage ? (
            <div className='d-flex gap-2 flex-wrap'>
              <CButton color='primary' size='sm' onClick={openVenuePicker} disabled={saving}>Chọn địa điểm</CButton>
              <CButton color='secondary' size='sm' variant='outline' onClick={() => { setModalError(''); setVenueForm(buildVenueForm()); setShowVenueCreate(true) }} disabled={saving}>Tạo nhanh địa điểm</CButton>
            </div>
          ) : null}
        </CCardHeader>
        <CCardBody>
          <div className='d-none d-md-block'>
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Mã</CTableHeaderCell>
                  <CTableHeaderCell>Tên</CTableHeaderCell>
                  <CTableHeaderCell>Địa chỉ</CTableHeaderCell>
                  <CTableHeaderCell>Phòng sử dụng</CTableHeaderCell>
                  <CTableHeaderCell>Sức chứa</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {(config?.selectedVenues || []).length === 0 ? <CTableRow><CTableDataCell colSpan={7} className='text-center text-body-secondary py-4'>Chưa có địa điểm nào được chọn cho đợt thi.</CTableDataCell></CTableRow> : null}
                {(config?.selectedVenues || []).map((venue) => (
                  <CTableRow key={venue.id}>
                    <CTableDataCell>{venue.code || '-'}</CTableDataCell>
                    <CTableDataCell>
                      <div className='fw-semibold'>{venue.name || '-'}</div>
                      <div className='small text-body-secondary'>{venue.shortName || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell>{venue.address || '-'}</CTableDataCell>
                    <CTableDataCell>{venue.selectedRoomCount || 0}/{venue.activeRoomCount || 0}</CTableDataCell>
                    <CTableDataCell>{formatMoney(venue.selectedCapacity || 0)}</CTableDataCell>
                    <CTableDataCell><CBadge color={venue.isActive ? 'success' : 'warning'}>{venue.isActive ? 'Active' : 'Inactive'}</CBadge></CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex gap-2 flex-wrap'>
                        {canManage ? <CButton color='secondary' size='sm' variant='outline' onClick={openRoomPicker}>Xem phòng</CButton> : null}
                        {canManage ? <CButton color='danger' size='sm' variant='outline' onClick={() => removeVenue(venue.id)} disabled={saving}>Bỏ khỏi đợt</CButton> : null}
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
          <div className='d-flex d-md-none flex-column gap-3'>
            {(config?.selectedVenues || []).length === 0 ? <div className='text-center text-body-secondary py-4'>Chưa có địa điểm nào được chọn cho đợt thi.</div> : null}
            {(config?.selectedVenues || []).map((venue) => (
              <CCard key={venue.id}><CCardBody className='d-flex flex-column gap-2'>
                <div className='d-flex justify-content-between gap-2'>
                  <div><div className='fw-semibold'>{venue.name || '-'}</div><div className='small text-body-secondary'>{venue.code || '-'}</div></div>
                  <CBadge color={venue.isActive ? 'success' : 'warning'}>{venue.isActive ? 'Active' : 'Inactive'}</CBadge>
                </div>
                <div className='small'>{venue.address || '-'}</div>
                <div className='small text-body-secondary'>{venue.selectedRoomCount || 0} phòng dùng · sức chứa {formatMoney(venue.selectedCapacity || 0)}</div>
                {canManage ? <div className='d-flex gap-2 flex-wrap mt-1'><CButton color='secondary' size='sm' variant='outline' onClick={openRoomPicker}>Xem phòng</CButton><CButton color='danger' size='sm' variant='outline' onClick={() => removeVenue(venue.id)} disabled={saving}>Bỏ khỏi đợt</CButton></div> : null}
              </CCardBody></CCard>
            ))}
          </div>
        </CCardBody>
      </CCard>

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <strong>Phòng thi sử dụng</strong>
          {canManage ? (
            <div className='d-flex gap-2 flex-wrap'>
              <CButton color='primary' size='sm' onClick={openRoomPicker} disabled={saving || selectedVenueIds.length === 0}>Chọn phòng</CButton>
              <CButton color='secondary' size='sm' variant='outline' onClick={() => { setModalError(''); setRoomForm(buildRoomForm(selectedVenueIds[0] ? String(selectedVenueIds[0]) : '')); setShowRoomCreate(true) }} disabled={saving}>Tạo nhanh phòng</CButton>
            </div>
          ) : null}
        </CCardHeader>
        <CCardBody>
          <div className='mb-3' style={{ maxWidth: 320 }}>
            <CFormLabel>Lọc theo địa điểm</CFormLabel>
            <CFormSelect value={roomVenueFilter} onChange={(event) => setRoomVenueFilter(event.target.value)}>
              <option value=''>Tất cả địa điểm đã chọn</option>
              {(config?.selectedVenues || []).map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
            </CFormSelect>
          </div>
          <div className='d-none d-md-block'>
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Địa điểm</CTableHeaderCell>
                  <CTableHeaderCell>Mã phòng</CTableHeaderCell>
                  <CTableHeaderCell>Tên phòng</CTableHeaderCell>
                  <CTableHeaderCell>Tầng</CTableHeaderCell>
                  <CTableHeaderCell>Sức chứa</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {(config?.selectedRooms || []).filter((room) => !roomVenueFilter || Number(room?.examVenue?.id || 0) === Number(roomVenueFilter || 0)).length === 0 ? <CTableRow><CTableDataCell colSpan={7} className='text-center text-body-secondary py-4'>Chưa có phòng thi nào được chọn cho đợt thi.</CTableDataCell></CTableRow> : null}
                {(config?.selectedRooms || []).filter((room) => !roomVenueFilter || Number(room?.examVenue?.id || 0) === Number(roomVenueFilter || 0)).map((room) => (
                  <CTableRow key={room.id}>
                    <CTableDataCell>{room.examVenue?.name || '-'}</CTableDataCell>
                    <CTableDataCell>{room.code || '-'}</CTableDataCell>
                    <CTableDataCell>{room.name || '-'}</CTableDataCell>
                    <CTableDataCell>{room.floor || '-'}</CTableDataCell>
                    <CTableDataCell>{formatMoney(room.capacity || 0)}</CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CBadge color={room.isActive ? 'success' : 'warning'}>{room.isActive ? 'Active' : 'Inactive'}</CBadge>
                        {(room.scheduleCount || 0) > 0 ? <CBadge color='info'>Đang có lịch</CBadge> : null}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {canManage ? <CButton color='danger' size='sm' variant='outline' onClick={() => removeRoom(room.id)} disabled={saving}>Bỏ khỏi đợt</CButton> : null}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
          <div className='d-flex d-md-none flex-column gap-3'>
            {(config?.selectedRooms || []).filter((room) => !roomVenueFilter || Number(room?.examVenue?.id || 0) === Number(roomVenueFilter || 0)).length === 0 ? <div className='text-center text-body-secondary py-4'>Chưa có phòng thi nào được chọn cho đợt thi.</div> : null}
            {(config?.selectedRooms || []).filter((room) => !roomVenueFilter || Number(room?.examVenue?.id || 0) === Number(roomVenueFilter || 0)).map((room) => (
              <CCard key={room.id}><CCardBody className='d-flex flex-column gap-2'>
                <div className='d-flex justify-content-between gap-2'>
                  <div><div className='fw-semibold'>{room.name || '-'}</div><div className='small text-body-secondary'>{room.code || '-'} · {room.examVenue?.name || '-'}</div></div>
                  <CBadge color={room.isActive ? 'success' : 'warning'}>{room.isActive ? 'Active' : 'Inactive'}</CBadge>
                </div>
                <div className='small text-body-secondary'>Tầng {room.floor || '-'} · Sức chứa {formatMoney(room.capacity || 0)} · {getRoomTypeLabel(room.roomType)}</div>
                {(room.scheduleCount || 0) > 0 ? <div className='small text-body-secondary'>Đang có {room.scheduleCount} lịch sử dụng trong round này</div> : null}
                {canManage ? <div className='mt-1'><CButton color='danger' size='sm' variant='outline' onClick={() => removeRoom(room.id)} disabled={saving}>Bỏ khỏi đợt</CButton></div> : null}
              </CCardBody></CCard>
            ))}
          </div>
        </CCardBody>
      </CCard>

      <CModal visible={showVenuePicker} onClose={() => setShowVenuePicker(false)} size='lg' scrollable>
        <CModalHeader><CModalTitle>Chọn địa điểm cho đợt thi</CModalTitle></CModalHeader>
        <CModalBody>
          {modalError ? <CAlert color='danger'>{modalError}</CAlert> : null}
          <div className='mb-3'>
            <CFormLabel>Tìm kiếm</CFormLabel>
            <CFormInput value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} placeholder='Mã, tên, địa chỉ...' />
          </div>
          <div className='d-flex flex-column gap-2'>
            {filteredAvailableVenues.map((venue) => (
              <div key={venue.id} className='border rounded p-3'>
                <div className='d-flex justify-content-between gap-3'>
                  <CFormCheck
                    checked={draftVenueIds.includes(Number(venue.id || 0))}
                    onChange={(event) => setDraftVenueIds((current) => event.target.checked ? [...current, Number(venue.id || 0)] : current.filter((item) => Number(item) !== Number(venue.id || 0)))}
                    label={<span><strong>{venue.name || '-'}</strong> <span className='text-body-secondary'>{venue.code || '-'}</span></span>}
                  />
                  <CBadge color={venue.isActive ? 'success' : 'warning'}>{venue.isActive ? 'Active' : 'Inactive'}</CBadge>
                </div>
                <div className='small text-body-secondary mt-2'>{venue.address || '-'}</div>
                <div className='small text-body-secondary'>{venue.activeRoomCount || 0} phòng active · {venue.totalRoomCount || 0} phòng tổng</div>
              </div>
            ))}
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowVenuePicker(false)}>Đóng</CButton>
          <CButton color='primary' onClick={submitVenuePicker} disabled={saving}>{saving ? 'Đang lưu...' : 'Cập nhật địa điểm'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showRoomPicker} onClose={() => setShowRoomPicker(false)} size='xl' scrollable>
        <CModalHeader><CModalTitle>Chọn phòng cho đợt thi</CModalTitle></CModalHeader>
        <CModalBody>
          {modalError ? <CAlert color='danger'>{modalError}</CAlert> : null}
          <CRow className='g-3 mb-3'>
            <CCol md={6}>
              <CFormLabel>Tìm kiếm</CFormLabel>
              <CFormInput value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} placeholder='Mã phòng, tên phòng, địa điểm...' />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Lọc theo địa điểm</CFormLabel>
              <CFormSelect value={roomVenueFilter} onChange={(event) => setRoomVenueFilter(event.target.value)}>
                <option value=''>Tất cả địa điểm đã chọn</option>
                {(config?.selectedVenues || []).map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
              </CFormSelect>
            </CCol>
          </CRow>
          <div className='d-flex flex-column gap-2'>
            {filteredAvailableRooms.filter((room) => selectedVenueIds.includes(Number(room?.examVenue?.id || 0))).map((room) => (
              <div key={room.id} className='border rounded p-3'>
                <div className='d-flex justify-content-between gap-3'>
                  <CFormCheck
                    checked={draftRoomIds.includes(Number(room.id || 0))}
                    onChange={(event) => setDraftRoomIds((current) => event.target.checked ? [...current, Number(room.id || 0)] : current.filter((item) => Number(item) !== Number(room.id || 0)))}
                    label={<span><strong>{room.name || '-'}</strong> <span className='text-body-secondary'>{room.code || '-'}</span></span>}
                  />
                  <div className='d-flex gap-2 flex-wrap'>
                    <CBadge color={room.isActive ? 'success' : 'warning'}>{room.isActive ? 'Active' : 'Inactive'}</CBadge>
                    {(room.scheduleCount || 0) > 0 ? <CBadge color='info'>Đang có lịch</CBadge> : null}
                  </div>
                </div>
                <div className='small text-body-secondary mt-2'>{room.examVenue?.name || '-'} · Tầng {room.floor || '-'} · Sức chứa {formatMoney(room.capacity || 0)} · {getRoomTypeLabel(room.roomType)}</div>
              </div>
            ))}
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowRoomPicker(false)}>Đóng</CButton>
          <CButton color='primary' onClick={submitRoomPicker} disabled={saving}>{saving ? 'Đang lưu...' : 'Cập nhật phòng'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showVenueCreate} onClose={() => setShowVenueCreate(false)}>
        <CModalHeader><CModalTitle>Tạo nhanh địa điểm thi</CModalTitle></CModalHeader>
        <CModalBody>
          {modalError ? <CAlert color='danger'>{modalError}</CAlert> : null}
          <CRow className='g-3'>
            <CCol md={6}><CFormLabel>Mã địa điểm</CFormLabel><CFormInput value={venueForm.code} onChange={(event) => setVenueForm((current) => ({ ...current, code: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Tên địa điểm</CFormLabel><CFormInput value={venueForm.name} onChange={(event) => setVenueForm((current) => ({ ...current, name: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Tên ngắn</CFormLabel><CFormInput value={venueForm.shortName} onChange={(event) => setVenueForm((current) => ({ ...current, shortName: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Sort order</CFormLabel><CFormInput type='number' min={0} value={venueForm.sortOrder} onChange={(event) => setVenueForm((current) => ({ ...current, sortOrder: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Liên hệ</CFormLabel><CFormInput value={venueForm.contactName} onChange={(event) => setVenueForm((current) => ({ ...current, contactName: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Số điện thoại</CFormLabel><CFormInput value={venueForm.contactPhone} onChange={(event) => setVenueForm((current) => ({ ...current, contactPhone: event.target.value }))} /></CCol>
            <CCol xs={12}><CFormLabel>Địa chỉ</CFormLabel><CFormTextarea rows={2} value={venueForm.address} onChange={(event) => setVenueForm((current) => ({ ...current, address: event.target.value }))} /></CCol>
            <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={3} value={venueForm.description} onChange={(event) => setVenueForm((current) => ({ ...current, description: event.target.value }))} /></CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowVenueCreate(false)} disabled={modalSubmitting}>Đóng</CButton>
          <CButton color='primary' onClick={submitVenueCreate} disabled={modalSubmitting}>{modalSubmitting ? 'Đang tạo...' : 'Tạo địa điểm'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showRoomCreate} onClose={() => setShowRoomCreate(false)}>
        <CModalHeader><CModalTitle>Tạo nhanh phòng thi</CModalTitle></CModalHeader>
        <CModalBody>
          {modalError ? <CAlert color='danger'>{modalError}</CAlert> : null}
          <CRow className='g-3'>
            <CCol md={6}><CFormLabel>Địa điểm</CFormLabel><CFormSelect value={roomForm.examVenueId} onChange={(event) => setRoomForm((current) => ({ ...current, examVenueId: event.target.value }))}><option value=''>Chọn địa điểm</option>{(config?.availableVenues || []).filter((venue) => venue.isActive === true).map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</CFormSelect></CCol>
            <CCol md={6}><CFormLabel>Mã phòng</CFormLabel><CFormInput value={roomForm.code} onChange={(event) => setRoomForm((current) => ({ ...current, code: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Tên phòng</CFormLabel><CFormInput value={roomForm.name} onChange={(event) => setRoomForm((current) => ({ ...current, name: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Tầng</CFormLabel><CFormInput value={roomForm.floor} onChange={(event) => setRoomForm((current) => ({ ...current, floor: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Sức chứa</CFormLabel><CFormInput type='number' min={1} value={roomForm.capacity} onChange={(event) => setRoomForm((current) => ({ ...current, capacity: event.target.value }))} /></CCol>
            <CCol md={6}><CFormLabel>Loại phòng</CFormLabel><CFormSelect value={roomForm.roomType} onChange={(event) => setRoomForm((current) => ({ ...current, roomType: event.target.value }))}><option value='standard'>Phòng tiêu chuẩn</option><option value='computer'>Phòng máy</option><option value='oral'>Phòng vấn đáp</option><option value='practical'>Phòng thực hành</option><option value='other'>Khác</option></CFormSelect></CCol>
            <CCol md={6}><CFormLabel>Sort order</CFormLabel><CFormInput type='number' min={0} value={roomForm.sortOrder} onChange={(event) => setRoomForm((current) => ({ ...current, sortOrder: event.target.value }))} /></CCol>
            <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={3} value={roomForm.description} onChange={(event) => setRoomForm((current) => ({ ...current, description: event.target.value }))} /></CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowRoomCreate(false)} disabled={modalSubmitting}>Đóng</CButton>
          <CButton color='primary' onClick={submitRoomCreate} disabled={modalSubmitting}>{modalSubmitting ? 'Đang tạo...' : 'Tạo phòng'}</CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}
