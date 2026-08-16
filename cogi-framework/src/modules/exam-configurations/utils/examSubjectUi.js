import { normalizeExamConfigurationPagination, toText } from './examConfigurationUi'

function normalizeEntity(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.attributes && typeof raw.attributes === 'object') {
    return {
      id: raw.id,
      ...raw.attributes,
      documentId: raw.attributes.documentId || raw.documentId || '',
    }
  }
  return raw
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export const EXAM_SUBJECT_CALCULATION_METHOD_OPTIONS = [
  { value: '', label: 'Tất cả cách tính' },
  { value: 'total', label: 'Tổng điểm' },
  { value: 'average', label: 'Điểm trung bình' },
  { value: 'all_components_pass', label: 'Tất cả kỹ năng đạt' },
  { value: 'custom', label: 'Tùy chỉnh' },
]

export const EXAM_SUBJECT_SORT_OPTIONS = [
  { value: 'code:asc', label: 'Mã môn A-Z' },
  { value: 'code:desc', label: 'Mã môn Z-A' },
  { value: 'name:asc', label: 'Tên môn A-Z' },
  { value: 'name:desc', label: 'Tên môn Z-A' },
  { value: 'updatedAt:desc', label: 'Cập nhật gần nhất' },
  { value: 'updatedAt:asc', label: 'Cập nhật cũ nhất' },
]

export function normalizeExamSubjectComponentSummary(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null
  const examComponent = normalizeEntity(entity.examComponent)

  return {
    id: entity.id,
    examComponentId: examComponent?.id || '',
    examComponentDocumentId: toText(examComponent?.documentId),
    examComponentCode: toText(examComponent?.code),
    examComponentName: toText(examComponent?.name),
    examComponentType: toText(examComponent?.componentType).toLowerCase(),
    examMethod: toText(examComponent?.examMethod).toLowerCase(),
    examComponentIsActive: examComponent?.isActive !== false,
    minimumScore: toNumberOrNull(examComponent?.minimumScore),
    maximumScore: toNumberOrNull(examComponent?.maximumScore),
    passingScore: toNumberOrNull(examComponent?.passingScore),
    eliminationScore: toNumberOrNull(examComponent?.eliminationScore),
    defaultDurationMinutes: toNumberOrNull(examComponent?.defaultDurationMinutes),
    displayOrder: Number(entity.displayOrder || 0) || 0,
    isRequired: entity.isRequired !== false,
    weight: toNumberOrNull(entity.weight),
    passingScoreOverride: toNumberOrNull(entity.passingScoreOverride),
    eliminationScoreOverride: toNumberOrNull(entity.eliminationScoreOverride),
    durationMinutesOverride: toNumberOrNull(entity.durationMinutesOverride),
  }
}

export function normalizeExamSubject(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null
  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    code: toText(entity.code),
    name: toText(entity.name),
    calculationMethod: toText(entity.calculationMethod).toLowerCase(),
    requiredAggregateScore: toNumberOrNull(entity.requiredAggregateScore),
    requireAllComponents: entity.requireAllComponents !== false,
    defaultFee: toNumberOrNull(entity.defaultFee),
    ruleDescription: toText(entity.ruleDescription),
    isActive: entity.isActive !== false,
    subjectComponentCount: entity.subjectComponentCount === null || entity.subjectComponentCount === undefined ? null : Number(entity.subjectComponentCount),
    createdAt: entity.createdAt || null,
    updatedAt: entity.updatedAt || null,
    subjectComponents: Array.isArray(entity.subjectComponents)
      ? entity.subjectComponents.map(normalizeExamSubjectComponentSummary).filter(Boolean)
      : [],
  }
}

export function normalizeExamSubjectCollection(payload) {
  return Array.isArray(payload?.data)
    ? payload.data.map(normalizeExamSubject).filter(Boolean)
    : []
}

export function getExamSubjectCalculationMethodLabel(value) {
  const normalized = toText(value).toLowerCase()
  if (normalized === 'total') return 'Tổng điểm'
  if (normalized === 'average') return 'Điểm trung bình'
  if (normalized === 'all_components_pass') return 'Tất cả kỹ năng đạt'
  if (normalized === 'custom') return 'Tùy chỉnh'
  return normalized || '-'
}

