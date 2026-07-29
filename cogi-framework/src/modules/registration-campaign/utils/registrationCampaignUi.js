import { resolveMediaUrl } from '../../../utils/mediaUrl'

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function formatNumber(value) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return '0'
  return new Intl.NumberFormat('vi-VN').format(parsed)
}

export function normalizeStatus(value) {
  return toText(value).toLowerCase()
}

export function getCampaignStatusMeta(status) {
  const normalized = normalizeStatus(status)
  if (normalized === 'open') return { label: 'Đang mở', color: 'success' }
  if (normalized === 'paused') return { label: 'Tạm dừng', color: 'warning' }
  if (normalized === 'closed') return { label: 'Đã đóng', color: 'secondary' }
  if (normalized === 'cancelled') return { label: 'Đã hủy', color: 'danger' }
  return { label: 'Bản nháp', color: 'dark' }
}

export function getRegistrationStatusMeta(status) {
  const normalized = normalizeStatus(status)
  if (normalized === 'pending_verification') return { label: 'Chờ xác minh', color: 'warning' }
  if (normalized === 'verified') return { label: 'Đã xác minh', color: 'info' }
  if (normalized === 'approved') return { label: 'Đã hoàn tất', color: 'success' }
  if (normalized === 'rejected') return { label: 'Bị từ chối', color: 'danger' }
  if (normalized === 'cancelled') return { label: 'Đã hủy', color: 'secondary' }
  if (normalized === 'expired') return { label: 'Đã hết hạn', color: 'dark' }
  return { label: normalized || '-', color: 'secondary' }
}

export function getMailStatusColor(status) {
  const normalized = toText(status).toUpperCase()
  if (normalized === 'SENT') return 'success'
  if (normalized === 'FAILED') return 'danger'
  if (normalized === 'RETRYING') return 'warning'
  if (normalized === 'SENDING') return 'info'
  if (normalized === 'CANCELLED') return 'dark'
  return 'secondary'
}

export function getRegistrationModeLabel(mode) {
  const normalized = normalizeStatus(mode)
  if (normalized === 'public_link') return 'Công khai bằng link'
  if (normalized === 'public_code') return 'Công khai bằng mã'
  if (normalized === 'invite_only') return 'Chỉ người có lời mời'
  if (normalized === 'approval_required') return 'Cần phê duyệt'
  if (normalized === 'admin_only') return 'Chỉ quản trị viên thêm'
  return normalized || '-'
}

export function resolveRegistrationCampaignTab(pathname = '') {
  if (/\/public-page(?:\/)?$/i.test(pathname)) return 'public-page'
  if (/\/emails(?:\/)?$/i.test(pathname)) return 'emails'
  if (/\/registrations(?:\/)?$/i.test(pathname)) return 'registrations'
  if (/\/form(?:\/)?$/i.test(pathname)) return 'form'
  if (/\/config(?:\/)?$/i.test(pathname)) return 'config'
  if (/\/overview(?:\/)?$/i.test(pathname)) return 'overview'
  return 'overview'
}

export function buildRegistrationCampaignTabPath(id, tab, tenantCode = '') {
  const prefix = tenantCode ? `/t/${encodeURIComponent(tenantCode)}` : ''
  if (tab === 'config') return `${prefix}/registration-campaigns/${id}/config`
  if (tab === 'form') return `${prefix}/registration-campaigns/${id}/form`
  if (tab === 'registrations') return `${prefix}/registration-campaigns/${id}/registrations`
  if (tab === 'emails') return `${prefix}/registration-campaigns/${id}/emails`
  if (tab === 'public-page') return `${prefix}/registration-campaigns/${id}/public-page`
  if (tab === 'overview') return `${prefix}/registration-campaigns/${id}/overview`
  return `${prefix}/registration-campaigns/${id}`
}

export async function copyToClipboard(value) {
  if (!value) return false
  try {
    await navigator.clipboard.writeText(String(value))
    return true
  } catch {
    return false
  }
}

export function buildEmptyPreviewValues(formConfig = {}) {
  const fields = Array.isArray(formConfig?.fields) ? formConfig.fields : []
  const preview = {}
  for (const field of fields) {
    if (!field?.key) continue
    preview[field.key] = ''
  }
  return preview
}

export function buildTargetFeaturePath(featureKey) {
  if (toText(featureKey) === 'fitness.manage') return '/fitness'
  return null
}

export function getCampaignMediaUrl(media) {
  const direct = toText(media?.resolvedUrl || media?.url)
  return direct ? resolveMediaUrl(direct) : ''
}

export function normalizeCollectionData(payload) {
  return Array.isArray(payload?.data) ? payload.data : []
}

export function normalizePagination(payload) {
  const pagination = payload?.pagination || payload?.meta?.pagination || {}
  return {
    page: Number(pagination.page || 1) || 1,
    pageSize: Number(pagination.pageSize || 10) || 10,
    total: Number(pagination.total || 0) || 0,
    pageCount: Number(pagination.pageCount || 1) || 1,
  }
}