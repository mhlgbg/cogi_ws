import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import {
  buildExamProgramFormValues,
  validateExamProgramForm,
} from '../utils/examProgramForm'
import {
  EXAM_PROGRAM_FEE_METHOD_OPTIONS,
  getExamProgramPassingMethodLabel,
} from '../utils/examProgramUi'

const PASSING_METHOD_OPTIONS = [
  { value: 'all_subjects_pass', label: getExamProgramPassingMethodLabel('all_subjects_pass') },
  { value: 'any_subject_pass', label: getExamProgramPassingMethodLabel('any_subject_pass') },
  { value: 'custom', label: getExamProgramPassingMethodLabel('custom') },
]

function getModalTitle(mode) {
  if (mode === 'edit') return 'Chỉnh sửa chương trình thi'
  if (mode === 'clone') return 'Nhân bản chương trình thi'
  return 'Tạo chương trình thi'
}

export default function ExamProgramFormModal({
  visible,
  mode = 'create',
  initialValues,
  onClose,
  onSubmit,
  submitting = false,
  submitError = '',
  fieldErrors = {},
}) {
  const [form, setForm] = useState(() => buildExamProgramFormValues(initialValues, { mode }))
  const [localErrors, setLocalErrors] = useState({})

  useEffect(() => {
    if (!visible) return
    setForm(buildExamProgramFormValues(initialValues, { mode }))
    setLocalErrors({})
  }, [initialValues, mode, visible])

  const title = useMemo(() => getModalTitle(mode), [mode])
  const errors = { ...localErrors, ...fieldErrors }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setLocalErrors((current) => {
      if (!current[key]) return current
      const nextErrors = { ...current }
      delete nextErrors[key]
      return nextErrors
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateExamProgramForm(form)
    setLocalErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit?.(form)
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='xl' backdrop='static' scrollable>
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
          <CAlert color='info'>Các đợt thi đã tạo từ chương trình sử dụng snapshot riêng. Việc chỉnh sửa chương trình chỉ ảnh hưởng tới những đợt thi được tạo sau đó.</CAlert>
          {mode === 'clone' ? <CAlert color='warning'>Bản sao mới chỉ bao gồm thông tin chung. Danh sách môn thi chưa được sao chép.</CAlert> : null}

          <div className='fw-semibold mb-3'>Thông tin chung</div>
          <CRow className='g-3 mb-4'>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Mã chương trình</CFormLabel>
              <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} disabled={submitting} invalid={Boolean(errors.code)} placeholder='VD: A1-2026' />
              {errors.code ? <div className='text-danger small mt-1'>{errors.code}</div> : null}
            </CCol>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Tên chương trình</CFormLabel>
              <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} disabled={submitting} invalid={Boolean(errors.name)} placeholder='Ví dụ: Chương trình tiếng Anh A1' />
              {errors.name ? <div className='text-danger small mt-1'>{errors.name}</div> : null}
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Mô tả mục tiêu</CFormLabel>
              <CFormTextarea rows={4} value={form.targetDescription} onChange={(event) => updateField('targetDescription', event.target.value)} disabled={submitting} placeholder='Mô tả mục tiêu hoặc phạm vi áp dụng của chương trình.' />
            </CCol>
            <CCol lg={4} md={6} xs={12}>
              <CFormLabel>Hiệu lực từ</CFormLabel>
              <CFormInput type='date' value={form.validFrom} onChange={(event) => updateField('validFrom', event.target.value)} disabled={submitting} invalid={Boolean(errors.validFrom)} />
              {errors.validFrom ? <div className='text-danger small mt-1'>{errors.validFrom}</div> : null}
            </CCol>
            <CCol lg={4} md={6} xs={12}>
              <CFormLabel>Hiệu lực đến</CFormLabel>
              <CFormInput type='date' value={form.validTo} onChange={(event) => updateField('validTo', event.target.value)} disabled={submitting} invalid={Boolean(errors.validTo)} />
              {errors.validTo ? <div className='text-danger small mt-1'>{errors.validTo}</div> : null}
            </CCol>
            <CCol lg={4} md={6} xs={12} className='d-flex align-items-end'>
              <CFormCheck label='Đang hoạt động' checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} disabled={submitting} />
            </CCol>
          </CRow>

          <div className='fw-semibold mb-3'>Quy tắc đạt chương trình</div>
          <CRow className='g-3 mb-4'>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Phương thức đạt chương trình</CFormLabel>
              <CFormSelect value={form.passingMethod} onChange={(event) => updateField('passingMethod', event.target.value)} disabled={submitting}>
                {PASSING_METHOD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </CFormSelect>
            </CCol>
          </CRow>

          <div className='fw-semibold mb-3'>Cấu hình lệ phí</div>
          <CRow className='g-3'>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Phương thức tính lệ phí</CFormLabel>
              <CFormSelect value={form.feeCalculationMethod} onChange={(event) => updateField('feeCalculationMethod', event.target.value)} disabled={submitting} invalid={Boolean(errors.feeCalculationMethod)}>
                {EXAM_PROGRAM_FEE_METHOD_OPTIONS.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </CFormSelect>
              {errors.feeCalculationMethod ? <div className='text-danger small mt-1'>{errors.feeCalculationMethod}</div> : null}
            </CCol>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Lệ phí mặc định</CFormLabel>
              <CFormInput type='number' step='0.01' inputMode='decimal' value={form.defaultFee} onChange={(event) => updateField('defaultFee', event.target.value)} disabled={submitting} invalid={Boolean(errors.defaultFee)} placeholder={form.feeCalculationMethod === 'fixed' ? 'Bắt buộc với lệ phí cố định' : 'Có thể để trống'} />
              {errors.defaultFee ? <div className='text-danger small mt-1'>{errors.defaultFee}</div> : null}
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
          <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : mode === 'clone' ? 'Tạo bản sao' : 'Tạo chương trình thi'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}