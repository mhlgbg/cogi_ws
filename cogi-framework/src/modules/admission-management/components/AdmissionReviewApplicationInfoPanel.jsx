import { memo } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CLink,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { buildProtectedFileUrl, isDataUrl, openUrlInNewTab, resolveMediaUrl } from '../../../utils/mediaUrl'
import { sanitizeHtml } from '../../../pages/journal/journalPublicUtils'

function isFileLikeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Boolean(value.name || value.fileName || value.url || value.path || value.href || value.dataUrl || value.mime || value.type)
}

function getFileLikeName(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (isFileLikeObject(value)) {
    return String(value.fileName || value.name || value.label || value.title || '').trim()
  }
  return ''
}

function getFileLikeUrl(value) {
  if (!isFileLikeObject(value)) return ''
  return buildProtectedFileUrl(value) || resolveMediaUrl(String(value.url || value.path || value.href || value.dataUrl || '').trim())
}

function isPdfLike(value) {
  const fileName = getFileLikeName(value).toLowerCase()
  const url = getFileLikeUrl(value).toLowerCase()
  const mime = isFileLikeObject(value) ? String(value.mime || value.type || '').trim().toLowerCase() : ''
  return mime === 'application/pdf' || fileName.endsWith('.pdf') || url.endsWith('.pdf')
}

function renderValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    const fileNames = value.map((entry) => getFileLikeName(entry)).filter(Boolean)
    if (fileNames.length > 0) return fileNames.join(', ')
    return value.map((entry) => renderValue(entry)).filter((entry) => entry !== '-').join(', ') || '-'
  }
  if (isFileLikeObject(value)) {
    return getFileLikeName(value) || '-'
  }
  return String(value)
}

