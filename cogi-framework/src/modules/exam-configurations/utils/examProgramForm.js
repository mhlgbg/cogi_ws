import { toText } from './examConfigurationUi'
import { EXAM_PROGRAM_FEE_METHOD_OPTIONS } from './examProgramUi'

function toInputValue(value) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

function appendCloneSuffix(name) {
  const trimmed = toText(name)
  if (!trimmed) return ''
  return trimmed.endsWith(' - Bản sao') ? trimmed : `${trimmed} - Bản sao`
}

export function buildExamProgramFormValues(value = {}, options = {}) {
  const mode = toText(options.mode).toLowerCase() || 'create'
  return {
    code: mode === 'clone' ? '' : toText(value?.code),
    name: mode === 'clone' ? appendCloneSuffix(value?.name) : toText(value?.name),
    targetDescription: toText(value?.targetDescription),
    passingMethod: toText(value?.passingMethod).toLowerCase() || 'all_subjects_pass',
    feeCalculationMethod: toText(value?.feeCalculationMethod).toLowerCase() || 'sum_subject_fees',
    defaultFee: toInputValue(value?.defaultFee),
    validFrom: toText(value?.validFrom),
    validTo: toText(value?.validTo),
    isActive: mode === 'clone' ? true : value?.isActive !== false,
  }
}

export function validateExamProgramForm(values) {
  const errors = {}
  const code = toText(values?.code)
  const name = toText(values?.name)
  const feeCalculationMethod = toText(values?.feeCalculationMethod).toLowerCase()
  const defaultFeeText = toText(values?.defaultFee)
  const defaultFee = defaultFeeText ? Number(defaultFeeText) : null
  const validFrom = toText(values?.validFrom)
  const validTo = toText(values?.validTo)

  if (!code) {
    errors.code = 'Mã chương trình là bắt buộc.'
  } else if (code.length > 100) {
    errors.code = 'Mã chương trình tối đa 100 ký tự.'
  }

  if (!name) {
    errors.name = 'Tên chương trình là bắt buộc.'
  } else if (name.length > 200) {
    errors.name = 'Tên chương trình tối đa 200 ký tự.'
  }

  if (!EXAM_PROGRAM_FEE_METHOD_OPTIONS.some((item) => item.value && item.value === feeCalculationMethod)) {
    errors.feeCalculationMethod = 'Phương thức tính lệ phí không hợp lệ.'
  }

  if (feeCalculationMethod === 'fixed') {
    if (!defaultFeeText) {
      errors.defaultFee = 'Lệ phí mặc định là bắt buộc khi dùng phương thức lệ phí cố định.'
    } else if (!Number.isFinite(defaultFee)) {
      errors.defaultFee = 'Lệ phí mặc định phải là số hợp lệ.'
    } else if (defaultFee < 0) {
      errors.defaultFee = 'Lệ phí mặc định phải lớn hơn hoặc bằng 0.'
    }
  } else if (defaultFeeText) {
    if (!Number.isFinite(defaultFee)) {
      errors.defaultFee = 'Lệ phí mặc định phải là số hợp lệ.'
    } else if (defaultFee < 0) {
      errors.defaultFee = 'Lệ phí mặc định phải lớn hơn hoặc bằng 0.'
    }
  }

  if (validFrom && Number.isNaN(Date.parse(validFrom))) {
    errors.validFrom = 'Ngày hiệu lực từ không hợp lệ.'
  }
  if (validTo && Number.isNaN(Date.parse(validTo))) {
    errors.validTo = 'Ngày hiệu lực đến không hợp lệ.'
  }
  if (validFrom && validTo && !errors.validFrom && !errors.validTo && Date.parse(validFrom) > Date.parse(validTo)) {
    errors.validFrom = 'Ngày hiệu lực từ không được sau ngày hiệu lực đến.'
  }

  return errors
}

export function mapExamProgramFormValuesToCreatePayload(values) {
  const feeCalculationMethod = toText(values?.feeCalculationMethod).toLowerCase() || 'sum_subject_fees'
  return {
    code: toText(values?.code),
    name: toText(values?.name),
    passingMethod: toText(values?.passingMethod).toLowerCase() || 'all_subjects_pass',
    feeCalculationMethod,
    defaultFee: feeCalculationMethod === 'fixed'
      ? (toText(values?.defaultFee) ? Number(values.defaultFee) : null)
      : (toText(values?.defaultFee) ? Number(values.defaultFee) : null),
    targetDescription: toText(values?.targetDescription) || null,
    validFrom: toText(values?.validFrom) || null,
    validTo: toText(values?.validTo) || null,
    isActive: values?.isActive !== false,
  }
}

export function mapExamProgramFormValuesToUpdatePayload(values, originalValues) {
  const nextPayload = mapExamProgramFormValuesToCreatePayload(values)
  const previousPayload = mapExamProgramFormValuesToCreatePayload(originalValues || {})
  const changedPayload = {}
  Object.keys(nextPayload).forEach((key) => {
    if (nextPayload[key] !== previousPayload[key]) {
      changedPayload[key] = nextPayload[key]
    }
  })
  return changedPayload
}