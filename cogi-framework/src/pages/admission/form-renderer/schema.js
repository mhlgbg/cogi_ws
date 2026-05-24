function normalizeOption(option) {
  if (option && typeof option === 'object') {
    const value = String(option.value ?? option.key ?? option.code ?? option.id ?? '').trim()
    const label = String(option.label ?? option.name ?? option.title ?? value).trim()
    return value ? { value, label } : null
  }

  const value = String(option || '').trim()
  return value ? { value, label: value } : null
}

function normalizeConditionValue(value) {
  if (value === null || value === undefined) return value
  if (typeof value === 'boolean' || typeof value === 'number') return value

  const text = String(value).trim()
  if (!text) return ''

  const lowered = text.toLowerCase()
  if (lowered === 'true') return true
  if (lowered === 'false') return false

  const parsed = Number(text)
  if (!Number.isNaN(parsed) && text === String(parsed)) return parsed

  return text
}

function normalizeVisibleWhen(visibleWhen) {
  if (!visibleWhen || typeof visibleWhen !== 'object' || Array.isArray(visibleWhen)) return null

  const field = String(visibleWhen.field || '').trim()
  if (!field) return null

  return {
    field,
    equals: normalizeConditionValue(visibleWhen.equals),
  }
}

function normalizeDefaultValue(fieldType, value) {
  if (value === undefined) return undefined
  if (value === null) return null

  if (fieldType === 'radio' || fieldType === 'select') {
    return String(value)
  }

  return value
}

function normalizeTableColumn(column, index) {
  if (!column || typeof column !== 'object') return null

  const key = String(column.key || '').trim()
  if (!key) return null

  const hasExplicitType = Object.prototype.hasOwnProperty.call(column, 'type')

  return {
    key,
    label: String(column.label || key || `column_${index + 1}`).trim(),
    type: String(column.type || 'text').trim().toLowerCase(),
    hasExplicitType,
    required: column.required === true,
    placeholder: String(column.placeholder || '').trim(),
    min: typeof column.min === 'number' ? column.min : null,
    max: typeof column.max === 'number' ? column.max : null,
    step: typeof column.step === 'number' ? column.step : null,
    options: Array.isArray(column.options) ? column.options.map(normalizeOption).filter(Boolean) : [],
  }
}

function normalizeTableRow(row, index) {
  if (row && typeof row === 'object' && !Array.isArray(row)) {
    return { ...row }
  }

  const label = String(row ?? '').trim()
  return {
    id: index + 1,
    label: label || `Hàng ${index + 1}`,
  }
}

function normalizeField(field, index) {
  if (!field || typeof field !== 'object') return null

  const key = String(field.key || '').trim()
  if (!key) return null

  return {
    key,
    label: String(field.label || field.title || key || `field_${index + 1}`).trim(),
    type: String(field.type || 'text').trim().toLowerCase(),
    required: field.required === true,
    multiple: field.multiple === true,
    description: String(field.description || '').trim(),
    placeholder: String(field.placeholder || '').trim(),
    accept: Array.isArray(field.accept) ? field.accept.filter(Boolean) : [],
    min: typeof field.min === 'number' ? field.min : null,
    max: typeof field.max === 'number' ? field.max : null,
    step: typeof field.step === 'number' ? field.step : null,
    defaultValue: normalizeDefaultValue(String(field.type || 'text').trim().toLowerCase(), field.defaultValue),
    visibleWhen: normalizeVisibleWhen(field.visibleWhen),
    options: Array.isArray(field.options) ? field.options.map(normalizeOption).filter(Boolean) : [],
    columns: Array.isArray(field.columns) ? field.columns.map(normalizeTableColumn).filter(Boolean) : [],
    rows: Array.isArray(field.rows) ? field.rows.map(normalizeTableRow) : [],
  }
}

