import { resolveMediaUrl } from '../../../utils/mediaUrl'

export const EXAM_ROUND_TABS = [
  { key: 'overview', label: 'Tổng quan', placeholder: false },
  { key: 'configuration', label: 'Cấu hình', placeholder: true },
  { key: 'structure', label: 'Cấu trúc môn thi', placeholder: true },
  { key: 'eligibilities', label: 'Đối tượng đăng ký', placeholder: true },
  { key: 'registrations', label: 'Đăng ký', placeholder: false },
  { key: 'payments', label: 'Thanh toán', placeholder: true },
  { key: 'reviews', label: 'Xét duyệt', placeholder: false },
  { key: 'venues-rooms', label: 'Địa điểm & phòng', placeholder: false },
  { key: 'schedules', label: 'Lịch thi', placeholder: false },
  { key: 'allocation', label: 'Phân bổ thí sinh', placeholder: false },
  { key: 'candidate-lists', label: 'Danh sách thi', placeholder: false },
  { key: 'attendance', label: 'Điểm danh', placeholder: true },
  { key: 'activity', label: 'Nhật ký', placeholder: true },
]

export function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function formatDateTime(value) {
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

export function formatDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function formatMoney(value) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return '0'
  return new Intl.NumberFormat('vi-VN').format(parsed)
}

export function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeStatus(value) {
  return toText(value).toLowerCase()
}

export function getApiMessage(error, fallback) {
  const code = toText(error?.response?.data?.code || error?.response?.data?.error?.code)
  const backendMessage = toText(
    error?.response?.data?.error?.message
    || error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message,
  )

  const mapped = {
    EXAM_ROUND_NOT_FOUND: 'Không tìm thấy đợt thi trong tenant hiện tại.',
    EXAM_ROUND_BASE_CONFIGURATION_LOCKED: 'Đợt thi đã được phê duyệt. Các thông tin cấu hình nền không thể chỉnh sửa.',
    EXAM_ROUND_CANNOT_BE_SUBMITTED: 'Đợt thi hiện không thể trình duyệt.',
    EXAM_ROUND_NOT_READY_FOR_APPROVAL: 'Đợt thi chưa sẵn sàng để trình/phê duyệt.',
    EXAM_ROUND_SELF_APPROVAL_NOT_ALLOWED: 'Người đã trình duyệt không được tự phê duyệt cùng đợt thi.',
    EXAM_ROUND_CANNOT_BE_APPROVED: 'Đợt thi hiện không thể phê duyệt.',
    EXAM_ROUND_CANNOT_BE_RETURNED: 'Đợt thi hiện không thể trả lại bản nháp.',
    EXAM_ROUND_CANNOT_OPEN_REGISTRATION: 'Đợt thi hiện không thể mở đăng ký.',
    EXAM_ROUND_CANNOT_PAUSE_REGISTRATION: 'Đợt thi hiện không thể tạm dừng đăng ký.',
    EXAM_ROUND_CANNOT_RESUME_REGISTRATION: 'Đợt thi hiện không thể tiếp tục đăng ký.',
    EXAM_ROUND_CANNOT_CLOSE_REGISTRATION: 'Đợt thi hiện không thể đóng đăng ký.',
    REGISTRATION_WINDOW_EXPIRED: 'Cửa sổ đăng ký đã kết thúc.',
    RETURN_REASON_REQUIRED: 'Bạn cần nhập lý do trả lại.',
    REGISTRATION_PAUSE_REASON_REQUIRED: 'Bạn cần nhập lý do tạm dừng đăng ký.',
    UNKNOWN_FIELDS: 'Biểu mẫu gửi lên có trường không hợp lệ.',
  }[code]

  return mapped || backendMessage || fallback
}

export function getExamErrorCode(error) {
  return toText(error?.response?.data?.code || error?.response?.data?.error?.code)
}

export function getExamErrorDetails(error) {
  const details = error?.response?.data?.details
  if (Array.isArray(details?.errors)) return details.errors
  return []
}

