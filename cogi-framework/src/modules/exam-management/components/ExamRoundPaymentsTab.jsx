import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  applyExamRoundPaymentProfile,
  confirmExamRegistrationPayment,
  getExamRoundPaymentDetail,
  getExamRoundPaymentSummary,
  listExamRoundPayments,
  rejectExamRegistrationPaymentReport,
  listExamRoundPaymentProfiles,
  updateExamRoundPaymentSettings,
  uploadExamRoundPaymentMedia,
} from '../services/examRoundApi'
import {
  canEditExamRoundPaymentSettings,
  formatDateTime,
  formatMoney,
  getPaymentCalculationMethodLabel,
  getPaymentMethodLabel,
  isExamRoundPaymentOptional,
} from '../utils/examRoundUi'
import { getPaymentProfileMethodLabel, getPaymentProfileReceiverSummary } from '../../content-management/utils/paymentProfileUi'
import { getPaymentStatusBadge, getPaymentStatusLabel, getRegistrationStatusLabel } from '../utils/learnerExamUi'
import { buildProtectedFileUrl, resolveMediaUrl } from '../../../utils/mediaUrl'

function buildSnapshotForm(round) {
  return {
    paymentMethodSnapshot: round?.paymentSettings?.snapshot?.paymentMethod || 'bank_transfer',
    paymentBankCodeSnapshot: round?.paymentSettings?.snapshot?.bankCode || '',
    paymentBankNameSnapshot: round?.paymentSettings?.snapshot?.bankName || '',
    paymentAccountNumberSnapshot: round?.paymentSettings?.snapshot?.accountNumber || '',
    paymentAccountHolderSnapshot: round?.paymentSettings?.snapshot?.accountHolder || '',
    paymentBankBranchSnapshot: round?.paymentSettings?.snapshot?.bankBranch || '',
    paymentCurrencySnapshot: round?.paymentSettings?.snapshot?.currency || 'VND',
    paymentTransferContentTemplateSnapshot: round?.paymentSettings?.snapshot?.transferContentTemplate || '',
    paymentInstructionSnapshot: round?.paymentSettings?.snapshot?.paymentInstruction || '',
    paymentSupportPhoneSnapshot: round?.paymentSettings?.snapshot?.supportPhone || '',
    paymentSupportEmailSnapshot: round?.paymentSettings?.snapshot?.supportEmail || '',
    paymentQrImageSnapshot: round?.paymentSettings?.snapshot?.qrImage || null,
  }
}

function getApiMessage(error, fallback) {
  const code = String(error?.response?.data?.code || '').trim()
  const backendError = error?.response?.data?.error
  const backendMessage = typeof backendError === 'string'
    ? backendError
    : backendError?.message || error?.response?.data?.message || error?.message || fallback
  const mapped = {
    PAYMENT_PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ thanh toán trong tenant hiện tại.',
    PAYMENT_PROFILE_INACTIVE_CANNOT_BE_DEFAULT: 'Không thể áp dụng hồ sơ thanh toán đang ngừng sử dụng.',
    PAYMENT_PROFILE_BANK_INFO_REQUIRED: 'Thiếu thông tin tài khoản ngân hàng cho cấu hình hiện tại.',
    PAYMENT_TRANSFER_TEMPLATE_INVALID_PLACEHOLDER: 'Mẫu nội dung chuyển khoản đang chứa placeholder không được hỗ trợ.',
    PAYMENT_PROFILE_INVALID_QR_IMAGE: 'Ảnh QR không hợp lệ.',
    EXAM_ROUND_PAYMENT_SETTINGS_NOT_EDITABLE: 'Trạng thái đợt thi hiện không cho phép chỉnh cấu hình thanh toán.',
  }[code]
  return mapped || String(backendMessage || fallback || '').trim()
}

function validateSnapshotForm(form) {
  const errors = {}
  const method = String(form.paymentMethodSnapshot || '').trim().toLowerCase()
  if (!method) errors.paymentMethodSnapshot = 'Phương thức thanh toán là bắt buộc.'
  if (!String(form.paymentCurrencySnapshot || '').trim()) errors.paymentCurrencySnapshot = 'Loại tiền là bắt buộc.'
  if (String(form.paymentSupportEmailSnapshot || '').trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.paymentSupportEmailSnapshot || '').trim().toLowerCase())) {
      errors.paymentSupportEmailSnapshot = 'Email hỗ trợ không hợp lệ.'
    }
  }
  if (method === 'bank_transfer') {
    if (!String(form.paymentBankCodeSnapshot || '').trim() && !String(form.paymentBankNameSnapshot || '').trim()) {
      errors.paymentBankNameSnapshot = 'Cần nhập mã ngân hàng hoặc tên ngân hàng.'
    }
    if (!String(form.paymentAccountNumberSnapshot || '').trim()) {
      errors.paymentAccountNumberSnapshot = 'Số tài khoản là bắt buộc cho chuyển khoản ngân hàng.'
    }
    if (!String(form.paymentAccountHolderSnapshot || '').trim()) {
      errors.paymentAccountHolderSnapshot = 'Chủ tài khoản là bắt buộc cho chuyển khoản ngân hàng.'
    }
  }
  return errors
}

function getPaymentAdminApiMessage(error, fallback) {
  const code = String(error?.response?.data?.code || '').trim()
  const mapped = {
    EXAM_ROUND_NOT_FOUND: 'Không tìm thấy đợt thi trong tenant hiện tại.',
    EXAM_REGISTRATION_NOT_FOUND: 'Không tìm thấy hồ sơ đăng ký phù hợp.',
    PAYMENT_NOT_REQUIRED: 'Hồ sơ này không yêu cầu thanh toán.',
    PAYMENT_ALREADY_CONFIRMED: 'Khoản thanh toán này đã được xác nhận trước đó.',
    PAYMENT_CONFIRMATION_NOT_ALLOWED: 'Hồ sơ này hiện chưa thể xác nhận thanh toán.',
    PAYMENT_REPORT_REJECTION_NOT_ALLOWED: 'Hồ sơ này hiện chưa thể trả lại thông báo thanh toán.',
    PAYMENT_REPORT_ALREADY_REJECTED: 'Thông báo thanh toán đã được trả lại trước đó.',
    PAYMENT_REJECTION_REASON_REQUIRED: 'Bạn cần nhập lý do trả lại thông báo thanh toán.',
    REGISTRATION_CANCELLED: 'Hồ sơ đăng ký đã bị hủy.',
    REGISTRATION_REJECTED: 'Hồ sơ đăng ký đã bị từ chối.',
    CONCURRENT_PAYMENT_UPDATE: 'Trạng thái thanh toán đã được người khác cập nhật. Vui lòng tải lại dữ liệu.',
    CROSS_TENANT_ACCESS: 'Bạn không có quyền truy cập dữ liệu của tenant khác.',
  }[code]
  return mapped || getApiMessage(error, fallback)
}

