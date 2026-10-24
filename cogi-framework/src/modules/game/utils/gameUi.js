export const ACTIVITY_LABELS = {
  daily_active: 'Hoạt động hằng ngày',
  community_post: 'Bài viết cộng đồng',
  community_comment: 'Bình luận cộng đồng',
}

export function formatDateTime(value) {
  if (!value) return '-'
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export function getStatusBadgeConfig(status) {
  const normalized = String(status || '').trim().toLowerCase()
  switch (normalized) {
    case 'draft':
      return { color: 'secondary', label: 'Bản nháp' }
    case 'registration':
      return { color: 'info', label: 'Mở đăng ký' }
    case 'trial_upcoming':
      return { color: 'info', label: 'Sắp chơi thử' }
    case 'trial_running':
      return { color: 'warning', label: 'Đang chơi thử' }
    case 'official_pending':
      return { color: 'warning', label: 'Chờ chính thức' }
    case 'official_running':
      return { color: 'success', label: 'Đang chơi chính thức' }
    case 'ended':
      return { color: 'dark', label: 'Đã kết thúc' }
    case 'finalized':
      return { color: 'primary', label: 'Đã chốt' }
    case 'registered':
      return { color: 'success', label: 'Đã đăng ký' }
    case 'not_open':
      return { color: 'warning', label: 'Chưa mở đăng ký' }
    case 'late_open':
      return { color: 'warning', label: 'Đăng ký muộn' }
    case 'closed':
      return { color: 'dark', label: 'Đóng đăng ký' }
    case 'unavailable':
      return { color: 'secondary', label: 'Tạm không khả dụng' }
    default:
      return { color: 'secondary', label: normalized || '-' }
  }
}

export function buildGameFormState(game) {
  const gameTypeCode = String(game?.gameType?.code || game?.gameTypeCode || 'xp_challenge').toLowerCase()
  const settings = game?.settings && typeof game.settings === 'object' ? game.settings : {}
  return {
    gameTypeCode,
    code: String(game?.code || ''),
    name: String(game?.name || ''),
    description: String(game?.description || ''),
    hasTrial: Boolean(game?.hasTrial || (game?.trialStartAt && game?.trialEndAt)),
    registrationOpenAt: toInputDateTime(game?.registrationOpenAt),
    registrationCloseAt: toInputDateTime(game?.registrationCloseAt),
    trialStartAt: toInputDateTime(game?.trialStartAt),
    trialEndAt: toInputDateTime(game?.trialEndAt),
    startsAt: toInputDateTime(game?.startsAt),
    endsAt: toInputDateTime(game?.endsAt),
    timezone: String(game?.timezone || 'Asia/Ho_Chi_Minh'),
    lateRegistrationEnabled: Boolean(game?.lateRegistrationEnabled),
    ghostRacePlatform: String(settings?.playPlatform || 'desktop'),
    ghostRaceDistanceMeters: String(settings?.distanceMeters ?? 200),
    ghostRaceCutoffSeconds: String(settings?.cutoffSeconds ?? 40),
    ghostRacePhysicsVersion: String(settings?.physicsVersion || 'v1'),
    ghostRaceTrackVersion: String(settings?.trackVersion || 'v1'),
    ghostRaceRulesVersion: String(settings?.rulesVersion || 'v1'),
    ghostRaceCountdownOnYourMarksMs: String(settings?.countdown?.onYourMarksMs ?? 900),
    ghostRaceCountdownSetMs: String(settings?.countdown?.setMs ?? 900),
    ghostRaceCountdownGoHoldMs: String(settings?.countdown?.goHoldMs ?? 500),
  }
}

export function createEmptyGameFormState() {
  return buildGameFormState(null)
}

export function toInputDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export function toSubmitDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function createRuleDrafts(rules = []) {
  return rules.map((rule) => ({
    activityCode: String(rule?.activityCode || ''),
    activityName: String(ACTIVITY_LABELS[rule?.activityCode] || rule?.activityName || rule?.activityCode || ''),
    description: String(rule?.description || ''),
    isEnabled: Boolean(rule?.isEnabled),
    xpAmount: String(rule?.xpAmount ?? 0),
    maxCount: String(rule?.maxCount ?? 0),
    limitPeriod: String(rule?.limitPeriod || 'daily'),
  }))
}
