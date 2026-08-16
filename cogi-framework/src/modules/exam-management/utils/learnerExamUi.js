import { getApiMessage, normalizeStatus, toText } from './examRoundUi'

export function normalizeLearnerExamRoundItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id || 0) || 0,
    documentId: toText(raw.documentId) || null,
    code: toText(raw.code),
    name: toText(raw.name),
    shortDescription: toText(raw.shortDescription) || null,
    academicYear: toText(raw.academicYear) || null,
    semester: toText(raw.semester) || null,
    registrationStartAt: raw.registrationStartAt || null,
    registrationEndAt: raw.registrationEndAt || null,
    examStartAt: raw.examStartAt || null,
    examEndAt: raw.examEndAt || null,
    registrationMode: normalizeStatus(raw.registrationMode) || null,
    paymentCalculationMethod: normalizeStatus(raw.paymentCalculationMethod) || null,
    fixedFee: Number(raw.fixedFee || 0) || 0,
    status: normalizeStatus(raw.status) || null,
    learnerState: normalizeStatus(raw.learnerState) || 'missing',
    requiresLearnerCreation: raw.requiresLearnerCreation === true,
    registrationWindowState: normalizeStatus(raw.registrationWindowState) || null,
    canRegister: raw.canRegister === true,
    canView: raw.canView !== false,
    reasonCode: toText(raw.reasonCode) || null,
    eligibility: raw.eligibility ? {
      registrationMode: normalizeStatus(raw.eligibility.registrationMode) || null,
      status: normalizeStatus(raw.eligibility.status) || null,
      reason: toText(raw.eligibility.reason) || null,
    } : null,
    existingRegistration: raw.existingRegistration ? {
      id: Number(raw.existingRegistration.id || 0) || 0,
      documentId: toText(raw.existingRegistration.documentId) || null,
      registrationCode: toText(raw.existingRegistration.registrationCode),
      registrationStatus: toText(raw.existingRegistration.registrationStatus) || null,
      paymentStatus: toText(raw.existingRegistration.paymentStatus) || null,
      payableAmount: Number(raw.existingRegistration.payableAmount || 0) || 0,
      registeredAt: raw.existingRegistration.registeredAt || null,
    } : null,
  }
}

export function normalizeCurrentLearner(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id || 0) || 0,
    documentId: toText(raw.documentId) || null,
    code: toText(raw.code),
    fullName: toText(raw.fullName),
    dateOfBirth: raw.dateOfBirth || null,
    className: toText(raw.className) || null,
  }
}

export function normalizeLearnerSupport(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    organizationName: toText(raw.organizationName) || null,
    supportPhone: toText(raw.supportPhone) || null,
    supportEmail: toText(raw.supportEmail) || null,
    supportWebsite: toText(raw.supportWebsite) || null,
    supportNote: toText(raw.supportNote) || null,
  }
}

export function normalizeLearnerExamRoundDetail(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    user: raw.user || null,
    learner: normalizeCurrentLearner(raw.learner),
    learnerState: normalizeStatus(raw.learnerState) || 'missing',
    support: normalizeLearnerSupport(raw.support),
    serverNow: raw.serverNow || null,
    examRound: raw.examRound ? {
      id: Number(raw.examRound.id || 0) || 0,
      documentId: toText(raw.examRound.documentId) || null,
      code: toText(raw.examRound.code),
      name: toText(raw.examRound.name),
      academicYear: toText(raw.examRound.academicYear) || null,
      semester: toText(raw.examRound.semester) || null,
      status: normalizeStatus(raw.examRound.status) || null,
      registrationMode: normalizeStatus(raw.examRound.registrationMode) || null,
      registrationStartAt: raw.examRound.registrationStartAt || null,
      registrationEndAt: raw.examRound.registrationEndAt || null,
      examStartAt: raw.examRound.examStartAt || null,
      examEndAt: raw.examRound.examEndAt || null,
      instructions: raw.examRound.instructions || '',
      paymentInstructions: raw.examRound.paymentInstructions || '',
    } : null,
    availability: raw.availability ? {
      registrationWindowState: normalizeStatus(raw.availability.registrationWindowState) || null,
      canRegister: raw.availability.canRegister === true,
      requiresLearnerCreation: raw.availability.requiresLearnerCreation === true,
      reasonCode: toText(raw.availability.reasonCode) || null,
    } : null,
    eligibility: raw.eligibility ? {
      registrationMode: normalizeStatus(raw.eligibility.registrationMode) || null,
      status: normalizeStatus(raw.eligibility.status) || null,
      reason: toText(raw.eligibility.reason) || null,
    } : null,
    existingRegistration: raw.existingRegistration ? {
      id: Number(raw.existingRegistration.id || 0) || 0,
      documentId: toText(raw.existingRegistration.documentId) || null,
      registrationCode: toText(raw.existingRegistration.registrationCode),
      registrationStatus: toText(raw.existingRegistration.registrationStatus) || null,
      paymentStatus: toText(raw.existingRegistration.paymentStatus) || null,
      payableAmount: Number(raw.existingRegistration.payableAmount || 0) || 0,
      registeredAt: raw.existingRegistration.registeredAt || null,
    } : null,
    configuration: raw.configuration ? {
      allowSubjectSelection: raw.configuration.allowSubjectSelection === true,
      allowComponentSelection: raw.configuration.allowComponentSelection === true,
      paymentCalculationMethod: normalizeStatus(raw.configuration.paymentCalculationMethod) || null,
      requireConfirmedPayment: raw.configuration.requireConfirmedPayment === true,
      fixedFee: Number(raw.configuration.fixedFee || 0) || 0,
    } : null,
    subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
    feePreview: raw.feePreview || null,
  }
}

