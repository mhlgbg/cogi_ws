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
  buildExamSubjectFormValues,
  usesAggregateScore,
  validateExamSubjectForm,
} from '../utils/examSubjectForm'
import { EXAM_SUBJECT_CALCULATION_METHOD_OPTIONS } from '../utils/examSubjectUi'

function getModalTitle(mode) {
  if (mode === 'edit') return 'Chỉnh sửa môn thi'
  if (mode === 'clone') return 'Nhân bản môn thi'
  return 'Tạo môn thi'
}

export default function ExamSubjectFormModal({
  visible,
  mode = 'create',
  initialValues,
  onClose,
  onSubmit,
  submitting = false,
  submitError = '',
  fieldErrors = {},
}) {
  const [form, setForm] = useState(() => buildExamSubjectFormValues(initialValues, { mode }))
  const [localErrors, setLocalErrors] = useState({})

  useEffect(() => {
    if (!visible) return
    setForm(buildExamSubjectFormValues(initialValues, { mode }))
    setLocalErrors({})
  }, [initialValues, mode, visible])

  const title = useMemo(() => getModalTitle(mode), [mode])
  const errors = { ...localErrors, ...fieldErrors }
  const aggregateScoreEnabled = usesAggregateScore(form.calculationMethod)

  function updateField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'calculationMethod') {
        const nextUsesAggregate = usesAggregateScore(value)
        if (!nextUsesAggregate) {
          next.requiredAggregateScore = ''
        }
        if (String(value || '').trim().toLowerCase() === 'all_components_pass') {
          next.requireAllComponents = true
        }
      }
      return next
    })
    setLocalErrors((current) => {
      if (!current[key] && !(key === 'calculationMethod' && current.requiredAggregateScore)) return current
      const nextErrors = { ...current }
      delete nextErrors[key]
      if (key === 'calculationMethod') delete nextErrors.requiredAggregateScore
      return nextErrors
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateExamSubjectForm(form)
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
          {mode === 'clone' ? <CAlert color='info'>Bản sao mới chỉ bao gồm thông tin chung. Cấu trúc kỹ năng chưa được sao chép.</CAlert> : null}

          <div className='fw-semibold mb-3'>Thông tin chung</div>
          <CRow className='g-3 mb-4'>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Mã môn thi</CFormLabel>
              <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} disabled={submitting} invalid={Boolean(errors.code)} placeholder='VD: ENG-A1' />
              {errors.code ? <div className='text-danger small mt-1'>{errors.code}</div> : null}
            </CCol>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Tên môn thi</CFormLabel>
              <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} disabled={submitting} invalid={Boolean(errors.name)} placeholder='Ví dụ: Tiếng Anh A1' />
              {errors.name ? <div className='text-danger small mt-1'>{errors.name}</div> : null}
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Mô tả quy tắc</CFormLabel>
              <CFormTextarea rows={4} value={form.ruleDescription} onChange={(event) => updateField('ruleDescription', event.target.value)} disabled={submitting} placeholder='Ghi chú thêm về điều kiện đạt hoặc cách áp dụng môn thi.' />
            </CCol>
            <CCol lg={4} md={6} xs={12} className='d-flex align-items-end'>
              <CFormCheck label='Đang hoạt động' checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} disabled={submitting} />
            </CCol>
          </CRow>

          <div className='fw-semibold mb-3'>Quy tắc kết quả</div>
          <CRow className='g-3 mb-4'>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Phương thức tính kết quả</CFormLabel>
              <CFormSelect value={form.calculationMethod} onChange={(event) => updateField('calculationMethod', event.target.value)} disabled={submitting} invalid={Boolean(errors.calculationMethod)}>
                {EXAM_SUBJECT_CALCULATION_METHOD_OPTIONS.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </CFormSelect>
              {errors.calculationMethod ? <div className='text-danger small mt-1'>{errors.calculationMethod}</div> : null}
            </CCol>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Điểm yêu cầu</CFormLabel>
              <CFormInput type='number' step='0.01' inputMode='decimal' value={form.requiredAggregateScore} onChange={(event) => updateField('requiredAggregateScore', event.target.value)} disabled={submitting || !aggregateScoreEnabled} invalid={Boolean(errors.requiredAggregateScore)} placeholder={aggregateScoreEnabled ? 'Nhập điểm yêu cầu' : 'Không áp dụng cho phương thức hiện tại'} />
              {errors.requiredAggregateScore ? <div className='text-danger small mt-1'>{errors.requiredAggregateScore}</div> : null}
            </CCol>
            <CCol lg={6} md={6} xs={12} className='d-flex align-items-end'>
              <CFormCheck label='Yêu cầu tất cả kỹ năng đạt' checked={form.requireAllComponents} onChange={(event) => updateField('requireAllComponents', event.target.checked)} disabled={submitting || form.calculationMethod === 'all_components_pass'} />
            </CCol>
          </CRow>

          <div className='fw-semibold mb-3'>Lệ phí mặc định</div>
          <CRow className='g-3'>
            <CCol lg={6} md={6} xs={12}>
              <CFormLabel>Lệ phí mặc định</CFormLabel>
              <CFormInput type='number' step='0.01' inputMode='decimal' value={form.defaultFee} onChange={(event) => updateField('defaultFee', event.target.value)} disabled={submitting} invalid={Boolean(errors.defaultFee)} placeholder='Để trống nếu chưa cấu hình' />
              {errors.defaultFee ? <div className='text-danger small mt-1'>{errors.defaultFee}</div> : null}
            </CCol>
            <CCol lg={6} md={6} xs={12} className='d-flex align-items-end'>
              <div className='small text-body-secondary'>Đơn vị tiền tệ hiện tại: VND</div>
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
          <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : mode === 'clone' ? 'Tạo bản sao' : 'Tạo môn thi'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}