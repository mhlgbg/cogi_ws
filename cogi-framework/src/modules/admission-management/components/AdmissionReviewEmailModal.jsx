import {
  CAlert,
  CButton,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import SimpleHtmlEditor from './SimpleHtmlEditor'

function getSelectedFileSummary(file) {
  if (!file) return ''
  const sizeInMb = Number(file.size || 0) / (1024 * 1024)
  return `${file.name} (${sizeInMb.toFixed(sizeInMb >= 10 ? 0 : 1)} MB)`
}

export default function AdmissionReviewEmailModal({
  visible,
  sending,
  loadingTemplates,
  templateError,
  recipientEmail,
  draft,
  templates,
  selectedTemplateKey,
  fileInputKey,
  onClose,
  onTemplateChange,
  onDraftChange,
  onFilesChange,
  onSubmit,
}) {
  const safeTemplates = Array.isArray(templates) ? templates : []
  const files = Array.isArray(draft?.attachments) ? draft.attachments : []

  return (
    <CModal
      visible={visible}
      size='xl'
      fullscreen='md-down'
      alignment='center'
      onClose={() => {
        if (sending) return
        onClose?.()
      }}
    >
      <CModalHeader>
        <CModalTitle>Gửi thư cho phụ huynh</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {recipientEmail ? null : <CAlert color='warning'>Hồ sơ này chưa có email phụ huynh hợp lệ để gửi thông báo.</CAlert>}

        <div className='d-flex flex-column gap-3'>
          <div>
            <CFormLabel htmlFor='review-email-recipient'>Email người nhận</CFormLabel>
            <CFormInput id='review-email-recipient' value={recipientEmail || ''} readOnly />
          </div>

          <div>
            <CFormLabel htmlFor='review-email-template'>Mẫu nhanh</CFormLabel>
            <CFormSelect
              id='review-email-template'
              value={selectedTemplateKey || ''}
              disabled={sending || loadingTemplates}
              onChange={(event) => onTemplateChange?.(event.target.value)}
            >
              <option value=''>
                {loadingTemplates ? 'Đang tải mẫu thư...' : 'Chọn mẫu để điền nhanh tiêu đề và nội dung'}
              </option>
              {safeTemplates.map((template) => (
                <option key={template.key} value={template.key}>{template.label}</option>
              ))}
            </CFormSelect>
            {templateError ? <div className='small text-danger mt-1'>{templateError}</div> : null}
            {!loadingTemplates && safeTemplates.length === 0 ? (
              <div className='small text-body-secondary mt-1'>Chưa có mẫu thư email nào được cấu hình trong Notification Template.</div>
            ) : null}
          </div>

          <div>
            <CFormLabel htmlFor='review-email-subject'>Tiêu đề</CFormLabel>
            <CFormInput
              id='review-email-subject'
              value={draft?.subject || ''}
              disabled={sending}
              onChange={(event) => onDraftChange?.({ subject: event.target.value })}
              placeholder='Nhập tiêu đề email'
            />
          </div>

          <div>
            <SimpleHtmlEditor
              label='Nội dung'
              value={draft?.content || ''}
              disabled={sending}
              rows={10}
              onChange={(value) => onDraftChange?.({ content: value })}
              placeholder='Nhập nội dung email cho phụ huynh'
            />
            <div className='small text-body-secondary mt-1'>Nội dung sẽ được làm sạch trước khi gửi email.</div>
          </div>

          <div>
            <CFormLabel htmlFor='review-email-attachments'>Tệp đính kèm</CFormLabel>
            <CFormInput
              id='review-email-attachments'
              key={fileInputKey}
              type='file'
              multiple
              disabled={sending}
              accept='image/*,.pdf,application/pdf,.doc,.docx,.xls,.xlsx'
              onChange={(event) => onFilesChange?.(Array.from(event.target.files || []))}
            />
            {files.length > 0 ? (
              <div className='admission-review-selected-files mt-2'>
                {files.map((file) => (
                  <div key={`${file.name}-${file.lastModified}`}>{getSelectedFileSummary(file)}</div>
                ))}
              </div>
            ) : null}
          </div>

          <CFormCheck
            id='review-email-conversation-sync'
            label='Đồng thời tạo thông báo trong hội thoại phụ huynh'
            checked={draft?.alsoCreateConversationMessage !== false}
            disabled={sending}
            onChange={(event) => onDraftChange?.({ alsoCreateConversationMessage: event.target.checked })}
          />
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' disabled={sending} onClick={onClose}>Đóng</CButton>
        <CButton color='primary' disabled={sending || !recipientEmail || !String(draft?.subject || '').trim() || !String(draft?.content || '').trim()} onClick={onSubmit}>
          {sending ? 'Đang gửi thư...' : 'Gửi thư'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}