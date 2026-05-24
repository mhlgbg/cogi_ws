import { useEffect, useState } from 'react'
import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import SimpleHtmlEditor from './SimpleHtmlEditor'

const ACCEPTED_NOTE_TEMPLATE = `<div style="background:#e8f7ee; border:1px solid #b7e4c7; border-left:6px solid #198754; padding:16px 18px; border-radius:10px; color:#14532d; line-height:1.6; font-size:15px;">
  <div style="font-size:18px; font-weight:700; margin-bottom:8px;">
    ✅ Hồ sơ đã được tiếp nhận
  </div>

  <p style="margin:0 0 10px 0;">
    Nhà trường thông báo hồ sơ đăng ký dự tuyển của học sinh đã được <b>đồng ý tiếp nhận</b>.
  </p>

  <p style="margin:0 0 10px 0;">
    Quý phụ huynh vui lòng <b>ghi nhớ mã học sinh</b> và <b>mã hồ sơ</b> để tiếp tục theo dõi các thông tin liên quan đến kỳ tuyển sinh.
  </p>

  <div style="background:#ffffff; border:1px dashed #198754; padding:12px 14px; border-radius:8px; margin:12px 0;">
    🎫 <b>Thông tin thẻ dự thi:</b><br/>
    Chậm nhất ngày <b>03/06/2026</b>, Quý phụ huynh có thể in thẻ dự thi trực tiếp tại trang web này.
    Ngay cạnh dòng trạng thái hồ sơ sẽ xuất hiện nút <b>“Phụ huynh in thẻ dự thi”</b>.
  </div>

  <p style="margin:0;">
    Trân trọng cảm ơn Quý phụ huynh đã phối hợp cùng Nhà trường.
  </p>
</div>`

const RETURNED_NOTE_TEMPLATE = `<div style="background:#fff7e6; border:1px solid #ffd591; border-left:6px solid #faad14; padding:16px 18px; border-radius:10px; color:#613400; line-height:1.6; font-size:15px;">
  <div style="font-size:18px; font-weight:700; margin-bottom:8px;">
    ⚠️ Hồ sơ cần bổ sung / chỉnh sửa
  </div>

  <p style="margin:0 0 12px 0;">
    Nhà trường đã tiếp nhận hồ sơ đăng ký dự tuyển của học sinh. Tuy nhiên, hồ sơ hiện cần được bổ sung hoặc điều chỉnh một số nội dung như sau:
  </p>

  <div style="background:#ffffff; border:1px dashed #faad14; padding:12px 14px; border-radius:8px; margin-bottom:12px;">
    <b>Nội dung cần bổ sung / chỉnh sửa:</b>

    <ol style="margin-top:8px; padding-left:20px;">
      <li>............................................................</li>
      <li>............................................................</li>
    </ol>
  </div>

  <p style="margin:0 0 10px 0;">
    👉 Quý phụ huynh vui lòng nhấn nút <b>“Cập nhật hồ sơ”</b> để bổ sung và chỉnh sửa theo yêu cầu trên.
  </p>

  <p style="margin:0;">
    Sau khi hoàn thiện, hồ sơ sẽ được Nhà trường tiếp tục xem xét và cập nhật trạng thái trên hệ thống.
  </p>
</div>`

function getDefaultNoteTemplate(action) {
  return action === 'returned' ? RETURNED_NOTE_TEMPLATE : ACCEPTED_NOTE_TEMPLATE
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function AdmissionReviewDecisionModal({
  visible,
  action,
  submitting,
  onClose,
  onSubmit,
}) {
  const [note, setNote] = useState('')
  const isReturned = action === 'returned'
  const noteIsEmpty = stripHtml(note) === ''

  useEffect(() => {
    if (!visible) return
    setNote(getDefaultNoteTemplate(action))
  }, [visible, action])

  function handleSubmit() {
    if (isReturned && noteIsEmpty) {
      return
    }

    onSubmit({
      action,
      reviewNote: String(note || '').trim(),
    })
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment='center'>
      <CModalHeader>
        <CModalTitle>{isReturned ? 'Trả lại hồ sơ' : 'Tiếp nhận hồ sơ'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <SimpleHtmlEditor
          label={isReturned ? 'Lý do trả lại hồ sơ' : 'Ghi chú duyệt'}
          value={note}
          onChange={setNote}
          rows={8}
          placeholder={isReturned ? 'Nhập lý do để phụ huynh chỉnh sửa hồ sơ' : 'Nhập ghi chú nếu cần'}
          disabled={submitting}
        />
        {isReturned && noteIsEmpty ? (
          <div className='text-danger small mt-2'>Vui lòng nhập lý do trả lại hồ sơ</div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>
          Hủy
        </CButton>
        <CButton color={isReturned ? 'warning' : 'success'} onClick={handleSubmit} disabled={submitting || (isReturned && noteIsEmpty)}>
          {submitting ? 'Đang xử lý...' : isReturned ? 'Xác nhận trả lại' : 'Xác nhận tiếp nhận'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
