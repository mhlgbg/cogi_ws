import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  copyExamRoundVenueRoomConfiguration,
  listExamRoundVenueRoomCopySources,
  previewExamRoundVenueRoomCopy,
} from '../services/examRoundApi'
import { formatDateTime, formatMoney, getApiMessage } from '../utils/examRoundUi'

function getVenueRoomCopyApiMessage(error, fallback) {
  const code = String(error?.response?.data?.code || error?.response?.data?.error?.code || '').trim()
  const mapped = {
    EXAM_ROUND_COPY_SOURCE_NOT_FOUND: 'Không tìm thấy đợt nguồn phù hợp trong tenant hiện tại.',
    EXAM_ROUND_COPY_SOURCE_SAME_AS_TARGET: 'Bạn cần chọn một đợt nguồn khác với đợt hiện tại.',
    EXAM_ROUND_COPY_SOURCE_EMPTY_CONFIGURATION: 'Đợt nguồn chưa có cấu hình địa điểm/phòng để sao chép.',
    EXAM_ROUND_COPY_SOURCE_NO_VALID_VENUE_ROOM: 'Đợt nguồn không còn venue/phòng active hợp lệ để sao chép.',
    EXAM_ROUND_NOT_FOUND: 'Không tìm thấy đợt thi trong tenant hiện tại.',
  }[code]
  return mapped || getApiMessage(error, fallback)
}

function getActionMeta(action) {
  const normalized = String(action || '').trim().toUpperCase()
  if (normalized === 'ADD') return { label: 'Sẽ thêm', color: 'success' }
  if (normalized === 'SKIP') return { label: 'Bỏ qua', color: 'secondary' }
  return { label: 'Cảnh báo', color: 'warning' }
}

