import { CBadge } from '@coreui/react'

function formatRemaining(seconds) {
  const safe = Math.max(0, Number(seconds || 0))
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0')
  const secs = String(safe % 60).padStart(2, '0')
  return `${minutes}:${secs}`
}

export default function RunnerTimer({ remainingSeconds, expired = false }) {
  const safe = Math.max(0, Number(remainingSeconds || 0))
  const warning = safe <= 300 && safe > 60
  const danger = safe <= 60 || expired
  return (
    <div className={`assessment-runner-timer${warning ? ' is-warning' : ''}${danger ? ' is-danger' : ''}`}>
      <span>{formatRemaining(safe)}</span>
      {warning ? <CBadge color='warning'>Còn ít thời gian</CBadge> : null}
      {danger && !expired ? <CBadge color='danger'>Sắp hết giờ</CBadge> : null}
      {expired ? <CBadge color='danger'>Đã hết giờ</CBadge> : null}
    </div>
  )
}