function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export const ASSIGNMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hiệu lực' },
  { value: 'inactive', label: 'Ngưng hiệu lực' },
]

export function getAssignmentStatusMeta(status) {
  const normalized = toText(status).toLowerCase()
  if (normalized === 'inactive') return { color: 'secondary', label: 'Ngưng hiệu lực' }
  return { color: 'success', label: 'Đang hiệu lực' }
}

export function getAssignmentUserLabel(user) {
  if (!user) return '-'
  return [toText(user.fullName), toText(user.username), toText(user.email)].filter(Boolean).join(' - ') || `User #${user.id}`
}

export function getAssignmentClubLabel(club) {
  if (!club) return '-'
  return [toText(club.code), toText(club.name), toText(club.shortName)].filter(Boolean).join(' - ') || `Club #${club.id}`
}

export function formatAssignmentDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}