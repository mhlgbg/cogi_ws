import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CPagination,
  CPaginationItem,
} from '@coreui/react'
import { useFeature } from '../../../contexts/FeatureContext'
import ExamRoundStatusBadge from '../components/ExamRoundStatusBadge'
import { getExamProgramsLookup, getExamRounds } from '../services/examRoundApi'
import {
  buildExamRoundCreatePath,
  buildExamRoundPath,
  formatDateTime,
  getApiMessage,
  getPaymentCalculationMethodLabel,
  getRegistrationModeLabel,
} from '../utils/examRoundUi'

function buildPages(currentPage, pageCount) {
  const maxButtons = 7
  const pages = []
  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }

  const left = Math.max(2, currentPage - 2)
  const right = Math.min(pageCount - 1, currentPage + 2)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

function getInitialFilters(searchParams) {
  return {
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    examProgramId: searchParams.get('examProgramId') || '',
    registrationMode: searchParams.get('registrationMode') || '',
    registrationStartFrom: searchParams.get('registrationStartFrom') || '',
    registrationStartTo: searchParams.get('registrationStartTo') || '',
  }
}

export default function ExamRoundListPage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const feature = useFeature()
  const canManage = feature?.hasFeature?.('exam-round.manage') || false

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [examPrograms, setExamPrograms] = useState([])
  const [pagination, setPagination] = useState({
    page: Number(searchParams.get('page') || 1),
    pageSize: Number(searchParams.get('pageSize') || 10),
    total: 0,
    pageCount: 1,
  })
  const [filters, setFilters] = useState(() => getInitialFilters(searchParams))
  const [appliedFilters, setAppliedFilters] = useState(() => getInitialFilters(searchParams))

  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  function syncUrl(nextPage, nextPageSize, nextFilters) {
    const params = new URLSearchParams()
    params.set('page', String(nextPage))
    params.set('pageSize', String(nextPageSize))
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    setSearchParams(params)
  }

  useEffect(() => {
    let mounted = true
    async function loadOptions() {
      try {
        const result = await getExamProgramsLookup('')
        if (!mounted) return
        setExamPrograms(Array.isArray(result) ? result : [])
      } catch {
        if (mounted) setExamPrograms([])
      }
    }
    loadOptions()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getExamRounds({
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...appliedFilters,
        })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
        syncUrl(result?.pagination?.page || pagination.page, result?.pagination?.pageSize || pagination.pageSize, appliedFilters)
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(getApiMessage(requestError, 'Không tải được danh sách đợt thi'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [appliedFilters, pagination.page, pagination.pageSize])

  function applyFilters() {
    setPagination((prev) => ({ ...prev, page: 1 }))
    setAppliedFilters(filters)
  }

  function resetFilters() {
    const next = { search: '', status: '', examProgramId: '', registrationMode: '', registrationStartFrom: '', registrationStartTo: '' }
    setFilters(next)
    setAppliedFilters(next)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <div>
              <div className='fw-semibold'>Đợt thi chuẩn đầu ra</div>
              <div className='small text-body-secondary'>Quản lý các đợt thi được tạo từ chương trình thi, từ cấu hình ban đầu đến đăng ký và tổ chức thi.</div>
            </div>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={() => setPagination((prev) => ({ ...prev }))} disabled={loading}>Tải lại</CButton>
              {canManage ? <CButton color='primary' onClick={() => navigate(buildExamRoundCreatePath(tenantCode))}>Tạo đợt thi</CButton> : null}
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol lg={3} md={6}>
                <CFormLabel>Tìm kiếm</CFormLabel>
                <CFormInput placeholder='Mã hoặc tên đợt thi' value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
              </CCol>
              <CCol lg={2} md={6}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value=''>Tất cả trạng thái</option>
                  <option value='draft'>Bản nháp</option>
                  <option value='pending_approval'>Chờ phê duyệt</option>
                  <option value='approved'>Đã phê duyệt</option>
                  <option value='registration_open'>Đang mở đăng ký</option>
                  <option value='registration_paused'>Tạm dừng đăng ký</option>
                  <option value='registration_closed'>Đã đóng đăng ký</option>
                  <option value='preparing_exam'>Chuẩn bị thi</option>
                  <option value='exam_in_progress'>Đang thi</option>
                  <option value='scoring'>Chấm thi</option>
                  <option value='completed'>Hoàn thành</option>
                  <option value='cancelled'>Đã hủy</option>
                </CFormSelect>
              </CCol>
              <CCol lg={3} md={6}>
                <CFormLabel>Chương trình</CFormLabel>
                <CFormSelect value={filters.examProgramId} onChange={(event) => setFilters((prev) => ({ ...prev, examProgramId: event.target.value }))}>
                  <option value=''>Tất cả chương trình</option>
                  {examPrograms.map((item) => <option key={item.id} value={item.id}>{item.code ? `[${item.code}] ` : ''}{item.name}</option>)}
                </CFormSelect>
              </CCol>
              <CCol lg={2} md={6}>
                <CFormLabel>Chế độ đăng ký</CFormLabel>
                <CFormSelect value={filters.registrationMode} onChange={(event) => setFilters((prev) => ({ ...prev, registrationMode: event.target.value }))}>
                  <option value=''>Tất cả</option>
                  <option value='open'>Mở</option>
                  <option value='restricted'>Có điều kiện</option>
                </CFormSelect>
              </CCol>
              <CCol lg={2} md={6}>
                <CFormLabel>Từ ngày đăng ký</CFormLabel>
                <CFormInput type='datetime-local' value={filters.registrationStartFrom} onChange={(event) => setFilters((prev) => ({ ...prev, registrationStartFrom: event.target.value }))} />
              </CCol>
              <CCol lg={2} md={6}>
                <CFormLabel>Đến ngày đăng ký</CFormLabel>
                <CFormInput type='datetime-local' value={filters.registrationStartTo} onChange={(event) => setFilters((prev) => ({ ...prev, registrationStartTo: event.target.value }))} />
              </CCol>
            </CRow>

            <div className='d-flex gap-2 mb-3 flex-wrap'>
              <CButton color='primary' onClick={applyFilters}>Lọc</CButton>
              <CButton color='secondary' variant='outline' onClick={resetFilters}>Đặt lại</CButton>
            </div>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải danh sách đợt thi...</span>
              </div>
            ) : (
              <>
                <CTable responsive hover align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Mã đợt</CTableHeaderCell>
                      <CTableHeaderCell>Tên đợt</CTableHeaderCell>
                      <CTableHeaderCell>Chương trình</CTableHeaderCell>
                      <CTableHeaderCell>Thời gian đăng ký</CTableHeaderCell>
                      <CTableHeaderCell>Thời gian thi</CTableHeaderCell>
                      <CTableHeaderCell>Chế độ đăng ký</CTableHeaderCell>
                      <CTableHeaderCell>Phương thức lệ phí</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Cập nhật gần nhất</CTableHeaderCell>
                      <CTableHeaderCell>Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length > 0 ? rows.map((row) => (
                      <CTableRow key={row.id}>
                        <CTableDataCell>{row.code || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='fw-semibold'>{row.name || '-'}</div>
                          <div className='small text-body-secondary'>{row.academicYear || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>{row.examProgram?.name || '-'}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(row.registrationStartAt)} - {formatDateTime(row.registrationEndAt)}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(row.examStartAt)} - {formatDateTime(row.examEndAt)}</CTableDataCell>
                        <CTableDataCell>{getRegistrationModeLabel(row.registrationMode)}</CTableDataCell>
                        <CTableDataCell>{getPaymentCalculationMethodLabel(row.paymentCalculationMethod)}</CTableDataCell>
                        <CTableDataCell><ExamRoundStatusBadge status={row.status} /></CTableDataCell>
                        <CTableDataCell>{formatDateTime(row.updatedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2 flex-wrap'>
                            <CButton size='sm' color='secondary' variant='outline' onClick={() => navigate(buildExamRoundPath(row.id, 'overview', tenantCode))}>Xem chi tiết</CButton>
                            {canManage && row.status === 'draft' ? <CButton size='sm' color='warning' variant='outline' onClick={() => navigate(buildExamRoundPath(row.id, 'overview', tenantCode))}>Sửa</CButton> : null}
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    )) : (
                      <CTableRow>
                        <CTableDataCell colSpan={10} className='text-center text-body-secondary'>Chưa có đợt thi nào phù hợp với bộ lọc hiện tại.</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>

                {pagination.pageCount > 1 ? (
                  <div className='d-flex justify-content-end'>
                    <CPagination>
                      <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}>Trước</CPaginationItem>
                      {pages.map((item, index) => item === '...'
                        ? <CPaginationItem key={`ellipsis:${index}`} disabled>...</CPaginationItem>
                        : <CPaginationItem key={item} active={pagination.page === item} onClick={() => setPagination((prev) => ({ ...prev, page: item }))}>{item}</CPaginationItem>)}
                      <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pageCount, prev.page + 1) }))}>Sau</CPaginationItem>
                    </CPagination>
                  </div>
                ) : null}
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}