import { CButton } from '@coreui/react'
import { resolveMediaUrl } from '../../utils/mediaUrl'

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getHostname(url) {
  try {
    return new URL(String(url || '')).hostname || ''
  } catch {
    return ''
  }
}

export default function QuickMessageContent({ data, code = '', onCopyCode }) {
  const message = data?.message || {}
  const access = data?.access || {}
  const tenant = data?.tenant || {}
  const links = Array.isArray(message?.links) ? message.links : []

  return (
    <div className='border rounded-4 p-4 bg-white shadow-sm'>
      {access?.recipientName ? <div className='small text-body-secondary mb-2'>Xin chào {access.recipientName}</div> : null}
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
        <div>
          <h1 className='h3 mb-2'>{message?.title || 'Thông điệp'}</h1>
          <div className='text-body-secondary'>Thông điệp từ {message?.senderDisplayName || tenant?.name || 'COGI'}</div>
        </div>
        <div className='text-md-end'>
          <div className='small text-body-secondary'>Mã truy cập: {code || '-'}</div>
          <CButton color='secondary' variant='outline' size='sm' className='mt-2' onClick={onCopyCode}>Sao chép mã</CButton>
        </div>
      </div>

      {message?.expiresAt ? <div className='small text-body-secondary mb-3'>Thông điệp có hiệu lực đến {formatDateTime(message.expiresAt)}.</div> : null}

      <div className='mb-4' style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{message?.content || '-'}</div>

      {links.length > 0 ? (
        <div className='d-flex flex-column gap-3'>
          {links.map((item, index) => {
            const url = resolveMediaUrl(item?.url || '')
            const hostname = getHostname(url)
            const label = item?.label || hostname || `Đường link ${index + 1}`
            return (
              <a
                key={`quick-message-public-link-${index}`}
                href={url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-decoration-none border rounded-4 p-3 d-block'
              >
                <div className='fw-semibold text-body'>{label}</div>
                {hostname ? <div className='small text-body-secondary mt-1'>{hostname}</div> : null}
              </a>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}