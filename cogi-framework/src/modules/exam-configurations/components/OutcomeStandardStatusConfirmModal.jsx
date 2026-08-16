import { CAlert, CButton, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CSpinner } from '@coreui/react'

export default function OutcomeStandardStatusConfirmModal({ visible, nextActive = true, error = '', submitting = false, onClose, onConfirm }) {
  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} alignment='center'>
      <CModalHeader><CModalTitle>{nextActive ? 'Kích hoạt lại chuẩn đầu ra' : 'Ngừng sử dụng chuẩn đầu ra'}</CModalTitle></CModalHeader>
      <CModalBody>
        {nextActive ? <div>Bạn có chắc muốn kích hoạt lại chuẩn đầu ra này để tiếp tục sử dụng trong các đánh giá hoặc cấu hình mới không?</div> : <div>Chuẩn đầu ra sẽ không còn được lựa chọn trong các cấu hình hoặc đánh giá mới, nhưng dữ liệu lịch sử không bị thay đổi.</div>}
        {error ? <CAlert color='danger' className='mt-3 mb-0'>{error}</CAlert> : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
        <CButton color={nextActive ? 'primary' : 'warning'} onClick={onConfirm} disabled={submitting}>{submitting ? <><CSpinner size='sm' className='me-2' />Đang xử lý...</> : nextActive ? 'Kích hoạt lại' : 'Ngừng sử dụng'}</CButton>
      </CModalFooter>
    </CModal>
  )
}