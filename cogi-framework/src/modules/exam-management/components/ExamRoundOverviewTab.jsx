import { CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react'
import ExamRoundStatusBadge from './ExamRoundStatusBadge'
import ExamRoundTimeline from './ExamRoundTimeline'
import {
  formatDateTime,
  formatMoney,
  getPaymentCalculationMethodLabel,
  getRegistrationOperationLabel,
  getRegistrationOperationState,
  getRegistrationModeLabel,
  getRegistrationWindowLabel,
  getRegistrationWindowState,
} from '../utils/examRoundUi'

function ActorLine({ label, actor, at, fallback = '-' }) {
  const text = actor?.fullName || actor?.username || actor?.email || actor?.displayName || fallback
  return (
    <div className='mb-2'>
      <div className='small text-body-secondary'>{label}</div>
      <div>{text}</div>
      <div className='small text-body-secondary'>{formatDateTime(at)}</div>
    </div>
  )
}

export default function ExamRoundOverviewTab({ round, onOpenStructure }) {
  const registrationWindowState = getRegistrationWindowState(round)
  const registrationOperationState = getRegistrationOperationState(round)
  return (
    <CRow className='g-4'>
      <CCol xl={4} md={6}>
        <CCard className='h-100'>
          <CCardHeader><strong>Thông tin chung</strong></CCardHeader>
          <CCardBody>
            <div className='mb-2'><span className='small text-body-secondary'>Chương trình</span><div>{round?.examProgram?.name || '-'}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Mã đợt</span><div>{round?.code || '-'}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Tên đợt</span><div>{round?.name || '-'}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Năm học</span><div>{round?.academicYear || '-'}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Học kỳ</span><div>{round?.semester || '-'}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Chế độ đăng ký</span><div>{getRegistrationModeLabel(round?.registrationMode)}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Yêu cầu xác nhận thanh toán</span><div>{round?.requireConfirmedPayment ? 'Có' : 'Không'}</div></div>
            <div><span className='small text-body-secondary'>Trạng thái</span><div><ExamRoundStatusBadge status={round?.status} /></div></div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xl={4} md={6}>
        <CCard className='h-100'>
          <CCardHeader><strong>Mốc thời gian</strong></CCardHeader>
          <CCardBody>
            <div className='mb-2'><span className='small text-body-secondary'>Bắt đầu đăng ký</span><div>{formatDateTime(round?.registrationStartAt)}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Kết thúc đăng ký</span><div>{formatDateTime(round?.registrationEndAt)}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Bắt đầu thanh toán</span><div>{formatDateTime(round?.paymentStartAt)}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Kết thúc thanh toán</span><div>{formatDateTime(round?.paymentEndAt)}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Bắt đầu thi</span><div>{formatDateTime(round?.examStartAt)}</div></div>
            <div><span className='small text-body-secondary'>Kết thúc thi</span><div>{formatDateTime(round?.examEndAt)}</div></div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xl={4} md={6}>
        <CCard className='h-100'>
          <CCardHeader><strong>Cấu hình phí</strong></CCardHeader>
          <CCardBody>
            <div className='mb-2'><span className='small text-body-secondary'>Phương thức tính phí</span><div>{getPaymentCalculationMethodLabel(round?.paymentCalculationMethod)}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Phí cố định</span><div>{round?.fixedFee !== null && round?.fixedFee !== undefined && round?.fixedFee !== '' ? `${formatMoney(round.fixedFee)} VND` : '-'}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Yêu cầu xác nhận thanh toán</span><div>{round?.requireConfirmedPayment ? 'Có' : 'Không'}</div></div>
            <div><span className='small text-body-secondary'>Cấu trúc</span><div>
              {round?.structureSummary ? `${round.structureSummary.activeSubjectCount}/${round.structureSummary.subjectCount} môn active · ${round.structureSummary.activeComponentCount}/${round.structureSummary.componentCount} kỹ năng active` : (
                <button type='button' className='btn btn-link p-0 align-baseline' onClick={onOpenStructure}>Xem ở tab Cấu trúc</button>
              )}
            </div></div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xl={6}>
        <CCard className='h-100'>
          <CCardHeader><strong>Điều hành đăng ký</strong></CCardHeader>
          <CCardBody>
            <div className='mb-2'><span className='small text-body-secondary'>Trạng thái vận hành</span><div>{registrationOperationState}</div></div>
            <div className='small text-body-secondary mb-2'>Nhãn hiển thị: {getRegistrationOperationLabel(registrationOperationState)}</div>
            <div className='mb-2'><span className='small text-body-secondary'>Trạng thái cửa sổ đăng ký</span><div>{getRegistrationWindowLabel(registrationWindowState)}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Bắt đầu đăng ký</span><div>{formatDateTime(round?.registrationStartAt)}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Kết thúc đăng ký</span><div>{formatDateTime(round?.registrationEndAt)}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Lần mở gần nhất</span><div>{formatDateTime(round?.registrationOpenedAt)}</div></div>
            <div className='mb-2'><span className='small text-body-secondary'>Lần tạm dừng gần nhất</span><div>{formatDateTime(round?.registrationPausedAt)}</div></div>
            <div><span className='small text-body-secondary'>Lần đóng gần nhất</span><div>{formatDateTime(round?.registrationClosedAt)}</div></div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xl={6}>
        <CCard className='h-100'>
          <CCardHeader><strong>Quy trình phê duyệt</strong></CCardHeader>
          <CCardBody>
            <ActorLine label='Trình duyệt' actor={round?.submittedBy} at={round?.submittedAt} />
            <div className='mb-2'><span className='small text-body-secondary'>{round?.approvedAt ? 'Ghi chú phê duyệt' : 'Ghi chú trình duyệt'}</span><div>{round?.approvalNote || '-'}</div></div>
            <ActorLine label='Phê duyệt' actor={round?.approvedBy} at={round?.approvedAt} />
            <ActorLine label='Trả lại' actor={round?.returnedBy} at={round?.returnedAt} fallback={round?.returnReason || '-'} />
            <div className='mb-2'><span className='small text-body-secondary'>Lý do trả lại</span><div>{round?.returnReason || '-'}</div></div>
            <ActorLine label='Mở đăng ký' actor={round?.registrationOpenedBy} at={round?.registrationOpenedAt} />
            <ActorLine label='Tạm dừng' actor={round?.registrationPausedBy} at={round?.registrationPausedAt} fallback={round?.registrationPauseReason || '-'} />
            <div className='mb-2'><span className='small text-body-secondary'>Lý do tạm dừng</span><div>{round?.registrationPauseReason || '-'}</div></div>
            <ActorLine label='Tiếp tục đăng ký' actor={round?.registrationResumedBy} at={round?.registrationResumedAt} />
            <ActorLine label='Đóng đăng ký' actor={round?.registrationClosedBy} at={round?.registrationClosedAt} fallback={round?.registrationCloseReason || '-'} />
            <div><span className='small text-body-secondary'>Lý do đóng đăng ký</span><div>{round?.registrationCloseReason || '-'}</div></div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xl={12}>
        <CCard className='h-100'>
          <CCardHeader><strong>Tiến trình nhanh</strong></CCardHeader>
          <CCardBody>
            <ExamRoundTimeline status={round?.status} />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}