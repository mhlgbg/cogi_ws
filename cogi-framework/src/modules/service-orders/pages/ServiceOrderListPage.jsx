import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
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
import { useFeature } from '../../../contexts/FeatureContext'
import {
  getCustomersLookup,
  getDepartmentsLookup,
  getEmployeesLookup,
  getServiceOrders,
} from '../services/serviceOrderListService'
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  formatDateTime,
  formatMoney,
  getOrderStatusMeta,
  getPaymentStatusMeta,
  isOrderEditableState,
  normalizeApiRows,
} from './serviceOrderListFormatters'

const ORDER_VIEW_KEYS = [
  'service-orders',
  'serviceSales.order.view.self',
  'serviceSales.order.view.department',
  'serviceSales.order.view.all',
  'sales-counters.manage',
]

const ORDER_UPDATE_KEYS = [
  'service-orders',
  'serviceSales.order.update.self',
  'serviceSales.order.update.department',
  'serviceSales.order.update.all',
  'sales-counters.manage',
]

const ORDER_CREATE_KEYS = [
  'service-orders',
  'serviceSales.order.create',
  'sales-counters.manage',
]

function getInitialFilters(searchParams) {
  return {
    department: searchParams.get('department') || '',
    assignedEmployee: searchParams.get('assignedEmployee') || '',
    customer: searchParams.get('customer') || '',
    status: searchParams.get('status') || '',
    paymentStatus: searchParams.get('paymentStatus') || '',
    keyword: searchParams.get('keyword') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  }
}

