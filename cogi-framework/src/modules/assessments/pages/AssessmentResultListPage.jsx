import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CFormCheck, CFormInput, CFormLabel, CFormSelect, CPagination, CPaginationItem, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { buildPages, formatDateTime, formatScorePair, getCefrLabel, getEntityId, getResultStatusBadgeColor, getResultStatusLabel, normalizePagination } from '../components/assessmentUi'
import { getApiMessage, getAssessmentResults, getAssessments, getAssessmentVersions } from '../services/assessmentService'

const RESULT_STATUS_FILTER_OPTIONS = [
  { value: 'partially_scored', label: 'Chờ chấm' },
  { value: 'provisional', label: 'Đã chấm / sơ bộ' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'superseded', label: 'Đã thay thế' },
]

function getWorkflowStateLabel(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'cancelled') return 'Đã hủy'
  if (normalized === 'manual_pending') return 'Chờ chấm'
  if (normalized === 'speaking_pending') return 'Chờ Speaking'
  if (normalized === 'confirmation_pending') return 'Chờ xác nhận'
  if (normalized === 'confirmed') return 'Đã xác nhận'
  if (normalized === 'provisional_ready') return 'Sẵn sàng xác nhận'
  return ''
}

function getWorkflowStateColor(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'cancelled') return 'secondary'
  if (normalized === 'confirmed') return 'success'
  if (normalized === 'manual_pending' || normalized === 'speaking_pending' || normalized === 'confirmation_pending') return 'warning'
  return 'secondary'
}

