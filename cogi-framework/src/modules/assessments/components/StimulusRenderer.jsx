import AudioStimulusPlayer from './AudioStimulusPlayer'
import { getFileAssetUrl } from './assessmentUi'

export default function StimulusRenderer({ audioPlayerRef, attemptId, assessmentQuestionId, stimulus, audioState, disabled, onRegisterPlay, onMarkListenSatisfied, onSyncAudioState }) {
  if (!stimulus) return null
  const imageUrl = getFileAssetUrl(stimulus?.imageAsset)

  return (
    <div className='assessment-runner-stimulus'>
      {stimulus?.instruction ? <div className='mb-3' dangerouslySetInnerHTML={{ __html: stimulus.instruction }} /> : null}
      {stimulus?.content ? <div className='mb-3' dangerouslySetInnerHTML={{ __html: stimulus.content }} /> : null}
      {imageUrl ? <div className='mb-3'><img src={imageUrl} alt={stimulus?.title || stimulus?.code || 'stimulus-image'} /></div> : null}
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