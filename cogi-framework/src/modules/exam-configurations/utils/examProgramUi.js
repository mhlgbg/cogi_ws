import { normalizeExamConfigurationPagination, toText } from './examConfigurationUi'
import { formatExamConfigMoney } from './examSubjectUi'

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

export const EXAM_PROGRAM_FEE_METHOD_OPTIONS = [
  { value: '', label: 'Tất cả cách tính lệ phí' },
  { value: 'sum_subject_fees', label: 'Theo tổng lệ phí môn thi' },
  { value: 'fixed', label: 'Lệ phí cố định' },
]

export const EXAM_PROGRAM_SORT_OPTIONS = [
  { value: 'code:asc', label: 'Mã chương trình A-Z' },
  { value: 'code:desc', label: 'Mã chương trình Z-A' },
  { value: 'name:asc', label: 'Tên chương trình A-Z' },
  { value: 'name:desc', label: 'Tên chương trình Z-A' },
  { value: 'updatedAt:desc', label: 'Cập nhật gần nhất' },
  { value: 'updatedAt:asc', label: 'Cập nhật cũ nhất' },
]

export function normalizeExamProgramSubjectSummary(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null
  const examSubject = normalizeEntity(entity.examSubject)
  return {
    id: entity.id,
    displayOrder: Number(entity.displayOrder || 0) || 0,
    isRequired: entity.isRequired !== false,
    feeOverride: toNumberOrNull(entity.feeOverride),
    examSubjectId: examSubject?.id || '',
    examSubjectDocumentId: toText(examSubject?.documentId),
    examSubjectCode: toText(examSubject?.code),
    examSubjectName: toText(examSubject?.name),
    examSubjectCalculationMethod: toText(examSubject?.calculationMethod).toLowerCase(),
    examSubjectRequiredAggregateScore: toNumberOrNull(examSubject?.requiredAggregateScore),
    examSubjectRequireAllComponents: examSubject?.requireAllComponents !== false,
    examSubjectDefaultFee: toNumberOrNull(examSubject?.defaultFee),
    examSubjectIsActive: examSubject?.isActive !== false,
    examSubjectRuleDescription: toText(examSubject?.ruleDescription),
  }
}

export function normalizeExamProgram(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null
  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    code: toText(entity.code),
    name: toText(entity.name),
    passingMethod: toText(entity.passingMethod).toLowerCase(),
    feeCalculationMethod: toText(entity.feeCalculationMethod).toLowerCase(),
    defaultFee: toNumberOrNull(entity.defaultFee),
    targetDescription: toText(entity.targetDescription),
    validFrom: entity.validFrom || null,
    validTo: entity.validTo || null,
    isActive: entity.isActive !== false,
    programSubjectCount: entity.programSubjectCount === null || entity.programSubjectCount === undefined ? null : Number(entity.programSubjectCount),
    createdAt: entity.createdAt || null,
    updatedAt: entity.updatedAt || null,
    programSubjects: Array.isArray(entity.programSubjects)
      ? entity.programSubjects.map(normalizeExamProgramSubjectSummary).filter(Boolean)
      : [],
  }
}

export function normalizeExamProgramCollection(payload) {
  return Array.isArray(payload?.data)
    ? payload.data.map(normalizeExamProgram).filter(Boolean)
    : []
}

export function getExamProgramFeeCalculationMethodLabel(value) {
  const normalized = toText(value).toLowerCase()
  if (normalized === 'sum_subject_fees') return 'Theo tổng lệ phí môn thi'
  if (normalized === 'fixed') return 'Lệ phí cố định'
  return normalized || '-'
}

export function getExamProgramPassingMethodLabel(value) {
  const normalized = toText(value).toLowerCase()
  if (normalized === 'all_subjects_pass') return 'Phải đạt tất cả môn'
  if (normalized === 'any_subject_pass') return 'Chỉ cần đạt một môn'
  if (normalized === 'custom') return 'Tùy chỉnh'
  return normalized || '-'
}

export function getExamProgramStatusMeta(isActive) {
  return isActive === false
    ? { label: 'Ngừng sử dụng', color: 'secondary' }
    : { label: 'Đang hoạt động', color: 'success' }
}

export function formatExamProgramDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatExamProgramFee(value, feeCalculationMethod) {
  if (feeCalculationMethod === 'fixed') {
    return value === null ? 'Chưa cấu hình đầy đủ' : formatExamConfigMoney(value)
  }
  return value === null ? 'Không áp dụng' : formatExamConfigMoney(value)
}

export function formatExamProgramSubjectFee(item) {
  if (item?.feeOverride !== null && item?.feeOverride !== undefined) {
    return `Override: ${formatExamConfigMoney(item.feeOverride)}`
  }
  if (item?.examSubjectDefaultFee !== null && item?.examSubjectDefaultFee !== undefined) {
    return `Theo môn: ${formatExamConfigMoney(item.examSubjectDefaultFee)}`
  }
  return 'Chưa cấu hình'
}

export function getExamProgramSubjectEffectiveFee(item) {
  if (item?.feeOverride !== null && item?.feeOverride !== undefined) {
    return { source: 'override', value: item.feeOverride }
  }
  if (item?.examSubjectDefaultFee !== null && item?.examSubjectDefaultFee !== undefined) {
    return { source: 'default', value: item.examSubjectDefaultFee }
  }
  return { source: 'missing', value: null }
}

export function getExamProgramSubjectEffectivePassingRule(item) {
  return {
    source: 'default',
    label: item?.examSubjectRuleDescription
      ? 'Theo môn: Quy tắc tùy chỉnh'
      : `Theo môn: ${item?.examSubjectCalculationMethod || '-'}`,
  }
}

export function buildExamProgramListParams({
  page = 1,
  pageSize = 10,
  search = '',
  isActive = '',
  feeCalculationMethod = '',
  sortBy = 'code',
  sortOrder = 'asc',
} = {}) {
  const params = { page, pageSize }
  const keyword = toText(search)
  if (keyword) params.search = keyword
  if (isActive) params.isActive = isActive
  if (feeCalculationMethod) params.feeCalculationMethod = feeCalculationMethod
  const normalizedSortBy = ['code', 'name', 'updatedAt'].includes(toText(sortBy)) ? toText(sortBy) : 'code'
  const normalizedSortOrder = toText(sortOrder).toLowerCase() === 'desc' ? 'desc' : 'asc'
  params['sort[0]'] = `${normalizedSortBy}:${normalizedSortOrder}`
  return params
}

export function normalizeExamProgramListResponse(payload) {
  return {
    rows: normalizeExamProgramCollection(payload),
    pagination: normalizeExamConfigurationPagination(payload),
  }
}