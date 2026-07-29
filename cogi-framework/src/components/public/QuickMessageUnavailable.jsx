import { CAlert, CButton } from '@coreui/react'

const STATUS_MESSAGES = {
  message_draft: 'Thông điệp chưa được kích hoạt.',
  message_locked: 'Thông điệp đang tạm khóa.',
  message_expired: 'Thông điệp đã hết hạn.',
  message_cancelled: 'Thông điệp đã bị hủy.',
  access_locked: 'Mã truy cập đang tạm khóa.',
  access_expired: 'Mã truy cập đã hết hạn.',
  access_cancelled: 'Mã truy cập đã bị hủy.',
  max_views_reached: 'Mã truy cập đã hết lượt xem.',
}

export default function QuickMessageUnavailable({ code = '', effectiveStatus = '', onRetry }) {
  const message = STATUS_MESSAGES[effectiveStatus] || 'Thông điệp hiện không còn khả dụng.'

  return (
    <div className='border rounded-4 p-4 bg-white shadow-sm'>
      <div className='fw-semibold fs-5 mb-2'>Không thể mở thông điệp</div>
      <div className='text-body-secondary mb-3'>Mã: {code || '-'}</div>
      <CAlert color='warning' className='mb-3'>{message}</CAlert>
      {typeof onRetry === 'function' ? <CButton color='secondary' variant='outline' onClick={onRetry}>Thử lại</CButton> : null}
    </div>
  )
}