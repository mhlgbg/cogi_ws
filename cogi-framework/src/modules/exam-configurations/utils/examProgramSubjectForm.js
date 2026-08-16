import { toText } from './examConfigurationUi'

function toInputValue(value) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

export function buildExamProgramSubjectFormValues(item = {}) {
  return {
    isRequired: item?.isRequired !== false,
    feeOverride: toInputValue(item?.feeOverride),
  }
}

export function validateExamProgramSubjectForm(values) {
  const errors = {}
  const feeText = toText(values?.feeOverride)
  if (feeText) {
    const parsed = Number(feeText)
    if (!Number.isFinite(parsed)) {
      errors.feeOverride = 'Lệ phí override phải là số hợp lệ.'
    } else if (parsed < 0) {
      errors.feeOverride = 'Lệ phí override phải lớn hơn hoặc bằng 0.'
    }
  }
  return errors
}

export function mapExamProgramSubjectFormValuesToPayload(values) {
  return {
    isRequired: values?.isRequired !== false,
    feeOverride: toText(values?.feeOverride) ? Number(values.feeOverride) : null,
  }
}