import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CAlert,
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
import QuickMessageStatusBadge from '../components/QuickMessageStatusBadge'
import {
  buildPaginationItems,
  formatDateTime,
  normalizeQuickMessageListFilters,
  QUICK_MESSAGE_STATUS_OPTIONS,
} from '../components/quickMessageUi'
import { getApiMessage, listQuickMessages } from '../services/quickMessageService'

export default function QuickMessageListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilters = useMemo(() => normalizeQuickMessageListFilters(searchParams), [searchParams])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({
    page: initialFilters.page,
    pageSize: initialFilters.pageSize,
    total: 0,
    pageCount: 1,
  })
  const [searchDraft, setSearchDraft] = useState(initialFilters.search)
  const [search, setSearch] = useState(initialFilters.search)
  const [status, setStatus] = useState(initialFilters.status)

  useEffect(() => {
    setSearchDraft(initialFilters.search)
    setSearch(initialFilters.search)
    setStatus(initialFilters.status)
    setPagination((prev) => ({
      ...prev,
      page: initialFilters.page,
      pageSize: initialFilters.pageSize,
    }))
  }, [initialFilters.page, initialFilters.pageSize, initialFilters.search, initialFilters.status])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await listQuickMessages({
          page: pagination.page,
          pageSize: pagination.pageSize,
          search: search || undefined,
          status: status || undefined,
        })
        if (!mounted) return
        const nextPagination = result?.pagination || {}
        setRows(Array.isArray(result?.data) ? result.data : [])
        setPagination((prev) => ({
          ...prev,
          page: Number(nextPagination.page || prev.page) || 1,
          pageSize: Number(nextPagination.pageSize || prev.pageSize) || 10,
          total: Number(nextPagination.total || 0),
          pageCount: Number(nextPagination.pageCount || 1),
        }))

        const params = new URLSearchParams()
        params.set('page', String(Number(nextPagination.page || pagination.page) || 1))
        params.set('pageSize', String(Number(nextPagination.pageSize || pagination.pageSize) || 10))
        if (search) params.set('search', search)
        if (status) params.set('status', status)
        setSearchParams(params, { replace: true })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(getApiMessage(requestError, 'Không tải được danh sách thông điệp'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [pagination.page, pagination.pageSize, search, setSearchParams, status])

  const pageItems = useMemo(() => buildPaginationItems(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])
  const rangeText = useMemo(() => {
    if (!pagination.total) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, pagination.total)
    return `${from}-${to}/${pagination.total}`
  }, [pagination.page, pagination.pageSize, pagination.total])

  function applyFilters() {
    setPagination((prev) => ({ ...prev, page: 1 }))
    setSearch(String(searchDraft || '').trim())
  }

  function resetFilters() {
    setSearchDraft('')
    setSearch('')
    setStatus('')
    setPagination((prev) => ({ ...prev, page: 1, pageSize: 10 }))
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard className='border-0 shadow-sm'>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <div>
              <strong>Chuyển nhanh</strong>
              <div className='small text-body-secondary mt-1'>Tạo thông điệp ngắn và chia sẻ qua mã truy cập tạm thời.</div>
            </div>
            <CButton color='primary' onClick={() => navigate('/quick-messages/new')}>Tạo thông điệp</CButton>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={8}>
                <CFormInput
                  placeholder='Tìm theo tiêu đề hoặc người tạo'
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyFilters()
                  }}
                />
              </CCol>
              <CCol md={2}>
                <CFormSelect value={status} onChange={(event) => { setStatus(event.target.value); setPagination((prev) => ({ ...prev, page: 1 })) }}>
                  {QUICK_MESSAGE_STATUS_OPTIONS.map((item) => (
                    <option key={item.value || 'all'} value={item.value}>{item.label}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2} className='d-flex gap-2'>
                <CButton color='primary' className='flex-fill' onClick={applyFilters} disabled={loading}>Lọc</CButton>
                <CButton color='secondary' variant='outline' className='flex-fill' onClick={resetFilters} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải dữ liệu...</div>
            ) : rows.length === 0 ? (
              <div className='text-center py-5'>
                <div className='fw-semibold mb-2'>Chưa có thông điệp nào.</div>
                <div className='text-body-secondary mb-3'>Hãy tạo thông điệp đầu tiên để bắt đầu chia sẻ nhanh.</div>
                <CButton color='primary' onClick={() => navigate('/quick-messages/new')}>Tạo thông điệp</CButton>
              </div>
            ) : (
              <>
                <CTable hover responsive align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Hết hạn</CTableHeaderCell>
                      <CTableHeaderCell>Số mã</CTableHeaderCell>
                      <CTableHeaderCell>Lượt xem</CTableHeaderCell>
                      <CTableHeaderCell>Phản hồi</CTableHeaderCell>
                      <CTableHeaderCell>Người tạo</CTableHeaderCell>
                      <CTableHeaderCell>Ngày tạo</CTableHeaderCell>
                      <CTableHeaderCell>Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.map((item) => (
                      <CTableRow key={item.id || item.documentId}>
                        <CTableDataCell>
                          <div className='fw-semibold'>{item.title || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell><QuickMessageStatusBadge status={item.status} effectiveStatus={item.effectiveStatus} /></CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.expiresAt)}</CTableDataCell>
                        <CTableDataCell>{item.accessCount || 0}</CTableDataCell>
                        <CTableDataCell>{item.totalViewCount || 0}</CTableDataCell>
                        <CTableDataCell>
                          {Number(item.replyCount || 0) > 0 ? (
                            <div>
                              <div>{item.replyCount || 0} phản hồi</div>
                              <div className='small text-body-secondary'>{item.unreadReplyCount || 0} chưa đọc</div>
                            </div>
                          ) : '0'}
                        </CTableDataCell>
                        <CTableDataCell>{item.senderDisplayName || '-'}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.createdAt)}</CTableDataCell>
                        <CTableDataCell>
                          <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/quick-messages/${item.id || item.documentId}`)}>Xem chi tiết</CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mt-3'>
                  <div className='d-flex align-items-center gap-2'>
                    <span className='text-body-secondary small'>Hiển thị</span>
                    <CFormSelect
                      style={{ width: 96 }}
                      value={pagination.pageSize}
                      onChange={(event) => setPagination((prev) => ({ ...prev, page: 1, pageSize: Number(event.target.value) || 10 }))}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </CFormSelect>
                    <span className='text-body-secondary small'>{rangeText}</span>
                  </div>

                  <CPagination align='end' className='mb-0'>
                    <CPaginationItem disabled={pagination.page <= 1 || loading} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>Trước</CPaginationItem>
                    {pageItems.map((item) => typeof item === 'string'
                      ? <CPaginationItem key={item} disabled>…</CPaginationItem>
                      : <CPaginationItem key={item} active={item === pagination.page} disabled={loading} onClick={() => setPagination((prev) => ({ ...prev, page: item }))}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={pagination.page >= pagination.pageCount || loading} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>Sau</CPaginationItem>
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