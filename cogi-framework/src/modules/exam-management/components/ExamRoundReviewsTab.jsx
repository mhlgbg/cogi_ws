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
  approveExamRegistration,
  getExamRoundReviewDetail,
  getExamRoundReviewSummary,
  listExamRoundReviews,
  rejectExamRegistration,
  returnExamRegistration,
} from '../services/examRoundApi'
import { buildExamRoundPath, formatDateTime, formatMoney, getApiMessage } from '../utils/examRoundUi'
import { getPaymentStatusBadge, getPaymentStatusLabel, getRegistrationStatusBadge, getRegistrationStatusLabel } from '../utils/learnerExamUi'

function SummaryCard({ label, value, color = 'secondary', helper = '' }) {
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

function getReviewStatusMeta(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'submitted') return { color: 'info', label: 'Đã nộp' }
  if (normalized === 'pending_review') return { color: 'warning', label: 'Đang xét' }
  if (normalized === 'accepted') return { color: 'success', label: 'Đã duyệt' }
  if (normalized === 'returned') return { color: 'warning', label: 'Trả lại' }
  if (normalized === 'rejected') return { color: 'danger', label: 'Từ chối' }
  if (normalized === 'cancelled') return { color: 'secondary', label: 'Đã hủy' }
  return getRegistrationStatusBadge(status)
}

function getReadinessMeta(readiness) {
  if (readiness?.readyForReview === true) return { color: 'success', label: 'Sẵn sàng' }
  return { color: 'warning', label: 'Chưa sẵn sàng' }
}

function getEligibilityLabel(status, registrationMode) {
  const normalized = String(status || '').trim().toLowerCase()
  if (String(registrationMode || '').trim().toLowerCase() === 'open' && !normalized) return 'Không yêu cầu điều kiện'
  if (String(registrationMode || '').trim().toLowerCase() === 'open' && normalized === 'pending') return 'Open round'
  if (normalized === 'eligible') return 'Đủ điều kiện'
  if (normalized === 'temporarily_ineligible') return 'Tạm thời chưa đủ điều kiện'
  if (normalized === 'ineligible') return 'Không đủ điều kiện'
  if (normalized === 'pending') return 'Chờ xác định'
  return normalized || '-'
}

function getReviewApiMessage(error, fallback) {
  const code = String(error?.response?.data?.code || error?.response?.data?.error?.code || '').trim()
  const mapped = {
    EXAM_ROUND_NOT_FOUND: 'Không tìm thấy đợt thi trong tenant hiện tại.',
    EXAM_REGISTRATION_NOT_FOUND: 'Không tìm thấy hồ sơ đăng ký phù hợp.',
    EXAM_REGISTRATION_NOT_IN_ROUND: 'Hồ sơ đăng ký không thuộc đợt thi hiện tại.',
    REGISTRATION_NOT_READY_FOR_REVIEW: 'Hồ sơ hiện chưa sẵn sàng để duyệt.',
    REGISTRATION_ALREADY_APPROVED: 'Hồ sơ này đã được duyệt trước đó.',
    REGISTRATION_ALREADY_REJECTED: 'Hồ sơ này đã bị từ chối trước đó.',
    REGISTRATION_RETURNED: 'Hồ sơ đang ở trạng thái trả lại và cần được xử lý lại trước khi duyệt.',
    REGISTRATION_CANCELLED: 'Hồ sơ đã bị hủy.',
    PAYMENT_NOT_CONFIRMED: 'Thanh toán chưa được xác nhận nên hồ sơ chưa thể duyệt.',
    ELIGIBILITY_NOT_VALID: 'Điều kiện dự thi hiện chưa hợp lệ.',
    REQUIRED_SUBJECT_MISSING: 'Hồ sơ đang thiếu môn thi bắt buộc.',
    REQUIRED_COMPONENT_MISSING: 'Hồ sơ đang thiếu kỹ năng/phần thi bắt buộc.',
    CANDIDATE_ALREADY_EXISTS: 'Hồ sơ này đã có candidate liên kết.',
    RETURN_REASON_REQUIRED: 'Bạn cần nhập lý do trả lại hồ sơ.',
    REGISTRATION_REJECTION_REASON_REQUIRED: 'Bạn cần nhập lý do từ chối hồ sơ.',
    REVIEW_ACTION_NOT_ALLOWED: 'Hành động xét duyệt hiện không được phép với hồ sơ này.',
    CONCURRENT_REVIEW_UPDATE: 'Hồ sơ vừa được người khác cập nhật. Vui lòng tải lại dữ liệu mới nhất.',
    CROSS_TENANT_ACCESS: 'Bạn không có quyền truy cập dữ liệu tenant khác.',
    UNKNOWN_FIELDS: 'Biểu mẫu gửi lên có trường không hợp lệ.',
  }[code]
  return mapped || getApiMessage(error, fallback)
}

