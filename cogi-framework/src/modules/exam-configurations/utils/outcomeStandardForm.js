import { toText } from './examConfigurationUi'
import { OUTCOME_RECOGNITION_METHOD_OPTIONS } from './outcomeStandardUi'

function appendCloneSuffix(name) {
  const trimmed = toText(name)
  if (!trimmed) return ''
  return trimmed.endsWith(' - Bản sao') ? trimmed : `${trimmed} - Bản sao`
}

export function buildOutcomeStandardFormValues(value = {}, options = {}) {
  const mode = toText(options.mode).toLowerCase() || 'create'
  return {
    code: mode === 'clone' ? '' : toText(value?.code),
    name: mode === 'clone' ? appendCloneSuffix(value?.name) : toText(value?.name),
    examProgram: value?.examProgramId ? String(value.examProgramId) : value?.examProgramDocumentId || '',
    applicableDescription: toText(value?.applicableDescription),
    recognitionMethod: toText(value?.recognitionMethod).toLowerCase() || 'exam_program',
    validFrom: toText(value?.validFrom),
    validTo: toText(value?.validTo),
    isActive: mode === 'clone' ? true : value?.isActive !== false,
  }
}

export function validateOutcomeStandardForm(values) {
  const errors = {}
  const code = toText(values?.code)
  const name = toText(values?.name)
  const validFrom = toText(values?.validFrom)
  const validTo = toText(values?.validTo)
  const recognitionMethod = toText(values?.recognitionMethod).toLowerCase()

  if (!code) errors.code = 'Mã chuẩn là bắt buộc.'
  else if (code.length > 100) errors.code = 'Mã chuẩn tối đa 100 ký tự.'

  if (!name) errors.name = 'Tên chuẩn là bắt buộc.'
  else if (name.length > 200) errors.name = 'Tên chuẩn tối đa 200 ký tự.'

  if (!OUTCOME_RECOGNITION_METHOD_OPTIONS.some((item) => item.value && item.value === recognitionMethod)) {
    errors.recognitionMethod = 'Phương thức công nhận không hợp lệ.'
  }

  if (validFrom && Number.isNaN(Date.parse(validFrom))) errors.validFrom = 'Ngày hiệu lực từ không hợp lệ.'
  if (validTo && Number.isNaN(Date.parse(validTo))) errors.validTo = 'Ngày hiệu lực đến không hợp lệ.'
  if (validFrom && validTo && !errors.validFrom && !errors.validTo && Date.parse(validFrom) > Date.parse(validTo)) {
    errors.validFrom = 'Ngày hiệu lực từ không được sau ngày hiệu lực đến.'
  }

  return errors
}

export function mapOutcomeStandardFormValuesToCreatePayload(values) {
  return {
    code: toText(values?.code),
    name: toText(values?.name),
    examProgram: toText(values?.examProgram) || null,
    applicableDescription: toText(values?.applicableDescription) || null,
    recognitionMethod: toText(values?.recognitionMethod).toLowerCase() || 'exam_program',
    validFrom: toText(values?.validFrom) || null,
    validTo: toText(values?.validTo) || null,
    isActive: values?.isActive !== false,
  }
}

export function mapOutcomeStandardFormValuesToUpdatePayload(values, originalValues) {
  const nextPayload = mapOutcomeStandardFormValuesToCreatePayload(values)
  const previousPayload = mapOutcomeStandardFormValuesToCreatePayload(originalValues || {})
  const changedPayload = {}
  Object.keys(nextPayload).forEach((key) => {
    if (nextPayload[key] !== previousPayload[key]) changedPayload[key] = nextPayload[key]
  })
  return changedPayload
}