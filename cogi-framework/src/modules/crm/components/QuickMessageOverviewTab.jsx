import { useMemo, useState } from 'react'
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
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import QuickMessageForm from './QuickMessageForm'
import QuickMessageStatusBadge from './QuickMessageStatusBadge'
import {
  formatDateTime,
  formatDateTimeInput,
  getHostnameLabel,
  getQuickMessageContentTypeLabel,
  getQuickMessageRenderedHtml,
  getReplyModeLabel,
  toIsoFromDateTimeInput,
} from './quickMessageUi'

function SummaryCard({ label, value, helper }) {
  return (
    <CCard className='border-0 shadow-sm h-100'>
      <CCardBody>
        <div className='text-body-secondary small'>{label}</div>
        <div className='fs-4 fw-semibold mt-1'>{value}</div>
        {helper ? <div className='small text-body-secondary mt-1'>{helper}</div> : null}
      </CCardBody>
    </CCard>
  )
}

export default function QuickMessageOverviewTab({
  detail,
  loading = false,
  saveError = '',
  saving = false,
  statusSubmitting = false,
  onRefresh,
  onSave,
  onActivate,
  onLock,
  onUnlock,
  onCancelMessage,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [confirmState, setConfirmState] = useState({ visible: false, type: '', expiresAt: '', error: '' })

  const message = detail?.message || null
  const summary = detail?.summary || {}
  const canEdit = message && message.status !== 'cancelled' && message.status !== 'locked'
  const needsUnlockExpiry = useMemo(() => {
    if (message?.status !== 'locked') return false
    if (!message?.expiresAt) return false
    const expiresAt = new Date(message.expiresAt)
    return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()
  }, [message?.expiresAt, message?.status])

  async function submitStatusAction() {
    if (confirmState.type === 'cancel') {
      await onCancelMessage?.()
      setConfirmState({ visible: false, type: '', expiresAt: '', error: '' })
      return
    }

    if (confirmState.type === 'lock') {
      await onLock?.()
      setConfirmState({ visible: false, type: '', expiresAt: '', error: '' })
      return
    }

    if (confirmState.type === 'unlock') {
      if (needsUnlockExpiry) {
        const isoValue = toIsoFromDateTimeInput(confirmState.expiresAt)
        if (!isoValue) {
          setConfirmState((prev) => ({ ...prev, error: 'Vui lòng chọn thời gian hết hạn mới hợp lệ.' }))
          return
        }
        await onUnlock?.({ expiresAt: isoValue })
      } else {
        await onUnlock?.({})
      }
      setConfirmState({ visible: false, type: '', expiresAt: '', error: '' })
      return
    }

    if (confirmState.type === 'activate') {
      await onActivate?.()
      setConfirmState({ visible: false, type: '', expiresAt: '', error: '' })
    }
  }

  const links = Array.isArray(message?.links) ? message.links : []
  const renderedHtml = getQuickMessageRenderedHtml(message?.content, message?.contentType)

  return (
    <>
      <CRow className='g-3 mb-4'>
        <CCol md={3}><SummaryCard label='Số mã truy cập' value={summary.accessCount || 0} /></CCol>
        <CCol md={3}><SummaryCard label='Mã đang hoạt động' value={summary.activeAccessCount || 0} /></CCol>
        <CCol md={3}><SummaryCard label='Tổng lượt xem' value={summary.totalViewCount || 0} /></CCol>
        <CCol md={3}><SummaryCard label='Phản hồi chưa đọc' value={summary.unreadReplyCount || 0} helper={`${summary.replyCount || 0} phản hồi`} /></CCol>
      </CRow>

      <CRow className='g-4'>
        <CCol xl={8}>
          <CCard className='border-0 shadow-sm'>
            <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
              <strong>Thông tin chung</strong>
              <div className='d-flex gap-2'>
                {isEditing ? (
                  <CButton color='secondary' variant='outline' onClick={() => setIsEditing(false)} disabled={saving}>Đóng</CButton>
                ) : (
                  <CButton color='primary' variant='outline' onClick={() => setIsEditing(true)} disabled={!canEdit || loading}>Chỉnh sửa</CButton>
                )}
              </div>
            </CCardHeader>
            <CCardBody>
              {message?.status === 'cancelled' ? <CAlert color='warning'>Thông điệp đã bị hủy và không thể chỉnh sửa.</CAlert> : null}
              {message?.status === 'locked' ? <CAlert color='warning'>Thông điệp đang bị khóa. Hãy mở lại trước khi chỉnh sửa nội dung.</CAlert> : null}

              {isEditing && canEdit ? (
                <QuickMessageForm
                  mode='edit'
                  initialValues={message}
                  submitting={saving}
                  errorMessage={saveError}
                  submitLabel='Lưu thay đổi'
                  onCancel={() => setIsEditing(false)}
                  onSubmit={async (payload) => {
                    await onSave?.(payload)
                    setIsEditing(false)
                  }}
                />
              ) : (
                <CRow className='g-3 small'>
                  <CCol md={12}><strong>Tiêu đề:</strong> {message?.title || '-'}</CCol>
                  <CCol md={6}><strong>Kiểu nội dung:</strong> <CBadge color={message?.contentType === 'html' ? 'info' : 'secondary'}>{getQuickMessageContentTypeLabel(message?.contentType)}</CBadge></CCol>
                  <CCol md={12}>
                    <strong>Nội dung:</strong>
                    {message?.contentType === 'html'
                      ? <div className='mt-1 quick-message-html-content' dangerouslySetInnerHTML={{ __html: renderedHtml || '<p>-</p>' }} />
                      : <div className='mt-1 quick-message-text-content' style={{ whiteSpace: 'pre-wrap' }}>{message?.content || '-'}</div>}
                  </CCol>
                  <CCol md={12}>
                    <strong>Danh sách link:</strong>
                    {links.length === 0 ? <div className='mt-1'>-</div> : (
                      <div className='mt-2 d-flex flex-column gap-2'>
                        {links.map((item, index) => (
                          <div key={`overview-link-${index}`} className='border rounded p-2'>
                            <div className='fw-semibold'>{item?.label || getHostnameLabel(item?.url)}</div>
                            <div className='small text-body-secondary mb-1'>{getHostnameLabel(item?.url)}</div>
                            <a href={item?.url || '#'} target='_blank' rel='noopener noreferrer'>{item?.url || '-'}</a>
                          </div>
                        ))}
                      </div>
                    )}
                  </CCol>
                  <CCol md={6}><strong>Trạng thái:</strong> <QuickMessageStatusBadge status={message?.status} effectiveStatus={message?.effectiveStatus} /></CCol>
                  <CCol md={6}><strong>Thời gian hết hạn:</strong> {formatDateTime(message?.expiresAt)}</CCol>
                  <CCol md={6}><strong>Cho phép phản hồi:</strong> {message?.allowReply ? 'Có' : 'Không'}</CCol>
                  <CCol md={6}><strong>Kiểu phản hồi:</strong> {message?.allowReply ? getReplyModeLabel(message?.replyMode) : '-'}</CCol>
                  <CCol md={6}><strong>Người tạo:</strong> {message?.senderDisplayName || '-'}</CCol>
                  <CCol md={6}><strong>Ngày tạo:</strong> {formatDateTime(message?.createdAt)}</CCol>
                  <CCol md={6}><strong>Cập nhật gần nhất:</strong> {formatDateTime(message?.updatedAt)}</CCol>
                  <CCol md={6}><strong>Hiệu lực thực tế:</strong> <QuickMessageStatusBadge status={message?.status} effectiveStatus={message?.effectiveStatus} /></CCol>
                </CRow>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={4}>
          <CCard className='border-0 shadow-sm'>
            <CCardHeader><strong>Quản lý trạng thái</strong></CCardHeader>
            <CCardBody>
              {saveError && !isEditing ? <CAlert color='danger'>{saveError}</CAlert> : null}

              {message?.status === 'cancelled' ? (
                <CAlert color='secondary' className='mb-0'>Thông điệp đã bị hủy và không thể sử dụng lại.</CAlert>
              ) : (
                <div className='d-flex flex-column gap-2'>
                  {message?.status === 'active' ? (
                    <>
                      <CButton color='warning' onClick={() => setConfirmState({ visible: true, type: 'lock', expiresAt: '', error: '' })} disabled={statusSubmitting}>Khóa thông điệp</CButton>
                      <CButton color='danger' variant='outline' onClick={() => setConfirmState({ visible: true, type: 'cancel', expiresAt: '', error: '' })} disabled={statusSubmitting}>Hủy thông điệp</CButton>
                    </>
                  ) : null}

                  {message?.status === 'locked' ? (
                    <>
                      <CButton color='success' onClick={() => setConfirmState({ visible: true, type: 'unlock', expiresAt: needsUnlockExpiry ? formatDateTimeInput(message?.expiresAt) : '', error: '' })} disabled={statusSubmitting}>Mở lại</CButton>
                      <CButton color='danger' variant='outline' onClick={() => setConfirmState({ visible: true, type: 'cancel', expiresAt: '', error: '' })} disabled={statusSubmitting}>Hủy thông điệp</CButton>
                    </>
                  ) : null}

                  {message?.status === 'draft' ? (
                    <>
                      <CButton color='success' onClick={() => setConfirmState({ visible: true, type: 'activate', expiresAt: '', error: '' })} disabled={statusSubmitting}>Kích hoạt thông điệp</CButton>
                      <CButton color='danger' variant='outline' onClick={() => setConfirmState({ visible: true, type: 'cancel', expiresAt: '', error: '' })} disabled={statusSubmitting}>Hủy thông điệp</CButton>
                    </>
                  ) : null}
                </div>
              )}

              <div className='mt-3'>
                <CButton color='secondary' variant='outline' onClick={onRefresh} disabled={loading}>Tải lại dữ liệu</CButton>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CModal visible={confirmState.visible} onClose={() => setConfirmState({ visible: false, type: '', expiresAt: '', error: '' })} alignment='center'>
        <CModalHeader>
          <CModalTitle>
            {confirmState.type === 'cancel' ? 'Xác nhận hủy thông điệp' : null}
            {confirmState.type === 'lock' ? 'Xác nhận khóa thông điệp' : null}
            {confirmState.type === 'unlock' ? 'Xác nhận mở lại thông điệp' : null}
            {confirmState.type === 'activate' ? 'Xác nhận kích hoạt thông điệp' : null}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {confirmState.type === 'cancel' ? <div>Bạn có chắc muốn hủy thông điệp này? Tất cả mã truy cập sẽ không còn sử dụng được.</div> : null}
          {confirmState.type === 'lock' ? <div>Sau khi khóa, tất cả mã truy cập của thông điệp sẽ tạm thời không sử dụng được.</div> : null}
          {confirmState.type === 'activate' ? <div>Thông điệp nháp sẽ được chuyển sang trạng thái hoạt động.</div> : null}
          {confirmState.type === 'unlock' ? (
            <div>
              <div className='mb-2'>Thông điệp sẽ được mở lại về trạng thái hoạt động.</div>
              {needsUnlockExpiry ? (
                <>
                  <CFormLabel htmlFor='quick-message-unlock-expires-at'>Thời gian hết hạn mới</CFormLabel>
                  <CFormInput
                    id='quick-message-unlock-expires-at'
                    type='datetime-local'
                    value={confirmState.expiresAt}
                    onChange={(event) => setConfirmState((prev) => ({ ...prev, expiresAt: event.target.value, error: '' }))}
                  />
                  <div className='small text-body-secondary mt-1'>Thông điệp đang quá hạn. Cần gia hạn trước khi mở lại.</div>
                </>
              ) : null}
            </div>
          ) : null}
          {confirmState.error ? <div className='text-danger small mt-2'>{confirmState.error}</div> : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setConfirmState({ visible: false, type: '', expiresAt: '', error: '' })}>Đóng</CButton>
          <CButton color={confirmState.type === 'cancel' ? 'danger' : 'primary'} onClick={submitStatusAction} disabled={statusSubmitting}>
            {statusSubmitting ? 'Đang xử lý...' : 'Xác nhận'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}