import { Fragment } from 'react'
import 'katex/dist/katex.min.css'
import { parseMathDelimitedText, renderMathExpressionToHtml } from './mathRendering'

const SKIPPED_TEXT_PROCESSING_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE'])

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function appendMathSegmentsToFragment(documentRef, fragment, sourceText) {
  const segments = parseMathDelimitedText(sourceText)
  if (segments.length === 0) {
    fragment.appendChild(documentRef.createTextNode(sourceText))
    return false
  }

  let hasMath = false

  segments.forEach((segment) => {
    if (segment.type === 'text') {
      fragment.appendChild(documentRef.createTextNode(segment.value))
      return
    }

    const renderedHtml = renderMathExpressionToHtml(segment.value, { displayMode: segment.displayMode })
    if (!renderedHtml) {
      fragment.appendChild(documentRef.createTextNode(segment.raw || segment.value))
      return
    }

    const container = documentRef.createElement('span')
    container.innerHTML = renderedHtml
    while (container.firstChild) {
      fragment.appendChild(container.firstChild)
    }
    hasMath = true
  })

  return hasMath
}

function renderMathInsideHtmlTextNodes(safeHtml) {
  const source = toText(safeHtml)
  if (!source.trim()) return ''
  if (typeof window === 'undefined' || !window.document) return source

  const template = window.document.createElement('template')
  template.innerHTML = source
  const root = template.content
  let hasAnyMath = false

  function traverse(node) {
    if (!node) return

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue || ''
      if (!text) return
      const replacement = window.document.createDocumentFragment()
      const hasMath = appendMathSegmentsToFragment(window.document, replacement, text)
      if (!hasMath) return
      node.replaceWith(replacement)
      hasAnyMath = true
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    if (SKIPPED_TEXT_PROCESSING_TAGS.has(node.nodeName)) return

    Array.from(node.childNodes).forEach((child) => traverse(child))
  }

  Array.from(root.childNodes).forEach((child) => traverse(child))
  return hasAnyMath ? template.innerHTML : source
}

export default function MathContentRenderer({
  value,
  contentType = 'plain_text',
  sanitizeHtml,
  className = '',
  emptyFallback = null,
  wrapperTag = 'div',
}) {
  const textValue = toText(value)
  if (!textValue.trim()) return emptyFallback

  const normalizedType = String(contentType || '').trim().toLowerCase() === 'html' ? 'html' : 'plain_text'

  if (normalizedType === 'html') {
    const safeHtml = sanitizeHtml ? sanitizeHtml(textValue) : textValue
    const renderedHtml = renderMathInsideHtmlTextNodes(safeHtml)
    if (!toText(renderedHtml).trim()) return emptyFallback

    const WrapperTag = wrapperTag
    return <WrapperTag className={className} dangerouslySetInnerHTML={{ __html: renderedHtml }} />
  }

  const segments = parseMathDelimitedText(textValue)
  if (segments.length === 0) return emptyFallback

  const WrapperTag = wrapperTag
  return (
    <WrapperTag className={className} style={{ whiteSpace: 'pre-wrap' }}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <Fragment key={`text-${index}`}>{segment.value}</Fragment>
        }

        const renderedHtml = renderMathExpressionToHtml(segment.value, { displayMode: segment.displayMode })
        if (!renderedHtml) {
          return <Fragment key={`raw-${index}`}>{segment.raw || segment.value}</Fragment>
        }

        return (
          <span
            key={`math-${index}`}
            style={segment.displayMode ? { display: 'block', margin: '0.25rem 0' } : undefined}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )
      })}
    </WrapperTag>
  )
}
