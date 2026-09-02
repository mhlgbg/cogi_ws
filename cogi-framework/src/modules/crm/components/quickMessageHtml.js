const ALLOWED_TAGS = new Set([
  'p', 'br',
  'strong', 'b', 'em', 'i', 'u', 's',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'div', 'span', 'section',
  'blockquote', 'hr',
  'a',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'small', 'sup', 'sub',
])

const DROP_WITH_CONTENT_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option',
  'link', 'meta', 'base', 'frame', 'frameset', 'canvas', 'svg', 'math', 'head', 'title',
])

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const COLOR_VALUE = /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\(\s*[\d.%\s,/-]+\)|[a-z]+)$/i
const LENGTH_VALUE = /^(?:0|(?:-?\d+(?:\.\d+)?)(?:px|r?em|%|vh|vw|vmin|vmax|pt))$/i
const BOX_SPACING_PART = '(?:0|(?:-?\\d+(?:\\.\\d+)?)(?:px|r?em|%|vh|vw|vmin|vmax|pt))'
const BOX_SPACING_VALUE = new RegExp(`^${BOX_SPACING_PART}(?:\\s+${BOX_SPACING_PART}){0,3}$`, 'i')
const BORDER_STYLE_VALUE = /^(?:none|solid|dashed|dotted|double)$/i
const BORDER_WIDTH_PART = '(?:0|thin|medium|thick|(?:\\d+(?:\\.\\d+)?)(?:px|r?em|pt))'
const BORDER_WIDTH_VALUE = new RegExp(`^${BORDER_WIDTH_PART}$`, 'i')
const BORDER_RADIUS_VALUE = new RegExp(`^${BOX_SPACING_PART}(?:\\s+${BOX_SPACING_PART}){0,3}$`, 'i')
const BORDER_STYLE_PART = '(?:none|solid|dashed|dotted|double)'
const COLOR_PART = '(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\\(\\s*[\\d.%\\s,/-]+\\)|[a-z]+)'
const SAFE_BORDER_VALUE = new RegExp(`^${BORDER_WIDTH_PART}\\s+${BORDER_STYLE_PART}(?:\\s+${COLOR_PART})?$`, 'i')
const PERCENT_OR_LENGTH_VALUE = /^(?:auto|0|100%|[1-9]\d?%|(?:\d+(?:\.\d+)?)(?:px|r?em|vw|vh|vmin|vmax))$/i
const SAFE_CLASS_NAME = /^[a-z0-9_-]+$/i

