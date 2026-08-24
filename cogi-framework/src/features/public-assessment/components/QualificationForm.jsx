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

export function cloneQualificationFormValues(value) {
  return JSON.parse(JSON.stringify(value || buildInitialQualificationForm()))
}

function buildFieldKey(section, field) {
  return `${section}.${field}`
}

function SelectableOption({ type = 'radio', name, checked = false, disabled = false, label, onChange, compact = false }) {
  return (
    <label className='assessment-selectable'>
      <input className='assessment-selectable-input' type={type} name={name} checked={checked} disabled={disabled} onChange={onChange} />
      <div className={`assessment-selectable-card${compact ? ' compact' : ''}${checked ? ' active' : ''}${disabled ? ' disabled' : ''}`}>
        <div className='assessment-selectable-title'>{label}</div>
      </div>
    </label>
  )
}

export default function QualificationForm({ campaign, brandName = 'Vitaminfun', initialValues = null, onValidSubmit, onDraftChange = null }) {
  const [form, setForm] = useState(() => cloneQualificationFormValues(initialValues || buildInitialQualificationForm()))
  const [errors, setErrors] = useState({})
  const fieldRefs = useRef({})

  useEffect(() => {
    setForm(cloneQualificationFormValues(initialValues || buildInitialQualificationForm()))
    setErrors({})
  }, [initialValues])

  useEffect(() => {
    onDraftChange?.(cloneQualificationFormValues(form))
  }, [form, onDraftChange])

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
    if (!toText(form.parent.province)) nextErrors['parent.province'] = 'Vui lòng chọn tỉnh / thành phố.'
    if (!toText(form.parent.district)) nextErrors['parent.district'] = 'Vui lòng chọn quận / huyện / khu vực.'

    const studentEmail = toText(form.student.email).toLowerCase()
    if (studentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) nextErrors['student.email'] = 'Email chưa đúng định dạng.'

    if (!toText(form.qualification.currentEnglishStudy)) nextErrors['qualification.currentEnglishStudy'] = 'Vui lòng chọn tình trạng học tiếng Anh hiện tại.'
    if (!Array.isArray(form.qualification.goals) || form.qualification.goals.length === 0) nextErrors['qualification.goals'] = 'Vui lòng chọn mục tiêu học.'
    else if (form.qualification.goals.length > 2) nextErrors['qualification.goals'] = 'Bạn có thể chọn tối đa 2 mục tiêu.'
    if (!toText(form.qualification.studyMode)) nextErrors['qualification.studyMode'] = 'Vui lòng chọn hình thức học mong muốn.'
    if (!toText(form.qualification.startIntent)) nextErrors['qualification.startIntent'] = 'Vui lòng chọn thời điểm muốn bắt đầu.'

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
        <AssessmentProgress currentStep={5} totalSteps={6} label='Bổ sung thông tin' />
        <div className='assessment-section-title'>Bạn đã hoàn thành bài đánh giá</div>
        <p className='assessment-section-lead mb-4'>Hãy bổ sung một vài thông tin để chúng tôi hiển thị kết quả sơ bộ và giúp giáo viên tư vấn phù hợp hơn.</p>

        <div className='assessment-trust-panel mb-4'>
          <div className='assessment-trust-item'>
            <div className='assessment-trust-icon'>✓</div>
            <div className='assessment-domain-copy'>Một số thông tin bên dưới giúp giáo viên đọc kết quả sơ bộ đúng ngữ cảnh hơn trước khi tư vấn bước Speaking.</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <section className='assessment-form-section'>
            <div className='assessment-form-section-title'>Thông tin đã có sẵn</div>
            <div className='assessment-inline-summary-grid'>
              <div className='assessment-inline-summary-item'>
                <div className='assessment-inline-summary-item__label'>Học sinh</div>
                <div className='assessment-inline-summary-item__value'>{form.student.name || '—'}</div>
              </div>
              <div className='assessment-inline-summary-item'>
                <div className='assessment-inline-summary-item__label'>Lớp hiện tại</div>
                <div className='assessment-inline-summary-item__value'>{form.student.grade || '—'}</div>
              </div>
              <div className='assessment-inline-summary-item'>
                <div className='assessment-inline-summary-item__label'>Email phụ huynh</div>
                <div className='assessment-inline-summary-item__value'>{form.parent.email || '—'}</div>
              </div>
              <div className='assessment-inline-summary-item'>
                <div className='assessment-inline-summary-item__label'>Số điện thoại / Zalo</div>
                <div className='assessment-inline-summary-item__value'>{form.parent.phone || '—'}</div>
              </div>
            </div>
          </section>

          <section className='assessment-form-section'>
            <div className='assessment-form-section-title'>Thông tin bổ sung</div>
            <div className='assessment-form-grid'>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-parent-name'>Họ và tên phụ huynh</CFormLabel>
                <CFormInput id='assessment-parent-name' value={form.parent.name} invalid={Boolean(errors['parent.name'])} onChange={(event) => updateField('parent', 'name', event.target.value)} ref={(node) => registerFieldRef('parent.name', node)} />
                {errors['parent.name'] ? <div className='assessment-form-error'>{errors['parent.name']}</div> : null}
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
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-student-name'>Họ tên học sinh</CFormLabel>
                <CFormInput id='assessment-student-name' value={form.student.name} disabled readOnly />
                <div className='assessment-form-label-helper'>Đã ghi nhận từ bước ban đầu.</div>
              </div>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-student-dob'>Ngày sinh</CFormLabel>
                <CFormInput id='assessment-student-dob' type='date' value={form.student.dob} invalid={Boolean(errors['student.dob'])} onChange={(event) => updateField('student', 'dob', event.target.value)} ref={(node) => registerFieldRef('student.dob', node)} />
                <div className='assessment-form-label-helper'>Có thể bổ sung sau nếu bạn chưa tiện nhập ngay.</div>
              </div>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-student-grade'>Lớp hiện tại</CFormLabel>
                <CFormInput id='assessment-student-grade' value={form.student.grade} disabled readOnly />
                <div className='assessment-form-label-helper'>Đã dùng để xác định bài test phù hợp.</div>
              </div>
              <div className='assessment-form-field'>
                <CFormLabel className='assessment-form-label' htmlFor='assessment-student-school'>Trường đang học</CFormLabel>
                <CFormInput id='assessment-student-school' value={form.student.school} invalid={Boolean(errors['student.school'])} onChange={(event) => updateField('student', 'school', event.target.value)} ref={(node) => registerFieldRef('student.school', node)} />
                <div className='assessment-form-label-helper'>Có thể bổ sung sau nếu bạn chưa tiện nhập ngay.</div>
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
                <CFormSelect value={form.qualification.currentEnglishStudy} invalid={Boolean(errors['qualification.currentEnglishStudy'])} onChange={(event) => updateField('qualification', 'currentEnglishStudy', event.target.value)} ref={(node) => registerFieldRef('qualification.currentEnglishStudy', node)}>
                  <option value=''>Chọn tình trạng hiện tại</option>
                  {currentEnglishStudyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </CFormSelect>
                {errors['qualification.currentEnglishStudy'] ? <div className='assessment-form-error'>{errors['qualification.currentEnglishStudy']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <div className='assessment-form-label'>Mục tiêu học</div>
                <div className='assessment-chip-select-grid' ref={(node) => registerFieldRef('qualification.goals', node)}>
                  {goalOptions.map((option) => {
                    const selected = form.qualification.goals.includes(option.value)
                    const reachedLimit = !selected && form.qualification.goals.length >= 2
                    return <SelectableOption key={option.value} type='checkbox' compact name={`goal-${option.value}`} label={option.label} checked={selected} disabled={reachedLimit} onChange={() => toggleArrayValue('qualification', 'goals', option.value, 2)} />
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
                <CFormSelect value={form.qualification.studyMode} invalid={Boolean(errors['qualification.studyMode'])} onChange={(event) => updateField('qualification', 'studyMode', event.target.value)} ref={(node) => registerFieldRef('qualification.studyMode', node)}>
                  <option value=''>Chọn hình thức học</option>
                  {studyModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </CFormSelect>
                {errors['qualification.studyMode'] ? <div className='assessment-form-error'>{errors['qualification.studyMode']}</div> : null}
              </div>
              <div className='assessment-form-field'>
                <div className='assessment-form-label'>Ngày có thể học</div>
                <div className='assessment-chip-select-grid assessment-chip-select-grid--compact' ref={(node) => registerFieldRef('qualification.availableDays', node)}>
                  {availableDayOptions.map((option) => <SelectableOption key={option.value} type='checkbox' compact name={`day-${option.value}`} label={option.shortLabel || option.label} checked={form.qualification.availableDays.includes(option.value)} onChange={() => toggleArrayValue('qualification', 'availableDays', option.value)} />)}
                </div>
                <div className='assessment-form-label-helper'>Không bắt buộc. Bạn có thể bổ sung sau nếu chưa tiện chọn ngay.</div>
              </div>
              <div className='assessment-form-field'>
                <div className='assessment-form-label'>Khung giờ có thể học</div>
                <div className='assessment-chip-select-grid' ref={(node) => registerFieldRef('qualification.availableTimes', node)}>
                  {availableTimeOptions.map((option) => <SelectableOption key={option.value} type='checkbox' compact name={`time-${option.value}`} label={option.label} checked={form.qualification.availableTimes.includes(option.value)} onChange={() => toggleArrayValue('qualification', 'availableTimes', option.value)} />)}
                </div>
                <div className='assessment-form-label-helper'>Không bắt buộc. Có thể chọn sau khi cần chốt lịch học.</div>
              </div>
              <div className='assessment-form-field'>
                <div className='assessment-form-label'>Khi nào muốn bắt đầu?</div>
                <CFormSelect value={form.qualification.startIntent} invalid={Boolean(errors['qualification.startIntent'])} onChange={(event) => updateField('qualification', 'startIntent', event.target.value)} ref={(node) => registerFieldRef('qualification.startIntent', node)}>
                  <option value=''>Chọn thời điểm mong muốn</option>
                  {startIntentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </CFormSelect>
                {errors['qualification.startIntent'] ? <div className='assessment-form-error'>{errors['qualification.startIntent']}</div> : null}
              </div>
            </div>
          </section>

          <div className='assessment-form-actions'>
            <CButton type='submit' color='primary' className='assessment-primary-cta'>XEM KẾT QUẢ SƠ BỘ</CButton>
          </div>
        </form>
      </CCardBody>
    </CCard>
  )
}