export function getExamRoundStatusMeta(status) {
  const normalized = normalizeStatus(status)
  const mapping = {
    draft: { label: 'Bản nháp', color: 'dark' },
    pending_approval: { label: 'Chờ phê duyệt', color: 'warning' },
    approved: { label: 'Đã phê duyệt', color: 'info' },
    registration_open: { label: 'Đang mở đăng ký', color: 'success' },
    registration_paused: { label: 'Tạm dừng đăng ký', color: 'warning' },
    registration_closed: { label: 'Đã đóng đăng ký', color: 'secondary' },
    preparing_exam: { label: 'Chuẩn bị thi', color: 'primary' },
    exam_in_progress: { label: 'Đang thi', color: 'primary' },
    scoring: { label: 'Đang chấm thi', color: 'info' },
    completed: { label: 'Hoàn thành', color: 'success' },
    cancelled: { label: 'Đã hủy', color: 'danger' },
  }
  return mapping[normalized] || { label: normalized || '-', color: 'secondary' }
}

export function getRegistrationModeLabel(mode) {
  const normalized = normalizeStatus(mode)
  if (normalized === 'open') return 'Mở'
  if (normalized === 'restricted') return 'Có điều kiện'
  return normalized || '-'
}

export function getPaymentCalculationMethodLabel(method) {
  const normalized = normalizeStatus(method)
  if (normalized === 'fixed') return 'Phí cố định'
  if (normalized === 'program_fee') return 'Phí chương trình'
  if (normalized === 'subject_fee') return 'Phí theo môn'
  if (normalized === 'component_fee') return 'Phí theo kỹ năng/phần thi'
  return normalized || '-'
}

export function getPaymentMethodLabel(method) {
  const normalized = normalizeStatus(method)
  if (normalized === 'bank_transfer') return 'Chuyển khoản ngân hàng'
  if (normalized === 'cash') return 'Tiền mặt'
  if (normalized === 'other') return 'Khác'
  return normalized || '-'
}

export function getSubjectCalculationMethodLabel(method) {
  const normalized = normalizeStatus(method)
  if (normalized === 'total') return 'Tổng điểm'
  if (normalized === 'average') return 'Trung bình'
  if (normalized === 'all_components_pass') return 'Tất cả kỹ năng phải đạt'
  if (normalized === 'custom') return 'Theo mô tả riêng'
  return normalized || '-'
}

export function getExamMethodLabel(method) {
  const normalized = normalizeStatus(method)
  if (normalized === 'computer') return 'Máy tính'
  if (normalized === 'paper') return 'Trên giấy'
  if (normalized === 'oral') return 'Vấn đáp'
  if (normalized === 'practical') return 'Thực hành'
  if (normalized === 'mixed') return 'Kết hợp'
  if (normalized === 'other') return 'Khác'
  return normalized || '-'
}

export function getRegistrationWindowState(round, now = new Date()) {
  const registrationStartAt = round?.registrationStartAt ? new Date(round.registrationStartAt) : null
  const registrationEndAt = round?.registrationEndAt ? new Date(round.registrationEndAt) : null

  if (!registrationStartAt || !registrationEndAt) return 'missing_window'
  if (Number.isNaN(registrationStartAt.getTime()) || Number.isNaN(registrationEndAt.getTime())) return 'invalid_window'
  if (registrationStartAt.getTime() >= registrationEndAt.getTime()) return 'invalid_window'
  if (now.getTime() < registrationStartAt.getTime()) return 'before_window'
  if (now.getTime() > registrationEndAt.getTime()) return 'after_window'
  return 'within_window'
}

export function getRegistrationWindowLabel(state) {
  if (state === 'before_window') return 'Chưa đến thời gian đăng ký'
  if (state === 'within_window') return 'Đang trong thời gian đăng ký'
  if (state === 'after_window') return 'Đã hết thời gian đăng ký'
  if (state === 'missing_window') return 'Chưa cấu hình thời gian'
  if (state === 'invalid_window') return 'Cấu hình thời gian không hợp lệ'
  return '-'
}

export function getRegistrationOperationState(round) {
  const status = normalizeStatus(round?.status)
  if (status === 'registration_open') return 'open'
  if (status === 'registration_paused') return 'paused'
  if (status === 'registration_closed') return 'closed'
  if (status === 'approved') return 'ready_to_open'
  return 'not_available'
}

