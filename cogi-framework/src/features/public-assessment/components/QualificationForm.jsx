import { useMemo, useRef, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
} from '@coreui/react'
import { useEffect } from 'react'
import AssessmentProgress from './AssessmentProgress'
import {
  availableDayOptions,
  availableTimeOptions,
  currentEnglishStudyOptions,
  districtOptionsByProvince,
  goalOptions,
  gradeOptions,
  provinceOptions,
  startIntentOptions,
  studyModeOptions,
} from '../mock/assessmentCampaignMock'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function buildInitialQualificationForm() {
  return {
    parent: {
      name: '',
      phone: '',
      email: '',
      province: '',
      district: '',
    },
    student: {
      name: '',
      dob: '',
      grade: '',
      school: '',
      email: '',
    },
    qualification: {
      currentEnglishStudy: '',
      goals: [],
      studyMode: '',
      availableDays: [],
      availableTimes: [],
      startIntent: '',
    },
    consent: false,
  }
}

function cloneFormValues(value) {
  return JSON.parse(JSON.stringify(value || buildInitialQualificationForm()))
}

function buildFieldKey(section, field) {
  return `${section}.${field}`
}

function SelectableOption({ type = 'radio', name, checked = false, disabled = false, label, onChange }) {
  return (
    <label className='assessment-selectable'>
      <input className='assessment-selectable-input' type={type} name={name} checked={checked} disabled={disabled} onChange={onChange} />
      <div className={`assessment-selectable-card${checked ? ' active' : ''}${disabled ? ' disabled' : ''}`}>
        <div className='assessment-selectable-title'>{label}</div>
      </div>
    </label>
  )
}