function renderFileLink(name, url, key) {
  if (!url) {
    return <div key={key}>{name}</div>
  }

  return (
    <CLink
      key={key}
      href={isDataUrl(url) ? '#' : url}
      target={isDataUrl(url) ? undefined : '_blank'}
      rel={isDataUrl(url) ? undefined : 'noreferrer'}
      onClick={(event) => {
        if (!isDataUrl(url)) return
        event.preventDefault()
        void openUrlInNewTab(url)
      }}
    >
      {name}
    </CLink>
  )
}
function TableValue({ rows }) {
  const safeRows = Array.isArray(rows) ? rows : []
  if (safeRows.length === 0) {
    return <div className='text-body-secondary small'>Không có dữ liệu bảng.</div>
  }

  const headers = Array.isArray(safeRows[0]?.cells) ? safeRows[0].cells : []

  return (
    <CTable bordered responsive small className='mb-0'>
      <CTableHead>
        <CTableRow>
          {headers.map((cell) => (
            <CTableHeaderCell key={cell.key || cell.label}>{cell.label}</CTableHeaderCell>
          ))}
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {safeRows.map((row) => (
          <CTableRow key={row.key || Math.random()}>
            {(Array.isArray(row.cells) ? row.cells : []).map((cell) => (
              <CTableDataCell key={cell.key || cell.label}>{renderValue(cell.value)}</CTableDataCell>
            ))}
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
  )
}

function SectionItem({ item }) {
  if (item?.value && typeof item.value === 'object' && item.value.type === 'table') {
    return (
      <div className='mb-4'>
        <div className='fw-semibold mb-2'>{item.label}</div>
        <TableValue rows={item.value.rows} />
      </div>
    )
  }

  if (Array.isArray(item?.value)) {
    const fileLikeEntries = item.value.filter((entry) => isFileLikeObject(entry))
    if (fileLikeEntries.length > 0) {
      return (
        <div className='mb-4'>
          <div className='small text-body-secondary'>{item.label}</div>
          <div className='d-flex flex-column gap-2'>
            {fileLikeEntries.map((entry, index) => {
              const name = getFileLikeName(entry) || `Tệp ${index + 1}`
              const url = getFileLikeUrl(entry)
              if (!isPdfLike(entry)) {
                return <div key={`${name}-${index}`}>{name}</div>
              }

              return renderFileLink(name, url, `${name}-${index}`)
            })}
          </div>
        </div>
      )
    }
  }

  if (isFileLikeObject(item?.value)) {
    const name = getFileLikeName(item.value) || '-'
    const url = getFileLikeUrl(item.value)
    return (
      <div className='mb-4'>
        <div className='small text-body-secondary'>{item.label}</div>
        {url && isPdfLike(item.value) ? (
          <CLink
            href={isDataUrl(url) ? '#' : url}
            target={isDataUrl(url) ? undefined : '_blank'}
            rel={isDataUrl(url) ? undefined : 'noreferrer'}
            onClick={(event) => {
              if (!isDataUrl(url)) return
              event.preventDefault()
              void openUrlInNewTab(url)
            }}
          >
            {name}
          </CLink>
        ) : <div style={{ whiteSpace: 'pre-wrap' }}>{name}</div>}
      </div>
    )
  }

  return (
    <div className='mb-4'>
      <div className='small text-body-secondary'>{item.label}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{renderValue(item.value)}</div>
    </div>
  )
}

const ApplicationInfoPanel = memo(function ApplicationInfoPanel({
  detail,
  sections,
  warningMessage,
  canReview,
  canRequestRevision,
  canEditReturnedNote,
  approvalNotifiedAt,
  approvalNotificationCount,
  approvedAcknowledgedAt,
  onOpenEmailModal,
  onEditApplication,
  onEditReturnedNote,
  onRestoreDeleted,
  onSoftDelete,
  submitting,
  editingApplication,
  restoringDeleted,
  softDeleting,
  onBack,
  onAction,
  isDeleted,
  reviewStatusLabel,
  reviewStatusColor,
  reviewerName,
  reviewedAt,
  note,
}) {
  const safeNoteHtml = sanitizeHtml(note)

  return (
    <div className='d-flex flex-column gap-4'>
      <div style={{ position: 'sticky', top: '1rem', zIndex: 1 }}>
        <CCard className='border-0 shadow-sm'>
          <CCardHeader className='bg-white border-0 fw-semibold'>Thao tác duyệt</CCardHeader>
          <CCardBody>
            <div className='d-flex flex-column gap-2'>
              <CButton color='secondary' variant='outline' onClick={onBack}>Quay lại danh sách</CButton>
              {isDeleted ? (
                <>
                  <CButton color='success' onClick={onRestoreDeleted} disabled={submitting || restoringDeleted}>
                    {restoringDeleted ? 'Đang khôi phục...' : 'Khôi phục hồ sơ'}
                  </CButton>
                </>
              ) : (
                <>
                  <CButton color='danger' variant='outline' onClick={onSoftDelete} disabled={submitting || softDeleting}>
                    {softDeleting ? 'Đang xóa...' : 'Xóa mềm hồ sơ'}
                  </CButton>
                  <CButton color='info' variant='outline' onClick={onEditApplication} disabled={submitting || editingApplication}>
                    {editingApplication ? 'Đang lưu...' : 'Chỉnh sửa hồ sơ'}
                  </CButton>
                  <CButton color='primary' variant='outline' onClick={onOpenEmailModal} disabled={!detail?.parent?.email || submitting}>
                    Gửi thư cho phụ huynh
                  </CButton>
                  {canEditReturnedNote ? (
                    <CButton color='warning' variant='outline' onClick={onEditReturnedNote} disabled={submitting}>
                      Sửa nội dung nhận xét
                    </CButton>
                  ) : null}
                  {canRequestRevision ? (
                    <CButton color='warning' onClick={() => onAction('returned')} disabled={submitting}>
                      {canReview ? 'Yêu cầu bổ sung' : 'Cần chỉnh sửa'}
                    </CButton>
                  ) : null}
                  {canReview ? (
                    <CButton color='success' onClick={() => onAction('accepted')} disabled={submitting}>Duyệt hồ sơ</CButton>
                  ) : null}
                </>
              )}
            </div>
            {(approvalNotifiedAt || approvalNotificationCount > 0 || approvedAcknowledgedAt) ? (
              <div className='small text-body-secondary mt-3 border-top pt-3'>
                <div>Lần gửi nhắc gần nhất: {approvalNotifiedAt || '-'}</div>
                <div>Tổng số lần gửi: {approvalNotificationCount || 0}</div>
                <div>Xác nhận phụ huynh: {approvedAcknowledgedAt || 'Chưa xác nhận'}</div>
              </div>
            ) : null}
            {!detail?.parent?.email ? <CAlert color='warning' className='mt-3 mb-0'>Hồ sơ này chưa có email phụ huynh để gửi thư.</CAlert> : null}
          </CCardBody>
        </CCard>
      </div>

      <CCard className='border-0 shadow-sm'>
        <CCardHeader className='bg-white border-0 fw-semibold'>Thông tin hồ sơ</CCardHeader>
        <CCardBody>
          <div className='mb-3'><strong>Học sinh:</strong> {detail?.studentName || '-'}</div>
          <div className='mb-3'>
            <strong>Mã hồ sơ:</strong> {detail?.applicationCode || '-'}
            <span className='ms-3'><strong>Mã học sinh:</strong> {detail?.studentCode || '-'}</span>
          </div>
          <div className='mb-3'><strong>Trạng thái:</strong> <CBadge color={reviewStatusColor}>{reviewStatusLabel}</CBadge></div>
          <div className='mb-3'><strong>Phụ huynh:</strong> {detail?.parent?.fullName || detail?.parent?.username || '-'}</div>
          <div className='small text-body-secondary mt-1'>SĐT: {detail?.parent?.phone || '-'}</div>
          <div className='small text-body-secondary'>Email: {detail?.parent?.email || '-'}</div>
        </CCardBody>
      </CCard>

      {warningMessage ? <CAlert color='warning' className='mb-0'>{warningMessage}</CAlert> : null}

      {Array.isArray(sections) && sections.length > 0 ? sections.map((section) => (
        <CCard key={section.key || section.title} className='border-0 shadow-sm'>
          <CCardHeader className='bg-white border-0 fw-semibold'>{section.title || 'Thông tin hồ sơ'}</CCardHeader>
          <CCardBody>
            {Array.isArray(section.items) && section.items.length > 0 ? section.items.map((item) => (
              <SectionItem key={item.key || item.label} item={item} />
            )) : <div className='text-body-secondary small'>Không có dữ liệu hiển thị.</div>}
          </CCardBody>
        </CCard>
      )) : (
        <CAlert color='light' className='mb-0'>Không có phần thông tin tóm tắt để hiển thị.</CAlert>
      )}

      <CCard className='border-0 shadow-sm'>
        <CCardHeader className='bg-white border-0 fw-semibold'>Kết quả duyệt</CCardHeader>
        <CCardBody>
          <div className='mb-3'><strong>Người duyệt:</strong> {reviewerName || '-'}</div>
          <div className='mb-3'><strong>Thời gian duyệt:</strong> {reviewedAt || '-'}</div>
          <div><strong>Ghi chú:</strong></div>
          {safeNoteHtml ? (
            <div className='text-body-secondary mt-1' dangerouslySetInnerHTML={{ __html: safeNoteHtml }} />
          ) : (
            <div className='text-body-secondary mt-1'>-</div>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
})

export default ApplicationInfoPanel
