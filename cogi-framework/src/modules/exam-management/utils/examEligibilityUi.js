import { getApiMessage, normalizeStatus, toText } from './examRoundUi'

export const EXAM_ELIGIBILITY_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xác định' },
  { value: 'eligible', label: 'Đủ điều kiện' },
  { value: 'temporarily_ineligible', label: 'Tạm thời chưa đủ điều kiện' },
  { value: 'ineligible', label: 'Không đủ điều kiện' },
]

export const EXAM_ELIGIBILITY_SOURCE_OPTIONS = [
  { value: 'manual', label: 'Thủ công' },
  { value: 'imported', label: 'Nhập liệu' },
  { value: 'synchronized', label: 'Đồng bộ' },
  { value: 'rule_based', label: 'Theo quy tắc' },
]

export function getEligibilityStatusMeta(status) {
  const normalized = normalizeStatus(status)
  const mapping = {
    pending: { label: 'Chờ xác định', color: 'warning' },
    eligible: { label: 'Đủ điều kiện', color: 'success' },
    temporarily_ineligible: { label: 'Tạm thời chưa đủ điều kiện', color: 'warning' },
    ineligible: { label: 'Không đủ điều kiện', color: 'danger' },
  }
  return mapping[normalized] || { label: normalized || '-', color: 'secondary' }
}

export function getEligibilitySourceLabel(source) {
  const normalized = normalizeStatus(source)
  if (normalized === 'manual') return 'Thủ công'
  if (normalized === 'imported') return 'Nhập liệu'
  if (normalized === 'synchronized') return 'Đồng bộ'
  if (normalized === 'rule_based') return 'Theo quy tắc'
  return normalized || '-'
}

export function getRegistrationStateLabel(registrationSummary) {
  return registrationSummary?.registrationCode ? 'Đã đăng ký' : 'Chưa đăng ký'
}

export function normalizeExamEligibility(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id || 0) || 0,
    examRoundId: Number(raw.examRoundId || 0) || null,
    learner: raw.learner ? {
      id: Number(raw.learner.id || 0) || 0,
      code: toText(raw.learner.code),
      fullName: toText(raw.learner.fullName),
      dateOfBirth: toText(raw.learner.dateOfBirth) || null,
      parentPhone: toText(raw.learner.parentPhone) || null,
      learnerStatus: toText(raw.learner.learnerStatus) || 'active',
      className: toText(raw.learner.className) || null,
      cohort: toText(raw.learner.cohort) || null,
      major: toText(raw.learner.major) || null,
    } : null,
    eligibilityStatus: normalizeStatus(raw.eligibilityStatus) || 'pending',
    source: normalizeStatus(raw.source) || 'manual',
    reason: toText(raw.reason) || null,
    note: toText(raw.note) || null,
    reviewedAt: raw.reviewedAt || null,
    reviewedBy: raw.reviewedBy || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    registrationSummary: raw.registrationSummary ? {
      id: Number(raw.registrationSummary.id || 0) || 0,
      documentId: toText(raw.registrationSummary.documentId) || null,
      registrationCode: toText(raw.registrationSummary.registrationCode),
      registrationStatus: toText(raw.registrationSummary.registrationStatus) || null,
      paymentStatus: toText(raw.registrationSummary.paymentStatus) || null,
      payableAmount: Number(raw.registrationSummary.payableAmount || 0) || 0,
      registeredAt: raw.registrationSummary.registeredAt || null,
    } : null,
  }
}

export function normalizeExamEligibilityCollection(payload) {
  return Array.isArray(payload?.data)
    ? payload.data.map(normalizeExamEligibility).filter(Boolean)
    : []
}

export function normalizeLearnerLookupCollection(payload) {
  return Array.isArray(payload?.data)
    ? payload.data.map((item) => ({
        id: Number(item?.id || 0) || 0,
        code: toText(item?.code),
        fullName: toText(item?.fullName),
        dateOfBirth: toText(item?.dateOfBirth) || null,
        parentPhone: toText(item?.parentPhone) || null,
        learnerStatus: toText(item?.learnerStatus) || 'active',
        existingEligibility: item?.existingEligibility || null,
        registrationSummary: item?.registrationSummary || null,
      })).filter((item) => item.id > 0)
    : []
}