export function getExamRoundConfigurationAccess(round) {
  const access = round?.configurationAccess
  if (access && typeof access === 'object') {
    return {
      canEditBaseConfiguration: access.canEditBaseConfiguration === true,
      canEditPaymentSettings: access.canEditPaymentSettings === true,
      reasonCode: toText(access.reasonCode) || null,
      message: toText(access.message) || '',
      warningMessage: toText(access.warningMessage) || null,
      registrationOperationalState: normalizeStatus(access.registrationOperationalState) || getRegistrationOperationState(round),
      registrationCount: Number(access.registrationCount || 0) || 0,
    }
  }

  const status = normalizeStatus(round?.status)
  return {
    canEditBaseConfiguration: status === 'draft',
    canEditPaymentSettings: status === 'draft',
    reasonCode: null,
    message: status === 'draft' ? '' : 'Đợt thi đã được phê duyệt hoặc đang vận hành nên các thông tin cấu hình nền không thể chỉnh sửa.',
    warningMessage: null,
    registrationOperationalState: getRegistrationOperationState(round),
    registrationCount: Number(round?.registrationCount || 0) || 0,
  }
}

export function getRegistrationOperationLabel(state) {
  if (state === 'open') return 'Đang nhận đăng ký'
  if (state === 'paused') return 'Tạm dừng đăng ký'
  if (state === 'closed') return 'Đã đóng đăng ký'
  if (state === 'ready_to_open') return 'Sẵn sàng mở đăng ký'
  return 'Chưa sẵn sàng điều hành đăng ký'
}

export function canEditExamRound(round, permissions = {}) {
  return permissions?.canManage === true && getExamRoundConfigurationAccess(round).canEditBaseConfiguration === true
}

export function getExamRoundEditLockMessage(round, permissions = {}) {
  if (permissions?.canManage !== true) {
    return 'Bạn không có quyền quản trị để chỉnh sửa cấu hình đợt thi.'
  }

  return getExamRoundConfigurationAccess(round).message || ''
}

export function canSubmitExamRound(round, permissions = {}) {
  return canEditExamRound(round, permissions)
}

export function canApproveExamRound(round, _permissions = {}) {
  const status = normalizeStatus(round?.status)
  return status === 'pending_approval'
}

export function isSelfApprovalBlocked(round, currentUserId) {
  const submittedById = Number(round?.submittedBy?.id || 0) || 0
  const actorUserId = Number(currentUserId || 0) || 0
  return submittedById > 0 && actorUserId > 0 && submittedById === actorUserId
}

export function canReturnExamRound(round, permissions = {}) {
  const status = normalizeStatus(round?.status)
  return status === 'pending_approval' && (permissions?.canManage === true || permissions?.canApprove === true)
}

export function canOpenRegistration(round, permissions = {}, now = new Date()) {
  const status = normalizeStatus(round?.status)
  const windowState = getRegistrationWindowState(round, now)
  return permissions?.canManage === true && status === 'approved' && windowState !== 'after_window'
}

export function canPauseRegistration(round, permissions = {}) {
  const status = normalizeStatus(round?.status)
  return permissions?.canManage === true && status === 'registration_open'
}

export function canResumeRegistration(round, permissions = {}, now = new Date()) {
  const status = normalizeStatus(round?.status)
  const windowState = getRegistrationWindowState(round, now)
  return permissions?.canManage === true && status === 'registration_paused' && windowState !== 'after_window'
}

export function canCloseRegistration(round, permissions = {}) {
  const status = normalizeStatus(round?.status)
  return permissions?.canManage === true && (status === 'registration_open' || status === 'registration_paused')
}

