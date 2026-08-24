import { useEffect, useRef, useState } from 'react'
import { CButton, CCard, CCardBody, CFormCheck, CFormInput, CFormLabel, CFormSelect } from '@coreui/react'
import AssessmentProgress from './AssessmentProgress'
import { buildInitialQualificationForm, cloneQualificationFormValues } from './QualificationForm'
import { gradeOptions } from '../mock/assessmentCampaignMock'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function buildQuickValues(source) {
  const base = cloneQualificationFormValues(source || buildInitialQualificationForm())
  return {
    parent: {
      ...base.parent,
      name: '',
      province: '',
      district: '',
    },
    student: {
      ...base.student,
      dob: '',
      school: '',
      email: '',
    },
    qualification: {
      ...base.qualification,
      currentEnglishStudy: '',
      goals: [],
      studyMode: '',
      availableDays: [],
      availableTimes: [],
      startIntent: '',
    },
  }
}

function mergeWithInitial(initialValues, currentValues) {
  const base = cloneQualificationFormValues(initialValues || buildInitialQualificationForm())
  const quick = buildQuickValues(currentValues || initialValues)
  return {
    ...base,
    ...quick,
    parent: {
      ...base.parent,
      phone: quick.parent.phone,
      email: quick.parent.email,
    },
    student: {
      ...base.student,
      name: quick.student.name,
      grade: quick.student.grade,
    },
    consent: quick.consent,
  }
}

function buildFieldKey(section, field) {
  return `${section}.${field}`
}

