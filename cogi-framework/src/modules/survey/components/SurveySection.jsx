import { CCard, CCardBody, CCardHeader } from '@coreui/react'
import SurveyQuestion from './SurveyQuestion'

export default function SurveySection({
  section,
  baseIndex = 0,
  answers,
  invalidQuestionIds,
  disabled = false,
  onAnswerChange,
}) {
  return (
    <CCard className='mb-4 shadow-sm border-0'>
      <CCardHeader className='bg-white border-bottom-0 pt-4'>
        <div className='fw-bold fs-5'>{section.title}</div>
      </CCardHeader>
      <CCardBody>
        {(section.questions || []).map((question, questionIndex) => (
          <SurveyQuestion
            key={question.id}
            question={question}
            index={baseIndex + questionIndex + 1}
            answer={answers[question.id] || { value: '', text: '' }}
            invalid={invalidQuestionIds.has(question.id)}
            disabled={disabled}
            onChange={onAnswerChange}
          />
        ))}
      </CCardBody>
    </CCard>
  )
}