import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
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
import { getApiMessage, getEntityId } from '../../learning-management/utils/questionBankUi'
import { getAssessmentTypeLabel, getAssessmentStatusLabel } from './assessmentUi'

function emptyForm() {
  return {
    code: '',
    name: '',
    description: '',
    assessmentType: 'placement',
    subject: '',
    status: 'draft',
  }
}

function normalizeForm(assessment) {
  return {
    code: assessment?.code || '',
    name: assessment?.name || '',
    description: assessment?.description || '',
    assessmentType: assessment?.assessmentType || 'placement',
    subject: getEntityId(assessment?.subject),
    status: assessment?.status || 'draft',
  }
}

export default function AssessmentEditorModal({ visible, saving, assessment, subjects = [], onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(assessment ? normalizeForm(assessment) : emptyForm())
    setError('')
  }, [assessment, visible])

  function handleClose() {
    if (saving) return
    setError('')
    onClose?.()
  }

  async function handleSave() {
    if (!String(form.code || '').trim()) {
      setError('Mã đề là bắt buộc')
      return
    }
    if (!String(form.name || '').trim()) {
      setError('Tên đề là bắt buộc')
      return
    }

    try {
      await onSubmit?.({
        code: String(form.code || '').trim(),
        name: String(form.name || '').trim(),
        description: String(form.description || '').trim() || null,
        assessmentType: form.assessmentType,
        subject: form.subject || null,
        status: form.status,
      })
      setError('')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được đề'))
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='lg' onClose={handleClose}>
      <CModalHeader>
        <CModalTitle>{assessment ? 'Sửa đề' : 'Tạo đề'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={4}><CFormLabel>Mã đề</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
          <CCol md={8}><CFormLabel>Tên đề</CFormLabel><CFormInput value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Loại đề</CFormLabel><CFormSelect value={form.assessmentType} onChange={(event) => setForm((prev) => ({ ...prev, assessmentType: event.target.value }))}>{['placement', 'diagnostic', 'practice', 'quiz', 'exam', 'other'].map((item) => <option key={item} value={item}>{getAssessmentTypeLabel(item)}</option>)}</CFormSelect></CCol>
          <CCol md={4}><CFormLabel>Môn học</CFormLabel><CFormSelect value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}><option value=''>Không chọn</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
          <CCol md={4}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>{['draft', 'active', 'archived'].map((item) => <option key={item} value={item}>{getAssessmentStatusLabel(item)}</option>)}</CFormSelect></CCol>
          <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={5} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu đề'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
