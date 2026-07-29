import { CAlert } from '@coreui/react'
import { resolveMediaUrl } from '../../utils/mediaUrl'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeColor(value) {
  const color = toText(value)
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : ''
}

export default function QuickMessageTenantHeader({ tenant = null, message = '' }) {
  const tenantName = toText(tenant?.name) || 'COGI'
  const logoUrl = resolveMediaUrl(tenant?.logo || '')
  const primaryColor = normalizeColor(tenant?.primaryColor)

  return (
    <div className='border rounded-4 p-4 bg-white shadow-sm'>
      <div className='d-flex align-items-center gap-3 flex-wrap'>
        {logoUrl ? (
          <img src={logoUrl} alt={tenantName} style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 12 }} />
        ) : (
          <div
            className='d-flex align-items-center justify-content-center rounded-3 text-white fw-semibold'
            style={{ width: 56, height: 56, background: primaryColor || '#0d6efd' }}
          >
            {tenantName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <div className='small text-body-secondary'>Chuyển nhanh</div>
          <div className='fw-semibold fs-5'>{tenantName}</div>
          {message ? <div className='small text-body-secondary mt-1'>{message}</div> : null}
        </div>
      </div>
      {!logoUrl && !primaryColor ? <CAlert color='light' className='mt-3 mb-0'>Thông tin nhận diện tenant đang ở chế độ tối giản.</CAlert> : null}
    </div>
  )
}