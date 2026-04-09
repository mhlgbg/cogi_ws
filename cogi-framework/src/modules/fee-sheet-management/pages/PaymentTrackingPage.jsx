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
import { getPaymentTrackingPage } from '../services/paymentTrackingService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatMoney(value) {
  const number = Number(value || 0)
  return new Intl.NumberFormat('vi-VN').format(number)
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function formatMethod(method) {
  const normalized = String(method || '').toLowerCase()
  if (normalized === 'transfer') return { color: 'info', label: 'Transfer' }
  if (normalized === 'other') return { color: 'secondary', label: 'Other' }
  return { color: 'success', label: 'Cash' }
}

function buildPages(currentPage, totalPages) {
  const pages = []
  const pageCount = Math.max(1, totalPages)

  if (pageCount <= 7) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }

  pages.push(1)
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(pageCount - 1, currentPage + 1)
  if (start > 2) pages.push('...')
  for (let index = start; index <= end; index += 1) pages.push(index)
  if (end < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

export default function PaymentTrackingPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ totalAmount: 0, totalAllocated: 0, totalUnallocated: 0 })
  const [filters, setFilters] = useState({ keyword: '', method: '', dateFrom: '', dateTo: '' })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / (pagination.pageSize || 20)))
  const pages = useMemo(() => buildPages(pagination.page || 1, totalPages), [pagination.page, totalPages])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getPaymentTrackingPage({
          page: pagination.page,
          pageSize: pagination.pageSize,
          keyword: filters.keyword,
          method: filters.method,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        })

        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setSummary(result?.summary || { totalAmount: 0, totalAllocated: 0, totalUnallocated: 0 })
        setPagination((current) => ({
          ...current,
          page: Number(result?.pagination?.page || current.page || 1),
          pageSize: Number(result?.pagination?.pageSize || current.pageSize || 20),
          total: Number(result?.pagination?.total || 0),
        }))
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setSummary({ totalAmount: 0, totalAllocated: 0, totalUnallocated: 0 })
        setPagination((current) => ({ ...current, total: 0 }))
        setError(getApiMessage(requestError, 'Không tải được danh sách hóa đơn'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [filters.keyword, filters.method, filters.dateFrom, filters.dateTo, pagination.page, pagination.pageSize])

  function updateFilter(key, value) {
    setPagination((current) => ({ ...current, page: 1 }))
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader><strong>Theo dõi hóa đơn</strong></CCardHeader>
          <CCardBody>
            <CRow className='g-3'>
              <CCol md={4}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo học viên hoặc ghi chú'
                  value={filters.keyword}
                  onChange={(event) => updateFilter('keyword', event.target.value)}
                />
              </CCol>
              <CCol md={2}>
                <CFormSelect label='Phương thức' value={filters.method} onChange={(event) => updateFilter('method', event.target.value)}>
                  <option value=''>Tất cả</option>
                  <option value='cash'>Cash</option>
                  <option value='transfer'>Transfer</option>
                  <option value='other'>Other</option>
                </CFormSelect>
              </CCol>
              <CCol md={3}>
                <CFormInput label='Từ ngày' type='datetime-local' value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
              </CCol>
              <CCol md={3}>
                <CFormInput label='Đến ngày' type='datetime-local' value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol md={4}>
        <CCard><CCardBody><div className='text-body-secondary small mb-1'>Tổng thu</div><div className='fs-4 fw-semibold'>{formatMoney(summary.totalAmount)}</div></CCardBody></CCard>
      </CCol>
      <CCol md={4}>
        <CCard><CCardBody><div className='text-body-secondary small mb-1'>Đã phân bổ</div><div className='fs-4 fw-semibold text-success'>{formatMoney(summary.totalAllocated)}</div></CCardBody></CCard>
      </CCol>
      <CCol md={4}>
        <CCard><CCardBody><div className='text-body-secondary small mb-1'>Chưa phân bổ</div><div className='fs-4 fw-semibold text-warning'>{formatMoney(summary.totalUnallocated)}</div></CCardBody></CCard>
      </CCol>

      <CCol xs={12}>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Danh sách hóa đơn</strong>
            <div className='d-flex align-items-center gap-2'>
              <span className='text-body-secondary small'>Tổng: {pagination.total || 0}</span>
              <CFormSelect
                size='sm'
                style={{ width: 96 }}
                value={pagination.pageSize}
                onChange={(event) => setPagination((current) => ({ ...current, page: 1, pageSize: Number(event.target.value) || 20 }))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </CFormSelect>
            </div>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive align='middle' className='mb-3'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Học viên</CTableHeaderCell>
                      <CTableHeaderCell>Ngày thu</CTableHeaderCell>
                      <CTableHeaderCell>Phương thức</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Số tiền</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Đã phân bổ</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Chưa phân bổ</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Khoản thu</CTableHeaderCell>
                      <CTableHeaderCell>Ghi chú</CTableHeaderCell>
                      <CTableHeaderCell>Chi tiết</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length > 0 ? rows.map((item) => {
                      const method = formatMethod(item.method)
                      return (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{item.learner?.name || '-'}</CTableDataCell>
                          <CTableDataCell>{formatDateTime(item.paymentDate)}</CTableDataCell>
                          <CTableDataCell><CBadge color={method.color}>{method.label}</CBadge></CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(item.amount)}</CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(item.allocatedAmount)}</CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(item.unallocatedAmount)}</CTableDataCell>
                          <CTableDataCell className='text-end'>{item.allocationCount || 0}</CTableDataCell>
                          <CTableDataCell>{item.note || '-'}</CTableDataCell>
                          <CTableDataCell>
                            <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/payment-tracking/${item.id}`)}>Xem</CButton>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    }) : (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>

                <div className='d-flex justify-content-center'>
                  <CPagination>
                    <CPaginationItem disabled={(pagination.page || 1) <= 1} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))}>Prev</CPaginationItem>
                    {pages.map((item, index) => (
                      <CPaginationItem
                        key={`${item}-${index}`}
                        active={item === pagination.page}
                        disabled={item === '...'}
                        onClick={() => {
                          if (typeof item === 'number') setPagination((current) => ({ ...current, page: item }))
                        }}
                      >
                        {item}
                      </CPaginationItem>
                    ))}
                    <CPaginationItem disabled={(pagination.page || 1) >= totalPages} onClick={() => setPagination((current) => ({ ...current, page: Math.min(totalPages, (current.page || 1) + 1) }))}>Next</CPaginationItem>
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