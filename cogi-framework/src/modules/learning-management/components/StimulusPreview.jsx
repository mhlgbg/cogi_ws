import { CBadge } from '@coreui/react'
import { getFileAssetUrl, getStatusBadgeColor, getStimulusTypeLabel } from '../utils/questionBankUi'
import StimulusContent, { StimulusInstruction, getStimulusContentTypeLabel } from './StimulusContent'

export default function StimulusPreview({ stimulus, compact = false, previewMode = 'full' }) {
  if (!stimulus) {
    return <div className='small text-body-secondary'>Không dùng stimulus</div>
  }

  const audioUrl = getFileAssetUrl(stimulus.audioAsset)
  const imageUrl = getFileAssetUrl(stimulus.imageAsset)
  const metaLabel = `${stimulus.code || '-'} • ${getStimulusTypeLabel(stimulus.type)}${stimulus.content ? ` • ${getStimulusContentTypeLabel(stimulus.contentType)}` : ''}`
  const quickPreview = previewMode === 'quick'
  const summaryPreview = previewMode === 'summary'

  return (
    <div
      className={`border rounded-3 p-3 bg-body-tertiary${compact ? ' small' : ''}`}
      style={quickPreview ? { width: 'min(420px, calc(100vw - 2rem))' } : undefined}
    >
      <div className='d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2'>
        <div className='flex-grow-1' style={{ minWidth: 0 }}>
          <div className='fw-semibold text-truncate'>{stimulus.title || stimulus.code || 'Stimulus'}</div>
          <div className='text-body-secondary text-truncate'>{metaLabel}</div>
        </div>
        <CBadge color={getStatusBadgeColor(stimulus.stimulusStatus)}>{stimulus.stimulusStatus || '-'}</CBadge>
      </div>

      {summaryPreview ? (
        <div className='small text-body-secondary'>Xem nhanh để mở nội dung chi tiết.</div>
      ) : (
        <div style={quickPreview ? { maxHeight: 440, overflowY: 'auto', paddingRight: 4 } : undefined}>
          <StimulusInstruction value={stimulus.instruction} className='mb-2' />
          <StimulusContent value={stimulus.content} contentType={stimulus.contentType} className='mb-2' />
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
      )}
    </div>
  )
}
