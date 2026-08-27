import { CBadge, CButton } from '@coreui/react'
import RunnerTimer from './RunnerTimer'
import { formatDateTime, getAttemptStatusLabel } from './assessmentUi'

export default function RunnerHeader({ attempt, version, progress, remainingSeconds, expired, readOnlyMode = false, submittedAt = null, onOpenSubmit, onBack }) {
  const status = String(attempt?.status || '').trim()
  const submitted = status === 'submitted'
  const testMode = String(attempt?.sourceType || '').trim() === 'admin_test'
  return (
    <div className='assessment-runner-header'>
      <div>
        <div className='d-flex gap-2 flex-wrap mb-2'>
          <CButton color='secondary' variant='outline' size='sm' onClick={onBack}>{testMode ? 'Về phiên bản' : 'Về danh sách đề'}</CButton>
          <CBadge color='secondary'>{attempt?.code || '-'}</CBadge>
          <CBadge color={submitted ? 'success' : status === 'expired' ? 'danger' : status === 'cancelled' ? 'secondary' : 'info'}>{getAttemptStatusLabel(status)}</CBadge>
          {testMode ? <CBadge color='warning'>CHẾ ĐỘ LÀM THỬ</CBadge> : null}
        </div>
        <div className='fs-4 fw-semibold'>{version?.title || version?.code || 'Assessment Runner'}</div>
        <div className='assessment-runner-meta'>
          <span>{version?.code || '-'}</span>
          <span>{`${progress?.answeredCount || 0}/${progress?.totalQuestions || 0} câu đã trả lời`}</span>
          {attempt?.candidateNameSnapshot ? <span>{attempt.candidateNameSnapshot}</span> : null}
          {submittedAt ? <span>{`Nộp lúc: ${formatDateTime(submittedAt)}`}</span> : null}
          {readOnlyMode && submitted ? <span>Xem lại bài đã nộp</span> : null}
        </div>
      </div>
      <div className='d-flex gap-2 flex-wrap align-items-center'>
        {!submitted ? <RunnerTimer remainingSeconds={remainingSeconds} expired={expired} /> : null}
        {!readOnlyMode ? <CButton color='primary' onClick={onOpenSubmit} disabled={expired}>Nộp bài</CButton> : null}
      </div>
    </div>
  )
}