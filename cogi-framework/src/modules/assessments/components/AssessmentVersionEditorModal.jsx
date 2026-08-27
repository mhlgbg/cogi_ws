import { useEffect, useState } from 'react'
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
import { getApiMessage } from '../services/assessmentService'
import { getCefrLabel, getResultModeLabel, getVersionStatusLabel } from './assessmentUi'

const CEFR_LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function getVersionEditorErrorMessage(error) {
  const message = getApiMessage(error, 'Không lưu được phiên bản')
  if (message === 'PUBLISHED_VERSION_STRUCTURAL_UPDATE_NOT_ALLOWED') return 'Phiên bản đã phát hành chỉ cho phép chỉnh sửa thông tin mô tả. Hãy tạo phiên bản mới nếu cần thay đổi cấu hình bài thi.'
  if (message === 'Retired assessment versions cannot be modified.') return 'Phiên bản đã ngừng sử dụng hiện không cho phép chỉnh sửa.'
  return message
}

function emptyForm() {
  return {
    code: '',
    version: '1',
    title: '',
    description: '',
    durationMinutes: '',
    gradeFrom: '',
    gradeTo: '',
    candidateLevelFrom: '',
    candidateLevelTo: '',
    resultMode: 'provisional',
    requiresSpeaking: true,
    requiresTeacherConfirmation: true,
    ceilingLevel: '',
    instructions: '',
  }
}

function normalizeForm(version) {
  return {
    code: version?.code || '',
    version: String(version?.version ?? 1),
    title: version?.title || '',
    description: version?.description || '',
    durationMinutes: String(version?.durationMinutes ?? ''),
    gradeFrom: String(version?.gradeFrom ?? ''),
    gradeTo: String(version?.gradeTo ?? ''),
    candidateLevelFrom: version?.candidateLevelFrom || '',
    candidateLevelTo: version?.candidateLevelTo || '',
    resultMode: version?.resultMode || 'provisional',
    requiresSpeaking: version?.requiresSpeaking !== false,
    requiresTeacherConfirmation: version?.requiresTeacherConfirmation !== false,
    ceilingLevel: version?.ceilingLevel || '',
    instructions: version?.instructions || '',
  }
}

