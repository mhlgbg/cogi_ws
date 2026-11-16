import katex from 'katex'

const INLINE_DOLLAR = '$'
const BLOCK_DOLLAR = '$$'
const INLINE_PAREN = '\\('
const INLINE_PAREN_CLOSE = '\\)'
const BLOCK_BRACKET = '\\['
const BLOCK_BRACKET_CLOSE = '\\]'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function isEscaped(source, index) {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (source[cursor] !== '\\') break
    slashCount += 1
  }
  return slashCount % 2 === 1
}

function matchDelimiterAt(source, index) {
  if (source.startsWith(BLOCK_DOLLAR, index)) return BLOCK_DOLLAR
  if (source.startsWith(INLINE_PAREN, index)) return INLINE_PAREN
  if (source.startsWith(BLOCK_BRACKET, index)) return BLOCK_BRACKET
  if (source[index] === INLINE_DOLLAR) return INLINE_DOLLAR
  return ''
}

function getClosingDelimiter(openingDelimiter) {
  if (openingDelimiter === BLOCK_DOLLAR) return BLOCK_DOLLAR
  if (openingDelimiter === INLINE_DOLLAR) return INLINE_DOLLAR
  if (openingDelimiter === INLINE_PAREN) return INLINE_PAREN_CLOSE
  if (openingDelimiter === BLOCK_BRACKET) return BLOCK_BRACKET_CLOSE
  return ''
}

function isWhitespaceChar(value) {
  return /\s/.test(value || '')
}

function isDigitChar(value) {
  return /[0-9]/.test(value || '')
}

function isValidInlineDollarOpening(source, index) {
  const previousChar = source[index - 1] || ''
  const nextChar = source[index + 1] || ''
  if (!nextChar) return false
  if (isWhitespaceChar(nextChar)) return false
  if (isDigitChar(previousChar)) return false
  return true
}

function isValidInlineDollarClosing(source, index) {
  const previousChar = source[index - 1] || ''
  const nextChar = source[index + 1] || ''
  if (!previousChar) return false
  if (isWhitespaceChar(previousChar)) return false
  if (isDigitChar(nextChar)) return false
  return true
}

function pushTextSegment(segments, text) {
  if (!text) return
  const last = segments[segments.length - 1]
  if (last?.type === 'text') {
    last.value += text
    return
  }
  segments.push({ type: 'text', value: text })
}

export function parseMathDelimitedText(value) {
  const source = toText(value)
  if (!source) return []

  const segments = []
  let cursor = 0
  let textStart = 0

  while (cursor < source.length) {
    const openingDelimiter = matchDelimiterAt(source, cursor)
    if (!openingDelimiter || isEscaped(source, cursor)) {
      cursor += 1
      continue
    }
    if (openingDelimiter === INLINE_DOLLAR && !isValidInlineDollarOpening(source, cursor)) {
      cursor += 1
      continue
    }

    const closingDelimiter = getClosingDelimiter(openingDelimiter)
    if (!closingDelimiter) {
      cursor += 1
      continue
    }

    const contentStart = cursor + openingDelimiter.length
    let searchCursor = contentStart
    let closeIndex = -1

    while (searchCursor < source.length) {
      const candidateIndex = source.indexOf(closingDelimiter, searchCursor)
      if (candidateIndex < 0) break
      if (!isEscaped(source, candidateIndex) && (openingDelimiter !== INLINE_DOLLAR || isValidInlineDollarClosing(source, candidateIndex))) {
        closeIndex = candidateIndex
        break
      }
      searchCursor = candidateIndex + 1
    }

    if (closeIndex < 0) {
      cursor += openingDelimiter.length
      continue
    }

    const formulaContent = source.slice(contentStart, closeIndex)
    if (!formulaContent.trim()) {
      cursor = closeIndex + closingDelimiter.length
      continue
    }

    pushTextSegment(segments, source.slice(textStart, cursor))
    segments.push({
      type: 'math',
      displayMode: openingDelimiter === BLOCK_DOLLAR || openingDelimiter === BLOCK_BRACKET,
      value: formulaContent,
      raw: source.slice(cursor, closeIndex + closingDelimiter.length),
    })

    cursor = closeIndex + closingDelimiter.length
    textStart = cursor
  }

  pushTextSegment(segments, source.slice(textStart))
  return segments
}

const LIKELY_ESCAPED_CONTROL_CHAR_MAP = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\f': '\\f',
  '\v': '\\v',
  '\b': '\\b',
}

function normalizeLikelyEscapedLatexControlChars(value) {
  return toText(value).replace(/[\n\r\t\f\v\b](?=[A-Za-z])/g, (character) => LIKELY_ESCAPED_CONTROL_CHAR_MAP[character] || character)
}

export function renderMathExpressionToHtml(value, { displayMode = false } = {}) {
  const expression = normalizeLikelyEscapedLatexControlChars(value)
  if (!expression.trim()) return ''

  try {
    return katex.renderToString(expression, {
      throwOnError: false,
      displayMode,
      strict: 'ignore',
      trust: false,
      output: 'html',
    })
  } catch {
    return ''
  }
}
