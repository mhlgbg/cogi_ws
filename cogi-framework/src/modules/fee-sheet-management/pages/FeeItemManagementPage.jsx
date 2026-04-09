import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
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
import { getFeeItemListing, getFeeSheetFormOptions, getFeeSheetPage } from '../services/feeSheetService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatMoney(value) {
  const number = Number(value || 0)
  return new Intl.NumberFormat('vi-VN').format(number)
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'paid') return { color: 'success', label: 'Paid' }
  if (normalized === 'partial') return { color: 'warning', label: 'Partial' }
  return { color: 'secondary', label: 'Unpaid' }
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

export default function FeeItemManagementPage() {
  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [error, setError] = useState('')
  const [feeSheets, setFeeSheets] = useState([])
  const [classes, setClasses] = useState([])
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ totalAmount: 0, totalPaid: 0, totalRemaining: 0 })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState({
    feeSheetId: '',
    keyword: '',
    classId: '',
    status: '',
  })

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / (pagination.pageSize || 20)))
  const pages = useMemo(() => buildPages(pagination.page || 1, totalPages), [pagination.page, totalPages])

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      setBootLoading(true)
      setError('')
      try {
        const [feeSheetPage, formOptions] = await Promise.all([
          getFeeSheetPage({ page: 1, pageSize: 200, q: '' }),
          getFeeSheetFormOptions(),
        ])

        if (!mounted) return

        const nextFeeSheets = Array.isArray(feeSheetPage?.rows) ? feeSheetPage.rows : []
        const nextClasses = Array.isArray(formOptions?.classes) ? formOptions.classes : []
        setFeeSheets(nextFeeSheets)
        setClasses(nextClasses)
        setFilters((current) => ({
          ...current,
          feeSheetId: current.feeSheetId || String(nextFeeSheets[0]?.id || ''),
        }))
      } catch (requestError) {
        if (mounted) setError(getApiMessage(requestError, 'Không tải được danh sách bộ lọc'))
      } finally {
        if (mounted) setBootLoading(false)
      }
    }

    bootstrap()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!filters.feeSheetId) {
        setRows([])
        setSummary({ totalAmount: 0, totalPaid: 0, totalRemaining: 0 })
        setPagination((current) => ({ ...current, total: 0 }))
        return
      }

      setLoading(true)
      setError('')
      try {
        const result = await getFeeItemListing({
          feeSheetId: filters.feeSheetId,
          keyword: filters.keyword,
          classId: filters.classId,
          status: filters.status,
          page: pagination.page,
          pageSize: pagination.pageSize,
        })

        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setSummary(result?.summary || { totalAmount: 0, totalPaid: 0, totalRemaining: 0 })
        setPagination((current) => ({
          ...current,
          page: Number(result?.pagination?.page || current.page || 1),
          pageSize: Number(result?.pagination?.pageSize || current.pageSize || 20),
          total: Number(result?.pagination?.total || 0),
        }))
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setSummary({ totalAmount: 0, totalPaid: 0, totalRemaining: 0 })
        setPagination((current) => ({ ...current, total: 0 }))
        setError(getApiMessage(requestError, 'Không tải được danh sách fee item'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [filters.feeSheetId, filters.keyword, filters.classId, filters.status, pagination.page, pagination.pageSize])

  function updateFilter(key, value) {
    setPagination((current) => ({ ...current, page: 1 }))
    setFilters((current) => ({ ...current, [key]: value }))
  }

  if (bootLoading) {
    return (
      <div className='text-center py-5'>
        <CSpinner color='primary' />
      </div>
    )
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader><strong>Fee Item Filters</strong></CCardHeader>
          <CCardBody>
            <CRow className='g-3'>
              <CCol md={3}>
                <CFormSelect
                  label='FeeSheet'
                  value={filters.feeSheetId}
                  onChange={(event) => updateFilter('feeSheetId', event.target.value)}
                >
                  <option value=''>Chọn fee sheet</option>
                  {feeSheets.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={3}>
                <CFormInput
                  label='Keyword'
                  placeholder='Tìm theo tên học viên'
                  value={filters.keyword}
                  onChange={(event) => updateFilter('keyword', event.target.value)}
                />
              </CCol>
              <CCol md={3}>
                <CFormSelect
                  label='Class'
                  value={filters.classId}
                  onChange={(event) => updateFilter('classId', event.target.value)}
                >
                  <option value=''>Tất cả lớp</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.label || item.name}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={3}>
                <CFormSelect
                  label='Status'
                  value={filters.status}
                  onChange={(event) => updateFilter('status', event.target.value)}
                >
                  <option value=''>Tất cả trạng thái</option>
                  <option value='unpaid'>Unpaid</option>
                  <option value='partial'>Partial</option>
                  <option value='paid'>Paid</option>
                </CFormSelect>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol md={4}>
        <CCard>
          <CCardBody>
            <div className='text-body-secondary small mb-1'>Total Amount</div>
            <div className='fs-4 fw-semibold'>{formatMoney(summary.totalAmount)}</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol md={4}>
        <CCard>
          <CCardBody>
            <div className='text-body-secondary small mb-1'>Total Paid</div>
            <div className='fs-4 fw-semibold text-success'>{formatMoney(summary.totalPaid)}</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol md={4}>
        <CCard>
          <CCardBody>
            <div className='text-body-secondary small mb-1'>Remaining</div>
            <div className='fs-4 fw-semibold text-warning'>{formatMoney(summary.totalRemaining)}</div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Fee Items</strong>
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
                      <CTableHeaderCell>Learner Name</CTableHeaderCell>
                      <CTableHeaderCell>Class Name</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Quantity</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Unit Price</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Amount</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Paid</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Remaining</CTableHeaderCell>
                      <CTableHeaderCell>Status</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length > 0 ? rows.map((item) => {
                      const status = formatStatus(item.status)
                      return (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{item.learner?.name || '-'}</CTableDataCell>
                          <CTableDataCell>{item.class?.name || '-'}</CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(item.quantity)}</CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(item.unitPrice)}</CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(item.amount)}</CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(item.paidAmount)}</CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(item.remaining)}</CTableDataCell>
                          <CTableDataCell><CBadge color={status.color}>{status.label}</CBadge></CTableDataCell>
                        </CTableRow>
                      )
                    }) : (
                      <CTableRow>
                        <CTableDataCell colSpan={8} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>

                <div className='d-flex justify-content-center'>
                  <CPagination>
                    <CPaginationItem
                      disabled={(pagination.page || 1) <= 1}
                      onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))}
                    >
                      Prev
                    </CPaginationItem>
                    {pages.map((item, index) => (
                      <CPaginationItem
                        key={`${item}-${index}`}
                        active={item === pagination.page}
                        disabled={item === '...'}
                        onClick={() => {
                          if (typeof item === 'number') {
                            setPagination((current) => ({ ...current, page: item }))
                          }
                        }}
                      >
                        {item}
                      </CPaginationItem>
                    ))}
                    <CPaginationItem
                      disabled={(pagination.page || 1) >= totalPages}
                      onClick={() => setPagination((current) => ({ ...current, page: Math.min(totalPages, (current.page || 1) + 1) }))}
                    >
                      Next
                    </CPaginationItem>
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