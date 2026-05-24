import { getFileValueMetaList } from '../../../pages/admission/form-renderer/schema'
import { resolveMediaUrl } from '../../../utils/mediaUrl'

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function formatDate(value) {
  const text = toText(value)
  if (!text) return ''

  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (ddmmyyyy) return text

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

function normalizeValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value
  if (isRecord(value)) return value
  return String(value)
}

function normalizeEvidenceItem(item, fallbackIndex = 0) {
  if (!item) return null

  if (typeof item === 'string') {
    return {
      id: null,
      label: '',
      fileName: item,
      fieldLabel: '',
      url: item,
      mime: '',
    }
  }

  if (!isRecord(item)) return null

  const fileName = toText(item.fileName || item.name || item.title || `Tệp ${fallbackIndex + 1}`)
  const url = resolveMediaUrl(toText(item.url || item.path || item.href || item.dataUrl))
  const mime = toText(item.mime || item.type)

  return {
    id: item.id ?? null,
    label: toText(item.label || item.title || fileName),
    fileName,
    fieldLabel: toText(item.fieldLabel || item.groupLabel || ''),
    url,
    mime,
  }
}

function normalizeEvidenceGroup(items) {
  return (Array.isArray(items) ? items : []).map(normalizeEvidenceItem).filter(Boolean)
}

function entryToItem(entry, index = 0) {
  if (!entry) return null

  if (isRecord(entry)) {
    const label = toText(entry.label || entry.key || `Mục ${index + 1}`)
    const rawValue = entry.value ?? entry.text ?? entry.content ?? ''
    return {
      key: toText(entry.key || label || index + 1),
      label,
      value: normalizeValue(rawValue),
    }
  }

  return {
    key: String(index + 1),
    label: `Mục ${index + 1}`,
    value: normalizeValue(entry),
  }
}

function sectionToDisplaySection(section, index = 0) {
  if (!section) return null

  if (isRecord(section)) {
    const rawItems = Array.isArray(section.items)
      ? section.items
      : Array.isArray(section.fields)
        ? section.fields
        : []

    const items = rawItems
      .map((item, itemIndex) => {
        if (!item) return null

        if (isRecord(item) && Array.isArray(item.cells)) {
          return {
            key: toText(item.key || item.label || itemIndex + 1),
            label: toText(item.label || `Bảng ${itemIndex + 1}`),
            value: {
              type: 'table',
              rows: [
                {
                  key: toText(item.key || itemIndex + 1),
                  cells: item.cells.map((cell, cellIndex) => ({
                    key: toText(cell?.key || cell?.label || cellIndex + 1),
                    label: toText(cell?.label || cell?.key || `Cột ${cellIndex + 1}`),
                    value: normalizeValue(cell?.value),
                  })),
                },
              ],
            },
          }
        }

        if (isRecord(item) && Array.isArray(item.rows)) {
          return {
            key: toText(item.key || item.label || itemIndex + 1),
            label: toText(item.label || `Bảng ${itemIndex + 1}`),
            value: {
              type: 'table',
              rows: item.rows.map((row, rowIndex) => ({
                key: toText(row?.key || rowIndex + 1),
                cells: (Array.isArray(row?.cells) ? row.cells : []).map((cell, cellIndex) => ({
                  key: toText(cell?.key || cell?.label || cellIndex + 1),
                  label: toText(cell?.label || cell?.key || `Cột ${cellIndex + 1}`),
                  value: normalizeValue(cell?.value),
                })),
              })),
            },
          }
        }

        if (isRecord(item) && Array.isArray(item.files)) {
          const files = normalizeEvidenceGroup(item.files)
          return {
            key: toText(item.key || item.label || itemIndex + 1),
            label: toText(item.label || `Tệp ${itemIndex + 1}`),
            value: files.length > 0 ? files : normalizeValue(item.value ?? item.text ?? item.content ?? ''),
          }
        }

        return entryToItem(item, itemIndex)
      })
      .filter(Boolean)
      .filter((item) => {
        if (isRecord(item?.value) && item.value.type === 'table') {
          return Array.isArray(item.value.rows) && item.value.rows.length > 0
        }

        if (Array.isArray(item?.value)) return item.value.length > 0
        return toText(item?.value) !== ''
      })

    if (items.length === 0) return null

    return {
      key: toText(section.key || section.title || index + 1),
      title: toText(section.title || section.label || `Thông tin ${index + 1}`),
      items,
    }
  }

  return null
}

