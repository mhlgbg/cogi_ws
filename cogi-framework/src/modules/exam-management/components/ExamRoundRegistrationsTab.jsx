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
  getExamRoundRegistrationDetail,
  listExamRoundRegistrations,
} from '../services/examRoundApi'
import { buildExamRoundPath, formatDateTime, formatMoney, getApiMessage } from '../utils/examRoundUi'
import { getPaymentStatusBadge, getPaymentStatusLabel, getRegistrationStatusBadge, getRegistrationStatusLabel } from '../utils/learnerExamUi'

function SummaryCard({ label, value, color = 'secondary' }) {
  return (
    <CCard className='h-100'>
      <CCardBody>
        <div className='small text-body-secondary mb-1'>{label}</div>
        <div className={`fs-4 fw-semibold text-${color}`}>{value}</div>
      </CCardBody>
    </CCard>
  )
}

function getEligibilityLabel(status, roundMode) {
  const normalized = String(status || '').trim().toLowerCase()
  if (String(roundMode || '').trim().toLowerCase() === 'open' && !normalized) return 'Không yêu cầu điều kiện'
  if (normalized === 'eligible') return 'Đủ điều kiện'
  if (normalized === 'temporarily_ineligible') return 'Tạm thời chưa đủ điều kiện'
  if (normalized === 'ineligible') return 'Không đủ điều kiện'
  if (normalized === 'pending') return 'Chờ xác định'
  return normalized || '-'
}

function getReadinessBadge(readiness) {
  const ready = readiness?.readyForCandidate === true || readiness?.canAccept === true
  return ready
    ? { color: 'success', label: 'Sẵn sàng' }
    : { color: 'warning', label: 'Còn điều kiện' }
}

function renderBlockingReasons(readiness) {
  const reasons = Array.isArray(readiness?.blockingReasons) ? readiness.blockingReasons : []
  if (reasons.length === 0) return '-'
  return reasons.join(', ')
}