const ALLOWED_STYLE_RULES = {
  color: [COLOR_VALUE],
  background: [COLOR_VALUE],
  'background-color': [COLOR_VALUE],
  padding: [BOX_SPACING_VALUE],
  'padding-top': [LENGTH_VALUE],
  'padding-right': [LENGTH_VALUE],
  'padding-bottom': [LENGTH_VALUE],
  'padding-left': [LENGTH_VALUE],
  margin: [BOX_SPACING_VALUE, /^(?:0\s+auto|auto\s+0)$/i],
  'margin-top': [LENGTH_VALUE],
  'margin-right': [LENGTH_VALUE, /^auto$/i],
  'margin-bottom': [LENGTH_VALUE],
  'margin-left': [LENGTH_VALUE, /^auto$/i],
  border: [SAFE_BORDER_VALUE],
  'border-top': [SAFE_BORDER_VALUE],
  'border-right': [SAFE_BORDER_VALUE],
  'border-bottom': [SAFE_BORDER_VALUE],
  'border-left': [SAFE_BORDER_VALUE],
  'border-color': [COLOR_VALUE],
  'border-top-color': [COLOR_VALUE],
  'border-right-color': [COLOR_VALUE],
  'border-bottom-color': [COLOR_VALUE],
  'border-left-color': [COLOR_VALUE],
  'border-width': [BOX_SPACING_VALUE],
  'border-top-width': [BORDER_WIDTH_VALUE],
  'border-right-width': [BORDER_WIDTH_VALUE],
  'border-bottom-width': [BORDER_WIDTH_VALUE],
  'border-left-width': [BORDER_WIDTH_VALUE],
  'border-style': [/^(?:none|solid|dashed|dotted|double)(?:\s+(?:none|solid|dashed|dotted|double)){0,3}$/i],
  'border-radius': [BORDER_RADIUS_VALUE],
  'font-size': [LENGTH_VALUE],
  'font-weight': [/^(?:normal|bold|bolder|lighter|[1-9]00|700)$/i],
  'font-style': [/^(?:normal|italic|oblique)$/i],
  'font-family': [/^[a-z0-9\s,'"-]+$/i],
  'line-height': [/^(?:normal|0|(?:\d+(?:\.\d+)?)(?:px|r?em|%|vh|vw)?|[1-9]\d?%)$/i],
  'letter-spacing': [/^(?:normal|0|(?:-?\d+(?:\.\d+)?)(?:px|r?em|pt))$/i],
  'text-align': [/^(?:left|right|center|justify)$/i],
  'text-decoration': [/^(?:none|underline|line-through|overline)$/i],
  'white-space': [/^(?:normal|nowrap|pre|pre-wrap|pre-line)$/i],
  display: [/^(?:block|inline|inline-block|flex|grid|table|table-row|table-cell|none)$/i],
  width: [PERCENT_OR_LENGTH_VALUE],
  'max-width': [PERCENT_OR_LENGTH_VALUE],
  'min-width': [/^(?:0|100%|[1-9]\d?%|(?:\d+(?:\.\d+)?)(?:px|r?em|vw|vh|vmin|vmax))$/i],
  height: [PERCENT_OR_LENGTH_VALUE],
  'max-height': [PERCENT_OR_LENGTH_VALUE],
  'min-height': [/^(?:0|100%|[1-9]\d?%|(?:\d+(?:\.\d+)?)(?:px|r?em|vw|vh|vmin|vmax))$/i],
  overflow: [/^(?:visible|hidden|auto)$/i],
  'overflow-x': [/^(?:visible|hidden|auto)$/i],
  'overflow-y': [/^(?:visible|hidden|auto)$/i],
  'vertical-align': [/^(?:top|middle|bottom|baseline)$/i],
  'table-layout': [/^(?:auto|fixed)$/i],
  'border-collapse': [/^(?:collapse|separate)$/i],
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function extractQuickMessageHtmlFragment(value) {
  const source = toText(value).trim()
  if (!source) return ''

  const withoutDoctype = source.replace(/<!DOCTYPE[^>]*>/gi, '').trim()

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(withoutDoctype, 'text/html')
    const bodyHtml = doc?.body?.innerHTML
    return String(bodyHtml || withoutDoctype).trim()
  }

  const bodyMatch = withoutDoctype.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  return bodyMatch?.[1]?.trim() || withoutDoctype
}

export function sanitizeQuickMessageHtml(value) {
  const fragment = extractQuickMessageHtmlFragment(value)
  if (!fragment) return ''

  if (typeof DOMParser === 'undefined' || typeof document === 'undefined') {
    return fragment
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<head[\s\S]*?>[\s\S]*?<\/head>/gi, '')
      .replace(/<title[\s\S]*?>[\s\S]*?<\/title>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\shref\s*=\s*(['"])(javascript:|data:|vbscript:|file:).*?\1/gi, '')
      .replace(/\sclass\s*=\s*(['"])(.*?)\1/gi, (_, quote, value) => {
        const className = sanitizeClassName(value)
        return className ? ` class=${quote}${className}${quote}` : ''
      })
      .replace(/\sstyle\s*=\s*(['"])(.*?)\1/gi, (_, quote, value) => {
        const style = sanitizeStyleAttribute(value)
        return style ? ` style=${quote}${style}${quote}` : ''
      })
      .trim()
  }

  const parser = new DOMParser()
  const sourceDoc = parser.parseFromString(fragment, 'text/html')
  const outputDoc = document.implementation.createHTMLDocument('quick-message-sanitized')
  const container = outputDoc.createElement('div')

  Array.from(sourceDoc.body.childNodes).forEach((node) => {
    const sanitized = sanitizeNode(node, outputDoc)
    if (sanitized) container.appendChild(sanitized)
  })

  return container.innerHTML.trim()
}

function sanitizeNode(node, outputDoc) {
  if (!node) return null
  if (node.nodeType === Node.TEXT_NODE) {
    return outputDoc.createTextNode(node.textContent || '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const tagName = String(node.nodeName || '').toLowerCase()
  if (!tagName) return null
  if (DROP_WITH_CONTENT_TAGS.has(tagName)) return null

  const sanitizedChildren = Array.from(node.childNodes)
    .map((child) => sanitizeNode(child, outputDoc))
    .filter(Boolean)

  if (!ALLOWED_TAGS.has(tagName)) {
    if (sanitizedChildren.length === 0) return null
    const fragment = outputDoc.createDocumentFragment()
    sanitizedChildren.forEach((child) => fragment.appendChild(child))
    return fragment
  }

  const element = outputDoc.createElement(tagName)
  const className = sanitizeClassName(node.getAttribute('class'))
  const style = sanitizeStyleAttribute(node.getAttribute('style'))

  if (className) element.setAttribute('class', className)
  if (style) element.setAttribute('style', style)

  if (tagName === 'a') {
    const href = sanitizeAnchorHref(node.getAttribute('href'))
    const title = toText(node.getAttribute('title')).trim()
    if (href) {
      element.setAttribute('href', href)
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noopener noreferrer')
    }
    if (title) element.setAttribute('title', title)
  }

  if (tagName === 'th' || tagName === 'td') {
    const colspan = sanitizePositiveSpan(node.getAttribute('colspan'))
    const rowspan = sanitizePositiveSpan(node.getAttribute('rowspan'))
    if (colspan) element.setAttribute('colspan', colspan)
    if (rowspan) element.setAttribute('rowspan', rowspan)
  }

  sanitizedChildren.forEach((child) => element.appendChild(child))
  return element
}

function sanitizePositiveSpan(value) {
  const parsed = Number(String(value || '').trim())
  if (!Number.isInteger(parsed) || parsed <= 0) return ''
  return String(parsed)
}

function sanitizeAnchorHref(value) {
  const href = toText(value).trim()
  if (!href) return ''
  try {
    const url = new URL(href, 'https://quick-message.local')
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return ''
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString()
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') return href
    return ''
  } catch {
    return ''
  }
}

function sanitizeClassName(value) {
  const classNames = toText(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item && SAFE_CLASS_NAME.test(item))

  return classNames.join(' ')
}

function sanitizeStyleAttribute(value) {
  const source = toText(value)
  if (!source) return ''

  const declarations = source
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)

  const sanitized = []
  for (const declaration of declarations) {
    const separatorIndex = declaration.indexOf(':')
    if (separatorIndex <= 0) continue

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
    const rawValue = declaration.slice(separatorIndex + 1).trim()
    if (!property || !rawValue) continue
    if (/[\\<>{}`]/.test(rawValue)) continue
    if (/(?:expression|javascript:|vbscript:|data:|url\s*\()/i.test(rawValue)) continue

    const rules = ALLOWED_STYLE_RULES[property]
    if (!rules || !rules.some((rule) => rule.test(rawValue))) continue

    sanitized.push(`${property}:${rawValue}`)
  }

  return sanitized.join(';')
}