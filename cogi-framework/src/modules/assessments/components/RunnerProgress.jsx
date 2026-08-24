import { CProgress, CProgressBar } from '@coreui/react'

export default function RunnerProgress({ answeredCount = 0, totalQuestions = 0 }) {
  const safeTotal = Math.max(0, Number(totalQuestions || 0))
  const safeAnswered = Math.max(0, Number(answeredCount || 0))
  const percent = safeTotal > 0 ? Math.round((safeAnswered / safeTotal) * 100) : 0

  return (
    <div className='assessment-runner-stimulus'>
      <div className='d-flex justify-content-between align-items-center gap-2 mb-2 flex-wrap'>
        <strong>Tiến độ</strong>
        <span className='small text-body-secondary'>{`Đã trả lời ${safeAnswered}/${safeTotal}`}</span>
      </div>
      <CProgress>
        <CProgressBar value={percent}>{`${percent}%`}</CProgressBar>
      </CProgress>
    </div>
  )
}