function groupObjectToSection(title, key, group) {
  if (!isRecord(group)) return null

  const items = Object.entries(group)
    .map(([entryKey, entryValue], index) => {
      if (entryValue === null || entryValue === undefined || entryValue === '') return null
      if (Array.isArray(entryValue) || isRecord(entryValue)) {
        const rendered = normalizeValue(entryValue)
        if (Array.isArray(rendered) && rendered.length === 0) return null
        if (isRecord(rendered) && Object.keys(rendered).length === 0) return null
      }

      return {
        key: `${key}.${entryKey}.${index}`,
        label: entryKey,
        value: normalizeValue(entryValue),
      }
    })
    .filter(Boolean)

  if (items.length === 0) return null
  return { key, title, items }
}

function buildSectionsFromGroups(snapshot) {
  const sections = []

  const mappings = [
    ['Thông tin học sinh', 'student', snapshot?.student || snapshot?.studentSummary],
    ['Thông tin phụ huynh', 'parents', snapshot?.parents || snapshot?.parentSummary],
    ['Học tập / điểm số', 'study', snapshot?.study || snapshot?.studyScoreSummary],
    ['Nhu cầu dịch vụ', 'services', snapshot?.services || snapshot?.serviceNeeds],
    ['Trạng thái', 'status', snapshot?.status],
  ]

  mappings.forEach(([title, key, group]) => {
    if (Array.isArray(group)) {
      const items = group.map((item, index) => entryToItem(item, index)).filter(Boolean)
      if (items.length > 0) {
        sections.push({ key, title, items })
      }
      return
    }

    const section = groupObjectToSection(title, key, group)
    if (section) sections.push(section)
  })

  if (snapshot?.cambridgeBranch) {
    const item = entryToItem(snapshot.cambridgeBranch, 0)
    if (item) {
      sections.push({
        key: 'cambridgeBranch',
        title: 'Cambridge',
        items: [item],
      })
    }
  }

  return sections
}

export function normalizeReviewSnapshot(snapshot) {
  if (!isRecord(snapshot)) {
    return {
      isValid: false,
      sections: [],
      evidences: { images: [], pdfs: [] },
      generatedAt: '',
    }
  }

  const rawSections = Array.isArray(snapshot.displaySections)
    ? snapshot.displaySections.map(sectionToDisplaySection).filter(Boolean)
    : []

  const sections = rawSections.length > 0 ? rawSections : buildSectionsFromGroups(snapshot)
  const evidenceSource = isRecord(snapshot.evidences) ? snapshot.evidences : isRecord(snapshot.evidenceFiles) ? snapshot.evidenceFiles : {}
  const evidences = {
    images: normalizeEvidenceGroup(evidenceSource?.images),
    pdfs: normalizeEvidenceGroup(evidenceSource?.pdfs),
  }

  return {
    isValid: sections.length > 0 || evidences.images.length > 0 || evidences.pdfs.length > 0,
    sections,
    evidences,
    generatedAt: toText(snapshot.generatedAt),
  }
}

export function getOpenableSnapshotEvidences(snapshot) {
  const normalized = normalizeReviewSnapshot(snapshot)

  return {
    images: normalized.evidences.images.filter((item) => toText(item?.url) !== ''),
    pdfs: normalized.evidences.pdfs.filter((item) => toText(item?.url) !== ''),
  }
}

function inferEvidenceType(item) {
  const mime = toText(item?.mime).toLowerCase()
  const url = toText(item?.url).toLowerCase()
  if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some((ext) => url.endsWith(ext))) return 'image'
  if (mime === 'application/pdf' || url.endsWith('.pdf')) return 'pdf'
  return ''
}

function collectRawFormFiles(value, path, bucket) {
  if (Array.isArray(value)) {
    const fileList = getFileValueMetaList(value)
    if (fileList.length > 0) {
      fileList.forEach((item, index) => {
        bucket.push({
          id: null,
          label: item.name || `${path} ${index + 1}`,
          fileName: item.name || `${path} ${index + 1}`,
          fieldLabel: path,
          url: resolveMediaUrl(item.url || item.dataUrl || ''),
          mime: item.type || '',
        })
      })
      return
    }

    value.forEach((item, index) => collectRawFormFiles(item, `${path}[${index}]`, bucket))
    return
  }

  if (isRecord(value)) {
    const fileList = getFileValueMetaList(value)
    if (fileList.length > 0) {
      fileList.forEach((item, index) => {
        bucket.push({
          id: null,
          label: item.name || `${path} ${index + 1}`,
          fileName: item.name || `${path} ${index + 1}`,
          fieldLabel: path,
          url: resolveMediaUrl(item.url || item.dataUrl || ''),
          mime: item.type || '',
        })
      })
      return
    }

    Object.entries(value).forEach(([key, item]) => collectRawFormFiles(item, path ? `${path}.${key}` : key, bucket))
  }
}

