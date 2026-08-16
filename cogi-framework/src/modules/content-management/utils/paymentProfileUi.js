import { resolveMediaUrl } from '../../../utils/mediaUrl'

export function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function normalizeMedia(value) {
  if (!value || typeof value !== 'object') return null
  const id = Number(value.id || 0)
  return {
    id: Number.isInteger(id) && id > 0 ? id : null,
    name: toText(value.name) || null,
    url: resolveMediaUrl(toText(value.url || value.attributes?.url)) || '',
    mime: toText(value.mime) || null,
  }
}

export function normalizePaymentProfile(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id || 0) || 0,
    documentId: toText(raw.documentId) || null,
    name: toText(raw.name),
    code: toText(raw.code),
    description: toText(raw.description) || '',
    paymentMethod: toText(raw.paymentMethod).toLowerCase() || 'bank_transfer',
    bankCode: toText(raw.bankCode) || '',
    bankName: toText(raw.bankName) || '',
    accountNumber: toText(raw.accountNumber) || '',
    accountHolder: toText(raw.accountHolder) || '',
    bankBranch: toText(raw.bankBranch) || '',
    currency: toText(raw.currency) || 'VND',
    transferContentTemplate: toText(raw.transferContentTemplate) || '',
    paymentInstruction: toText(raw.paymentInstruction) || '',
    supportPhone: toText(raw.supportPhone) || '',
    supportEmail: toText(raw.supportEmail) || '',
    isActive: raw.isActive !== false,
    isDefault: raw.isDefault === true,
    sortOrder: Number(raw.sortOrder || 0) || 0,
    qrImage: normalizeMedia(raw.qrImage),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

export function normalizePaymentProfileCollection(payload) {
  return Array.isArray(payload?.data) ? payload.data.map(normalizePaymentProfile).filter(Boolean) : []
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

export function getPaymentProfileMethodLabel(method) {
  const normalized = toText(method).toLowerCase()
  if (normalized === 'bank_transfer') return 'Chuyển khoản ngân hàng'
  if (normalized === 'cash') return 'Tiền mặt'
  if (normalized === 'other') return 'Khác'
  return normalized || '-'
}

export function getPaymentProfileStatusMeta(profile) {
  return {
    activeLabel: profile?.isActive ? 'Đang hoạt động' : 'Ngừng sử dụng',
    activeColor: profile?.isActive ? 'success' : 'secondary',
    defaultLabel: profile?.isDefault ? 'Mặc định' : 'Thường',
    defaultColor: profile?.isDefault ? 'primary' : 'secondary',
  }
}

export function getPaymentProfileReceiverSummary(profile) {
  if (!profile) return '-'
  if (profile.paymentMethod !== 'bank_transfer') {
    return profile.paymentMethod === 'cash' ? 'Thu tiền mặt theo hướng dẫn' : 'Phương thức khác theo hướng dẫn'
  }
  return [profile.bankName, profile.accountNumber, profile.accountHolder].filter(Boolean).join(' · ') || '-'
}

export function buildPaymentProfileFormValues(profile = {}) {
  return {
    name: toText(profile.name),
    code: toText(profile.code),
    description: toText(profile.description),
    paymentMethod: toText(profile.paymentMethod) || 'bank_transfer',
    bankCode: toText(profile.bankCode),
    bankName: toText(profile.bankName),
    accountNumber: toText(profile.accountNumber),
    accountHolder: toText(profile.accountHolder),
    bankBranch: toText(profile.bankBranch),
    currency: toText(profile.currency) || 'VND',
    transferContentTemplate: toText(profile.transferContentTemplate),
    paymentInstruction: toText(profile.paymentInstruction),
    supportPhone: toText(profile.supportPhone),
    supportEmail: toText(profile.supportEmail),
    isActive: profile.isActive !== false,
    isDefault: profile.isDefault === true,
    sortOrder: String(profile.sortOrder ?? 0),
    qrImage: profile.qrImage || null,
  }
}

export function buildPaymentProfilePayload(values) {
  return {
    name: toText(values.name),
    code: toText(values.code).toUpperCase(),
    description: toText(values.description) || null,
    paymentMethod: toText(values.paymentMethod).toLowerCase() || 'bank_transfer',
    bankCode: toText(values.bankCode).toUpperCase() || null,
    bankName: toText(values.bankName) || null,
    accountNumber: toText(values.accountNumber) || null,
    accountHolder: toText(values.accountHolder) || null,
    bankBranch: toText(values.bankBranch) || null,
    currency: toText(values.currency).toUpperCase() || 'VND',
    transferContentTemplate: toText(values.transferContentTemplate) || null,
    paymentInstruction: toText(values.paymentInstruction) || null,
    supportPhone: toText(values.supportPhone) || null,
    supportEmail: toText(values.supportEmail).toLowerCase() || null,
    isActive: values.isActive === true,
    isDefault: values.isDefault === true,
    sortOrder: Number(values.sortOrder || 0) || 0,
    qrImage: values.qrImage?.id || null,
  }
}

export function validatePaymentProfileForm(values) {
  const errors = {}
  if (!toText(values.name)) errors.name = 'Tên hồ sơ là bắt buộc.'
  if (!toText(values.code)) errors.code = 'Mã hồ sơ là bắt buộc.'
  if (!toText(values.paymentMethod)) errors.paymentMethod = 'Phương thức thanh toán là bắt buộc.'
  if (!toText(values.currency)) errors.currency = 'Loại tiền là bắt buộc.'
  if (String(values.sortOrder || '').trim() === '' || Number(values.sortOrder) < 0 || !Number.isFinite(Number(values.sortOrder))) {
    errors.sortOrder = 'Thứ tự hiển thị phải là số nguyên không âm.'
  }
  if (toText(values.supportEmail) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toText(values.supportEmail).toLowerCase())) {
    errors.supportEmail = 'Email hỗ trợ không hợp lệ.'
  }
  if (toText(values.paymentMethod).toLowerCase() === 'bank_transfer') {
    if (!toText(values.bankCode) && !toText(values.bankName)) errors.bankName = 'Cần nhập mã ngân hàng hoặc tên ngân hàng.'
    if (!toText(values.accountNumber)) errors.accountNumber = 'Số tài khoản là bắt buộc cho chuyển khoản ngân hàng.'
    if (!toText(values.accountHolder)) errors.accountHolder = 'Chủ tài khoản là bắt buộc cho chuyển khoản ngân hàng.'
  }
  return errors
}

