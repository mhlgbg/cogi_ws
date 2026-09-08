import { useEffect, useState } from 'react'
import { CAlert, CButton, CCard, CCardBody, CFormInput, CFormLabel, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CSpinner } from '@coreui/react'
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'
import { getFileAssetUrl } from '../../learning-management/utils/questionBankUi'
import { uploadStudentAssignmentFile } from '../services/classService'

const ITEM_TYPE_OPTIONS = [
  { value: 'html', label: 'HTML' },
  { value: 'link', label: 'Link' },
  { value: 'image', label: 'Ảnh' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'file', label: 'File' },
]

function buildItem(type = 'html') {
  return {
    type,
    caption: '',
    contentHtml: '<p></p>',
    url: '',
    fileAsset: null,
  }
}

function buildState(task) {
  const latestDraft = Array.isArray(task?.submissions) ? task.submissions.find((item) => item?.status === 'draft') : null
  return {
    submissionId: latestDraft?.id || null,
    comment: String(latestDraft?.comment || '').trim(),
    items: Array.isArray(latestDraft?.items) && latestDraft.items.length > 0
      ? latestDraft.items.map((item) => ({
          type: String(item?.type || 'file').trim() || 'file',
          caption: String(item?.caption || '').trim(),
          contentHtml: String(item?.contentHtml || '').trim() || '<p></p>',
          url: String(item?.url || '').trim(),
          fileAsset: item?.fileAsset || null,
        }))
      : [buildItem(task?.taskType === 'submission' ? 'html' : 'file')],
  }
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function StudentSubmissionEditorModal({ visible = false, saving = false, task = null, learnerId = '', submitError = '', onClose, onSaveDraft, onSubmit }) {
  const [form, setForm] = useState(buildState(task))
  const [uploadingIndex, setUploadingIndex] = useState(-1)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    setForm(buildState(task))
  }, [task, visible])

  function updateItem(index, patch) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }))
  }

  function addItem(type = 'html') {
    setForm((prev) => ({ ...prev, items: [...prev.items, buildItem(type)] }))
  }

  function removeItem(index) {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  function buildPayload() {
    return {
      submissionId: form.submissionId || undefined,
      comment: form.comment,
      items: form.items.map((item) => ({
        type: item.type,
        caption: item.caption,
        contentHtml: item.type === 'html' ? item.contentHtml : undefined,
        url: item.type === 'link' ? item.url : undefined,
        fileAsset: ['image', 'video', 'audio', 'file'].includes(item.type) ? item.fileAsset?.id : undefined,
      })),
    }
  }

  return (
    <>
      <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl'>
        <CModalHeader>
          <CModalTitle>Nộp bài: {task?.title || 'Task nộp bài'}</CModalTitle>
        </CModalHeader>
        <CModalBody className='d-flex flex-column gap-3'>
          {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}

          <div>
            <CFormLabel>Ghi chú</CFormLabel>
            <CFormInput value={form.comment} onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))} disabled={saving} />
          </div>

          <div className='d-flex flex-wrap gap-2'>
            {ITEM_TYPE_OPTIONS.map((option) => (
              <CButton key={option.value} color='secondary' variant='outline' size='sm' onClick={() => addItem(option.value)} disabled={saving}>Thêm {option.label}</CButton>
            ))}
          </div>

          {form.items.map((item, index) => {
            const assetUrl = item?.fileAsset ? getFileAssetUrl(item.fileAsset) : ''
            return (
              <CCard key={`submission-item-${index}`} className='border-0 shadow-sm'>
                <CCardBody className='d-flex flex-column gap-3'>
                  <div className='d-flex justify-content-between align-items-center gap-2'>
                    <strong>Item {index + 1}</strong>
                    <div className='d-flex gap-2'>
                      <CFormSelect value={item.type} onChange={(event) => updateItem(index, { type: event.target.value, fileAsset: null, url: '', contentHtml: '<p></p>' })} disabled={saving} style={{ minWidth: 160 }}>
                        {ITEM_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </CFormSelect>
                      <CButton color='danger' variant='outline' size='sm' onClick={() => removeItem(index)} disabled={saving || form.items.length === 1}>Xóa</CButton>
                    </div>
                  </div>

                  <div>
                    <CFormLabel>Caption</CFormLabel>
                    <CFormInput value={item.caption} onChange={(event) => updateItem(index, { caption: event.target.value })} disabled={saving} />
                  </div>

                  {item.type === 'html' ? <SimpleHtmlEditor value={item.contentHtml} onChange={(value) => updateItem(index, { contentHtml: value })} disabled={saving} rows={6} showImageControls={false} showColorControls={false} allowHtmlMode helperText='HTML nội dung bài nộp sẽ được sanitize an toàn.' /> : null}

                  {item.type === 'link' ? (
                    <div>
                      <CFormLabel>Link</CFormLabel>
                      <CFormInput value={item.url} onChange={(event) => updateItem(index, { url: event.target.value })} placeholder='https://...' disabled={saving} />
                    </div>
                  ) : null}

                  {['image', 'video', 'audio', 'file'].includes(item.type) ? (
                    <div className='d-flex flex-column gap-2'>
                      <div className='d-flex gap-2 align-items-center flex-wrap'>
                        <CFormInput type='file' onChange={async (event) => {
                          const file = event.target.files?.[0] || null
                          if (!file || !task?.id) return
                          setUploadError('')
                          setUploadingIndex(index)
                          try {
                            const uploaded = await uploadStudentAssignmentFile(task.id, file, { learnerId })
                            updateItem(index, { fileAsset: uploaded })
                          } catch (requestError) {
                            setUploadError(getApiMessage(requestError, 'Không thể upload file bài nộp.'))
                          } finally {
                            setUploadingIndex(-1)
                            event.target.value = ''
                          }
                        }} disabled={saving || uploadingIndex === index} />
                        {uploadingIndex === index ? <span className='small text-body-secondary d-inline-flex align-items-center gap-2'><CSpinner size='sm' />Đang upload...</span> : null}
                        <span className='small text-body-secondary'>{item?.fileAsset?.originalName || item?.fileAsset?.fileName || 'Chưa chọn file'}</span>
                      </div>
                      {item.type === 'image' && assetUrl ? <img src={assetUrl} alt={item?.caption || 'submission'} style={{ maxWidth: 220, borderRadius: 8 }} /> : null}
                      {item.type === 'audio' && assetUrl ? <audio controls preload='none' src={assetUrl} style={{ width: '100%' }} /> : null}
                      {item.type === 'video' && assetUrl ? <video controls preload='metadata' src={assetUrl} style={{ width: '100%', maxHeight: 260, borderRadius: 8 }} /> : null}
                      {item.type === 'file' && item?.fileAsset ? <a href={assetUrl} target='_blank' rel='noreferrer'>{item.fileAsset.originalName || item.fileAsset.fileName || 'Mở file'}</a> : null}
                    </div>
                  ) : null}
                </CCardBody>
              </CCard>
            )
          })}
          {uploadError ? <CAlert color='danger'>{uploadError}</CAlert> : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={saving}>Đóng</CButton>
          <CButton color='secondary' variant='outline' onClick={() => onSaveDraft?.(buildPayload())} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu nháp'}</CButton>
          <CButton color='primary' onClick={() => onSubmit?.(buildPayload())} disabled={saving}>{saving ? 'Đang nộp...' : 'Nộp bài'}</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}