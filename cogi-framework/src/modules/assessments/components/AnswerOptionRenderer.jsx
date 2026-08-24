import { getFileAssetUrl } from './assessmentUi'

export default function AnswerOptionRenderer({ option, selected, onSelect, disabled, multiSelect = false }) {
  const imageUrl = getFileAssetUrl(option?.imageAsset)

  function handleSelect(event) {
    event.preventDefault()
    event.stopPropagation()
    if (disabled) return
    onSelect?.()
  }

  return (
    <button
      type='button'
      className={`assessment-runner-option-card${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') handleSelect(event)
      }}
      disabled={disabled}
      aria-pressed={selected}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <span className='assessment-runner-option-marker'>{option?.label || ''}</span>
      <span className='flex-grow-1 text-start'>
        {option?.content ? <span className='d-block mb-2' dangerouslySetInnerHTML={{ __html: option.content }} /> : null}
        {!option?.content && option?.value ? <span>{option.value}</span> : null}
        {imageUrl ? <img className='assessment-runner-option-image mt-2' src={imageUrl} alt={option?.label || 'option-image'} /> : null}
        {multiSelect ? <span className='d-block small text-body-secondary mt-2'>Có thể chọn nhiều đáp án</span> : null}
      </span>
    </button>
  )
}