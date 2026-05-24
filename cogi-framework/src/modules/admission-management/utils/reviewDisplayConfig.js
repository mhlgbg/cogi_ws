import { getFileValueMetaList } from '../../../pages/admission/form-renderer/schema'

export const TS2026_DEFAULT_REVIEW_DISPLAY_CONFIG = {
  sections: [
    {
      title: 'Thông tin học sinh',
      fields: [
        { key: 'studentCode', label: 'Mã học sinh' },
        { key: 'studentName', label: 'Họ và tên học sinh' },
        { key: 'gender', label: 'Giới tính', formatter: 'gender' },
        { key: 'dob', label: 'Ngày sinh', formatter: 'date' },
        { key: 'birthPlace', label: 'Nơi sinh' },
        { key: 'primarySchool', label: 'Trường Tiểu học' },
        { key: 'class5', label: 'Lớp 5' },
      ],
    },
    {
      title: 'Thông tin cư trú',
      fields: [
        { key: 'permanentAddress', label: 'Nơi thường trú' },
        { key: 'temporaryAddress', label: 'Địa chỉ tạm trú' },
      ],
    },
    {
      title: 'Thông tin cha',
      fields: [
        { key: 'fatherName', label: 'Họ tên cha' },
        { key: 'fatherBirthYear', label: 'Nam sinh' },
        { key: 'fatherPhone', label: 'Số điện thoại' },
      ],
    },
    {
      title: 'Thông tin mẹ',
      fields: [
        { key: 'motherName', label: 'Họ tên mẹ' },
        { key: 'motherBirthYear', label: 'Năm sinh' },
        { key: 'motherPhone', label: 'Số điện thoại' },
      ],
    },
    {
      title: 'Thông tin học tập',
      fields: [
        {
          key: 'isCambridgeStudent',
          label: 'Học sinh hệ Cambridge',
          formatter: 'boolean',
        },
        {
          key: 'scoreTable',
          label: 'Bảng điểm hệ phổ thông',
          type: 'table',
          visibleWhen: {
            field: 'isCambridgeStudent',
            equals: false,
          },
          columns: [
            { key: 'label', label: 'Lớp' },
            { key: 'vietnamese', label: 'Tiếng Việt' },
            { key: 'math', label: 'Toán' },
            { key: 'english', label: 'Ngoại ngữ' },
          ],
        },
        {
          key: 'cambridgeScoreTable',
          label: 'Bảng điểm hệ Cambridge',
          type: 'table',
          visibleWhen: {
            field: 'isCambridgeStudent',
            equals: true,
          },
          columns: [
            { key: 'label', label: 'Lớp' },
            { key: 'englishCambridge', label: 'English' },
            { key: 'mathCambridge', label: 'Math' },
            { key: 'scienceCambridge', label: 'Science' },
          ],
        },
        {
          key: 'achievement',
          label: 'Thành tích, năng lực vượt trội',
        },
      ],
    },
    {
      title: 'Nhu cầu dịch vụ',
      fields: [
        { key: 'boarding', label: 'Ăn và nghỉ bán trú', formatter: 'boolean' },
        { key: 'transport', label: 'Dịch vụ xe đưa đón', formatter: 'boolean' },
      ],
    },
  ],
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeBooleanLike(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = toText(value).toLowerCase()
  if (!normalized) return null
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false
  return null
}

function formatDate(value) {
  const text = toText(value)
  if (!text) return '-'
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatSimpleValue(value, formatter) {
  if (formatter === 'boolean') {
    const normalized = normalizeBooleanLike(value)
    if (normalized === null) return '-'
    return normalized ? 'Có' : 'Không'
  }

  if (formatter === 'gender') {
    const normalized = toText(value).toLowerCase()
    if (normalized === 'male') return 'Nam'
    if (normalized === 'female') return 'Nữ'
    return toText(value) || '-'
  }

  if (formatter === 'date') {
    return formatDate(value)
  }

  if (value === null || value === undefined || toText(value) === '') return '-'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  return value
}

function getPathSegments(path) {
  return String(path || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function safeGet(source, path) {
  const segments = getPathSegments(path)
  if (segments.length === 0) return undefined
  let current = source
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined
    current = current[segment]
  }
  return current
}

function hasFilePayload(value) {
  if (getFileValueMetaList(value).length > 0) return true
  if (Array.isArray(value)) return value.some((entry) => hasFilePayload(entry))
  if (!isRecord(value)) return false
  return false
}

function resolveCampaignConfig(detail) {
  const configured = detail?.campaign?.reviewDisplayConfig
  if (isRecord(configured) && Array.isArray(configured.sections)) return configured

  if (toText(detail?.campaign?.code).toLowerCase() === 'ts2026') {
    return TS2026_DEFAULT_REVIEW_DISPLAY_CONFIG
  }

  return null
}

function buildValueSources(detail) {
  const snapshot = isRecord(detail?.reviewSnapshot) ? detail.reviewSnapshot : {}
  const rootFields = {
    studentCode: detail?.studentCode,
    studentName: detail?.studentName,
    dob: detail?.dob,
    gender: detail?.gender,
    currentSchool: detail?.currentSchool,
    address: detail?.address,
  }

  return [
    isRecord(detail?.formData) ? detail.formData : null,
    isRecord(snapshot?.rawData) ? snapshot.rawData : null,
    isRecord(snapshot?.formData) ? snapshot.formData : null,
    isRecord(snapshot?.data) ? snapshot.data : null,
    rootFields,
  ].filter(Boolean)
}

function getConfiguredValue(detail, key) {
  const sources = buildValueSources(detail)
  for (const source of sources) {
    const value = safeGet(source, key)
    if (value !== undefined) return value
  }
  return undefined
}

function isVisibleByCondition(detail, visibleWhen) {
  if (!isRecord(visibleWhen) || !toText(visibleWhen.field)) return true
  const actualValue = getConfiguredValue(detail, visibleWhen.field)
  const normalizedActualBoolean = normalizeBooleanLike(actualValue)
  const normalizedExpectedBoolean = normalizeBooleanLike(visibleWhen.equals)

  if (normalizedActualBoolean !== null || normalizedExpectedBoolean !== null) {
    return normalizedActualBoolean === normalizedExpectedBoolean
  }

  return toText(actualValue) === toText(visibleWhen.equals)
}

function buildTableItem(detail, fieldConfig) {
  const rawValue = getConfiguredValue(detail, fieldConfig.key)
  const rows = Array.isArray(rawValue) ? rawValue.filter((row) => isRecord(row)) : []
  const columns = Array.isArray(fieldConfig.columns) ? fieldConfig.columns : []
  const effectiveColumns = columns.length > 0
    ? columns
    : (rows[0] ? Object.keys(rows[0]).map((key) => ({ key, label: key })) : [])

  return {
    key: fieldConfig.key,
    label: fieldConfig.label || fieldConfig.key,
    value: {
      type: 'table',
      rows: rows.map((row, rowIndex) => ({
        key: toText(row.id || row.key || row.label || rowIndex + 1),
        cells: effectiveColumns.map((column, columnIndex) => ({
          key: toText(column?.key || columnIndex + 1),
          label: toText(column?.label || column?.key || `Cột ${columnIndex + 1}`),
          value: formatSimpleValue(row?.[column?.key], column?.formatter),
        })),
      })),
    },
  }
}

function buildFieldItem(detail, fieldConfig) {
  if (!isRecord(fieldConfig) || !toText(fieldConfig.key)) return null
  if (!isVisibleByCondition(detail, fieldConfig.visibleWhen)) return null
  if (fieldConfig.type === 'file') return null

  const rawValue = getConfiguredValue(detail, fieldConfig.key)
  if (fieldConfig.type === 'table') {
    return buildTableItem(detail, fieldConfig)
  }

  if (hasFilePayload(rawValue)) return null

  return {
    key: fieldConfig.key,
    label: fieldConfig.label || fieldConfig.key,
    value: formatSimpleValue(rawValue, fieldConfig.formatter),
  }
}

export function buildConfiguredReviewSections(detail) {
  const reviewDisplayConfig = resolveCampaignConfig(detail)
  if (!isRecord(reviewDisplayConfig) || !Array.isArray(reviewDisplayConfig.sections)) return null

  const sections = reviewDisplayConfig.sections
    .filter((section) => isRecord(section))
    .map((section, sectionIndex) => ({
      key: toText(section.key || section.title || sectionIndex + 1),
      title: toText(section.title || `Thông tin ${sectionIndex + 1}`),
      items: (Array.isArray(section.fields) ? section.fields : [])
        .map((field) => buildFieldItem(detail, field))
        .filter(Boolean),
    }))
    .filter((section) => Array.isArray(section.items) && section.items.length > 0)

  return sections.length > 0 ? sections : null
}
