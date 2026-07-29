import { CButton, CFormLabel, CFormTextarea } from '@coreui/react'

export default function QuickMessagePublicReplyForm({
  value,
  onChange,
  onSubmit,
  sending = false,
  disabled = false,
  error = '',
  maxLength = 5000,
}) {
  const errorId = 'quick-message-public-reply-error'
  const hintId = 'quick-message-public-reply-hint'
  const normalizedLength = String(value || '').length

  return (
    <div className='border rounded-4 p-3 bg-light'>
      <CFormLabel htmlFor='quick-message-public-reply-input'>Phản hồi thông điệp</CFormLabel>
      <CFormTextarea
        id='quick-message-public-reply-input'
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder='Nhập phản hồi hoặc câu hỏi của bạn...'
        disabled={disabled || sending}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        style={{ whiteSpace: 'pre-wrap' }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault()
            onSubmit()
          }
        }}
      />
      <div className='d-flex justify-content-between align-items-center mt-2 gap-2 flex-wrap'>
        <div>
          <div id={hintId} className='small text-body-secondary'>Nhấn Ctrl+Enter hoặc Cmd+Enter để gửi.</div>
          {error ? <div id={errorId} className='small text-danger mt-1'>{error}</div> : null}
        </div>
        <div className='d-flex align-items-center gap-3'>
          <div className='small text-body-secondary'>{normalizedLength}/{maxLength}</div>
          <CButton color='primary' onClick={onSubmit} disabled={disabled || sending || !String(value || '').trim()}>
            {sending ? 'Đang gửi phản hồi...' : 'Gửi phản hồi'}
          </CButton>
        </div>
      </div>
    </div>
  )
}