export function getExamSubjectStatusMeta(isActive) {
  return isActive === false
    ? { label: 'Ngừng sử dụng', color: 'secondary' }
    : { label: 'Đang hoạt động', color: 'success' }
}

export function formatExamConfigDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatExamConfigMoney(value) {
  if (value === null || value === undefined || value === '') return 'Chưa cấu hình'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 'Chưa cấu hình'
  return `${new Intl.NumberFormat('vi-VN').format(numeric)} VND`
}

export function getExamSubjectPassingSummary(subject) {
  const calculationMethod = toText(subject?.calculationMethod).toLowerCase()
  const requiredAggregateScore = toNumberOrNull(subject?.requiredAggregateScore)

  if (calculationMethod === 'total') {
    return requiredAggregateScore === null ? 'Chưa cấu hình đầy đủ' : `Tổng điểm >= ${requiredAggregateScore}`
  }
  if (calculationMethod === 'average') {
    return requiredAggregateScore === null ? 'Chưa cấu hình đầy đủ' : `Trung bình >= ${requiredAggregateScore}`
  }
  if (calculationMethod === 'all_components_pass') {
    return 'Tất cả kỹ năng phải đạt'
  }
  if (calculationMethod === 'custom') {
    return subject?.ruleDescription ? 'Theo mô tả cấu hình' : 'Chưa cấu hình đầy đủ'
  }
  return '-'
}

export function buildExamSubjectListParams({
  page = 1,
  pageSize = 10,
  search = '',
  isActive = '',
  calculationMethod = '',
  sortBy = 'code',
  sortOrder = 'asc',
} = {}) {
  const params = {
    page,
    pageSize,
  }

  const keyword = toText(search)
  if (keyword) params.search = keyword
  if (isActive) params.isActive = isActive
  if (calculationMethod) params.calculationMethod = calculationMethod

  const normalizedSortBy = ['code', 'name', 'updatedAt'].includes(toText(sortBy)) ? toText(sortBy) : 'code'
  const normalizedSortOrder = toText(sortOrder).toLowerCase() === 'desc' ? 'desc' : 'asc'
  params['sort[0]'] = `${normalizedSortBy}:${normalizedSortOrder}`

  return params
}

export function normalizeExamSubjectListResponse(payload) {
  return {
    rows: normalizeExamSubjectCollection(payload),
    pagination: normalizeExamConfigurationPagination(payload),
  }
}

export function getEffectivePassingScore(item) {
  if (item?.passingScoreOverride !== null && item?.passingScoreOverride !== undefined) {
    return { source: 'override', value: item.passingScoreOverride }
  }
  if (item?.passingScore !== null && item?.passingScore !== undefined) {
    return { source: 'default', value: item.passingScore }
  }
  return { source: 'missing', value: null }
}

export function getEffectiveDuration(item) {
  if (item?.durationMinutesOverride !== null && item?.durationMinutesOverride !== undefined) {
    return { source: 'override', value: item.durationMinutesOverride }
  }
  if (item?.defaultDurationMinutes !== null && item?.defaultDurationMinutes !== undefined) {
    return { source: 'default', value: item.defaultDurationMinutes }
  }
  return { source: 'missing', value: null }
}

export function getEffectiveEliminationScore(item) {
  if (item?.eliminationScoreOverride !== null && item?.eliminationScoreOverride !== undefined) {
    return { source: 'override', value: item.eliminationScoreOverride }
  }
  if (item?.eliminationScore !== null && item?.eliminationScore !== undefined) {
    return { source: 'default', value: item.eliminationScore }
  }
  return { source: 'missing', value: null }
}

export function formatEffectiveScore(meta) {
  if (!meta || meta.value === null || meta.value === undefined) return 'Chưa cấu hình'
  const prefix = meta.source === 'override' ? 'Override' : 'Theo kỹ năng'
  return `${prefix}: ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(meta.value))}`
}

export function formatEffectiveDuration(meta) {
  if (!meta || meta.value === null || meta.value === undefined) return 'Chưa cấu hình'
  const prefix = meta.source === 'override' ? 'Override' : 'Theo kỹ năng'
  return `${prefix}: ${meta.value} phút`
}