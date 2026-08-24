import AudioStimulusPlayer from './AudioStimulusPlayer'
import { getFileAssetUrl } from './assessmentUi'

export default function StimulusRenderer({ attemptId, assessmentQuestionId, stimulus, audioState, disabled, onRegisterPlay, onSyncAudioState }) {
  if (!stimulus) return null
  const imageUrl = getFileAssetUrl(stimulus?.imageAsset)

  return (
    <div className='assessment-runner-stimulus'>
      {stimulus?.instruction ? <div className='mb-3' dangerouslySetInnerHTML={{ __html: stimulus.instruction }} /> : null}
      {stimulus?.content ? <div className='mb-3' dangerouslySetInnerHTML={{ __html: stimulus.content }} /> : null}
      {imageUrl ? <div className='mb-3'><img src={imageUrl} alt={stimulus?.title || stimulus?.code || 'stimulus-image'} /></div> : null}
      {stimulus?.audioAsset ? (
        <AudioStimulusPlayer
          attemptId={attemptId}
          assessmentQuestionId={assessmentQuestionId}
          stimulus={stimulus}
          audioState={audioState}
          disabled={disabled}
          onRegisterPlay={onRegisterPlay}
          onSyncState={onSyncAudioState}
        />
      ) : null}
    </div>
  )
}