export default function ExamRoundRegistrationsTab({ round }) {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [summary, setSummary] = useState(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, pageCount: 1 })
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 20,
    keyword: '',
    registrationStatus: '',
    paymentStatus: '',
    eligibilityStatus: '',
    readiness: '',
    subjectId: '',
    componentId: '',
  })
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detail, setDetail] = useState(null)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    if (!round?.id) return
    loadList(filters)
  }, [round?.id, filters.page, filters.pageSize, filters.registrationStatus, filters.paymentStatus, filters.eligibilityStatus, filters.readiness, filters.subjectId, filters.componentId])

  const subjectOptions = useMemo(() => Array.isArray(round?.subjects) ? round.subjects : [], [round?.subjects])
  const componentOptions = useMemo(() => subjectOptions.flatMap((subject) => Array.isArray(subject.components) ? subject.components.map((component) => ({ ...component, subjectName: subject.nameSnapshot })) : []), [subjectOptions])

  async function loadList(nextFilters = filters) {
    setListLoading(true)
    setListError('')
    try {
      const result = await listExamRoundRegistrations(round.id, {
        page: nextFilters.page,
        pageSize: nextFilters.pageSize,
        ...(String(nextFilters.keyword || '').trim() ? { keyword: String(nextFilters.keyword || '').trim() } : {}),
        ...(String(nextFilters.registrationStatus || '').trim() ? { registrationStatus: nextFilters.registrationStatus } : {}),
        ...(String(nextFilters.paymentStatus || '').trim() ? { paymentStatus: nextFilters.paymentStatus } : {}),
        ...(String(nextFilters.eligibilityStatus || '').trim() ? { eligibilityStatus: nextFilters.eligibilityStatus } : {}),
        ...(String(nextFilters.readiness || '').trim() ? { readiness: nextFilters.readiness } : {}),
        ...(String(nextFilters.subjectId || '').trim() ? { subjectId: nextFilters.subjectId } : {}),
        ...(String(nextFilters.componentId || '').trim() ? { componentId: nextFilters.componentId } : {}),
      })
      setRows(Array.isArray(result?.data) ? result.data : [])
      setPagination(result?.pagination || { page: 1, pageSize: nextFilters.pageSize, total: 0, pageCount: 1 })
      setSummary(result?.summary ? { ...result.summary, total: result?.pagination?.total || 0 } : { total: result?.pagination?.total || 0 })
    } catch (requestError) {
      setRows([])
      setPagination({ page: nextFilters.page, pageSize: nextFilters.pageSize, total: 0, pageCount: 1 })
      setSummary(null)
      setListError(getApiMessage(requestError, 'Không tải được danh sách hồ sơ đăng ký.'))
    } finally {
      setListLoading(false)
    }
  }

  async function openDetail(registrationId) {
    setDetailLoading(true)
    setDetailError('')
    setShowDetail(true)
    try {
      const data = await getExamRoundRegistrationDetail(round.id, registrationId)
      setDetail(data || null)
    } catch (requestError) {
      setDetail(null)
      setDetailError(getApiMessage(requestError, 'Không tải được chi tiết hồ sơ đăng ký.'))
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setShowDetail(false)
    setDetail(null)
    setDetailError('')
  }

  function resetFilters() {
    setFilters({
      page: 1,
      pageSize: 20,
      keyword: '',
      registrationStatus: '',
      paymentStatus: '',
      eligibilityStatus: '',
      readiness: '',
      subjectId: '',
      componentId: '',
    })
  }

  function goPayments(registrationCode = '') {
    navigate(buildExamRoundPath(round.id, 'payments', tenantCode), {
      state: registrationCode ? { registrationCode } : null,
    })
  }

  return (
    <div className='d-flex flex-column gap-4'>
      <CRow className='g-3'>
        <CCol xl={3} md={6}><SummaryCard label='Tổng hồ sơ' value={listLoading && !summary ? '...' : (summary?.total ?? 0)} color='dark' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Đã ghi nhận' value={listLoading && !summary ? '...' : (summary?.submitted ?? 0)} color='info' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Chờ thanh toán' value={listLoading && !summary ? '...' : (summary?.unpaid ?? 0)} color='warning' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Đã báo chuyển tiền' value={listLoading && !summary ? '...' : (summary?.paymentReported ?? 0)} color='info' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Đã xác nhận thanh toán' value={listLoading && !summary ? '...' : (summary?.paid ?? 0)} color='success' /></CCol>
        <CCol xl={3} md={6}><SummaryCard label='Không yêu cầu thanh toán' value={listLoading && !summary ? '...' : (summary?.notRequired ?? 0)} color='success' /></CCol>
        {summary && typeof summary.ready !== 'undefined' ? <CCol xl={3} md={6}><SummaryCard label='Sẵn sàng' value={listLoading && !summary ? '...' : (summary?.ready ?? 0)} color='success' /></CCol> : null}
        {summary && typeof summary.blocked !== 'undefined' ? <CCol xl={3} md={6}><SummaryCard label='Còn vướng điều kiện' value={listLoading && !summary ? '...' : (summary?.blocked ?? 0)} color='warning' /></CCol> : null}
      </CRow>

      <CCard>
        <CCardHeader><strong>Danh sách hồ sơ đăng ký</strong></CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end mb-4'>
            <CCol lg={3} md={6}>
              <CFormLabel>Tìm kiếm</CFormLabel>
              <CFormInput value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder='Mã hồ sơ, learner...' />
            </CCol>
            <CCol lg={2} md={6}>
              <CFormLabel>Trạng thái hồ sơ</CFormLabel>
              <CFormSelect value={filters.registrationStatus} onChange={(event) => setFilters((current) => ({ ...current, page: 1, registrationStatus: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='submitted'>Đã ghi nhận</option>
                <option value='pending_review'>Đang rà soát</option>
                <option value='accepted'>Đã chấp nhận</option>
                <option value='rejected'>Bị từ chối</option>
                <option value='cancelled'>Đã hủy</option>
              </CFormSelect>
            </CCol>
            <CCol lg={2} md={6}>
              <CFormLabel>Thanh toán</CFormLabel>
              <CFormSelect value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, page: 1, paymentStatus: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='unpaid'>Chưa thanh toán</option>
                <option value='payment_reported'>Đã báo chuyển tiền</option>
                <option value='paid'>Đã xác nhận</option>
                <option value='not_required'>Không yêu cầu</option>
                <option value='payment_rejected'>Cần bổ sung</option>
              </CFormSelect>
            </CCol>
            <CCol lg={2} md={6}>
              <CFormLabel>Điều kiện</CFormLabel>
              <CFormSelect value={filters.eligibilityStatus} onChange={(event) => setFilters((current) => ({ ...current, page: 1, eligibilityStatus: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='eligible'>Đủ điều kiện</option>
                <option value='pending'>Chờ xác định</option>
                <option value='temporarily_ineligible'>Tạm thời chưa đủ</option>
                <option value='ineligible'>Không đủ điều kiện</option>
              </CFormSelect>
            </CCol>
            <CCol lg={3} md={6}>
              <CFormLabel>Sẵn sàng</CFormLabel>
              <CFormSelect value={filters.readiness} onChange={(event) => setFilters((current) => ({ ...current, page: 1, readiness: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='ready'>Sẵn sàng</option>
                <option value='blocked'>Còn điều kiện</option>
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
            <CCol lg={6} md={12}>
              <div className='d-flex gap-2 flex-wrap'>
                <CButton color='secondary' variant='outline' onClick={resetFilters}>Xóa bộ lọc</CButton>
                <CButton color='primary' onClick={() => loadList({ ...filters, page: 1 })}>Tìm</CButton>
                <CButton color='secondary' variant='outline' onClick={() => loadList(filters)}>Làm mới</CButton>
              </div>
            </CCol>
          </CRow>

          {listError ? <CAlert color='danger'>{listError}</CAlert> : null}
          {listLoading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải danh sách hồ sơ đăng ký...</div> : null}

          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Mã hồ sơ</CTableHeaderCell>
                <CTableHeaderCell>Người học</CTableHeaderCell>
                <CTableHeaderCell>Nội dung đăng ký</CTableHeaderCell>
                <CTableHeaderCell>Ngày đăng ký</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái hồ sơ</CTableHeaderCell>
                <CTableHeaderCell>Thanh toán</CTableHeaderCell>
                <CTableHeaderCell>Điều kiện</CTableHeaderCell>
                <CTableHeaderCell>Sẵn sàng</CTableHeaderCell>
                <CTableHeaderCell>Thao tác</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.length === 0 && !listLoading ? <CTableRow><CTableDataCell colSpan={9} className='text-center text-body-secondary py-4'>Chưa có hồ sơ phù hợp với bộ lọc hiện tại.</CTableDataCell></CTableRow> : null}
              {rows.map((item) => {
                const registrationBadge = getRegistrationStatusBadge(item.registrationStatus)
                const paymentBadge = getPaymentStatusBadge(item.paymentStatus)
                const readinessBadge = getReadinessBadge(item.readiness)
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
                      <div className='small text-body-secondary'>{item.subjectCount || 0} môn · {item.componentCount || item.componentsSummary?.total || 0} kỹ năng</div>
                    </CTableDataCell>
                    <CTableDataCell>{formatDateTime(item.registeredAt)}</CTableDataCell>
                    <CTableDataCell><CBadge color={registrationBadge.color}>{registrationBadge.label}</CBadge></CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={paymentBadge.color}>{paymentBadge.label}</CBadge>
                      <div className='small text-body-secondary mt-1'>{`${formatMoney(item.payableAmount || 0)} VND`}</div>
                    </CTableDataCell>
                    <CTableDataCell>{getEligibilityLabel(item.eligibility?.status || item.eligibilityStatus, round?.registrationMode)}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={readinessBadge.color}>{readinessBadge.label}</CBadge>
                      <div className='small text-body-secondary mt-1'>{renderBlockingReasons(item.readiness)}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton color='secondary' size='sm' variant='outline' onClick={() => openDetail(item.id)}>Xem chi tiết</CButton>
                        <CButton color='secondary' size='sm' variant='outline' onClick={() => goPayments(item.registrationCode)}>Xem thanh toán</CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>

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
        <CModalHeader><CModalTitle>Chi tiết hồ sơ đăng ký</CModalTitle></CModalHeader>
        <CModalBody>
          {detailError ? <CAlert color='danger'>{detailError}</CAlert> : null}
          {detailLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết...</div> : null}
          {!detailLoading && detail ? (
            <CRow className='g-4'>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Thông tin hồ sơ</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-2'><div className='small text-body-secondary'>Mã hồ sơ</div><div className='fw-semibold'>{detail.registration?.registrationCode || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Ngày tạo</div><div>{formatDateTime(detail.registration?.registeredAt)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Trạng thái hồ sơ</div><div>{getRegistrationStatusLabel(detail.registration?.registrationStatus)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Thanh toán</div><div>{getPaymentStatusLabel(detail.registration?.paymentStatus)}</div></div>
                    <div><div className='small text-body-secondary'>Readiness</div><div>{detail.readiness?.canAccept ? 'Sẵn sàng' : 'Còn điều kiện'}</div></div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={6}>
                <CCard className='h-100'>
                  <CCardHeader><strong>Người học</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-2'><div className='small text-body-secondary'>Mã learner</div><div>{detail.learner?.code || detail.registration?.learnerSnapshot?.studentCode || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Họ tên</div><div>{detail.learner?.fullName || detail.registration?.learnerSnapshot?.fullName || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Lớp</div><div>{detail.registration?.learnerSnapshot?.className || '-'}</div></div>
                    <div><div className='small text-body-secondary'>Ngành</div><div>{detail.registration?.learnerSnapshot?.major || '-'}</div></div>
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
                          <div className='fw-semibold mb-1'>{subject.subject?.nameSnapshot || '-'}</div>
                          <div className='small text-body-secondary mb-2'>Phí môn: {`${formatMoney(subject.feeAmount || 0)} VND`}</div>
                          <div className='d-flex flex-column gap-1'>
                            {(subject.components || []).map((component) => (
                              <div key={component.id} className='small'>{component.component?.nameSnapshot || '-'} · {component.component?.durationMinutes ? `${component.component.durationMinutes} phút` : '-'} · {`${formatMoney(component.feeAmount || 0)} VND`}</div>
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
                  <CCardHeader><strong>Eligibility và readiness</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-2'><div className='small text-body-secondary'>Chế độ đăng ký</div><div>{String(detail.examRound?.registrationMode || '').trim().toLowerCase() === 'open' ? 'Open' : 'Restricted'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Eligibility</div><div>{getEligibilityLabel(detail.eligibility?.status || detail.registration?.eligibilityStatus, detail.examRound?.registrationMode)}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Lý do</div><div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detail.eligibility?.reason || '-'}</div></div>
                    <div className='mb-2'><div className='small text-body-secondary'>Sẵn sàng</div><div>{detail.readiness?.canAccept ? 'Sẵn sàng để chuyển bước tổ chức thi' : 'Chưa sẵn sàng'}</div></div>
                    <div><div className='small text-body-secondary'>Blocking reasons</div><div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderBlockingReasons(detail.readiness)}</div></div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol xs={12}>
                <CCard>
                  <CCardHeader><strong>Thanh toán tóm tắt</strong></CCardHeader>
                  <CCardBody>
                    <div className='d-flex flex-wrap gap-4'>
                      <div><div className='small text-body-secondary'>Số tiền phải nộp</div><div>{`${formatMoney(detail.registration?.payableAmount || 0)} VND`}</div></div>
                      <div><div className='small text-body-secondary'>Đã xác nhận</div><div>{`${formatMoney(detail.registration?.confirmedPaidAmount || 0)} VND`}</div></div>
                      <div><div className='small text-body-secondary'>Trạng thái thanh toán</div><div>{getPaymentStatusLabel(detail.registration?.paymentStatus)}</div></div>
                    </div>
                    <div className='mt-3 d-flex gap-2 flex-wrap'>
                      <CButton color='secondary' variant='outline' onClick={() => goPayments(detail.registration?.registrationCode)}>Xem và xử lý thanh toán</CButton>
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeDetail}>Đóng</CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}