export function getExamRoundWorkflowActions(round, permissions = {}) {
  const actions = []

  if (canSubmitExamRound(round, permissions)) {
    actions.push({
      key: 'submit',
      label: 'Gửi phê duyệt',
      color: 'primary',
      field: 'note',
      required: false,
      title: 'Gửi đợt thi để phê duyệt',
      confirmLabel: 'Gửi phê duyệt',
    })
  }

  if (canApproveExamRound(round, permissions)) {
    actions.push({
      key: 'approve',
      label: 'Phê duyệt',
      color: 'success',
      field: 'note',
      required: false,
      title: 'Phê duyệt đợt thi',
      confirmLabel: 'Phê duyệt',
    })
  }

  if (canReturnExamRound(round, permissions)) {
    actions.push({
      key: 'return',
      label: 'Trả về bản nháp',
      color: 'warning',
      field: 'reason',
      required: true,
      title: 'Trả đợt thi về bản nháp',
      confirmLabel: 'Trả về bản nháp',
    })
  }

  if (canOpenRegistration(round, permissions)) {
    actions.push({
      key: 'open',
      label: 'Mở đăng ký',
      color: 'success',
      field: 'note',
      required: false,
      title: 'Mở đăng ký dự thi',
      confirmLabel: 'Xác nhận mở đăng ký',
    })
  }

  if (canPauseRegistration(round, permissions)) {
    actions.push({
      key: 'pause',
      label: 'Tạm dừng đăng ký',
      color: 'warning',
      field: 'reason',
      required: true,
      title: 'Tạm dừng đăng ký',
      confirmLabel: 'Tạm dừng',
    })
  }

  if (canResumeRegistration(round, permissions)) {
    actions.push({
      key: 'resume',
      label: 'Tiếp tục đăng ký',
      color: 'success',
      field: 'note',
      required: false,
      title: 'Tiếp tục nhận đăng ký',
      confirmLabel: 'Tiếp tục',
    })
  }

  if (canCloseRegistration(round, permissions)) {
    actions.push({
      key: 'close',
      label: 'Đóng đăng ký',
      color: 'secondary',
      field: 'reason',
      required: false,
      title: 'Đóng đăng ký dự thi',
      confirmLabel: 'Đóng đăng ký',
    })
  }

  return actions
}

export function getExamRoundRelatedTabFromPath(path = '') {
  const normalized = toText(path)
  if (!normalized) return 'overview'
  if (normalized.startsWith('subjects[') || normalized.startsWith('components[')) return 'structure'
  if (
    normalized.startsWith('round.paymentCalculationMethod')
    || normalized.startsWith('round.fixedFee')
    || normalized.startsWith('round.allowSubjectSelection')
    || normalized.startsWith('round.allowComponentSelection')
  ) return 'configuration'
  return 'overview'
}

export function resolveExamRoundTab(pathname = '') {
  const path = toText(pathname)
  const matched = EXAM_ROUND_TABS.find((tab) => new RegExp(`/${tab.key}(?:/)?$`, 'i').test(path))
  return matched?.key || 'overview'
}

export function buildExamRoundPath(id, tab = 'overview', tenantCode = '') {
  const prefix = tenantCode ? `/t/${encodeURIComponent(tenantCode)}` : ''
  if (!id) return `${prefix}/exam-rounds`
  if (!tab || tab === 'overview') return `${prefix}/exam-rounds/${id}/overview`
  return `${prefix}/exam-rounds/${id}/${tab}`
}

export function buildExamRoundsPath(tenantCode = '') {
  const prefix = tenantCode ? `/t/${encodeURIComponent(tenantCode)}` : ''
  return `${prefix}/exam-rounds`
}

export function buildExamRoundCreatePath(tenantCode = '') {
  const prefix = tenantCode ? `/t/${encodeURIComponent(tenantCode)}` : ''
  return `${prefix}/exam-rounds/new`
}

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

function normalizeRelation(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) return raw.map(normalizeRelation).filter(Boolean)
  if (raw.data !== undefined) return normalizeRelation(raw.data)
  return normalizeEntity(raw)
}

function normalizeMedia(raw) {
  const entity = normalizeRelation(raw)
  if (!entity) return null
  return {
    id: Number(entity.id || 0) || 0,
    name: toText(entity.name) || null,
    url: resolveMediaUrl(toText(entity.url)) || null,
    mime: toText(entity.mime) || null,
  }
}

export function normalizeExamProgram(raw) {
  const entity = normalizeRelation(raw)
  if (!entity) return null
  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    code: toText(entity.code),
    name: toText(entity.name),
    isActive: entity.isActive !== false,
    feeCalculationMethod: normalizeStatus(entity.feeCalculationMethod),
    defaultFee: entity.defaultFee ?? null,
    passingMethod: normalizeStatus(entity.passingMethod),
  }
}