export function extractEvidenceFallback(application) {
  const bucket = []
  collectRawFormFiles(application?.formData, '', bucket)

  return bucket.reduce((accumulator, item) => {
    const type = inferEvidenceType(item)
    if (type === 'image') accumulator.images.push(item)
    if (type === 'pdf') accumulator.pdfs.push(item)
    return accumulator
  }, { images: [], pdfs: [] })
}

export function hasUsableReviewSnapshot(snapshot) {
  return normalizeReviewSnapshot(snapshot).isValid
}

function buildFormDataTableItem(key, label, rows, columnLabels = {}, preferredColumnOrder = []) {
  const safeRows = Array.isArray(rows) ? rows.filter((row) => isRecord(row)) : []
  if (safeRows.length === 0) return null

  const firstRow = safeRows[0] || {}
  const discoveredKeys = Object.keys(firstRow).filter((columnKey) => columnKey !== 'id')
  const preferredKeys = preferredColumnOrder.filter((columnKey) => discoveredKeys.includes(columnKey))
  const remainingKeys = discoveredKeys.filter((columnKey) => !preferredKeys.includes(columnKey))
  const orderedKeys = [...preferredKeys, ...remainingKeys]
  if (orderedKeys.length === 0) return null

  return {
    key,
    label,
    value: {
      type: 'table',
      rows: safeRows.map((row, rowIndex) => ({
        key: toText(row.key || row.label || row.id || rowIndex + 1),
        cells: orderedKeys.map((columnKey, columnIndex) => ({
          key: columnKey || String(columnIndex + 1),
          label: columnLabels[columnKey] || columnKey,
          value: normalizeValue(row[columnKey]),
        })),
      })),
    },
  }
}

export function mergeReviewSectionsWithFormDataTables(sections, formData) {
  const safeSections = Array.isArray(sections) ? sections.map((section) => ({ ...section, items: Array.isArray(section?.items) ? [...section.items] : [] })) : []
  const safeFormData = isRecord(formData) ? formData : {}

  const isCambridgeItem = {
    key: 'isCambridgeStudent',
    label: 'Học sinh có học hệ Cambridge không?',
    value: normalizeValue(safeFormData.isCambridgeStudent),
  }

  const scoreTableItem = buildFormDataTableItem('scoreTable', 'Bảng điểm', safeFormData.scoreTable, {
    label: 'Khối',
    grade: 'Lớp',
    vietnamese: 'Tiếng Việt',
    math: 'Toán',
    english: 'Tiếng Anh',
  }, ['label', 'grade', 'vietnamese', 'math', 'english'])

  const cambridgeScoreTableItem = buildFormDataTableItem('cambridgeScoreTable', 'Bảng điểm Cambridge', safeFormData.cambridgeScoreTable, {
    label: 'Khối',
    grade: 'Lớp',
    english: 'English',
    math: 'Math',
    science: 'Science',
  }, ['label', 'grade', 'english', 'math', 'science'])

  const extraItems = [isCambridgeItem, scoreTableItem, cambridgeScoreTableItem]
    .filter(Boolean)

  if (extraItems.length === 0) return safeSections

  const targetSectionIndex = safeSections.findIndex((section) =>
    Array.isArray(section?.items) && section.items.some((item) => ['isCambridgeStudent', 'scoreTable', 'cambridgeScoreTable'].includes(item?.key))
  )

  if (targetSectionIndex >= 0) {
    const existingSection = safeSections[targetSectionIndex]
    const existingKeys = new Set((existingSection.items || []).map((item) => item?.key).filter(Boolean))
    extraItems.forEach((item) => {
      if (item?.key === 'isCambridgeStudent') {
        const index = existingSection.items.findIndex((entry) => entry?.key === 'isCambridgeStudent')
        if (index >= 0) existingSection.items[index] = item
        else existingSection.items.unshift(item)
        return
      }

      if (!existingKeys.has(item?.key)) {
        existingSection.items.push(item)
      }
    })
    return safeSections
  }

  return [
    ...safeSections,
    {
      key: 'study-tables-fallback',
      title: 'Thông tin học tập và điểm sơ tuyển',
      items: extraItems,
    },
  ]
}

export function formatSnapshotDate(value) {
  return formatDate(value) || '-'
}
