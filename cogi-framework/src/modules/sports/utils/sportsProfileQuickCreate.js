export function buildInitialQuickSportsProfileForm() {
  return {
    code: '',
    fullName: '',
    displayName: '',
    gender: 'unspecified',
    dateOfBirth: '',
    birthYear: '',
    contactPhone: '',
    contactEmail: '',
    hometown: '',
  }
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function validateQuickSportsProfileForm(form) {
  const errors = {}

  if (!toText(form?.code)) {
    errors.code = 'Mã hồ sơ thể thao là bắt buộc'
  }

  if (!toText(form?.fullName)) {
    errors.fullName = 'Họ tên là bắt buộc'
  }

  const birthYear = toText(form?.birthYear)
  if (birthYear) {
    const parsed = Number(birthYear)
    if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
      errors.birthYear = 'Năm sinh phải là số nguyên từ 1900 đến 2100'
    }
  }

  const email = toText(form?.contactEmail).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.contactEmail = 'Email liên hệ không hợp lệ'
  }

  return errors
}

export function buildQuickSportsProfilePayload(form) {
  return {
    code: toText(form?.code).toUpperCase(),
    fullName: toText(form?.fullName),
    displayName: toText(form?.displayName) || null,
    gender: toText(form?.gender) || 'unspecified',
    dateOfBirth: form?.dateOfBirth || null,
    birthYear: toText(form?.birthYear) ? Number(form.birthYear) : null,
    contactPhone: toText(form?.contactPhone) || null,
    contactEmail: toText(form?.contactEmail).toLowerCase() || null,
    hometown: toText(form?.hometown) || null,
  }
}