export default function AssessmentVersionEditorModal({ visible, saving, mode = 'create', assessment, version, onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const versionStatus = String(version?.versionStatus || 'draft').trim()
  const metadataOnlyMode = mode === 'edit' && versionStatus === 'published'
  const retiredReadOnlyMode = mode === 'edit' && versionStatus === 'retired'
  const structuralFieldsDisabled = metadataOnlyMode || retiredReadOnlyMode

  useEffect(() => {
    if (!visible) return
    setForm(version ? normalizeForm(version) : emptyForm())
    setError('')
  }, [version, visible])

  function handleClose() {
    if (saving) return
    setError('')
    onClose?.()
  }

  async function handleSave() {
    if (!metadataOnlyMode && !String(form.code || '').trim()) {
      setError('Mã phiên bản là bắt buộc')
      return
    }
    if (!String(form.title || '').trim()) {
      setError('Tên phiên bản là bắt buộc')
      return
    }
    if (retiredReadOnlyMode) {
      setError('Phiên bản đã ngừng sử dụng hiện không cho phép chỉnh sửa.')
      return
    }
    try {
      await onSubmit?.(metadataOnlyMode
        ? {
          title: String(form.title || '').trim(),
          description: String(form.description || '').trim() || null,
          instructions: String(form.instructions || '').trim() || null,
        }
        : {
          code: String(form.code || '').trim(),
          version: Number(form.version || 1),
          title: String(form.title || '').trim(),
          description: String(form.description || '').trim() || null,
          assessment: assessment?.documentId || assessment?.id,
          versionStatus: version?.versionStatus || 'draft',
          durationMinutes: form.durationMinutes === '' ? null : Number(form.durationMinutes),
          gradeFrom: form.gradeFrom === '' ? null : Number(form.gradeFrom),
          gradeTo: form.gradeTo === '' ? null : Number(form.gradeTo),
          candidateLevelFrom: form.candidateLevelFrom || null,
          candidateLevelTo: form.candidateLevelTo || null,
          resultMode: form.resultMode,
          requiresSpeaking: form.requiresSpeaking,
          requiresTeacherConfirmation: form.requiresTeacherConfirmation,
          ceilingLevel: form.ceilingLevel || null,
          instructions: String(form.instructions || '').trim() || null,
        })
      setError('')
    } catch (requestError) {
      setError(getVersionEditorErrorMessage(requestError))
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='xl' onClose={handleClose}>
      <CModalHeader>
        <CModalTitle>{mode === 'clone' ? 'Nhân bản phiên bản' : version ? 'Sửa phiên bản' : 'Tạo phiên bản'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {metadataOnlyMode ? <CAlert color='info'>Phiên bản đã phát hành. Bạn có thể chỉnh sửa tiêu đề, mô tả và hướng dẫn. Các cấu hình ảnh hưởng đến bài thi đã được khóa.</CAlert> : null}
        {retiredReadOnlyMode ? <CAlert color='warning'>Phiên bản đã ngừng sử dụng và hiện không cho phép chỉnh sửa. Hãy nhân bản để tạo phiên bản mới nếu cần cập nhật.</CAlert> : null}
        {metadataOnlyMode ? <div className='small text-body-secondary mb-3'>Cần thay đổi thời lượng, đối tượng, cấu trúc hoặc quy tắc? Hãy nhân bản để tạo phiên bản mới.</div> : null}
        <CRow className='g-3'>
          <CCol md={4}><CFormLabel>Mã phiên bản</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} disabled={structuralFieldsDisabled} /></CCol>
          <CCol md={2}><CFormLabel>Version</CFormLabel><CFormInput type='number' value={form.version} onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))} disabled={structuralFieldsDisabled} /></CCol>
          <CCol md={6}><CFormLabel>Tiêu đề</CFormLabel><CFormInput value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} disabled={retiredReadOnlyMode} /></CCol>
          <CCol md={3}><CFormLabel>Thời lượng (phút)</CFormLabel><CFormInput type='number' value={form.durationMinutes} onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))} disabled={structuralFieldsDisabled} /></CCol>
          <CCol md={3}><CFormLabel>Từ lớp</CFormLabel><CFormInput type='number' value={form.gradeFrom} onChange={(event) => setForm((prev) => ({ ...prev, gradeFrom: event.target.value }))} disabled={structuralFieldsDisabled} /></CCol>
          <CCol md={3}><CFormLabel>Đến lớp</CFormLabel><CFormInput type='number' value={form.gradeTo} onChange={(event) => setForm((prev) => ({ ...prev, gradeTo: event.target.value }))} disabled={structuralFieldsDisabled} /></CCol>
          <CCol md={3}><CFormLabel>Kết quả</CFormLabel><CFormSelect value={form.resultMode} onChange={(event) => setForm((prev) => ({ ...prev, resultMode: event.target.value }))} disabled={structuralFieldsDisabled}>{['provisional', 'final'].map((item) => <option key={item} value={item}>{getResultModeLabel(item)}</option>)}</CFormSelect></CCol>
          <CCol md={3}><CFormLabel>CEFR từ</CFormLabel><CFormSelect value={form.candidateLevelFrom} onChange={(event) => setForm((prev) => ({ ...prev, candidateLevelFrom: event.target.value }))} disabled={structuralFieldsDisabled}><option value=''>Không chọn</option>{CEFR_LEVELS.map((item) => <option key={item} value={item}>{getCefrLabel(item)}</option>)}</CFormSelect></CCol>
          <CCol md={3}><CFormLabel>CEFR đến</CFormLabel><CFormSelect value={form.candidateLevelTo} onChange={(event) => setForm((prev) => ({ ...prev, candidateLevelTo: event.target.value }))} disabled={structuralFieldsDisabled}><option value=''>Không chọn</option>{CEFR_LEVELS.map((item) => <option key={item} value={item}>{getCefrLabel(item)}</option>)}</CFormSelect></CCol>
          <CCol md={3}><CFormLabel>Ceiling</CFormLabel><CFormSelect value={form.ceilingLevel} onChange={(event) => setForm((prev) => ({ ...prev, ceilingLevel: event.target.value }))} disabled={structuralFieldsDisabled}><option value=''>Không chọn</option>{CEFR_LEVELS.map((item) => <option key={item} value={item}>{getCefrLabel(item)}</option>)}</CFormSelect></CCol>
          <CCol md={3}><CFormLabel>Trạng thái</CFormLabel><CFormInput value={getVersionStatusLabel(version?.versionStatus || 'draft')} disabled /></CCol>
          <CCol md={6}><CFormCheck label='Yêu cầu Speaking' checked={form.requiresSpeaking} onChange={(event) => setForm((prev) => ({ ...prev, requiresSpeaking: event.target.checked }))} disabled={structuralFieldsDisabled} /></CCol>
          <CCol md={6}><CFormCheck label='Yêu cầu giáo viên xác nhận' checked={form.requiresTeacherConfirmation} onChange={(event) => setForm((prev) => ({ ...prev, requiresTeacherConfirmation: event.target.checked }))} disabled={structuralFieldsDisabled} /></CCol>
          <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={3} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} disabled={retiredReadOnlyMode} /></CCol>
          <CCol xs={12}><CFormLabel>Hướng dẫn chung</CFormLabel><CFormTextarea rows={5} value={form.instructions} onChange={(event) => setForm((prev) => ({ ...prev, instructions: event.target.value }))} disabled={retiredReadOnlyMode} /></CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving || retiredReadOnlyMode}>{saving ? 'Đang lưu...' : mode === 'clone' ? 'Nhân bản' : 'Lưu phiên bản'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
