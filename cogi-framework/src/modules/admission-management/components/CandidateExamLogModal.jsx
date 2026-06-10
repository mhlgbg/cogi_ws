import {
  CAlert,
  CBadge,
  CModal,
  CModalBody,
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

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function getActionLabel(action) {
  const normalized = String(action || '').trim().toLowerCase()
  if (normalized === 'card_view') return 'Xem thẻ'
  if (normalized === 'first_card_download') return 'Tải thẻ lần đầu'
  if (normalized === 'card_download') return 'Tải thẻ'
  if (normalized === 'card_print') return 'In thẻ'
  if (normalized === 'card_reminder_sent') return 'Gửi nhắc thẻ'
  if (normalized === 'card_reminder_failed') return 'Gửi nhắc lỗi'
  if (normalized === 'status_changed') return 'Đổi trạng thái'
  if (normalized === 'score_updated') return 'Cập nhật điểm'
  if (normalized === 'room_assigned') return 'Gán phòng / SBD'
  if (normalized === 'note_updated') return 'Cập nhật ghi chú'
  if (normalized === 'import_created') return 'Import tạo mới'
  if (normalized === 'import_updated') return 'Import cập nhật'
  if (normalized === 'import_restored') return 'Import khôi phục'
  if (normalized === 'score_lookup') return 'Xem điểm'
  if (normalized === 'score_report_sent') return 'Đã gửi thư báo điểm'
  return normalized || '-'
}

function getActorLabel(actorType) {
  const normalized = String(actorType || '').trim().toLowerCase()
  if (normalized === 'parent') return 'Phụ huynh'
  if (normalized === 'staff') return 'Cán bộ'
  if (normalized === 'system') return 'Hệ thống'
  return normalized || '-'
}

function stringifyValue(value) {
  if (value === null || value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function CandidateExamLogModal({
  visible,
  title,
  loading,
  error,
  logs,
  onClose,
}) {
  return (
    <CModal visible={visible} onClose={onClose} size='xl' scrollable>
      <CModalHeader>
        <CModalTitle>{title || 'Lịch sử thao tác'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải log...</span>
          </div>
        ) : error ? (
          <CAlert color='danger' className='mb-0'>{error}</CAlert>
        ) : Array.isArray(logs) && logs.length > 0 ? (
          <CTable hover responsive align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Thời gian</CTableHeaderCell>
                <CTableHeaderCell>Hành động</CTableHeaderCell>
                <CTableHeaderCell>Người thao tác</CTableHeaderCell>
                <CTableHeaderCell>Ghi chú</CTableHeaderCell>
                <CTableHeaderCell>Thay đổi</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {logs.map((item) => (
                <CTableRow key={item.id}>
                  <CTableDataCell>{formatDateTime(item.actionAt || item.createdAt)}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color='info'>{getActionLabel(item.action)}</CBadge>
                  </CTableDataCell>
                  <CTableDataCell>
                    <div>{item?.actionBy?.fullName || item?.actionBy?.username || '-'}</div>
                    <div className='small text-body-secondary'>{getActorLabel(item.actorType)}</div>
                  </CTableDataCell>
                  <CTableDataCell>{item.note || '-'}</CTableDataCell>
                  <CTableDataCell>
                    {(item.oldValue || item.newValue) ? (
                      <pre className='mb-0 small' style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {`Old: ${stringifyValue(item.oldValue)}\nNew: ${stringifyValue(item.newValue)}`}
                      </pre>
                    ) : '-'}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        ) : (
          <CAlert color='info' className='mb-0'>Chưa có log nào cho thí sinh này.</CAlert>
        )}
      </CModalBody>
    </CModal>
  )
}