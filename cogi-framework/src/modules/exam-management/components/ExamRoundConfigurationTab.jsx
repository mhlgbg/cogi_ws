import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
} from '@coreui/react'
import ExamErrorAlert from './ExamErrorAlert'
import { buildExamRoundStructurePayload, canEditExamRound, getPaymentCalculationMethodLabel, getRegistrationModeLabel } from '../utils/examRoundUi'

function buildForm(round) {
  return {
    paymentCalculationMethod: round?.paymentCalculationMethod || 'program_fee',
    fixedFee: round?.fixedFee ?? '',
    allowSubjectSelection: round?.allowSubjectSelection === true,
    allowComponentSelection: round?.allowComponentSelection === true,
  }
}

export default function ExamRoundConfigurationTab({ round, permissions, saving = false, errorMessage = '', errorCode = '', errorDetails = [], onSave }) {
  const editable = canEditExamRound(round, permissions)
  const [form, setForm] = useState(() => buildForm(round))
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setForm(buildForm(round))
    setLocalError('')
  }, [round])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setLocalError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (form.paymentCalculationMethod === 'fixed' && String(form.fixedFee || '').trim() === '') {
      setLocalError('Bạn cần nhập phí cố định khi chọn phương thức phí cố định.')
      return
    }

    const payload = buildExamRoundStructurePayload(round, {
      paymentCalculationMethod: form.paymentCalculationMethod,
      fixedFee: form.paymentCalculationMethod === 'fixed' ? String(form.fixedFee || '').trim() : null,
      allowSubjectSelection: form.allowSubjectSelection,
      allowComponentSelection: form.allowComponentSelection,
    })
    await onSave?.(payload, 'Đã cập nhật tab Cấu hình của đợt thi.')
  }

  return (
    <CCard>
      <CCardHeader><strong>Cấu hình đợt thi</strong></CCardHeader>
      <CCardBody>
        <CAlert color='info'>Tab này chỉnh cấu hình snapshot của đợt thi hiện tại. Các thay đổi không đẩy ngược về chương trình nguồn.</CAlert>
        {!editable ? <CAlert color='warning'>Đợt thi chỉ cho phép sửa cấu hình khi còn ở trạng thái bản nháp và người dùng có quyền quản trị.</CAlert> : null}
        {localError ? <CAlert color='danger'>{localError}</CAlert> : null}
        <ExamErrorAlert message={errorMessage} code={errorCode} details={errorDetails} />

        <CRow className='g-3 mb-4'>
          <CCol md={4}>
            <div className='small text-body-secondary'>Chế độ đăng ký</div>
            <div className='fw-semibold'>{getRegistrationModeLabel(round?.registrationMode)}</div>
          </CCol>
          <CCol md={4}>
            <div className='small text-body-secondary'>Trạng thái hiện tại</div>
            <div className='fw-semibold'>{round?.status || '-'}</div>
          </CCol>
          <CCol md={4}>
            <div className='small text-body-secondary'>Phương thức đang áp dụng</div>
            <div className='fw-semibold'>{getPaymentCalculationMethodLabel(round?.paymentCalculationMethod)}</div>
          </CCol>
        </CRow>

        <CForm onSubmit={handleSubmit}>
          <CRow className='g-3'>
            <CCol lg={4}>
              <CFormLabel>Phương thức tính phí</CFormLabel>
              <CFormSelect value={form.paymentCalculationMethod} onChange={(event) => updateField('paymentCalculationMethod', event.target.value)} disabled={!editable || saving}>
                <option value='program_fee'>Phí chương trình</option>
                <option value='subject_fee'>Phí theo môn</option>
                <option value='component_fee'>Phí theo kỹ năng/phần thi</option>
                <option value='fixed'>Phí cố định</option>
              </CFormSelect>
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Phí cố định</CFormLabel>
              <CFormInput value={form.fixedFee} onChange={(event) => updateField('fixedFee', event.target.value)} disabled={!editable || saving || form.paymentCalculationMethod !== 'fixed'} placeholder='200000' />
            </CCol>
            <CCol lg={4} className='d-flex align-items-end'>
              <div className='small text-body-secondary'>Khi không dùng phí cố định, giá trị này sẽ được backend tự bỏ qua.</div>
            </CCol>
            <CCol md={6}>
              <CFormCheck label='Cho phép learner tự chọn môn thi' checked={form.allowSubjectSelection} onChange={(event) => updateField('allowSubjectSelection', event.target.checked)} disabled={!editable || saving} />
            </CCol>
            <CCol md={6}>
              <CFormCheck label='Cho phép learner tự chọn kỹ năng/phần thi' checked={form.allowComponentSelection} onChange={(event) => updateField('allowComponentSelection', event.target.checked)} disabled={!editable || saving} />
            </CCol>
          </CRow>

          <div className='d-flex gap-2 mt-4'>
            <CButton color='primary' type='submit' disabled={!editable || saving}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</CButton>
          </div>
        </CForm>
      </CCardBody>
    </CCard>
  )
}