export function normalizeLearnerRegistrationOptions(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    examRound: raw.examRound ? {
      id: Number(raw.examRound.id || 0) || 0,
      documentId: toText(raw.examRound.documentId) || null,
      code: toText(raw.examRound.code),
      name: toText(raw.examRound.name),
      status: normalizeStatus(raw.examRound.status) || null,
      registrationStartAt: raw.examRound.registrationStartAt || null,
      registrationEndAt: raw.examRound.registrationEndAt || null,
      examStartAt: raw.examRound.examStartAt || null,
      examEndAt: raw.examRound.examEndAt || null,
    } : null,
    learner: normalizeCurrentLearner(raw.learner),
    canRegister: raw.canRegister === true,
    reasonCode: toText(raw.reasonCode) || null,
    registrationWindowState: normalizeStatus(raw.registrationWindowState) || null,
    existingRegistration: raw.existingRegistration ? {
      id: Number(raw.existingRegistration.id || 0) || 0,
      documentId: toText(raw.existingRegistration.documentId) || null,
      registrationCode: toText(raw.existingRegistration.registrationCode),
      registrationStatus: toText(raw.existingRegistration.registrationStatus) || null,
      paymentStatus: toText(raw.existingRegistration.paymentStatus) || null,
      payableAmount: Number(raw.existingRegistration.payableAmount || 0) || 0,
      registeredAt: raw.existingRegistration.registeredAt || null,
    } : null,
    allowSubjectSelection: raw.allowSubjectSelection === true,
    allowComponentSelection: raw.allowComponentSelection === true,
    paymentCalculationMethod: normalizeStatus(raw.paymentCalculationMethod) || null,
    paymentRequired: raw.paymentRequired === true,
    paymentConfigured: raw.paymentConfigured === true,
    paymentDueAt: raw.paymentDueAt || null,
    eligibility: raw.eligibility ? {
      registrationMode: normalizeStatus(raw.eligibility.registrationMode) || null,
      status: normalizeStatus(raw.eligibility.status) || null,
      reason: toText(raw.eligibility.reason) || null,
    } : null,
    subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
    feeConfiguration: raw.feeConfiguration || null,
    feePreview: raw.feePreview || null,
  }
}

export function normalizeCreateLearnerExamRegistrationResult(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    registration: raw.registration || null,
    subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
    fee: raw.fee || null,
    payment: raw.payment || null,
    detailPath: toText(raw.detailPath) || null,
  }
}

export function normalizeLearnerExamRegistrationDetail(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    user: raw.user || null,
    support: normalizeLearnerSupport(raw.support),
    registration: raw.registration || null,
    learner: raw.learner || null,
    examRound: raw.examRound || null,
    subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
    fee: raw.fee || null,
    payment: raw.payment || null,
    paymentReport: raw.paymentReport || null,
    status: raw.status || null,
    review: raw.review || null,
  }
}

