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
  CFormTextarea,
  CRow,
} from '@coreui/react'
import ExamErrorAlert from './ExamErrorAlert'
import {
  buildExamRoundStructurePayload,
  canEditExamRound,
  formatDateTimeInput,
  getExamRoundConfigurationAccess,
  getExamRoundEditLockMessage,
  getPaymentCalculationMethodLabel,
  getRegistrationModeLabel,
} from '../utils/examRoundUi'

function buildForm(round) {
  return {
    code: round?.code || '',
    name: round?.name || '',
    academicYear: round?.academicYear || '',
    semester: round?.semester || '',
    registrationMode: round?.registrationMode || 'restricted',
    registrationStartAt: formatDateTimeInput(round?.registrationStartAt),
    registrationEndAt: formatDateTimeInput(round?.registrationEndAt),
    paymentStartAt: formatDateTimeInput(round?.paymentStartAt),
    paymentEndAt: formatDateTimeInput(round?.paymentEndAt),
    candidateListClosingAt: formatDateTimeInput(round?.candidateListClosingAt),
    examStartAt: formatDateTimeInput(round?.examStartAt),
    examEndAt: formatDateTimeInput(round?.examEndAt),
    paymentCalculationMethod: round?.paymentCalculationMethod || 'program_fee',
    fixedFee: round?.fixedFee ?? '',
    allowSubjectSelection: round?.allowSubjectSelection === true,
    allowComponentSelection: round?.allowComponentSelection === true,
    requireConfirmedPayment: round?.requireConfirmedPayment === true,
    allowCancellation: round?.allowCancellation === true,
    cancellationDeadline: formatDateTimeInput(round?.cancellationDeadline),
    instructions: round?.instructions || '',
    paymentInstructions: round?.paymentInstructions || '',
  }
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null
}

function validateForm(form) {
  if (!String(form.code || '').trim()) return 'Bạn cần nhập mã đợt thi.'
  if (!String(form.name || '').trim()) return 'Bạn cần nhập tên đợt thi.'
  if (!String(form.registrationStartAt || '').trim() || !String(form.registrationEndAt || '').trim()) {
    return 'Bạn cần nhập đủ thời gian bắt đầu và kết thúc đăng ký.'
  }
  if (form.registrationStartAt && form.registrationEndAt && new Date(form.registrationStartAt).getTime() >= new Date(form.registrationEndAt).getTime()) {
    return 'Thời gian bắt đầu đăng ký phải trước thời gian kết thúc đăng ký.'
  }
  if ((form.paymentStartAt && !form.paymentEndAt) || (!form.paymentStartAt && form.paymentEndAt)) {
    return 'Nếu nhập thời gian thanh toán, bạn cần nhập đủ cả ngày bắt đầu và kết thúc.'
  }
  if (form.paymentStartAt && form.paymentEndAt && new Date(form.paymentStartAt).getTime() >= new Date(form.paymentEndAt).getTime()) {
    return 'Thời gian bắt đầu thanh toán phải trước thời gian kết thúc thanh toán.'
  }
  if (form.candidateListClosingAt && form.registrationEndAt && new Date(form.candidateListClosingAt).getTime() < new Date(form.registrationEndAt).getTime()) {
    return 'Mốc chốt danh sách không được sớm hơn thời gian kết thúc đăng ký.'
  }
  if (form.examStartAt && form.candidateListClosingAt && new Date(form.examStartAt).getTime() < new Date(form.candidateListClosingAt).getTime()) {
    return 'Thời gian bắt đầu thi không được sớm hơn mốc chốt danh sách.'
  }
  if (form.examStartAt && form.examEndAt && new Date(form.examStartAt).getTime() >= new Date(form.examEndAt).getTime()) {
    return 'Thời gian bắt đầu thi phải trước thời gian kết thúc thi.'
  }
  if (form.allowCancellation && form.cancellationDeadline && form.registrationEndAt && new Date(form.cancellationDeadline).getTime() > new Date(form.registrationEndAt).getTime()) {
    return 'Hạn hủy đăng ký không được sau thời gian kết thúc đăng ký.'
  }
  if (form.paymentCalculationMethod === 'fixed' && String(form.fixedFee || '').trim() === '') {
    return 'Bạn cần nhập phí cố định khi chọn phương thức phí cố định.'
  }
  return ''
}

