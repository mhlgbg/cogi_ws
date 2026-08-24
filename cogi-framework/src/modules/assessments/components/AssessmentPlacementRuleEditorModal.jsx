import { useEffect, useState } from 'react'
import { CAlert, CButton, CCol, CFormInput, CFormLabel, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow } from '@coreui/react'
import { getApiMessage } from '../services/assessmentService'
import { getCefrLabel } from './assessmentUi'

const CEFR_LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function emptyForm(versionId) {
  return {
    assessmentVersion: versionId || '',
    code: '',
    label: '',
    order: '1',
    ruleType: 'percentage',
    scoreBasis: 'objective_only',
    minPercentage: '',
    maxPercentage: '',
    minRawScore: '',
    maxRawScore: '',
    level: '',
    status: 'active',
  }
}

function normalizeForm(rule, versionId) {
  return {
    assessmentVersion: versionId || rule?.assessmentVersion?.id || '',
    code: rule?.code || '',
    label: rule?.label || '',
    order: String(rule?.order ?? 1),
    ruleType: rule?.ruleType || 'percentage',
    scoreBasis: rule?.scoreBasis || 'objective_only',
    minPercentage: rule?.minPercentage ?? '',
    maxPercentage: rule?.maxPercentage ?? '',
    minRawScore: rule?.minRawScore ?? '',
    maxRawScore: rule?.maxRawScore ?? '',
    level: rule?.level || '',
    status: rule?.status || 'active',
  }
}

export default function AssessmentPlacementRuleEditorModal({ visible, saving, versionId, rule, onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm(versionId))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(rule ? normalizeForm(rule, versionId) : emptyForm(versionId))
    setError('')
  }, [rule, versionId, visible])

  function handleClose() {
    if (saving) return
    setError('')
    onClose?.()
  }

  async function handleSave() {
    if (!String(form.assessmentVersion || '').trim()) return setError('Không xác định được phiên bản đề hiện tại.')
    if (!String(form.code || '').trim()) return setError('Mã rule là bắt buộc')
    if (!String(form.label || '').trim()) return setError('Tên rule là bắt buộc')
    if (!String(form.level || '').trim()) return setError('Mức CEFR là bắt buộc')
    try {
      await onSubmit?.({
        assessmentVersion: form.assessmentVersion,
        code: String(form.code || '').trim(),
        label: String(form.label || '').trim(),
        order: Number(form.order || 0),
        ruleType: form.ruleType,
        scoreBasis: form.scoreBasis,
        minPercentage: form.ruleType === 'percentage' && form.minPercentage !== '' ? Number(form.minPercentage) : null,
        maxPercentage: form.ruleType === 'percentage' && form.maxPercentage !== '' ? Number(form.maxPercentage) : null,
        minRawScore: form.ruleType === 'raw_score' && form.minRawScore !== '' ? Number(form.minRawScore) : null,
        maxRawScore: form.ruleType === 'raw_score' && form.maxRawScore !== '' ? Number(form.maxRawScore) : null,
        level: form.level,
        status: form.status,
      })
      setError('')
    } catch (requestError) {
      const fallback = /overlap/i.test(String(requestError?.response?.data?.error?.message || ''))
        ? 'Khoảng điểm này chồng lấn với một quy tắc đang hoạt động.'
        : 'Không lưu được quy tắc xếp mức'
      setError(getApiMessage(requestError, fallback))
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='lg' onClose={handleClose}>
      <CModalHeader><CModalTitle>{rule ? 'Sửa quy tắc xếp mức' : 'Thêm quy tắc xếp mức'}</CModalTitle></CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={4}><CFormLabel>Mã</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
          <CCol md={5}><CFormLabel>Nhãn</CFormLabel><CFormInput value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} /></CCol>
          <CCol md={3}><CFormLabel>Thứ tự</CFormLabel><CFormInput type='number' value={form.order} onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Rule type</CFormLabel><CFormSelect value={form.ruleType} onChange={(event) => setForm((prev) => ({ ...prev, ruleType: event.target.value }))}><option value='percentage'>Percentage</option><option value='raw_score'>Raw score</option></CFormSelect></CCol>
          <CCol md={4}><CFormLabel>Score basis</CFormLabel><CFormSelect value={form.scoreBasis} onChange={(event) => setForm((prev) => ({ ...prev, scoreBasis: event.target.value }))}><option value='objective_only'>Objective only</option><option value='scored_total'>Scored total</option><option value='final_total'>Final total</option></CFormSelect></CCol>
          <CCol md={4}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}><option value='active'>Hoạt động</option><option value='inactive'>Ngưng dùng</option></CFormSelect></CCol>
          {form.ruleType === 'percentage' ? (
            <>
              <CCol md={6}><CFormLabel>% tối thiểu</CFormLabel><CFormInput type='number' value={form.minPercentage} onChange={(event) => setForm((prev) => ({ ...prev, minPercentage: event.target.value }))} /></CCol>
              <CCol md={6}><CFormLabel>% tối đa</CFormLabel><CFormInput type='number' value={form.maxPercentage} onChange={(event) => setForm((prev) => ({ ...prev, maxPercentage: event.target.value }))} /></CCol>
            </>
          ) : (
            <>
              <CCol md={6}><CFormLabel>Điểm tối thiểu</CFormLabel><CFormInput type='number' value={form.minRawScore} onChange={(event) => setForm((prev) => ({ ...prev, minRawScore: event.target.value }))} /></CCol>
              <CCol md={6}><CFormLabel>Điểm tối đa</CFormLabel><CFormInput type='number' value={form.maxRawScore} onChange={(event) => setForm((prev) => ({ ...prev, maxRawScore: event.target.value }))} /></CCol>
            </>
          )}
          <CCol md={6}><CFormLabel>Mức</CFormLabel><CFormSelect value={form.level} onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}><option value=''>Chọn mức</option>{CEFR_LEVELS.map((item) => <option key={item} value={item}>{getCefrLabel(item)}</option>)}</CFormSelect></CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu quy tắc'}</CButton>
      </CModalFooter>
    </CModal>
  )
}