import { CBadge } from '@coreui/react'
import { getQuickMessageStatusMeta } from './quickMessageUi'

export default function QuickMessageStatusBadge({ status, effectiveStatus }) {
  const meta = getQuickMessageStatusMeta(effectiveStatus || status)
  return <CBadge color={meta.color}>{meta.label}</CBadge>
}