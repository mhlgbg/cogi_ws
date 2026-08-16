import { CBadge } from '@coreui/react'
import { getExamRoundStatusMeta } from '../utils/examRoundUi'

export default function ExamRoundStatusBadge({ status }) {
  const meta = getExamRoundStatusMeta(status)
  return <CBadge color={meta.color}>{meta.label}</CBadge>
}