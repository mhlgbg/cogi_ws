import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import { buildExamProgramSubjectFormValues, mapExamProgramSubjectFormValuesToPayload, validateExamProgramSubjectForm } from '../utils/examProgramSubjectForm'
import { formatExamConfigMoney } from '../utils/examSubjectUi'

export default function ExamProgramSubjectConfigModal({
  visible,
  item,
  saving = false,
  submitError = '',
  fieldErrors = {},
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => buildExamProgramSubjectFormValues(item))
  const [localErrors, setLocalErrors] = useState({})
  const safeItem = item || {}

  useEffect(() => {
    if (!visible) return
    setForm(buildExamProgramSubjectFormValues(item))
    setLocalErrors({})
  }, [item, visible])

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
    const nextErrors = validateExamProgramSubjectForm(form)
    setLocalErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit?.(mapExamProgramSubjectFormValuesToPayload(form))
  }

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl' backdrop='static' scrollable>
      <CModalHeader>
        <CModalTitle>Cấu hình môn trong chương trình</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}

          <div className='fw-semibold mb-3'>Thông tin tham chiếu</div>
          <CRow className='g-3 mb-4'>
            <CCol md={6}><div className='small text-body-secondary'>Chương trình</div><div>{safeItem.programName || '-'}</div></CCol>
            <CCol md={6}><div className='small text-body-secondary'>Môn thi</div><div>{safeItem.examSubjectName || '-'}</div></CCol>
            <CCol md={6}><div className='small text-body-secondary'>Mã môn</div><div>{safeItem.examSubjectCode || '-'}</div></CCol>
            <CCol md={6}><div className='small text-body-secondary'>Lệ phí mặc định của môn</div><div>{safeItem.examSubjectDefaultFee === null || typeof safeItem.examSubjectDefaultFee === 'undefined' ? 'Chưa cấu hình' : formatExamConfigMoney(safeItem.examSubjectDefaultFee)}</div></CCol>
          </CRow>

          <div className='fw-semibold mb-3'>Quy tắc tham gia</div>
          <CRow className='g-3 mb-4'>
            <CCol xs={12}>
              <CFormCheck label='Bắt buộc' checked={form.isRequired} onChange={(event) => updateField('isRequired', event.target.checked)} disabled={saving} />
            </CCol>
          </CRow>

          <div className='fw-semibold mb-3'>Cấu hình lệ phí</div>
          <CRow className='g-3'>
            <CCol md={6}>
              <CFormLabel>Lệ phí override</CFormLabel>
              <CFormInput type='number' step='0.01' inputMode='decimal' value={form.feeOverride} onChange={(event) => updateField('feeOverride', event.target.value)} disabled={saving} invalid={Boolean(errors.feeOverride)} placeholder='Để trống để sử dụng lệ phí mặc định của môn' />
              <div className='small text-body-secondary mt-1'>Để trống để sử dụng giá trị mặc định của môn.</div>
              {errors.feeOverride ? <div className='text-danger small mt-1'>{errors.feeOverride}</div> : null}
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Đóng</CButton>
          <CButton color='primary' type='submit' disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}