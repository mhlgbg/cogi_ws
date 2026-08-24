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
import { getApiMessage } from '../services/assessmentService'
import { getEntityId } from '../../learning-management/utils/questionBankUi'

function emptyForm() {
  return {
    code: '',
    title: '',
    description: '',
    instruction: '',
    order: '0',
    skill: '',
  }
}

function normalizeForm(section) {
  return {
    code: section?.code || '',
    title: section?.title || '',
    description: section?.description || '',
    instruction: section?.instruction || '',
    order: String(section?.order ?? 0),
    skill: getEntityId(section?.skill),
  }
}

export default function AssessmentSectionEditorModal({ visible, saving, section, versionId, skills = [], onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(section ? normalizeForm(section) : emptyForm())
    setError('')
  }, [section, visible])

  function handleClose() {
    if (saving) return
    setError('')
    onClose?.()
  }

  async function handleSave() {
    if (!String(form.code || '').trim()) {
      setError('Mã phần là bắt buộc')
      return
    }
    if (!String(form.title || '').trim()) {
      setError('Tên phần là bắt buộc')
      return
    }
    try {
      await onSubmit?.({
        assessmentVersion: versionId,
        code: String(form.code || '').trim(),
        title: String(form.title || '').trim(),
        description: String(form.description || '').trim() || null,
        instruction: String(form.instruction || '').trim() || null,
        order: Number(form.order || 0),
        skill: form.skill || null,
      })
      setError('')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được phần thi'))
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='lg' onClose={handleClose}>
      <CModalHeader>
        <CModalTitle>{section ? 'Sửa phần thi' : 'Tạo phần thi'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={4}><CFormLabel>Mã phần</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
          <CCol md={8}><CFormLabel>Tên phần</CFormLabel><CFormInput value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Thứ tự</CFormLabel><CFormInput type='number' value={form.order} onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))} /></CCol>
          <CCol md={8}><CFormLabel>Kỹ năng</CFormLabel><CFormSelect value={form.skill} onChange={(event) => setForm((prev) => ({ ...prev, skill: event.target.value }))}><option value=''>Không chọn</option>{skills.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
          <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={3} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
          <CCol xs={12}><CFormLabel>Hướng dẫn</CFormLabel><CFormTextarea rows={4} value={form.instruction} onChange={(event) => setForm((prev) => ({ ...prev, instruction: event.target.value }))} /></CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu phần'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
