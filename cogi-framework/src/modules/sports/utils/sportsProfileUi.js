import { resolveMediaUrl } from '../../../utils/mediaUrl'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export const GENDER_OPTIONS = [
  { value: 'unspecified', label: 'Chưa xác định' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
]

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Ngưng hoạt động' },
  { value: 'merged', label: 'Đã gộp' },
]

export const SOURCE_OPTIONS = [
  { value: '', label: 'Chưa xác định' },
  { value: 'manual_import', label: 'Nhập tay / import' },
  { value: 'self_registration', label: 'Tự đăng ký' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'admin_created', label: 'Admin tạo' },
  { value: 'other', label: 'Khác' },
]

export function buildSportsProfileFormValues(initialValues = {}) {
  return {
    code: toText(initialValues.code),
    fullName: toText(initialValues.fullName),
    displayName: toText(initialValues.displayName),
    gender: toText(initialValues.gender) || 'unspecified',
    dateOfBirth: initialValues.dateOfBirth || '',
    birthYear: Number.isInteger(Number(initialValues.birthYear)) ? String(initialValues.birthYear) : '',
    hometown: toText(initialValues.hometown),
    bio: toText(initialValues.bio),
    contactPhone: toText(initialValues.contactPhone),
    contactEmail: toText(initialValues.contactEmail),
    status: toText(initialValues.status) || 'active',
    source: toText(initialValues.source),
    sourceReference: toText(initialValues.sourceReference),
    avatar: initialValues.avatar
      ? {
          id: initialValues.avatar.id || null,
          name: toText(initialValues.avatar.name),
          url: resolveMediaUrl(initialValues.avatar.url) || '',
        }
      : null,
    linkedUser: initialValues.user || null,
  }
}

export function validateSportsProfileForm(form) {
  const errors = {}
  if (!toText(form.code)) errors.code = 'Mã hồ sơ là bắt buộc'
  if (!toText(form.fullName)) errors.fullName = 'Họ và tên là bắt buộc'
  const birthYearText = toText(form.birthYear)
  if (birthYearText) {
    const parsed = Number(birthYearText)
    if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
      errors.birthYear = 'Năm sinh phải là số nguyên từ 1900 đến 2100'
    }
  }
  const email = toText(form.contactEmail).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.contactEmail = 'Email liên hệ không hợp lệ'
  }
  return errors
}

export function buildSportsProfilePayload(form) {
  const birthYearText = toText(form.birthYear)
  return {
    code: toText(form.code).toUpperCase(),
    fullName: toText(form.fullName),
    displayName: toText(form.displayName) || null,
    avatar: form.avatar?.id || null,
    gender: toText(form.gender) || 'unspecified',
    dateOfBirth: form.dateOfBirth || null,
    birthYear: birthYearText ? Number(birthYearText) : null,
    hometown: toText(form.hometown) || null,
    bio: toText(form.bio) || null,
    contactPhone: toText(form.contactPhone) || null,
    contactEmail: toText(form.contactEmail).toLowerCase() || null,
    status: toText(form.status) || 'active',
    source: toText(form.source) || null,
    sourceReference: toText(form.sourceReference) || null,
  }
}

export function getSportsProfileStatusMeta(status) {
  const normalized = toText(status).toLowerCase()
  if (normalized === 'inactive') return { color: 'secondary', label: 'Ngưng hoạt động' }
  if (normalized === 'merged') return { color: 'dark', label: 'Đã gộp' }
  return { color: 'success', label: 'Đang hoạt động' }
}

export function getSportsProfileGenderLabel(gender) {
  const normalized = toText(gender).toLowerCase()
  return GENDER_OPTIONS.find((item) => item.value === normalized)?.label || 'Chưa xác định'
}

export function getSportsProfileSourceLabel(source) {
  const normalized = toText(source).toLowerCase()
  return SOURCE_OPTIONS.find((item) => item.value === normalized)?.label || '-'
}

export function formatSportsBirthDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

export function formatSportsBirthDateOrYear(dateOfBirth, birthYear) {
  if (dateOfBirth) return formatSportsBirthDate(dateOfBirth)
  if (Number.isInteger(Number(birthYear))) return String(birthYear)
  return '-'
}

export function formatSportsDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

export function getLinkedUserLabel(user) {
  if (!user) return 'Chưa liên kết'
  return [toText(user.fullName), toText(user.username), toText(user.email)].filter(Boolean).join(' - ') || `User #${user.id}`
}