export default function ServiceOrderListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const feature = useFeature()

  const hasFeature = useCallback(
    (key) => feature?.hasFeature?.(key) || false,
    [feature],
  )

  const hasAnyFeature = useCallback(
    (keys = []) => keys.some((key) => hasFeature(key)),
    [hasFeature],
  )

  const canView = hasAnyFeature(ORDER_VIEW_KEYS)
  const canCreate = hasAnyFeature(ORDER_CREATE_KEYS)
  const canUpdate = hasAnyFeature(ORDER_UPDATE_KEYS)

  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ totalAmount: 0, paidAmount: 0, debtAmount: 0 })
  const [pagination, setPagination] = useState({
    page: Number(searchParams.get('page') || 1),
    pageSize: Number(searchParams.get('pageSize') || 20),
    total: 0,
  })

  const [filters, setFilters] = useState(() => getInitialFilters(searchParams))
  const [appliedFilters, setAppliedFilters] = useState(() => getInitialFilters(searchParams))

  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [customers, setCustomers] = useState([])

  const pageCount = useMemo(() => {
    if (!pagination.total || !pagination.pageSize) return 1
    return Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
  }, [pagination.pageSize, pagination.total])

  const pageItems = useMemo(() => {
    const items = []
    for (let page = 1; page <= pageCount; page += 1) items.push(page)
    return items
  }, [pageCount])

  const fromToText = useMemo(() => {
    if (!pagination.total) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, pagination.total)
    return `${from}-${to}/${pagination.total}`
  }, [pagination.page, pagination.pageSize, pagination.total])

  const syncUrl = useCallback((nextPage, nextPageSize, nextFilters) => {
    const params = new URLSearchParams()
    params.set('page', String(nextPage))
    params.set('pageSize', String(nextPageSize))

    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })

    setSearchParams(params)
  }, [setSearchParams])

  const loadLookup = useCallback(async () => {
    const [depRes, empRes, customerRes] = await Promise.allSettled([
      getDepartmentsLookup(),
      getEmployeesLookup(),
      getCustomersLookup({ limit: 500 }),
    ])

    setDepartments(depRes.status === 'fulfilled' ? normalizeApiRows(depRes.value) : [])
    setEmployees(empRes.status === 'fulfilled' ? normalizeApiRows(empRes.value) : [])
    setCustomers(customerRes.status === 'fulfilled' ? normalizeApiRows(customerRes.value) : [])
  }, [])

  const loadData = useCallback(async ({
    page = pagination.page,
    pageSize = pagination.pageSize,
    currentFilters = appliedFilters,
  } = {}) => {
    if (!canView) {
      setRows([])
      setSummary({ totalAmount: 0, paidAmount: 0, debtAmount: 0 })
      setPagination((prev) => ({ ...prev, total: 0 }))
      return
    }

    setLoading(true)
    setError('')

    try {
      const params = {
        page,
        pageSize,
        includeSummary: 1,
        sort: 'orderDate:desc',
        department: currentFilters.department || undefined,
        assignedEmployee: currentFilters.assignedEmployee || undefined,
        customer: currentFilters.customer || undefined,
        status: currentFilters.status || undefined,
        paymentStatus: currentFilters.paymentStatus || undefined,
        keyword: currentFilters.keyword || undefined,
        dateFrom: currentFilters.dateFrom || undefined,
        dateTo: currentFilters.dateTo || undefined,
      }

      const payload = await getServiceOrders(params)
      const dataRows = normalizeApiRows(payload)
      const meta = payload?.meta?.pagination || {}
      const nextSummary = payload?.meta?.summary || {}

      setRows(dataRows)
      setSummary({
        totalAmount: Number(nextSummary.totalAmount || 0),
        paidAmount: Number(nextSummary.paidAmount || 0),
        debtAmount: Number(nextSummary.debtAmount || 0),
      })
      setPagination({
        page: meta.page || page,
        pageSize: meta.pageSize || pageSize,
        total: meta.total || dataRows.length,
      })

      syncUrl(meta.page || page, meta.pageSize || pageSize, currentFilters)
    } catch (loadError) {
      setRows([])
      setSummary({ totalAmount: 0, paidAmount: 0, debtAmount: 0 })
      setPagination((prev) => ({ ...prev, total: 0 }))
      setError(loadError?.response?.data?.error?.message || loadError?.message || 'Không tải được danh sách đơn dịch vụ')
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, canView, pagination.page, pagination.pageSize, syncUrl])

  const buildQueryParams = useCallback((currentFilters, page = 1, pageSize = pagination.pageSize) => {
    return {
      page,
      pageSize,
      includeSummary: 0,
      sort: 'orderDate:desc',
      department: currentFilters.department || undefined,
      assignedEmployee: currentFilters.assignedEmployee || undefined,
      customer: currentFilters.customer || undefined,
      status: currentFilters.status || undefined,
      paymentStatus: currentFilters.paymentStatus || undefined,
      keyword: currentFilters.keyword || undefined,
      dateFrom: currentFilters.dateFrom || undefined,
      dateTo: currentFilters.dateTo || undefined,
    }
  }, [pagination.pageSize])

  const loadAllRowsForExport = useCallback(async () => {
    const pageSize = 200
    let page = 1
    let total = 0
    const allRows = []

    while (true) {
      const payload = await getServiceOrders(buildQueryParams(appliedFilters, page, pageSize))
      const batch = normalizeApiRows(payload)
      const meta = payload?.meta?.pagination || {}

      if (page === 1) {
        total = Number(meta.total || 0)
      }

      allRows.push(...batch)
      if (allRows.length >= total || batch.length === 0) {
        break
      }

      page += 1
    }

    return allRows
  }, [appliedFilters, buildQueryParams])

  const exportToExcel = useCallback(async () => {
    if (!canView || exporting) return

    setExporting(true)
    setError('')
    try {
      const exportRows = await loadAllRowsForExport()

      if (!Array.isArray(exportRows) || exportRows.length === 0) {
        setError('Không có dữ liệu để xuất Excel')
        return
      }

      const sheetRows = exportRows.map((row, index) => {
        const statusMeta = getOrderStatusMeta(row?.status)
        const paymentMeta = getPaymentStatusMeta(row?.paymentStatus)
        return {
          STT: index + 1,
          'Mã đơn': row?.code || `#${row?.id || ''}`,
          'Ngày nhận': formatDateTime(row?.orderDate),
          'Bộ phận': row?.department?.name || '',
          'Khách hàng': row?.customer?.name || '',
          'SĐT khách hàng': row?.customer?.phone || '',
          'Nhân viên phụ trách': row?.assignedEmployee?.fullName || '',
          'Trạng thái đơn': statusMeta?.label || row?.status || '',
          'TT thanh toán': paymentMeta?.label || row?.paymentStatus || '',
          'Tổng tiền': Number(row?.totalAmount || 0),
          'Đã thu': Number(row?.paidAmount || 0),
          'Còn nợ': Number(row?.debtAmount || 0),
          'Nguồn': row?.source || '',
          'Mô tả': row?.description || '',
          'Ghi chú': row?.note || '',
        }
      })

      const detailRows = exportRows.flatMap((order) => {
        const items = Array.isArray(order?.items) ? order.items : []

        if (items.length === 0) {
          return [{
            'Mã đơn': order?.code || `#${order?.id || ''}`,
            'Ngày nhận': formatDateTime(order?.orderDate),
            'Bộ phận': order?.department?.name || '',
            'Khách hàng': order?.customer?.name || '',
            'STT dòng': 1,
            'Mã dịch vụ': '',
            'Tên dịch vụ': '',
            'Mô tả dòng': '',
            'Số lượng': 0,
            'Đơn giá': 0,
            'Thành tiền': 0,
            'Ghi chú dòng': '',
          }]
        }

        return items.map((item, itemIndex) => ({
          'Mã đơn': order?.code || `#${order?.id || ''}`,
          'Ngày nhận': formatDateTime(order?.orderDate),
          'Bộ phận': order?.department?.name || '',
          'Khách hàng': order?.customer?.name || '',
          'STT dòng': itemIndex + 1,
          'Mã dịch vụ': item?.serviceItem?.code || '',
          'Tên dịch vụ': item?.serviceItem?.name || '',
          'Mô tả dòng': item?.description || '',
          'Số lượng': Number(item?.quantity || 0),
          'Đơn giá': Number(item?.unitPrice || 0),
          'Thành tiền': Number(item?.amount || 0),
          'Ghi chú dòng': item?.note || '',
        }))
      })

      const worksheet = XLSX.utils.json_to_sheet(sheetRows)
      const detailSheet = XLSX.utils.json_to_sheet(detailRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DanhSachDonHang')
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'ChiTietDonHang')

      const today = new Date()
      const dateCode = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      XLSX.writeFile(workbook, `danh-sach-don-hang-${dateCode}.xlsx`)
    } catch (exportError) {
      setError(exportError?.response?.data?.error?.message || exportError?.message || 'Xuất Excel thất bại')
    } finally {
      setExporting(false)
    }
  }, [canView, exporting, loadAllRowsForExport])

  useEffect(() => {
    if (!canView) return
    loadLookup()
  }, [canView, loadLookup])

  useEffect(() => {
    loadData()
  }, [loadData])

  function onSearch() {
    const next = { ...filters, keyword: String(filters.keyword || '').trim() }
    setAppliedFilters(next)
    loadData({ page: 1, pageSize: pagination.pageSize, currentFilters: next })
  }

  function onReset() {
    const next = {
      department: '',
      assignedEmployee: '',
      customer: '',
      status: '',
      paymentStatus: '',
      keyword: '',
      dateFrom: '',
      dateTo: '',
    }
    setFilters(next)
    setAppliedFilters(next)
    loadData({ page: 1, pageSize: pagination.pageSize, currentFilters: next })
  }

  function onChangePage(nextPage) {
    if (nextPage < 1 || nextPage > pageCount || nextPage === pagination.page) return
    loadData({ page: nextPage, pageSize: pagination.pageSize, currentFilters: appliedFilters })
  }

  function onChangePageSize(event) {
    const nextSize = Number(event.target.value)
    if (!Number.isInteger(nextSize) || nextSize <= 0) return
    loadData({ page: 1, pageSize: nextSize, currentFilters: appliedFilters })
  }

  if (!canView) {
    return (
      <CRow className='justify-content-center'>
        <CCol xs={12} style={{ maxWidth: 1200 }}>
          <CAlert color='warning' className='mb-0'>
            Tài khoản hiện tại không có quyền xem danh sách đơn hàng.
          </CAlert>
        </CCol>
      </CRow>
    )
  }

  return (
    <CRow className='justify-content-center'>
      <CCol xs={12} style={{ maxWidth: 1500 }}>
        <CCard className='mb-4 ai-card'>
          <CCardHeader><strong>Bộ lọc đơn dịch vụ</strong></CCardHeader>
          <CCardBody>
            <CRow className='g-3 ai-form align-items-end'>
              <CCol md={2}>
                <CFormLabel>Bộ phận</CFormLabel>
                <CFormSelect value={filters.department} onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}>
                  <option value=''>Tất cả</option>
                  {departments.map((item) => (
                    <option key={item.id} value={item.id}>{item.name || `#${item.id}`}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormLabel>Nhân viên phụ trách</CFormLabel>
                <CFormSelect value={filters.assignedEmployee} onChange={(e) => setFilters((prev) => ({ ...prev, assignedEmployee: e.target.value }))}>
                  <option value=''>Tất cả</option>
                  {employees.map((item) => (
                    <option key={item.id} value={item.id}>{item.fullName || item.employeeCode || `#${item.id}`}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormLabel>Khách hàng</CFormLabel>
                <CFormSelect value={filters.customer} onChange={(e) => setFilters((prev) => ({ ...prev, customer: e.target.value }))}>
                  <option value=''>Tất cả</option>
                  {customers.map((item) => (
                    <option key={item.id} value={item.id}>{item.name || `#${item.id}`}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value=''>Tất cả</option>
                  {ORDER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormLabel>TT thanh toán</CFormLabel>
                <CFormSelect value={filters.paymentStatus} onChange={(e) => setFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))}>
                  <option value=''>Tất cả</option>
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormLabel>Từ khóa</CFormLabel>
                <CFormInput
                  value={filters.keyword}
                  placeholder='Mã đơn / KH / mô tả'
                  onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                />
              </CCol>
              <CCol md={2}>
                <CFormLabel>Từ ngày</CFormLabel>
                <CFormInput type='date' value={filters.dateFrom} onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))} />
              </CCol>
              <CCol md={2}>
                <CFormLabel>Đến ngày</CFormLabel>
                <CFormInput type='date' value={filters.dateTo} onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))} />
              </CCol>
              <CCol md={8} className='d-flex gap-2'>
                <CButton color='primary' onClick={onSearch} disabled={loading}>Tìm kiếm</CButton>
                <CButton color='secondary' variant='outline' onClick={onReset} disabled={loading}>Làm mới</CButton>
                <CButton color='success' variant='outline' onClick={exportToExcel} disabled={loading || exporting}>
                  {exporting ? 'Đang xuất...' : 'Xuất Excel'}
                </CButton>
                {canCreate ? (
                  <CButton color='success' onClick={() => navigate('/service-orders/new')}>
                    Tạo mới
                  </CButton>
                ) : null}
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CCard className='ai-card'>
          <CCardHeader className='d-flex justify-content-between align-items-center'>
            <div className='d-flex align-items-center gap-2'>
              <strong>Danh sách đơn dịch vụ</strong>
              <CBadge color='secondary'>{pagination.total}</CBadge>
            </div>
            <span className='small text-body-secondary'>{fromToText}</span>
          </CCardHeader>
          <CCardBody>
            {error ? <CAlert color='danger'>{error}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải dữ liệu...</div>
            ) : (
              <>
                <CTable hover responsive className='mb-3 ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Mã đơn</CTableHeaderCell>
                      <CTableHeaderCell>Ngày nhận</CTableHeaderCell>
                      <CTableHeaderCell>Bộ phận</CTableHeaderCell>
                      <CTableHeaderCell>Khách hàng</CTableHeaderCell>
                      <CTableHeaderCell>Phụ trách</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Tổng tiền</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Đã thu</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Còn nợ</CTableHeaderCell>
                      <CTableHeaderCell>TT thanh toán</CTableHeaderCell>
                      <CTableHeaderCell>Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={11} className='text-center text-body-secondary py-4'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((row) => {
                      const statusMeta = getOrderStatusMeta(row.status)
                      const payMeta = getPaymentStatusMeta(row.paymentStatus)
                      const isEditableOrder = isOrderEditableState(row)

                      return (
                        <CTableRow key={row.id}>
                          <CTableDataCell>{row.code || `#${row.id}`}</CTableDataCell>
                          <CTableDataCell>{formatDateTime(row.orderDate)}</CTableDataCell>
                          <CTableDataCell>{row.department?.name || '-'}</CTableDataCell>
                          <CTableDataCell>
                            <div>{row.customer?.name || '-'}</div>
                            <div className='small text-body-secondary'>{row.customer?.phone || ''}</div>
                          </CTableDataCell>
                          <CTableDataCell>{row.assignedEmployee?.fullName || '-'}</CTableDataCell>
                          <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(row.totalAmount)}</CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(row.paidAmount)}</CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(row.debtAmount)}</CTableDataCell>
                          <CTableDataCell><CBadge color={payMeta.color}>{payMeta.label}</CBadge></CTableDataCell>
                          <CTableDataCell>
                            <div className='d-flex gap-2'>
                              <CButton size='sm' color='info' variant='outline' onClick={() => navigate(`/service-orders/${row.id}`)}>
                                Xem
                              </CButton>
                              {canUpdate && isEditableOrder ? (
                                <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/service-orders/${row.id}/edit`)}>
                                  Sửa
                                </CButton>
                              ) : null}
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                    {rows.length > 0 ? (
                      <CTableRow className='fw-semibold'>
                        <CTableDataCell colSpan={6}>Tổng theo bộ lọc</CTableDataCell>
                        <CTableDataCell className='text-end'>{formatMoney(summary.totalAmount)}</CTableDataCell>
                        <CTableDataCell className='text-end'>{formatMoney(summary.paidAmount)}</CTableDataCell>
                        <CTableDataCell className='text-end'>{formatMoney(summary.debtAmount)}</CTableDataCell>
                        <CTableDataCell colSpan={2} />
                      </CTableRow>
                    ) : null}
                  </CTableBody>
                </CTable>

                <div className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
                  <div className='d-flex align-items-center gap-2 ai-form'>
                    <span>Số dòng/trang</span>
                    <CFormSelect style={{ width: 110 }} value={pagination.pageSize} onChange={onChangePageSize}>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </CFormSelect>
                  </div>
                  <CPagination className='mb-0' align='end'>
                    <CPaginationItem disabled={pagination.page <= 1 || loading} onClick={() => onChangePage(pagination.page - 1)}>Trước</CPaginationItem>
                    {pageItems.map((page) => (
                      <CPaginationItem key={page} active={page === pagination.page} disabled={loading} onClick={() => onChangePage(page)}>{page}</CPaginationItem>
                    ))}
                    <CPaginationItem disabled={pagination.page >= pageCount || loading} onClick={() => onChangePage(pagination.page + 1)}>Sau</CPaginationItem>
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
