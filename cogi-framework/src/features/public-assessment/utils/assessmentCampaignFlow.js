function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function normalizeCampaignFieldOptions(field) {
  const raw = Array.isArray(field?.options) ? field.options : []
  return raw
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        const value = typeof item === 'number' ? item : toText(item)
        return value === '' ? null : { label: String(item), value }
      }
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const label = toText(item.label)
      const rawValue = item.value
      const value = typeof rawValue === 'number' ? rawValue : toText(rawValue)
      if (!label || value === '') return null
      return { label, value }
    })
    .filter(Boolean)
}

export function normalizeAssessmentCampaignFieldInput(field, rawValue) {
  const type = toText(field?.fieldType).toLowerCase()
  if (type === 'checkbox') {
    const options = normalizeCampaignFieldOptions(field)
    const allowed = new Set(options.map((item) => `${typeof item.value}:${String(item.value)}`))
    const rows = Array.isArray(rawValue) ? rawValue : []
    return Array.from(new Set(rows
      .map((item) => (typeof item === 'number' ? item : toText(item)))
      .filter((item) => item !== '')
      .filter((item) => allowed.has(`${typeof item}:${String(item)}`))))
  }
  if (type === 'number') {
    if (rawValue === null || rawValue === undefined || rawValue === '') return null
    const parsed = typeof rawValue === 'number' ? rawValue : Number(rawValue)
    return Number.isFinite(parsed) ? parsed : rawValue
  }
  if (type === 'date') return rawValue === null || rawValue === undefined || rawValue === '' ? '' : toText(rawValue)
  if (type === 'select' || type === 'radio') {
    if (rawValue === null || rawValue === undefined || rawValue === '') return ''
    return typeof rawValue === 'number' ? rawValue : toText(rawValue)
  }
  return rawValue === null || rawValue === undefined ? '' : toText(rawValue)
}

export function validateAssessmentCampaignFieldInput(field, rawValue) {
  const type = toText(field?.fieldType).toLowerCase()
  const value = normalizeAssessmentCampaignFieldInput(field, rawValue)
  const options = normalizeCampaignFieldOptions(field)
  const allowed = new Set(options.map((item) => `${typeof item.value}:${String(item.value)}`))
  const empty = type === 'checkbox'
    ? !Array.isArray(value) || value.length === 0
    : value === null || value === ''
  if (field?.required && empty) return `${field.label || field.key} là bắt buộc.`
  if (empty) return ''
  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase())) return `${field.label || field.key} chưa đúng định dạng.`
  if (type === 'phone' && !/^[0-9+\s().-]{8,20}$/.test(String(value || '').trim())) return `${field.label || field.key} chưa đúng định dạng.`
  if (type === 'number' && !Number.isFinite(value)) return `${field.label || field.key} chưa hợp lệ.`
  if (type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) return `${field.label || field.key} chưa hợp lệ.`
  if ((type === 'select' || type === 'radio') && !allowed.has(`${typeof value}:${String(value)}`)) return `${field.label || field.key} chưa hợp lệ.`
  if (type === 'checkbox') {
    if (!Array.isArray(value)) return `${field.label || field.key} chưa hợp lệ.`
    if (value.some((item) => !allowed.has(`${typeof item}:${String(item)}`))) return `${field.label || field.key} chưa hợp lệ.`
  }
  return ''
}

export function getBeforeStartFields(campaign) {
  return getCampaignFieldsByStage(campaign, 'before_start')
}

export function getCampaignFieldsByStage(campaign, stage) {
  return Array.isArray(campaign?.fields)
    ? campaign.fields
      .filter((field) => String(field?.status || '').trim() === 'active' && String(field?.collectStage || '').trim() === String(stage || '').trim())
      .sort((left, right) => {
        const leftOrder = Number(left?.order || 0)
        const rightOrder = Number(right?.order || 0)
        if (leftOrder !== rightOrder) return leftOrder - rightOrder
        return Number(left?.id || 0) - Number(right?.id || 0)
      })
    : []
}

export function buildInitialFieldValues(fields = []) {
  return fields.reduce((result, field) => {
    result[field.key] = field.fieldType === 'checkbox' ? [] : ''
    return result
  }, {})
}

export function buildInitialBeforeStartValues(campaign) {
  return buildInitialFieldValues(getBeforeStartFields(campaign))
}

export function normalizeContactTarget(data = {}) {
  const email = toText(data?.email || data?.parentEmail || data?.contactEmail)
  const phone = toText(data?.phone || data?.parentPhone || data?.zalo)
  if (email) {
    return { type: 'email', value: email }
  }
  if (phone) {
    return { type: 'phone', value: phone }
  }
  return { type: '', value: '' }
}

export function maskPhone(phone) {
  const normalized = toText(phone).replace(/\s+/g, '')
  if (!normalized) return ''
  if (normalized.length <= 4) return normalized
  return `${normalized.slice(0, 3)}***${normalized.slice(-2)}`
}

export function getCandidateDisplayName(data = {}) {
  return toText(data?.fullName || data?.studentName || data?.name) || ''
}

export function getGradeValue(data = {}) {
  return data?.grade ?? data?.studentGrade ?? ''
}
