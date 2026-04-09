import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { getAdmissionReviewList } from '../services/admissionManagementService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function getReviewStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'submitted') return 'Chờ duyệt'
  if (normalized === 'returned') return 'Trả lại'
  if (normalized === 'accepted') return 'Đã tiếp nhận'
  return normalized || '-'
}

function getReviewStatusColor(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'submitted') return 'warning'
  if (normalized === 'returned') return 'danger'
  if (normalized === 'accepted') return 'success'
  return 'secondary'
}

function buildPages(currentPage, pageCount) {
  const pages = []
  const maxButtons = 5

  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }

  const left = Math.max(2, currentPage - 1)
  const right = Math.min(pageCount - 1, currentPage + 1)

  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

export default function AdmissionReviewListPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [statusFilter, setStatusFilter] = useState('submitted')
  const [keywordDraft, setKeywordDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pageCount, setPageCount] = useState(1)
  const [total, setTotal] = useState(0)

  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])
  const fromToText = useMemo(() => {
    if (total === 0) return '0'
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    return `${from}-${to}/${total}`
  }, [page, pageSize, total])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await getAdmissionReviewList({
        status: statusFilter,
        q: keyword || undefined,
        page,
        pageSize,
      })

      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setTotal(Number(result?.pagination?.total || 0))
      setPage(Number(result?.pagination?.page || page))
      setPageSize(Number(result?.pagination?.pageSize || pageSize))
      setPageCount(Math.max(1, Number(result?.pagination?.pageCount || 1)))
    } catch (requestError) {
      setRows([])
      setTotal(0)
      setPageCount(1)
      setError(getApiMessage(requestError, 'Không tải được danh sách hồ sơ chờ duyệt'))
    } finally {
      setLoading(false)
    }
  }, [keyword, page, pageSize, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  function applySearch() {
    setPage(1)
    setKeyword(String(keywordDraft || '').trim())
  }

  function resetFilters() {
    setStatusFilter('submitted')
    setKeywordDraft('')
    setKeyword('')
    setPage(1)
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
            <strong>Duyệt hồ sơ tuyển sinh</strong>
            <div className='text-body-secondary small'>{fromToText}</div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={5}>
                <CFormInput
                  placeholder='Tìm theo mã hồ sơ, học sinh, phụ huynh, SĐT'
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={3}>
                <CFormSelect value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
                  <option value='submitted'>Chờ duyệt</option>
                  <option value='returned'>Trả lại</option>
                  <option value='accepted'>Đã tiếp nhận</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value) || 10) }}>
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </CFormSelect>
              </CCol>
              <CCol md={2} className='d-flex gap-2'>
                <CButton color='primary' className='w-100' onClick={applySearch} disabled={loading}>Lọc</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Mã hồ sơ</CTableHeaderCell>
                      <CTableHeaderCell>Học sinh</CTableHeaderCell>
                      <CTableHeaderCell>Phụ huynh</CTableHeaderCell>
                      <CTableHeaderCell>Ngày nộp</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Người duyệt</CTableHeaderCell>
                      <CTableHeaderCell>Thời gian duyệt</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length > 0 ? rows.map((item) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{item.applicationCode || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='fw-semibold'>{item.studentName || '-'}</div>
                          <div className='small text-body-secondary'>{item?.campaign?.name || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div>{item?.parent?.fullName || item?.parent?.username || '-'}</div>
                          <div className='small text-body-secondary'>{item?.parent?.phone || item?.parent?.email || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.submittedAt || item.createdAt)}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={getReviewStatusColor(item.reviewStatus)}>{getReviewStatusLabel(item.reviewStatus)}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{item?.reviewedBy?.fullName || item?.reviewedBy?.username || '-'}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.reviewedAt)}</CTableDataCell>
                        <CTableDataCell className='text-end'>
                          <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/admission/reviews/${item.id}`)}>
                            Xem hồ sơ
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    )) : (
                      <CTableRow>
                        <CTableDataCell colSpan={8} className='text-center text-body-secondary'>Không có hồ sơ phù hợp</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>

                <div className='d-flex justify-content-between align-items-center flex-wrap gap-3 mt-3'>
                  <div className='text-body-secondary small'>Hiển thị {fromToText}</div>
                  <CPagination align='end' className='mb-0'>
                    <CPaginationItem disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => typeof item === 'string'
                      ? <CPaginationItem key={`dots-${index}`} disabled>…</CPaginationItem>
                      : <CPaginationItem key={item} active={item === page} disabled={loading} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pageCount || loading} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}
