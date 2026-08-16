import { useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CFormCheck,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import { canEditExamRound, formatDateTime, getExamRoundRelatedTabFromPath, getExamRoundWorkflowActions, getRegistrationModeLabel, getRegistrationWindowLabel, getRegistrationWindowState, getPaymentCalculationMethodLabel, isSelfApprovalBlocked } from '../utils/examRoundUi'

export default function ExamRoundWorkflowActions({ round, permissions, currentUserId = 0, submittingActionKey = '', errorMessage = '', errorDetails = [], onAction, onOpenTab }) {
  const actions = useMemo(() => getExamRoundWorkflowActions(round, permissions), [permissions, round])
  const registrationWindowState = getRegistrationWindowState(round)
  const selfApprovalBlocked = isSelfApprovalBlocked(round, currentUserId)
  const [activeAction, setActiveAction] = useState(null)
  const [textValue, setTextValue] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  function openAction(action) {
    setTextValue('')
    setConfirmed(false)
    setActiveAction(action)
  }

  function closeAction() {
    if (submittingActionKey) return
    setActiveAction(null)
    setTextValue('')
    setConfirmed(false)
  }

  async function handleConfirm() {
    if (!activeAction) return
    const payload = activeAction.field
      ? { [activeAction.field]: String(textValue || '').trim() }
      : {}
    const succeeded = await onAction?.(activeAction.key, payload)
    if (succeeded !== false) closeAction()
  }

  return (
    <>
      <div className='d-flex flex-wrap gap-2'>
        {canEditExamRound(round, permissions) ? (
          <>
            <CButton color='warning' variant='outline' onClick={() => onOpenTab?.('configuration')}>Chỉnh cấu hình</CButton>
            <CButton color='info' variant='outline' onClick={() => onOpenTab?.('structure')}>Chỉnh cấu trúc</CButton>
          </>
        ) : null}
        {actions.map((action) => {
          const actionDisabled = Boolean(submittingActionKey) || (action.key === 'approve' && selfApprovalBlocked)
          const disabledTitle = action.key === 'approve' && selfApprovalBlocked
            ? 'Người đã trình duyệt không được tự phê duyệt cùng đợt thi.'
            : undefined

          return (
          <CButton key={action.key} color={action.color} variant={action.key === 'approve' ? undefined : 'outline'} disabled={actionDisabled} title={disabledTitle} onClick={() => openAction(action)}>
            {action.label}
          </CButton>
          )
        })}
      </div>

      <CModal visible={Boolean(activeAction)} onClose={closeAction}>
        <CModalHeader>
          <CModalTitle>{activeAction?.title || activeAction?.label}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {errorMessage ? <CAlert color='danger'>
            <div className='fw-semibold mb-1'>{errorMessage}</div>
            {Array.isArray(errorDetails) && errorDetails.length > 0 ? (
              <div className='d-flex flex-column gap-2 mt-2'>
                {errorDetails.map((item, index) => (
                  <div key={`${item?.path || 'error'}:${index}`} className='border rounded p-2 bg-body-tertiary'>
                    <div><strong>{item?.code || 'Lỗi'}</strong>{item?.path ? ` - ${item.path}` : ''}</div>
                    <div className='small'>{item?.message || ''}</div>
                    <div className='mt-2'>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => onOpenTab?.(getExamRoundRelatedTabFromPath(item?.path))}>Mở tab liên quan</CButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CAlert> : null}
          <div className='mb-3'>
            <div className='small text-body-secondary'>Mã đợt</div>
            <div className='fw-semibold'>{round?.code || '-'}</div>
          </div>

          <div className='mb-3'>
            <div className='small text-body-secondary'>Tên đợt</div>
            <div>{round?.name || '-'}</div>
          </div>

          {activeAction?.key === 'submit' ? (
            <>
              <div className='small text-body-secondary mb-3'>
                Thời gian đăng ký: {formatDateTime(round?.registrationStartAt)} - {formatDateTime(round?.registrationEndAt)}
              </div>
              <div className='small text-body-secondary mb-3'>
                Snapshot hiện tại: {round?.structureSummary ? `${round.structureSummary.subjectCount} môn · ${round.structureSummary.componentCount} kỹ năng` : 'Chưa có số liệu summary'}
              </div>
              <div className='alert alert-info mb-3'>Cấu trúc môn và kỹ năng trong đợt thi là snapshot riêng. Việc chỉnh sửa chương trình nguồn không tự động thay đổi đợt thi này.</div>
              <CFormCheck label='Tôi đã kiểm tra cấu hình, cấu trúc môn thi và các mốc thời gian của đợt.' checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            </>
          ) : null}

          {activeAction?.key === 'approve' ? (
            <>
              <div className='mb-3'><div className='small text-body-secondary'>Người gửi</div><div>{round?.submittedBy?.fullName || round?.submittedBy?.username || round?.submittedBy?.email || '-'}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Thời điểm gửi</div><div>{formatDateTime(round?.submittedAt)}</div></div>
              <div className='small text-body-secondary mb-3'>Tóm tắt cấu trúc: {round?.structureSummary ? `${round.structureSummary.subjectCount} môn · ${round.structureSummary.componentCount} kỹ năng` : 'Chưa có số liệu summary'}</div>
              {selfApprovalBlocked ? <div className='alert alert-warning'>Bạn là người đã gửi phê duyệt đợt thi này. Backend không cho phép tự phê duyệt cùng một đợt thi.</div> : null}
            </>
          ) : null}

          {activeAction?.key === 'open' ? (
            <>
              <div className='mb-3'><div className='small text-body-secondary'>Trạng thái cửa sổ đăng ký</div><div>{getRegistrationWindowLabel(registrationWindowState)}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Chế độ đăng ký</div><div>{getRegistrationModeLabel(round?.registrationMode)}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Phương thức lệ phí</div><div>{getPaymentCalculationMethodLabel(round?.paymentCalculationMethod)}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Cho phép learner chọn môn</div><div>{round?.allowSubjectSelection ? 'Có' : 'Không'}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Cho phép learner chọn kỹ năng</div><div>{round?.allowComponentSelection ? 'Có' : 'Không'}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Yêu cầu xác nhận thanh toán</div><div>{round?.requireConfirmedPayment ? 'Có' : 'Không'}</div></div>
              {round?.registrationMode === 'restricted' ? <div className='alert alert-warning'>Đợt thi đang sử dụng chế độ giới hạn đối tượng. Việc chưa có danh sách đủ điều kiện không nhất thiết ngăn mở đăng ký, nhưng learner sẽ chưa thể đăng ký cho tới khi được xác định đủ điều kiện.</div> : null}
              {round?.registrationMode === 'open' ? <div className='alert alert-info'>Đợt thi cho phép learner phù hợp đăng ký mà không cần có bản ghi eligibility từ trước.</div> : null}
              {registrationWindowState === 'before_window' ? <div className='alert alert-info'>Đợt thi đang được mở trước thời điểm bắt đầu cửa sổ đăng ký. Learner sẽ chỉ đăng ký được khi tới thời gian hiệu lực thực tế.</div> : null}
              {registrationWindowState === 'after_window' ? <div className='alert alert-danger'>Cửa sổ đăng ký đã kết thúc. Backend có thể từ chối mở hoặc tiếp tục đăng ký.</div> : null}
              {registrationWindowState === 'missing_window' || registrationWindowState === 'invalid_window' ? <div className='alert alert-danger'>Cửa sổ đăng ký chưa được cấu hình đầy đủ hoặc đang không hợp lệ.</div> : null}
            </>
          ) : null}

          {activeAction?.key === 'pause' ? <div className='alert alert-warning'>Người học sẽ tạm thời không thể tạo đăng ký mới. Các đăng ký đã tạo và dữ liệu hiện có không bị xóa.</div> : null}

          {activeAction?.key === 'resume' ? (
            <>
              <div className='mb-3'><div className='small text-body-secondary'>Trạng thái cửa sổ đăng ký</div><div>{getRegistrationWindowLabel(registrationWindowState)}</div></div>
              {registrationWindowState === 'after_window' ? <div className='alert alert-danger'>Thời gian đăng ký đã kết thúc. Backend có thể từ chối tiếp tục nhận đăng ký.</div> : null}
            </>
          ) : null}

          {activeAction?.key === 'close' ? <div className='alert alert-warning'>Sau khi đóng đăng ký, learner không thể tạo đăng ký mới. Thao tác này không tự tạo danh sách thí sinh, không tự xác nhận thanh toán và không tự hủy các đăng ký đã có.</div> : null}

          {activeAction?.key === 'return' ? <div className='alert alert-warning'>Đợt thi sẽ được trả về trạng thái có thể chỉnh sửa. Các nội dung đã gửi phê duyệt cần được kiểm tra lại trước khi gửi lần tiếp theo.</div> : null}

          <div className='mb-3'>Bạn chắc chắn muốn thực hiện thao tác này?</div>

          {activeAction?.field ? (
            <>
              <div className='small fw-semibold mb-1'>{activeAction.field === 'reason' ? 'Lý do trả về bản nháp' : activeAction?.key === 'approve' ? 'Ghi chú phê duyệt' : 'Ghi chú trình duyệt'}</div>
              <CFormTextarea
                rows={4}
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
                placeholder={activeAction.field === 'reason' ? 'Nhập lý do' : 'Nhập ghi chú nếu cần'}
              />
            </>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeAction} disabled={Boolean(submittingActionKey)}>Đóng</CButton>
          <CButton color={activeAction?.color || 'primary'} onClick={handleConfirm} disabled={Boolean(submittingActionKey) || (activeAction?.required && !String(textValue || '').trim()) || (activeAction?.key === 'submit' && !confirmed)}>
            {submittingActionKey === activeAction?.key ? 'Đang xử lý...' : activeAction?.confirmLabel || 'Xác nhận'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}