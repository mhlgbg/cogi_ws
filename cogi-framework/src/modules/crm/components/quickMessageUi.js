import { sanitizeQuickMessageHtml } from './quickMessageHtml.js'

export const QUICK_MESSAGE_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'draft', label: 'Đang soạn' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'locked', label: 'Đã khóa' },
  { value: 'expired', label: 'Đã hết hạn' },
  { value: 'cancelled', label: 'Đã hủy' },
]

export const QUICK_MESSAGE_CREATE_STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'draft', label: 'Đang soạn' },
]

export const QUICK_MESSAGE_REPLY_MODE_OPTIONS = [
  { value: 'quick', label: 'Phản hồi nhanh' },
  { value: 'text', label: 'Nhập nội dung' },
  { value: 'quick_and_text', label: 'Phản hồi nhanh và nhập nội dung' },
]

export const QUICK_MESSAGE_CONTENT_TYPE_OPTIONS = [
  { value: 'text', label: 'Văn bản thuần' },
  { value: 'html', label: 'HTML đơn giản' },
]

export const QUICK_MESSAGE_TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'accesses', label: 'Mã truy cập' },
  { key: 'activity', label: 'Truy cập và trao đổi' },
]

export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '-')
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
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function toIsoFromDateTimeInput(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function defaultExpiresAtInput() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return formatDateTimeInput(date.toISOString())
}

export function getQuickMessageStatusMeta(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'active') return { color: 'success', label: 'Đang hoạt động' }
  if (normalized === 'locked') return { color: 'warning', label: 'Đã khóa' }
  if (normalized === 'expired') return { color: 'dark', label: 'Đã hết hạn' }
  if (normalized === 'cancelled') return { color: 'danger', label: 'Đã hủy' }
  return { color: 'secondary', label: 'Đang soạn' }
}

export function getQuickMessageAccessStatusMeta(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'active') return { color: 'success', label: 'Đang hoạt động' }
  if (normalized === 'locked') return { color: 'warning', label: 'Đã khóa' }
  if (normalized === 'expired') return { color: 'dark', label: 'Đã hết hạn' }
  if (normalized === 'cancelled') return { color: 'danger', label: 'Đã hủy' }
  return { color: 'secondary', label: String(status || 'Không xác định') || 'Không xác định' }
}

export function getReplyModeLabel(value) {
  return QUICK_MESSAGE_REPLY_MODE_OPTIONS.find((item) => item.value === value)?.label || '-'
}

export function getQuickMessageContentTypeLabel(value) {
  return QUICK_MESSAGE_CONTENT_TYPE_OPTIONS.find((item) => item.value === value)?.label || 'Văn bản thuần'
}

export function normalizeQuickMessageContentType(value) {
  return String(value || '').trim().toLowerCase() === 'html' ? 'html' : 'text'
}

export function getQuickMessageRenderedHtml(content, contentType) {
  if (normalizeQuickMessageContentType(contentType) !== 'html') return ''
  return sanitizeQuickMessageHtml(content)
}

export function getHostnameLabel(url) {
  try {
    return new URL(String(url || '')).hostname || '-'
  } catch {
    return '-'
  }
}

export function normalizeQuickMessageListFilters(searchParams) {
  return {
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    page: Number(searchParams.get('page') || 1) || 1,
    pageSize: Number(searchParams.get('pageSize') || 10) || 10,
  }
}

export function buildPaginationItems(currentPage, pageCount) {
  const maxButtons = 7
  if (pageCount <= maxButtons) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages = [1]
  const left = Math.max(2, currentPage - 1)
  const right = Math.min(pageCount - 1, currentPage + 1)

  if (left > 2) pages.push('ellipsis-left')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('ellipsis-right')
  pages.push(pageCount)
  return pages
}

