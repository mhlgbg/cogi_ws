import { useEffect, useState } from 'react'
import { CAlert, CButton, CCol, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow } from '@coreui/react'
import { getApiMessage } from '../services/assessmentCampaignService'

function emptyForm() {
  return { code: '', name: '', gradeFrom: '', gradeTo: '', assessmentVersion: '', priority: '1', status: 'draft', ageFrom: '', ageTo: '', conditions: '' }
}

function normalizeForm(rule) {
  return {
    code: rule?.code || '',
    name: rule?.name || '',
    gradeFrom: rule?.gradeFrom ?? '',
    gradeTo: rule?.gradeTo ?? '',
    assessmentVersion: rule?.assessmentVersion?.id || rule?.assessmentVersion?.documentId || '',
    priority: String(rule?.priority ?? 1),
    status: rule?.status || 'draft',
    ageFrom: rule?.ageFrom ?? '',
    ageTo: rule?.ageTo ?? '',
    conditions: rule?.conditions ? JSON.stringify(rule.conditions, null, 2) : '',
  }
}

export default function AssessmentCampaignRuleEditorModal({ visible, saving, rule, assessmentVersions = [], onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(rule ? normalizeForm(rule) : emptyForm())
    setError('')
  }, [rule, visible])

  function handleClose() {
    if (saving) return
    setError('')
    onClose?.()
  }

  async function handleSave() {
    if (!String(form.code || '').trim()) return setError('Code rule là bắt buộc')
    if (!String(form.name || '').trim()) return setError('Tên rule là bắt buộc')
    if (!String(form.assessmentVersion || '').trim()) return setError('Assessment Version là bắt buộc')
    try {
      await onSubmit?.({
        code: String(form.code || '').trim(),
        name: String(form.name || '').trim(),
        gradeFrom: form.gradeFrom === '' ? null : Number(form.gradeFrom),
        gradeTo: form.gradeTo === '' ? null : Number(form.gradeTo),
        assessmentVersion: form.assessmentVersion,
        priority: Number(form.priority || 0),
        status: form.status,
        ageFrom: form.ageFrom === '' ? null : Number(form.ageFrom),
        ageTo: form.ageTo === '' ? null : Number(form.ageTo),
        conditions: String(form.conditions || '').trim() ? form.conditions : null,
      })
    } catch (requestError) {
      const fallback = /overlap/i.test(String(requestError?.response?.data?.error?.message || '')) ? 'Khoảng lớp này chồng lấn với một rule đang hoạt động.' : 'Không lưu được rule phân đề'
      setError(getApiMessage(requestError, fallback))
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='lg' onClose={handleClose}>
      <CModalHeader><CModalTitle>{rule ? 'Sửa rule phân đề' : 'Thêm rule phân đề'}</CModalTitle></CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
          <CCol md={5}><CFormLabel>Tên rule</CFormLabel><CFormInput value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></CCol>
          <CCol md={3}><CFormLabel>Priority</CFormLabel><CFormInput type='number' value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))} /></CCol>
          <CCol md={3}><CFormLabel>Lớp từ</CFormLabel><CFormInput type='number' value={form.gradeFrom} onChange={(event) => setForm((prev) => ({ ...prev, gradeFrom: event.target.value }))} /></CCol>
          <CCol md={3}><CFormLabel>Lớp đến</CFormLabel><CFormInput type='number' value={form.gradeTo} onChange={(event) => setForm((prev) => ({ ...prev, gradeTo: event.target.value }))} /></CCol>
          <CCol md={6}><CFormLabel>Assessment Version</CFormLabel><CFormSelect value={form.assessmentVersion} onChange={(event) => setForm((prev) => ({ ...prev, assessmentVersion: event.target.value }))}><option value=''>Chọn version</option>{assessmentVersions.map((item) => <option key={item.id || item.documentId} value={item.id || item.documentId}>{`${item.code} · ${item.title || item.assessment?.name || ''}`}</option>)}</CFormSelect></CCol>
          <CCol md={4}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}><option value='draft'>Bản nháp</option><option value='active'>Hoạt động</option><option value='inactive'>Ngưng dùng</option></CFormSelect></CCol>
          <CCol md={4}><CFormLabel>Age from</CFormLabel><CFormInput type='number' value={form.ageFrom} onChange={(event) => setForm((prev) => ({ ...prev, ageFrom: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Age to</CFormLabel><CFormInput type='number' value={form.ageTo} onChange={(event) => setForm((prev) => ({ ...prev, ageTo: event.target.value }))} /></CCol>
          <CCol xs={12}><CFormLabel>Conditions (JSON)</CFormLabel><CFormTextarea rows={4} value={form.conditions} onChange={(event) => setForm((prev) => ({ ...prev, conditions: event.target.value }))} /></CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu rule'}</CButton>
      </CModalFooter>
    </CModal>
  )
}