function normalizePaymentProfile(raw) {
  const entity = normalizeRelation(raw)
  if (!entity) return null
  return {
    id: Number(entity.id || 0) || 0,
    documentId: toText(entity.documentId) || null,
    name: toText(entity.name),
    code: toText(entity.code),
    paymentMethod: normalizeStatus(entity.paymentMethod) || 'bank_transfer',
    bankCode: toText(entity.bankCode),
    bankName: toText(entity.bankName),
    accountNumber: toText(entity.accountNumber),
    accountHolder: toText(entity.accountHolder),
    bankBranch: toText(entity.bankBranch),
    currency: toText(entity.currency) || 'VND',
    transferContentTemplate: toText(entity.transferContentTemplate),
    paymentInstruction: toText(entity.paymentInstruction),
    supportPhone: toText(entity.supportPhone),
    supportEmail: toText(entity.supportEmail),
    isActive: entity.isActive !== false,
    isDefault: entity.isDefault === true,
    sortOrder: Number(entity.sortOrder || 0) || 0,
    qrImage: normalizeMedia(entity.qrImage),
  }
}

function normalizeExamRoundComponent(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null
  return {
    id: Number(entity.id || 0) || 0,
    examRoundSubjectId: Number(entity?.examRoundSubject?.id || entity?.examRoundSubjectId || 0) || 0,
    nameSnapshot: toText(entity.nameSnapshot),
    status: normalizeStatus(entity.status) || 'active',
    isRequired: entity.isRequired !== false,
    allowSeparateRegistration: entity.allowSeparateRegistration === true,
    minimumScoreSnapshot: entity.minimumScoreSnapshot ?? null,
    maximumScoreSnapshot: entity.maximumScoreSnapshot ?? null,
    passingScoreSnapshot: entity.passingScoreSnapshot ?? null,
    eliminationScoreSnapshot: entity.eliminationScoreSnapshot ?? null,
    durationMinutes: entity.durationMinutes ?? null,
    fee: entity.fee ?? null,
    examMethod: normalizeStatus(entity.examMethod) || 'other',
    externalExamCode: toText(entity.externalExamCode),
    displayOrder: Number(entity.displayOrder || 0) || 0,
  }
}

function normalizeExamRoundSubject(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null
  return {
    id: Number(entity.id || 0) || 0,
    nameSnapshot: toText(entity.nameSnapshot),
    status: normalizeStatus(entity.status) || 'active',
    isRequired: entity.isRequired !== false,
    allowSeparateRegistration: entity.allowSeparateRegistration === true,
    fee: entity.fee ?? null,
    displayOrder: Number(entity.displayOrder || 0) || 0,
    calculationMethodSnapshot: normalizeStatus(entity.calculationMethodSnapshot) || 'total',
    requiredAggregateScoreSnapshot: entity.requiredAggregateScoreSnapshot ?? null,
    requireAllComponentsSnapshot: entity.requireAllComponentsSnapshot !== false,
    ruleDescriptionSnapshot: toText(entity.ruleDescriptionSnapshot),
  }
}