export default function ExamRoundVenueRoomCopyModal({ visible, roundId, hasExistingConfiguration = false, onClose, onCopied }) {
  const [loadingSources, setLoadingSources] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sources, setSources] = useState([])
  const [selectedSourceId, setSelectedSourceId] = useState(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!visible) {
      setLoadingSources(false)
      setPreviewLoading(false)
      setConfirmLoading(false)
      setError('')
      setSearch('')
      setDebouncedSearch('')
      setSources([])
      setSelectedSourceId(null)
      setPreview(null)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return undefined
    const timer = window.setTimeout(() => setDebouncedSearch(String(search || '').trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search, visible])

  useEffect(() => {
    if (!visible || !roundId) return
    let mounted = true
    async function loadSources() {
      setLoadingSources(true)
      setError('')
      try {
        const result = await listExamRoundVenueRoomCopySources(roundId, { search: debouncedSearch, page: 1, pageSize: 10 })
        if (!mounted) return
        setSources(Array.isArray(result?.data) ? result.data : [])
      } catch (requestError) {
        if (!mounted) return
        setSources([])
        setError(getVenueRoomCopyApiMessage(requestError, 'Không tải được danh sách đợt nguồn.'))
      } finally {
        if (mounted) setLoadingSources(false)
      }
    }
    loadSources()
    return () => { mounted = false }
  }, [debouncedSearch, roundId, visible])

  const canConfirm = Boolean(selectedSourceId) && Boolean(preview) && !previewLoading && !confirmLoading

  const sourceSummaryText = useMemo(() => {
    if (!preview?.sourceRound) return ''
    return `${preview.sourceRound.code || '-'} · ${preview.summary?.sourceVenueCount || 0} địa điểm · ${preview.summary?.sourceRoomCount || 0} phòng · sức chứa ${formatMoney(preview.summary?.sourceTotalCapacity || 0)}`
  }, [preview])

  async function handlePreview(sourceRoundId) {
    setSelectedSourceId(sourceRoundId)
    setPreviewLoading(true)
    setError('')
    try {
      const result = await previewExamRoundVenueRoomCopy(roundId, sourceRoundId)
      setPreview(result)
    } catch (requestError) {
      setPreview(null)
      setError(getVenueRoomCopyApiMessage(requestError, 'Không thể xem trước cấu hình của đợt nguồn.'))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleConfirm() {
    if (!canConfirm) return
    setConfirmLoading(true)
    setError('')
    try {
      const result = await copyExamRoundVenueRoomConfiguration(roundId, { sourceRoundId: selectedSourceId })
      onCopied?.(result)
    } catch (requestError) {
      setError(getVenueRoomCopyApiMessage(requestError, 'Không thể sao chép cấu hình địa điểm và phòng.'))
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <CModal visible={visible} size='xl' scrollable backdrop='static' onClose={() => !loadingSources && !previewLoading && !confirmLoading && onClose?.()}>
      <CModalHeader>
        <CModalTitle>Dùng cấu hình địa điểm & phòng từ đợt khác</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className='mb-3'>
          <CFormLabel>Tìm đợt nguồn</CFormLabel>
          <CFormInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Tìm theo mã đợt hoặc tên đợt' disabled={loadingSources || previewLoading || confirmLoading} />
        </div>

        {hasExistingConfiguration ? <CAlert color='info'>Pha này chỉ hỗ trợ bổ sung vào cấu hình hiện tại. Dữ liệu venue/room đang có ở đợt này sẽ được giữ nguyên.</CAlert> : null}
        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        <div className='mb-4'>
          <div className='fw-semibold mb-2'>Đợt gần đây</div>
          {loadingSources ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải đợt nguồn...</div> : null}
          {!loadingSources ? (
            <CTable hover responsive align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Mã đợt</CTableHeaderCell>
                  <CTableHeaderCell>Tên đợt</CTableHeaderCell>
                  <CTableHeaderCell>Chương trình</CTableHeaderCell>
                  <CTableHeaderCell>Thời gian thi</CTableHeaderCell>
                  <CTableHeaderCell>Tóm tắt</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {sources.length > 0 ? sources.map((source) => (
                  <CTableRow key={source.id} active={Number(selectedSourceId || 0) === Number(source.id)}>
                    <CTableDataCell>{source.code || '-'}</CTableDataCell>
                    <CTableDataCell>
                      <div className='fw-semibold'>{source.name || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell>{source.examProgram?.name || source.examProgram?.code || '-'}</CTableDataCell>
                    <CTableDataCell>{source.examStartAt ? `${formatDateTime(source.examStartAt)}${source.examEndAt ? ` - ${formatDateTime(source.examEndAt)}` : ''}` : '-'}</CTableDataCell>
                    <CTableDataCell>{source.venueCount || 0} địa điểm · {source.roomCount || 0} phòng · {formatMoney(source.totalCapacity || 0)}</CTableDataCell>
                    <CTableDataCell>
                      <CButton color='secondary' size='sm' variant={Number(selectedSourceId || 0) === Number(source.id) ? undefined : 'outline'} onClick={() => handlePreview(source.id)} disabled={previewLoading || confirmLoading}>
                        {previewLoading && Number(selectedSourceId || 0) === Number(source.id) ? 'Đang xem...' : 'Xem cấu hình'}
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                )) : (
                  <CTableRow>
                    <CTableDataCell colSpan={6} className='text-center text-body-secondary py-4'>Không có đợt nguồn phù hợp để tái sử dụng cấu hình.</CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
          ) : null}
        </div>

        {preview ? (
          <div className='d-flex flex-column gap-3'>
            <CAlert color='info' className='mb-0'>
              Nguồn: {sourceSummaryText}
            </CAlert>
            <CAlert color='secondary' className='mb-0'>
              Sau khi merge: thêm {preview.summary?.addedVenues || 0} địa điểm, thêm {preview.summary?.addedRooms || 0} phòng, bỏ qua {preview.summary?.skippedVenues || 0} địa điểm và {preview.summary?.skippedRooms || 0} phòng đã có hoặc không hợp lệ.
            </CAlert>
            {Array.isArray(preview?.warnings) && preview.warnings.length > 0 ? preview.warnings.map((warning) => (
              <CAlert key={warning.code || warning.message} color='warning' className='mb-0'>{warning.message}</CAlert>
            )) : null}

            <div>
              <div className='fw-semibold mb-2'>Địa điểm</div>
              <CTable hover responsive align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Mã</CTableHeaderCell>
                    <CTableHeaderCell>Tên</CTableHeaderCell>
                    <CTableHeaderCell>Địa chỉ</CTableHeaderCell>
                    <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell>Kết quả</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {preview.venues?.map((venue) => {
                    const actionMeta = getActionMeta(venue.action)
                    return (
                      <CTableRow key={`copy-venue-${venue.id}`}>
                        <CTableDataCell>{venue.code || '-'}</CTableDataCell>
                        <CTableDataCell>{venue.name || '-'}</CTableDataCell>
                        <CTableDataCell>{venue.address || '-'}</CTableDataCell>
                        <CTableDataCell><CBadge color={venue.isActive ? 'success' : 'warning'}>{venue.isActive ? 'Active' : 'Inactive'}</CBadge></CTableDataCell>
                        <CTableDataCell><CBadge color={actionMeta.color}>{actionMeta.label}</CBadge><div className='small text-body-secondary mt-1'>{venue.resultMessage || '-'}</div></CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            </div>

            <div>
              <div className='fw-semibold mb-2'>Phòng</div>
              <CTable hover responsive align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Địa điểm</CTableHeaderCell>
                    <CTableHeaderCell>Mã phòng</CTableHeaderCell>
                    <CTableHeaderCell>Tên phòng</CTableHeaderCell>
                    <CTableHeaderCell>Sức chứa</CTableHeaderCell>
                    <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell>Kết quả</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {preview.rooms?.map((room) => {
                    const actionMeta = getActionMeta(room.action)
                    return (
                      <CTableRow key={`copy-room-${room.id}`}>
                        <CTableDataCell>{room.examVenue?.name || room.examVenue?.code || '-'}</CTableDataCell>
                        <CTableDataCell>{room.code || '-'}</CTableDataCell>
                        <CTableDataCell>{room.name || '-'}</CTableDataCell>
                        <CTableDataCell>{formatMoney(room.capacity || 0)}</CTableDataCell>
                        <CTableDataCell><CBadge color={room.isActive && room.examVenue?.isActive ? 'success' : 'warning'}>{room.isActive && room.examVenue?.isActive ? 'Active' : 'Inactive'}</CBadge></CTableDataCell>
                        <CTableDataCell><CBadge color={actionMeta.color}>{actionMeta.label}</CBadge><div className='small text-body-secondary mt-1'>{room.resultMessage || '-'}</div></CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            </div>
          </div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={loadingSources || previewLoading || confirmLoading}>Đóng</CButton>
        <CButton color='primary' onClick={handleConfirm} disabled={!canConfirm}>
          {confirmLoading ? <span className='d-inline-flex align-items-center gap-2'><CSpinner size='sm' />Đang sao chép...</span> : 'Dùng cấu hình này'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}