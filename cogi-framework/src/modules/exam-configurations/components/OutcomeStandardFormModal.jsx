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
import { buildOutcomeStandardFormValues, validateOutcomeStandardForm } from '../utils/outcomeStandardForm'
import { OUTCOME_RECOGNITION_METHOD_OPTIONS } from '../utils/outcomeStandardUi'

export default function OutcomeStandardFormModal({
  visible,
  mode = 'create',
  initialValues,
  examProgramOptions = [],
  onClose,
  onSubmit,
  submitting = false,
  submitError = '',
  fieldErrors = {},
}) {
  const [form, setForm] = useState(() => buildOutcomeStandardFormValues(initialValues, { mode }))
  const [localErrors, setLocalErrors] = useState({})

  useEffect(() => {
    if (!visible) return
    setForm(buildOutcomeStandardFormValues(initialValues, { mode }))
    setLocalErrors({})
  }, [initialValues, mode, visible])

  const title = useMemo(() => mode === 'edit' ? 'Chỉnh sửa chuẩn đầu ra' : mode === 'clone' ? 'Nhân bản chuẩn đầu ra' : 'Tạo chuẩn đầu ra', [mode])
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
    const nextErrors = validateOutcomeStandardForm(form)
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
          <CAlert color='info'>Chuẩn đầu ra là cấu hình dùng để đánh giá và công nhận kết quả. Việc chỉnh sửa chuẩn đầu ra không tự động làm thay đổi dữ liệu đánh giá hoặc kết quả đã được ghi nhận trước đó.</CAlert>
          {mode === 'clone' ? <CAlert color='warning'>Bản sao giữ lại cấu hình chung hiện có theo schema thật của outcome-standard.</CAlert> : null}

          <div className='fw-semibold mb-3'>Thông tin chung</div>
          <CRow className='g-3 mb-4'>
            <CCol md={6}><CFormLabel>Mã chuẩn</CFormLabel><CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} disabled={submitting} invalid={Boolean(errors.code)} />{errors.code ? <div className='text-danger small mt-1'>{errors.code}</div> : null}</CCol>
            <CCol md={6}><CFormLabel>Tên chuẩn</CFormLabel><CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} disabled={submitting} invalid={Boolean(errors.name)} />{errors.name ? <div className='text-danger small mt-1'>{errors.name}</div> : null}</CCol>
            <CCol xs={12}><CFormLabel>Mô tả áp dụng</CFormLabel><CFormTextarea rows={4} value={form.applicableDescription} onChange={(event) => updateField('applicableDescription', event.target.value)} disabled={submitting} /></CCol>
            <CCol md={4}><CFormLabel>Hiệu lực từ</CFormLabel><CFormInput type='date' value={form.validFrom} onChange={(event) => updateField('validFrom', event.target.value)} disabled={submitting} invalid={Boolean(errors.validFrom)} />{errors.validFrom ? <div className='text-danger small mt-1'>{errors.validFrom}</div> : null}</CCol>
            <CCol md={4}><CFormLabel>Hiệu lực đến</CFormLabel><CFormInput type='date' value={form.validTo} onChange={(event) => updateField('validTo', event.target.value)} disabled={submitting} invalid={Boolean(errors.validTo)} />{errors.validTo ? <div className='text-danger small mt-1'>{errors.validTo}</div> : null}</CCol>
            <CCol md={4} className='d-flex align-items-end'><CFormCheck label='Đang hoạt động' checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} disabled={submitting} /></CCol>
          </CRow>

          <div className='fw-semibold mb-3'>Phạm vi áp dụng</div>
          <CRow className='g-3 mb-4'>
            <CCol md={6}><CFormLabel>Chương trình thi</CFormLabel><CFormSelect value={form.examProgram} onChange={(event) => updateField('examProgram', event.target.value)} disabled={submitting}><option value=''>Không gắn chương trình</option>{examProgramOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</CFormSelect></CCol>
            <CCol md={6}><CFormLabel>Phương thức công nhận</CFormLabel><CFormSelect value={form.recognitionMethod} onChange={(event) => updateField('recognitionMethod', event.target.value)} disabled={submitting} invalid={Boolean(errors.recognitionMethod)}>{OUTCOME_RECOGNITION_METHOD_OPTIONS.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</CFormSelect>{errors.recognitionMethod ? <div className='text-danger small mt-1'>{errors.recognitionMethod}</div> : null}</CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
          <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : mode === 'clone' ? 'Tạo bản sao' : 'Tạo chuẩn đầu ra'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}