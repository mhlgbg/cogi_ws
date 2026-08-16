export const EXAM_CONFIGURATION_TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'components', label: 'Kỹ năng thi' },
  { key: 'subjects', label: 'Môn thi' },
  { key: 'programs', label: 'Chương trình thi' },
  { key: 'outcomes', label: 'Chuẩn đầu ra' },
]

export function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function getApiMessage(error, fallback) {
  const backendError = error?.response?.data?.error
  const backendMessage = toText((typeof backendError === 'string' ? backendError : backendError?.message) || error?.response?.data?.message || error?.message)
  return backendMessage || fallback
}

export function resolveExamComponentMutationError(error, fallback = 'Không thể lưu kỹ năng thi.') {
  const status = Number(error?.response?.status || error?.response?.data?.status || 0)
  const code = toText(error?.response?.data?.code).toUpperCase()
  const details = error?.response?.data?.details
  const fieldErrors = {}

  function assignFieldError(field, message) {
    if (!field || !message || fieldErrors[field]) return
    fieldErrors[field] = message
  }

  if (code === 'EXAM_COMPONENT_CODE_EXISTS' || code === 'EXAM_COMPONENT_ALREADY_EXISTS') {
    assignFieldError('code', 'Mã kỹ năng đã tồn tại trong tenant hiện tại.')
  }

  if (code === 'INVALID_PASSING_SCORE') {
    assignFieldError('passingScore', 'Điểm đạt phải nằm trong khoảng hợp lệ.')
  }

  if (code === 'INVALID_DURATION') {
    assignFieldError('defaultDurationMinutes', 'Thời lượng mặc định phải là số nguyên lớn hơn 0.')
  }

  if (code === 'INVALID_EXAM_METHOD') {
    assignFieldError('examMethod', 'Hình thức thi không hợp lệ.')
  }

  if (code === 'INVALID_SCORE_RANGE') {
    assignFieldError('minimumScore', 'Khoảng điểm không hợp lệ.')
    assignFieldError('maximumScore', 'Khoảng điểm không hợp lệ.')
  }

  if (details?.path === 'code') {
    assignFieldError('code', getApiMessage(error, 'Mã kỹ năng không hợp lệ.'))
  }

  if (details?.path === 'passingScore') {
    assignFieldError('passingScore', getApiMessage(error, 'Điểm đạt không hợp lệ.'))
  }

  if (details?.path === 'defaultDurationMinutes') {
    assignFieldError('defaultDurationMinutes', getApiMessage(error, 'Thời lượng mặc định không hợp lệ.'))
  }

  if (details?.path === 'examMethod') {
    assignFieldError('examMethod', getApiMessage(error, 'Hình thức thi không hợp lệ.'))
  }

  if (status === 401) {
    return { message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.', fieldErrors }
  }

  if (status === 403) {
    return { message: 'Bạn không có quyền thực hiện thao tác này.', fieldErrors }
  }

  if (status === 404 || code === 'EXAM_COMPONENT_NOT_FOUND') {
    return { message: 'Kỹ năng thi không còn tồn tại hoặc không thuộc tenant hiện tại.', fieldErrors }
  }

  if (!error?.response) {
    return { message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.', fieldErrors }
  }

  return {
    message: getApiMessage(error, fallback),
    fieldErrors,
  }
}

export function resolveExamConfigurationTab(pathname = '') {
  const path = toText(pathname)
  if (/\/exam-configurations\/components(?:\/|$)/i.test(path)) return 'components'
  if (/\/exam-configurations\/subjects(?:\/|$)/i.test(path)) return 'subjects'
  if (/\/exam-configurations\/programs(?:\/|$)/i.test(path)) return 'programs'
  if (/\/exam-configurations\/outcomes(?:\/|$)/i.test(path)) return 'outcomes'
  return 'overview'
}

export function buildExamConfigurationPath(tab = 'overview', tenantCode = '') {
  const prefix = tenantCode ? `/t/${encodeURIComponent(tenantCode)}` : ''
  if (!tab || tab === 'overview') return `${prefix}/exam-configurations`
  return `${prefix}/exam-configurations/${tab}`
}

export function buildExamConfigurationDetailPath(tab = 'components', id = '', tenantCode = '') {
  const basePath = buildExamConfigurationPath(tab, tenantCode)
  return id ? `${basePath}/${encodeURIComponent(id)}` : basePath
}

export function normalizeExamConfigurationPagination(payload) {
  const pagination = payload?.meta?.pagination || payload?.pagination || {}
  return {
    page: Number(pagination.page || 1) || 1,
    pageSize: Number(pagination.pageSize || 10) || 10,
    total: Number(pagination.total || 0) || 0,
    pageCount: Number(pagination.pageCount || 1) || 1,
  }
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

export function normalizeExamComponent(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null
  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    code: toText(entity.code),
    name: toText(entity.name),
    componentType: toText(entity.componentType).toLowerCase(),
    minimumScore: entity.minimumScore ?? null,
    maximumScore: entity.maximumScore ?? null,
    passingScore: entity.passingScore ?? null,
    eliminationScore: entity.eliminationScore ?? null,
    defaultDurationMinutes: entity.defaultDurationMinutes ?? null,
    examMethod: toText(entity.examMethod).toLowerCase(),
    displayOrder: entity.displayOrder ?? 0,
    isActive: entity.isActive !== false,
    description: toText(entity.description),
    updatedAt: entity.updatedAt || null,
    createdAt: entity.createdAt || null,
  }
}

export function normalizeExamComponentCollection(payload) {
  return Array.isArray(payload?.data)
    ? payload.data.map(normalizeExamComponent).filter(Boolean)
    : []
}

export function formatExamScore(value) {
  if (value === null || value === undefined || value === '') return '-'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(parsed)
}

export function getExamComponentTypeLabel(type) {
  const normalized = toText(type).toLowerCase()
  if (normalized === 'skill') return 'Kỹ năng'
  if (normalized === 'part') return 'Phần thi'
  return normalized || '-'
}

export function getExamMethodLabel(method) {
  const normalized = toText(method).toLowerCase()
  if (normalized === 'computer') return 'Trên máy tính'
  if (normalized === 'paper') return 'Trên giấy'
  if (normalized === 'oral') return 'Vấn đáp'
  if (normalized === 'practical') return 'Thực hành'
  if (normalized === 'mixed') return 'Kết hợp'
  if (normalized === 'other') return 'Khác'
  return normalized || '-'
}

export function getExamStatusBadgeMeta(isActive) {
  return isActive === false
    ? { label: 'Ngưng hoạt động', color: 'secondary' }
    : { label: 'Đang hoạt động', color: 'success' }
}

export function getExamConfigurationPlaceholderCopy(tab) {
  if (tab === 'components') {
    return {
      title: 'Kỹ năng thi',
      description: 'Đơn vị thi nhỏ nhất, ví dụ Nghe, Nói, Đọc, Viết, Lý thuyết hoặc Thực hành.',
      notice: 'Chức năng quản lý kỹ năng thi sẽ được triển khai ở bước tiếp theo.',
    }
  }
  if (tab === 'subjects') {
    return {
      title: 'Môn thi',
      description: 'Một môn thi gồm một hoặc nhiều kỹ năng thi, kèm điều kiện đạt, thứ tự và cấu hình lệ phí.',
      notice: 'Chức năng sẽ được triển khai ở bước tiếp theo.',
    }
  }
  if (tab === 'programs') {
    return {
      title: 'Chương trình thi',
      description: 'Một chương trình thi gồm một hoặc nhiều môn thi và được dùng làm nguồn tạo snapshot cho đợt thi.',
      notice: 'Chức năng sẽ được triển khai ở bước tiếp theo.',
    }
  }
  if (tab === 'outcomes') {
    return {
      title: 'Chuẩn đầu ra',
      description: 'Chuẩn đầu ra xác định chương trình hoặc điều kiện learner cần hoàn thành để được công nhận.',
      notice: 'Chức năng sẽ được triển khai ở bước tiếp theo.',
    }
  }
  return {
    title: 'Tổng quan',
    description: 'Quản lý các danh mục nền gồm kỹ năng thi, môn thi, chương trình thi và chuẩn đầu ra. Các cấu hình này được sử dụng để tạo cấu trúc cho các đợt thi.',
    notice: '',
  }
}

export function resolveExamSubjectReadError(error, fallback = 'Không thể tải dữ liệu môn thi.') {
  const status = Number(error?.response?.status || error?.response?.data?.status || 0)
  const code = toText(error?.response?.data?.code).toUpperCase()

  if (status === 401) return 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.'
  if (status === 403) return 'Bạn không có quyền xem dữ liệu môn thi.'
  if (status === 404 || code === 'EXAM_SUBJECT_NOT_FOUND') return 'Không tìm thấy môn thi hoặc môn thi không thuộc tenant hiện tại.'
  if (status >= 500) return 'Backend môn thi hiện chưa khả dụng. Vui lòng thử lại sau.'
  if (!error?.response) return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.'
  return getApiMessage(error, fallback)
}

export function resolveExamSubjectMutationError(error, fallback = 'Không thể lưu môn thi.') {
  const status = Number(error?.response?.status || error?.response?.data?.status || 0)
  const code = toText(error?.response?.data?.code).toUpperCase()
  const details = error?.response?.data?.details
  const fieldErrors = {}

  function assignFieldError(field, message) {
    if (!field || !message || fieldErrors[field]) return
    fieldErrors[field] = message
  }

  if (code === 'EXAM_SUBJECT_CODE_EXISTS' || code === 'EXAM_SUBJECT_ALREADY_EXISTS') {
    assignFieldError('code', 'Mã môn thi đã tồn tại trong tenant hiện tại.')
  }

  if (code === 'INVALID_CALCULATION_METHOD' || code === 'INVALID_PASSING_RULE') {
    assignFieldError('calculationMethod', 'Phương thức tính kết quả không hợp lệ.')
  }

  if (code === 'INVALID_SCORE_RANGE' || code === 'INVALID_PASSING_SCORE') {
    assignFieldError('requiredAggregateScore', 'Điểm yêu cầu không hợp lệ với phương thức tính hiện tại.')
  }

  if (code === 'INVALID_DEFAULT_FEE') {
    assignFieldError('defaultFee', 'Lệ phí mặc định không hợp lệ.')
  }

  if (code === 'INVALID_COMPONENT_WEIGHT') {
    assignFieldError('weight', 'Trọng số không hợp lệ.')
  }

  if (code === 'INVALID_COMPONENT_PASSING_SCORE') {
    assignFieldError('passingScoreOverride', 'Điểm override không hợp lệ so với thang điểm của kỹ năng.')
    assignFieldError('eliminationScoreOverride', 'Điểm override không hợp lệ so với thang điểm của kỹ năng.')
  }

  if (code === 'INVALID_COMPONENT_DURATION' || code === 'INVALID_DURATION') {
    assignFieldError('durationMinutesOverride', 'Thời lượng override không hợp lệ.')
  }

  if (code === 'EXAM_SUBJECT_COMPONENT_DUPLICATE') {
    return { message: 'Danh sách kỹ năng đang chứa phần tử trùng nhau.', fieldErrors }
  }

  if (code === 'EXAM_SUBJECT_COMPONENT_INVALID_TYPE') {
    return { message: 'Chỉ có kỹ năng thi mới được gán vào môn thi trong bước này.', fieldErrors }
  }

  if (code === 'EXAM_COMPONENT_NOT_FOUND') {
    return { message: 'Một hoặc nhiều kỹ năng không còn tồn tại hoặc không thuộc tenant hiện tại.', fieldErrors }
  }

  if (details?.path === 'code') {
    assignFieldError('code', getApiMessage(error, 'Mã môn thi không hợp lệ.'))
  }

  if (details?.path === 'calculationMethod') {
    assignFieldError('calculationMethod', getApiMessage(error, 'Phương thức tính kết quả không hợp lệ.'))
  }

  if (details?.path === 'requiredAggregateScore') {
    assignFieldError('requiredAggregateScore', getApiMessage(error, 'Điểm yêu cầu không hợp lệ.'))
  }

  if (details?.path === 'defaultFee') {
    assignFieldError('defaultFee', getApiMessage(error, 'Lệ phí mặc định không hợp lệ.'))
  }

  if (details?.path === 'weight') {
    assignFieldError('weight', getApiMessage(error, 'Trọng số không hợp lệ.'))
  }

  if (details?.path === 'passingScoreOverride') {
    assignFieldError('passingScoreOverride', getApiMessage(error, 'Điểm đạt override không hợp lệ.'))
  }

  if (details?.path === 'eliminationScoreOverride') {
    assignFieldError('eliminationScoreOverride', getApiMessage(error, 'Điểm liệt override không hợp lệ.'))
  }

  if (details?.path === 'durationMinutesOverride') {
    assignFieldError('durationMinutesOverride', getApiMessage(error, 'Thời lượng override không hợp lệ.'))
  }

  if (status === 401) {
    return { message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.', fieldErrors }
  }

  if (status === 403) {
    return { message: 'Bạn không có quyền thực hiện thao tác này.', fieldErrors }
  }

  if (status === 404 || code === 'EXAM_SUBJECT_NOT_FOUND') {
    return { message: 'Môn thi không còn tồn tại hoặc không thuộc tenant hiện tại.', fieldErrors }
  }

  if (!error?.response) {
    return { message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.', fieldErrors }
  }

  return {
    message: getApiMessage(error, fallback),
    fieldErrors,
  }
}

export function resolveExamProgramReadError(error, fallback = 'Không thể tải dữ liệu chương trình thi.') {
  const status = Number(error?.response?.status || error?.response?.data?.status || 0)
  const code = toText(error?.response?.data?.code).toUpperCase()
  if (status === 401) return 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.'
  if (status === 403) return 'Bạn không có quyền xem dữ liệu chương trình thi.'
  if (status === 404 || code === 'EXAM_PROGRAM_NOT_FOUND') return 'Không tìm thấy chương trình thi hoặc chương trình không thuộc tenant hiện tại.'
  if (status >= 500) return 'Backend chương trình thi hiện chưa khả dụng. Vui lòng thử lại sau.'
  if (!error?.response) return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.'
  return getApiMessage(error, fallback)
}

export function resolveExamProgramMutationError(error, fallback = 'Không thể lưu chương trình thi.') {
  const status = Number(error?.response?.status || error?.response?.data?.status || 0)
  const code = toText(error?.response?.data?.code).toUpperCase()
  const details = error?.response?.data?.details
  const fieldErrors = {}

  function assignFieldError(field, message) {
    if (!field || !message || fieldErrors[field]) return
    fieldErrors[field] = message
  }

  if (code === 'EXAM_PROGRAM_CODE_EXISTS' || code === 'EXAM_PROGRAM_ALREADY_EXISTS') {
    assignFieldError('code', 'Mã chương trình đã tồn tại trong tenant hiện tại.')
  }

  if (code === 'INVALID_PAYMENT_CALCULATION_METHOD') {
    assignFieldError('feeCalculationMethod', 'Phương thức tính lệ phí không hợp lệ.')
  }

  if (code === 'FIXED_FEE_REQUIRED' || code === 'INVALID_FIXED_FEE') {
    assignFieldError('defaultFee', 'Lệ phí mặc định không hợp lệ cho phương thức tính hiện tại.')
  }

  if (code === 'INVALID_PROGRAM_PASSING_METHOD') {
    assignFieldError('passingMethod', 'Quy tắc đạt chương trình không hợp lệ.')
  }

  if (code === 'EXAM_PROGRAM_SUBJECT_ALREADY_EXISTS') {
    return { message: 'Môn thi đang bị trùng trong cấu trúc chương trình.', fieldErrors }
  }

  if (code === 'EXAM_SUBJECT_INACTIVE') {
    return { message: 'Không thể thêm môn thi đang inactive vào chương trình.', fieldErrors }
  }

  if (code === 'EXAM_PROGRAM_SUBJECT_NOT_FOUND') {
    return { message: 'Quan hệ môn trong chương trình không còn tồn tại hoặc không thuộc tenant hiện tại.', fieldErrors }
  }

  if (code === 'INVALID_PROGRAM_SUBJECT_FEE') {
    assignFieldError('feeOverride', 'Lệ phí override không hợp lệ.')
  }

  if (details?.path === 'code') {
    assignFieldError('code', getApiMessage(error, 'Mã chương trình không hợp lệ.'))
  }
  if (details?.path === 'feeCalculationMethod') {
    assignFieldError('feeCalculationMethod', getApiMessage(error, 'Phương thức tính lệ phí không hợp lệ.'))
  }
  if (details?.path === 'defaultFee') {
    assignFieldError('defaultFee', getApiMessage(error, 'Lệ phí mặc định không hợp lệ.'))
  }
  if (details?.path === 'passingMethod') {
    assignFieldError('passingMethod', getApiMessage(error, 'Quy tắc đạt chương trình không hợp lệ.'))
  }
  if (details?.path === 'validFrom') {
    assignFieldError('validFrom', getApiMessage(error, 'Khoảng hiệu lực không hợp lệ.'))
  }
  if (details?.path === 'feeOverride') {
    assignFieldError('feeOverride', getApiMessage(error, 'Lệ phí override không hợp lệ.'))
  }

  if (status === 401) return { message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.', fieldErrors }
  if (status === 403) return { message: 'Bạn không có quyền thực hiện thao tác này.', fieldErrors }
  if (status === 404 || code === 'EXAM_PROGRAM_NOT_FOUND') return { message: 'Chương trình thi không còn tồn tại hoặc không thuộc tenant hiện tại.', fieldErrors }
  if (!error?.response) return { message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.', fieldErrors }
  return { message: getApiMessage(error, fallback), fieldErrors }
}

export function resolveOutcomeStandardReadError(error, fallback = 'Không thể tải dữ liệu chuẩn đầu ra.') {
  const status = Number(error?.response?.status || error?.response?.data?.status || 0)
  const code = toText(error?.response?.data?.code).toUpperCase()
  if (status === 401) return 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.'
  if (status === 403) return 'Bạn không có quyền xem dữ liệu chuẩn đầu ra.'
  if (status === 404 || code === 'OUTCOME_STANDARD_NOT_FOUND') return 'Không tìm thấy chuẩn đầu ra hoặc chuẩn không thuộc tenant hiện tại.'
  if (status >= 500) return 'Backend chuẩn đầu ra hiện chưa khả dụng. Vui lòng thử lại sau.'
  if (!error?.response) return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.'
  return getApiMessage(error, fallback)
}

export function resolveOutcomeStandardMutationError(error, fallback = 'Không thể lưu chuẩn đầu ra.') {
  const status = Number(error?.response?.status || error?.response?.data?.status || 0)
  const code = toText(error?.response?.data?.code).toUpperCase()
  const details = error?.response?.data?.details
  const fieldErrors = {}
  function assignFieldError(field, message) {
    if (!field || !message || fieldErrors[field]) return
    fieldErrors[field] = message
  }
  if (code === 'OUTCOME_STANDARD_CODE_EXISTS' || code === 'OUTCOME_STANDARD_ALREADY_EXISTS') assignFieldError('code', 'Mã chuẩn đầu ra đã tồn tại trong tenant hiện tại.')
  if (code === 'INVALID_OUTCOME_STANDARD_CONFIGURATION') assignFieldError('recognitionMethod', 'Cấu hình chuẩn đầu ra không hợp lệ.')
  if (code === 'INVALID_EFFECTIVE_DATE_RANGE') assignFieldError('validFrom', 'Khoảng hiệu lực không hợp lệ.')
  if (details?.path === 'code') assignFieldError('code', getApiMessage(error, 'Mã chuẩn đầu ra không hợp lệ.'))
  if (details?.path === 'recognitionMethod') assignFieldError('recognitionMethod', getApiMessage(error, 'Phương thức công nhận không hợp lệ.'))
  if (details?.path === 'validFrom') assignFieldError('validFrom', getApiMessage(error, 'Khoảng hiệu lực không hợp lệ.'))
  if (details?.path === 'examProgram') assignFieldError('examProgram', getApiMessage(error, 'Chương trình thi không hợp lệ.'))
  if (status === 401) return { message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.', fieldErrors }
  if (status === 403) return { message: 'Bạn không có quyền thực hiện thao tác này.', fieldErrors }
  if (status === 404 || code === 'OUTCOME_STANDARD_NOT_FOUND') return { message: 'Chuẩn đầu ra không còn tồn tại hoặc không thuộc tenant hiện tại.', fieldErrors }
  if (!error?.response) return { message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.', fieldErrors }
  return { message: getApiMessage(error, fallback), fieldErrors }
}