import { toText } from './examConfigurationUi'
import { EXAM_SUBJECT_CALCULATION_METHOD_OPTIONS } from './examSubjectUi'

function toInputValue(value) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

function toNumberOrNull(value) {
  const text = toText(value)
  if (!text) return null
  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : Number.NaN
}

function appendCloneSuffix(name) {
  const trimmed = toText(name)
  if (!trimmed) return ''
  return trimmed.endsWith(' - Bản sao') ? trimmed : `${trimmed} - Bản sao`
}

export function usesAggregateScore(calculationMethod) {
  const normalized = toText(calculationMethod).toLowerCase()
  return normalized === 'total' || normalized === 'average'
}

export function buildExamSubjectFormValues(value = {}, options = {}) {
  const mode = toText(options.mode).toLowerCase() || 'create'
  return {
    code: mode === 'clone' ? '' : toText(value?.code),
    name: mode === 'clone' ? appendCloneSuffix(value?.name) : toText(value?.name),
    ruleDescription: toText(value?.ruleDescription),
    calculationMethod: toText(value?.calculationMethod).toLowerCase() || 'total',
    requiredAggregateScore: toInputValue(value?.requiredAggregateScore),
    requireAllComponents: value?.requireAllComponents !== false,
    defaultFee: toInputValue(value?.defaultFee),
    isActive: mode === 'clone' ? true : value?.isActive !== false,
  }
}

export function validateExamSubjectForm(values) {
  const errors = {}
  const code = toText(values?.code)
  const name = toText(values?.name)
  const calculationMethod = toText(values?.calculationMethod).toLowerCase()
  const requiredAggregateScore = toNumberOrNull(values?.requiredAggregateScore)
  const defaultFeeText = toText(values?.defaultFee)
  const defaultFee = defaultFeeText ? toNumberOrNull(values?.defaultFee) : null

  if (!code) {
    errors.code = 'Mã môn thi là bắt buộc.'
  } else if (code.length > 100) {
    errors.code = 'Mã môn thi tối đa 100 ký tự.'
  }

  if (!name) {
    errors.name = 'Tên môn thi là bắt buộc.'
  } else if (name.length > 200) {
    errors.name = 'Tên môn thi tối đa 200 ký tự.'
  }

  if (!EXAM_SUBJECT_CALCULATION_METHOD_OPTIONS.some((item) => item.value && item.value === calculationMethod)) {
    errors.calculationMethod = 'Phương thức tính kết quả không hợp lệ.'
  }

  if (usesAggregateScore(calculationMethod)) {
    if (toText(values?.requiredAggregateScore) === '') {
      errors.requiredAggregateScore = 'Điểm yêu cầu là bắt buộc cho phương thức tính này.'
    } else if (Number.isNaN(requiredAggregateScore)) {
      errors.requiredAggregateScore = 'Điểm yêu cầu phải là số hợp lệ.'
    } else if (requiredAggregateScore < 0) {
      errors.requiredAggregateScore = 'Điểm yêu cầu phải lớn hơn hoặc bằng 0.'
    }
  } else if (toText(values?.requiredAggregateScore) && Number.isNaN(requiredAggregateScore)) {
    errors.requiredAggregateScore = 'Điểm yêu cầu phải là số hợp lệ.'
  }

  if (defaultFeeText) {
    if (Number.isNaN(defaultFee)) {
      errors.defaultFee = 'Lệ phí mặc định phải là số hợp lệ.'
    } else if (defaultFee < 0) {
      errors.defaultFee = 'Lệ phí mặc định phải lớn hơn hoặc bằng 0.'
    }
  }

  return errors
}

export function mapExamSubjectFormValuesToCreatePayload(values) {
  const calculationMethod = toText(values?.calculationMethod).toLowerCase() || 'total'
  return {
    code: toText(values?.code),
    name: toText(values?.name),
    calculationMethod,
    requiredAggregateScore: usesAggregateScore(calculationMethod)
      ? (toText(values?.requiredAggregateScore) ? Number(values.requiredAggregateScore) : null)
      : null,
    requireAllComponents: calculationMethod === 'all_components_pass' ? true : values?.requireAllComponents !== false,
    defaultFee: toText(values?.defaultFee) ? Number(values.defaultFee) : null,
    ruleDescription: toText(values?.ruleDescription) || null,
    isActive: values?.isActive !== false,
  }
}

export function mapExamSubjectFormValuesToUpdatePayload(values, originalValues) {
  const nextPayload = mapExamSubjectFormValuesToCreatePayload(values)
  const previousPayload = mapExamSubjectFormValuesToCreatePayload(originalValues || {})
  const changedPayload = {}

  Object.keys(nextPayload).forEach((key) => {
    if (nextPayload[key] !== previousPayload[key]) {
      changedPayload[key] = nextPayload[key]
    }
  })

  return changedPayload
}