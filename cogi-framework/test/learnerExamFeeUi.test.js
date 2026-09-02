import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLearnerExamFeeSummary,
  resolveLearnerExamFeeMode,
  shouldShowLearnerExamComponentFee,
  shouldShowLearnerExamSubjectFee,
} from '../src/modules/exam-management/utils/learnerExamFeeUi.js'

test('fixed and program fee modes only show flat fee', () => {
  const source = {
    paymentCalculationMethod: 'fixed',
    feeConfiguration: { fixedFee: 11000, currency: 'VND' },
    feePreview: { fixedFee: 11000, totalAmount: 11000, subjectFeeTotal: 5000, componentFeeTotal: 3000, currency: 'VND' },
  }

  assert.equal(resolveLearnerExamFeeMode(source), 'fixed')
  assert.equal(shouldShowLearnerExamSubjectFee(source), false)
  assert.equal(shouldShowLearnerExamComponentFee(source), false)
  assert.deepEqual(buildLearnerExamFeeSummary(source).rows, [
    { key: 'fee', label: 'Lệ phí', amount: 11000, variant: 'total' },
  ])
})

test('subject fee mode only shows subject fee breakdown', () => {
  const source = {
    paymentCalculationMethod: 'subject_fee',
    feePreview: { totalAmount: 22000, subjectFeeTotal: 22000, componentFeeTotal: 9000, currency: 'VND' },
  }

  assert.equal(resolveLearnerExamFeeMode(source), 'subject_fee')
  assert.equal(shouldShowLearnerExamSubjectFee(source), true)
  assert.equal(shouldShowLearnerExamComponentFee(source), false)
  assert.deepEqual(buildLearnerExamFeeSummary(source).rows, [
    { key: 'subjectFeeTotal', label: 'Tổng phí theo môn', amount: 22000, variant: 'detail' },
    { key: 'amountDue', label: 'Số tiền phải nộp', amount: 22000, variant: 'total' },
  ])
})

test('component fee mode only shows component fee breakdown', () => {
  const source = {
    fee: { calculationMethod: 'component_fee', amountDue: 33000, componentFeeTotal: 33000, subjectFeeTotal: 15000, currency: 'VND' },
  }

  assert.equal(resolveLearnerExamFeeMode(source), 'component_fee')
  assert.equal(shouldShowLearnerExamSubjectFee(source), false)
  assert.equal(shouldShowLearnerExamComponentFee(source), true)
  assert.deepEqual(buildLearnerExamFeeSummary(source).rows, [
    { key: 'componentFeeTotal', label: 'Tổng phí theo kỹ năng', amount: 33000, variant: 'detail' },
    { key: 'amountDue', label: 'Số tiền phải nộp', amount: 33000, variant: 'total' },
  ])
})

test('free rounds are presented as miễn phí with no breakdown rows', () => {
  const source = {
    paymentCalculationMethod: 'program_fee',
    feeConfiguration: { fixedFee: 0, currency: 'VND' },
    feePreview: { fixedFee: 0, totalAmount: 0, subjectFeeTotal: 12000, componentFeeTotal: 8000, currency: 'VND' },
  }

  assert.equal(resolveLearnerExamFeeMode(source), 'free')
  assert.equal(shouldShowLearnerExamSubjectFee(source), false)
  assert.equal(shouldShowLearnerExamComponentFee(source), false)
  assert.deepEqual(buildLearnerExamFeeSummary(source).rows, [
    { key: 'fee', label: 'Lệ phí', amount: 0, variant: 'free' },
  ])
})