export function buildQuickMessageFormInitialValues(value = {}, options = {}) {
  const includeInitialAccess = options.includeInitialAccess !== false
  return {
    title: String(value?.title || '').trim(),
    content: String(value?.content || '').trim(),
    contentType: normalizeQuickMessageContentType(value?.contentType),
    links: Array.isArray(value?.links)
      ? value.links.map((item) => ({
          label: String(item?.label || '').trim(),
          url: String(item?.url || '').trim(),
        }))
      : [],
    status: value?.status === 'draft' ? 'draft' : 'active',
    expiresAt: value?.expiresAt ? formatDateTimeInput(value.expiresAt) : defaultExpiresAtInput(),
    allowReply: value?.allowReply !== false,
    replyMode: value?.replyMode || 'quick_and_text',
    initialAccess: includeInitialAccess ? {
      label: String(value?.initialAccess?.label || '').trim(),
      recipientName: String(value?.initialAccess?.recipientName || '').trim(),
      requirePin: value?.initialAccess?.requirePin === true,
      pin: '',
      pinConfirm: '',
    } : null,
  }
}

export function validateQuickMessageForm(values, options = {}) {
  const includeInitialAccess = options.includeInitialAccess !== false
  const errors = {}
  const normalizedLinks = Array.isArray(values?.links) ? values.links : []

  if (!String(values?.title || '').trim()) {
    errors.title = 'Tiêu đề là bắt buộc.'
  } else if (String(values?.title || '').trim().length > 200) {
    errors.title = 'Tiêu đề tối đa 200 ký tự.'
  }

  const expiresAtText = String(values?.expiresAt || '').trim()
  if (!expiresAtText) {
    errors.expiresAt = 'Thời gian hết hạn là bắt buộc.'
  } else {
    const expiresAtDate = new Date(expiresAtText)
    if (Number.isNaN(expiresAtDate.getTime())) {
      errors.expiresAt = 'Thời gian hết hạn không hợp lệ.'
    } else if (expiresAtDate.getTime() <= Date.now()) {
      errors.expiresAt = 'Thời gian hết hạn phải ở tương lai.'
    }
  }

  if (normalizedLinks.length > 10) {
    errors.links = 'Tối đa 10 đường link.'
  }

  normalizedLinks.forEach((item, index) => {
    const rawLabel = String(item?.label || '').trim()
    const rawUrl = String(item?.url || '').trim()

    if (!rawLabel && !rawUrl) return

    if (rawLabel.length > 200) {
      errors[`links.${index}.label`] = 'Tên đường link tối đa 200 ký tự.'
    }
    if (!rawUrl) {
      errors[`links.${index}.url`] = 'URL là bắt buộc.'
      return
    }
    if (rawUrl.length > 2000) {
      errors[`links.${index}.url`] = 'URL tối đa 2000 ký tự.'
      return
    }

    try {
      const parsed = new URL(rawUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors[`links.${index}.url`] = 'Chỉ chấp nhận URL http hoặc https.'
      }
    } catch {
      errors[`links.${index}.url`] = 'URL không hợp lệ.'
    }
  })

  if (includeInitialAccess) {
    const requirePin = values?.initialAccess?.requirePin === true
    const pin = String(values?.initialAccess?.pin || '').trim()
    const pinConfirm = String(values?.initialAccess?.pinConfirm || '').trim()
    if (requirePin) {
      if (!/^\d{4,6}$/.test(pin)) {
        errors.initialAccessPin = 'PIN phải gồm 4 đến 6 chữ số.'
      }
      if (pin !== pinConfirm) {
        errors.initialAccessPinConfirm = 'PIN nhập lại chưa khớp.'
      }
    }
  }

  return errors
}

