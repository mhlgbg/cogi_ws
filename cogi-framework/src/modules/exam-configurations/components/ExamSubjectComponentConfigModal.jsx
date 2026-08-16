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
import { getExamMethodLabel } from '../utils/examConfigurationUi'
import {
  buildExamSubjectComponentFormValues,
  mapExamSubjectComponentFormValuesToPayload,
  validateExamSubjectComponentForm,
} from '../utils/examSubjectComponentForm'
import {
  formatEffectiveDuration,
  formatEffectiveScore,
  getEffectiveDuration,
  getEffectiveEliminationScore,
  getEffectivePassingScore,
} from '../utils/examSubjectUi'

export default function ExamSubjectComponentConfigModal({
  visible,
  item,
  saving = false,
  submitError = '',
  fieldErrors = {},
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => buildExamSubjectComponentFormValues(item))
  const [localErrors, setLocalErrors] = useState({})

  useEffect(() => {
    if (!visible) return
    setForm(buildExamSubjectComponentFormValues(item))
    setLocalErrors({})
  }, [item, visible])

  const errors = { ...localErrors, ...fieldErrors }
  const effectivePassingScore = getEffectivePassingScore(item)
  const effectiveEliminationScore = getEffectiveEliminationScore(item)
  const effectiveDuration = getEffectiveDuration(item)

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
    const nextErrors = validateExamSubjectComponentForm(form, item)
    setLocalErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit?.(mapExamSubjectComponentFormValuesToPayload(form))
  }

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl' backdrop='static' scrollable>
      <CModalHeader>
        <CModalTitle>Cấu hình kỹ năng trong môn</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}

          <div className='fw-semibold mb-3'>Thông tin tham chiếu</div>
          <CRow className='g-3 mb-4'>
            <CCol md={6}><div className='small text-body-secondary'>Môn thi</div><div>{item?.subjectName || '-'}</div></CCol>
            <CCol md={6}><div className='small text-body-secondary'>Kỹ năng</div><div>{item?.examComponentName || '-'}</div></CCol>
            <CCol md={6}><div className='small text-body-secondary'>Mã kỹ năng</div><div>{item?.examComponentCode || '-'}</div></CCol>
            <CCol md={6}><div className='small text-body-secondary'>Hình thức thi</div><div>{getExamMethodLabel(item?.examMethod)}</div></CCol>
            <CCol md={4}><div className='small text-body-secondary'>Điểm đạt mặc định</div><div>{formatEffectiveScore({ source: 'default', value: item?.passingScore })}</div></CCol>
            <CCol md={4}><div className='small text-body-secondary'>Điểm liệt mặc định</div><div>{formatEffectiveScore({ source: 'default', value: item?.eliminationScore })}</div></CCol>
            <CCol md={4}><div className='small text-body-secondary'>Thời lượng mặc định</div><div>{formatEffectiveDuration({ source: 'default', value: item?.defaultDurationMinutes })}</div></CCol>
          </CRow>

          <div className='fw-semibold mb-3'>Quy tắc tham gia</div>
          <CRow className='g-3 mb-4'>
            <CCol xs={12}>
              <CFormCheck label='Bắt buộc' checked={form.isRequired} onChange={(event) => updateField('isRequired', event.target.checked)} disabled={saving} />
            </CCol>
          </CRow>

          <div className='fw-semibold mb-3'>Quy tắc tính kết quả</div>
          <CRow className='g-3 mb-4'>
            <CCol md={4}>
              <CFormLabel>Trọng số</CFormLabel>
              <CFormInput type='number' step='0.01' inputMode='decimal' value={form.weight} onChange={(event) => updateField('weight', event.target.value)} disabled={saving} invalid={Boolean(errors.weight)} placeholder='Để trống nếu không override' />
              {errors.weight ? <div className='text-danger small mt-1'>{errors.weight}</div> : null}
            </CCol>
            <CCol md={4}>
              <CFormLabel>Điểm đạt override</CFormLabel>
              <CFormInput type='number' step='0.01' inputMode='decimal' value={form.passingScoreOverride} onChange={(event) => updateField('passingScoreOverride', event.target.value)} disabled={saving} invalid={Boolean(errors.passingScoreOverride)} placeholder='Để trống để dùng mặc định' />
              <div className='small text-body-secondary mt-1'>Hiện đang áp dụng: {formatEffectiveScore(effectivePassingScore)}</div>
              {errors.passingScoreOverride ? <div className='text-danger small mt-1'>{errors.passingScoreOverride}</div> : null}
            </CCol>
            <CCol md={4}>
              <CFormLabel>Điểm liệt override</CFormLabel>
              <CFormInput type='number' step='0.01' inputMode='decimal' value={form.eliminationScoreOverride} onChange={(event) => updateField('eliminationScoreOverride', event.target.value)} disabled={saving} invalid={Boolean(errors.eliminationScoreOverride)} placeholder='Để trống để dùng mặc định' />
              <div className='small text-body-secondary mt-1'>Hiện đang áp dụng: {formatEffectiveScore(effectiveEliminationScore)}</div>
              {errors.eliminationScoreOverride ? <div className='text-danger small mt-1'>{errors.eliminationScoreOverride}</div> : null}
            </CCol>
          </CRow>

          <div className='fw-semibold mb-3'>Cấu hình tổ chức</div>
          <CRow className='g-3'>
            <CCol md={6}>
              <CFormLabel>Thời lượng override</CFormLabel>
              <CFormInput type='number' step='1' inputMode='numeric' value={form.durationMinutesOverride} onChange={(event) => updateField('durationMinutesOverride', event.target.value)} disabled={saving} invalid={Boolean(errors.durationMinutesOverride)} placeholder='Để trống để dùng mặc định' />
              <div className='small text-body-secondary mt-1'>Hiện đang áp dụng: {formatEffectiveDuration(effectiveDuration)}</div>
              {errors.durationMinutesOverride ? <div className='text-danger small mt-1'>{errors.durationMinutesOverride}</div> : null}
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