export function normalizeExamRound(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null
  const subjects = Array.isArray(entity.examRoundSubjects)
    ? entity.examRoundSubjects.map(normalizeExamRoundSubject).filter(Boolean)
    : Array.isArray(entity.examRoundSubjects?.data)
      ? entity.examRoundSubjects.data.map(normalizeExamRoundSubject).filter(Boolean)
      : []
  const components = Array.isArray(entity.examRoundComponents)
    ? entity.examRoundComponents.map(normalizeExamRoundComponent).filter(Boolean)
    : Array.isArray(entity.examRoundComponents?.data)
      ? entity.examRoundComponents.data.map(normalizeExamRoundComponent).filter(Boolean)
      : []
  const componentsBySubjectId = new Map()
  for (const component of components) {
    const subjectId = Number(component.examRoundSubjectId || 0) || 0
    if (!componentsBySubjectId.has(subjectId)) componentsBySubjectId.set(subjectId, [])
    componentsBySubjectId.get(subjectId).push(component)
  }
  const structureSubjects = subjects
    .map((subject) => ({
      ...subject,
      components: (componentsBySubjectId.get(subject.id) || []).slice().sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id),
    }))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id)

  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    code: toText(entity.code),
    name: toText(entity.name),
    academicYear: toText(entity.academicYear),
    semester: toText(entity.semester),
    status: normalizeStatus(entity.status),
    registrationMode: normalizeStatus(entity.registrationMode),
    registrationStartAt: entity.registrationStartAt || null,
    registrationEndAt: entity.registrationEndAt || null,
    paymentStartAt: entity.paymentStartAt || null,
    paymentEndAt: entity.paymentEndAt || null,
    candidateListClosingAt: entity.candidateListClosingAt || null,
    examStartAt: entity.examStartAt || null,
    examEndAt: entity.examEndAt || null,
    paymentCalculationMethod: normalizeStatus(entity.paymentCalculationMethod),
    fixedFee: entity.fixedFee ?? null,
    requireConfirmedPayment: entity.requireConfirmedPayment === true,
    allowSubjectSelection: entity.allowSubjectSelection === true,
    allowComponentSelection: entity.allowComponentSelection === true,
    allowCancellation: entity.allowCancellation === true,
    cancellationDeadline: entity.cancellationDeadline || null,
    updatedAt: entity.updatedAt || null,
    createdAt: entity.createdAt || null,
    instructions: entity.instructions || '',
    paymentInstructions: entity.paymentInstructions || '',
    paymentProfile: normalizePaymentProfile(entity.paymentProfile),
    paymentMethodSnapshot: normalizeStatus(entity.paymentMethodSnapshot) || null,
    paymentProfileNameSnapshot: toText(entity.paymentProfileNameSnapshot),
    paymentProfileCodeSnapshot: toText(entity.paymentProfileCodeSnapshot),
    paymentBankCodeSnapshot: toText(entity.paymentBankCodeSnapshot),
    paymentBankNameSnapshot: toText(entity.paymentBankNameSnapshot),
    paymentAccountNumberSnapshot: toText(entity.paymentAccountNumberSnapshot),
    paymentAccountHolderSnapshot: toText(entity.paymentAccountHolderSnapshot),
    paymentBankBranchSnapshot: toText(entity.paymentBankBranchSnapshot),
    paymentCurrencySnapshot: toText(entity.paymentCurrencySnapshot) || 'VND',
    paymentTransferContentTemplateSnapshot: toText(entity.paymentTransferContentTemplateSnapshot),
    paymentInstructionSnapshot: toText(entity.paymentInstructionSnapshot),
    paymentSupportPhoneSnapshot: toText(entity.paymentSupportPhoneSnapshot),
    paymentSupportEmailSnapshot: toText(entity.paymentSupportEmailSnapshot),
    paymentQrImageSnapshot: normalizeMedia(entity.paymentQrImageSnapshot),
    paymentProfileCustomized: entity.paymentProfileCustomized === true,
    paymentProfileAppliedAt: entity.paymentProfileAppliedAt || null,
    paymentProfileAppliedBy: normalizeRelation(entity.paymentProfileAppliedBy),
    paymentSettingsUpdatedAt: entity.paymentSettingsUpdatedAt || null,
    paymentSettingsUpdatedBy: normalizeRelation(entity.paymentSettingsUpdatedBy),
    examProgram: normalizeExamProgram(entity.examProgram),
    submittedBy: normalizeRelation(entity.submittedBy),
    submittedAt: entity.submittedAt || null,
    approvedBy: normalizeRelation(entity.approvedBy),
    approvedAt: entity.approvedAt || null,
    returnedBy: normalizeRelation(entity.returnedBy),
    returnedAt: entity.returnedAt || null,
    returnReason: toText(entity.returnReason),
    approvalNote: toText(entity.approvalNote),
    registrationOpenedBy: normalizeRelation(entity.registrationOpenedBy),
    registrationOpenedAt: entity.registrationOpenedAt || null,
    registrationPausedBy: normalizeRelation(entity.registrationPausedBy),
    registrationPausedAt: entity.registrationPausedAt || null,
    registrationPauseReason: toText(entity.registrationPauseReason),
    registrationResumedBy: normalizeRelation(entity.registrationResumedBy),
    registrationResumedAt: entity.registrationResumedAt || null,
    registrationClosedBy: normalizeRelation(entity.registrationClosedBy),
    registrationClosedAt: entity.registrationClosedAt || null,
    registrationCloseReason: toText(entity.registrationCloseReason),
    registrationCount: Number(entity.registrationCount || 0) || 0,
    eligibilityCount: Number(entity.eligibilityCount || 0) || 0,
    configurationAccess: entity.configurationAccess ? {
      canEditBaseConfiguration: entity.configurationAccess.canEditBaseConfiguration === true,
      canEditPaymentSettings: entity.configurationAccess.canEditPaymentSettings === true,
      reasonCode: toText(entity.configurationAccess.reasonCode) || null,
      message: toText(entity.configurationAccess.message) || '',
      warningMessage: toText(entity.configurationAccess.warningMessage) || null,
      registrationOperationalState: normalizeStatus(entity.configurationAccess.registrationOperationalState) || null,
      registrationCount: Number(entity.configurationAccess.registrationCount || 0) || 0,
    } : null,
    subjects: structureSubjects,
    paymentSettings: {
      paymentProfile: normalizePaymentProfile(entity.paymentProfile),
      snapshot: {
        paymentMethod: normalizeStatus(entity.paymentMethodSnapshot) || null,
        paymentProfileName: toText(entity.paymentProfileNameSnapshot),
        paymentProfileCode: toText(entity.paymentProfileCodeSnapshot),
        bankCode: toText(entity.paymentBankCodeSnapshot),
        bankName: toText(entity.paymentBankNameSnapshot),
        accountNumber: toText(entity.paymentAccountNumberSnapshot),
        accountHolder: toText(entity.paymentAccountHolderSnapshot),
        bankBranch: toText(entity.paymentBankBranchSnapshot),
        currency: toText(entity.paymentCurrencySnapshot) || 'VND',
        transferContentTemplate: toText(entity.paymentTransferContentTemplateSnapshot),
        paymentInstruction: toText(entity.paymentInstructionSnapshot),
        supportPhone: toText(entity.paymentSupportPhoneSnapshot),
        supportEmail: toText(entity.paymentSupportEmailSnapshot),
        qrImage: normalizeMedia(entity.paymentQrImageSnapshot),
      },
      customized: entity.paymentProfileCustomized === true,
      appliedAt: entity.paymentProfileAppliedAt || null,
      appliedBy: normalizeRelation(entity.paymentProfileAppliedBy),
      updatedAt: entity.paymentSettingsUpdatedAt || null,
      updatedBy: normalizeRelation(entity.paymentSettingsUpdatedBy),
    },
    structureSummary: subjects.length || components.length
      ? {
          subjectCount: subjects.length,
          componentCount: components.length,
          activeSubjectCount: subjects.filter((item) => normalizeStatus(item.status) === 'active').length,
          activeComponentCount: components.filter((item) => normalizeStatus(item.status) === 'active').length,
        }
      : null,
  }
}