export function normalizeLearnerProfileContext(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    examRound: raw.examRound ? {
      id: Number(raw.examRound.id || 0) || 0,
      documentId: toText(raw.examRound.documentId) || null,
      code: toText(raw.examRound.code),
      name: toText(raw.examRound.name),
      registrationMode: normalizeStatus(raw.examRound.registrationMode) || null,
      status: normalizeStatus(raw.examRound.status) || null,
      registrationStartAt: raw.examRound.registrationStartAt || null,
      registrationEndAt: raw.examRound.registrationEndAt || null,
    } : null,
    userProfile: raw.userProfile ? {
      id: Number(raw.userProfile.id || 0) || 0,
      displayName: toText(raw.userProfile.displayName),
      email: toText(raw.userProfile.email),
      phone: toText(raw.userProfile.phone) || '',
      username: toText(raw.userProfile.username) || null,
    } : null,
    learner: normalizeCurrentLearner(raw.learner),
    learnerState: normalizeStatus(raw.learnerState) || 'missing',
    support: normalizeLearnerSupport(raw.support),
    existingRegistration: raw.existingRegistration ? {
      id: Number(raw.existingRegistration.id || 0) || 0,
      documentId: toText(raw.existingRegistration.documentId) || null,
      registrationCode: toText(raw.existingRegistration.registrationCode),
      registrationStatus: toText(raw.existingRegistration.registrationStatus) || null,
      paymentStatus: toText(raw.existingRegistration.paymentStatus) || null,
      payableAmount: Number(raw.existingRegistration.payableAmount || 0) || 0,
      registeredAt: raw.existingRegistration.registeredAt || null,
    } : null,
    eligibility: raw.eligibility ? {
      registrationMode: normalizeStatus(raw.eligibility.registrationMode) || null,
      status: normalizeStatus(raw.eligibility.status) || null,
      reason: toText(raw.eligibility.reason) || null,
    } : null,
    canCreateLearnerForRound: raw.canCreateLearnerForRound === true,
    canContinueRegistration: raw.canContinueRegistration === true,
    reasonCode: toText(raw.reasonCode) || null,
  }
}

export function normalizeLearnerExamRoundCollection(payload) {
  return Array.isArray(payload?.data)
    ? payload.data.map(normalizeLearnerExamRoundItem).filter(Boolean)
    : []
}

export function normalizePagination(payload) {
  const pagination = payload?.meta?.pagination || payload?.pagination || {}
  return {
    page: Number(pagination.page || 1) || 1,
    pageSize: Number(pagination.pageSize || 12) || 12,
    total: Number(pagination.total || 0) || 0,
    pageCount: Number(pagination.pageCount || 1) || 1,
  }
}

export function getLearnerExamReasonLabel(reasonCode) {
  const normalized = normalizeStatus(reasonCode)
  const mapping = {
    registration_window_not_started: 'Chưa đến thời gian đăng ký.',
    exam_registration_not_started: 'Chưa đến thời gian đăng ký.',
    registration_window_ended: 'Thời gian đăng ký đã kết thúc.',
    exam_registration_window_expired: 'Thời gian đăng ký đã kết thúc.',
    exam_round_registration_paused: 'Đợt thi đang tạm dừng nhận đăng ký.',
    exam_round_registration_closed: 'Đợt thi đã đóng đăng ký.',
    exam_registration_not_open: 'Đợt thi hiện chưa mở đăng ký.',
    exam_round_not_ready_for_registration: 'Đợt thi hiện chưa sẵn sàng để đăng ký.',
    exam_round_not_available: 'Đợt thi hiện chưa sẵn sàng để đăng ký.',
    exam_registration_already_exists: 'Bạn đã có hồ sơ đăng ký.',
    invalid_fee_configuration: 'Cấu hình lệ phí của đợt thi hiện chưa hợp lệ.',
    payment_profile_not_configured: 'Đợt thi chưa có snapshot thông tin thanh toán hợp lệ.',
    payment_settings_invalid: 'Thông tin thanh toán của đợt thi hiện chưa hợp lệ.',
    payment_template_invalid: 'Nội dung chuyển khoản mẫu của đợt thi hiện chưa hợp lệ.',
    exam_learner_not_eligible: 'Bạn chưa thuộc danh sách đủ điều kiện đăng ký đợt thi này.',
    exam_learner_temporarily_ineligible: 'Bạn hiện tạm thời chưa đủ điều kiện đăng ký đợt thi này.',
    exam_eligibility_pending: 'Điều kiện dự thi của bạn đang chờ xác định.',
    learner_required_for_restricted_round: 'Đợt thi này chỉ dành cho người học đã được xác định đủ điều kiện. Vui lòng sử dụng đúng tài khoản đã liên kết hoặc liên hệ nhà trường.',
    learner_profile_required: 'Bạn cần có hồ sơ người học để tiếp tục đăng ký đợt thi này.',
    learner_not_eligible: 'Bạn chưa thuộc danh sách đủ điều kiện đăng ký đợt thi này.',
    exam_round_open_for_profile_creation: 'Bạn có thể khai thông tin người học khi bắt đầu đăng ký đợt thi này.',
    learner_creation_not_allowed_for_restricted_round: 'Đợt thi này chỉ dành cho người học đã được nhà trường xác định đủ điều kiện. Tài khoản hiện chưa liên kết với hồ sơ người học phù hợp. Vui lòng liên hệ nhà trường.',
    learner_already_linked_to_another_user: 'Thông tin người học đã tồn tại và đang được liên kết với tài khoản khác. Vui lòng liên hệ nhà trường để được hỗ trợ.',
    learner_requires_manual_linking: 'Thông tin người học đã tồn tại trong hệ thống nhưng chưa thể liên kết tự động với tài khoản này. Vui lòng liên hệ nhà trường để được kiểm tra và hỗ trợ.',
    learner_duplicate_suspected: 'Hệ thống phát hiện thông tin người học có dấu hiệu trùng và cần được kiểm tra thủ công trước khi liên kết.',
    learner_code_already_exists: 'Mã người học đã tồn tại trong hệ thống của đơn vị này.',
  }
  return mapping[normalized] || null
}

