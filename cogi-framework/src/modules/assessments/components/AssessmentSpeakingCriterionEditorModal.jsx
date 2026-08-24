import { useEffect, useState } from 'react'
import { CAlert, CButton, CCol, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow } from '@coreui/react'
import { getApiMessage } from '../services/assessmentService'

function emptyForm() {
  return {
    code: '',
    label: '',
    description: '',
    guidance: '',
    order: '1',
    maxScore: '5',
    weight: '',
    required: true,
    status: 'active',
  }
}

function normalizeForm(item) {
  return {
    code: item?.code || '',
    label: item?.label || '',
    description: item?.description || '',
    guidance: item?.guidance || '',
    order: String(item?.order ?? 1),
    maxScore: String(item?.maxScore ?? '5'),
    weight: item?.weight === null || item?.weight === undefined ? '' : String(item.weight),
    required: item?.required !== false,
    status: item?.status || 'active',
  }
}

export default function AssessmentSpeakingCriterionEditorModal({ visible, saving, criterion, onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(criterion ? normalizeForm(criterion) : emptyForm())
    setError('')
  }, [criterion, visible])

  function handleClose() {
    if (saving) return
    setError('')
    onClose?.()
  }

  async function handleSave() {
    if (!String(form.code || '').trim()) return setError('Mã tiêu chí là bắt buộc')
    if (!String(form.label || '').trim()) return setError('Tên tiêu chí là bắt buộc')
    if (form.maxScore === '' || Number(form.maxScore) <= 0) return setError('Điểm tối đa phải lớn hơn 0')
    try {
      await onSubmit?.({
        code: String(form.code || '').trim(),
        label: String(form.label || '').trim(),
        description: String(form.description || '').trim() || null,
        guidance: String(form.guidance || '').trim() || null,
        order: Number(form.order || 0),
        maxScore: Number(form.maxScore || 0),
        weight: form.weight === '' ? null : Number(form.weight),
        required: form.required,
        status: form.status,
      })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được tiêu chí Speaking'))
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='lg' onClose={handleClose}>
      <CModalHeader><CModalTitle>{criterion ? 'Sửa tiêu chí Speaking' : 'Thêm tiêu chí Speaking'}</CModalTitle></CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={4}><CFormLabel>Mã</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
          <CCol md={5}><CFormLabel>Tên tiêu chí</CFormLabel><CFormInput value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} /></CCol>
          <CCol md={3}><CFormLabel>Thứ tự</CFormLabel><CFormInput type='number' value={form.order} onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Điểm tối đa</CFormLabel><CFormInput type='number' step='0.01' value={form.maxScore} onChange={(event) => setForm((prev) => ({ ...prev, maxScore: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Weight</CFormLabel><CFormInput type='number' step='0.01' value={form.weight} onChange={(event) => setForm((prev) => ({ ...prev, weight: event.target.value }))} placeholder='Tùy chọn' /></CCol>
          <CCol md={4}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}><option value='active'>Hoạt động</option><option value='inactive'>Ngưng dùng</option></CFormSelect></CCol>
          <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={4} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
          <CCol xs={12}><CFormLabel>Hướng dẫn chấm</CFormLabel><CFormTextarea rows={4} value={form.guidance} onChange={(event) => setForm((prev) => ({ ...prev, guidance: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Bắt buộc</CFormLabel><CFormSelect value={form.required ? 'true' : 'false'} onChange={(event) => setForm((prev) => ({ ...prev, required: event.target.value === 'true' }))}><option value='true'>Có</option><option value='false'>Không</option></CFormSelect></CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu tiêu chí'}</CButton>
      </CModalFooter>
    </CModal>
  )
}