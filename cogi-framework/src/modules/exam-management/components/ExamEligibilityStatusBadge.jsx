import { CBadge } from '@coreui/react'
import { getEligibilityStatusMeta } from '../utils/examEligibilityUi'

export default function ExamEligibilityStatusBadge({ status }) {
  const meta = getEligibilityStatusMeta(status)
  return <CBadge color={meta.color}>{meta.label}</CBadge>
}