import { sanitizeQuickMessageHtml } from '../../crm/components/quickMessageHtml'

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function escapeHtml(value) {
  return toText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function isLikelyHtmlContent(value) {
  const source = toText(value).trim()
  if (!source) return false
  return HTML_TAG_PATTERN.test(source)
}

export function normalizeClassSessionContentForEditor(value) {
  const source = toText(value).trim()
  if (!source) return '<p></p>'
  if (isLikelyHtmlContent(source)) return source

  const normalizedLineBreaks = source.replace(/\r\n/g, '\n')
  const paragraphs = normalizedLineBreaks
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)

  return paragraphs.join('') || '<p></p>'
}

export function sanitizeClassSessionContentHtml(value) {
  return sanitizeQuickMessageHtml(normalizeClassSessionContentForEditor(value))
}

export function stripClassSessionContentText(value) {
  const sanitized = sanitizeClassSessionContentHtml(value)
  if (!sanitized) return ''

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(sanitized, 'text/html')
    return String(doc?.body?.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return sanitized
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hasClassSessionContent(value) {
  return stripClassSessionContentText(value).length > 0
}

export function getClassSessionContentPreview(value, maxLength = 200) {
  const text = stripClassSessionContentText(value)
  if (!text) return 'Chưa có nội dung'
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}...`
}