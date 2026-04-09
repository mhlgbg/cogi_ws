function normalizeOption(option) {
  if (option && typeof option === 'object') {
    const value = String(option.value ?? option.key ?? option.code ?? option.id ?? '').trim()
    const label = String(option.label ?? option.name ?? option.title ?? value).trim()
    return value ? { value, label } : null
  }

  const value = String(option || '').trim()
  return value ? { value, label: value } : null
}

function normalizeTableColumn(column, index) {
  if (!column || typeof column !== 'object') return null

  const key = String(column.key || '').trim()
  if (!key) return null

  return {
    key,
    label: String(column.label || key || `column_${index + 1}`).trim(),
    type: String(column.type || 'text').trim().toLowerCase(),
    required: column.required === true,
    placeholder: String(column.placeholder || '').trim(),
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
    label: String(field.label || key || `field_${index + 1}`).trim(),
    type: String(field.type || 'text').trim().toLowerCase(),
    required: field.required === true,
    placeholder: String(field.placeholder || '').trim(),
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

export function validateFormData(formData, fields) {
  const nextErrors = {}

  fields.forEach((field) => {
    if (!field.required) return

    const value = formData?.[field.key]
    const isFileField = field.type === 'file' || field.type === 'image'

    if (field.type === 'table') {
      if (!hasTableValue(value)) {
        nextErrors[field.key] = `${field.label} là bắt buộc`
      }
      return
    }

    const isEmpty = isFileField
      ? !(value && typeof value === 'object' && String(value.name || '').trim())
      : String(value ?? '').trim() === ''

    if (isEmpty) {
      nextErrors[field.key] = `${field.label} là bắt buộc`
    }
  })

  return nextErrors
}

export function getFileValueMeta(value) {
  if (!value || typeof value !== 'object') return null

  const name = String(value.name || '').trim()
  const type = String(value.type || '').trim().toLowerCase()
  const dataUrl = String(value.dataUrl || value.url || '').trim()

  if (!name && !dataUrl) return null

  return {
    name: name || 'Tệp đính kèm',
    type,
    dataUrl,
    isImage: type.startsWith('image/'),
    isPdf: type === 'application/pdf' || dataUrl.startsWith('data:application/pdf'),
  }
}