function canApproveReview(item) {
  const status = String(item?.registrationStatus || '').trim().toLowerCase()
  return (status === 'submitted' || status === 'pending_review') && item?.readiness?.readyForReview === true
}

function canReturnReview(item) {
  const status = String(item?.registrationStatus || '').trim().toLowerCase()
  return status === 'submitted' || status === 'pending_review'
}

function canRejectReview(item) {
  const status = String(item?.registrationStatus || '').trim().toLowerCase()
  return status === 'submitted' || status === 'pending_review' || status === 'returned'
}

function toReviewActionItemFromDetail(detail) {
  if (!detail?.registration) return null
  return {
    ...detail.registration,
    learner: detail.learner,
    readiness: detail.readiness,
  }
}

function renderBlockingReasons(readiness) {
  const reasons = Array.isArray(readiness?.blockingReasons) ? readiness.blockingReasons : []
  if (reasons.length === 0) return '-'
  return reasons.join(', ')
}

function buildListParams(filters) {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    ...(String(filters.keyword || '').trim() ? { keyword: String(filters.keyword || '').trim() } : {}),
    ...(String(filters.reviewStatus || '').trim() ? { reviewStatus: String(filters.reviewStatus || '').trim() } : {}),
    ...(String(filters.readyForReview || '').trim() ? { readyForReview: String(filters.readyForReview || '').trim() } : {}),
    ...(String(filters.paymentStatus || '').trim() ? { paymentStatus: String(filters.paymentStatus || '').trim() } : {}),
    ...(String(filters.eligibilityState || '').trim() ? { eligibilityState: String(filters.eligibilityState || '').trim() } : {}),
    ...(String(filters.subjectId || '').trim() ? { subjectId: String(filters.subjectId || '').trim() } : {}),
    ...(String(filters.componentId || '').trim() ? { componentId: String(filters.componentId || '').trim() } : {}),
    ...(String(filters.registeredFrom || '').trim() ? { registeredFrom: String(filters.registeredFrom || '').trim() } : {}),
    ...(String(filters.registeredTo || '').trim() ? { registeredTo: String(filters.registeredTo || '').trim() } : {}),
  }
}

