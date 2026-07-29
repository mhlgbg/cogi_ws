export default function QuickMessagePublicMessageBubble({ message }) {
  const isOutgoing = message?.direction === 'outgoing'

  return (
    <div className={`d-flex mb-3 ${isOutgoing ? 'justify-content-end' : 'justify-content-start'}`}>
      <div
        className={`rounded-4 px-3 py-2 ${isOutgoing ? 'bg-primary text-white' : 'bg-light text-body'}`}
        style={{ maxWidth: '85%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      >
        <div className={`small fw-semibold mb-1 ${isOutgoing ? 'text-white' : 'text-body'}`}>
          {message?.senderDisplayName || (isOutgoing ? 'Bạn' : 'Trung tâm')}
        </div>
        <div>{message?.content || ''}</div>
        <div className={`small mt-2 ${isOutgoing ? 'text-white-50' : 'text-body-secondary'}`}>
          {message?.createdAtLabel || '-'}
        </div>
      </div>
    </div>
  )
}