export function getLearnerExamStatusMeta(item) {
  if (item?.existingRegistration?.id) return { label: 'Đã đăng ký', color: 'info' }
  if (item?.status === 'registration_open' && item?.registrationWindowState === 'within' && item?.canRegister) {
    return { label: 'Đang mở đăng ký', color: 'success' }
  }
  if ((item?.status === 'approved' || item?.status === 'registration_open') && item?.registrationWindowState === 'before') {
    return { label: 'Sắp mở đăng ký', color: 'warning' }
  }
  if (item?.status === 'registration_paused') return { label: 'Tạm dừng đăng ký', color: 'warning' }
  if (item?.status === 'registration_closed') return { label: 'Đã đóng đăng ký', color: 'secondary' }
  return { label: 'Đã kết thúc hoặc chưa khả dụng', color: 'secondary' }
}

export function getCurrentLearnerApiMessage(error, fallback) {
  const code = toText(error?.response?.data?.code || error?.response?.data?.error?.code)
  const mapped = {
    LEARNER_NOT_LINKED_TO_USER: 'Tài khoản của bạn chưa được liên kết với người học nào trong hệ thống.',
    CURRENT_USER_HAS_NO_LEARNER: 'Tài khoản của bạn chưa được liên kết với người học nào trong hệ thống.',
    CURRENT_USER_HAS_MULTIPLE_LEARNERS: 'Tài khoản hiện có nhiều learner liên kết và chưa được hỗ trợ ở bước này.',
    LEARNER_REQUIRED_FOR_RESTRICTED_ROUND: 'Đợt thi này yêu cầu tài khoản đã liên kết với learner đủ điều kiện.',
    LEARNER_NOT_ELIGIBLE: 'Bạn chưa thuộc danh sách đủ điều kiện đăng ký đợt thi này.',
    LEARNER_PROFILE_REQUIRED: 'Bạn cần có hồ sơ người học để tiếp tục thao tác này.',
    EXAM_ROUND_OPEN_FOR_PROFILE_CREATION: 'Bạn có thể khai thông tin người học khi bắt đầu đăng ký đợt thi này.',
    LEARNER_CREATION_NOT_ALLOWED_FOR_RESTRICTED_ROUND: 'Đợt thi này không cho phép tự tạo hồ sơ người học để đăng ký.',
    LEARNER_ALREADY_LINKED_TO_USER: 'Tài khoản đã được liên kết với hồ sơ người học. Bạn có thể tiếp tục đăng ký.',
    LEARNER_CODE_ALREADY_EXISTS: 'Mã người học đã tồn tại trong hệ thống của đơn vị này.',
    LEARNER_ALREADY_LINKED_TO_ANOTHER_USER: 'Thông tin người học đã tồn tại và đang được liên kết với tài khoản khác.',
    LEARNER_REQUIRES_MANUAL_LINKING: 'Thông tin người học đã tồn tại trong hệ thống nhưng chưa thể liên kết tự động với tài khoản này.',
    LEARNER_DUPLICATE_SUSPECTED: 'Hệ thống phát hiện thông tin người học có dấu hiệu trùng và cần được kiểm tra thủ công.',
    INVALID_LEARNER_CODE: 'Mã người học không hợp lệ.',
    INVALID_DATE_OF_BIRTH: 'Ngày sinh không hợp lệ.',
    INVALID_PHONE: 'Số điện thoại không hợp lệ.',
    INVALID_EMAIL: 'Email không hợp lệ.',
    CONCURRENT_LEARNER_CREATION: 'Yêu cầu tạo hồ sơ người học đang được xử lý đồng thời. Vui lòng thử lại.',
    EXAM_ROUND_NOT_AVAILABLE: 'Đợt thi hiện không khả dụng cho learner hiện tại.',
    EXAM_ROUND_NOT_FOUND: 'Không tìm thấy đợt thi trong tenant hiện tại.',
    EXAM_ROUND_REGISTRATION_NOT_OPEN: 'Đợt thi hiện chưa mở đăng ký.',
    EXAM_REGISTRATION_NOT_STARTED: 'Chưa đến thời gian đăng ký.',
    REGISTRATION_WINDOW_NOT_STARTED: 'Chưa đến thời gian đăng ký.',
    EXAM_REGISTRATION_WINDOW_EXPIRED: 'Thời gian đăng ký đã kết thúc.',
    REGISTRATION_WINDOW_ENDED: 'Thời gian đăng ký đã kết thúc.',
    EXAM_ROUND_REGISTRATION_PAUSED: 'Đợt thi đang tạm dừng nhận đăng ký.',
    EXAM_ROUND_REGISTRATION_CLOSED: 'Đợt thi đã đóng đăng ký.',
    EXAM_LEARNER_NOT_ELIGIBLE: 'Bạn chưa thuộc danh sách đủ điều kiện đăng ký đợt thi này.',
    EXAM_LEARNER_TEMPORARILY_INELIGIBLE: 'Bạn hiện tạm thời chưa đủ điều kiện đăng ký đợt thi này.',
    EXAM_ELIGIBILITY_PENDING: 'Điều kiện dự thi của bạn đang chờ xác định.',
    EXAM_REGISTRATION_ALREADY_EXISTS: 'Bạn đã có hồ sơ đăng ký cho đợt thi này.',
    INVALID_SUBJECT_SELECTION: 'Danh sách môn thi bạn chọn không hợp lệ.',
    INVALID_COMPONENT_SELECTION: 'Danh sách kỹ năng/phần thi bạn chọn không hợp lệ.',
    REQUIRED_SUBJECT_MISSING: 'Bạn chưa chọn đủ môn thi bắt buộc.',
    REQUIRED_COMPONENT_MISSING: 'Bạn chưa chọn đủ kỹ năng/phần thi bắt buộc.',
    COMPONENT_SUBJECT_MISMATCH: 'Có kỹ năng/phần thi không thuộc các môn thi đã chọn.',
    INVALID_FEE_CONFIGURATION: 'Cấu hình lệ phí của đợt thi hiện chưa hợp lệ.',
    PAYMENT_PROFILE_NOT_CONFIGURED: 'Đợt thi chưa có snapshot thông tin thanh toán hợp lệ.',
    PAYMENT_SETTINGS_INVALID: 'Thông tin thanh toán của đợt thi hiện chưa hợp lệ.',
    PAYMENT_TEMPLATE_INVALID: 'Nội dung chuyển khoản mẫu của đợt thi hiện chưa hợp lệ.',
    PAYMENT_NOT_REQUIRED: 'Hồ sơ đăng ký này không yêu cầu thanh toán.',
    PAYMENT_ALREADY_REPORTED: 'Bạn đã gửi thông báo chuyển tiền cho hồ sơ này.',
    PAYMENT_ALREADY_CONFIRMED: 'Thanh toán của hồ sơ này đã được xác nhận.',
    PAYMENT_REPORT_NOT_ALLOWED: 'Hồ sơ này hiện không cho phép báo chuyển tiền.',
    REGISTRATION_CANCELLED: 'Hồ sơ đăng ký đã bị hủy.',
    REGISTRATION_REJECTED: 'Hồ sơ đăng ký đã bị từ chối.',
    INVALID_PAYMENT_TRANSFER_AT: 'Thời điểm chuyển tiền không hợp lệ.',
    INVALID_PAYMENT_SENDER_NAME: 'Tên người chuyển tiền không hợp lệ.',
    INVALID_PAYMENT_EVIDENCE: 'Chứng từ thanh toán không hợp lệ.',
    PAYMENT_EVIDENCE_TOO_LARGE: 'Chứng từ thanh toán vượt quá dung lượng cho phép.',
    PAYMENT_EVIDENCE_UNSUPPORTED_TYPE: 'Loại file chứng từ chưa được hỗ trợ.',
    CONCURRENT_PAYMENT_REPORT: 'Yêu cầu báo chuyển tiền đang được xử lý đồng thời. Vui lòng tải lại hồ sơ.',
    UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.',
  }[code]
  return mapped || getApiMessage(error, fallback)
}