export function buildExamRoundStructurePayload(round, overrides = {}) {
  const subjects = Array.isArray(round?.subjects)
    ? round.subjects.map((subject) => ({
        id: subject.id,
        status: normalizeStatus(subject.status) || 'active',
        isRequired: subject.isRequired === true,
        allowSeparateRegistration: subject.allowSeparateRegistration === true,
        fee: subject.fee === '' ? null : subject.fee,
        displayOrder: Number(subject.displayOrder || 0) || 0,
        calculationMethodSnapshot: normalizeStatus(subject.calculationMethodSnapshot) || 'total',
        requiredAggregateScoreSnapshot: subject.requiredAggregateScoreSnapshot === '' ? null : subject.requiredAggregateScoreSnapshot,
        requireAllComponentsSnapshot: subject.requireAllComponentsSnapshot === true,
        ruleDescriptionSnapshot: toText(subject.ruleDescriptionSnapshot) || null,
        components: Array.isArray(subject.components)
          ? subject.components.map((component) => ({
              id: component.id,
              status: normalizeStatus(component.status) || 'active',
              isRequired: component.isRequired === true,
              allowSeparateRegistration: component.allowSeparateRegistration === true,
              minimumScoreSnapshot: component.minimumScoreSnapshot === '' ? null : component.minimumScoreSnapshot,
              maximumScoreSnapshot: component.maximumScoreSnapshot === '' ? null : component.maximumScoreSnapshot,
              passingScoreSnapshot: component.passingScoreSnapshot === '' ? null : component.passingScoreSnapshot,
              eliminationScoreSnapshot: component.eliminationScoreSnapshot === '' ? null : component.eliminationScoreSnapshot,
              durationMinutes: component.durationMinutes === '' ? null : component.durationMinutes,
              fee: component.fee === '' ? null : component.fee,
              examMethod: normalizeStatus(component.examMethod) || 'other',
              externalExamCode: toText(component.externalExamCode) || null,
              displayOrder: Number(component.displayOrder || 0) || 0,
            }))
          : [],
      }))
    : []

  return {
    code: toText(overrides.code ?? round?.code),
    name: toText(overrides.name ?? round?.name),
    academicYear: toText(overrides.academicYear ?? round?.academicYear) || null,
    semester: toText(overrides.semester ?? round?.semester) || null,
    registrationMode: normalizeStatus(overrides.registrationMode ?? round?.registrationMode) || 'restricted',
    registrationStartAt: overrides.registrationStartAt ?? round?.registrationStartAt ?? null,
    registrationEndAt: overrides.registrationEndAt ?? round?.registrationEndAt ?? null,
    paymentStartAt: overrides.paymentStartAt ?? round?.paymentStartAt ?? null,
    paymentEndAt: overrides.paymentEndAt ?? round?.paymentEndAt ?? null,
    candidateListClosingAt: overrides.candidateListClosingAt ?? round?.candidateListClosingAt ?? null,
    examStartAt: overrides.examStartAt ?? round?.examStartAt ?? null,
    examEndAt: overrides.examEndAt ?? round?.examEndAt ?? null,
    paymentCalculationMethod: normalizeStatus(overrides.paymentCalculationMethod ?? round?.paymentCalculationMethod) || 'program_fee',
    fixedFee: (overrides.paymentCalculationMethod ?? round?.paymentCalculationMethod) === 'fixed'
      ? (overrides.fixedFee ?? round?.fixedFee ?? null)
      : null,
    allowSubjectSelection: overrides.allowSubjectSelection ?? round?.allowSubjectSelection === true,
    allowComponentSelection: overrides.allowComponentSelection ?? round?.allowComponentSelection === true,
    requireConfirmedPayment: overrides.requireConfirmedPayment ?? round?.requireConfirmedPayment === true,
    allowCancellation: overrides.allowCancellation ?? round?.allowCancellation === true,
    cancellationDeadline: overrides.allowCancellation === false
      ? null
      : (overrides.cancellationDeadline ?? round?.cancellationDeadline ?? null),
    instructions: overrides.instructions ?? round?.instructions ?? null,
    paymentInstructions: overrides.paymentInstructions ?? round?.paymentInstructions ?? null,
    subjects,
  }
}

