import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import { getApiMessage } from '../services/assessmentService'
import { getQuestionTypeLabel } from './assessmentUi'

function normalizeForm(item) {
  return {
    order: String(item?.order ?? 0),
    points: String(item?.points ?? 1),
    required: item?.required !== false,
    audioPlayLimit: String(item?.audioPlayLimit ?? ''),
    allowSeek: item?.allowSeek !== false,
    minWords: String(item?.minWords ?? ''),
    maxWords: String(item?.maxWords ?? ''),
    config: item?.config ? JSON.stringify(item.config, null, 2) : '',
  }
}

export default function AssessmentQuestionEditorModal({ visible, saving, item, onClose, onSubmit }) {
  const [form, setForm] = useState(normalizeForm(item))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(normalizeForm(item))
    setError('')
  }, [item, visible])

  function handleClose() {
    if (saving) return
    setError('')
    onClose?.()
  }

  async function handleSave() {
    try {
      await onSubmit?.({
        section: item?.section?.documentId || item?.section?.id || item?.section,
        question: item?.question?.documentId || item?.question?.id,
        order: Number(form.order || 0),
        points: Number(form.points || 1),
        required: form.required,
        audioPlayLimit: form.audioPlayLimit === '' ? null : Number(form.audioPlayLimit),
        allowSeek: form.allowSeek,
        minWords: form.minWords === '' ? null : Number(form.minWords),
        maxWords: form.maxWords === '' ? null : Number(form.maxWords),
        config: form.config ? JSON.parse(form.config) : null,
      })
      setError('')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được cấu hình câu hỏi trong đề'))
    }
  }

  const questionType = item?.question?.type || ''
  const hasAudioStimulus = Boolean(item?.question?.stimulus?.audioAsset)
  const isEssay = questionType === 'essay'

  return (
    <CModal visible={visible} backdrop='static' size='lg' onClose={handleClose}>
      <CModalHeader>
        <CModalTitle>{`Cấu hình câu hỏi trong đề · ${item?.question?.code || ''}`}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <div className='mb-3 small text-body-secondary'>{getQuestionTypeLabel(questionType)}</div>
        <CRow className='g-3'>
          <CCol md={4}><CFormLabel>Thứ tự</CFormLabel><CFormInput type='number' value={form.order} onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Điểm</CFormLabel><CFormInput type='number' value={form.points} onChange={(event) => setForm((prev) => ({ ...prev, points: event.target.value }))} /></CCol>
          <CCol md={4} className='d-flex align-items-end'><CFormCheck label='Bắt buộc' checked={form.required} onChange={(event) => setForm((prev) => ({ ...prev, required: event.target.checked }))} /></CCol>
          {hasAudioStimulus ? <CCol md={6}><CFormLabel>Giới hạn lượt nghe</CFormLabel><CFormInput type='number' value={form.audioPlayLimit} onChange={(event) => setForm((prev) => ({ ...prev, audioPlayLimit: event.target.value }))} /></CCol> : null}
          {hasAudioStimulus ? <CCol md={6} className='d-flex align-items-end'><CFormCheck label='Cho phép tua' checked={form.allowSeek} onChange={(event) => setForm((prev) => ({ ...prev, allowSeek: event.target.checked }))} /></CCol> : null}
          {isEssay ? <CCol md={6}><CFormLabel>Số từ tối thiểu</CFormLabel><CFormInput type='number' value={form.minWords} onChange={(event) => setForm((prev) => ({ ...prev, minWords: event.target.value }))} /></CCol> : null}
          {isEssay ? <CCol md={6}><CFormLabel>Số từ tối đa</CFormLabel><CFormInput type='number' value={form.maxWords} onChange={(event) => setForm((prev) => ({ ...prev, maxWords: event.target.value }))} /></CCol> : null}
          <CCol xs={12}><CFormLabel>Config JSON</CFormLabel><CFormTextarea rows={4} value={form.config} onChange={(event) => setForm((prev) => ({ ...prev, config: event.target.value }))} /></CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
