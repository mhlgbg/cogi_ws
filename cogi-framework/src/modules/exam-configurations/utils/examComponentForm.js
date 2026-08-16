import { toText } from './examConfigurationUi'

export const EXAM_COMPONENT_EXAM_METHOD_OPTIONS = [
  { value: 'computer', label: 'Trên máy tính' },
  { value: 'paper', label: 'Trên giấy' },
  { value: 'oral', label: 'Vấn đáp' },
  { value: 'practical', label: 'Thực hành' },
  { value: 'mixed', label: 'Kết hợp' },
  { value: 'other', label: 'Khác' },
]

function toInputValue(value) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

function isAllowedExamMethod(value) {
  const normalized = toText(value).toLowerCase()
  return EXAM_COMPONENT_EXAM_METHOD_OPTIONS.some((item) => item.value === normalized)
}

function normalizeNumberInput(value, options = {}) {
  const trimmed = toText(value)
  if (!trimmed) return null

  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric)) return Number.NaN
  if (options.integer && !Number.isInteger(numeric)) return Number.NaN
  if (options.positive && numeric <= 0) return Number.NaN
  return numeric
}

function appendCloneSuffix(name) {
  const trimmed = toText(name)
  if (!trimmed) return ''
  return trimmed.endsWith(' - Bản sao') ? trimmed : `${trimmed} - Bản sao`
}

export function buildExamComponentFormValues(value = {}, options = {}) {
  const mode = String(options.mode || 'create').trim().toLowerCase()
  return {
    code: mode === 'clone' ? '' : toText(value?.code),
    name: mode === 'clone' ? appendCloneSuffix(value?.name) : toText(value?.name),
    description: toText(value?.description),
    minimumScore: toInputValue(value?.minimumScore),
    maximumScore: toInputValue(value?.maximumScore),
    passingScore: toInputValue(value?.passingScore),
    defaultDurationMinutes: toInputValue(value?.defaultDurationMinutes),
    examMethod: toText(value?.examMethod).toLowerCase() || 'other',
    isActive: mode === 'clone' ? true : value?.isActive !== false,
    componentType: toText(value?.componentType).toLowerCase() || 'skill',
  }
}

export function validateExamComponentForm(values) {
  const errors = {}
  const code = toText(values?.code)
  const name = toText(values?.name)
  const minimumScore = normalizeNumberInput(values?.minimumScore)
  const maximumScore = normalizeNumberInput(values?.maximumScore)
  const passingScoreText = toText(values?.passingScore)
  const passingScore = passingScoreText ? normalizeNumberInput(values?.passingScore) : null
  const durationText = toText(values?.defaultDurationMinutes)
  const duration = durationText ? normalizeNumberInput(values?.defaultDurationMinutes, { integer: true, positive: true }) : null
  const examMethod = toText(values?.examMethod).toLowerCase()

  if (!code) {
    errors.code = 'Mã kỹ năng là bắt buộc.'
  }

  if (!name) {
    errors.name = 'Tên kỹ năng là bắt buộc.'
  }

  if (Number.isNaN(minimumScore)) {
    errors.minimumScore = 'Điểm tối thiểu phải là số hợp lệ.'
  }

  if (Number.isNaN(maximumScore)) {
    errors.maximumScore = 'Điểm tối đa phải là số hợp lệ.'
  }

  if (minimumScore === null) {
    errors.minimumScore = 'Điểm tối thiểu là bắt buộc.'
  }

  if (maximumScore === null) {
    errors.maximumScore = 'Điểm tối đa là bắt buộc.'
  }

  if (!errors.minimumScore && !errors.maximumScore && minimumScore > maximumScore) {
    errors.minimumScore = 'Điểm tối thiểu không được lớn hơn điểm tối đa.'
    errors.maximumScore = 'Điểm tối đa phải lớn hơn hoặc bằng điểm tối thiểu.'
  }

  if (passingScoreText && Number.isNaN(passingScore)) {
    errors.passingScore = 'Điểm đạt phải là số hợp lệ.'
  }

  if (!errors.minimumScore && !errors.maximumScore && passingScore !== null && !Number.isNaN(passingScore)) {
    if (passingScore < minimumScore || passingScore > maximumScore) {
      errors.passingScore = 'Điểm đạt phải nằm trong khoảng điểm tối thiểu và điểm tối đa.'
    }
  }

  if (durationText && Number.isNaN(duration)) {
    errors.defaultDurationMinutes = 'Thời lượng mặc định phải là số nguyên lớn hơn 0.'
  }

  if (!isAllowedExamMethod(examMethod)) {
    errors.examMethod = 'Hình thức thi không hợp lệ.'
  }

  return errors
}

export function mapExamComponentFormValuesToCreatePayload(values) {
  return {
    code: toText(values?.code),
    name: toText(values?.name),
    description: toText(values?.description) || null,
    minimumScore: normalizeNumberInput(values?.minimumScore),
    maximumScore: normalizeNumberInput(values?.maximumScore),
    passingScore: toText(values?.passingScore) ? normalizeNumberInput(values?.passingScore) : null,
    defaultDurationMinutes: toText(values?.defaultDurationMinutes)
      ? normalizeNumberInput(values?.defaultDurationMinutes, { integer: true, positive: true })
      : null,
    examMethod: toText(values?.examMethod).toLowerCase() || 'other',
    isActive: values?.isActive !== false,
  }
}

export function mapExamComponentFormValuesToUpdatePayload(values, originalValues) {
  const nextPayload = mapExamComponentFormValuesToCreatePayload(values)
  const previousPayload = mapExamComponentFormValuesToCreatePayload(originalValues || {})
  const changedPayload = {}

  Object.keys(nextPayload).forEach((key) => {
    if (nextPayload[key] !== previousPayload[key]) {
      changedPayload[key] = nextPayload[key]
    }
  })

  return changedPayload
}