export function normalizeCollectionData(payload) {
  return Array.isArray(payload?.data)
    ? payload.data.map(normalizeExamRound).filter(Boolean)
    : []
}

export function normalizeExamProgramCollection(payload) {
  return Array.isArray(payload?.data)
    ? payload.data.map(normalizeExamProgram).filter(Boolean)
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

export function buildExamRoundTimeline(status) {
  const steps = [
    { key: 'draft', label: 'Khởi tạo' },
    { key: 'pending_approval', label: 'Chờ phê duyệt' },
    { key: 'approved', label: 'Đã phê duyệt' },
    { key: 'registration_open', label: 'Đang nhận đăng ký' },
    { key: 'registration_closed', label: 'Đã đóng đăng ký' },
    { key: 'preparing_exam', label: 'Chuẩn bị thi' },
    { key: 'exam_in_progress', label: 'Đang thi' },
    { key: 'scoring', label: 'Chấm thi' },
    { key: 'completed', label: 'Hoàn thành' },
  ]
  const normalized = normalizeStatus(status)
  const currentIndex = steps.findIndex((item) => item.key === normalized)
  return steps.map((step, index) => ({
    ...step,
    state: normalized === 'cancelled'
      ? (index <= Math.max(currentIndex, 0) ? 'completed' : 'upcoming')
      : currentIndex === index
        ? 'current'
        : currentIndex > index
          ? 'completed'
          : 'upcoming',
  }))
}

export function canEditExamRoundPaymentSettings(round, permissions = {}) {
  return permissions?.canManage === true && getExamRoundConfigurationAccess(round).canEditPaymentSettings === true
}

export function isExamRoundPaymentOptional(round) {
  const fixedFee = Number(round?.fixedFee || 0)
  return normalizeStatus(round?.paymentCalculationMethod) === 'fixed' && fixedFee === 0 && round?.requireConfirmedPayment !== true
}