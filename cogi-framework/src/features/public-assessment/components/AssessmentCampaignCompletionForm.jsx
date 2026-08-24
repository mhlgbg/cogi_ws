import { useEffect, useRef, useState } from 'react'
import { CBadge, CButton, CCard, CCardBody, CFormLabel } from '@coreui/react'
import AssessmentCampaignFieldRenderer from './AssessmentCampaignFieldRenderer'
import { normalizeAssessmentCampaignFieldInput, validateAssessmentCampaignFieldInput } from '../utils/assessmentCampaignFlow'

function isFullWidthField(field) {
  const type = String(field?.fieldType || '').trim().toLowerCase()
  return ['textarea', 'radio', 'checkbox'].includes(type)
}

export default function AssessmentCampaignCompletionForm({ fields = [], initialValues = {}, submitting = false, submitLabel = 'Hoàn tất và xem kết quả', submitError = '', fieldErrors = {}, onSubmit }) {
  const [form, setForm] = useState(initialValues || {})
  const [errors, setErrors] = useState({})
  const fieldRefs = useRef({})

  useEffect(() => {
    setForm(initialValues || {})
    setErrors(fieldErrors || {})
  }, [initialValues])

  useEffect(() => {
    setErrors(fieldErrors || {})
  }, [fieldErrors])

  function registerFieldRef(key, node) {
    if (!node) return
    fieldRefs.current[key] = node
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function focusFirstError(nextErrors) {
    const firstKey = Object.keys(nextErrors)[0]
    const node = fieldRefs.current[firstKey]
    if (node?.focus) node.focus()
    if (node?.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    const normalizedValues = {}
    for (const field of fields) {
      const normalizedValue = normalizeAssessmentCampaignFieldInput(field, form[field.key])
      const message = validateAssessmentCampaignFieldInput(field, normalizedValue)
      if (message) nextErrors[field.key] = message
      normalizedValues[field.key] = normalizedValue
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors)
      return
    }
    onSubmit?.(normalizedValues)
  }

  return (
    <div className='assessment-result-completion-shell'>
      <CCard className='assessment-form-card assessment-result-completion-card'>
        <CCardBody className='assessment-result-completion-card__body'>
          <div className='assessment-result-completion-card__header'>
            <CBadge color='primary' className='assessment-result-completion-card__badge'>Bước cuối</CBadge>
            <div className='assessment-section-title mb-2'>Hoàn tất thông tin để xem kết quả</div>
            <p className='assessment-section-lead mb-0'>Bạn đã hoàn thành bài kiểm tra. Vui lòng bổ sung một số thông tin để VitaminFun gửi kết quả và tư vấn lộ trình học phù hợp.</p>
          </div>
        {submitError ? <div className='alert alert-danger'>{submitError}</div> : null}
        <form onSubmit={handleSubmit} noValidate>
          <div className='assessment-form-grid assessment-result-completion-grid'>
            {fields.map((field) => (
              <div key={field.key} className={`assessment-form-field ${isFullWidthField(field) ? 'assessment-form-field--full' : ''}`}>
                <CFormLabel className='assessment-form-label'>{field.label}{field.required ? ' *' : ''}</CFormLabel>
                <AssessmentCampaignFieldRenderer field={field} value={form[field.key]} onChange={updateField} registerFieldRef={registerFieldRef} variant='result-completion' error={errors[field.key]} />
                {field.helpText ? <div className='assessment-form-label-helper'>{field.helpText}</div> : null}
                {errors[field.key] ? <div className='assessment-form-error'>{errors[field.key]}</div> : null}
              </div>
            ))}
          </div>
          <div className='assessment-result-completion-footer'>
            <div className='assessment-result-completion-footer__hint'>Sau khi hoàn tất, bạn sẽ xem được kết quả đánh giá.</div>
            <div className='assessment-result-completion-footer__actions'>
              <CButton type='submit' color='primary' className='assessment-primary-cta assessment-result-completion-footer__button' disabled={submitting}>{submitting ? 'Đang lưu...' : submitLabel}</CButton>
            </div>
          </div>
        </form>
        </CCardBody>
      </CCard>
    </div>
  )
}