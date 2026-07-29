import { CAlert, CSpinner } from '@coreui/react'
import QuickMessagePublicMessageBubble from './QuickMessagePublicMessageBubble'

export default function QuickMessagePublicMessageList({ loading = false, messages = [] }) {
  if (loading) {
    return (
      <div className='d-flex align-items-center gap-2 py-3'>
        <CSpinner size='sm' />
        <span>Đang tải trao đổi...</span>
      </div>
    )
  }

  if (!messages.length) {
    return (
      <CAlert color='light' className='mb-0'>
        Bạn có thể gửi phản hồi hoặc câu hỏi về thông điệp này.
      </CAlert>
    )
  }

  return (
    <div>
      {messages.map((message) => (
        <QuickMessagePublicMessageBubble key={`${message?.source || 'message'}-${message?.id || message?.createdAt}`} message={message} />
      ))}
    </div>
  )
}