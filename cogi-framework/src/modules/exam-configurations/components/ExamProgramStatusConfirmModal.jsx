import {
  CAlert,
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

export default function ExamProgramStatusConfirmModal({
  visible,
  nextActive = true,
  error = '',
  submitting = false,
  onClose,
  onConfirm,
}) {
  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} alignment='center'>
      <CModalHeader>
        <CModalTitle>{nextActive ? 'Kích hoạt lại chương trình thi' : 'Ngừng sử dụng chương trình thi'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {nextActive ? (
          <div>Bạn có chắc muốn kích hoạt lại chương trình này để tiếp tục sử dụng cho các đợt thi tạo mới không?</div>
        ) : (
          <div>Bạn có chắc muốn ngừng sử dụng chương trình này? Chương trình sẽ không còn được lựa chọn để tạo các đợt thi mới, nhưng dữ liệu lịch sử và các đợt thi đã tạo không bị thay đổi.</div>
        )}
        {error ? <CAlert color='danger' className='mt-3 mb-0'>{error}</CAlert> : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
        <CButton color={nextActive ? 'primary' : 'warning'} onClick={onConfirm} disabled={submitting}>
          {submitting ? <><CSpinner size='sm' className='me-2' />Đang xử lý...</> : nextActive ? 'Kích hoạt lại' : 'Ngừng sử dụng'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}