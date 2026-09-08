import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CRow,
  CSpinner,
} from '@coreui/react'
import { getLearnerExamRegistration, normalizeCurrentLearnerApiMessage, reportExamRegistrationPayment, uploadExamRegistrationPaymentEvidence } from '../services/learnerExamApi'
import { formatDateTime, formatMoney, getExamMethodLabel } from '../utils/examRoundUi'
import { getLearnerRegistrationPaymentDisplayState, getPaymentStatusBadge, getPaymentStatusLabel, getRegistrationStatusBadge, getRegistrationStatusLabel } from '../utils/learnerExamUi'
import { buildLearnerExamFeeSummary, shouldShowLearnerExamComponentFee, shouldShowLearnerExamSubjectFee } from '../utils/learnerExamFeeUi'
import { buildProtectedFileUrl, resolveMediaUrl } from '../../../utils/mediaUrl'
import ExamRegistrationPaymentPanel from '../components/ExamRegistrationPaymentPanel'
import LearnerPaymentReportModal from '../components/LearnerPaymentReportModal'

function SpinnerCenter() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CSpinner /></div>
}

function InfoItem({ label, value, html = false }) {
  return (
    <div className='py-2 border-bottom'>
      <div className='small text-body-secondary mb-1'>{label}</div>
      {html ? <div style={{ wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: value || '-' }} /> : <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value || '-'}</div>}
    </div>
  )
}