export default function ExamRoundReviewsTab({ round, permissions, onRefresh }) {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const canReview = permissions?.canManage === true || permissions?.canApprove === true
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [summary, setSummary] = useState(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 10,
    keyword: '',
    reviewStatus: '',
    readyForReview: '',
    paymentStatus: '',
    eligibilityState: '',
    subjectId: '',
    componentId: '',
    registeredFrom: '',
    registeredTo: '',
  })
  const [showDetail, setShowDetail] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detail, setDetail] = useState(null)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [actionType, setActionType] = useState('')
  const [actionTarget, setActionTarget] = useState(null)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [actionReason, setActionReason] = useState('')

  const subjectOptions = useMemo(() => Array.isArray(round?.subjects) ? round.subjects : [], [round?.subjects])
  const componentOptions = useMemo(() => subjectOptions.flatMap((subject) => Array.isArray(subject.components) ? subject.components.map((component) => ({ ...component, subjectName: subject.nameSnapshot })) : []), [subjectOptions])

  useEffect(() => {
    if (!canReview || !round?.id) return
    loadSummary()
  }, [canReview, round?.id])

  useEffect(() => {
    if (!canReview || !round?.id) return
    loadList(filters)
  }, [canReview, round?.id, filters.page, filters.pageSize, filters.reviewStatus, filters.readyForReview, filters.paymentStatus, filters.eligibilityState, filters.subjectId, filters.componentId])

  async function loadSummary() {
    if (!round?.id) return
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const data = await getExamRoundReviewSummary(round.id)
      setSummary(data || null)
    } catch (requestError) {
      setSummary(null)
      setSummaryError(getReviewApiMessage(requestError, 'Không tải được tổng quan xét duyệt.'))
    } finally {
      setSummaryLoading(false)
    }
  }

  async function loadList(nextFilters = filters) {
    if (!round?.id) return
    setListLoading(true)
    setListError('')
    try {
      const result = await listExamRoundReviews(round.id, buildListParams(nextFilters))
      setRows(Array.isArray(result?.data) ? result.data : [])
      setPagination(result?.pagination || { page: 1, pageSize: nextFilters.pageSize || 10, total: 0, pageCount: 1 })
    } catch (requestError) {
      setRows([])
      setPagination({ page: nextFilters.page || 1, pageSize: nextFilters.pageSize || 10, total: 0, pageCount: 1 })
      setListError(getReviewApiMessage(requestError, 'Không tải được danh sách hồ sơ xét duyệt.'))
    } finally {
      setListLoading(false)
    }
  }

  async function loadDetail(registrationId) {
    if (!round?.id || !registrationId) return
    setDetailLoading(true)
    setDetailError('')
    try {
      const data = await getExamRoundReviewDetail(round.id, registrationId)
      setDetail(data || null)
    } catch (requestError) {
      setDetail(null)
      setDetailError(getReviewApiMessage(requestError, 'Không tải được chi tiết xét duyệt hồ sơ.'))
    } finally {
      setDetailLoading(false)
    }
  }

  async function openDetail(registrationId) {
    setShowDetail(true)
    await loadDetail(registrationId)
  }

  async function refreshReviewBoard(targetRegistrationId = null) {
    await Promise.all([
      loadSummary(),
      loadList(filters),
      onRefresh?.(),
    ])
    if (targetRegistrationId) {
      await loadDetail(targetRegistrationId)
    }
  }

  function resetFilters() {
    setFilters({
      page: 1,
      pageSize: 10,
      keyword: '',
      reviewStatus: '',
      readyForReview: '',
      paymentStatus: '',
      eligibilityState: '',
      subjectId: '',
      componentId: '',
      registeredFrom: '',
      registeredTo: '',
    })
  }

  function closeDetail() {
    setShowDetail(false)
    setDetail(null)
    setDetailError('')
  }

  function openAction(type, item) {
    setActionType(type)
    setActionTarget(item)
    setActionError('')
    setActionNote('')
    setActionReason('')
    setShowActionDialog(true)
  }

  function closeActionDialog() {
    setShowActionDialog(false)
    setActionType('')
    setActionTarget(null)
    setActionError('')
    setActionNote('')
    setActionReason('')
  }

  function goPayments(registrationCode = '') {
    navigate(buildExamRoundPath(round.id, 'payments', tenantCode), {
      state: registrationCode ? { registrationCode } : null,
    })
  }

  async function submitAction() {
    if (!round?.id || !actionTarget?.id || actionSubmitting) return
    if ((actionType === 'return' || actionType === 'reject') && !String(actionReason || '').trim()) {
      setActionError(actionType === 'return' ? 'Bạn cần nhập lý do trả lại hồ sơ.' : 'Bạn cần nhập lý do từ chối hồ sơ.')
      return
    }

    setActionSubmitting(true)
    setActionError('')
    try {
      if (actionType === 'approve') {
        await approveExamRegistration(round.id, actionTarget.id, {
          ...(String(actionNote || '').trim() ? { note: String(actionNote || '').trim() } : {}),
        })
      } else if (actionType === 'return') {
        await returnExamRegistration(round.id, actionTarget.id, {
          reason: String(actionReason || '').trim(),
          ...(String(actionNote || '').trim() ? { note: String(actionNote || '').trim() } : {}),
        })
      } else if (actionType === 'reject') {
        await rejectExamRegistration(round.id, actionTarget.id, {
          reason: String(actionReason || '').trim(),
          ...(String(actionNote || '').trim() ? { note: String(actionNote || '').trim() } : {}),
        })
      }
      await refreshReviewBoard(showDetail ? actionTarget.id : null)
      closeActionDialog()
    } catch (requestError) {
      setActionError(getReviewApiMessage(requestError, 'Không thể cập nhật quyết định xét duyệt.'))
      if (Number(requestError?.response?.status || 0) === 409) {
        await refreshReviewBoard(showDetail ? actionTarget.id : null)
      }
    } finally {
      setActionSubmitting(false)
    }
  }

  if (!canReview) {
    return <CAlert color='warning'>Bạn không có quyền xem hoặc xử lý tab xét duyệt của đợt thi này.</CAlert>
  }

  return (
    <div className='d-flex flex-column gap-4'>
      {summaryError ? <CAlert color='warning'>{summaryError}</CAlert> : null}
      <CRow className='g-3'>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Tổng hồ sơ' value={summaryLoading ? '...' : (summary?.total ?? 0)} color='dark' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Chờ xét' value={summaryLoading ? '...' : (summary?.waitingForReview ?? 0)} color='info' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Chưa sẵn sàng' value={summaryLoading ? '...' : (summary?.notReadyForReview ?? 0)} color='warning' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Đã duyệt' value={summaryLoading ? '...' : (summary?.approved ?? 0)} color='success' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Trả lại' value={summaryLoading ? '...' : (summary?.returned ?? 0)} color='warning' /></CCol>
        <CCol xl={2} md={4} sm={6}><SummaryCard label='Từ chối' value={summaryLoading ? '...' : (summary?.rejected ?? 0)} color='danger' /></CCol>
      </CRow>

      <CCard>
        <CCardHeader><strong>Danh sách xét duyệt</strong></CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end mb-4'>
            <CCol lg={3} md={6}>
              <CFormLabel>Tìm kiếm</CFormLabel>
              <CFormInput value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder='Mã hồ sơ, learner...' />
            </CCol>
            <CCol lg={2} md={6}>
              <CFormLabel>Trạng thái xét duyệt</CFormLabel>
              <CFormSelect value={filters.reviewStatus} onChange={(event) => setFilters((current) => ({ ...current, page: 1, reviewStatus: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='submitted'>Đã nộp</option>
                <option value='pending_review'>Đang xét</option>
                <option value='accepted'>Đã duyệt</option>
                <option value='returned'>Trả lại</option>
                <option value='rejected'>Từ chối</option>
                <option value='cancelled'>Đã hủy</option>
              </CFormSelect>
            </CCol>
            <CCol lg={2} md={6}>
              <CFormLabel>Sẵn sàng xét</CFormLabel>
              <CFormSelect value={filters.readyForReview} onChange={(event) => setFilters((current) => ({ ...current, page: 1, readyForReview: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='true'>Sẵn sàng</option>
                <option value='false'>Chưa sẵn sàng</option>
              </CFormSelect>
            </CCol>
            <CCol lg={2} md={6}>
              <CFormLabel>Thanh toán</CFormLabel>
              <CFormSelect value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, page: 1, paymentStatus: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='unpaid'>Chưa thanh toán</option>
                <option value='payment_reported'>Đã báo chuyển khoản</option>
                <option value='paid'>Đã thanh toán</option>
                <option value='not_required'>Không yêu cầu</option>
                <option value='payment_rejected'>Thanh toán bị từ chối</option>
              </CFormSelect>
            </CCol>
            <CCol lg={3} md={6}>
              <CFormLabel>Điều kiện</CFormLabel>
              <CFormSelect value={filters.eligibilityState} onChange={(event) => setFilters((current) => ({ ...current, page: 1, eligibilityState: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='eligible'>Đủ điều kiện</option>
                <option value='pending'>Chờ xác định</option>
                <option value='temporarily_ineligible'>Tạm thời chưa đủ</option>
                <option value='ineligible'>Không đủ</option>
              </CFormSelect>
            </CCol>
            <CCol lg={3} md={6}>
              <CFormLabel>Môn thi</CFormLabel>
              <CFormSelect value={filters.subjectId} onChange={(event) => setFilters((current) => ({ ...current, page: 1, subjectId: event.target.value }))}>
                <option value=''>Tất cả</option>
                {subjectOptions.map((subject, index) => <option key={subject.examRoundSubjectId || subject.id || `${subject.nameSnapshot || 'subject'}-${index}`} value={subject.examRoundSubjectId}>{subject.nameSnapshot}</option>)}
              </CFormSelect>
            </CCol>
            <CCol lg={3} md={6}>
              <CFormLabel>Kỹ năng thi</CFormLabel>
              <CFormSelect value={filters.componentId} onChange={(event) => setFilters((current) => ({ ...current, page: 1, componentId: event.target.value }))}>
                <option value=''>Tất cả</option>
                {componentOptions.map((component, index) => <option key={component.examRoundComponentId || component.id || `${component.subjectName || 'component'}-${component.nameSnapshot || 'item'}-${index}`} value={component.examRoundComponentId}>{component.nameSnapshot}</option>)}
              </CFormSelect>
            </CCol>
            <CCol lg={3} md={6}>
              <CFormLabel>Từ ngày</CFormLabel>
              <CFormInput type='datetime-local' value={filters.registeredFrom} onChange={(event) => setFilters((current) => ({ ...current, registeredFrom: event.target.value }))} />
            </CCol>
            <CCol lg={3} md={6}>
              <CFormLabel>Đến ngày</CFormLabel>
              <CFormInput type='datetime-local' value={filters.registeredTo} onChange={(event) => setFilters((current) => ({ ...current, registeredTo: event.target.value }))} />
            </CCol>
            <CCol xs={12}>
              <div className='d-flex gap-2 flex-wrap'>
                <CButton color='primary' onClick={() => loadList({ ...filters, page: 1 })}>Tìm</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters}>Xóa bộ lọc</CButton>
                <CButton color='secondary' variant='outline' onClick={() => { loadSummary(); loadList(filters) }}>Làm mới</CButton>
              </div>
            </CCol>
          </CRow>

          {listError ? <CAlert color='danger'>{listError}</CAlert> : null}
          {listLoading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải danh sách xét duyệt...</div> : null}

          <div className='d-none d-md-block'>
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Mã hồ sơ</CTableHeaderCell>
                  <CTableHeaderCell>Người học</CTableHeaderCell>
                  <CTableHeaderCell>Nội dung đăng ký</CTableHeaderCell>
                  <CTableHeaderCell>Thanh toán</CTableHeaderCell>
                  <CTableHeaderCell>Điều kiện</CTableHeaderCell>
                  <CTableHeaderCell>Sẵn sàng xét</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái xét</CTableHeaderCell>
                  <CTableHeaderCell>Cập nhật</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 && !listLoading ? <CTableRow><CTableDataCell colSpan={9} className='text-center text-body-secondary py-4'>Chưa có hồ sơ phù hợp với bộ lọc hiện tại.</CTableDataCell></CTableRow> : null}
                {rows.map((item) => {
                  const paymentBadge = getPaymentStatusBadge(item.paymentStatus)
                  const reviewBadge = getReviewStatusMeta(item.registrationStatus)
                  const readinessBadge = getReadinessMeta(item.readiness)
                  return (
                    <CTableRow key={item.id}>
                      <CTableDataCell>
                        <div className='fw-semibold'>{item.registrationCode || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div>{item.learner?.fullName || '-'}</div>
                        <div className='small text-body-secondary'>{item.learner?.code || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex gap-1 flex-wrap mb-1'>
                          {(item.subjectsSummary || []).map((subject) => <CBadge key={subject.id || subject.nameSnapshot} color='light' textColor='dark'>{subject.nameSnapshot}</CBadge>)}
                        </div>
                        <div className='small text-body-secondary'>{item.subjectCount || 0} môn · {item.componentCount || 0} kỹ năng</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={paymentBadge.color}>{paymentBadge.label}</CBadge>
                        <div className='small text-body-secondary mt-1'>{`${formatMoney(item.payableAmount || 0)} VND`}</div>
                      </CTableDataCell>
                      <CTableDataCell>{getEligibilityLabel(item.eligibility?.status || item.eligibilityStatus, round?.registrationMode)}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={readinessBadge.color}>{readinessBadge.label}</CBadge>
                        <div className='small text-body-secondary mt-1'>{renderBlockingReasons(item.readiness)}</div>
                      </CTableDataCell>
                      <CTableDataCell><CBadge color={reviewBadge.color}>{reviewBadge.label}</CBadge></CTableDataCell>
                      <CTableDataCell>{formatDateTime(item.review?.rejectedAt || item.review?.returnedAt || item.review?.acceptedAt || item.review?.reviewedAt || item.registeredAt)}</CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex gap-2 flex-wrap'>
                          <CButton color='secondary' size='sm' variant='outline' onClick={() => openDetail(item.id)}>Xem chi tiết</CButton>
                          {canApproveReview(item) ? <CButton color='success' size='sm' onClick={() => openAction('approve', item)}>Duyệt</CButton> : null}
                          {canReturnReview(item) ? <CButton color='warning' size='sm' variant='outline' onClick={() => openAction('return', item)}>Trả lại</CButton> : null}
                          {canRejectReview(item) ? <CButton color='danger' size='sm' variant='outline' onClick={() => openAction('reject', item)}>Từ chối</CButton> : null}
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          </div>

          <div className='d-flex d-md-none flex-column gap-3'>
            {rows.length === 0 && !listLoading ? <div className='text-body-secondary text-center py-4'>Chưa có hồ sơ phù hợp với bộ lọc hiện tại.</div> : null}
            {rows.map((item) => {
              const paymentBadge = getPaymentStatusBadge(item.paymentStatus)
              const reviewBadge = getReviewStatusMeta(item.registrationStatus)
              const readinessBadge = getReadinessMeta(item.readiness)
              return (
                <CCard key={item.id}>
                  <CCardBody className='d-flex flex-column gap-2'>
                    <div className='d-flex justify-content-between gap-2'>
                      <div>
                        <div className='fw-semibold'>{item.registrationCode || '-'}</div>
                        <div className='small text-body-secondary'>{item.learner?.fullName || '-'} · {item.learner?.code || '-'}</div>
                      </div>
                      <CBadge color={reviewBadge.color}>{reviewBadge.label}</CBadge>
                    </div>
                    <div className='small'>{(item.subjectsSummary || []).map((subject) => subject.nameSnapshot).filter(Boolean).join(', ') || '-'}</div>
                    <div className='d-flex gap-2 flex-wrap'>
                      <CBadge color={paymentBadge.color}>{paymentBadge.label}</CBadge>
                      <CBadge color={readinessBadge.color}>{readinessBadge.label}</CBadge>
                    </div>
                    <div className='small text-body-secondary'>{getEligibilityLabel(item.eligibility?.status || item.eligibilityStatus, round?.registrationMode)}</div>
                    <div className='small text-body-secondary'>{renderBlockingReasons(item.readiness)}</div>
                    <div className='d-flex gap-2 flex-wrap mt-2'>
                      <CButton color='secondary' size='sm' variant='outline' onClick={() => openDetail(item.id)}>Xem chi tiết</CButton>
                      {canApproveReview(item) ? <CButton color='success' size='sm' onClick={() => openAction('approve', item)}>Duyệt</CButton> : null}
                      {canReturnReview(item) ? <CButton color='warning' size='sm' variant='outline' onClick={() => openAction('return', item)}>Trả lại</CButton> : null}
                      {canRejectReview(item) ? <CButton color='danger' size='sm' variant='outline' onClick={() => openAction('reject', item)}>Từ chối</CButton> : null}
                    </div>
                  </CCardBody>
                </CCard>
              )
            })}
          </div>

          <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mt-3'>
            <div className='small text-body-secondary'>Trang {pagination.page || 1}/{pagination.pageCount || 1} · Tổng {pagination.total || 0} hồ sơ</div>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' disabled={(pagination.page || 1) <= 1 || listLoading} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))}>Trang trước</CButton>
              <CButton color='secondary' variant='outline' disabled={(pagination.page || 1) >= (pagination.pageCount || 1) || listLoading} onClick={() => setFilters((current) => ({ ...current, page: Math.min(pagination.pageCount || 1, (current.page || 1) + 1) }))}>Trang sau</CButton>
            </div>
          </div>
        </CCardBody>
      </CCard>

      <CModal visible={showDetail} onClose={closeDetail} size='xl' scrollable>
        <CModalHeader><CModalTitle>Chi tiết xét duyệt hồ sơ</CModalTitle></CModalHeader>
        <CModalBody>
          {detailError ? <CAlert color='danger'>{detailError}</CAlert> : null}
          {detailLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết...</div> : null}
          {!detailLoading && detail ? (
            <CRow className='g-4'>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Hồ sơ</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-2'><div className='small text-body-secondary'>Mã hồ sơ</div><div className='fw-semibold'>{detail.registration?.registrationCode || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Ngày tạo</div><div>{formatDateTime(detail.registration?.createdAt || detail.registration?.registeredAt)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Trạng thái xét duyệt</div><div>{getReviewStatusMeta(detail.registration?.registrationStatus).label}</div></div>
                    <div><div className='small text-body-secondary'>Trạng thái thanh toán</div><div>{getPaymentStatusLabel(detail.registration?.paymentStatus)}</div></div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Người học</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-2'><div className='small text-body-secondary'>Mã learner</div><div>{detail.learner?.code || detail.registration?.learnerSnapshot?.studentCode || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Họ tên</div><div>{detail.learner?.fullName || detail.registration?.learnerSnapshot?.fullName || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Ngày sinh</div><div>{formatDateTime(detail.learner?.dateOfBirth)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Điện thoại</div><div>{detail.learner?.phone || '-'}</div></div>
                    <div><div className='small text-body-secondary'>Lớp / ngành</div><div>{[detail.registration?.learnerSnapshot?.className, detail.registration?.learnerSnapshot?.major].filter(Boolean).join(' · ') || '-'}</div></div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Nội dung đăng ký</strong></CCardHeader>
                  <CCardBody>
                    <div className='d-flex flex-column gap-3'>
                      {(detail.subjects || []).map((subject) => (
                        <div key={subject.id} className='border rounded p-3'>
                          <div className='d-flex justify-content-between gap-2 flex-wrap'>
                            <div className='fw-semibold'>{subject.subject?.nameSnapshot || '-'}</div>
                            <CBadge color={subject.subject?.isRequired ? 'danger' : 'secondary'}>{subject.subject?.isRequired ? 'Bắt buộc' : 'Tự chọn'}</CBadge>
                          </div>
                          <div className='small text-body-secondary mt-1'>Phí môn: {`${formatMoney(subject.feeAmount || 0)} VND`}</div>
                          <div className='d-flex flex-column gap-1 mt-2'>
                            {(subject.components || []).map((component) => (
                              <div key={component.id} className='small'>{component.component?.nameSnapshot || '-'} · {`${formatMoney(component.feeAmount || 0)} VND`} · {component.component?.durationMinutes ? `${component.component.durationMinutes} phút` : '-'}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Điều kiện và readiness</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-2'><div className='small text-body-secondary'>Chế độ đăng ký</div><div>{String(detail.examRound?.registrationMode || '').trim().toLowerCase() === 'open' ? 'Open' : 'Restricted'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Eligibility</div><div>{getEligibilityLabel(detail.eligibility?.status || detail.registration?.eligibilityStatus, detail.examRound?.registrationMode)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Lý do eligibility</div><div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detail.eligibility?.reason || detail.audit?.eligibilityReason || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Sẵn sàng xét duyệt</div><div>{detail.readiness?.readyForReview ? 'Sẵn sàng' : 'Chưa sẵn sàng'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Candidate đã tồn tại</div><div>{detail.candidate?.exists ? `Có (${detail.candidate?.count || 0})` : 'Chưa có'}</div></div>
                    <div><div className='small text-body-secondary'>Blocking reasons</div><div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderBlockingReasons(detail.readiness)}</div></div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Thanh toán</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-2'><div className='small text-body-secondary'>Số tiền phải nộp</div><div>{`${formatMoney(detail.registration?.payableAmount || 0)} VND`}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Đã xác nhận</div><div>{`${formatMoney(detail.registration?.confirmedPaidAmount || 0)} VND`}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Trạng thái thanh toán</div><div>{getPaymentStatusLabel(detail.registration?.paymentStatus)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Số lần chứng từ / payment items</div><div>{detail.payments?.summary?.total || 0}</div></div>
                    <div className='d-flex gap-2 flex-wrap mt-3'>
                      <CButton color='secondary' variant='outline' onClick={() => goPayments(detail.registration?.registrationCode)}>Xem tab Thanh toán</CButton>
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Lịch sử xét duyệt</strong></CCardHeader>
                  <CCardBody>
                    <div className='d-flex flex-column gap-3'>
                      {(detail.audit?.history || []).length === 0 ? <div className='text-body-secondary'>Chưa có lịch sử xét duyệt.</div> : null}
                      {(detail.audit?.history || []).map((entry, index) => (
                        <div key={`${entry.action || 'history'}-${entry.timestamp || index}`} className='border rounded p-3'>
                          <div className='d-flex justify-content-between gap-2 flex-wrap'>
                            <div className='fw-semibold'>{entry.action || '-'}</div>
                            <div className='small text-body-secondary'>{formatDateTime(entry.timestamp)}</div>
                          </div>
                          <div className='small text-body-secondary mt-1'>{entry.actorDisplayName || '-'}</div>
                          <div className='small mt-1'>Trạng thái: {entry.fromRegistrationStatus || '-'} → {entry.toRegistrationStatus || '-'}</div>
                          {entry.reason ? <div className='small mt-1'>Lý do: {entry.reason}</div> : null}
                          {entry.note ? <div className='small mt-1'>Ghi chú: {entry.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          ) : null}
        </CModalBody>
        <CModalFooter>
          {detail && canApproveReview(toReviewActionItemFromDetail(detail)) ? <CButton color='success' onClick={() => openAction('approve', toReviewActionItemFromDetail(detail))}>Duyệt hồ sơ</CButton> : null}
          {detail && canReturnReview(toReviewActionItemFromDetail(detail)) ? <CButton color='warning' variant='outline' onClick={() => openAction('return', toReviewActionItemFromDetail(detail))}>Trả lại</CButton> : null}
          {detail && canRejectReview(toReviewActionItemFromDetail(detail)) ? <CButton color='danger' variant='outline' onClick={() => openAction('reject', toReviewActionItemFromDetail(detail))}>Từ chối</CButton> : null}
          <CButton color='secondary' variant='outline' onClick={closeDetail}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showActionDialog} onClose={closeActionDialog}>
        <CModalHeader>
          <CModalTitle>
            {actionType === 'approve' ? 'Duyệt hồ sơ đăng ký' : actionType === 'return' ? 'Trả lại hồ sơ' : 'Từ chối hồ sơ'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {actionError ? <CAlert color='danger'>{actionError}</CAlert> : null}
          <div className='mb-3'>
            <div className='small text-body-secondary'>Hồ sơ</div>
            <div className='fw-semibold'>{actionTarget?.registrationCode || actionTarget?.registration?.registrationCode || '-'}</div>
            <div className='small text-body-secondary'>{actionTarget?.learner?.fullName || detail?.learner?.fullName || '-'} · {actionTarget?.learner?.code || detail?.learner?.code || '-'}</div>
          </div>
          <div className='mb-3'>
            <div className='small text-body-secondary'>Thanh toán</div>
            <div>{getPaymentStatusLabel(actionTarget?.paymentStatus || detail?.registration?.paymentStatus)}</div>
          </div>
          <div className='mb-3'>
            <div className='small text-body-secondary'>Readiness</div>
            <div>{actionTarget?.readiness?.readyForReview === true || detail?.readiness?.readyForReview === true ? 'Sẵn sàng duyệt' : 'Chưa sẵn sàng'}</div>
          </div>
          {actionType === 'reject' && String(actionTarget?.paymentStatus || detail?.registration?.paymentStatus || '').trim().toLowerCase() === 'paid' ? (
            <CAlert color='warning'>Hồ sơ đã được xác nhận thanh toán. Việc từ chối không tự động hoàn tiền.</CAlert>
          ) : null}
          {actionType === 'reject' ? <CAlert color='danger'>Hồ sơ sẽ không được tiếp tục tham gia quy trình của đợt thi.</CAlert> : null}
          {(actionType === 'return' || actionType === 'reject') ? (
            <div className='mb-3'>
              <CFormLabel>{actionType === 'return' ? 'Lý do trả lại' : 'Lý do từ chối'}</CFormLabel>
              <CFormTextarea rows={4} value={actionReason} onChange={(event) => setActionReason(event.target.value)} />
            </div>
          ) : null}
          <div>
            <CFormLabel>{actionType === 'approve' ? 'Ghi chú duyệt' : 'Ghi chú nội bộ'}</CFormLabel>
            <CFormTextarea rows={3} value={actionNote} onChange={(event) => setActionNote(event.target.value)} />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeActionDialog} disabled={actionSubmitting}>Đóng</CButton>
          {actionType === 'approve' ? <CButton color='success' onClick={submitAction} disabled={actionSubmitting}>{actionSubmitting ? 'Đang duyệt...' : 'Duyệt hồ sơ'}</CButton> : null}
          {actionType === 'return' ? <CButton color='warning' onClick={submitAction} disabled={actionSubmitting}>{actionSubmitting ? 'Đang trả lại...' : 'Trả lại để kiểm tra'}</CButton> : null}
          {actionType === 'reject' ? <CButton color='danger' onClick={submitAction} disabled={actionSubmitting}>{actionSubmitting ? 'Đang từ chối...' : 'Từ chối hồ sơ'}</CButton> : null}
        </CModalFooter>
      </CModal>
    </div>
  )
}
