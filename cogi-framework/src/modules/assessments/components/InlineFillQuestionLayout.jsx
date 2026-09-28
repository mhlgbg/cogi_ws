import { Fragment, cloneElement, createElement, isValidElement, useMemo } from 'react'
import { sanitizeQuickMessageHtml } from '../../crm/components/quickMessageHtml.js'
import { INLINE_FILL_PLACEHOLDER_PATTERN, buildInlineFillPlaceholderToken, getInlineFillQuestionCode } from './inlineFillLayoutUtils'

function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

function withKey(value, key) {
  if (isValidElement(value)) return cloneElement(value, { key })
  return <Fragment key={key}>{value}</Fragment>
}

function toCamelCase(value) {
  return String(value || '').replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

function parseStyleAttribute(value) {
  return String(value || '').split(';').reduce((result, rule) => {
    const [rawName, rawValue] = rule.split(':')
    const name = String(rawName || '').trim()
    const styleValue = String(rawValue || '').trim()
    if (!name || !styleValue) return result
    result[toCamelCase(name)] = styleValue
    return result
  }, {})
}

function toReactProps(node, key) {
  const props = { key }
  if (!node?.attributes) return props
  Array.from(node.attributes).forEach((attribute) => {
    const name = String(attribute?.name || '')
    const value = String(attribute?.value || '')
    if (!name) return
    if (name === 'class') {
      props.className = value
      return
    }
    if (name === 'style') {
      props.style = parseStyleAttribute(value)
      return
    }
    if (name === 'colspan') {
      props.colSpan = value
      return
    }
    if (name === 'rowspan') {
      props.rowSpan = value
      return
    }
    props[name] = value
  })
  return props
}

function renderTextSegments(text, context, keyPrefix) {
  const source = String(text || '')
  const parts = []
  let lastIndex = 0
  let matchIndex = 0
  INLINE_FILL_PLACEHOLDER_PATTERN.lastIndex = 0
  let match = INLINE_FILL_PLACEHOLDER_PATTERN.exec(source)

  while (match) {
    const start = match.index
    const end = start + match[0].length
    const code = String(match[1] || '').trim()

    if (start > lastIndex) {
      parts.push(source.slice(lastIndex, start))
    }

    const token = buildInlineFillPlaceholderToken(code)
    const entry = context.entryByCode.get(code) || null
    const rendered = entry
      ? context.renderPlaceholder?.({ code, token, entry, index: matchIndex })
      : context.renderUnknownPlaceholder?.({ code, token, index: matchIndex })

    parts.push(rendered ?? token)
    lastIndex = end
    matchIndex += 1
    match = INLINE_FILL_PLACEHOLDER_PATTERN.exec(source)
  }

  if (lastIndex < source.length) {
    parts.push(source.slice(lastIndex))
  }

  INLINE_FILL_PLACEHOLDER_PATTERN.lastIndex = 0

  if (parts.length === 0) return ['']
  return parts.map((item, index) => typeof item === 'string' ? item : withKey(item, `${keyPrefix}-${index}`))
}

function renderDomNode(node, context, path) {
  if (!node) return null
  if (node.nodeType === Node.TEXT_NODE) {
    return renderTextSegments(node.textContent || '', context, `${path}-text`)
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const tagName = String(node.nodeName || '').toLowerCase()
  if (!tagName) return null

  const children = Array.from(node.childNodes).flatMap((child, index) => {
    const rendered = renderDomNode(child, context, `${path}-${index}`)
    return Array.isArray(rendered) ? rendered : rendered ? [rendered] : []
  })

  return createElement(tagName, toReactProps(node, path), ...children)
}

export default function InlineFillQuestionLayout({ html, entries = [], renderPlaceholder, renderUnknownPlaceholder, className = '', fallback = null }) {
  const rendered = useMemo(() => {
    const safeHtml = sanitizeQuickMessageHtml(html)
    if (!safeHtml) return null
    if (typeof DOMParser === 'undefined') return null

    const parser = new DOMParser()
    const doc = parser.parseFromString(safeHtml, 'text/html')
    const entryByCode = new Map((Array.isArray(entries) ? entries : []).map((entry) => [getInlineFillQuestionCode(entry), entry]).filter(([code]) => Boolean(code)))

    return Array.from(doc.body.childNodes).flatMap((node, index) => {
      const item = renderDomNode(node, { entryByCode, renderPlaceholder, renderUnknownPlaceholder }, `node-${index}`)
      return Array.isArray(item) ? item : item ? [item] : []
    })
  }, [entries, html, renderPlaceholder, renderUnknownPlaceholder])

  if (!rendered || rendered.length === 0) return fallback

  return <div className={joinClassNames(className, 'quick-message-html-content')}>{rendered}</div>
}