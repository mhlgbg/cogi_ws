import { useEffect, useRef, useState } from 'react'
import { CButton, CCard, CCardBody, CFormCheck, CFormInput, CFormLabel, CFormSelect, CFormTextarea } from '@coreui/react'
import AssessmentProgress from './AssessmentProgress'
import AssessmentCampaignFieldRenderer from './AssessmentCampaignFieldRenderer'
import { buildInitialBeforeStartValues, getBeforeStartFields, normalizeAssessmentCampaignFieldInput, validateAssessmentCampaignFieldInput } from '../utils/assessmentCampaignFlow'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getFieldKey(field) {
  return String(field?.key || '').trim()
}

function isEmptyValue(field, value) {
  if (field?.fieldType === 'checkbox') return !Array.isArray(value) || value.length === 0
  return toText(value) === ''
}

export default function AssessmentCampaignStartForm({ campaign, brandName = 'Tenant', initialValues = null, onValidSubmit, submitting = false, submitError = '', fieldErrors = {}, resumeAvailable = false, onResume }) {
  const fields = getBeforeStartFields(campaign)
  const [form, setForm] = useState(() => ({ ...buildInitialBeforeStartValues(campaign), ...(initialValues || {}) }))
  const [errors, setErrors] = useState({})
  const fieldRefs = useRef({})

  useEffect(() => {
    setForm({ ...buildInitialBeforeStartValues(campaign), ...(initialValues || {}) })
    setErrors({})
  }, [campaign, initialValues])

  function registerFieldRef(key, node) {
    if (!node) return
    fieldRefs.current[key] = node
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  useEffect(() => {
    setErrors(fieldErrors || {})
  }, [fieldErrors])

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
      const key = getFieldKey(field)
      const normalizedValue = normalizeAssessmentCampaignFieldInput(field, form[key])
      const message = validateAssessmentCampaignFieldInput(field, normalizedValue)
      if (message) nextErrors[key] = message
      normalizedValues[key] = normalizedValue
    }
    if (form.__consent !== true) nextErrors.__consent = 'Vui lòng xác nhận đồng ý trước khi tiếp tục.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors)
      return
    }
    onValidSubmit?.(normalizedValues)
  }

  return (
    <CCard className='assessment-form-card assessment-card'>
      <CCardBody className='p-4 p-md-5'>
        <AssessmentProgress currentStep={1} totalSteps={6} label='Thông tin ban đầu' />
        <div className='assessment-section-title'>{campaign?.publicTitle || 'Thông tin để bắt đầu bài đánh giá'}</div>
        <p className='assessment-section-lead mb-4'>{campaign?.publicDescription || 'Vui lòng nhập thông tin ban đầu để hệ thống phân bài đánh giá phù hợp.'}</p>
        {submitError ? <div className='alert alert-danger'>{submitError}</div> : null}
        {fields.length === 0 ? <div className='alert alert-warning'>Chiến dịch chưa được cấu hình đầy đủ. Vui lòng liên hệ VitaminFun.</div> : null}
        <form onSubmit={handleSubmit} noValidate>
          <div className='assessment-form-grid assessment-form-grid--single assessment-form-grid--compact'>
            {fields.map((field) => {
              const key = getFieldKey(field)
              return (
                <div key={key} className='assessment-form-field'>
                  <CFormLabel className='assessment-form-label'>{field.label}{field.required ? ' *' : ''}</CFormLabel>
                  <AssessmentCampaignFieldRenderer field={field} value={form[key]} onChange={updateField} registerFieldRef={registerFieldRef} />
                  {field.helpText ? <div className='assessment-form-label-helper'>{field.helpText}</div> : null}
                  {errors[key] ? <div className='assessment-form-error'>{errors[key]}</div> : null}
                </div>
              )
            })}
          </div>
          <section className='assessment-form-section'>
            <div className='assessment-consent-box'>
              <CFormCheck id='assessment-campaign-consent' checked={form.__consent === true} onChange={(event) => updateField('__consent', event.target.checked)} label={`Tôi đồng ý để ${brandName} sử dụng thông tin và bài làm để phục vụ việc đánh giá và tư vấn lộ trình phù hợp.`} />
              {errors.__consent ? <div className='assessment-form-error'>{errors.__consent}</div> : null}
            </div>
          </section>
          <div className='assessment-form-actions d-flex flex-wrap gap-2'>
            <CButton type='submit' color='primary' className='assessment-primary-cta' disabled={submitting}>{submitting ? 'Đang chuẩn bị bài kiểm tra...' : 'NHẬN MÃ & LÀM BÀI'}</CButton>
            {resumeAvailable && onResume ? <CButton type='button' color='secondary' variant='outline' className='assessment-primary-cta' onClick={onResume}>TIẾP TỤC BÀI KIỂM TRA</CButton> : null}
          </div>
        </form>
      </CCardBody>
    </CCard>
  )
}
