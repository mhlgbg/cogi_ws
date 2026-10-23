function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export const SPORT_TYPE_OPTIONS = [
  { value: '', label: 'Chưa xác định' },
  { value: 'running', label: 'Chạy bộ' },
  { value: 'cycling', label: 'Đạp xe' },
  { value: 'badminton', label: 'Cầu lông' },
  { value: 'football', label: 'Bóng đá' },
  { value: 'swimming', label: 'Bơi lội' },
  { value: 'multisport', label: 'Đa môn' },
  { value: 'other', label: 'Khác' },
]

export const ACHIEVEMENT_TYPE_OPTIONS = [
  { value: 'personal_best', label: 'Personal Best' },
  { value: 'race_result', label: 'Race Result' },
  { value: 'champion', label: 'Champion' },
  { value: 'podium', label: 'Podium' },
  { value: 'finisher', label: 'Finisher' },
  { value: 'distance_milestone', label: 'Distance Milestone' },
  { value: 'streak', label: 'Streak' },
  { value: 'club_award', label: 'Club Award' },
  { value: 'system_award', label: 'System Award' },
  { value: 'other', label: 'Khác' },
]

export const RUNNING_V1_ACHIEVEMENT_TYPES = ['race_result', 'personal_best']

export const RUNNING_ACHIEVEMENT_TYPE_OPTIONS = ACHIEVEMENT_TYPE_OPTIONS.filter((option) => RUNNING_V1_ACHIEVEMENT_TYPES.includes(option.value))

export const RUNNING_DISTANCE_OPTIONS = [
  { value: '42.195', label: 'FM' },
  { value: '21.0975', label: 'HM' },
  { value: '10', label: '10KM' },
  { value: '5', label: '5KM' },
  { value: 'other', label: 'Khác' },
  { value: 'unknown', label: 'Chưa xác định cự ly' },
]

export const RACE_TYPE_OPTIONS = [
  { value: '', label: 'Chưa xác định' },
  { value: 'road', label: 'Road' },
  { value: 'trail', label: 'Trail' },
  { value: 'track', label: 'Track' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'other', label: 'Unknown' },
]

export const ACHIEVEMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Đã ghi nhận' },
  { value: 'revoked', label: 'Đã thu hồi' },
]

export const ACHIEVEMENT_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'active', label: 'Đã ghi nhận' },
  { value: 'revoked', label: 'Đã rút ghi nhận' },
]

export const ACHIEVEMENT_SOURCE_OPTIONS = [
  { value: 'club', label: 'CLB' },
  { value: 'event', label: 'Sự kiện' },
  { value: 'manual', label: 'Thủ công' },
  { value: 'system', label: 'Hệ thống' },
  { value: 'strava', label: 'Strava' },
  { value: 'import', label: 'Import' },
  { value: 'other', label: 'Khác' },
]

export const SUBMISSION_SOURCE_OPTIONS = [
  { value: 'club_manager', label: 'Quản lý CLB' },
  { value: 'member', label: 'Thành viên' },
  { value: 'event', label: 'Sự kiện' },
  { value: 'public_form', label: 'Public Form' },
  { value: 'import', label: 'Import' },
  { value: 'system', label: 'Hệ thống' },
  { value: 'strava', label: 'Strava' },
  { value: 'other', label: 'Khác' },
]

export const SUBMISSION_STATUS_OPTIONS = [
  { value: 'draft', label: 'Nháp' },
  { value: 'submitted', label: 'Chờ xác minh' },
  { value: 'verified', label: 'Đã xác minh' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'cancelled', label: 'Đã hủy' },
]

export function getSportTypeLabel(value) {
  return SPORT_TYPE_OPTIONS.find((item) => item.value === toText(value).toLowerCase())?.label || '-'
}

export function getRaceTypeLabel(value) {
  return RACE_TYPE_OPTIONS.find((item) => item.value === toText(value).toLowerCase())?.label || 'Unknown'
}

export function getAchievementTypeLabel(value) {
  return ACHIEVEMENT_TYPE_OPTIONS.find((item) => item.value === toText(value).toLowerCase())?.label || 'Khác'
}

export function getAchievementSourceLabel(value) {
  return ACHIEVEMENT_SOURCE_OPTIONS.find((item) => item.value === toText(value).toLowerCase())?.label || '-'
}