export function getPaymentProfileApiMessage(error, fallback) {
  const code = toText(error?.response?.data?.code || error?.response?.data?.error?.code)
  const mapped = {
    PAYMENT_PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ thanh toán trong tenant hiện tại.',
    PAYMENT_PROFILE_CODE_ALREADY_EXISTS: 'Mã hồ sơ đã tồn tại trong tenant hiện tại.',
    PAYMENT_PROFILE_INVALID_METHOD: 'Phương thức thanh toán không hợp lệ.',
    PAYMENT_PROFILE_BANK_INFO_REQUIRED: 'Thiếu thông tin tài khoản ngân hàng cho phương thức chuyển khoản.',
    PAYMENT_PROFILE_INACTIVE_CANNOT_BE_DEFAULT: 'Hồ sơ ngừng sử dụng không thể đặt làm mặc định.',
    PAYMENT_PROFILE_DEFAULT_CANNOT_BE_DEACTIVATED: 'Không thể ngừng sử dụng hồ sơ đang là mặc định.',
    PAYMENT_PROFILE_ALREADY_DEFAULT: 'Hồ sơ này đã là hồ sơ mặc định.',
    PAYMENT_PROFILE_INVALID_QR_IMAGE: 'Ảnh QR không hợp lệ.',
    INVALID_EMAIL: 'Email hỗ trợ không hợp lệ.',
    UNKNOWN_FIELDS: 'Biểu mẫu gửi lên có trường không hợp lệ.',
  }[code]
  return mapped || error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback
}

export function mapPaymentProfileFieldErrors(error) {
  const code = toText(error?.response?.data?.code || error?.response?.data?.error?.code)
  const details = error?.response?.data?.details
  const fieldErrors = {}
  if (code === 'PAYMENT_PROFILE_CODE_ALREADY_EXISTS') fieldErrors.code = 'Mã hồ sơ đã tồn tại trong tenant hiện tại.'
  if (code === 'PAYMENT_PROFILE_BANK_INFO_REQUIRED') {
    const field = toText(details?.field)
    if (field) fieldErrors[field] = 'Trường này là bắt buộc cho phương thức chuyển khoản.'
  }
  if (code === 'PAYMENT_PROFILE_INVALID_QR_IMAGE') fieldErrors.qrImage = 'Ảnh QR không hợp lệ.'
  if (code === 'INVALID_EMAIL') fieldErrors.supportEmail = 'Email hỗ trợ không hợp lệ.'
  return fieldErrors
}