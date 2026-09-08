export const CLASS_SESSION_WEEKDAY_OPTIONS = [
  { value: 1, label: 'Thứ Hai' },
  { value: 2, label: 'Thứ Ba' },
  { value: 3, label: 'Thứ Tư' },
  { value: 4, label: 'Thứ Năm' },
  { value: 5, label: 'Thứ Sáu' },
  { value: 6, label: 'Thứ Bảy' },
  { value: 0, label: 'Chủ Nhật' },
]

export const CLASS_SESSION_ATTENDANCE_OPTIONS = [
  { value: 'present', label: 'Có mặt' },
  { value: 'absent', label: 'Vắng' },
  { value: 'late', label: 'Đi muộn' },
  { value: 'excused', label: 'Vắng có phép' },
]

export const CLASS_SESSION_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Đã lên lịch', color: 'info' },
  { value: 'in_progress', label: 'Đang diễn ra', color: 'warning' },
  { value: 'completed', label: 'Hoàn thành', color: 'success' },
  { value: 'cancelled', label: 'Đã hủy', color: 'secondary' },
]

export const CLASS_SESSION_CONTENT_FIELDS = [
  { key: 'lessonContent', title: 'Nội dung đã học' },
  { key: 'homework', title: 'Bài tập về nhà' },
  { key: 'teacherComment', title: 'Nhận xét chung' },
]

export function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function formatSessionDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('vi-VN')
}

export function formatSessionDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

export function formatSessionTime(value) {
  const text = toText(value)
  if (!text) return '-'
  const parts = text.split(':')
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : text
}

export function formatTeacherDisplay(teacher) {
  if (!teacher) return '-'
  const fullName = toText(teacher.fullName)
  const username = toText(teacher.username)
  const email = toText(teacher.email)
  if (fullName && username) return `${fullName} (${username})`
  return fullName || username || email || '-'
}

export function getClassSessionStatusMeta(status) {
  return CLASS_SESSION_STATUS_OPTIONS.find((item) => item.value === status) || CLASS_SESSION_STATUS_OPTIONS[0]
}

export function buildSessionForm(detail) {
  return {
    sessionDate: '',
    startTime: '',
    endTime: '',
    teacher: String(detail?.mainTeacher?.id || ''),
    room: '',
    location: '',
    title: '',
    note: '',
    status: 'scheduled',
  }
}

export function buildSessionFormFromItem(session, classDetail) {
  return {
    sessionDate: session?.sessionDate || '',
    startTime: formatSessionTime(session?.startTime),
    endTime: formatSessionTime(session?.endTime),
    teacher: String(session?.teacher?.id || classDetail?.mainTeacher?.id || ''),
    room: toText(session?.room),
    location: toText(session?.location),
    title: toText(session?.title),
    note: toText(session?.note),
    status: toText(session?.status) || 'scheduled',
  }
}

export function buildBulkForm(detail) {
  return {
    startDate: '',
    endDate: '',
    weekdays: [],
    startTime: '',
    endTime: '',
    teacher: String(detail?.mainTeacher?.id || ''),
    room: '',
    location: '',
    note: '',
  }
}

export function buildReportDraft(session) {
  return {
    lessonContent: toText(session?.lessonContent),
    homework: toText(session?.homework),
    teacherComment: toText(session?.teacherComment),
  }
}

export function buildAttendanceDraft(session) {
  return (Array.isArray(session?.eligibleLearners) ? session.eligibleLearners : []).map((item) => ({
    learnerId: item?.learner?.id || 0,
    learner: item?.learner || null,
    status: toText(item?.attendance?.status) || 'present',
    note: toText(item?.attendance?.note),
    historicalOnly: item?.historicalOnly === true,
    joinDate: item?.joinDate || null,
    leaveDate: item?.leaveDate || null,
  }))
}

export function buildBulkPreview(form) {
  const start = toText(form.startDate)
  const end = toText(form.endDate)
  const startTime = toText(form.startTime)
  const endTime = toText(form.endTime)
  if (!start || !end || !startTime || !endTime || !Array.isArray(form.weekdays) || form.weekdays.length === 0) {
    return []
  }

  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return []
  }

  const allowedWeekdays = new Set(form.weekdays.map((item) => Number(item)))
  const dates = []
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    const weekday = cursor.getDay()
    if (allowedWeekdays.has(weekday)) {
      const yyyy = cursor.getFullYear()
      const mm = String(cursor.getMonth() + 1).padStart(2, '0')
      const dd = String(cursor.getDate()).padStart(2, '0')
      dates.push({
        key: `${yyyy}-${mm}-${dd}|${startTime}|${endTime}`,
        sessionDate: `${yyyy}-${mm}-${dd}`,
        startTime,
        endTime,
        selected: true,
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function getSessionDisplayStatus(session) {
  if (session?.status === 'cancelled') return 'Đã hủy'
  if (session?.reportSummary?.isCompleted) return 'Đã hoàn thành'
  if (session?.timing?.needsReport) return 'Chưa hoàn thành báo cáo'
  if (session?.reportSummary?.hasReport) return 'Đã lưu tạm'
  return 'Thiếu báo cáo'
}