export default function LearnerExamRegistrationDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id, tenantCode } = useParams()
  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams` : '/learner/exams'
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [reportModalVisible, setReportModalVisible] = useState(false)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportError, setReportError] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getLearnerExamRegistration(id)
        if (!mounted) return
        setDetail(result)
      } catch (requestError) {
        if (!mounted) return
        setDetail(null)
        setError(normalizeCurrentLearnerApiMessage(requestError, 'Không tải được hồ sơ đăng ký dự thi.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  useEffect(() => {
    if (!copyMessage) return undefined
    const timer = setTimeout(() => setCopyMessage(''), 2000)
    return () => clearTimeout(timer)
  }, [copyMessage])

  const registrationBadge = useMemo(() => getRegistrationStatusBadge(detail?.registration?.registrationStatus), [detail?.registration?.registrationStatus])
  const paymentBadge = useMemo(() => getPaymentStatusBadge(detail?.status?.paymentStatus), [detail?.status?.paymentStatus])
  const feeDisplay = useMemo(() => buildLearnerExamFeeSummary({ fee: detail?.fee }), [detail?.fee])
  const showSubjectFee = useMemo(() => shouldShowLearnerExamSubjectFee({ fee: detail?.fee }), [detail?.fee])
  const showComponentFee = useMemo(() => shouldShowLearnerExamComponentFee({ fee: detail?.fee }), [detail?.fee])
  const paymentDisplayState = useMemo(() => getLearnerRegistrationPaymentDisplayState(detail?.status?.paymentStatus), [detail?.status?.paymentStatus])

  async function copyText(value, successText) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(String(value))
      setCopyMessage(successText)
    } catch {
      setCopyMessage('Không thể sao chép vào clipboard')
    }
  }

  if (loading) return <SpinnerCenter />

  if (!detail) {
    return (
      <CContainer fluid className='py-4'>
        <CAlert color='danger'>{error || 'Không tìm thấy hồ sơ đăng ký phù hợp.'}</CAlert>
        <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách đợt thi</CButton>
      </CContainer>
    )
  }

  const payment = detail?.payment || null
  const paymentReport = detail?.paymentReport || null
  const qrImageUrl = payment?.qrImage?.url ? resolveMediaUrl(payment.qrImage.url) : ''
  const justCreated = location?.state?.justCreated === true
  const paymentEvidence = paymentReport?.evidence || null
  const paymentEvidenceUrl = paymentEvidence?.url
    ? buildProtectedFileUrl({ fileAssetId: paymentEvidence.fileAssetId || paymentEvidence.id, storageProvider: paymentEvidence.provider, url: paymentEvidence.url })
    : ''
  const canReportPayment = paymentReport?.canReport === true && detail?.status?.paymentStatus === 'unpaid'

  async function reloadDetail() {
    setLoading(true)
    setError('')
    try {
      const result = await getLearnerExamRegistration(id)
      setDetail(result)
    } catch (requestError) {
      setDetail(null)
      setError(normalizeCurrentLearnerApiMessage(requestError, 'Không tải được hồ sơ đăng ký dự thi.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitPaymentReport(formValues) {
    if (reportSubmitting) return
    setReportSubmitting(true)
    setReportError('')
    try {
      let paymentEvidenceId = null
      if (formValues.paymentEvidenceFile) {
        const uploaded = await uploadExamRegistrationPaymentEvidence(id, formValues.paymentEvidenceFile)
        paymentEvidenceId = uploaded?.paymentEvidence?.id || null
      }

      await reportExamRegistrationPayment(id, {
        paymentTransferAt: formValues.paymentTransferAt ? new Date(formValues.paymentTransferAt).toISOString() : null,
        paymentSenderName: formValues.paymentSenderName,
        paymentSenderAccount: formValues.paymentSenderAccount || null,
        paymentSenderBank: formValues.paymentSenderBank || null,
        paymentTransactionReference: formValues.paymentTransactionReference || null,
        paymentReportNote: formValues.paymentReportNote || null,
        paymentEvidenceId,
      })

      setReportModalVisible(false)
      await reloadDetail()
    } catch (submitError) {
      setReportError(normalizeCurrentLearnerApiMessage(submitError, 'Không thể gửi thông báo chuyển tiền.'))
    } finally {
      setReportSubmitting(false)
    }
  }

  return (
    <CContainer fluid className='py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='small text-body-secondary'>{detail?.registration?.registrationCode || '-'}</div>
          <div className='fs-4 fw-semibold'>Hồ sơ đăng ký dự thi</div>
          <div className='text-body-secondary'>{detail?.examRound?.code || '-'} - {detail?.examRound?.name || '-'}</div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách đợt thi</CButton>
          <CButton color='secondary' variant='outline' onClick={() => copyText(detail?.registration?.registrationCode, 'Đã sao chép mã hồ sơ')} disabled={!detail?.registration?.registrationCode}>Sao chép mã hồ sơ</CButton>
        </div>
      </div>

      {justCreated ? <CAlert color='success'>Đăng ký dự thi đã được ghi nhận.</CAlert> : null}
      {copyMessage ? <CAlert color='info'>{copyMessage}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {detail?.registration?.registrationStatus === 'accepted' ? <CAlert color='success'>Hồ sơ đăng ký đã được duyệt.</CAlert> : null}
      {detail?.registration?.registrationStatus === 'returned' ? <CAlert color='warning'>Hồ sơ cần được kiểm tra hoặc bổ sung.{detail?.review?.returnReason ? ` Lý do: ${detail.review.returnReason}` : ''}</CAlert> : null}
      {detail?.registration?.registrationStatus === 'rejected' ? <CAlert color='danger'>Hồ sơ đăng ký không được chấp nhận.{detail?.review?.rejectionReason ? ` Lý do: ${detail.review.rejectionReason}` : ''}</CAlert> : null}

      <CRow className='g-3 mb-4'>
        <CCol xl={3} md={6}>
          <CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Trạng thái hồ sơ</div><div className='mt-2'><CBadge color={registrationBadge.color}>{registrationBadge.label}</CBadge></div></CCardBody></CCard>
        </CCol>
        <CCol xl={3} md={6}>
          <CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Trạng thái thanh toán</div><div className='mt-2'><CBadge color={paymentBadge.color}>{paymentBadge.label}</CBadge></div></CCardBody></CCard>
        </CCol>
        <CCol xl={3} md={6}>
          <CCard className='h-100'><CCardBody><div className='small text-body-secondary'>{paymentDisplayState === 'confirmed' ? 'Số tiền đã thanh toán' : paymentDisplayState === 'not_required' ? 'Lệ phí' : 'Số tiền phải nộp'}</div><div className='fw-semibold'>{paymentDisplayState === 'not_required' ? 'Miễn phí' : detail?.fee?.amountDue === null || detail?.fee?.amountDue === undefined ? '-' : `${formatMoney(detail.fee.amountDue)} ${detail?.fee?.currency || 'VND'}`}</div></CCardBody></CCard>
        </CCol>
        <CCol xl={3} md={6}>
          <CCard className='h-100'><CCardBody><div className='small text-body-secondary'>{paymentDisplayState === 'confirmed' ? 'Xác nhận thanh toán' : 'Hạn thanh toán'}</div><div className='fw-semibold'>{paymentDisplayState === 'confirmed' ? formatDateTime(paymentReport?.confirmedAt) : formatDateTime(detail?.fee?.paymentDueAt)}</div></CCardBody></CCard>
        </CCol>
      </CRow>

      <CRow className='g-4'>
        <CCol xl={7}>
          <CCard className='mb-4'>
            <CCardHeader><strong>Tóm tắt hồ sơ</strong></CCardHeader>
            <CCardBody>
              <InfoItem label='Người học' value={`${detail?.learner?.fullName || '-'}${detail?.learner?.code ? ` - ${detail.learner.code}` : ''}`} />
              <InfoItem label='Ngày sinh' value={formatDateTime(detail?.learner?.dateOfBirth)} />
              <InfoItem label='Đợt thi' value={`${detail?.examRound?.code || '-'} - ${detail?.examRound?.name || '-'}`} />
              <InfoItem label='Thời gian thi' value={`${formatDateTime(detail?.examRound?.examStartAt)} - ${formatDateTime(detail?.examRound?.examEndAt)}`} />
              <InfoItem label='Thời gian đăng ký' value={formatDateTime(detail?.registration?.registeredAt)} />
              <InfoItem label='Trạng thái hồ sơ' value={getRegistrationStatusLabel(detail?.registration?.registrationStatus)} />
              <InfoItem label='Trạng thái thanh toán' value={getPaymentStatusLabel(detail?.status?.paymentStatus)} />
            </CCardBody>
          </CCard>

          <CCard className='mb-4'>
            <CCardHeader><strong>Nội dung đăng ký</strong></CCardHeader>
            <CCardBody>
              <div className='d-flex flex-column gap-3'>
                {(detail?.subjects || []).map((subject) => (
                  <div key={subject.id} className='border rounded p-3'>
                    <div className='d-flex justify-content-between gap-2 flex-wrap mb-2'>
                      <div className='fw-semibold'>{subject.subjectCodeSnapshot ? `${subject.subjectCodeSnapshot} - ` : ''}{subject.nameSnapshot}</div>
                      <CBadge color={subject.isRequired ? 'danger' : 'secondary'}>{subject.isRequired ? 'Môn bắt buộc' : 'Môn tự chọn'}</CBadge>
                    </div>
                    {showSubjectFee ? <div className='small text-body-secondary mb-2'>Phí môn: {`${formatMoney(subject.feeAmount || 0)} ${detail?.fee?.currency || 'VND'}`}</div> : null}
                    <div className='d-flex flex-column gap-2'>
                      {(subject.components || []).map((component) => (
                        <div key={component.id} className='border rounded p-2 bg-body-tertiary'>
                          <div className='d-flex justify-content-between gap-2 flex-wrap'>
                            <div>{component.componentCodeSnapshot ? `${component.componentCodeSnapshot} - ` : ''}{component.nameSnapshot}</div>
                            <CBadge color={component.isRequired ? 'danger' : 'secondary'}>{component.isRequired ? 'Bắt buộc' : 'Tự chọn'}</CBadge>
                          </div>
                          {showComponentFee ? <div className='small text-body-secondary mt-1'>Phí: {`${formatMoney(component.feeAmount || 0)} ${detail?.fee?.currency || 'VND'}`}</div> : null}
                          <div className='small text-body-secondary'>Thời lượng: {component.durationMinutes ? `${component.durationMinutes} phút` : '-'} · Hình thức: {getExamMethodLabel(component.examMethod)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CCardBody>
          </CCard>

          <CCard>
            <CCardHeader><strong>Lệ phí</strong></CCardHeader>
            <CCardBody>
              {feeDisplay.rows.map((row) => (
                <div key={row.key} className='d-flex justify-content-between py-1'>
                  <span>{row.label}</span>
                  <strong>{row.variant === 'free' ? 'Miễn phí' : `${formatMoney(row.amount || 0)} ${feeDisplay.currency || 'VND'}`}</strong>
                </div>
              ))}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={5}>
          <ExamRegistrationPaymentPanel
            paymentStatus={detail?.status?.paymentStatus}
            payment={payment}
            paymentReport={paymentReport}
            paymentEvidence={paymentEvidence}
            paymentEvidenceUrl={paymentEvidenceUrl}
            qrImageUrl={qrImageUrl}
            amountDue={detail?.fee?.amountDue}
            confirmedPaidAmount={detail?.fee?.confirmedPaidAmount}
            currency={detail?.fee?.currency || 'VND'}
            registrationCode={detail?.registration?.registrationCode}
            canReportPayment={canReportPayment}
            onOpenReport={() => { setReportError(''); setReportModalVisible(true) }}
            onCopy={copyText}
          />

          {detail?.support ? (
            <CCard>
              <CCardHeader><strong>Hỗ trợ</strong></CCardHeader>
              <CCardBody>
                <InfoItem label='Đơn vị' value={detail.support.organizationName || '-'} />
                <InfoItem label='Ghi chú' value={detail.support.supportNote || '-'} />
              </CCardBody>
            </CCard>
          ) : null}
        </CCol>
      </CRow>

      <LearnerPaymentReportModal
        visible={reportModalVisible}
        detail={detail}
        submitting={reportSubmitting}
        error={reportError}
        onClose={() => !reportSubmitting && setReportModalVisible(false)}
        onSubmit={handleSubmitPaymentReport}
      />
    </CContainer>
  )
}