export default function QuickRegistrationForm({ campaign, brandName = 'Vitaminfun', initialValues = null, onValidSubmit }) {
  const [form, setForm] = useState(() => mergeWithInitial(initialValues || buildInitialQualificationForm(), initialValues || buildInitialQualificationForm()))
  const [errors, setErrors] = useState({})
  const fieldRefs = useRef({})

  useEffect(() => {
    setForm(mergeWithInitial(initialValues || buildInitialQualificationForm(), initialValues || buildInitialQualificationForm()))
    setErrors({})
  }, [initialValues])

  function registerFieldRef(key, node) {
    if (!node) return
    fieldRefs.current[key] = node
  }

  function updateField(section, field, value) {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }))
    setErrors((current) => ({ ...current, [buildFieldKey(section, field)]: '' }))
  }

  function updateConsent(value) {
    setForm((current) => ({ ...current, consent: value }))
    setErrors((current) => ({ ...current, consent: '' }))
  }

  function validate() {
    const nextErrors = {}
    if (!toText(form.student.name)) nextErrors['student.name'] = 'Vui lòng nhập họ tên học sinh.'
    if (!toText(form.student.grade)) nextErrors['student.grade'] = 'Vui lòng chọn lớp hiện tại.'

    const parentEmail = toText(form.parent.email).toLowerCase()
    if (!parentEmail) nextErrors['parent.email'] = 'Vui lòng nhập email phụ huynh.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) nextErrors['parent.email'] = 'Email chưa đúng định dạng.'

    const phone = toText(form.parent.phone)
    if (!phone) nextErrors['parent.phone'] = 'Vui lòng nhập số điện thoại / Zalo.'
    else if (!/^[0-9+\s().-]{8,20}$/.test(phone)) nextErrors['parent.phone'] = 'Số điện thoại chưa đúng định dạng.'

    if (form.consent !== true) nextErrors.consent = 'Vui lòng xác nhận đồng ý trước khi tiếp tục.'
    return nextErrors
  }

  function focusFirstError(nextErrors) {
    const firstKey = Object.keys(nextErrors)[0]
    const node = fieldRefs.current[firstKey]
    if (node?.focus) node.focus()
    if (node?.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors)
      return
    }

    onValidSubmit?.(cloneQualificationFormValues(form))
  }

  return (
    <CCard className='assessment-form-card assessment-card'>
      <CCardBody className='p-4 p-md-5'>
        <AssessmentProgress currentStep={1} totalSteps={6} label='Thông tin ban đầu' />
        <div className='assessment-section-title'>{campaign?.registerIntro?.title || 'Thông tin để bắt đầu bài đánh giá'}</div>
        <p className='assessment-section-lead mb-4'>{campaign?.registerIntro?.description || 'Bạn chỉ cần một vài thông tin cơ bản để bắt đầu. Sau khi hoàn thành bài đánh giá, chúng tôi sẽ hỏi thêm một số thông tin để tư vấn kết quả phù hợp hơn.'}</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className='assessment-form-grid assessment-form-grid--single assessment-form-grid--compact'>
            <div className='assessment-form-field'>
              <CFormLabel className='assessment-form-label' htmlFor='assessment-quick-student-name'>Họ và tên học sinh</CFormLabel>
              <CFormInput id='assessment-quick-student-name' value={form.student.name} invalid={Boolean(errors['student.name'])} onChange={(event) => updateField('student', 'name', event.target.value)} ref={(node) => registerFieldRef('student.name', node)} />
              {errors['student.name'] ? <div className='assessment-form-error'>{errors['student.name']}</div> : null}
            </div>

            <div className='assessment-form-field'>
              <CFormLabel className='assessment-form-label' htmlFor='assessment-quick-student-grade'>Lớp hiện tại</CFormLabel>
              <CFormSelect id='assessment-quick-student-grade' value={form.student.grade} invalid={Boolean(errors['student.grade'])} onChange={(event) => updateField('student', 'grade', event.target.value)} ref={(node) => registerFieldRef('student.grade', node)}>
                <option value=''>Chọn lớp hiện tại</option>
                {gradeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </CFormSelect>
              {errors['student.grade'] ? <div className='assessment-form-error'>{errors['student.grade']}</div> : null}
            </div>

            <div className='assessment-form-field'>
              <CFormLabel className='assessment-form-label' htmlFor='assessment-quick-parent-email'>Email phụ huynh</CFormLabel>
              <CFormInput id='assessment-quick-parent-email' type='email' value={form.parent.email} invalid={Boolean(errors['parent.email'])} onChange={(event) => updateField('parent', 'email', event.target.value)} ref={(node) => registerFieldRef('parent.email', node)} />
              <div className='assessment-form-label-helper'>Mã xác thực sẽ được gửi đến email này.</div>
              {errors['parent.email'] ? <div className='assessment-form-error'>{errors['parent.email']}</div> : null}
            </div>

            <div className='assessment-form-field'>
              <CFormLabel className='assessment-form-label' htmlFor='assessment-quick-parent-phone'>Số điện thoại / Zalo</CFormLabel>
              <CFormInput id='assessment-quick-parent-phone' value={form.parent.phone} invalid={Boolean(errors['parent.phone'])} onChange={(event) => updateField('parent', 'phone', event.target.value)} ref={(node) => registerFieldRef('parent.phone', node)} />
              {errors['parent.phone'] ? <div className='assessment-form-error'>{errors['parent.phone']}</div> : null}
            </div>
          </div>

          <section className='assessment-form-section'>
            <div className='assessment-consent-box' ref={(node) => registerFieldRef('consent', node)}>
              <CFormCheck id='assessment-quick-consent' checked={form.consent} onChange={(event) => updateConsent(event.target.checked)} label={`Tôi xác nhận các thông tin trên là đúng và đồng ý để ${brandName} sử dụng thông tin, bài làm và kết quả đánh giá để phục vụ việc đánh giá và tư vấn lộ trình học phù hợp.`} />
              {errors.consent ? <div className='assessment-form-error'>{errors.consent}</div> : null}
            </div>
          </section>

          <div className='assessment-form-actions'>
            <CButton type='submit' color='primary' className='assessment-primary-cta'>NHẬN MÃ & LÀM BÀI</CButton>
          </div>
        </form>
      </CCardBody>
    </CCard>
  )
}