export function getRegistrationStatusLabel(status) {
  const normalized = normalizeStatus(status)
  return {
    draft: 'Nháp',
    submitted: 'Đã nộp',
    pending_review: 'Chờ xét duyệt',
    accepted: 'Đã duyệt',
    returned: 'Cần kiểm tra / bổ sung',
    rejected: 'Bị từ chối',
    cancelled: 'Đã hủy',
    completed: 'Hoàn thành',
  }[normalized] || (normalized || '-')
}

export function getPaymentStatusLabel(status) {
  const normalized = normalizeStatus(status)
  return {
    not_required: 'Không yêu cầu thanh toán',
    unpaid: 'Chưa thanh toán',
    payment_reported: 'Đã báo chuyển khoản',
    payment_under_review: 'Đang kiểm tra thanh toán',
    partially_paid: 'Thanh toán một phần',
    paid: 'Đã thanh toán',
    payment_rejected: 'Thanh toán bị từ chối',
    exempted: 'Miễn phí',
    refund_pending: 'Chờ hoàn tiền',
    refunded: 'Đã hoàn tiền',
  }[normalized] || (normalized || '-')
}

export function getRegistrationStatusBadge(status) {
  const normalized = normalizeStatus(status)
  return {
    draft: { color: 'dark', label: 'Nháp' },
    submitted: { color: 'info', label: 'Đã nộp' },
    pending_review: { color: 'warning', label: 'Chờ xét duyệt' },
    accepted: { color: 'success', label: 'Đã duyệt' },
    returned: { color: 'warning', label: 'Cần kiểm tra / bổ sung' },
    rejected: { color: 'danger', label: 'Bị từ chối' },
    cancelled: { color: 'secondary', label: 'Đã hủy' },
    completed: { color: 'success', label: 'Hoàn thành' },
  }[normalized] || { color: 'secondary', label: normalized || '-' }
}

