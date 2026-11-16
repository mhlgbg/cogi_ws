const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S',
  'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI',
  'DIV', 'SPAN', 'BLOCKQUOTE', 'HR',
  'A',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD',
  'SMALL', 'SUP', 'SUB',
])

const DROP_TAGS = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'META', 'LINK'])
const URL_PROTOCOL_ALLOWLIST = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const GLOBAL_ALLOWED_ATTRS = new Set(['class', 'style'])
const TAG_ALLOWED_ATTRS = {
  A: new Set(['href', 'title', 'target', 'rel']),
  TH: new Set(['colspan', 'rowspan']),
  TD: new Set(['colspan', 'rowspan']),
}

const STYLE_RULES = {
  color: /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\(\s*[\d.%\s,/-]+\)|[a-z]+)$/i,
  'background-color': /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\(\s*[\d.%\s,/-]+\)|[a-z]+)$/i,
  background: /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\(\s*[\d.%\s,/-]+\)|[a-z]+)$/i,
  'text-align': /^(?:left|right|center|justify)$/i,
  'font-weight': /^(?:normal|bold|bolder|lighter|[1-9]00)$/i,
  'font-style': /^(?:normal|italic|oblique)$/i,
  'text-decoration': /^(?:none|underline|line-through|overline)$/i,
  padding: /^(?:0|(?:-?\d+(?:\.\d+)?)(?:px|r?em|%))(?:\s+(?:0|(?:-?\d+(?:\.\d+)?)(?:px|r?em|%))){0,3}$/i,
  margin: /^(?:0|(?:-?\d+(?:\.\d+)?)(?:px|r?em|%))(?:\s+(?:0|(?:-?\d+(?:\.\d+)?)(?:px|r?em|%))){0,3}$/i,
  border: /^(?:0|thin|medium|thick|(?:\d+(?:\.\d+)?)(?:px|r?em|pt))\s+(?:none|solid|dashed|dotted|double)(?:\s+(?:#[0-9a-f]{3,8}|[a-z]+))?$/i,
  width: /^(?:auto|100%|[1-9]\d?%|0|(?:\d+(?:\.\d+)?)(?:px|r?em|vw|vh))$/i,
  'max-width': /^(?:none|100%|[1-9]\d?%|0|(?:\d+(?:\.\d+)?)(?:px|r?em|vw|vh))$/i,
  'min-width': /^(?:0|100%|[1-9]\d?%|(?:\d+(?:\.\d+)?)(?:px|r?em|vw|vh))$/i,
  'white-space': /^(?:normal|nowrap|pre|pre-wrap|pre-line)$/i,
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function normalizeTableSpan(value) {
  const parsed = Number(String(value || '').trim())
  if (!Number.isInteger(parsed) || parsed <= 0) return ''
  return String(parsed)
}

function sanitizeStyle(styleText) {
  const declarations = String(styleText || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const safe = []
  for (const declaration of declarations) {
    const separator = declaration.indexOf(':')
    if (separator < 1) continue
    const prop = declaration.slice(0, separator).trim().toLowerCase()
    const value = declaration.slice(separator + 1).trim()
    const rule = STYLE_RULES[prop]
    if (!rule) continue
    if (!rule.test(value)) continue
    safe.push(`${prop}: ${value}`)
  }

  return safe.join('; ')
}

function sanitizeUrl(href) {
  const value = String(href || '').trim()
  if (!value) return ''
  try {
    const parsed = new URL(value, 'https://sanitizer.local')
    if (!URL_PROTOCOL_ALLOWLIST.has(parsed.protocol)) return ''
    return value
  } catch {
    return ''
  }
}

function sanitizeElement(element) {
  const children = Array.from(element.children || [])
  for (const child of children) {
    sanitizeElement(child)
  }

  const tag = String(element.tagName || '').toUpperCase()
  if (!tag) return

  if (DROP_TAGS.has(tag)) {
    element.remove()
    return
  }

  if (!ALLOWED_TAGS.has(tag)) {
    const parent = element.parentNode
    if (!parent) return
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element)
    }
    parent.removeChild(element)
    return
  }

  const tagAttrs = TAG_ALLOWED_ATTRS[tag] || new Set()
  for (const attr of Array.from(element.attributes || [])) {
    const name = String(attr.name || '').toLowerCase()
    const value = attr.value

    if (name.startsWith('on')) {
      element.removeAttribute(attr.name)
      continue
    }

    if (name === 'style') {
      const safeStyle = sanitizeStyle(value)
      if (safeStyle) element.setAttribute('style', safeStyle)
      else element.removeAttribute('style')
      continue
    }

    if (name === 'href' && tag === 'A') {
      const safeHref = sanitizeUrl(value)
      if (!safeHref) {
        element.removeAttribute('href')
        element.removeAttribute('target')
        element.removeAttribute('rel')
        continue
      }
      element.setAttribute('href', safeHref)
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noopener noreferrer')
      continue
    }

    if ((name === 'colspan' || name === 'rowspan') && (tag === 'TH' || tag === 'TD')) {
      const span = normalizeTableSpan(value)
      if (span) element.setAttribute(name, span)
      else element.removeAttribute(name)
      continue
    }

    if (!GLOBAL_ALLOWED_ATTRS.has(name) && !tagAttrs.has(name)) {
      element.removeAttribute(attr.name)
    }
  }
}

export function sanitizeStructuredNodeHtmlClient(value) {
  const source = toText(value)
  if (!source.trim()) return ''
  if (typeof window === 'undefined' || !window.document) return source

  const template = window.document.createElement('template')
  template.innerHTML = source

  for (const child of Array.from(template.content.children)) {
    sanitizeElement(child)
  }

  return template.innerHTML.trim()
}

export function structuredNodeHtmlToPlainText(value) {
  const source = toText(value)
  if (!source) return ''
  if (typeof window === 'undefined' || !window.document) {
    return source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const div = window.document.createElement('div')
  div.innerHTML = source
  return String(div.textContent || div.innerText || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
