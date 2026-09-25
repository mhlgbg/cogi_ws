import { sanitizeQuickMessageHtml } from '../../crm/components/quickMessageHtml.js'

export const STIMULUS_CONTENT_TYPE_OPTIONS = [
  { value: 'plain_text', label: 'Văn bản thuần' },
  { value: 'html', label: 'HTML' },
]

export function normalizeStimulusContentType(value) {
  return String(value || '').trim().toLowerCase() === 'html' ? 'html' : 'plain_text'
}

export function getStimulusContentTypeLabel(value) {
  return STIMULUS_CONTENT_TYPE_OPTIONS.find((item) => item.value === normalizeStimulusContentType(value))?.label || 'Văn bản thuần'
}

export function getRenderedStimulusHtml(value, contentType) {
  if (normalizeStimulusContentType(contentType) !== 'html') return ''
  return sanitizeQuickMessageHtml(value)
}

export function getRenderedStimulusInstructionHtml(value) {
  return sanitizeQuickMessageHtml(value)
}

function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

export function StimulusInstruction({ value, className = '' }) {
  const renderedHtml = getRenderedStimulusInstructionHtml(value)
  if (!renderedHtml) return null

  return (
    <div
      className={joinClassNames(className, 'quick-message-html-content')}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  )
}

export default function StimulusContent({ value, contentType, className = '' }) {
  const normalizedType = normalizeStimulusContentType(contentType)

  if (normalizedType === 'html') {
    const renderedHtml = getRenderedStimulusHtml(value, normalizedType)
    if (!renderedHtml) return null

    return (
      <div
        className={joinClassNames(className, 'quick-message-html-content')}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    )
  }

  const text = String(value || '').trim()
  if (!text) return null

  return <div className={joinClassNames(className, 'quick-message-text-content')} style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
}