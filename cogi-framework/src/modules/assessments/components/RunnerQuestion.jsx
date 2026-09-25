import { CBadge } from '@coreui/react'
import { getFileAssetUrl } from './assessmentUi'
import StimulusContent from '../../learning-management/components/StimulusContent'
import QuestionRenderer from './QuestionRenderer'
import StimulusRenderer from './StimulusRenderer'
import ZoomableAssessmentImage from './ZoomableAssessmentImage'

export default function RunnerQuestion({ audioPlayerRef, attemptId, item, sectionIndex, questionIndex, sectionQuestionCount, value, disabled, audioDisabled = false, answerLockedMessage = '', saveState, audioState, stimulus = null, onChange, onRegisterPlay, onMarkListenSatisfied, onSyncAudioState }) {
  if (!item) return null
  const question = item.question || {}
  const questionImageUrl = getFileAssetUrl(question?.questionImageAsset)
  const resolvedStimulus = stimulus || question?.stimulus || null
  return (
    <div className='assessment-runner-question-stack'>
      {resolvedStimulus ? (
        <StimulusRenderer
          audioPlayerRef={audioPlayerRef}
          attemptId={attemptId}
          assessmentQuestionId={item.assessmentQuestionId || item.assessmentQuestionDocumentId}
          stimulus={resolvedStimulus}
          audioState={audioState}
          disabled={audioDisabled}
          onRegisterPlay={onRegisterPlay}
          onMarkListenSatisfied={onMarkListenSatisfied}
          onSyncAudioState={onSyncAudioState}
        />
      ) : null}
      <div className='assessment-runner-question-card'>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
          <div>
            <div className='small text-body-secondary'>{`Phần ${sectionIndex + 1} · Câu ${questionIndex + 1}/${sectionQuestionCount || 0}`}</div>
            <div className='fw-semibold'>{question?.title || question?.code || 'Question'}</div>
          </div>
          <div className='d-flex gap-2 flex-wrap align-items-center'>
            {item?.required ? <CBadge color='danger'>Bắt buộc</CBadge> : <CBadge color='secondary'>Tùy chọn</CBadge>}
            <CBadge color={saveState?.status === 'saving' ? 'info' : saveState?.status === 'error' ? 'danger' : 'success'}>
              {saveState?.status === 'saving' ? 'Đang lưu...' : saveState?.status === 'error' ? 'Lỗi lưu' : 'Đã lưu'}
            </CBadge>
          </div>
        </div>
        {questionImageUrl ? (
          <div className='mb-3'>
            <ZoomableAssessmentImage src={questionImageUrl} alt={question?.questionImageAsset?.originalName || question?.title || question?.code || 'question-image'} title={question?.title || question?.code || 'Question image'} />
          </div>
        ) : null}
        <StimulusContent value={question?.questionText} contentType={question?.questionTextType} className='mb-3' />
        {answerLockedMessage ? <div className='assessment-runner-answer-lock-note'>{answerLockedMessage}</div> : null}
        <QuestionRenderer item={item} value={value} disabled={disabled} onChange={onChange} />
      </div>
    </div>
  )
}