import { CBadge } from '@coreui/react'
import QuestionRenderer from './QuestionRenderer'
import StimulusRenderer from './StimulusRenderer'

export default function RunnerQuestion({ attemptId, item, sectionIndex, questionIndex, totalQuestions, value, disabled, saveState, audioState, onChange, onRegisterPlay, onSyncAudioState }) {
  if (!item) return null
  const question = item.question || {}
  return (
    <div className='assessment-runner-question-stack'>
      {question?.stimulus ? (
        <StimulusRenderer
          attemptId={attemptId}
          assessmentQuestionId={item.assessmentQuestionId || item.assessmentQuestionDocumentId}
          stimulus={question.stimulus}
          audioState={audioState}
          disabled={disabled}
          onRegisterPlay={onRegisterPlay}
          onSyncAudioState={onSyncAudioState}
        />
      ) : null}
      <div className='assessment-runner-question-card'>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
          <div>
            <div className='small text-body-secondary'>{`Phần ${sectionIndex + 1} · Câu ${questionIndex + 1}/${totalQuestions}`}</div>
            <div className='fw-semibold'>{question?.title || question?.code || 'Question'}</div>
          </div>
          <div className='d-flex gap-2 flex-wrap align-items-center'>
            {item?.required ? <CBadge color='danger'>Bắt buộc</CBadge> : <CBadge color='secondary'>Tùy chọn</CBadge>}
            <CBadge color={saveState?.status === 'saving' ? 'info' : saveState?.status === 'error' ? 'danger' : 'success'}>
              {saveState?.status === 'saving' ? 'Đang lưu...' : saveState?.status === 'error' ? 'Lỗi lưu' : 'Đã lưu'}
            </CBadge>
          </div>
        </div>
        <div className='mb-3' dangerouslySetInnerHTML={{ __html: question?.questionText || '' }} />
        <QuestionRenderer item={item} value={value} disabled={disabled} onChange={onChange} />
      </div>
    </div>
  )
}