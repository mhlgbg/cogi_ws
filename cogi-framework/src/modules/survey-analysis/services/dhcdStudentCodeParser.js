const DHCD_STUDENT_CODE_REGEX = /^(\d{2})(\d)([A-Z])(\d{3})(\d{4})$/

export const DHCD_MAJOR_MAP = {
  '502': 'Bảo hộ lao động',
  '601': 'Công tác XH',
  '403': 'Kế toán',
  '801': 'Luật',
  '401': 'Quản trị kinh doanh',
  '404': 'Quản trị nhân lực',
  '402': 'Tài chính ngân hàng',
  '103': 'Xã hội học',
  '408': 'Quan hệ lao động và CĐ',
  '460': 'Khoa học cơ bản và Dữ liệu',
  '201': 'Ngôn ngữ anh',
  '106': 'Việt Nam học',
  '810': 'Du lịch',
  '101': 'Kinh tế',
  '480': 'Công nghệ và Kỹ thuật',
  '320': 'Truyền thông và Quan hệ công chúng',
}

const EDUCATION_LEVEL_MAP = {
  D: 'Đại học',
}

function normalizeStudentCode(value) {
  return String(value || '').trim().toUpperCase()
}

export function parseDhcdStudentCode(studentCode) {
  const normalized = normalizeStudentCode(studentCode)
  const match = DHCD_STUDENT_CODE_REGEX.exec(normalized)

  if (!match) {
    return {
      ok: false,
      error: 'Mã sinh viên sai định dạng',
      studentCode: normalized,
    }
  }

  const [, yearCode, trainingDurationCode, educationLevelCode, majorCode, studentOrdinal] = match
  const admissionYear = 2000 + Number(yearCode)
  const trainingDuration = Number(trainingDurationCode)
  const educationLevelName = EDUCATION_LEVEL_MAP[educationLevelCode] || 'Không xác định'
  const majorName = DHCD_MAJOR_MAP[majorCode] || 'Không xác định'

  return {
    ok: true,
    studentCode: normalized,
    admissionYear,
    cohort: `K${yearCode}`,
    trainingDuration,
    educationLevelCode,
    educationLevelName,
    majorCode,
    majorName,
    studentOrdinal,
  }
}