export default function AssessmentResultListPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [versions, setVersions] = useState([])
  const [qDraft, setQDraft] = useState('')
  const [filters, setFilters] = useState({ q: '', assessmentId: '', assessmentVersionId: '', status: '', provisionalLevel: '', hasManualPending: false, submittedFrom: '', submittedTo: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [error, setError] = useState('')

  const pagination = normalizePagination(meta?.pagination)
  const pages = useMemo(() => buildPages(page, pagination.pageCount), [page, pagination.pageCount])

  useEffect(() => {
    loadBootstrap()
  }, [])

  useEffect(() => {
    loadResults()
  }, [page, pageSize, filters])

  async function loadBootstrap() {
    setBootLoading(true)
    try {
      const [assessmentPayload, versionPayload] = await Promise.all([
        getAssessments({ page: 1, pageSize: 100, sort: 'name:asc' }),
        getAssessmentVersions({ page: 1, pageSize: 100, sort: 'updatedAt:desc' }),
      ])
      setAssessments(Array.isArray(assessmentPayload?.data) ? assessmentPayload.data : [])
      setVersions(Array.isArray(versionPayload?.data) ? versionPayload.data : [])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được dữ liệu bộ lọc kết quả đánh giá'))
    } finally {
      setBootLoading(false)
    }
  }

  async function loadResults() {
    setLoading(true)
    setError('')
    try {
      const payload = await getAssessmentResults({
        page,
        pageSize,
        q: filters.q || undefined,
        assessmentId: filters.assessmentId || undefined,
        assessmentVersionId: filters.assessmentVersionId || undefined,
        status: filters.status || undefined,
        provisionalLevel: filters.provisionalLevel || undefined,
        hasManualPending: filters.hasManualPending ? true : undefined,
        submittedFrom: filters.submittedFrom || undefined,
        submittedTo: filters.submittedTo || undefined,
      })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
      setMeta(payload?.meta || null)
    } catch (requestError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(requestError, 'Không tải được danh sách kết quả đánh giá'))
    } finally {
      setLoading(false)
    }
  }

  if (bootLoading) return <div className='py-4 d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải dữ liệu kết quả đánh giá...</span></div>

  return (
    <>
      <CCard className='mb-4 ai-card'>
        <CCardHeader>
          <div className='fs-4 fw-semibold'>Kết quả đánh giá</div>
          <div className='text-body-secondary'>Theo dõi kết quả các lượt làm bài, điểm tự động, nội dung chờ chấm và kết quả xếp mức sơ bộ.</div>
        </CCardHeader>
      </CCard>

      <CCard className='mb-4 ai-card'>
        <CCardHeader><strong>Bộ lọc</strong></CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol md={4}><CFormInput label='Keyword' value={qDraft} placeholder='Mã lượt làm, mã kết quả, tên/email thí sinh...' onChange={(event) => setQDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setFilters((prev) => ({ ...prev, q: qDraft.trim() })); setPage(1) } }} /></CCol>
            <CCol md={3}><CFormLabel>Assessment</CFormLabel><CFormSelect value={filters.assessmentId} onChange={(event) => { setFilters((prev) => ({ ...prev, assessmentId: event.target.value, assessmentVersionId: '' })); setPage(1) }}><option value=''>Tất cả</option>{assessments.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.name || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={3}><CFormLabel>Assessment Version</CFormLabel><CFormSelect value={filters.assessmentVersionId} onChange={(event) => { setFilters((prev) => ({ ...prev, assessmentVersionId: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{versions.filter((item) => !filters.assessmentId || String(getEntityId(item?.assessment)) === String(filters.assessmentId)).map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{`${item.code} · v${item.version}`}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Result status</CFormLabel><CFormSelect value={filters.status} onChange={(event) => { setFilters((prev) => ({ ...prev, status: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{RESULT_STATUS_FILTER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Provisional level</CFormLabel><CFormSelect value={filters.provisionalLevel} onChange={(event) => { setFilters((prev) => ({ ...prev, provisionalLevel: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((item) => <option key={item} value={item}>{getCefrLabel(item)}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Từ ngày nộp</CFormLabel><CFormInput type='date' value={filters.submittedFrom} onChange={(event) => { setFilters((prev) => ({ ...prev, submittedFrom: event.target.value })); setPage(1) }} /></CCol>
            <CCol md={2}><CFormLabel>Đến ngày nộp</CFormLabel><CFormInput type='date' value={filters.submittedTo} onChange={(event) => { setFilters((prev) => ({ ...prev, submittedTo: event.target.value })); setPage(1) }} /></CCol>
            <CCol md={3} className='d-flex align-items-center'><CFormCheck checked={filters.hasManualPending} onChange={(event) => { setFilters((prev) => ({ ...prev, hasManualPending: event.target.checked })); setPage(1) }} label='Có bài chờ chấm thủ công' /></CCol>
            <CCol md={3} className='d-flex gap-2'>
              <CButton color='primary' onClick={() => { setFilters((prev) => ({ ...prev, q: qDraft.trim() })); setPage(1) }} disabled={loading}>Search</CButton>
              <CButton color='secondary' variant='outline' onClick={() => { setQDraft(''); setFilters({ q: '', assessmentId: '', assessmentVersionId: '', status: '', provisionalLevel: '', hasManualPending: false, submittedFrom: '', submittedTo: '' }); setPage(1) }} disabled={loading}>Xóa bộ lọc</CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CCard className='ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'><div><strong>Danh sách kết quả</strong><CBadge color='secondary' className='ms-2'>{pagination.total}</CBadge></div></CCardHeader>
        <CCardBody>
          {loading ? <div className='d-flex align-items-center gap-2 py-3'><CSpinner size='sm' /><span>Đang tải kết quả đánh giá...</span></div> : (
            <>
              <div className='d-none d-lg-block'>
                <CTable responsive hover align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Thí sinh</CTableHeaderCell>
                      <CTableHeaderCell>Đề</CTableHeaderCell>
                      <CTableHeaderCell>Phiên bản</CTableHeaderCell>
                      <CTableHeaderCell>Nộp lúc</CTableHeaderCell>
                      <CTableHeaderCell>Điểm</CTableHeaderCell>
                      <CTableHeaderCell>Tỷ lệ</CTableHeaderCell>
                      <CTableHeaderCell>Chờ chấm</CTableHeaderCell>
                      <CTableHeaderCell>Mức sơ bộ</CTableHeaderCell>
                      <CTableHeaderCell>Mức xác nhận</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Actions</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? <CTableRow><CTableDataCell colSpan={11} className='text-center text-body-secondary'>Chưa có kết quả đánh giá.</CTableDataCell></CTableRow> : rows.map((row) => (
                      <CTableRow key={row.id}>
                        <CTableDataCell><div className='fw-semibold'>{row.candidateName || '-'}</div><div className='small text-body-secondary'>{row.candidateEmail || row.attempt?.code || ''}</div></CTableDataCell>
                        <CTableDataCell>{row.assessment?.name || row.assessment?.code || '-'}</CTableDataCell>
                        <CTableDataCell>{row.assessmentVersion?.code || '-'}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(row.submittedAt)}</CTableDataCell>
                        <CTableDataCell>{formatScorePair(row.rawScore, row.maxScore)}</CTableDataCell>
                        <CTableDataCell>{row.percentage !== null && row.percentage !== undefined ? `${row.percentage}%` : '-'}</CTableDataCell>
                        <CTableDataCell>{row.pendingManualCount}</CTableDataCell>
                        <CTableDataCell>{row.provisionalLevel ? getCefrLabel(row.provisionalLevel) : '-'}</CTableDataCell>
                        <CTableDataCell>{row.confirmedLevel ? getCefrLabel(row.confirmedLevel) : '-'}</CTableDataCell>
                        <CTableDataCell><CBadge color={getWorkflowStateColor(row.workflowState) || getResultStatusBadgeColor(row.status)}>{getWorkflowStateLabel(row.workflowState) || getResultStatusLabel(row.status)}</CBadge></CTableDataCell>
                        <CTableDataCell><CButton size='sm' color='info' variant='outline' onClick={() => navigate(`/assessment-results/${row.id}`)}>Mở</CButton></CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>
              <div className='d-lg-none d-grid gap-3'>
                {rows.length === 0 ? <div className='text-center text-body-secondary py-4'>Chưa có kết quả đánh giá.</div> : rows.map((row) => (
                  <CCard key={row.id} className='border'>
                    <CCardBody>
                      <div className='fw-semibold'>{row.candidateName || '-'}</div>
                      <div className='small text-body-secondary mb-2'>{row.assessment?.name || row.assessment?.code || '-'}</div>
                      <div className='small text-body-secondary'>Nộp lúc: {formatDateTime(row.submittedAt)}</div>
                      <div className='small text-body-secondary'>Điểm: {formatScorePair(row.rawScore, row.maxScore)}</div>
                      <div className='small text-body-secondary'>Chờ chấm: {row.pendingManualCount}</div>
                      <div className='small text-body-secondary'>Trạng thái: {getWorkflowStateLabel(row.workflowState) || getResultStatusLabel(row.status)}</div>
                      <div className='small text-body-secondary'>Mức sơ bộ: {row.provisionalLevel ? getCefrLabel(row.provisionalLevel) : '-'}</div>
                      <div className='small text-body-secondary mb-3'>Mức xác nhận: {row.confirmedLevel ? getCefrLabel(row.confirmedLevel) : '-'}</div>
                      <CButton size='sm' color='info' variant='outline' onClick={() => navigate(`/assessment-results/${row.id}`)}>Xem chi tiết</CButton>
                    </CCardBody>
                  </CCard>
                ))}
              </div>
              <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3'>
                <div className='small text-body-secondary'>{pagination.total > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, pagination.total)}/${pagination.total}` : '0'}</div>
                <div className='d-flex align-items-center gap-2'>
                  <CFormSelect value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value || 10)); setPage(1) }} style={{ width: 110 }}>
                    {[10, 20, 50].map((size) => <option key={size} value={size}>{size}/trang</option>)}
                  </CFormSelect>
                  <CPagination className='mb-0'>
                    <CPaginationItem disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => item === '...' ? <CPaginationItem key={`ellipsis-${index}`} disabled>…</CPaginationItem> : <CPaginationItem key={item} active={item === page} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pagination.pageCount} onClick={() => setPage((prev) => Math.min(pagination.pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </div>
            </>
          )}
        </CCardBody>
      </CCard>
    </>
  )
}