export default function ExamRoundConfigurationTab({ round, permissions, saving = false, errorMessage = '', errorCode = '', errorDetails = [], onSave }) {
  const editable = canEditExamRound(round, permissions)
  const configurationAccess = getExamRoundConfigurationAccess(round)
  const lockMessage = getExamRoundEditLockMessage(round, permissions)
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
    const validationError = validateForm(form)
    if (validationError) {
      setLocalError(validationError)
      return
    }

    const payload = buildExamRoundStructurePayload(round, {
      code: String(form.code || '').trim(),
      name: String(form.name || '').trim(),
      academicYear: String(form.academicYear || '').trim() || null,
      semester: String(form.semester || '').trim() || null,
      registrationMode: form.registrationMode,
      registrationStartAt: toIso(form.registrationStartAt),
      registrationEndAt: toIso(form.registrationEndAt),
      paymentStartAt: toIso(form.paymentStartAt),
      paymentEndAt: toIso(form.paymentEndAt),
      candidateListClosingAt: toIso(form.candidateListClosingAt),
      examStartAt: toIso(form.examStartAt),
      examEndAt: toIso(form.examEndAt),
      paymentCalculationMethod: form.paymentCalculationMethod,
      fixedFee: form.paymentCalculationMethod === 'fixed' ? String(form.fixedFee || '').trim() : null,
      allowSubjectSelection: form.allowSubjectSelection,
      allowComponentSelection: form.allowComponentSelection,
      requireConfirmedPayment: form.requireConfirmedPayment,
      allowCancellation: form.allowCancellation,
      cancellationDeadline: form.allowCancellation ? toIso(form.cancellationDeadline) : null,
      instructions: String(form.instructions || '').trim() || null,
      paymentInstructions: String(form.paymentInstructions || '').trim() || null,
    })
    await onSave?.(payload, 'Đã cập nhật tab Cấu hình của đợt thi.')
  }

  return (
    <CCard>
      <CCardHeader><strong>Cấu hình đợt thi</strong></CCardHeader>
      <CCardBody>
        <CAlert color='info'>Tab này chỉnh cấu hình snapshot của đợt thi hiện tại. Các thay đổi không đẩy ngược về chương trình nguồn.</CAlert>
        {editable && configurationAccess.message ? <CAlert color='warning'>{configurationAccess.message}</CAlert> : null}
        {editable && configurationAccess.warningMessage ? <CAlert color='warning'>{configurationAccess.warningMessage}</CAlert> : null}
        {!editable && lockMessage ? <CAlert color='warning'>{lockMessage}</CAlert> : null}
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
              <CFormLabel>Mã đợt</CFormLabel>
              <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} disabled={!editable || saving} />
            </CCol>
            <CCol lg={8}>
              <CFormLabel>Tên đợt</CFormLabel>
              <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} disabled={!editable || saving} />
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Năm học</CFormLabel>
              <CFormInput value={form.academicYear} onChange={(event) => updateField('academicYear', event.target.value)} disabled={!editable || saving} placeholder='2026-2027' />
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Học kỳ</CFormLabel>
              <CFormInput value={form.semester} onChange={(event) => updateField('semester', event.target.value)} disabled={!editable || saving} placeholder='1' />
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Chế độ đăng ký</CFormLabel>
              <CFormSelect value={form.registrationMode} onChange={(event) => updateField('registrationMode', event.target.value)} disabled={!editable || saving}>
                <option value='open'>Mở</option>
                <option value='restricted'>Có điều kiện</option>
              </CFormSelect>
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Bắt đầu đăng ký</CFormLabel>
              <CFormInput type='datetime-local' value={form.registrationStartAt} onChange={(event) => updateField('registrationStartAt', event.target.value)} disabled={!editable || saving} />
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Kết thúc đăng ký</CFormLabel>
              <CFormInput type='datetime-local' value={form.registrationEndAt} onChange={(event) => updateField('registrationEndAt', event.target.value)} disabled={!editable || saving} />
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Chốt danh sách</CFormLabel>
              <CFormInput type='datetime-local' value={form.candidateListClosingAt} onChange={(event) => updateField('candidateListClosingAt', event.target.value)} disabled={!editable || saving} />
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Bắt đầu thanh toán</CFormLabel>
              <CFormInput type='datetime-local' value={form.paymentStartAt} onChange={(event) => updateField('paymentStartAt', event.target.value)} disabled={!editable || saving} />
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Kết thúc thanh toán</CFormLabel>
              <CFormInput type='datetime-local' value={form.paymentEndAt} onChange={(event) => updateField('paymentEndAt', event.target.value)} disabled={!editable || saving} />
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Bắt đầu thi</CFormLabel>
              <CFormInput type='datetime-local' value={form.examStartAt} onChange={(event) => updateField('examStartAt', event.target.value)} disabled={!editable || saving} />
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Kết thúc thi</CFormLabel>
              <CFormInput type='datetime-local' value={form.examEndAt} onChange={(event) => updateField('examEndAt', event.target.value)} disabled={!editable || saving} />
            </CCol>
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
            <CCol md={6}>
              <CFormCheck label='Yêu cầu xác nhận thanh toán trước khi hoàn tất' checked={form.requireConfirmedPayment} onChange={(event) => updateField('requireConfirmedPayment', event.target.checked)} disabled={!editable || saving} />
            </CCol>
            <CCol md={6}>
              <CFormCheck label='Cho phép hủy đăng ký' checked={form.allowCancellation} onChange={(event) => updateField('allowCancellation', event.target.checked)} disabled={!editable || saving} />
            </CCol>
            <CCol lg={4}>
              <CFormLabel>Hạn hủy đăng ký</CFormLabel>
              <CFormInput type='datetime-local' value={form.cancellationDeadline} onChange={(event) => updateField('cancellationDeadline', event.target.value)} disabled={!editable || saving || !form.allowCancellation} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Hướng dẫn dự thi</CFormLabel>
              <CFormTextarea rows={4} value={form.instructions} onChange={(event) => updateField('instructions', event.target.value)} disabled={!editable || saving} placeholder='Thông tin chung cho thí sinh về đợt thi' />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Hướng dẫn thanh toán</CFormLabel>
              <CFormTextarea rows={4} value={form.paymentInstructions} onChange={(event) => updateField('paymentInstructions', event.target.value)} disabled={!editable || saving} placeholder='Hướng dẫn thanh toán áp dụng cho đợt thi' />
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