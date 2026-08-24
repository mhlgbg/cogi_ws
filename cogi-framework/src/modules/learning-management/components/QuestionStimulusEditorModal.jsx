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
import FileAssetPickerModal from './FileAssetPickerModal'
import StimulusPreview from './StimulusPreview'
import { getApiMessage, getEntityId, getFileAssetUrl, getStimulusTypeLabel } from '../utils/questionBankUi'

function buildEmptyStimulusForm() {
  return {
    code: '',
    title: '',
    type: 'text',
    instruction: '',
    content: '',
    audioAsset: null,
    imageAsset: null,
    stimulusStatus: 'draft',
  }
}

export function normalizeStimulusForm(stimulus) {
  return {
    code: stimulus?.code || '',
    title: stimulus?.title || '',
    type: stimulus?.type || 'text',
    instruction: stimulus?.instruction || '',
    content: stimulus?.content || '',
    audioAsset: stimulus?.audioAsset || null,
    imageAsset: stimulus?.imageAsset || null,
    stimulusStatus: stimulus?.stimulusStatus || 'draft',
  }
}

export function toStimulusPayload(form) {
  return {
    code: String(form.code || '').trim(),
    title: String(form.title || '').trim() || null,
    type: String(form.type || 'text').trim(),
    instruction: String(form.instruction || '').trim() || null,
    content: String(form.content || '').trim() || null,
    audioAsset: form.audioAsset ? (form.audioAsset.documentId || form.audioAsset.id) : null,
    imageAsset: form.imageAsset ? (form.imageAsset.documentId || form.imageAsset.id) : null,
    stimulusStatus: String(form.stimulusStatus || 'draft').trim() || 'draft',
  }
}

export default function QuestionStimulusEditorModal({
  visible,
  saving,
  editingStimulus,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(buildEmptyStimulusForm())
  const [error, setError] = useState('')
  const [pickerMode, setPickerMode] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(editingStimulus ? normalizeStimulusForm(editingStimulus) : buildEmptyStimulusForm())
    setError('')
  }, [editingStimulus, visible])

  function handleClose() {
    if (saving) return
    setError('')
    setPickerMode('')
    onClose?.()
  }

  async function handleSave() {
    if (!String(form.code || '').trim()) {
      setError('Code là bắt buộc')
      return
    }
    try {
      await onSubmit?.(toStimulusPayload(form), form)
      setError('')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được stimulus'))
    }
  }

  const audioUrl = getFileAssetUrl(form.audioAsset)
  const imageUrl = getFileAssetUrl(form.imageAsset)

  return (
    <>
      <CModal visible={visible} backdrop='static' size='xl' onClose={handleClose}>
        <CModalHeader>
          <CModalTitle>{editingStimulus ? 'Sửa stimulus' : 'Tạo stimulus'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          <CRow className='g-3'>
            <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} disabled={saving} /></CCol>
            <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} disabled={saving} /></CCol>
            <CCol md={4}><CFormLabel>Type</CFormLabel><CFormSelect value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} disabled={saving}>{['text', 'audio', 'image', 'mixed'].map((item) => <option key={item} value={item}>{getStimulusTypeLabel(item)}</option>)}</CFormSelect></CCol>
            <CCol md={4}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.stimulusStatus} onChange={(event) => setForm((prev) => ({ ...prev, stimulusStatus: event.target.value }))} disabled={saving}>{['draft', 'active', 'archived'].map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={4}><CFormLabel>Số câu hỏi đang dùng</CFormLabel><CFormInput value={editingStimulus?.usageCount ?? 0} disabled /></CCol>
            <CCol xs={12}><CFormLabel>Instruction</CFormLabel><CFormTextarea rows={3} value={form.instruction} onChange={(event) => setForm((prev) => ({ ...prev, instruction: event.target.value }))} disabled={saving} /></CCol>
            {(form.type === 'text' || form.type === 'mixed') ? <CCol xs={12}><CFormLabel>Content</CFormLabel><CFormTextarea rows={6} value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} disabled={saving} /></CCol> : null}
            {(form.type === 'audio' || form.type === 'mixed') ? (
              <CCol xs={12} md={6}>
                <CFormLabel>Audio Asset</CFormLabel>
                <div className='d-flex gap-2 mb-2'>
                  <CButton color='secondary' variant='outline' onClick={() => setPickerMode('audio')} disabled={saving}>Chọn / Upload audio</CButton>
                  {form.audioAsset ? <CButton color='danger' variant='outline' onClick={() => setForm((prev) => ({ ...prev, audioAsset: null }))} disabled={saving}>Bỏ audio</CButton> : null}
                </div>
                {form.audioAsset ? (
                  <div className='border rounded-3 p-3 bg-body-tertiary'>
                    <div className='fw-semibold'>{form.audioAsset.originalName || form.audioAsset.fileName || '-'}</div>
                    <div className='small text-body-secondary mb-2'>{form.audioAsset.code || '-'}</div>
                    {audioUrl ? <audio controls preload='none' src={audioUrl} style={{ width: '100%' }} /> : null}
                  </div>
                ) : <div className='small text-body-secondary'>Chưa chọn audio asset.</div>}
              </CCol>
            ) : null}
            {(form.type === 'image' || form.type === 'mixed') ? (
              <CCol xs={12} md={6}>
                <CFormLabel>Image Asset</CFormLabel>
                <div className='d-flex gap-2 mb-2'>
                  <CButton color='secondary' variant='outline' onClick={() => setPickerMode('image')} disabled={saving}>Chọn / Upload hình</CButton>
                  {form.imageAsset ? <CButton color='danger' variant='outline' onClick={() => setForm((prev) => ({ ...prev, imageAsset: null }))} disabled={saving}>Bỏ hình</CButton> : null}
                </div>
                {form.imageAsset ? (
                  <div className='border rounded-3 p-3 bg-body-tertiary'>
                    <div className='fw-semibold'>{form.imageAsset.originalName || form.imageAsset.fileName || '-'}</div>
                    <div className='small text-body-secondary mb-2'>{form.imageAsset.code || '-'}</div>
                    {imageUrl ? <img src={imageUrl} alt={form.imageAsset.originalName || 'stimulus image'} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 12 }} /> : null}
                  </div>
                ) : <div className='small text-body-secondary'>Chưa chọn image asset.</div>}
              </CCol>
            ) : null}
            <CCol xs={12}>
              <CFormLabel>Xem trước</CFormLabel>
              <StimulusPreview stimulus={{ ...form, id: getEntityId(editingStimulus) || 'preview', questions: editingStimulus?.questions || [], usageCount: editingStimulus?.usageCount || 0 }} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
          <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu stimulus'}</CButton>
        </CModalFooter>
      </CModal>

      <FileAssetPickerModal
        visible={pickerMode === 'audio'}
        acceptedKind='audio'
        title='Chọn audio asset'
        moduleKey='question-bank'
        onClose={() => setPickerMode('')}
        onSelect={(fileAsset) => setForm((prev) => ({ ...prev, audioAsset: fileAsset }))}
      />
      <FileAssetPickerModal
        visible={pickerMode === 'image'}
        acceptedKind='image'
        title='Chọn image asset'
        moduleKey='question-bank'
        onClose={() => setPickerMode('')}
        onSelect={(fileAsset) => setForm((prev) => ({ ...prev, imageAsset: fileAsset }))}
      />
    </>
  )
}
