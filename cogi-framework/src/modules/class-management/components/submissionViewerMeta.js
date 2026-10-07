export const SUBMISSION_STATUS_META = {
  draft: { label: 'Bản nháp', color: 'secondary' },
  submitted: { label: 'Đã nộp', color: 'warning' },
  accepted: { label: 'Đã duyệt', color: 'success' },
  returned: { label: 'Làm lại', color: 'danger' },
}

export function getSubmissionStatusMeta(status) {
  return SUBMISSION_STATUS_META[String(status || '').trim()] || { label: 'Đã nộp', color: 'dark' }
}

export function getSubmissionVersionLabel(version) {
  return `Lần nộp ${Number(version || 1) || 1}`
}