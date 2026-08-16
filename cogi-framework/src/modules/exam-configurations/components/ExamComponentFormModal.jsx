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
  buildExamComponentFormValues,
  EXAM_COMPONENT_EXAM_METHOD_OPTIONS,
  validateExamComponentForm,
} from '../utils/examComponentForm'

function getModalTitle(mode) {
  if (mode === 'edit') return 'Chỉnh sửa kỹ năng thi'
  if (mode === 'clone') return 'Nhân bản kỹ năng thi'
  return 'Tạo kỹ năng thi'
}

export default function ExamComponentFormModal({
  visible,
  mode = 'create',
  initialValues,
  onClose,
  onSubmit,
  submitting = false,
  submitError = '',
  fieldErrors = {},
}) {
  const [form, setForm] = useState(() => buildExamComponentFormValues(initialValues, { mode }))
  const [localErrors, setLocalErrors] = useState({})

  useEffect(() => {
    if (!visible) return
    setForm(buildExamComponentFormValues(initialValues, { mode }))
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
    const nextErrors = validateExamComponentForm(form)
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
          {mode === 'clone' ? <CAlert color='info'>Bản sao chỉ kế thừa cấu hình kỹ năng. Mã kỹ năng phải nhập mới và không sao chép relation môn thi hoặc dữ liệu lịch sử.</CAlert> : null}
          <CRow className='g-3'>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Mã kỹ năng</CFormLabel>
              <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} disabled={submitting} invalid={Boolean(errors.code)} placeholder='VD: LISTENING' />
              {errors.code ? <div className='text-danger small mt-1'>{errors.code}</div> : null}
            </CCol>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Tên kỹ năng</CFormLabel>
              <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} disabled={submitting} invalid={Boolean(errors.name)} placeholder='Ví dụ: Kỹ năng Nghe' />
              {errors.name ? <div className='text-danger small mt-1'>{errors.name}</div> : null}
            </CCol>

            <CCol xs={12}>
              <CFormLabel>Mô tả</CFormLabel>
              <CFormTextarea rows={4} value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting} placeholder='Mô tả ngắn về kỹ năng thi này.' />
            </CCol>

            <CCol lg={4} md={6} xs={12}>
              <CFormLabel>Điểm tối thiểu</CFormLabel>
              <CFormInput type='number' step='0.01' inputMode='decimal' value={form.minimumScore} onChange={(event) => updateField('minimumScore', event.target.value)} disabled={submitting} invalid={Boolean(errors.minimumScore)} />
              {errors.minimumScore ? <div className='text-danger small mt-1'>{errors.minimumScore}</div> : null}
            </CCol>
            <CCol lg={4} md={6} xs={12}>
              <CFormLabel>Điểm tối đa</CFormLabel>
              <CFormInput type='number' step='0.01' inputMode='decimal' value={form.maximumScore} onChange={(event) => updateField('maximumScore', event.target.value)} disabled={submitting} invalid={Boolean(errors.maximumScore)} />
              {errors.maximumScore ? <div className='text-danger small mt-1'>{errors.maximumScore}</div> : null}
            </CCol>
            <CCol lg={4} md={6} xs={12}>
              <CFormLabel>Điểm đạt</CFormLabel>
              <CFormInput type='number' step='0.01' inputMode='decimal' value={form.passingScore} onChange={(event) => updateField('passingScore', event.target.value)} disabled={submitting} invalid={Boolean(errors.passingScore)} placeholder='Để trống nếu không áp dụng' />
              {errors.passingScore ? <div className='text-danger small mt-1'>{errors.passingScore}</div> : null}
            </CCol>

            <CCol lg={4} md={6} xs={12}>
              <CFormLabel>Thời lượng mặc định (phút)</CFormLabel>
              <CFormInput type='number' step='1' inputMode='numeric' value={form.defaultDurationMinutes} onChange={(event) => updateField('defaultDurationMinutes', event.target.value)} disabled={submitting} invalid={Boolean(errors.defaultDurationMinutes)} placeholder='Để trống nếu không áp dụng' />
              {errors.defaultDurationMinutes ? <div className='text-danger small mt-1'>{errors.defaultDurationMinutes}</div> : null}
            </CCol>
            <CCol lg={4} md={6} xs={12}>
              <CFormLabel>Hình thức thi</CFormLabel>
              <CFormSelect value={form.examMethod} onChange={(event) => updateField('examMethod', event.target.value)} disabled={submitting} invalid={Boolean(errors.examMethod)}>
                {EXAM_COMPONENT_EXAM_METHOD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </CFormSelect>
              {errors.examMethod ? <div className='text-danger small mt-1'>{errors.examMethod}</div> : null}
            </CCol>
            <CCol lg={4} md={6} xs={12} className='d-flex align-items-end'>
              <CFormCheck label='Đang hoạt động' checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} disabled={submitting} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
          <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : mode === 'clone' ? 'Tạo bản sao' : 'Tạo kỹ năng thi'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}