import { useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
} from '@coreui/react'
import { formatDateTime, formatMoney } from '../utils/examRoundUi'
import { getLearnerRegistrationPaymentDisplayState, getPaymentStatusBadge } from '../utils/learnerExamUi'

function InfoItem({ label, value, html = false }) {
  return (
    <div className='py-2 border-bottom'>
      <div className='small text-body-secondary mb-1'>{label}</div>
      {html ? <div style={{ wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: value || '-' }} /> : <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value || '-'}</div>}
    </div>
  )
}

function PaymentEvidenceBlock({ paymentEvidence, paymentEvidenceUrl }) {
  if (!paymentEvidence) return null
  return (
    <div className='py-2'>
      <div className='small text-body-secondary mb-2'>Chứng từ</div>
      {String(paymentEvidence.mimeType || '').toLowerCase().startsWith('image/') && paymentEvidenceUrl ? (
        <div>
          <img src={paymentEvidenceUrl} alt={paymentEvidence.name || 'Chứng từ thanh toán'} style={{ width: '100%', maxWidth: 280, height: 'auto', borderRadius: 12 }} />
          <div className='small mt-2'>{paymentEvidence.name || '-'}</div>
        </div>
      ) : paymentEvidenceUrl ? (
        <a href={paymentEvidenceUrl} target='_blank' rel='noreferrer'>{paymentEvidence.name || 'Xem chứng từ'}</a>
      ) : (
        <div>{paymentEvidence.name || '-'}</div>
      )}
    </div>
  )
}

function ReadOnlyTransferDetails({ payment, amountLabel, amountValue, qrImageUrl }) {
  return (
    <div className='d-flex flex-column gap-2 mt-3'>
      <InfoItem label='Ngân hàng' value={payment?.bankName || payment?.bankCode || '-'} />
      <InfoItem label='Số tài khoản' value={payment?.accountNumber || '-'} />
      <InfoItem label='Chủ tài khoản' value={payment?.accountHolder || '-'} />
      <InfoItem label='Chi nhánh' value={payment?.bankBranch || '-'} />
      <InfoItem label={amountLabel} value={amountValue} />
      <InfoItem label='Nội dung chuyển khoản' value={payment?.transferContent || '-'} />
      {qrImageUrl ? <div className='text-center py-2'><img src={qrImageUrl} alt='QR thanh toán' style={{ width: '100%', maxWidth: 280, height: 'auto', borderRadius: 12 }} /></div> : null}
      <InfoItem label='Hướng dẫn' value={payment?.paymentInstruction || '-'} html={true} />
      <InfoItem label='Hỗ trợ' value={[payment?.supportPhone, payment?.supportEmail].filter(Boolean).join(' · ') || '-'} />
    </div>
  )
}

