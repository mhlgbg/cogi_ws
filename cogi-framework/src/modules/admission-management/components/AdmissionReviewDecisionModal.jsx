import { useEffect, useState } from 'react'
import {
  CButton,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'

export default function AdmissionReviewDecisionModal({
  visible,
  action,
  submitting,
  onClose,
  onSubmit,
}) {
  const [note, setNote] = useState('')
  const isReturned = action === 'returned'

  useEffect(() => {
    if (!visible) {
      setNote('')
    }
  }, [visible])

  function handleSubmit() {
    if (isReturned && !String(note || '').trim()) {
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
        <CFormLabel>{isReturned ? 'Lý do trả lại hồ sơ' : 'Ghi chú duyệt'}</CFormLabel>
        <CFormTextarea
          rows={5}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={isReturned ? 'Nhập lý do để phụ huynh chỉnh sửa hồ sơ' : 'Nhập ghi chú nếu cần'}
          disabled={submitting}
        />
        {isReturned && !String(note || '').trim() ? (
          <div className='text-danger small mt-2'>Vui lòng nhập lý do trả lại hồ sơ</div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>
          Hủy
        </CButton>
        <CButton color={isReturned ? 'warning' : 'success'} onClick={handleSubmit} disabled={submitting || (isReturned && !String(note || '').trim())}>
          {submitting ? 'Đang xử lý...' : isReturned ? 'Xác nhận trả lại' : 'Xác nhận tiếp nhận'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