function normalizeSection(section, index) {
  if (!section || typeof section !== 'object') return null

  if (String(section.type || '').trim().toLowerCase() === 'table') {
    const tableField = normalizeField(
      {
        ...section,
        label: section.label || section.title || section.key || `section_${index + 1}`,
      },
      index,
    )

    if (!tableField) return null

    return {
      key: String(section.key || `section_${index + 1}`).trim(),
      title: String(section.title || '').trim(),
      fields: [tableField],
    }
  }

  const fields = Array.isArray(section.fields) ? section.fields.map(normalizeField).filter(Boolean) : []
  if (fields.length === 0) return null

  return {
    key: String(section.key || `section_${index + 1}`).trim(),
    title: String(section.title || '').trim(),
    fields,
  }
}

export function extractTemplateSections(schema) {
  if (!schema || typeof schema !== 'object') return []

  if (Array.isArray(schema.sections)) {
    return schema.sections.map(normalizeSection).filter(Boolean)
  }

  if (Array.isArray(schema.fields)) {
    const fields = schema.fields.map(normalizeField).filter(Boolean)
    return fields.length > 0
      ? [{ key: 'legacy_fields', title: '', fields }]
      : []
  }

  return []
}

export function extractTemplateFields(schema) {
  return extractTemplateSections(schema).flatMap((section) => section.fields)
}

export function isFieldVisible(field, formData) {
  if (!field?.visibleWhen) return true

  const leftValue = normalizeConditionValue(formData?.[field.visibleWhen.field])
  return leftValue === field.visibleWhen.equals
}

function createInitialTableValue(field) {
  return Array.isArray(field.rows) ? field.rows.map((row) => ({ ...row })) : []
}

export function buildInitialFormData(application, fields) {
  const nextFormData = application?.formData && typeof application.formData === 'object'
    ? { ...application.formData }
    : {}

  const fallbackValues = {
    studentName: String(application?.studentName || '').trim(),
    dob: String(application?.dob || '').slice(0, 10),
    gender: String(application?.gender || '').trim(),
    currentSchool: String(application?.currentSchool || '').trim(),
    address: String(application?.address || '').trim(),
  }

  fields.forEach((field) => {
    if (nextFormData[field.key] !== undefined && nextFormData[field.key] !== null) return

    if (field.defaultValue !== undefined) {
      nextFormData[field.key] = field.defaultValue
      return
    }

    if (field.type === 'table') {
      nextFormData[field.key] = createInitialTableValue(field)
      return
    }

    if (fallbackValues[field.key]) {
      nextFormData[field.key] = fallbackValues[field.key]
    }
  })

  return nextFormData
}

function hasTableValue(value) {
  if (!Array.isArray(value) || value.length === 0) return false

  return value.some((row) => {
    if (!row || typeof row !== 'object') return false
    return Object.values(row).some((cellValue) => {
      if (cellValue === null || cellValue === undefined) return false
      if (typeof cellValue === 'object') return true
      return String(cellValue).trim() !== ''
    })
  })
}

function isBlankValue(value) {
  if (value === null || value === undefined) return true
  return String(value).trim() === ''
}