export default function ExamRegistrationPaymentPanel({
  paymentStatus,
  payment,
  paymentReport,
  paymentEvidence,
  paymentEvidenceUrl,
  qrImageUrl,
  amountDue,
  confirmedPaidAmount,
  currency = 'VND',
  registrationCode,
  canReportPayment = false,
  onOpenReport,
  onCopy,
}) {
  const displayState = getLearnerRegistrationPaymentDisplayState(paymentStatus)
  const badge = getPaymentStatusBadge(paymentStatus)
  const [showTransferDetails, setShowTransferDetails] = useState(false)
  const amountText = `${formatMoney(amountDue || 0)} ${currency || 'VND'}`
  const confirmedAmountText = `${formatMoney((confirmedPaidAmount ?? amountDue) || 0)} ${currency || 'VND'}`

  const isActionable = displayState === 'action_required'
  const heading = useMemo(() => {
    if (displayState === 'pending_review') return 'Đã báo chuyển tiền'
    if (displayState === 'confirmed') return 'Thanh toán đã được xác nhận'
    if (displayState === 'not_required') return 'Không yêu cầu thanh toán'
    if (displayState === 'rejected') return 'Thông tin thanh toán cần kiểm tra'
    return 'Thông tin chuyển khoản'
  }, [displayState])

  if (displayState === 'not_required') {
    return <CAlert color='success' className='mb-0'>Đợt thi này không yêu cầu thanh toán.</CAlert>
  }

  if (!payment?.paymentRequired && displayState !== 'confirmed' && displayState !== 'pending_review' && displayState !== 'rejected') {
    return null
  }

  return (
    <CCard className='mb-4'>
      <CCardHeader><strong>{heading}</strong></CCardHeader>
      <CCardBody>
        {isActionable ? (
          <>
            <InfoItem label='Ngân hàng' value={payment?.bankName || payment?.bankCode || '-'} />
            <InfoItem label='Số tài khoản' value={payment?.accountNumber || '-'} />
            <div className='d-flex gap-2 flex-wrap mb-3'>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => onCopy?.(payment?.accountNumber, 'Đã sao chép số tài khoản')} disabled={!payment?.accountNumber}>Sao chép số tài khoản</CButton>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => onCopy?.(amountDue, 'Đã sao chép số tiền')} disabled={amountDue === null || amountDue === undefined}>Sao chép số tiền</CButton>
            </div>
            <InfoItem label='Chủ tài khoản' value={payment?.accountHolder || '-'} />
            <InfoItem label='Chi nhánh' value={payment?.bankBranch || '-'} />
            <InfoItem label='Số tiền' value={amountText} />
            <InfoItem label='Nội dung chuyển khoản' value={payment?.transferContent || '-'} />
            <div className='d-flex gap-2 flex-wrap my-3'>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => onCopy?.(payment?.transferContent, 'Đã sao chép nội dung chuyển khoản')} disabled={!payment?.transferContent}>Sao chép nội dung</CButton>
            </div>
            {qrImageUrl ? <div className='text-center mb-3'><img src={qrImageUrl} alt='QR thanh toán' style={{ width: '100%', maxWidth: 280, height: 'auto', borderRadius: 12 }} /></div> : null}
            <InfoItem label='Hướng dẫn' value={payment?.paymentInstruction || '-'} html={true} />
            <InfoItem label='Hỗ trợ' value={[payment?.supportPhone, payment?.supportEmail].filter(Boolean).join(' · ') || '-'} />
            <CAlert color='warning' className='mt-3 mb-2'>Vui lòng chuyển đúng số tiền và ghi đúng nội dung chuyển khoản để nhà trường thuận tiện đối soát.</CAlert>
            <div className='small text-body-secondary mb-3'>Sau khi chuyển khoản, vui lòng thông báo để nhà trường kiểm tra và xác nhận.</div>
            {canReportPayment ? <CButton color='primary' className='w-100' onClick={() => onOpenReport?.()}>Tôi đã chuyển tiền</CButton> : null}
          </>
        ) : null}

        {displayState === 'pending_review' ? (
          <>
            <div className='d-flex align-items-center gap-2 flex-wrap mb-3'>
              <CBadge color={badge.color}>{badge.label}</CBadge>
            </div>
            <CAlert color='info' className='mb-3'>Nhà trường đã nhận được thông báo chuyển tiền của bạn và đang kiểm tra giao dịch.</CAlert>
            <InfoItem label='Số tiền cần thanh toán' value={amountText} />
            <InfoItem label='Thời điểm đã báo' value={formatDateTime(paymentReport?.reportedAt)} />
            <InfoItem label='Thời điểm đã chuyển' value={formatDateTime(paymentReport?.transferAt)} />
            <InfoItem label='Mã giao dịch' value={paymentReport?.transactionReference || '-'} />
            <PaymentEvidenceBlock paymentEvidence={paymentEvidence} paymentEvidenceUrl={paymentEvidenceUrl} />
            <div className='mt-3'>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => setShowTransferDetails((current) => !current)}>
                {showTransferDetails ? 'Ẩn thông tin chuyển khoản' : 'Xem lại thông tin chuyển khoản'}
              </CButton>
            </div>
            {showTransferDetails ? <ReadOnlyTransferDetails payment={payment} amountLabel='Số tiền cần thanh toán' amountValue={amountText} qrImageUrl={qrImageUrl} /> : null}
          </>
        ) : null}

        {displayState === 'confirmed' ? (
          <>
            <div className='d-flex align-items-center gap-2 flex-wrap mb-3'>
              <CBadge color='success'>Đã thanh toán</CBadge>
            </div>
            <CAlert color='success' className='mb-3'>Nhà trường đã xác nhận nhận được lệ phí cho hồ sơ này. Bạn không cần thực hiện thêm thanh toán.</CAlert>
            <InfoItem label='Mã hồ sơ' value={registrationCode || '-'} />
            <InfoItem label='Số tiền đã xác nhận' value={confirmedAmountText} />
            <InfoItem label='Thời điểm xác nhận' value={formatDateTime(paymentReport?.confirmedAt)} />
            <InfoItem label='Mã giao dịch' value={paymentReport?.transactionReference || '-'} />
            <div className='mt-3'>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => setShowTransferDetails((current) => !current)}>
                {showTransferDetails ? 'Ẩn thông tin thanh toán đã sử dụng' : 'Thông tin thanh toán đã sử dụng'}
              </CButton>
            </div>
            {showTransferDetails ? <ReadOnlyTransferDetails payment={payment} amountLabel='Số tiền đã thanh toán' amountValue={confirmedAmountText} qrImageUrl={qrImageUrl} /> : null}
          </>
        ) : null}

        {displayState === 'rejected' ? (
          <>
            <div className='d-flex align-items-center gap-2 flex-wrap mb-3'>
              <CBadge color='warning'>Thông tin thanh toán cần kiểm tra</CBadge>
            </div>
            <CAlert color='warning' className='mb-3'>Thông tin thanh toán chưa được xác nhận. Vui lòng kiểm tra lý do và liên hệ nhà trường để được hướng dẫn bước tiếp theo.</CAlert>
            <InfoItem label='Số tiền cần thanh toán' value={amountText} />
            <InfoItem label='Thời điểm đã báo' value={formatDateTime(paymentReport?.reportedAt)} />
            <InfoItem label='Thời gian đã chuyển' value={formatDateTime(paymentReport?.transferAt)} />
            <InfoItem label='Mã giao dịch' value={paymentReport?.transactionReference || '-'} />
            <InfoItem label='Thời điểm trả lại' value={formatDateTime(paymentReport?.rejectedAt)} />
            <InfoItem label='Lý do trả lại' value={paymentReport?.rejectionReason || '-'} />
            <PaymentEvidenceBlock paymentEvidence={paymentEvidence} paymentEvidenceUrl={paymentEvidenceUrl} />
            <div className='mt-3'>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => setShowTransferDetails((current) => !current)}>
                {showTransferDetails ? 'Ẩn thông tin chuyển khoản' : 'Xem lại thông tin chuyển khoản'}
              </CButton>
            </div>
            {showTransferDetails ? <ReadOnlyTransferDetails payment={payment} amountLabel='Số tiền cần thanh toán' amountValue={amountText} qrImageUrl={qrImageUrl} /> : null}
          </>
        ) : null}

        {displayState === 'neutral' ? (
          <CAlert color='secondary' className='mb-0'>Trạng thái thanh toán hiện tại không yêu cầu thao tác thêm từ bạn.</CAlert>
        ) : null}
      </CCardBody>
    </CCard>
  )
}