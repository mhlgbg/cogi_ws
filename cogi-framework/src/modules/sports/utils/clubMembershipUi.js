function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export const CLUB_MEMBERSHIP_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Dừng hoạt động' },
  { value: 'left', label: 'Đã rời' },
  { value: 'suspended', label: 'Tạm đình chỉ' },
  { value: 'rejected', label: 'Từ chối' },
]

export const CLUB_MEMBERSHIP_ROLE_OPTIONS = [
  { value: 'member', label: 'Thành viên' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
]

export const CLUB_MEMBERSHIP_SOURCE_OPTIONS = [
  { value: '', label: 'Chưa xác định' },
  { value: 'manual_import', label: 'Import thủ công' },
  { value: 'self_registration', label: 'Tự đăng ký' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'invite', label: 'Mời' },
  { value: 'admin_created', label: 'Admin tạo' },
  { value: 'other', label: 'Khác' },
]

export function buildClubMembershipFormValues(initialValues = {}) {
  return {
    sportsProfile: initialValues.sportsProfile || null,
    club: initialValues.club || null,
    memberCode: toText(initialValues.memberCode),
    oldMemberCode: toText(initialValues.oldMemberCode),
    status: toText(initialValues.status) || 'active',
    role: toText(initialValues.role) || 'member',
    positionTitle: toText(initialValues.positionTitle),
    joinedAt: initialValues.joinedAt || '',
    leftAt: initialValues.leftAt || '',
    source: toText(initialValues.source),
    sourceReference: toText(initialValues.sourceReference),
    joinMessage: toText(initialValues.joinMessage),
    note: toText(initialValues.note),
    approvedAt: initialValues.approvedAt || null,
    approvedBy: initialValues.approvedBy || null,
  }
}

export function validateClubMembershipForm(form) {
  const errors = {}
  if (!form.sportsProfile?.id) errors.sportsProfile = 'Sports Profile là bắt buộc'
  if (!form.club?.id) errors.club = 'Sports Club là bắt buộc'
  const email = toText(form.sportsProfile?.contactEmail)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.sportsProfile = errors.sportsProfile || 'Sports Profile hiện tại có email không hợp lệ'
  }
  return errors
}

export function buildClubMembershipPayload(form) {
  return {
    sportsProfile: form.sportsProfile?.id || null,
    club: form.club?.id || null,
    memberCode: toText(form.memberCode).toUpperCase() || null,
    oldMemberCode: toText(form.oldMemberCode).toUpperCase() || null,
    status: toText(form.status) || 'active',
    role: toText(form.role) || 'member',
    positionTitle: toText(form.positionTitle) || null,
    joinedAt: form.joinedAt || null,
    leftAt: form.leftAt || null,
    source: toText(form.source) || null,
    sourceReference: toText(form.sourceReference) || null,
    joinMessage: toText(form.joinMessage) || null,
    note: toText(form.note) || null,
  }
}

export function getClubMembershipStatusMeta(status) {
  const normalized = toText(status).toLowerCase()
  if (normalized === 'pending') return { color: 'warning', label: 'Chờ duyệt' }
  if (normalized === 'inactive') return { color: 'secondary', label: 'Dừng hoạt động' }
  if (normalized === 'left') return { color: 'dark', label: 'Đã rời' }
  if (normalized === 'suspended') return { color: 'danger', label: 'Tạm đình chỉ' }
  if (normalized === 'rejected') return { color: 'danger', label: 'Từ chối' }
  return { color: 'success', label: 'Đang hoạt động' }
}

export function getClubMembershipRoleLabel(role) {
  const normalized = toText(role).toLowerCase()
  return CLUB_MEMBERSHIP_ROLE_OPTIONS.find((item) => item.value === normalized)?.label || 'Thành viên'
}

export function getClubMembershipSourceLabel(source) {
  const normalized = toText(source).toLowerCase()
  return CLUB_MEMBERSHIP_SOURCE_OPTIONS.find((item) => item.value === normalized)?.label || '-'
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

export function getSportsProfileOptionLabel(profile) {
  if (!profile) return '-'
  return [toText(profile.code), toText(profile.fullName), toText(profile.displayName), toText(profile.contactPhone), toText(profile.contactEmail)].filter(Boolean).join(' - ') || `Profile #${profile.id}`
}

export function getClubOptionLabel(club) {
  if (!club) return '-'
  return [toText(club.code), toText(club.name), toText(club.shortName)].filter(Boolean).join(' - ') || `Club #${club.id}`
}

export function getApprovedByLabel(user) {
  if (!user) return '-'
  return [toText(user.fullName), toText(user.username), toText(user.email)].filter(Boolean).join(' - ') || `User #${user.id}`
}