function parseNumberValue(value) {
  if (isBlankValue(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseDateParts(value) {
  const text = String(value ?? '').trim()
  if (!text) return null

  let year
  let month
  let day

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (isoMatch) {
    year = Number(isoMatch[1])
    month = Number(isoMatch[2])
    day = Number(isoMatch[3])
  } else {
    const localMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
    if (!localMatch) return null
    day = Number(localMatch[1])
    month = Number(localMatch[2])
    year = Number(localMatch[3])
  }

  const normalized = new Date(Date.UTC(year, month - 1, day))
  if (
    Number.isNaN(normalized.getTime())
    || normalized.getUTCFullYear() !== year
    || normalized.getUTCMonth() + 1 !== month
    || normalized.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

function validateDateValue(label, value) {
  if (isBlankValue(value)) return null
  return parseDateParts(value) ? null : `${label} phải theo định dạng dd/MM/yyyy`
}

function buildRangeMessage(label, min, max) {
  if (min !== null && max !== null) {
    return `${label} phải trong khoảng ${min} đến ${max}`
  }
  if (min !== null) {
    return `${label} phải lớn hơn hoặc bằng ${min}`
  }
  if (max !== null) {
    return `${label} phải nhỏ hơn hoặc bằng ${max}`
  }
  return `${label} không hợp lệ`
}

function validateNumberRange(label, value, min, max) {
  if (isBlankValue(value)) return null

  const parsed = parseNumberValue(value)
  if (Number.isNaN(parsed)) {
    return `${label} phải là số hợp lệ`
  }
  if (min !== null && parsed < min) {
    return buildRangeMessage(label, min, max)
  }
  if (max !== null && parsed > max) {
    return buildRangeMessage(label, min, max)
  }

  return null
}

function getRowLabel(row, index) {
  if (!row || typeof row !== 'object') return `Hàng ${index + 1}`

  const label = row.label || row.title || row.name || row.grade || row.id
  return String(label || `Hàng ${index + 1}`)
}

function validateTableCell(field, rowValue, rowIndex, column) {
  if (!column) return null

  const cellValue = rowValue?.[column.key]
  const rowLabel = getRowLabel(rowValue, rowIndex)
  if (column.type === 'date') {
    return validateDateValue(`${column.label} (${rowLabel})`, cellValue)
  }

  if (column.type !== 'number') return null

  return validateNumberRange(`${column.label} (${rowLabel})`, cellValue, column.min, column.max)
}

function validateTableField(field, value) {
  const tableValue = Array.isArray(value) ? value : createInitialTableValue(field)
  const cellErrors = {}

  if (field.required && !hasTableValue(tableValue)) {
    return {
      message: `${field.label} là bắt buộc`,
      cells: {},
    }
  }

  tableValue.forEach((rowValue, rowIndex) => {
    field.columns.forEach((column) => {
      const cellError = validateTableCell(field, rowValue, rowIndex, column)
      if (cellError) {
        cellErrors[`${rowIndex}.${column.key}`] = cellError
      }
    })
  })

  if (Object.keys(cellErrors).length > 0) {
    return {
      message: 'Vui lòng kiểm tra lại các ô được đánh dấu',
      cells: cellErrors,
    }
  }

  return null
}

export function validateFieldValue(field, value) {
  if (!field) return null

  const formData = arguments.length > 2 ? arguments[2] : undefined
  if (!isFieldVisible(field, formData)) return null

  const isFileField = field.type === 'file' || field.type === 'image'

  if (field.type === 'table') {
    return validateTableField(field, value)
  }

  const isEmpty = isFileField
    ? !getFileValueMetaList(value).length
    : isBlankValue(value)

  if (field.required && isEmpty) {
    return `${field.label} là bắt buộc`
  }

  if (field.type === 'number') {
    return validateNumberRange(field.label, value, field.min, field.max)
  }

  if (field.type === 'date') {
    return validateDateValue(field.label, value)
  }

  return null
}

export function validateFormData(formData, fields) {
  const nextErrors = {}

  fields.forEach((field) => {
    const fieldError = validateFieldValue(field, formData?.[field.key], formData)
    if (fieldError) {
      nextErrors[field.key] = fieldError
    }
  })

  return nextErrors
}

function getSingleFileValueMeta(value) {
  if (!value || typeof value !== 'object') return null

  const name = String(value.name || '').trim()
  const type = String(value.type || '').trim().toLowerCase()
  const dataUrl = String(value.dataUrl || value.url || '').trim()

  if (!name && !dataUrl) return null

  return {
    name: name || 'Tệp đính kèm',
    type,
    url: String(value.url || '').trim(),
    dataUrl,
    isImage: type.startsWith('image/'),
    isPdf: type === 'application/pdf' || dataUrl.startsWith('data:application/pdf'),
  }
}

export function getFileValueMetaList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => getSingleFileValueMeta(item)).filter(Boolean)
  }

  const single = getSingleFileValueMeta(value)
  return single ? [single] : []
}

export function getFileValueMeta(value) {
  return getFileValueMetaList(value)[0] || null
}