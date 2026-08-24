import { getFileAssetUrl, getStimulusTypeLabel } from '../utils/questionBankUi'

export default function StimulusPreview({ stimulus, compact = false }) {
  if (!stimulus) {
    return <div className='small text-body-secondary'>Không dùng stimulus</div>
  }

  const audioUrl = getFileAssetUrl(stimulus.audioAsset)
  const imageUrl = getFileAssetUrl(stimulus.imageAsset)

  return (
    <div className={`border rounded-3 p-3 bg-body-tertiary${compact ? ' small' : ''}`}>
      <div className='d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2'>
        <div>
          <div className='fw-semibold'>{stimulus.title || stimulus.code || 'Stimulus'}</div>
          <div className='text-body-secondary'>{`${stimulus.code || '-'} • ${getStimulusTypeLabel(stimulus.type)}`}</div>
        </div>
        <div className='text-body-secondary'>{stimulus.stimulusStatus || '-'}</div>
      </div>
      {stimulus.instruction ? <div className='mb-2' dangerouslySetInnerHTML={{ __html: stimulus.instruction }} /> : null}
      {stimulus.content ? <div className='mb-2' dangerouslySetInnerHTML={{ __html: stimulus.content }} /> : null}
      {audioUrl ? (
        <div className='mb-2'>
          <audio controls preload='none' src={audioUrl} style={{ width: '100%' }} />
          <div className='small text-body-secondary mt-1'>{stimulus.audioAsset?.originalName || stimulus.audioAsset?.fileName || 'Tệp âm thanh'}</div>
        </div>
      ) : null}
      {imageUrl ? (
        <div>
          <img src={imageUrl} alt={stimulus.imageAsset?.originalName || stimulus.title || 'hình stimulus'} style={{ width: '100%', maxHeight: compact ? 160 : 260, objectFit: 'contain', borderRadius: 12 }} />
          <div className='small text-body-secondary mt-1'>{stimulus.imageAsset?.originalName || stimulus.imageAsset?.fileName || 'Tệp hình ảnh'}</div>
        </div>
      ) : null}
    </div>
  )
}
