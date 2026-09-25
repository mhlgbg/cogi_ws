import AudioStimulusPlayer from './AudioStimulusPlayer'
import { getFileAssetUrl } from './assessmentUi'
import StimulusContent, { StimulusInstruction } from '../../learning-management/components/StimulusContent'
import ZoomableAssessmentImage from './ZoomableAssessmentImage'

export default function StimulusRenderer({ audioPlayerRef, attemptId, assessmentQuestionId, stimulus, audioState, disabled, onRegisterPlay, onMarkListenSatisfied, onSyncAudioState }) {
  if (!stimulus) return null
  const imageUrl = getFileAssetUrl(stimulus?.imageAsset)

  return (
    <div className='assessment-runner-stimulus'>
      <StimulusInstruction value={stimulus?.instruction} className='mb-3' />
      <StimulusContent value={stimulus?.content} contentType={stimulus?.contentType} className='mb-3' />
      {imageUrl ? (
        <div className='mb-3'>
          <ZoomableAssessmentImage src={imageUrl} alt={stimulus?.imageAsset?.originalName || stimulus?.title || stimulus?.code || 'stimulus-image'} title={stimulus?.title || stimulus?.code || 'Stimulus image'} />
        </div>
      ) : null}
      {stimulus?.audioAsset ? (
        <AudioStimulusPlayer
          ref={audioPlayerRef}
          attemptId={attemptId}
          assessmentQuestionId={assessmentQuestionId}
          stimulus={stimulus}
          audioState={audioState}
          disabled={disabled}
          onRegisterPlay={onRegisterPlay}
          onMarkListenSatisfied={onMarkListenSatisfied}
          onSyncState={onSyncAudioState}
        />
      ) : null}
    </div>
  )
}