function buildPaymentListParams(filters) {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    ...(String(filters.keyword || '').trim() ? { keyword: String(filters.keyword || '').trim() } : {}),
    ...(String(filters.paymentStatus || '').trim() ? { paymentStatus: String(filters.paymentStatus || '').trim() } : {}),
    ...(String(filters.hasEvidence || '').trim() ? { hasEvidence: String(filters.hasEvidence || '').trim() } : {}),
  }
}

function canConfirmPayment(item) {
  return String(item?.paymentStatus || '').trim().toLowerCase() === 'payment_reported'
}

function canRejectPayment(item) {
  return String(item?.paymentStatus || '').trim().toLowerCase() === 'payment_reported'
}

function PaymentStatCard({ label, value, color = 'secondary', helper }) {
  return (
    <CCard className='h-100'>
      <CCardBody>
        <div className='small text-body-secondary mb-1'>{label}</div>
        <div className={`fs-4 fw-semibold text-${color}`}>{value}</div>
        {helper ? <div className='small text-body-secondary mt-1'>{helper}</div> : null}
      </CCardBody>
    </CCard>
  )
}

export default function ExamRoundPaymentsTab({ round, permissions, onRefresh, onOpenConfiguration }) {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const editable = canEditExamRoundPaymentSettings(round, permissions)
  const canManagePayments = permissions?.canManage === true || permissions?.canApprove === true
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [profilesError, setProfilesError] = useState('')
  const [search, setSearch] = useState('')
  const [showSelector, setShowSelector] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [snapshotForm, setSnapshotForm] = useState(() => buildSnapshotForm(round))
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [paymentSummaryLoading, setPaymentSummaryLoading] = useState(false)
  const [paymentSummaryError, setPaymentSummaryError] = useState('')
  const [paymentSummary, setPaymentSummary] = useState(null)
  const [paymentListLoading, setPaymentListLoading] = useState(false)
  const [paymentListError, setPaymentListError] = useState('')
  const [paymentRows, setPaymentRows] = useState([])
  const [paymentPagination, setPaymentPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [paymentFilters, setPaymentFilters] = useState({ page: 1, pageSize: 10, keyword: '', paymentStatus: 'payment_reported', hasEvidence: '' })
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [showPaymentDetail, setShowPaymentDetail] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [actionTarget, setActionTarget] = useState(null)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [confirmNote, setConfirmNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    setSnapshotForm(buildSnapshotForm(round))
    setFieldErrors({})
  }, [round])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  useEffect(() => {
    if (!canManagePayments || !round?.id) return
    loadPaymentSummary()
  }, [canManagePayments, round?.id])

  useEffect(() => {
    if (!canManagePayments || !round?.id) return
    loadPaymentList(paymentFilters)
  }, [canManagePayments, round?.id, paymentFilters.page, paymentFilters.pageSize, paymentFilters.paymentStatus, paymentFilters.hasEvidence])

  const selectedProfile = useMemo(() => profiles.find((item) => String(item?.id) === String(selectedProfileId)) || null, [profiles, selectedProfileId])
  const transferTemplatePreview = useMemo(() => {
    const template = String(snapshotForm.paymentTransferContentTemplateSnapshot || '').trim()
    if (!template) return ''
    return template
      .replaceAll('{registrationCode}', 'DKTHI000123')
      .replaceAll('{learnerCode}', 'SV20260001')
      .replaceAll('{fullName}', 'Nguyen Van A')
      .replaceAll('{roundCode}', round?.code || 'ROUND2026A')
  }, [round?.code, snapshotForm.paymentTransferContentTemplateSnapshot])

  async function loadProfiles(keyword = '') {
    setProfilesLoading(true)
    setProfilesError('')
    try {
      const rows = await listExamRoundPaymentProfiles({ page: 1, pageSize: 100, search: keyword })
      setProfiles(Array.isArray(rows) ? rows : [])
    } catch (requestError) {
      setProfiles([])
      setProfilesError(getApiMessage(requestError, 'Không tải được danh sách hồ sơ thanh toán.'))
    } finally {
      setProfilesLoading(false)
    }
  }

  async function loadPaymentSummary() {
    if (!round?.id) return
    setPaymentSummaryLoading(true)
    setPaymentSummaryError('')
    try {
      const data = await getExamRoundPaymentSummary(round.id)
      setPaymentSummary(data || null)
    } catch (requestError) {
      setPaymentSummary(null)
      setPaymentSummaryError(getPaymentAdminApiMessage(requestError, 'Không tải được tổng quan thanh toán.'))
    } finally {
      setPaymentSummaryLoading(false)
    }
  }

  async function loadPaymentList(filters = paymentFilters) {
    if (!round?.id) return
    setPaymentListLoading(true)
    setPaymentListError('')
    try {
      const result = await listExamRoundPayments(round.id, buildPaymentListParams(filters))
      setPaymentRows(Array.isArray(result?.data) ? result.data : [])
      setPaymentPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
    } catch (requestError) {
      setPaymentRows([])
      setPaymentPagination({ page: filters.page || 1, pageSize: filters.pageSize || 10, total: 0, pageCount: 1 })
      setPaymentListError(getPaymentAdminApiMessage(requestError, 'Không tải được danh sách thanh toán của đợt thi.'))
    } finally {
      setPaymentListLoading(false)
    }
  }

  async function refreshPaymentManagement() {
    await Promise.all([
      loadPaymentSummary(),
      loadPaymentList(paymentFilters),
      onRefresh?.(),
    ])
  }

  function openSelector() {
    setError('')
    setProfiles([])
    setSearch('')
    setSelectedProfileId('')
    setShowSelector(true)
    loadProfiles('')
  }

  function closeSelector() {
    if (submitting) return
    setShowSelector(false)
    setProfilesError('')
  }

  async function handleApplyProfile(profileId) {
    const confirmed = window.confirm('Áp dụng hồ sơ thanh toán này cho đợt thi? Thông tin thanh toán hiện tại của đợt sẽ được thay bằng dữ liệu từ hồ sơ đã chọn.')
    if (!confirmed) return

    setSubmitting(true)
    setError('')
    try {
      const result = await applyExamRoundPaymentProfile(round?.id, profileId)
      const warnings = Array.isArray(result?.warnings) ? result.warnings : []
      setSuccess(warnings.length > 0 ? `Đã áp dụng hồ sơ thanh toán. ${warnings.map((item) => item.message).join(' ')}` : 'Đã áp dụng hồ sơ thanh toán cho đợt thi.')
      closeSelector()
      await onRefresh?.()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể áp dụng hồ sơ thanh toán.'))
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit() {
    setSnapshotForm(buildSnapshotForm(round))
    setFieldErrors({})
    setError('')
    setShowEdit(true)
  }

  function closeEdit() {
    if (submitting) return
    setShowEdit(false)
  }

  function updateSnapshotField(key, value) {
    setSnapshotForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function handleSnapshotQrChange(file) {
    if (!file) return
    setSubmitting(true)
    setError('')
    try {
      const uploaded = await uploadExamRoundPaymentMedia(file)
      if (!uploaded?.id) throw new Error('Không nhận được dữ liệu media sau khi upload')
      setSnapshotForm((current) => ({ ...current, paymentQrImageSnapshot: uploaded }))
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể upload ảnh QR cho đợt thi.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveSnapshot(event) {
    event.preventDefault()
    const nextErrors = validateSnapshotForm(snapshotForm)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setError('')
    try {
      const result = await updateExamRoundPaymentSettings(round?.id, {
        paymentMethodSnapshot: snapshotForm.paymentMethodSnapshot,
        paymentBankCodeSnapshot: snapshotForm.paymentBankCodeSnapshot || null,
        paymentBankNameSnapshot: snapshotForm.paymentBankNameSnapshot || null,
        paymentAccountNumberSnapshot: snapshotForm.paymentAccountNumberSnapshot || null,
        paymentAccountHolderSnapshot: snapshotForm.paymentAccountHolderSnapshot || null,
        paymentBankBranchSnapshot: snapshotForm.paymentBankBranchSnapshot || null,
        paymentCurrencySnapshot: snapshotForm.paymentCurrencySnapshot || null,
        paymentTransferContentTemplateSnapshot: snapshotForm.paymentTransferContentTemplateSnapshot || null,
        paymentInstructionSnapshot: snapshotForm.paymentInstructionSnapshot || null,
        paymentSupportPhoneSnapshot: snapshotForm.paymentSupportPhoneSnapshot || null,
        paymentSupportEmailSnapshot: snapshotForm.paymentSupportEmailSnapshot || null,
        paymentQrImageSnapshot: snapshotForm.paymentQrImageSnapshot?.id || null,
      })
      const warnings = Array.isArray(result?.warnings) ? result.warnings : []
      setSuccess(warnings.length > 0 ? `Đã cập nhật thông tin nhận thanh toán của đợt. ${warnings.map((item) => item.message).join(' ')}` : 'Đã cập nhật thông tin nhận thanh toán của đợt.')
      closeEdit()
      await onRefresh?.()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật snapshot thanh toán của đợt.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function openPaymentDetail(registrationId) {
    if (!registrationId || !round?.id) return
    setDetailLoading(true)
    setDetailError('')
    setShowPaymentDetail(true)
    try {
      const data = await getExamRoundPaymentDetail(round.id, registrationId)
      setSelectedPaymentDetail(data || null)
    } catch (requestError) {
      setSelectedPaymentDetail(null)
      setDetailError(getPaymentAdminApiMessage(requestError, 'Không tải được chi tiết thông báo thanh toán.'))
    } finally {
      setDetailLoading(false)
    }
  }

  function closePaymentDetail() {
    if (actionSubmitting) return
    setShowPaymentDetail(false)
    setSelectedPaymentDetail(null)
    setDetailError('')
  }

  function openConfirmDialog(item) {
    setActionTarget(item)
    setConfirmNote('')
    setShowConfirmDialog(true)
  }

  function closeConfirmDialog() {
    if (actionSubmitting) return
    setShowConfirmDialog(false)
    setActionTarget(null)
    setConfirmNote('')
  }

  function openRejectDialog(item) {
    setActionTarget(item)
    setRejectReason('')
    setShowRejectDialog(true)
  }

  function closeRejectDialog() {
    if (actionSubmitting) return
    setShowRejectDialog(false)
    setActionTarget(null)
    setRejectReason('')
  }

  async function handleConfirmPayment() {
    if (!actionTarget?.id || !round?.id) return
    setActionSubmitting(true)
    setError('')
    try {
      await confirmExamRegistrationPayment(round.id, actionTarget.id, {
        confirmationNote: String(confirmNote || '').trim() || null,
      })
      setSuccess('Đã xác nhận đã nhận tiền cho hồ sơ đăng ký.')
      closeConfirmDialog()
      if (showPaymentDetail && selectedPaymentDetail?.registration?.id === actionTarget.id) {
        await openPaymentDetail(actionTarget.id)
      }
      await refreshPaymentManagement()
    } catch (requestError) {
      setError(getPaymentAdminApiMessage(requestError, 'Không thể xác nhận thanh toán.'))
    } finally {
      setActionSubmitting(false)
    }
  }

  async function handleRejectPayment() {
    if (!actionTarget?.id || !round?.id) return
    if (!String(rejectReason || '').trim()) {
      setError('Bạn cần nhập lý do trả lại thông báo thanh toán.')
      return
    }
    setActionSubmitting(true)
    setError('')
    try {
      await rejectExamRegistrationPaymentReport(round.id, actionTarget.id, {
        reason: String(rejectReason || '').trim(),
      })
      setSuccess('Đã trả lại thông báo thanh toán để người đăng ký kiểm tra.')
      closeRejectDialog()
      if (showPaymentDetail && selectedPaymentDetail?.registration?.id === actionTarget.id) {
        await openPaymentDetail(actionTarget.id)
      }
      await refreshPaymentManagement()
    } catch (requestError) {
      setError(getPaymentAdminApiMessage(requestError, 'Không thể trả lại thông báo thanh toán.'))
    } finally {
      setActionSubmitting(false)
    }
  }

  const paymentProfile = round?.paymentSettings?.paymentProfile || null
  const snapshot = round?.paymentSettings?.snapshot || {}
  const isFreeRound = isExamRoundPaymentOptional(round)
  const paymentProfilesPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/tenant/settings/payment-profiles` : '/tenant/settings/payment-profiles'

  return (
    <div className='d-flex flex-column gap-4'>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      <CCard>
        <CCardHeader><strong>Tóm tắt cấu hình phí</strong></CCardHeader>
        <CCardBody>
          <CRow className='g-3'>
            <CCol md={4}><div className='small text-body-secondary'>Phương thức tính phí</div><div className='fw-semibold'>{getPaymentCalculationMethodLabel(round?.paymentCalculationMethod)}</div></CCol>
            <CCol md={4}><div className='small text-body-secondary'>Phí cố định</div><div className='fw-semibold'>{round?.fixedFee !== null && round?.fixedFee !== undefined && round?.fixedFee !== '' ? `${formatMoney(round.fixedFee)} VND` : '-'}</div></CCol>
            <CCol md={4}><div className='small text-body-secondary'>Yêu cầu xác nhận thanh toán</div><div className='fw-semibold'>{round?.requireConfirmedPayment ? 'Có' : 'Không'}</div></CCol>
            <CCol md={6}><div className='small text-body-secondary'>Bắt đầu thanh toán</div><div>{formatDateTime(round?.paymentStartAt)}</div></CCol>
            <CCol md={6}><div className='small text-body-secondary'>Kết thúc thanh toán</div><div>{formatDateTime(round?.paymentEndAt)}</div></CCol>
          </CRow>
          <div className='d-flex justify-content-end mt-3'>
            <CButton color='secondary' variant='outline' onClick={() => onOpenConfiguration?.()}>Đi tới tab Cấu hình</CButton>
          </div>
          {isFreeRound ? <CAlert color='info' className='mt-3 mb-0'>Đợt thi không yêu cầu thanh toán theo cấu hình hiện tại. Bạn vẫn có thể lưu thông tin nhận tiền để dùng về sau nếu cần.</CAlert> : null}
        </CCardBody>
      </CCard>

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <strong>Hồ sơ thanh toán đang áp dụng</strong>
            <div className='small text-body-secondary mt-1'>Chọn hồ sơ nguồn của tenant hoặc điều chỉnh snapshot riêng cho đợt thi.</div>
          </div>
          <div className='d-flex gap-2 flex-wrap'>
            {editable ? <CButton color='primary' onClick={openSelector}>{paymentProfile ? 'Thay đổi hồ sơ' : 'Chọn hồ sơ thanh toán'}</CButton> : null}
            {editable && paymentProfile ? <CButton color='secondary' variant='outline' onClick={() => handleApplyProfile(paymentProfile.id)} disabled={submitting}>Áp dụng lại từ hồ sơ nguồn</CButton> : null}
            {editable ? <CButton color='warning' variant='outline' onClick={openEdit}>Chỉnh snapshot của đợt</CButton> : null}
          </div>
        </CCardHeader>
        <CCardBody>
          {!paymentProfile ? (
            isFreeRound ? <CAlert color='secondary' className='mb-0'>Đợt thi hiện không bắt buộc cấu hình hồ sơ thanh toán do lệ phí đang bằng 0 và không yêu cầu xác nhận thanh toán.</CAlert> : (
              <div className='border rounded p-4 text-center bg-body-tertiary'>
                <div className='fs-5 fw-semibold mb-2'>Chưa cấu hình thông tin nhận thanh toán</div>
                <div className='text-body-secondary mb-3'>Chọn một hồ sơ thanh toán của tenant để cung cấp tài khoản nhận tiền và hướng dẫn chuyển khoản cho người đăng ký.</div>
                <div className='d-flex justify-content-center gap-2 flex-wrap'>
                  {editable ? <CButton color='primary' onClick={openSelector}>Chọn hồ sơ thanh toán</CButton> : null}
                  <CButton color='secondary' variant='outline' onClick={() => navigate(paymentProfilesPath)}>Quản lý hồ sơ thanh toán</CButton>
                </div>
              </div>
            )
          ) : (
            <CRow className='g-3'>
              <CCol md={4}><div className='small text-body-secondary'>Tên hồ sơ</div><div className='fw-semibold'>{paymentProfile.name || '-'}</div><div className='small text-body-secondary'>{paymentProfile.code || '-'}</div></CCol>
              <CCol md={4}><div className='small text-body-secondary'>Trạng thái profile nguồn</div><div><CBadge color={paymentProfile.isActive ? 'success' : 'secondary'}>{paymentProfile.isActive ? 'Đang hoạt động' : 'Ngừng sử dụng'}</CBadge> <CBadge color={paymentProfile.isDefault ? 'primary' : 'secondary'}>{paymentProfile.isDefault ? 'Mặc định' : 'Thường'}</CBadge></div></CCol>
              <CCol md={4}><div className='small text-body-secondary'>Trạng thái snapshot</div><div><CBadge color={round?.paymentSettings?.customized ? 'warning' : 'info'}>{round?.paymentSettings?.customized ? 'Đã điều chỉnh riêng' : 'Theo hồ sơ nguồn'}</CBadge></div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Thời điểm áp dụng</div><div>{formatDateTime(round?.paymentSettings?.appliedAt)}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Người áp dụng</div><div>{round?.paymentSettings?.appliedBy?.displayName || round?.paymentSettings?.appliedBy?.fullName || '-'}</div></CCol>
            </CRow>
          )}
        </CCardBody>
      </CCard>

      <CRow className='g-4'>
        <CCol xl={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Thông tin nhận tiền</strong></CCardHeader>
            <CCardBody>
              <div className='mb-2'><span className='small text-body-secondary'>Phương thức</span><div>{getPaymentMethodLabel(snapshot.paymentMethod)}</div></div>
              <div className='mb-2'><span className='small text-body-secondary'>Mã ngân hàng</span><div>{snapshot.bankCode || '-'}</div></div>
              <div className='mb-2'><span className='small text-body-secondary'>Ngân hàng</span><div>{snapshot.bankName || '-'}</div></div>
              <div className='mb-2'><span className='small text-body-secondary'>Số tài khoản</span><div className='fw-semibold'>{snapshot.accountNumber || '-'}</div></div>
              <div className='mb-2'><span className='small text-body-secondary'>Chủ tài khoản</span><div>{snapshot.accountHolder || '-'}</div></div>
              <div className='mb-2'><span className='small text-body-secondary'>Chi nhánh</span><div>{snapshot.bankBranch || '-'}</div></div>
              <div className='mb-2'><span className='small text-body-secondary'>Tiền tệ</span><div>{snapshot.currency || '-'}</div></div>
              <div><span className='small text-body-secondary'>Ảnh QR</span><div className='mt-2'>{snapshot.qrImage?.url ? <img src={snapshot.qrImage.url} alt='QR snapshot' style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }} /> : 'Chưa có ảnh QR'}</div></div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Nội dung chuyển khoản và hỗ trợ</strong></CCardHeader>
            <CCardBody>
              <div className='mb-2'><span className='small text-body-secondary'>Template chuyển khoản</span><div>{snapshot.transferContentTemplate || '-'}</div></div>
              {snapshot.transferContentTemplate ? <div className='small text-body-secondary mb-3'>Minh họa: <strong>{transferTemplatePreview}</strong></div> : null}
              <div className='mb-2'><span className='small text-body-secondary'>Hướng dẫn thanh toán</span><div style={{ whiteSpace: 'pre-wrap' }}>{snapshot.paymentInstruction || 'Chưa có hướng dẫn.'}</div></div>
              <div className='mb-2'><span className='small text-body-secondary'>Điện thoại hỗ trợ</span><div>{snapshot.supportPhone || '-'}</div></div>
              <div><span className='small text-body-secondary'>Email hỗ trợ</span><div>{snapshot.supportEmail || '-'}</div></div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <strong>Quản lý thanh toán của người đăng ký</strong>
            <div className='small text-body-secondary mt-1'>Theo dõi tình trạng báo chuyển tiền, xác nhận hoặc trả lại thông báo thanh toán của các hồ sơ trong đợt thi này.</div>
          </div>
          <div className='d-flex gap-2 flex-wrap'>
            <CButton color='secondary' variant='outline' onClick={loadPaymentSummary} disabled={paymentSummaryLoading}>Làm mới tổng quan</CButton>
            <CButton color='secondary' variant='outline' onClick={() => loadPaymentList(paymentFilters)} disabled={paymentListLoading}>Làm mới danh sách</CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          {paymentSummaryError ? <CAlert color='warning' className='mb-4'>{paymentSummaryError}</CAlert> : null}
          <CRow className='g-3 mb-4'>
            <CCol xl={2} md={4} sm={6}><PaymentStatCard label='Tổng hồ sơ' value={paymentSummaryLoading ? '...' : (paymentSummary?.totalRegistrations ?? 0)} color='dark' /></CCol>
            <CCol xl={2} md={4} sm={6}><PaymentStatCard label='Chưa thanh toán' value={paymentSummaryLoading ? '...' : (paymentSummary?.unpaid ?? 0)} color='warning' /></CCol>
            <CCol xl={2} md={4} sm={6}><PaymentStatCard label='Đã báo chuyển tiền' value={paymentSummaryLoading ? '...' : (paymentSummary?.reported ?? 0)} color='info' /></CCol>
            <CCol xl={2} md={4} sm={6}><PaymentStatCard label='Đã xác nhận' value={paymentSummaryLoading ? '...' : (paymentSummary?.confirmed ?? 0)} color='success' /></CCol>
            <CCol xl={2} md={4} sm={6}><PaymentStatCard label='Không yêu cầu' value={paymentSummaryLoading ? '...' : (paymentSummary?.notRequired ?? 0)} color='success' /></CCol>
            <CCol xl={2} md={4} sm={6}><PaymentStatCard label='Đã trả lại' value={paymentSummaryLoading ? '...' : (paymentSummary?.rejected ?? 0)} color='danger' /></CCol>
            <CCol xl={4} md={6}><PaymentStatCard label='Tổng phải thu' value={paymentSummaryLoading ? '...' : `${formatMoney(paymentSummary?.amountDueTotal || 0)} VND`} helper='Chỉ cộng các hồ sơ còn nghĩa vụ thanh toán của đợt.' /></CCol>
            <CCol xl={4} md={6}><PaymentStatCard label='Đang chờ xác nhận' value={paymentSummaryLoading ? '...' : `${formatMoney(paymentSummary?.amountPendingConfirmation || 0)} VND`} helper='Khoản người học đã báo chuyển tiền nhưng nhà trường chưa xác nhận.' color='info' /></CCol>
            <CCol xl={4} md={6}><PaymentStatCard label='Đã xác nhận' value={paymentSummaryLoading ? '...' : `${formatMoney(paymentSummary?.amountConfirmedTotal || 0)} VND`} helper='Chỉ cộng hồ sơ đã được xác nhận nhận tiền.' color='success' /></CCol>
          </CRow>

          <div className='border rounded p-3 mb-4'>
            <CRow className='g-3 align-items-end'>
              <CCol lg={4} md={6}>
                <CFormLabel>Tìm kiếm</CFormLabel>
                <CFormInput value={paymentFilters.keyword} onChange={(event) => setPaymentFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder='Mã hồ sơ, learner, người chuyển, mã giao dịch...' />
              </CCol>
              <CCol lg={3} md={6}>
                <CFormLabel>Trạng thái thanh toán</CFormLabel>
                <CFormSelect value={paymentFilters.paymentStatus} onChange={(event) => setPaymentFilters((current) => ({ ...current, page: 1, paymentStatus: event.target.value }))}>
                  <option value=''>Tất cả</option>
                  <option value='unpaid'>Chưa thanh toán</option>
                  <option value='payment_reported'>Đã báo chuyển tiền</option>
                  <option value='paid'>Đã xác nhận</option>
                  <option value='not_required'>Không yêu cầu thanh toán</option>
                  <option value='payment_rejected'>Đã trả lại</option>
                </CFormSelect>
              </CCol>
              <CCol lg={3} md={6}>
                <CFormLabel>Chứng từ</CFormLabel>
                <CFormSelect value={paymentFilters.hasEvidence} onChange={(event) => setPaymentFilters((current) => ({ ...current, page: 1, hasEvidence: event.target.value }))}>
                  <option value=''>Tất cả</option>
                  <option value='true'>Có chứng từ</option>
                  <option value='false'>Không có chứng từ</option>
                </CFormSelect>
              </CCol>
              <CCol lg={2} md={6}>
                <div className='d-flex gap-2'>
                  <CButton color='secondary' variant='outline' onClick={() => setPaymentFilters({ page: 1, pageSize: paymentFilters.pageSize, keyword: '', paymentStatus: 'payment_reported', hasEvidence: '' })}>Xóa lọc</CButton>
                  <CButton color='primary' onClick={() => loadPaymentList({ ...paymentFilters, page: 1 })}>Tìm</CButton>
                </div>
              </CCol>
            </CRow>
          </div>

          {paymentListError ? <CAlert color='danger'>{paymentListError}</CAlert> : null}
          {paymentListLoading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải danh sách thanh toán...</div> : null}

          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Mã hồ sơ</CTableHeaderCell>
                <CTableHeaderCell>Người học</CTableHeaderCell>
                <CTableHeaderCell>Số tiền</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái thanh toán</CTableHeaderCell>
                <CTableHeaderCell>Thời điểm báo chuyển</CTableHeaderCell>
                <CTableHeaderCell>Người chuyển</CTableHeaderCell>
                <CTableHeaderCell>Mã giao dịch</CTableHeaderCell>
                <CTableHeaderCell>Chứng từ</CTableHeaderCell>
                <CTableHeaderCell>Cập nhật</CTableHeaderCell>
                <CTableHeaderCell>Thao tác</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {paymentRows.length === 0 && !paymentListLoading ? (
                <CTableRow><CTableDataCell colSpan={10} className='text-center text-body-secondary py-4'>Chưa có hồ sơ thanh toán phù hợp với bộ lọc hiện tại.</CTableDataCell></CTableRow>
              ) : null}
              {paymentRows.map((item) => {
                const paymentBadge = getPaymentStatusBadge(item.paymentStatus)
                return (
                  <CTableRow key={item.id}>
                    <CTableDataCell><div className='fw-semibold'>{item.registrationCode || '-'}</div></CTableDataCell>
                    <CTableDataCell><div>{item.learner?.fullName || '-'}</div><div className='small text-body-secondary'>{item.learner?.code || '-'}</div></CTableDataCell>
                    <CTableDataCell>{`${formatMoney(item.amountDue || 0)} ${item.currency || 'VND'}`}</CTableDataCell>
                    <CTableDataCell><CBadge color={paymentBadge.color}>{paymentBadge.label}</CBadge><div className='small text-body-secondary mt-1'>{getRegistrationStatusLabel(item.registrationStatus)}</div></CTableDataCell>
                    <CTableDataCell>{formatDateTime(item.paymentReportedAt)}</CTableDataCell>
                    <CTableDataCell><div>{item.paymentSenderName || '-'}</div><div className='small text-body-secondary'>{item.paymentSenderBank || item.maskedPaymentSenderAccount || ''}</div></CTableDataCell>
                    <CTableDataCell>{item.paymentTransactionReference || '-'}</CTableDataCell>
                    <CTableDataCell>{item.hasEvidence ? <CBadge color='info'>Có</CBadge> : <CBadge color='secondary'>Không</CBadge>}</CTableDataCell>
                    <CTableDataCell>{formatDateTime(item.updatedAt)}</CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton color='secondary' size='sm' variant='outline' onClick={() => openPaymentDetail(item.id)}>Xem chi tiết</CButton>
                        {canConfirmPayment(item) ? <CButton color='success' size='sm' variant='outline' onClick={() => openConfirmDialog(item)}>Xác nhận</CButton> : null}
                        {canRejectPayment(item) ? <CButton color='warning' size='sm' variant='outline' onClick={() => openRejectDialog(item)}>Trả lại</CButton> : null}
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>

          <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mt-3'>
            <div className='small text-body-secondary'>Trang {paymentPagination.page || 1}/{paymentPagination.pageCount || 1} · Tổng {paymentPagination.total || 0} hồ sơ</div>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' disabled={(paymentPagination.page || 1) <= 1 || paymentListLoading} onClick={() => setPaymentFilters((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))}>Trang trước</CButton>
              <CButton color='secondary' variant='outline' disabled={(paymentPagination.page || 1) >= (paymentPagination.pageCount || 1) || paymentListLoading} onClick={() => setPaymentFilters((current) => ({ ...current, page: Math.min(paymentPagination.pageCount || 1, (current.page || 1) + 1) }))}>Trang sau</CButton>
            </div>
          </div>
        </CCardBody>
      </CCard>

      <CModal visible={showSelector} onClose={closeSelector} size='xl' scrollable>
        <CModalHeader><CModalTitle>Chọn hồ sơ thanh toán</CModalTitle></CModalHeader>
        <CModalBody>
          <div className='mb-3 d-flex gap-2 flex-wrap'>
            <CFormInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Tìm theo tên, mã, ngân hàng hoặc số tài khoản' />
            <CButton color='secondary' variant='outline' onClick={() => loadProfiles(search)} disabled={profilesLoading}>Tìm</CButton>
          </div>
          {profilesError ? <CAlert color='danger'>{profilesError}</CAlert> : null}
          {profilesLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải hồ sơ thanh toán...</div> : null}
          {!profilesLoading && profiles.length === 0 ? <CAlert color='secondary'>Tenant chưa có hồ sơ thanh toán active phù hợp.</CAlert> : null}
          {!profilesLoading && profiles.length > 0 ? (
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 56 }}>Chọn</CTableHeaderCell>
                  <CTableHeaderCell>Tên hồ sơ</CTableHeaderCell>
                  <CTableHeaderCell>Mã</CTableHeaderCell>
                  <CTableHeaderCell>Phương thức</CTableHeaderCell>
                  <CTableHeaderCell>Tài khoản nhận</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {profiles.map((item) => (
                  <CTableRow key={item.id}>
                    <CTableDataCell><CFormCheck type='radio' name='payment-profile' checked={String(selectedProfileId) === String(item.id)} onChange={() => setSelectedProfileId(String(item.id))} /></CTableDataCell>
                    <CTableDataCell><div className='fw-semibold'>{item.name || '-'}</div>{item.isDefault ? <CBadge color='primary' className='mt-1'>Mặc định</CBadge> : null}</CTableDataCell>
                    <CTableDataCell>{item.code || '-'}</CTableDataCell>
                    <CTableDataCell>{getPaymentProfileMethodLabel(item.paymentMethod)}</CTableDataCell>
                    <CTableDataCell>{getPaymentProfileReceiverSummary(item)}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          ) : null}
          {selectedProfile ? (
            <div className='border rounded p-3 bg-body-tertiary mt-3'>
              <div className='fw-semibold mb-2'>Xem trước hồ sơ đã chọn</div>
              <div>Mã/Tên: {selectedProfile.code} - {selectedProfile.name}</div>
              <div>Phương thức: {getPaymentProfileMethodLabel(selectedProfile.paymentMethod)}</div>
              <div>Tài khoản nhận: {getPaymentProfileReceiverSummary(selectedProfile)}</div>
              <div>Template chuyển khoản: {selectedProfile.transferContentTemplate || '-'}</div>
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeSelector} disabled={submitting}>Đóng</CButton>
          <CButton color='primary' onClick={() => handleApplyProfile(selectedProfileId)} disabled={!selectedProfileId || submitting}>Áp dụng hồ sơ</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showEdit} onClose={closeEdit} size='xl' scrollable>
        <CModalHeader><CModalTitle>Chỉnh snapshot thanh toán của đợt thi</CModalTitle></CModalHeader>
        <form onSubmit={handleSaveSnapshot}>
          <CModalBody>
            <CAlert color='info'>Các thay đổi tại đây chỉ áp dụng cho đợt thi này và không làm thay đổi hồ sơ thanh toán dùng chung.</CAlert>
            <CRow className='g-3'>
              <CCol md={4}><CFormLabel>Phương thức thanh toán</CFormLabel><CFormSelect value={snapshotForm.paymentMethodSnapshot} onChange={(event) => updateSnapshotField('paymentMethodSnapshot', event.target.value)} disabled={submitting}><option value='bank_transfer'>Chuyển khoản ngân hàng</option><option value='cash'>Tiền mặt</option><option value='other'>Khác</option></CFormSelect>{fieldErrors.paymentMethodSnapshot ? <div className='text-danger small mt-1'>{fieldErrors.paymentMethodSnapshot}</div> : null}</CCol>
              <CCol md={4}><CFormLabel>Mã ngân hàng</CFormLabel><CFormInput value={snapshotForm.paymentBankCodeSnapshot} onChange={(event) => updateSnapshotField('paymentBankCodeSnapshot', event.target.value.toUpperCase())} disabled={submitting} /></CCol>
              <CCol md={4}><CFormLabel>Tên ngân hàng</CFormLabel><CFormInput value={snapshotForm.paymentBankNameSnapshot} onChange={(event) => updateSnapshotField('paymentBankNameSnapshot', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.paymentBankNameSnapshot)} />{fieldErrors.paymentBankNameSnapshot ? <div className='text-danger small mt-1'>{fieldErrors.paymentBankNameSnapshot}</div> : null}</CCol>
              <CCol md={4}><CFormLabel>Số tài khoản</CFormLabel><CFormInput value={snapshotForm.paymentAccountNumberSnapshot} onChange={(event) => updateSnapshotField('paymentAccountNumberSnapshot', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.paymentAccountNumberSnapshot)} />{fieldErrors.paymentAccountNumberSnapshot ? <div className='text-danger small mt-1'>{fieldErrors.paymentAccountNumberSnapshot}</div> : null}</CCol>
              <CCol md={4}><CFormLabel>Chủ tài khoản</CFormLabel><CFormInput value={snapshotForm.paymentAccountHolderSnapshot} onChange={(event) => updateSnapshotField('paymentAccountHolderSnapshot', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.paymentAccountHolderSnapshot)} />{fieldErrors.paymentAccountHolderSnapshot ? <div className='text-danger small mt-1'>{fieldErrors.paymentAccountHolderSnapshot}</div> : null}</CCol>
              <CCol md={4}><CFormLabel>Chi nhánh</CFormLabel><CFormInput value={snapshotForm.paymentBankBranchSnapshot} onChange={(event) => updateSnapshotField('paymentBankBranchSnapshot', event.target.value)} disabled={submitting} /></CCol>
              <CCol md={4}><CFormLabel>Tiền tệ</CFormLabel><CFormInput value={snapshotForm.paymentCurrencySnapshot} onChange={(event) => updateSnapshotField('paymentCurrencySnapshot', event.target.value.toUpperCase())} disabled={submitting} invalid={Boolean(fieldErrors.paymentCurrencySnapshot)} />{fieldErrors.paymentCurrencySnapshot ? <div className='text-danger small mt-1'>{fieldErrors.paymentCurrencySnapshot}</div> : null}</CCol>
              <CCol md={8}><CFormLabel>Template chuyển khoản</CFormLabel><CFormInput value={snapshotForm.paymentTransferContentTemplateSnapshot} onChange={(event) => updateSnapshotField('paymentTransferContentTemplateSnapshot', event.target.value)} disabled={submitting} /><div className='small text-body-secondary mt-1'>Placeholder hỗ trợ: {'{registrationCode}'}, {'{learnerCode}'}, {'{fullName}'}, {'{roundCode}'}</div>{transferTemplatePreview ? <div className='small mt-1'>Minh họa: <strong>{transferTemplatePreview}</strong></div> : null}</CCol>
              <CCol md={6}><CFormLabel>Điện thoại hỗ trợ</CFormLabel><CFormInput value={snapshotForm.paymentSupportPhoneSnapshot} onChange={(event) => updateSnapshotField('paymentSupportPhoneSnapshot', event.target.value)} disabled={submitting} /></CCol>
              <CCol md={6}><CFormLabel>Email hỗ trợ</CFormLabel><CFormInput value={snapshotForm.paymentSupportEmailSnapshot} onChange={(event) => updateSnapshotField('paymentSupportEmailSnapshot', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.paymentSupportEmailSnapshot)} />{fieldErrors.paymentSupportEmailSnapshot ? <div className='text-danger small mt-1'>{fieldErrors.paymentSupportEmailSnapshot}</div> : null}</CCol>
              <CCol xs={12}><CFormLabel>Hướng dẫn thanh toán</CFormLabel><CFormTextarea rows={5} value={snapshotForm.paymentInstructionSnapshot} onChange={(event) => updateSnapshotField('paymentInstructionSnapshot', event.target.value)} disabled={submitting} /></CCol>
              <CCol md={5}>
                <div className='border rounded p-3 h-100'>
                  <CFormLabel htmlFor='exam-round-payment-qr'>Ảnh QR</CFormLabel>
                  <CFormInput id='exam-round-payment-qr' type='file' accept='image/*' disabled={submitting} onChange={(event) => { const file = event.target.files?.[0] || null; handleSnapshotQrChange(file); event.target.value = '' }} />
                  <div className='small text-body-secondary mt-2'>Ảnh QR tĩnh dùng để hỗ trợ người nộp tiền.</div>
                  {snapshotForm.paymentQrImageSnapshot?.url ? <div className='mt-3'><CButton type='button' color='secondary' size='sm' variant='outline' onClick={() => updateSnapshotField('paymentQrImageSnapshot', null)} disabled={submitting}>Gỡ ảnh QR</CButton></div> : null}
                </div>
              </CCol>
              <CCol md={7}><div className='border rounded p-3 h-100 d-flex align-items-center justify-content-center bg-body-tertiary'>{snapshotForm.paymentQrImageSnapshot?.url ? <img src={snapshotForm.paymentQrImageSnapshot.url} alt='QR preview' style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }} /> : <div className='text-body-secondary'>Chưa có ảnh QR</div>}</div></CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeEdit} disabled={submitting}>Đóng</CButton>
            <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu snapshot'}</CButton>
          </CModalFooter>
        </form>
      </CModal>

      <CModal visible={showPaymentDetail} onClose={closePaymentDetail} size='xl' scrollable>
        <CModalHeader><CModalTitle>Chi tiết thông báo thanh toán</CModalTitle></CModalHeader>
        <CModalBody>
          {detailError ? <CAlert color='danger'>{detailError}</CAlert> : null}
          {detailLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết...</div> : null}
          {!detailLoading && selectedPaymentDetail ? (
            <CRow className='g-4'>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Người học và hồ sơ</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-2'><div className='small text-body-secondary'>Mã hồ sơ</div><div className='fw-semibold'>{selectedPaymentDetail.registration?.registrationCode || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Người học</div><div>{selectedPaymentDetail.learner?.fullName || '-'} {selectedPaymentDetail.learner?.code ? `- ${selectedPaymentDetail.learner.code}` : ''}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Ngày sinh</div><div>{formatDateTime(selectedPaymentDetail.learner?.dateOfBirth)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Đợt thi</div><div>{selectedPaymentDetail.examRound?.code || '-'} - {selectedPaymentDetail.examRound?.name || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Số tiền phải nộp</div><div>{`${formatMoney(selectedPaymentDetail.fee?.amountDue || 0)} ${selectedPaymentDetail.fee?.currency || 'VND'}`}</div></div>
                    <div><div className='small text-body-secondary'>Trạng thái thanh toán</div><div>{getPaymentStatusLabel(selectedPaymentDetail.status?.paymentStatus)}</div></div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Thông tin nhận tiền đã snapshot</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-2'><div className='small text-body-secondary'>Ngân hàng nhận</div><div>{selectedPaymentDetail.payment?.bankName || selectedPaymentDetail.payment?.bankCode || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Số tài khoản nhận</div><div className='fw-semibold'>{selectedPaymentDetail.payment?.accountNumber || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Chủ tài khoản</div><div>{selectedPaymentDetail.payment?.accountHolder || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Nội dung chuyển khoản</div><div>{selectedPaymentDetail.payment?.transferContent || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Hướng dẫn</div><div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedPaymentDetail.payment?.paymentInstruction || '-'}</div></div>
                    {selectedPaymentDetail.payment?.qrImage?.url ? <div className='text-center'><img src={resolveMediaUrl(selectedPaymentDetail.payment.qrImage.url)} alt='QR snapshot' style={{ width: '100%', maxWidth: 260, height: 'auto', borderRadius: 12 }} /></div> : null}
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Thông tin learner đã khai</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-2'><div className='small text-body-secondary'>Thời gian đã chuyển tiền</div><div>{formatDateTime(selectedPaymentDetail.paymentReport?.transferAt)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Thời điểm báo chuyển</div><div>{formatDateTime(selectedPaymentDetail.paymentReport?.reportedAt)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Người chuyển</div><div>{selectedPaymentDetail.paymentReport?.senderName || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Tài khoản người gửi</div><div>{selectedPaymentDetail.paymentReport?.senderAccount || selectedPaymentDetail.paymentReport?.maskedSenderAccount || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Ngân hàng gửi</div><div>{selectedPaymentDetail.paymentReport?.senderBank || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Mã giao dịch</div><div>{selectedPaymentDetail.paymentReport?.transactionReference || '-'}</div></div>
                    <div><div className='small text-body-secondary'>Ghi chú</div><div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedPaymentDetail.paymentReport?.note || '-'}</div></div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Chứng từ và lịch sử xử lý</strong></CCardHeader>
                  <CCardBody>
                    {selectedPaymentDetail.paymentReport?.evidence ? (
                      <div className='mb-3'>
                        <div className='small text-body-secondary mb-2'>Chứng từ</div>
                        {String(selectedPaymentDetail.paymentReport.evidence.mimeType || '').toLowerCase().startsWith('image/') ? (
                          <div>
                            <img src={buildProtectedFileUrl({ fileAssetId: selectedPaymentDetail.paymentReport.evidence.fileAssetId || selectedPaymentDetail.paymentReport.evidence.id, storageProvider: selectedPaymentDetail.paymentReport.evidence.provider, url: selectedPaymentDetail.paymentReport.evidence.url })} alt={selectedPaymentDetail.paymentReport.evidence.name || 'Chứng từ'} style={{ width: '100%', maxWidth: 260, height: 'auto', borderRadius: 12 }} />
                            <div className='small mt-2'>{selectedPaymentDetail.paymentReport.evidence.name || '-'}</div>
                          </div>
                        ) : (
                          <a href={buildProtectedFileUrl({ fileAssetId: selectedPaymentDetail.paymentReport.evidence.fileAssetId || selectedPaymentDetail.paymentReport.evidence.id, storageProvider: selectedPaymentDetail.paymentReport.evidence.provider, url: selectedPaymentDetail.paymentReport.evidence.url })} target='_blank' rel='noreferrer'>{selectedPaymentDetail.paymentReport.evidence.name || 'Xem chứng từ'}</a>
                        )}
                      </div>
                    ) : <div className='mb-3 text-body-secondary'>Người học chưa gửi chứng từ.</div>}
                    <div className='mb-2'><div className='small text-body-secondary'>Đã xác nhận lúc</div><div>{formatDateTime(selectedPaymentDetail.paymentReport?.confirmedAt)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Ghi chú xác nhận</div><div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedPaymentDetail.paymentReport?.confirmationNote || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Đã trả lại lúc</div><div>{formatDateTime(selectedPaymentDetail.paymentReport?.rejectedAt)}</div></div>
                    <div><div className='small text-body-secondary'>Lý do trả lại</div><div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedPaymentDetail.paymentReport?.rejectionReason || '-'}</div></div>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          ) : null}
        </CModalBody>
        <CModalFooter>
          {selectedPaymentDetail?.registration?.id && canConfirmPayment(selectedPaymentDetail.registration) ? <CButton color='success' variant='outline' disabled={actionSubmitting} onClick={() => openConfirmDialog(selectedPaymentDetail.registration)}>Xác nhận đã nhận tiền</CButton> : null}
          {selectedPaymentDetail?.registration?.id && canRejectPayment(selectedPaymentDetail.registration) ? <CButton color='warning' variant='outline' disabled={actionSubmitting} onClick={() => openRejectDialog(selectedPaymentDetail.registration)}>Trả lại thông báo</CButton> : null}
          <CButton color='secondary' variant='outline' onClick={closePaymentDetail} disabled={actionSubmitting}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showConfirmDialog} onClose={closeConfirmDialog} alignment='center'>
        <CModalHeader><CModalTitle>Xác nhận đã nhận tiền</CModalTitle></CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <div><strong>Hồ sơ:</strong> {actionTarget?.registrationCode || '-'}</div>
            <div><strong>Người học:</strong> {actionTarget?.learner?.fullName || selectedPaymentDetail?.learner?.fullName || '-'}</div>
            <div><strong>Số tiền:</strong> {`${formatMoney(actionTarget?.amountDue || selectedPaymentDetail?.fee?.amountDue || 0)} ${actionTarget?.currency || selectedPaymentDetail?.fee?.currency || 'VND'}`}</div>
            <div><strong>Thời gian learner khai:</strong> {formatDateTime(selectedPaymentDetail?.paymentReport?.transferAt || actionTarget?.paymentTransferAt)}</div>
            <div><strong>Mã giao dịch:</strong> {selectedPaymentDetail?.paymentReport?.transactionReference || actionTarget?.paymentTransactionReference || '-'}</div>
          </div>
          <CAlert color='warning'>Chỉ xác nhận sau khi đã đối chiếu và chắc chắn đơn vị đã nhận được tiền.</CAlert>
          <CFormLabel>Ghi chú xác nhận</CFormLabel>
          <CFormTextarea rows={3} value={confirmNote} onChange={(event) => setConfirmNote(event.target.value)} disabled={actionSubmitting} />
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeConfirmDialog} disabled={actionSubmitting}>Hủy</CButton>
          <CButton color='success' onClick={handleConfirmPayment} disabled={actionSubmitting}>{actionSubmitting ? 'Đang xác nhận...' : 'Xác nhận đã nhận tiền'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showRejectDialog} onClose={closeRejectDialog} alignment='center'>
        <CModalHeader><CModalTitle>Trả lại thông báo thanh toán</CModalTitle></CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <div><strong>Hồ sơ:</strong> {actionTarget?.registrationCode || '-'}</div>
            <div><strong>Người học:</strong> {actionTarget?.learner?.fullName || selectedPaymentDetail?.learner?.fullName || '-'}</div>
            <div><strong>Số tiền:</strong> {`${formatMoney(actionTarget?.amountDue || selectedPaymentDetail?.fee?.amountDue || 0)} ${actionTarget?.currency || selectedPaymentDetail?.fee?.currency || 'VND'}`}</div>
          </div>
          <CFormLabel>Lý do trả lại</CFormLabel>
          <CFormTextarea rows={4} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} disabled={actionSubmitting} placeholder='Ví dụ: Không tìm thấy giao dịch, nội dung chuyển khoản không khớp, chứng từ chưa rõ...' />
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeRejectDialog} disabled={actionSubmitting}>Hủy</CButton>
          <CButton color='warning' onClick={handleRejectPayment} disabled={actionSubmitting || !String(rejectReason || '').trim()}>{actionSubmitting ? 'Đang gửi...' : 'Trả lại để kiểm tra'}</CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}