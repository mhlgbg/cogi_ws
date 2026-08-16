import { toText } from './examConfigurationUi'

function toInputValue(value) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

function toNumberOrNaN(value) {
  const text = toText(value)
  if (!text) return null
  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : Number.NaN
}

export function buildExamSubjectComponentFormValues(item = {}) {
  return {
    isRequired: item?.isRequired !== false,
    weight: toInputValue(item?.weight),
    passingScoreOverride: toInputValue(item?.passingScoreOverride),
    eliminationScoreOverride: toInputValue(item?.eliminationScoreOverride),
    durationMinutesOverride: toInputValue(item?.durationMinutesOverride),
  }
}

export function validateExamSubjectComponentForm(values, item = {}) {
  const errors = {}
  const weight = toNumberOrNaN(values?.weight)
  const passingScoreOverride = toNumberOrNaN(values?.passingScoreOverride)
  const eliminationScoreOverride = toNumberOrNaN(values?.eliminationScoreOverride)
  const durationMinutesOverride = toNumberOrNaN(values?.durationMinutesOverride)
  const minimumScore = item?.minimumScore === null || item?.minimumScore === undefined ? null : Number(item.minimumScore)
  const maximumScore = item?.maximumScore === null || item?.maximumScore === undefined ? null : Number(item.maximumScore)

  if (toText(values?.weight)) {
    if (Number.isNaN(weight)) {
      errors.weight = 'Trọng số phải là số hợp lệ.'
    } else if (weight < 0) {
      errors.weight = 'Trọng số phải lớn hơn hoặc bằng 0.'
    }
  }

  if (toText(values?.passingScoreOverride)) {
    if (Number.isNaN(passingScoreOverride)) {
      errors.passingScoreOverride = 'Điểm đạt override phải là số hợp lệ.'
    } else if (minimumScore !== null && maximumScore !== null && (passingScoreOverride < minimumScore || passingScoreOverride > maximumScore)) {
      errors.passingScoreOverride = 'Điểm đạt override phải nằm trong khoảng điểm của kỹ năng.'
    }
  }

  if (toText(values?.eliminationScoreOverride)) {
    if (Number.isNaN(eliminationScoreOverride)) {
      errors.eliminationScoreOverride = 'Điểm liệt override phải là số hợp lệ.'
    } else if (minimumScore !== null && maximumScore !== null && (eliminationScoreOverride < minimumScore || eliminationScoreOverride > maximumScore)) {
      errors.eliminationScoreOverride = 'Điểm liệt override phải nằm trong khoảng điểm của kỹ năng.'
    }
  }

  if (toText(values?.durationMinutesOverride)) {
    if (Number.isNaN(durationMinutesOverride)) {
      errors.durationMinutesOverride = 'Thời lượng override phải là số nguyên hợp lệ.'
    } else if (!Number.isInteger(durationMinutesOverride) || durationMinutesOverride <= 0) {
      errors.durationMinutesOverride = 'Thời lượng override phải là số nguyên lớn hơn 0.'
    }
  }

  return errors
}

export function mapExamSubjectComponentFormValuesToPayload(values) {
  return {
    isRequired: values?.isRequired !== false,
    weight: toText(values?.weight) ? Number(values.weight) : null,
    passingScoreOverride: toText(values?.passingScoreOverride) ? Number(values.passingScoreOverride) : null,
    eliminationScoreOverride: toText(values?.eliminationScoreOverride) ? Number(values.eliminationScoreOverride) : null,
    durationMinutesOverride: toText(values?.durationMinutesOverride) ? Number(values.durationMinutesOverride) : null,
  }
}