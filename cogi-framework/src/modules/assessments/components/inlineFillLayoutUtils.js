function normalizeQuestionCode(value) {
  return String(value || '').trim()
}

export const INLINE_FILL_PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z0-9._:-]+)\s*\}\}/g

export function buildInlineFillPlaceholderToken(questionCode) {
  const normalized = normalizeQuestionCode(questionCode)
  return normalized ? `{{${normalized}}}` : ''
}

export function getInlineFillQuestionCode(entry) {
  return normalizeQuestionCode(entry?.question?.code || entry?.questionCode || '')
}

export function extractInlineFillPlaceholders(source) {
  const text = String(source || '')
  const matches = []
  INLINE_FILL_PLACEHOLDER_PATTERN.lastIndex = 0
  let match = INLINE_FILL_PLACEHOLDER_PATTERN.exec(text)
  while (match) {
    const code = normalizeQuestionCode(match[1])
    if (code) {
      matches.push({ code, token: buildInlineFillPlaceholderToken(code), index: match.index })
    }
    match = INLINE_FILL_PLACEHOLDER_PATTERN.exec(text)
  }
  INLINE_FILL_PLACEHOLDER_PATTERN.lastIndex = 0
  return matches
}

export function validateInlineFillLayout(source, entries = []) {
  const placeholders = extractInlineFillPlaceholders(source)
  const questionCodes = (Array.isArray(entries) ? entries : []).map(getInlineFillQuestionCode).filter(Boolean)
  const questionCodeSet = new Set(questionCodes)
  const placeholderCounts = placeholders.reduce((result, item) => {
    result[item.code] = Number(result[item.code] || 0) + 1
    return result
  }, {})
  const placeholderCodes = placeholders.map((item) => item.code)
  const uniquePlaceholderCodes = [...new Set(placeholderCodes)]

  return {
    placeholders,
    placeholderCodes,
    uniquePlaceholderCodes,
    unknownCodes: uniquePlaceholderCodes.filter((code) => !questionCodeSet.has(code)),
    duplicateCodes: uniquePlaceholderCodes.filter((code) => Number(placeholderCounts[code] || 0) > 1),
    missingQuestionCodes: questionCodes.filter((code) => !uniquePlaceholderCodes.includes(code)),
    hasRenderablePlaceholders: uniquePlaceholderCodes.some((code) => questionCodeSet.has(code)),
  }
}

export function getInlineFillQuestionLabel(entry) {
  const questionCode = getInlineFillQuestionCode(entry)
  const title = String(entry?.question?.title || entry?.question?.questionText || '').replace(/\s+/g, ' ').trim()
  return title ? `${questionCode} · ${title}` : questionCode
}