export function getSubmissionSourceLabel(value) {
  return SUBMISSION_SOURCE_OPTIONS.find((item) => item.value === toText(value).toLowerCase())?.label || '-'
}

export function getAchievementStatusMeta(value) {
  const normalized = toText(value).toLowerCase()
  if (normalized === 'revoked') return { color: 'dark', label: 'Đã rút ghi nhận' }
  return { color: 'success', label: 'Đã ghi nhận' }
}

export function getSubmissionStatusMeta(value) {
  const normalized = toText(value).toLowerCase()
  if (normalized === 'submitted') return { color: 'warning', label: 'Chờ xác minh' }
  if (normalized === 'verified') return { color: 'success', label: 'Đã xác minh' }
  if (normalized === 'rejected') return { color: 'danger', label: 'Từ chối' }
  if (normalized === 'cancelled') return { color: 'dark', label: 'Đã hủy' }
  return { color: 'secondary', label: 'Bản nháp' }
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

function normalizeDateTimeInputText(value) {
  const text = toText(value)
  if (!text) return ''

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return text
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T12:00`
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)) {
    return text.replace(' ', 'T').slice(0, 16)
  }

  return ''
}

export function toDateTimeInputValue(value) {
  if (!value) return ''
  const normalizedText = normalizeDateTimeInputText(value)
  if (normalizedText) return normalizedText
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function fromDateTimeInputValue(value) {
  const text = toText(value)
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T12:00:00`)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
  }
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function getSportsProfileOptionLabel(profile) {
  if (!profile) return '-'
  return [toText(profile.code), toText(profile.fullName), toText(profile.displayName), toText(profile.contactPhone), toText(profile.contactEmail)].filter(Boolean).join(' - ') || `Profile #${profile.id}`
}

export function getSportsClubOptionLabel(club) {
  if (!club) return '-'
  return [toText(club.code), toText(club.name), toText(club.shortName)].filter(Boolean).join(' - ') || `Club #${club.id}`
}

export function getUserLabel(user) {
  if (!user) return '-'
  return [toText(user.fullName), toText(user.username), toText(user.email)].filter(Boolean).join(' - ') || `User #${user.id}`
}

export function isRunningV1AchievementType(value) {
  return RUNNING_V1_ACHIEVEMENT_TYPES.includes(toText(value).toLowerCase())
}

export function buildRaceResultTitleSuggestion({ title = '', eventCode = '', bib = '' }) {
  const safeTitle = toText(title).trim()
  if (safeTitle) return safeTitle

  const safeEventCode = toText(eventCode).trim()
  const safeBib = toText(bib).trim()
  if (safeEventCode && safeBib) return `${safeEventCode}-${safeBib}`
  if (safeEventCode) return safeEventCode
  if (safeBib) return safeBib
  return ''
}

export function formatDurationSeconds(value) {
  const total = Number(value)
  if (!Number.isInteger(total) || total <= 0) return '-'
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((item) => String(item).padStart(2, '0')).join(':')
}

export function formatDistanceKm(value) {
  const distance = Number(value)
  if (!Number.isFinite(distance) || distance <= 0) return '-'
  if (Math.abs(distance - 42.195) < 0.0001) return 'FM'
  if (Math.abs(distance - 21.0975) < 0.0001) return 'HM'
  if (Math.abs(distance - 10) < 0.0001) return '10KM'
  if (Math.abs(distance - 5) < 0.0001) return '5KM'
  return `${distance} km`
}

export function getAchievementResultPrimary(item) {
  if (!item) return '-'
  if (toText(item.sportType).toLowerCase() === 'running' && Number.isInteger(Number(item.durationSeconds)) && Number(item.durationSeconds) > 0) {
    return formatDurationSeconds(Number(item.durationSeconds))
  }
  return toText(item.resultText) || '-'
}

export function getAchievementResultSecondary(item) {
  if (!item) return '-'
  if (toText(item.sportType).toLowerCase() === 'running' && Number(item.distanceKm) > 0) {
    return formatDistanceKm(Number(item.distanceKm))
  }
  const value = item.resultValue === null || item.resultValue === undefined || item.resultValue === '' ? '-' : String(item.resultValue)
  const unit = toText(item.resultUnit)
  return [value, unit].filter(Boolean).join(' ')
}
