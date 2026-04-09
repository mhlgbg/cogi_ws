import { useEffect, useMemo, useState } from 'react'
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
  CFormLabel,
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
import { getMyFeeSheetClassPage, submitMyFeeSheetClass } from '../services/feeSheetService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function buildPages(currentPage, pageCount) {
  const maxButtons = 7
  const pages = []
  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }
  const left = Math.max(1, currentPage - 2)
  const right = Math.min(pageCount, currentPage + 2)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) {
    if (index !== 1 && index !== pageCount) pages.push(index)
  }
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'approved') return { color: 'success', label: 'Approved' }
  if (normalized === 'submitted') return { color: 'info', label: 'Submitted' }
  return { color: 'warning', label: 'Draft' }
}

export default function MyFeeSheetClassListPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const total = pagination?.total ?? 0
  const pageCount = pagination?.pageCount ?? 1
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])

  const fromToText = useMemo(() => {
    if (!pagination || total === 0) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, total)
    return `${from}–${to}/${total}`
  }, [pagination, total])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await getMyFeeSheetClassPage({ page, pageSize, q, status: statusFilter })
      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setPagination(result?.pagination ?? null)
    } catch (loadError) {
      setRows([])
      setPagination(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách bảng phí lớp'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, pageSize, q, statusFilter])

  function applySearch() {
    setPage(1)
    setQ(qDraft.trim())
  }

  function onReset() {
    setPage(1)
    setQ('')
    setQDraft('')
    setStatusFilter('')
  }

  async function handleSubmit(item) {
    if (!window.confirm('Bạn chắc chắn muốn gửi đề nghị phê duyệt bảng phí lớp này?')) return

    setError('')
    try {
      await submitMyFeeSheetClass(item.id)
      setSuccess('Đã gửi đề nghị phê duyệt')
      await load()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gửi đề nghị phê duyệt'))
    }
  }

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <CCard className='mb-4'>
          <CCardHeader><strong>Bộ lọc</strong></CCardHeader>
          <CCardBody>
            <CRow className='g-3 align-items-end'>
              <CCol md={7}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo tên bảng phí, lớp, giáo viên...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={3}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value) }}>
                  <option value=''>Tất cả</option>
                  <option value='draft'>Draft</option>
                  <option value='submitted'>Submitted</option>
                  <option value='approved'>Approved</option>
                </CFormSelect>
              </CCol>
              <CCol md={2} className='d-flex justify-content-end gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color='secondary' variant='outline' onClick={onReset} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {success ? <CAlert color='success' className='mb-4'>{success}</CAlert> : null}
        {error ? <CAlert color='danger' className='mb-4'>{error}</CAlert> : null}

        <CCard>
          <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
            <div>
              <strong>Bảng Phí Lớp Của Tôi</strong>
              <CBadge color='secondary' className='ms-2'>{total}</CBadge>
            </div>
            <div className='text-body-secondary small'>{fromToText}</div>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive className='mb-3'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 220 }}>Bảng phí</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 180 }}>Lớp</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Từ ngày</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Đến ngày</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 120 }}>FeeItems</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={8} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => {
                      const status = formatStatus(item.status)
                      return (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                          <CTableDataCell>{item?.feeSheet?.name || '-'}</CTableDataCell>
                          <CTableDataCell>{item.classNameSnapshot || '-'}</CTableDataCell>
                          <CTableDataCell>{item?.feeSheet?.fromDate || '-'}</CTableDataCell>
                          <CTableDataCell>{item?.feeSheet?.toDate || '-'}</CTableDataCell>
                          <CTableDataCell><CBadge color={status.color}>{status.label}</CBadge></CTableDataCell>
                          <CTableDataCell>{item.feeItemsCount || 0}</CTableDataCell>
                          <CTableDataCell>
                            <div className='d-flex gap-2 flex-wrap'>
                              <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/my-fee-sheet-classes/${item.id}`)}>{item.canEdit ? 'Nhập liệu' : 'Xem'}</CButton>
                              <CButton size='sm' color='success' variant='outline' disabled={!item.canEdit} onClick={() => handleSubmit(item)}>Gửi duyệt</CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>

                <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                  <div className='d-flex align-items-center gap-2'>
                    <span>Page size</span>
                    <CFormSelect value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value) || 10) }} style={{ width: 100 }}>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </CFormSelect>
                  </div>
                  <CPagination align='end' className='mb-0'>
                    <CPaginationItem disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => item === '...'
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