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
  return wrapTablesForResponsiveScroll(sanitizeQuickMessageHtml(value))
}

export function getRenderedStimulusInstructionHtml(value) {
  return wrapTablesForResponsiveScroll(sanitizeQuickMessageHtml(value))
}

function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

function wrapTablesForResponsiveScroll(html) {
  const source = String(html || '').trim()
  if (!source || typeof DOMParser === 'undefined') return source

  const parser = new DOMParser()
  const doc = parser.parseFromString(source, 'text/html')
  const tables = Array.from(doc.body.querySelectorAll('table'))
  if (tables.length === 0) return source

  tables.forEach((table) => {
    const parent = table.parentElement
    if (parent?.classList?.contains('cogi-question-table-scroll')) return
    const wrapper = doc.createElement('div')
    wrapper.className = 'cogi-question-table-scroll'
    parent?.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })

  return doc.body.innerHTML
}

export function StimulusInstruction({ value, className = '' }) {
  const renderedHtml = getRenderedStimulusInstructionHtml(value)
  if (!renderedHtml) return null

  return (
    <div
      className={joinClassNames(className, 'quick-message-html-content', 'cogi-question-content')}
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
        className={joinClassNames(className, 'quick-message-html-content', 'cogi-question-content')}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    )
  }

  const text = String(value || '').trim()
  if (!text) return null

  return <div className={joinClassNames(className, 'quick-message-text-content', 'cogi-question-content')} style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
}