export function normalizePagination(payload) {
  const pagination = payload?.meta?.pagination || payload?.pagination || {}
  return {
    page: Number(pagination.page || 1) || 1,
    pageSize: Number(pagination.pageSize || 10) || 10,
    total: Number(pagination.total || 0) || 0,
    pageCount: Number(pagination.pageCount || 1) || 1,
  }
}

export function normalizeEligibilitySummary(payload) {
  const summary = payload?.meta?.summary || {}
  return {
    pending: Number(summary.pending || 0) || 0,
    eligible: Number(summary.eligible || 0) || 0,
    temporarilyIneligible: Number(summary.temporarilyIneligible || 0) || 0,
    ineligible: Number(summary.ineligible || 0) || 0,
    registered: Number(summary.registered || 0) || 0,
    notRegistered: Number(summary.notRegistered || 0) || 0,
  }
}

export function getExamEligibilityApiMessage(error, fallback) {
  const code = toText(error?.response?.data?.code || error?.response?.data?.error?.code)
  const mapped = {
    EXAM_ELIGIBILITY_NOT_FOUND: 'Không tìm thấy bản ghi đối tượng đăng ký trong đợt thi hiện tại.',
    EXAM_ELIGIBILITY_ALREADY_EXISTS: 'Learner đã có eligibility trong đợt thi này.',
    EXAM_ELIGIBILITY_DUPLICATE_FOUND: 'Danh sách learner gửi lên có learner đã tồn tại trong đợt thi.',
    EXAM_ELIGIBILITY_NOT_EDITABLE: 'Đợt thi hiện không cho phép thay đổi eligibility.',
    LEARNER_NOT_FOUND: 'Không tìm thấy learner trong tenant hiện tại.',
    INVALID_ELIGIBILITY_STATUS: 'Trạng thái eligibility không hợp lệ.',
    INVALID_ELIGIBILITY_SOURCE: 'Nguồn eligibility không hợp lệ.',
    ELIGIBILITY_REASON_REQUIRED: 'Bạn cần nhập lý do cho trạng thái này.',
    BULK_ITEMS_REQUIRED: 'Bạn cần chọn ít nhất một learner.',
    BULK_LIMIT_EXCEEDED: 'Số lượng learner vượt quá giới hạn xử lý hàng loạt.',
    DUPLICATE_LEARNER_IN_PAYLOAD: 'Danh sách learner gửi lên đang bị trùng.',
    INVALID_DUPLICATE_HANDLING: 'Cấu hình xử lý trùng lặp không hợp lệ.',
    INVALID_REGISTRATION_STATE: 'Bộ lọc trạng thái đăng ký không hợp lệ.',
    EXAM_ELIGIBILITY_HAS_ACTIVE_REGISTRATION: 'Learner đã có đăng ký dự thi đang hiệu lực.',
    UNKNOWN_FIELDS: 'Biểu mẫu gửi lên có trường không hợp lệ.',
  }[code]
  return mapped || getApiMessage(error, fallback)
}

export function mapExamEligibilityFieldErrors(error) {
  const code = toText(error?.response?.data?.code || error?.response?.data?.error?.code)
  const details = error?.response?.data?.details?.errors
  const fieldErrors = {}

  if (code === 'ELIGIBILITY_REASON_REQUIRED') fieldErrors.reason = 'Bạn cần nhập lý do.'
  if (Array.isArray(details)) {
    details.forEach((item) => {
      if (item?.path === 'reason') fieldErrors.reason = item?.message || 'Lý do không hợp lệ.'
      if (item?.path === 'eligibilityStatus') fieldErrors.eligibilityStatus = item?.message || 'Trạng thái không hợp lệ.'
      if (item?.path === 'learnerId') fieldErrors.learnerId = item?.message || 'Learner không hợp lệ.'
    })
  }

  return fieldErrors
}