export default function QualificationForm({ campaign, brandName = 'Vitaminfun', initialValues = null, onValidSubmit }) {
  const [form, setForm] = useState(() => cloneFormValues(initialValues || buildInitialQualificationForm()))
  const [errors, setErrors] = useState({})
  const fieldRefs = useRef({})

  useEffect(() => {
    setForm(cloneFormValues(initialValues || buildInitialQualificationForm()))
    setErrors({})
  }, [initialValues])

  const availableDistrictOptions = useMemo(() => districtOptionsByProvince[form.parent.province] || ['Khác'], [form.parent.province])

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

  function toggleArrayValue(section, field, value, limit = null) {
    setForm((current) => {
      const currentValues = Array.isArray(current?.[section]?.[field]) ? current[section][field] : []
      const exists = currentValues.includes(value)
      if (exists) {
        return {
          ...current,
          [section]: {
            ...current[section],
            [field]: currentValues.filter((item) => item !== value),
          },
        }
      }
      if (limit && currentValues.length >= limit) {
        return current
      }
      return {
        ...current,
        [section]: {
          ...current[section],
          [field]: [...currentValues, value],
        },
      }
    })
    setErrors((current) => ({ ...current, [buildFieldKey(section, field)]: '' }))
  }

  function validate() {
    const nextErrors = {}
    if (!toText(form.parent.name)) nextErrors['parent.name'] = 'Vui lòng nhập tên phụ huynh.'
    const phone = toText(form.parent.phone)
    if (!phone) nextErrors['parent.phone'] = 'Vui lòng nhập số điện thoại / Zalo.'
    else if (!/^[0-9+\s().-]{8,20}$/.test(phone)) nextErrors['parent.phone'] = 'Số điện thoại chưa đúng định dạng.'
    const parentEmail = toText(form.parent.email).toLowerCase()
    if (!parentEmail) nextErrors['parent.email'] = 'Vui lòng nhập email phụ huynh.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) nextErrors['parent.email'] = 'Email chưa đúng định dạng.'
    if (!toText(form.parent.province)) nextErrors['parent.province'] = 'Vui lòng chọn tỉnh / thành phố.'
    if (!toText(form.parent.district)) nextErrors['parent.district'] = 'Vui lòng nhập quận / huyện / khu vực.'

    if (!toText(form.student.name)) nextErrors['student.name'] = 'Vui lòng nhập họ tên học sinh.'
    if (!toText(form.student.dob)) nextErrors['student.dob'] = 'Vui lòng chọn ngày sinh.'
    if (!toText(form.student.grade)) nextErrors['student.grade'] = 'Vui lòng chọn lớp hiện tại.'
    if (!toText(form.student.school)) nextErrors['student.school'] = 'Vui lòng nhập trường đang học.'
    const studentEmail = toText(form.student.email).toLowerCase()
    if (studentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) nextErrors['student.email'] = 'Email chưa đúng định dạng.'

    if (!toText(form.qualification.currentEnglishStudy)) nextErrors['qualification.currentEnglishStudy'] = 'Vui lòng chọn tình trạng học tiếng Anh hiện tại.'
    if (!Array.isArray(form.qualification.goals) || form.qualification.goals.length === 0) nextErrors['qualification.goals'] = 'Vui lòng chọn mục tiêu học.'
    else if (form.qualification.goals.length > 2) nextErrors['qualification.goals'] = 'Bạn có thể chọn tối đa 2 mục tiêu.'
    if (!toText(form.qualification.studyMode)) nextErrors['qualification.studyMode'] = 'Vui lòng chọn hình thức học mong muốn.'
    if (!Array.isArray(form.qualification.availableDays) || form.qualification.availableDays.length === 0) nextErrors['qualification.availableDays'] = 'Vui lòng chọn ngày có thể học.'
    if (!Array.isArray(form.qualification.availableTimes) || form.qualification.availableTimes.length === 0) nextErrors['qualification.availableTimes'] = 'Vui lòng chọn khung giờ có thể học.'
    if (!toText(form.qualification.startIntent)) nextErrors['qualification.startIntent'] = 'Vui lòng chọn thời điểm muốn bắt đầu.'
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

    onValidSubmit?.(cloneFormValues(form))
  }

  return (
    <CCard className='assessment-form-card assessment-card'>
      <CCardBody className='p-4 p-md-5'>
        <AssessmentProgress currentStep={1} totalSteps={5} label={campaign?.registerIntro?.stepTitle || 'Thông tin ban đầu'} />
        <div className='assessment-section-title'>{campaign?.registerIntro?.title || 'Thông tin trước khi làm bài'}</div>
        <p className='assessment-section-lead mb-4'>{campaign?.registerIntro?.description || 'Vui lòng cung cấp một số thông tin để lựa chọn bài đánh giá phù hợp.'}</p>

        <form onSubmit={handleSubmit} noValidate>
          <section className='assessment-form-section'>
            <div className='assessment-form-section-title'>Thông tin phụ huynh</div>
            <div className='assessment-form-grid'>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-parent-name'>Họ và tên phụ huynh</CFormLabel>
                <CFormInput id='assessment-parent-name' value={form.parent.name} invalid={Boolean(errors['parent.name'])} onChange={(event) => updateField('parent', 'name', event.target.value)} ref={(node) => registerFieldRef('parent.name', node)} />
                {errors['parent.name'] ? <div className='assessment-form-error'>{errors['parent.name']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-parent-phone'>Số điện thoại / Zalo</CFormLabel>
                <CFormInput id='assessment-parent-phone' value={form.parent.phone} invalid={Boolean(errors['parent.phone'])} onChange={(event) => updateField('parent', 'phone', event.target.value)} ref={(node) => registerFieldRef('parent.phone', node)} />
                {errors['parent.phone'] ? <div className='assessment-form-error'>{errors['parent.phone']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-parent-email'>Email phụ huynh</CFormLabel>
                <CFormInput id='assessment-parent-email' type='email' value={form.parent.email} invalid={Boolean(errors['parent.email'])} onChange={(event) => updateField('parent', 'email', event.target.value)} ref={(node) => registerFieldRef('parent.email', node)} />
                <div className='assessment-form-label-helper'>Mã xác thực sẽ được gửi đến email này.</div>
                {errors['parent.email'] ? <div className='assessment-form-error'>{errors['parent.email']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-parent-province'>Tỉnh / Thành phố</CFormLabel>
                <CFormSelect id='assessment-parent-province' value={form.parent.province} invalid={Boolean(errors['parent.province'])} onChange={(event) => { updateField('parent', 'province', event.target.value); updateField('parent', 'district', '') }} ref={(node) => registerFieldRef('parent.province', node)}>
                  <option value=''>Chọn tỉnh / thành phố</option>
                  {provinceOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </CFormSelect>
                {errors['parent.province'] ? <div className='assessment-form-error'>{errors['parent.province']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-parent-district'>Quận / Huyện / Khu vực</CFormLabel>
                <CFormSelect id='assessment-parent-district' value={form.parent.district} invalid={Boolean(errors['parent.district'])} onChange={(event) => updateField('parent', 'district', event.target.value)} ref={(node) => registerFieldRef('parent.district', node)}>
                  <option value=''>Chọn khu vực</option>
                  {availableDistrictOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </CFormSelect>
                {errors['parent.district'] ? <div className='assessment-form-error'>{errors['parent.district']}</div> : null}
              </div>
            </div>
          </section>

          <section className='assessment-form-section'>
            <div className='assessment-form-section-title'>Thông tin học sinh</div>
            <div className='assessment-form-grid'>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-student-name'>Họ tên học sinh</CFormLabel>
                <CFormInput id='assessment-student-name' value={form.student.name} invalid={Boolean(errors['student.name'])} onChange={(event) => updateField('student', 'name', event.target.value)} ref={(node) => registerFieldRef('student.name', node)} />
                {errors['student.name'] ? <div className='assessment-form-error'>{errors['student.name']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-student-dob'>Ngày sinh</CFormLabel>
                <CFormInput id='assessment-student-dob' type='date' value={form.student.dob} invalid={Boolean(errors['student.dob'])} onChange={(event) => updateField('student', 'dob', event.target.value)} ref={(node) => registerFieldRef('student.dob', node)} />
                {errors['student.dob'] ? <div className='assessment-form-error'>{errors['student.dob']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-student-grade'>Lớp hiện tại</CFormLabel>
                <CFormSelect id='assessment-student-grade' value={form.student.grade} invalid={Boolean(errors['student.grade'])} onChange={(event) => updateField('student', 'grade', event.target.value)} ref={(node) => registerFieldRef('student.grade', node)}>
                  <option value=''>Chọn lớp hiện tại</option>
                  {gradeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </CFormSelect>
                {errors['student.grade'] ? <div className='assessment-form-error'>{errors['student.grade']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-student-school'>Trường đang học</CFormLabel>
                <CFormInput id='assessment-student-school' value={form.student.school} invalid={Boolean(errors['student.school'])} onChange={(event) => updateField('student', 'school', event.target.value)} ref={(node) => registerFieldRef('student.school', node)} />
                {errors['student.school'] ? <div className='assessment-form-error'>{errors['student.school']}</div> : null}
              </div>
              <div className='assessment-form-field assessment-form-field--full'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-student-email'>Email học sinh</CFormLabel>
                <CFormInput id='assessment-student-email' type='email' value={form.student.email} invalid={Boolean(errors['student.email'])} onChange={(event) => updateField('student', 'email', event.target.value)} ref={(node) => registerFieldRef('student.email', node)} />
                <div className='assessment-form-label-helper'>Không bắt buộc.</div>
                {errors['student.email'] ? <div className='assessment-form-error'>{errors['student.email']}</div> : null}
              </div>
            </div>
          </section>

          <section className='assessment-form-section'>
            <div className='assessment-form-section-title'>Nhu cầu học tập</div>
            <div className='assessment-form-grid assessment-form-grid--single'>
              <div className='assessment-form-field'>
                <div className='assessment-form-label'>Hiện đang học tiếng Anh ở đâu?</div>
                <div className='assessment-option-grid assessment-option-grid--cards-2' ref={(node) => registerFieldRef('qualification.currentEnglishStudy', node)}>
                  {currentEnglishStudyOptions.map((option) => (
                    <SelectableOption key={option.value} type='radio' name='currentEnglishStudy' label={option.label} checked={form.qualification.currentEnglishStudy === option.value} onChange={() => updateField('qualification', 'currentEnglishStudy', option.value)} />
                  ))}
                </div>
                {errors['qualification.currentEnglishStudy'] ? <div className='assessment-form-error'>{errors['qualification.currentEnglishStudy']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <div className='assessment-form-label'>Mục tiêu học</div>
                <div className='assessment-option-grid assessment-option-grid--cards-3' ref={(node) => registerFieldRef('qualification.goals', node)}>
                  {goalOptions.map((option) => {
                    const selected = form.qualification.goals.includes(option.value)
                    const reachedLimit = !selected && form.qualification.goals.length >= 2
                    return <SelectableOption key={option.value} type='checkbox' name={`goal-${option.value}`} label={option.label} checked={selected} disabled={reachedLimit} onChange={() => toggleArrayValue('qualification', 'goals', option.value, 2)} />
                  })}
                </div>
                <div className='assessment-form-label-helper'>Bạn có thể chọn tối đa 2 mục tiêu.</div>
                {errors['qualification.goals'] ? <div className='assessment-form-error'>{errors['qualification.goals']}</div> : null}
              </div>
            </div>
          </section>

          <section className='assessment-form-section'>
            <div className='assessment-form-section-title'>Hình thức và thời gian học</div>
            <div className='assessment-form-grid assessment-form-grid--single'>
              <div className='assessment-form-field'>
                <div className='assessment-form-label'>Hình thức học mong muốn</div>
                <div className='assessment-option-grid assessment-option-grid--cards-2' ref={(node) => registerFieldRef('qualification.studyMode', node)}>
                  {studyModeOptions.map((option) => (
                    <SelectableOption key={option.value} type='radio' name='studyMode' label={option.label} checked={form.qualification.studyMode === option.value} onChange={() => updateField('qualification', 'studyMode', option.value)} />
                  ))}
                </div>
                {errors['qualification.studyMode'] ? <div className='assessment-form-error'>{errors['qualification.studyMode']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <div className='assessment-form-label'>Ngày có thể học</div>
                <div className='assessment-option-grid assessment-option-grid--cards-3' ref={(node) => registerFieldRef('qualification.availableDays', node)}>
                  {availableDayOptions.map((option) => <SelectableOption key={option.value} type='checkbox' name={`day-${option.value}`} label={option.label} checked={form.qualification.availableDays.includes(option.value)} onChange={() => toggleArrayValue('qualification', 'availableDays', option.value)} />)}
                </div>
                {errors['qualification.availableDays'] ? <div className='assessment-form-error'>{errors['qualification.availableDays']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <div className='assessment-form-label'>Khung giờ có thể học</div>
                <div className='assessment-option-grid assessment-option-grid--cards-3' ref={(node) => registerFieldRef('qualification.availableTimes', node)}>
                  {availableTimeOptions.map((option) => <SelectableOption key={option.value} type='checkbox' name={`time-${option.value}`} label={option.label} checked={form.qualification.availableTimes.includes(option.value)} onChange={() => toggleArrayValue('qualification', 'availableTimes', option.value)} />)}
                </div>
                {errors['qualification.availableTimes'] ? <div className='assessment-form-error'>{errors['qualification.availableTimes']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <div className='assessment-form-label'>Khi nào muốn bắt đầu?</div>
                <div className='assessment-option-grid assessment-option-grid--cards-2' ref={(node) => registerFieldRef('qualification.startIntent', node)}>
                  {startIntentOptions.map((option) => (
                    <SelectableOption key={option.value} type='radio' name='startIntent' label={option.label} checked={form.qualification.startIntent === option.value} onChange={() => updateField('qualification', 'startIntent', option.value)} />
                  ))}
                </div>
                {errors['qualification.startIntent'] ? <div className='assessment-form-error'>{errors['qualification.startIntent']}</div> : null}
              </div>
            </div>
          </section>

          <section className='assessment-form-section'>
            <div className='assessment-form-section-title'>Xác nhận thông tin</div>
            <div className='assessment-consent-box' ref={(node) => registerFieldRef('consent', node)}>
              <CFormCheck id='assessment-consent' checked={form.consent} onChange={(event) => updateConsent(event.target.checked)} label={`Tôi xác nhận các thông tin trên là đúng và đồng ý để ${brandName} sử dụng thông tin, bài làm và kết quả đánh giá để tư vấn lộ trình học phù hợp cho học sinh.`} />
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
