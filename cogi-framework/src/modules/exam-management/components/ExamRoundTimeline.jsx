import { CBadge } from '@coreui/react'
import { buildExamRoundTimeline } from '../utils/examRoundUi'

export default function ExamRoundTimeline({ status }) {
  const steps = buildExamRoundTimeline(status)

  return (
    <div className='d-flex flex-wrap gap-2'>
      {steps.map((step) => {
        const color = step.state === 'current' ? 'primary' : step.state === 'completed' ? 'success' : 'light'
        const textColor = step.state === 'upcoming' ? 'text-body-secondary' : ''
        return (
          <div key={step.key} className='d-flex align-items-center gap-2'>
            <CBadge color={color}>{step.label}</CBadge>
            {textColor ? <span className={`small ${textColor}`}>{step.key}</span> : null}
          </div>
        )
      })}
    </div>
  )
}