export function buildQuickMessagePayload(values, options = {}) {
  const includeInitialAccess = options.includeInitialAccess !== false
  const payload = {
    title: String(values?.title || '').trim(),
    content: String(values?.content || '').trim(),
    contentType: normalizeQuickMessageContentType(values?.contentType),
    links: (Array.isArray(values?.links) ? values.links : [])
      .map((item) => ({
        label: String(item?.label || '').trim(),
        url: String(item?.url || '').trim(),
      }))
      .filter((item) => item.label || item.url)
      .map((item) => ({
        label: item.label || null,
        url: item.url,
      })),
    expiresAt: toIsoFromDateTimeInput(values?.expiresAt),
    allowReply: values?.allowReply !== false,
    replyMode: values?.allowReply !== false ? String(values?.replyMode || 'quick_and_text') : 'quick_and_text',
  }

  if (options.includeStatus !== false) {
    payload.status = String(values?.status || 'active') === 'draft' ? 'draft' : 'active'
  }

  if (includeInitialAccess) {
    payload.initialAccess = {
      label: String(values?.initialAccess?.label || '').trim() || null,
      recipientName: String(values?.initialAccess?.recipientName || '').trim() || null,
      requirePin: values?.initialAccess?.requirePin === true,
    }

    if (payload.initialAccess.requirePin) {
      payload.initialAccess.pin = String(values?.initialAccess?.pin || '').trim()
    }
  }

  return payload
}

export function resolveQuickMessageTab(searchParams) {
  const current = String(searchParams.get('tab') || 'overview').trim().toLowerCase()
  return QUICK_MESSAGE_TABS.some((item) => item.key === current) ? current : 'overview'
}

export function stringifyReadOnlyCount(label, count) {
  const total = Number(count || 0)
  return `${total} ${label}`
}

export function buildQuickMessageAccessInitialValues(value = {}, options = {}) {
  const includePin = options.includePin === true
  return {
    label: String(value?.label || '').trim(),
    recipientName: String(value?.recipientName || '').trim(),
    expiresAt: value?.expiresAt ? formatDateTimeInput(value.expiresAt) : '',
    maxViews: value?.maxViews === null || value?.maxViews === undefined || value?.maxViews === '' ? '' : String(value.maxViews),
    requirePin: value?.requirePin === true,
    pin: includePin ? '' : undefined,
    pinConfirm: includePin ? '' : undefined,
  }
}

export function validateQuickMessageAccessForm(values, options = {}) {
  const includePin = options.includePin === true
  const errors = {}
  const expiresAtText = String(values?.expiresAt || '').trim()
  const maxViewsText = String(values?.maxViews || '').trim()

  if (expiresAtText) {
    const expiresAtDate = new Date(expiresAtText)
    if (Number.isNaN(expiresAtDate.getTime())) {
      errors.expiresAt = 'Thời gian hết hạn không hợp lệ.'
    } else if (expiresAtDate.getTime() <= Date.now()) {
      errors.expiresAt = 'Thời gian hết hạn phải ở tương lai.'
    }
  }

  if (maxViewsText) {
    const parsed = Number(maxViewsText)
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.maxViews = 'Giới hạn lượt xem phải là số nguyên tối thiểu 1.'
    }
  }

  if (includePin || values?.requirePin === true) {
    const pin = String(values?.pin || '').trim()
    const pinConfirm = String(values?.pinConfirm || '').trim()
    if (!/^\d{4,6}$/.test(pin)) {
      errors.pin = 'PIN phải gồm 4 đến 6 chữ số.'
    }
    if (pin !== pinConfirm) {
      errors.pinConfirm = 'PIN nhập lại chưa khớp.'
    }
  }

  return errors
}

export function buildQuickMessageAccessPayload(values, options = {}) {
  const includePin = options.includePin === true || values?.requirePin === true
  const payload = {
    label: String(values?.label || '').trim() || null,
    recipientName: String(values?.recipientName || '').trim() || null,
    expiresAt: String(values?.expiresAt || '').trim() ? toIsoFromDateTimeInput(values.expiresAt) : null,
    maxViews: String(values?.maxViews || '').trim() ? Number(values.maxViews) : null,
  }

  if (options.includeRequirePin === true) {
    payload.requirePin = values?.requirePin === true
  }

  if (includePin) {
    payload.pin = String(values?.pin || '').trim()
  }

  return payload
}

export function formatAccessViewCount(viewCount, maxViews) {
  const safeViewCount = Number(viewCount || 0)
  return `${safeViewCount} / ${maxViews ? maxViews : 'Không giới hạn'}`
}

export function canUnlockAccess(access) {
  return String(access?.status || '').trim().toLowerCase() === 'locked'
}