import { buildProtectedFileUrl, resolveMediaUrl } from '../../../utils/mediaUrl'

export const QUESTION_TYPE_LABELS = {
  single_choice: 'Một đáp án',
  multiple_choice: 'Nhiều đáp án',
  true_false: 'Đúng / Sai',
  short_answer: 'Trả lời ngắn',
  essay: 'Tự luận',
  ordering: 'Sắp xếp',
  matching: 'Nối',
  fill_blank: 'Điền khuyết',
}

export const STIMULUS_TYPE_LABELS = {
  text: 'Văn bản',
  audio: 'Âm thanh',
  image: 'Hình ảnh',
  mixed: 'Hỗn hợp',
}

export const TAB_DEFINITIONS = [
  { key: 'questions', label: 'Câu hỏi', featureKeys: ['learning.question.manage', 'learning.learning-object.manage'] },
  { key: 'stimuli', label: 'Stimulus', featureKeys: ['learning.question-stimulus.manage', 'learning.question.manage', 'learning.learning-object.manage'] },
  { key: 'subjects', label: 'Môn học', featureKeys: ['learning.subject.manage', 'learning.learning-object.manage'] },
  { key: 'grades', label: 'Khối lớp', featureKeys: ['learning.grade.manage', 'learning.learning-object.manage'] },
  { key: 'skills', label: 'Kỹ năng', featureKeys: ['learning.learning-object.manage'] },
  { key: 'knowledge-nodes', label: 'Chủ đề kiến thức', featureKeys: ['learning.learning-object.manage'] },
  { key: 'formulas', label: 'Công thức', featureKeys: ['learning.formula.manage', 'learning.learning-object.manage'] },
]

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export function getEntityId(entity) {
  if (!entity) return ''
  return entity.documentId || entity.id || ''
}

export function getQuestionTypeLabel(type) {
  return QUESTION_TYPE_LABELS[String(type || '').trim()] || type || '-'
}

export function getStimulusTypeLabel(type) {
  return STIMULUS_TYPE_LABELS[String(type || '').trim()] || type || '-'
}

export function getStatusBadgeColor(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'active' || normalized === 'approved' || normalized === 'published') return 'success'
  if (normalized === 'draft' || normalized === 'pending') return 'warning'
  if (normalized === 'archived' || normalized === 'inactive' || normalized === 'hidden') return 'secondary'
  if (normalized === 'cancelled' || normalized === 'rejected' || normalized === 'failed') return 'danger'
  return 'secondary'
}

export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export function truncateText(value, limit = 140) {
  const text = String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return '-'
  if (text.length <= limit) return text
  return `${text.slice(0, limit).trim()}...`
}

export function getFileAssetUrl(fileAsset) {
  if (!fileAsset || typeof fileAsset !== 'object') return ''
  return buildProtectedFileUrl({
    fileAssetId: fileAsset.id,
    storageProvider: fileAsset.provider,
    url: fileAsset.url,
  }) || resolveMediaUrl(fileAsset.url)
}

export function normalizePagination(meta) {
  const pagination = meta?.pagination || meta || {}
  const page = Number(pagination.page || 1)
  const pageSize = Number(pagination.pageSize || 10)
  const total = Number(pagination.total || 0)
  const pageCount = Number(pagination.pageCount || (total > 0 ? Math.ceil(total / pageSize) : 1))
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10,
    total: Number.isInteger(total) && total >= 0 ? total : 0,
    pageCount: Number.isInteger(pageCount) && pageCount > 0 ? pageCount : 1,
  }
}

export function buildPages(currentPage, pageCount) {
  const maxButtons = 7
  const pages = []

  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }

  const left = Math.max(1, currentPage - 2)
  const right = Math.min(pageCount, currentPage + 2)

  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) {
    if (index !== 1 && index !== pageCount) pages.push(index)
  }
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)

  return pages
}

export function parseOptionalJson(rawValue, label) {
  const text = String(rawValue || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${label} phải là JSON hợp lệ`)
  }
}

export function canAccessAnyFeature(feature, featureKeys = []) {
  if (!feature || typeof feature.hasFeature !== 'function') return false
  return featureKeys.some((key) => feature.hasFeature(key))
}
