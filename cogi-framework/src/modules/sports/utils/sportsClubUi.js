function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export const CLUB_TYPE_OPTIONS = [
  { value: 'community', label: 'Cộng đồng' },
  { value: 'club', label: 'CLB' },
  { value: 'team', label: 'Đội' },
  { value: 'chapter', label: 'Chi bộ / nhóm con' },
  { value: 'training_group', label: 'Nhóm luyện tập' },
  { value: 'other', label: 'Khác' },
]

export const SPORT_TYPE_OPTIONS = [
  { value: 'running', label: 'Chạy bộ' },
  { value: 'cycling', label: 'Đạp xe' },
  { value: 'badminton', label: 'Cầu lông' },
  { value: 'football', label: 'Bóng đá' },
  { value: 'swimming', label: 'Bơi lội' },
  { value: 'multisport', label: 'Đa môn' },
  { value: 'other', label: 'Khác' },
]

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Ngưng hoạt động' },
  { value: 'archived', label: 'Lưu trữ' },
]

export const JOIN_POLICY_OPTIONS = [
  { value: 'open', label: 'Mở' },
  { value: 'approval', label: 'Cần duyệt' },
  { value: 'invite_only', label: 'Chỉ mời' },
  { value: 'closed', label: 'Đóng' },
]

export function slugifyClient(value) {
  return toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildSportsClubFormValues(initialValues = {}) {
  return {
    code: toText(initialValues.code),
    name: toText(initialValues.name),
    shortName: toText(initialValues.shortName),
    slug: toText(initialValues.slug),
    parentClub: initialValues.parentClub || null,
    clubType: toText(initialValues.clubType) || 'club',
    sportType: toText(initialValues.sportType) || 'running',
    description: toText(initialValues.description),
    logo: initialValues.logo || null,
    coverImage: initialValues.coverImage || null,
    status: toText(initialValues.status) || 'active',
    joinPolicy: toText(initialValues.joinPolicy) || 'approval',
    foundedAt: initialValues.foundedAt || '',
    contactPhone: toText(initialValues.contactPhone),
    contactEmail: toText(initialValues.contactEmail),
    address: toText(initialValues.address),
    website: toText(initialValues.website),
  }
}

export function validateSportsClubForm(form) {
  const errors = {}
  if (!toText(form.code)) errors.code = 'Mã CLB là bắt buộc'
  if (!toText(form.name)) errors.name = 'Tên CLB là bắt buộc'
  if (!toText(form.slug)) errors.slug = 'Slug là bắt buộc'
  const email = toText(form.contactEmail).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.contactEmail = 'Email liên hệ không hợp lệ'
  return errors
}

export function buildSportsClubPayload(form) {
  return {
    code: toText(form.code).toUpperCase(),
    name: toText(form.name),
    shortName: toText(form.shortName) || null,
    slug: slugifyClient(form.slug),
    parentClub: form.parentClub?.id || null,
    clubType: toText(form.clubType) || 'club',
    sportType: toText(form.sportType) || 'running',
    description: toText(form.description) || null,
    logo: form.logo?.id || null,
    coverImage: form.coverImage?.id || null,
    status: toText(form.status) || 'active',
    joinPolicy: toText(form.joinPolicy) || 'approval',
    foundedAt: form.foundedAt || null,
    contactPhone: toText(form.contactPhone) || null,
    contactEmail: toText(form.contactEmail).toLowerCase() || null,
    address: toText(form.address) || null,
    website: toText(form.website) || null,
  }
}

export function getSportsClubStatusMeta(status) {
  const normalized = toText(status).toLowerCase()
  if (normalized === 'inactive') return { color: 'secondary', label: 'Ngưng hoạt động' }
  if (normalized === 'archived') return { color: 'dark', label: 'Lưu trữ' }
  return { color: 'success', label: 'Đang hoạt động' }
}

export function getClubTypeLabel(value) {
  const normalized = toText(value).toLowerCase()
  return CLUB_TYPE_OPTIONS.find((item) => item.value === normalized)?.label || 'Khác'
}

export function getSportTypeLabel(value) {
  const normalized = toText(value).toLowerCase()
  return SPORT_TYPE_OPTIONS.find((item) => item.value === normalized)?.label || 'Khác'
}

export function getJoinPolicyLabel(value) {
  const normalized = toText(value).toLowerCase()
  return JOIN_POLICY_OPTIONS.find((item) => item.value === normalized)?.label || 'Cần duyệt'
}

export function formatSportsDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

export function formatSportsDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

export function getParentClubLabel(club) {
  if (!club) return 'Root club'
  return [toText(club.name), toText(club.code)].filter(Boolean).join(' - ') || `Club #${club.id}`
}