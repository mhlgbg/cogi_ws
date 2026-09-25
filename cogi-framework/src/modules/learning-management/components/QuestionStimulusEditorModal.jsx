import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CButtonGroup,
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
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'
import FileAssetPickerModal from './FileAssetPickerModal'
import StimulusPreview from './StimulusPreview'
import { STIMULUS_CONTENT_TYPE_OPTIONS, normalizeStimulusContentType } from './StimulusContent'
import { getApiMessage, getEntityId, getFileAssetUrl, getStimulusTypeLabel } from '../utils/questionBankUi'

function buildEmptyStimulusForm() {
  return {
    code: '',
    title: '',
    type: 'text',
    instruction: '',
    content: '',
    contentType: 'plain_text',
    audioAsset: null,
    imageAsset: null,
    stimulusStatus: 'draft',
  }
}

function normalizeStimulusForm(stimulus) {
  return {
    code: stimulus?.code || '',
    title: stimulus?.title || '',
    type: stimulus?.type || 'text',
    instruction: stimulus?.instruction || '',
    content: stimulus?.content || '',
    contentType: normalizeStimulusContentType(stimulus?.contentType),
    audioAsset: stimulus?.audioAsset || null,
    imageAsset: stimulus?.imageAsset || null,
    stimulusStatus: stimulus?.stimulusStatus || 'draft',
  }
}

function toStimulusPayload(form) {
  return {
    code: String(form.code || '').trim(),
    title: String(form.title || '').trim() || null,
    type: String(form.type || 'text').trim(),
    instruction: String(form.instruction || '').trim() || null,
    content: String(form.content || '').trim() || null,
    contentType: normalizeStimulusContentType(form.contentType),
    audioAsset: form.audioAsset ? (form.audioAsset.documentId || form.audioAsset.id) : null,
    imageAsset: form.imageAsset ? (form.imageAsset.documentId || form.imageAsset.id) : null,
    stimulusStatus: String(form.stimulusStatus || 'draft').trim() || 'draft',
  }
}

export default function QuestionStimulusEditorModal({
  visible,
  saving,
  editingStimulus,
  initialValues,
  notice,
  readOnly = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => editingStimulus ? normalizeStimulusForm(editingStimulus) : initialValues ? normalizeStimulusForm(initialValues) : buildEmptyStimulusForm())
  const [error, setError] = useState('')
  const [pickerMode, setPickerMode] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(editingStimulus ? normalizeStimulusForm(editingStimulus) : initialValues ? normalizeStimulusForm(initialValues) : buildEmptyStimulusForm())
    setError('')
    setPickerMode('')
  }, [editingStimulus, initialValues, visible])

  function handleClose() {
    if (saving) return
    setError('')
    setPickerMode('')
    onClose?.()
  }

  async function handleSave() {
    if (readOnly) return
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
          <CModalTitle>{readOnly ? 'Xem stimulus' : editingStimulus ? 'Sửa stimulus' : 'Tạo stimulus'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
            {notice ? <CAlert color='info'>{notice}</CAlert> : null}
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          <CRow className='g-3'>
            <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} disabled={saving || readOnly} /></CCol>
            <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} disabled={saving || readOnly} /></CCol>
            <CCol md={4}><CFormLabel>Type</CFormLabel><CFormSelect value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} disabled={saving || readOnly}>{['text', 'audio', 'image', 'mixed'].map((item) => <option key={item} value={item}>{getStimulusTypeLabel(item)}</option>)}</CFormSelect></CCol>
            <CCol md={4}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.stimulusStatus} onChange={(event) => setForm((prev) => ({ ...prev, stimulusStatus: event.target.value }))} disabled={saving || readOnly}>{['draft', 'active', 'archived'].map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={4}><CFormLabel>Số câu hỏi đang dùng</CFormLabel><CFormInput value={editingStimulus?.usageCount ?? 0} disabled /></CCol>
            <CCol xs={12}><CFormLabel>Instruction</CFormLabel><CFormTextarea rows={3} value={form.instruction} onChange={(event) => setForm((prev) => ({ ...prev, instruction: event.target.value }))} disabled={saving || readOnly} /></CCol>
            <CCol xs={12}>
              <div className='d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2'>
                <CFormLabel className='mb-0'>Content</CFormLabel>
                <CButtonGroup size='sm' role='group' aria-label='Stimulus content type'>
                  {STIMULUS_CONTENT_TYPE_OPTIONS.map((item) => (
                    <CButton
                      key={item.value}
                      type='button'
                      color={normalizeStimulusContentType(form.contentType) === item.value ? 'primary' : 'secondary'}
                      variant={normalizeStimulusContentType(form.contentType) === item.value ? undefined : 'outline'}
                      onClick={() => setForm((prev) => ({ ...prev, contentType: item.value }))}
                      disabled={saving || readOnly}
                    >
                      {item.label}
                    </CButton>
                  ))}
                </CButtonGroup>
              </div>
              {normalizeStimulusContentType(form.contentType) === 'html' ? (
                <SimpleHtmlEditor
                  label=''
                  value={form.content}
                  onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
                  disabled={saving || readOnly}
                  rows={10}
                  showImageControls={false}
                  allowHtmlMode
                  helperText='Ho tro HTML don gian cho bai doc dai. Noi dung se duoc sanitize an toan khi luu va khi render.'
                  placeholder='<h2 style="text-align:center;">Baking</h2><p>My grandmother loves making bread and cakes...</p>'
                />
              ) : (
                <>
                  <CFormTextarea rows={8} value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} disabled={saving || readOnly} />
                  <div className='small text-body-secondary mt-1'>Che do van ban thuan giu nguyen xuong dong va khong render the HTML.</div>
                </>
              )}
            </CCol>
            {(form.type === 'audio' || form.type === 'mixed') ? (
              <CCol xs={12} md={6}>
                <CFormLabel>Audio Asset</CFormLabel>
                {!readOnly ? (
                  <div className='d-flex gap-2 mb-2'>
                    <CButton color='secondary' variant='outline' onClick={() => setPickerMode('audio')} disabled={saving}>Chọn / Upload audio</CButton>
                    {form.audioAsset ? <CButton color='danger' variant='outline' onClick={() => setForm((prev) => ({ ...prev, audioAsset: null }))} disabled={saving}>Bỏ audio</CButton> : null}
                  </div>
                ) : null}
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
                {!readOnly ? (
                  <div className='d-flex gap-2 mb-2'>
                    <CButton color='secondary' variant='outline' onClick={() => setPickerMode('image')} disabled={saving}>Chọn / Upload hình</CButton>
                    {form.imageAsset ? <CButton color='danger' variant='outline' onClick={() => setForm((prev) => ({ ...prev, imageAsset: null }))} disabled={saving}>Bỏ hình</CButton> : null}
                  </div>
                ) : null}
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
          {!readOnly ? <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu stimulus'}</CButton> : null}
        </CModalFooter>
      </CModal>

      {!readOnly ? (
        <>
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
      ) : null}
    </>
  )
}
