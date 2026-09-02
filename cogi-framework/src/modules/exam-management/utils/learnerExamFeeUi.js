import { normalizeStatus } from './examRoundUi.js'

function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function firstDefinedNumber(...values) {
  for (const value of values) {
    const numeric = toFiniteNumber(value)
    if (numeric !== null) return numeric
  }
  return null
}

export function resolveLearnerExamFeeMode(source = {}) {
  const method = normalizeStatus(
    source?.paymentCalculationMethod
      || source?.configuration?.paymentCalculationMethod
      || source?.feeConfiguration?.paymentCalculationMethod
      || source?.fee?.calculationMethod,
  )

  const fixedFee = firstDefinedNumber(
    source?.fixedFee,
    source?.configuration?.fixedFee,
    source?.feeConfiguration?.fixedFee,
    source?.feePreview?.fixedFee,
    source?.fee?.fixedFee,
  )

  const payableAmount = firstDefinedNumber(
    source?.fee?.amountDue,
    source?.fee?.payableAmount,
    source?.fee?.calculatedAmount,
    source?.feePreview?.totalAmount,
  )

  if (method === 'fixed' || method === 'program_fee') {
    return (fixedFee ?? payableAmount ?? 0) <= 0 ? 'free' : 'fixed'
  }

  if (method === 'subject_fee') {
    return (payableAmount ?? source?.fee?.subjectFeeTotal ?? source?.feePreview?.subjectFeeTotal ?? 0) <= 0 ? 'free' : 'subject_fee'
  }

  if (method === 'component_fee') {
    return (payableAmount ?? source?.fee?.componentFeeTotal ?? source?.feePreview?.componentFeeTotal ?? 0) <= 0 ? 'free' : 'component_fee'
  }

  if ((payableAmount ?? fixedFee ?? null) === 0) return 'free'
  return 'unknown'
}

export function shouldShowLearnerExamSubjectFee(source = {}) {
  return resolveLearnerExamFeeMode(source) === 'subject_fee'
}

export function shouldShowLearnerExamComponentFee(source = {}) {
  return resolveLearnerExamFeeMode(source) === 'component_fee'
}

export function getLearnerExamFeeModeDescription(source = {}) {
  const mode = resolveLearnerExamFeeMode(source)
  if (mode === 'fixed') return 'Lệ phí được tính cố định theo đợt thi.'
  if (mode === 'subject_fee') return 'Lệ phí được tính theo các môn thi bạn đăng ký.'
  if (mode === 'component_fee') return 'Lệ phí được tính theo các kỹ năng/phần thi bạn đăng ký.'
  if (mode === 'free') return 'Đợt thi này không yêu cầu nộp lệ phí.'
  return 'Lệ phí được áp dụng theo cấu hình của đợt thi.'
}

export function buildLearnerExamFeeSummary(source = {}) {
  const mode = resolveLearnerExamFeeMode(source)
  const currency = String(source?.fee?.currency || source?.feeConfiguration?.currency || source?.feePreview?.currency || 'VND').trim() || 'VND'
  const fixedFee = firstDefinedNumber(source?.fee?.fixedFee, source?.feePreview?.fixedFee, source?.feeConfiguration?.fixedFee, source?.configuration?.fixedFee, source?.fixedFee)
  const subjectFeeTotal = firstDefinedNumber(source?.fee?.subjectFeeTotal, source?.feePreview?.subjectFeeTotal) ?? 0
  const componentFeeTotal = firstDefinedNumber(source?.fee?.componentFeeTotal, source?.feePreview?.componentFeeTotal) ?? 0
  const totalAmount = firstDefinedNumber(source?.fee?.amountDue, source?.fee?.payableAmount, source?.fee?.calculatedAmount, source?.feePreview?.totalAmount, fixedFee)

  if (mode === 'free') {
    return {
      mode,
      currency,
      totalAmount: 0,
      rows: [{ key: 'fee', label: 'Lệ phí', amount: 0, variant: 'free' }],
    }
  }

  if (mode === 'fixed') {
    return {
      mode,
      currency,
      totalAmount: totalAmount ?? 0,
      rows: [{ key: 'fee', label: 'Lệ phí', amount: totalAmount ?? 0, variant: 'total' }],
    }
  }

  if (mode === 'subject_fee') {
    return {
      mode,
      currency,
      totalAmount: totalAmount ?? subjectFeeTotal,
      rows: [
        { key: 'subjectFeeTotal', label: 'Tổng phí theo môn', amount: subjectFeeTotal, variant: 'detail' },
        { key: 'amountDue', label: 'Số tiền phải nộp', amount: totalAmount ?? subjectFeeTotal, variant: 'total' },
      ],
    }
  }

  if (mode === 'component_fee') {
    return {
      mode,
      currency,
      totalAmount: totalAmount ?? componentFeeTotal,
      rows: [
        { key: 'componentFeeTotal', label: 'Tổng phí theo kỹ năng', amount: componentFeeTotal, variant: 'detail' },
        { key: 'amountDue', label: 'Số tiền phải nộp', amount: totalAmount ?? componentFeeTotal, variant: 'total' },
      ],
    }
  }

  return {
    mode,
    currency,
    totalAmount: totalAmount,
    rows: [{ key: 'amountDue', label: 'Số tiền phải nộp', amount: totalAmount ?? 0, variant: 'total' }],
  }
}