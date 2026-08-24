import { buildPages, formatDateTime, getEntityId, getFileAssetUrl, getQuestionTypeLabel, getStatusBadgeColor, normalizePagination, truncateText } from '../../learning-management/utils/questionBankUi'

export { buildPages, formatDateTime, getEntityId, getFileAssetUrl, getQuestionTypeLabel, getStatusBadgeColor, normalizePagination, truncateText }

export const ASSESSMENT_TYPE_LABELS = {
  placement: 'Xếp lớp',
  diagnostic: 'Đánh giá đầu vào',
  practice: 'Luyện tập',
  quiz: 'Bài kiểm tra',
  exam: 'Kỳ thi',
  other: 'Khác',
}

export const VERSION_STATUS_LABELS = {
  draft: 'Bản nháp',
  published: 'Đã phát hành',
  retired: 'Ngừng sử dụng',
}

export const ASSESSMENT_STATUS_LABELS = {
  draft: 'Bản nháp',
  active: 'Đang hoạt động',
  archived: 'Lưu trữ',
}

export const RESULT_MODE_LABELS = {
  provisional: 'Tạm thời',
  final: 'Chính thức',
}
export const RESULT_STATUS_LABELS = {
  pending: 'Chờ xử lý',
  partially_scored: 'Chờ hoàn tất',
  provisional: 'Sơ bộ',
  confirmed: 'Đã xác nhận',
  superseded: 'Đã thay thế',
  cancelled: 'Đã hủy',
}

export const ANSWER_SCORE_STATUS_LABELS = {
  pending: 'Chờ chấm',
  auto_scored: 'Đã chấm tự động',
  manual_scored: 'Đã chấm thủ công',
  not_scored: 'Không chấm',
  invalid: 'Không hợp lệ',
}

export const SCORING_METHOD_LABELS = {
  auto: 'Tự động',
  manual: 'Thủ công',
  none: 'Không áp dụng',
}
export const SPEAKING_REVIEW_STATUS_LABELS = {
  pending: 'Chờ bắt đầu',
  in_review: 'Đang đánh giá',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy',
}
export const PLACEMENT_CONFIRMATION_STATUS_LABELS = {
  draft: 'Nháp',
  confirmed: 'Đã xác nhận',
  superseded: 'Đã thay thế',
  cancelled: 'Đã hủy',
}
export const ATTEMPT_STATUS_LABELS = {
  created: 'Chưa bắt đầu',
  in_progress: 'Đang làm bài',
  submitted: 'Đã nộp',
  expired: 'Hết thời gian',
  cancelled: 'Đã hủy',
}

export const CEFR_LABELS = {
  PRE_A1: 'Pre-A1',
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
  C1: 'C1',
  C2: 'C2',
}

export function getAssessmentTypeLabel(value) {
  return ASSESSMENT_TYPE_LABELS[String(value || '').trim()] || value || '-'
}

export function getVersionStatusLabel(value) {
  return VERSION_STATUS_LABELS[String(value || '').trim()] || value || '-'
}

export function getAssessmentStatusLabel(value) {
  return ASSESSMENT_STATUS_LABELS[String(value || '').trim()] || value || '-'
}

export function getResultModeLabel(value) {
  return RESULT_MODE_LABELS[String(value || '').trim()] || value || '-'
}
export function getResultStatusLabel(value) {
  return RESULT_STATUS_LABELS[String(value || '').trim()] || value || '-'
}
export function getAnswerScoreStatusLabel(value) {
  return ANSWER_SCORE_STATUS_LABELS[String(value || '').trim()] || value || '-'
}
export function getScoringMethodLabel(value) {
  return SCORING_METHOD_LABELS[String(value || '').trim()] || value || '-'
}
export function getSpeakingReviewStatusLabel(value) {
  return SPEAKING_REVIEW_STATUS_LABELS[String(value || '').trim()] || value || '-'
}
export function getPlacementConfirmationStatusLabel(value) {
  return PLACEMENT_CONFIRMATION_STATUS_LABELS[String(value || '').trim()] || value || '-'
}
export function getAttemptStatusLabel(value) {
  return ATTEMPT_STATUS_LABELS[String(value || '').trim()] || value || '-'
}

export function getCefrLabel(value) {
  return CEFR_LABELS[String(value || '').trim()] || value || '-'
}

export function formatGradeRange(version) {
  if (version?.gradeFrom && version?.gradeTo) return `Grade ${version.gradeFrom}–${version.gradeTo}`
  return '-'
}

export function formatCandidateRange(version) {
  if (version?.candidateLevelFrom && version?.candidateLevelTo) return `${getCefrLabel(version.candidateLevelFrom)} → ${getCefrLabel(version.candidateLevelTo)}`
  if (version?.candidateLevelFrom) return getCefrLabel(version.candidateLevelFrom)
  if (version?.candidateLevelTo) return getCefrLabel(version.candidateLevelTo)
  return '-'
}

export function computeSectionStats(section) {
  const rows = Array.isArray(section?.assessmentQuestions) ? section.assessmentQuestions : []
  return {
    totalQuestions: rows.length,
    totalPoints: rows.reduce((sum, item) => sum + Number(item?.points || 0), 0),
  }
}

export function computeVersionStats(version) {
  const sections = Array.isArray(version?.sections) ? version.sections : []
  if (sections.length === 0) {
    return {
      totalSections: Number(version?.sectionCount || 0),
      totalQuestions: Number(version?.questionCount || 0),
      totalPoints: Number(version?.totalPoints || 0),
    }
  }
  return sections.reduce((result, section) => {
    const sectionStats = computeSectionStats(section)
    return {
      totalSections: result.totalSections + 1,
      totalQuestions: result.totalQuestions + sectionStats.totalQuestions,
      totalPoints: result.totalPoints + sectionStats.totalPoints,
    }
  }, { totalSections: 0, totalQuestions: 0, totalPoints: 0 })
}

export function getRuntimeConfigSummary(assessmentQuestion) {
  const parts = []
  if (assessmentQuestion?.audioPlayLimit) parts.push(`Nghe tối đa ${assessmentQuestion.audioPlayLimit} lần`)
  if (assessmentQuestion?.allowSeek === false) parts.push('Không tua')
  if (assessmentQuestion?.minWords || assessmentQuestion?.maxWords) {
    const minWords = assessmentQuestion?.minWords ?? 0
    const maxWords = assessmentQuestion?.maxWords ?? 0
    parts.push(`${minWords}–${maxWords} từ`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'Mặc định'
}

export function formatScorePair(score, maxScore) {
  if (score === null || score === undefined) return `-/${maxScore ?? '-'}`
  if (maxScore === null || maxScore === undefined) return String(score)
  return `${score}/${maxScore}`
}

export function getResultStatusBadgeColor(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'provisional') return 'success'
  if (normalized === 'partially_scored') return 'warning'
  if (normalized === 'superseded') return 'secondary'
  if (normalized === 'confirmed') return 'primary'
  if (normalized === 'cancelled') return 'secondary'
  return 'secondary'
}

export function getAnswerScoreStatusBadgeColor(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'manual_scored' || normalized === 'auto_scored') return 'success'
  if (normalized === 'pending') return 'warning'
  if (normalized === 'invalid') return 'danger'
  return 'secondary'
}

export function getPlacementConfirmationBadgeColor(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'confirmed') return 'success'
  if (normalized === 'draft') return 'warning'
  if (normalized === 'superseded') return 'secondary'
  if (normalized === 'cancelled') return 'danger'
  return 'secondary'
}
