import { useEffect, useState } from 'react'
import { CButton, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'
import { sanitizeClassSessionContentHtml } from '../utils/classSessionContentHtml'

const SESSION_CONTENT_TOOLBAR = [
  { label: 'P', command: 'formatBlock', value: 'p' },
  { label: 'H2', command: 'formatBlock', value: 'h2' },
  { label: 'H3', command: 'formatBlock', value: 'h3' },
  { label: 'B', command: 'bold' },
  { label: 'I', command: 'italic' },
  { label: 'U', command: 'underline' },
  { label: 'UL', command: 'insertUnorderedList' },
  { label: 'OL', command: 'insertOrderedList' },
]

export default function ClassSessionContentEditorModal({
  visible = false,
  saving = false,
  title = 'Soạn nội dung',
  value = '',
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(() => sanitizeClassSessionContentHtml(value) || '<p></p>')

  useEffect(() => {
    setDraft(sanitizeClassSessionContentHtml(value) || '<p></p>')
  }, [value, visible])

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl'>
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <SimpleHtmlEditor
          value={draft}
          onChange={setDraft}
          disabled={saving}
          rows={12}
          placeholder='Nhập nội dung...'
          toolbarActions={SESSION_CONTENT_TOOLBAR}
          showLinkControls
          showImageControls={false}
          showColorControls={false}
          allowHtmlMode
          helperText='Hỗ trợ đoạn văn, in đậm, in nghiêng, gạch chân, danh sách và liên kết. Nội dung sẽ được sanitize an toàn trước khi hiển thị.'
        />
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={saving}>Hủy</CButton>
        <CButton color='primary' onClick={() => onSave?.(draft)} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu nội dung'}</CButton>
      </CModalFooter>
    </CModal>
  )
}