export function getPaymentStatusBadge(status) {
  const normalized = normalizeStatus(status)
  return {
    not_required: { color: 'success', label: 'Không yêu cầu thanh toán' },
    unpaid: { color: 'warning', label: 'Chưa thanh toán' },
    payment_reported: { color: 'info', label: 'Đã báo chuyển khoản' },
    payment_under_review: { color: 'primary', label: 'Đang kiểm tra thanh toán' },
    partially_paid: { color: 'info', label: 'Thanh toán một phần' },
    paid: { color: 'success', label: 'Đã thanh toán' },
    payment_rejected: { color: 'danger', label: 'Thanh toán bị từ chối' },
    exempted: { color: 'success', label: 'Miễn phí' },
    refund_pending: { color: 'warning', label: 'Chờ hoàn tiền' },
    refunded: { color: 'secondary', label: 'Đã hoàn tiền' },
  }[normalized] || { color: 'secondary', label: normalized || '-' }
}

export function groupLearnerExamRounds(items = []) {
  const buckets = {
    registered: [],
    opening: [],
    upcoming: [],
    closed: [],
  }

  items.forEach((item) => {
    if (item?.existingRegistration?.id) {
      buckets.registered.push(item)
      return
    }

    if (item?.status === 'registration_open' && item?.registrationWindowState === 'within') {
      buckets.opening.push(item)
      return
    }

    if ((item?.status === 'approved' || item?.status === 'registration_open') && item?.registrationWindowState === 'before') {
      buckets.upcoming.push(item)
      return
    }

    buckets.closed.push(item)
  })

  return buckets
}

export function getLearnerActionLabel(item) {
  if (item?.existingRegistration?.id) return 'Xem hồ sơ đăng ký'
  if (item?.canRegister && item?.requiresLearnerCreation) return 'Khai thông tin và đăng ký'
  if (item?.canRegister) return 'Đăng ký dự thi'
  return null
}