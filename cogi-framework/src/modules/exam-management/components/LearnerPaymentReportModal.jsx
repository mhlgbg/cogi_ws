import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import { formatDateTime, formatMoney } from '../utils/examRoundUi'

function toDateTimeLocalValue(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}`
}

function emptyForm() {
  return {
    paymentTransferAt: toDateTimeLocalValue(),
    paymentSenderName: '',
    paymentSenderAccount: '',
    paymentSenderBank: '',
    paymentTransactionReference: '',
    paymentReportNote: '',
    confirm: false,
  }
}

export default function LearnerPaymentReportModal({ visible, detail, submitting, error, onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm())
  const [selectedFile, setSelectedFile] = useState(null)

  useEffect(() => {
    if (!visible) return
    setForm(emptyForm())
    setSelectedFile(null)
  }, [visible])

  const summary = useMemo(() => ({
    registrationCode: detail?.registration?.registrationCode || '-',
    roundName: [detail?.examRound?.code, detail?.examRound?.name].filter(Boolean).join(' - ') || '-',
    amountDue: detail?.fee?.amountDue || 0,
    currency: detail?.fee?.currency || 'VND',
    transferContent: detail?.payment?.transferContent || '-',
    accountNumber: detail?.payment?.accountNumber || '-',
    accountHolder: detail?.payment?.accountHolder || '-',
    bankName: detail?.payment?.bankName || detail?.payment?.bankCode || '-',
  }), [detail])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event) {
    if (event?.preventDefault) event.preventDefault()
    if (submitting) return
    await onSubmit?.({
      ...form,
      paymentEvidenceFile: selectedFile,
    })
  }

  return (
    <CModal visible={visible} backdrop='static' onClose={() => !submitting && onClose?.()} size='lg'>
      <CModalHeader>
        <CModalTitle>Thông báo đã chuyển tiền</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CAlert color='warning'>Thông báo này chỉ giúp nhà trường biết bạn đã chuyển tiền; trạng thái thanh toán vẫn chờ xác nhận.</CAlert>

        <div className='border rounded p-3 mb-4 bg-body-tertiary'>
          <div className='small text-body-secondary'>Mã hồ sơ</div>
          <div className='fw-semibold mb-2'>{summary.registrationCode}</div>
          <div className='small text-body-secondary'>Đợt thi</div>
          <div className='mb-2'>{summary.roundName}</div>
          <div className='small text-body-secondary'>Số tiền cần nộp</div>
          <div className='mb-2'>{`${formatMoney(summary.amountDue)} ${summary.currency}`}</div>
          <div className='small text-body-secondary'>Tài khoản nhận tiền</div>
          <div className='mb-2'>{summary.bankName} · {summary.accountNumber} · {summary.accountHolder}</div>
          <div className='small text-body-secondary'>Nội dung chuyển khoản hệ thống đã cấp</div>
          <div>{summary.transferContent}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <CRow className='g-3'>
            <CCol md={6}>
              <CFormLabel>Thời gian đã chuyển tiền</CFormLabel>
              <CFormInput
                type='datetime-local'
                value={form.paymentTransferAt}
                onChange={(event) => updateField('paymentTransferAt', event.target.value)}
                disabled={submitting}
              />
              <div className='small text-body-secondary mt-1'>{form.paymentTransferAt ? formatDateTime(form.paymentTransferAt) : '-'}</div>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Tên người chuyển tiền</CFormLabel>
              <CFormInput
                value={form.paymentSenderName}
                onChange={(event) => updateField('paymentSenderName', event.target.value)}
                disabled={submitting}
                maxLength={200}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Số tài khoản người gửi</CFormLabel>
              <CFormInput
                value={form.paymentSenderAccount}
                onChange={(event) => updateField('paymentSenderAccount', event.target.value)}
                disabled={submitting}
                maxLength={100}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Ngân hàng gửi</CFormLabel>
              <CFormInput
                value={form.paymentSenderBank}
                onChange={(event) => updateField('paymentSenderBank', event.target.value)}
                disabled={submitting}
                maxLength={150}
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel>Mã giao dịch</CFormLabel>
              <CFormInput
                value={form.paymentTransactionReference}
                onChange={(event) => updateField('paymentTransactionReference', event.target.value)}
                disabled={submitting}
                maxLength={100}
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel>Chứng từ thanh toán</CFormLabel>
              <CFormInput
                type='file'
                accept='.jpg,.jpeg,.png,.webp,.gif,.pdf'
                disabled={submitting}
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
              <div className='small text-body-secondary mt-1'>{selectedFile?.name || 'Chứng từ là tùy chọn trong pha đầu.'}</div>
            </CCol>
            <CCol md={12}>
              <CFormLabel>Ghi chú</CFormLabel>
              <CFormTextarea
                rows={3}
                value={form.paymentReportNote}
                onChange={(event) => updateField('paymentReportNote', event.target.value)}
                disabled={submitting}
                maxLength={2000}
              />
            </CCol>
            <CCol md={12}>
              <CFormCheck
                id='learner-payment-report-confirm'
                checked={form.confirm}
                onChange={(event) => updateField('confirm', event.target.checked)}
                disabled={submitting}
                label='Tôi xác nhận đã thực hiện giao dịch chuyển tiền với thông tin trên.'
              />
            </CCol>
          </CRow>
          <button type='submit' className='d-none' />
        </form>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' disabled={submitting} onClick={() => onClose?.()}>Hủy</CButton>
        <CButton color='primary' disabled={submitting || !form.confirm} onClick={handleSubmit}>{submitting ? 'Đang gửi...' : 'Gửi thông báo'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
