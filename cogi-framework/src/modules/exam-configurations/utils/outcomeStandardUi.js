import { normalizeExamConfigurationPagination, toText } from './examConfigurationUi'
import { formatExamProgramDate } from './examProgramUi'

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

export const OUTCOME_RECOGNITION_METHOD_OPTIONS = [
  { value: '', label: 'Tất cả loại công nhận' },
  { value: 'exam_program', label: 'Theo chương trình thi' },
  { value: 'certificate', label: 'Theo chứng chỉ' },
  { value: 'exemption', label: 'Miễn trừ' },
  { value: 'equivalent_result', label: 'Kết quả tương đương' },
  { value: 'multiple_methods', label: 'Nhiều phương thức' },
]

export const OUTCOME_STANDARD_SORT_OPTIONS = [
  { value: 'code:asc', label: 'Mã chuẩn A-Z' },
  { value: 'code:desc', label: 'Mã chuẩn Z-A' },
  { value: 'name:asc', label: 'Tên chuẩn A-Z' },
  { value: 'name:desc', label: 'Tên chuẩn Z-A' },
  { value: 'updatedAt:desc', label: 'Cập nhật gần nhất' },
  { value: 'updatedAt:asc', label: 'Cập nhật cũ nhất' },
]

export function normalizeOutcomeStandard(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null
  const examProgram = normalizeEntity(entity.examProgram)
  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    code: toText(entity.code),
    name: toText(entity.name),
    applicableDescription: toText(entity.applicableDescription),
    recognitionMethod: toText(entity.recognitionMethod).toLowerCase(),
    validFrom: entity.validFrom || null,
    validTo: entity.validTo || null,
    isActive: entity.isActive !== false,
    createdAt: entity.createdAt || null,
    updatedAt: entity.updatedAt || null,
    examProgramId: examProgram?.id || null,
    examProgramDocumentId: toText(examProgram?.documentId),
    examProgramCode: toText(examProgram?.code),
    examProgramName: toText(examProgram?.name),
    examProgramIsActive: examProgram ? examProgram.isActive !== false : null,
  }
}

export function normalizeOutcomeStandardCollection(payload) {
  return Array.isArray(payload?.data)
    ? payload.data.map(normalizeOutcomeStandard).filter(Boolean)
    : []
}

export function getOutcomeRecognitionMethodLabel(value) {
  const normalized = toText(value).toLowerCase()
  if (normalized === 'exam_program') return 'Theo chương trình thi'
  if (normalized === 'certificate') return 'Theo chứng chỉ'
  if (normalized === 'exemption') return 'Miễn trừ'
  if (normalized === 'equivalent_result') return 'Kết quả tương đương'
  if (normalized === 'multiple_methods') return 'Nhiều phương thức'
  return normalized || '-'
}

export function getOutcomeStatusMeta(isActive) {
  return isActive === false
    ? { label: 'Ngừng sử dụng', color: 'secondary' }
    : { label: 'Đang hoạt động', color: 'success' }
}

export function formatOutcomeEffectiveDateRange(item) {
  const left = formatExamProgramDate(item?.validFrom)
  const right = formatExamProgramDate(item?.validTo)
  if (left === '-' && right === '-') return '-'
  return `${left} - ${right}`
}

export function buildOutcomeStandardListParams({
  page = 1,
  pageSize = 10,
  search = '',
  isActive = '',
  recognitionMethod = '',
  examProgramId = '',
  sortBy = 'code',
  sortOrder = 'asc',
} = {}) {
  const params = { page, pageSize }
  const keyword = toText(search)
  if (keyword) params.search = keyword
  if (isActive) params.isActive = isActive
  if (recognitionMethod) params.recognitionMethod = recognitionMethod
  if (examProgramId) params.examProgramId = examProgramId
  const normalizedSortBy = ['code', 'name', 'updatedAt'].includes(toText(sortBy)) ? toText(sortBy) : 'code'
  const normalizedSortOrder = toText(sortOrder).toLowerCase() === 'desc' ? 'desc' : 'asc'
  params['sort[0]'] = `${normalizedSortBy}:${normalizedSortOrder}`
  return params
}

export function normalizeOutcomeStandardListResponse(payload) {
  return {
    rows: normalizeOutcomeStandardCollection(payload),
    pagination: normalizeExamConfigurationPagination(payload),
  }
}