import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  CRow,
  CSpinner,
} from '@coreui/react'
import { useFeature } from '../../../contexts/FeatureContext'
import {
  createPaymentTransaction,
  createServiceOrder,
  createServiceOrderItem,
  formatDateTime,
  formatMoney,
  getCustomersLookup,
  getOrderStatusMeta,
  getPaymentStatusMeta,
  getSalesCounterContext,
  getServiceItemsLookup,
  getServiceOrders,
  normalizeApiRows,
  toPositiveNumber,
} from '../services/salesCounterService'
import CustomerQuickCreateModal from '../components/CustomerQuickCreateModal'
import SalesCounterItemsEditor from '../components/SalesCounterItemsEditor'
import SalesCounterSummaryCard from '../components/SalesCounterSummaryCard'
import SalesCounterPaymentSection from '../components/SalesCounterPaymentSection'

const ACTIVE_DEPARTMENT_STORAGE_KEY = 'alpha_sales_counter_department_id'
const SALES_COUNTER_FEATURE_KEYS = [
  'sales-counters.manage',
  'sales-counter.manage',
  'salesCounters.manage',
  'salesCounter.manage',
]

const RECENT_ORDERS_FILTER_OPTIONS = [
  { value: 'TODAY', label: 'Hôm nay' },
  { value: 'RECENT', label: 'Gần đây' },
  { value: 'UNPAID', label: 'Chưa thu đủ' },
]

function parsePositiveId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function readStoredDepartmentId() {
  try {
    return parsePositiveId(localStorage.getItem(ACTIVE_DEPARTMENT_STORAGE_KEY))
  } catch {
    return null
  }
}

function writeStoredDepartmentId(departmentId) {
  if (!parsePositiveId(departmentId)) {
    localStorage.removeItem(ACTIVE_DEPARTMENT_STORAGE_KEY)
    return
  }
  localStorage.setItem(ACTIVE_DEPARTMENT_STORAGE_KEY, String(departmentId))
}

function toDepartments(payload) {
  if (Array.isArray(payload?.data?.accessibleDepartments)) return payload.data.accessibleDepartments
  if (Array.isArray(payload?.accessibleDepartments)) return payload.accessibleDepartments
  return []
}

function toEmployee(payload) {
  return payload?.data?.employee || payload?.employee || null
}

function createEmptyItemRow() {
  return {
    rowKey: `${Date.now()}-${Math.random()}`,
    serviceItem: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    amount: 0,
    note: '',
  }
}

function getCustomerOptionLabel(item) {
  const code = item?.code ? `[${item.code}]` : ''
  const name = item?.name || ''
  const phone = item?.phone ? ` - ${item.phone}` : ''
  return `${code} ${name}${phone}`.trim()
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function toLocalDateYmd(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function SalesCounterPage() {
  const navigate = useNavigate()
  const feature = useFeature()

  const hasFeature = useCallback(
    (key) => feature?.hasFeature?.(key) || false,
    [feature],
  )

  const hasAnyFeature = useCallback(
    (keys = []) => keys.some((key) => hasFeature(key)),
    [hasFeature],
  )

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [employee, setEmployee] = useState(null)
  const [departments, setDepartments] = useState([])
  const [activeDepartmentId, setActiveDepartmentId] = useState('')
  const [isSelecting, setIsSelecting] = useState(false)

  const [customers, setCustomers] = useState([])
  const [customerKeyword, setCustomerKeyword] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  const [serviceItems, setServiceItems] = useState([])
  const [serviceItemKeyword, setServiceItemKeyword] = useState('')
  const [items, setItems] = useState([createEmptyItemRow()])
  const [orderDescription, setOrderDescription] = useState('')
  const [orderNote, setOrderNote] = useState('')

  const [paymentStatus, setPaymentStatus] = useState('UNPAID')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentNote, setPaymentNote] = useState('')

  const [showCustomerCreateModal, setShowCustomerCreateModal] = useState(false)

  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [recentOrdersFilter, setRecentOrdersFilter] = useState('TODAY')
  const [recentOrders, setRecentOrders] = useState([])
  const [recentOrdersSummary, setRecentOrdersSummary] = useState({ totalAmount: 0, paidAmount: 0, debtAmount: 0 })
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false)
  const [recentOrdersExporting, setRecentOrdersExporting] = useState(false)
  const [recentOrdersError, setRecentOrdersError] = useState('')
  const [highlightOrderId, setHighlightOrderId] = useState(null)

  const activeDepartment = useMemo(() => {
    return departments.find((item) => String(item?.id) === String(activeDepartmentId || '')) || null
  }, [departments, activeDepartmentId])

  const canCreateOrder = hasAnyFeature([...SALES_COUNTER_FEATURE_KEYS, 'serviceSales.order.create', 'service-orders'])
  const canCreateCustomer = hasAnyFeature([...SALES_COUNTER_FEATURE_KEYS, 'customers', 'service-orders'])
  const canViewRecentOrders = hasAnyFeature([
    ...SALES_COUNTER_FEATURE_KEYS,
    'service-orders',
    'serviceSales.order.view.self',
    'serviceSales.order.view.department',
    'serviceSales.order.view.all',
    'serviceSales.order.create',
  ])
  const canCreatePayment = hasAnyFeature([
    ...SALES_COUNTER_FEATURE_KEYS,
    'service-orders',
    'serviceSales.payment.create.self',
    'serviceSales.payment.create.department',
    'serviceSales.payment.create.all',
  ])

  const serviceItemMap = useMemo(() => {
    return new Map(serviceItems.map((item) => [Number(item.id), item]))
  }, [serviceItems])

  const retailGuest = useMemo(() => {
    return customers.find((item) => item?.isDefaultRetailGuest) || null
  }, [customers])

  const selectedCustomer = useMemo(() => {
    return customers.find((item) => String(item?.id) === String(selectedCustomerId || '')) || null
  }, [customers, selectedCustomerId])

  const filteredCustomers = useMemo(() => {
    const normalizedKeyword = normalizeText(customerKeyword)

    const sorted = [...customers].sort((left, right) => {
      if (Boolean(left?.isDefaultRetailGuest) !== Boolean(right?.isDefaultRetailGuest)) {
        return left?.isDefaultRetailGuest ? -1 : 1
      }

      const leftName = String(left?.name || '')
      const rightName = String(right?.name || '')
      return leftName.localeCompare(rightName, 'vi')
    })

    if (!normalizedKeyword) return sorted

    return sorted.filter((item) => {
      const code = normalizeText(item?.code)
      const name = normalizeText(item?.name)
      const phone = normalizeText(item?.phone)
      const zalo = normalizeText(item?.zalo)
      return (
        code.includes(normalizedKeyword)
        || name.includes(normalizedKeyword)
        || phone.includes(normalizedKeyword)
        || zalo.includes(normalizedKeyword)
      )
    })
  }, [customers, customerKeyword])

  const computedTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + toPositiveNumber(item.amount), 0)
  }, [items])

  const validItems = useMemo(() => {
    return items.filter((item) => {
      const hasServiceItem = Boolean(item.serviceItem)
      const hasDescription = Boolean(String(item.description || '').trim())
      return (hasServiceItem || hasDescription) && toPositiveNumber(item.amount) > 0
    })
  }, [items])

  const hasMultipleDepartments = departments.length > 1

  const loadRecentOrders = useCallback(async () => {
    if (!activeDepartment?.id || !employee?.id || !canViewRecentOrders) {
      setRecentOrders([])
      setRecentOrdersSummary({ totalAmount: 0, paidAmount: 0, debtAmount: 0 })
      return
    }

    setRecentOrdersLoading(true)
    setRecentOrdersError('')

    try {
      const today = toLocalDateYmd()
      const params = {
        page: 1,
        pageSize: 20,
        includeSummary: 1,
        sort: 'orderDate:desc',
        department: Number(activeDepartment.id),
        assignedEmployee: Number(employee.id),
      }

      if (recentOrdersFilter === 'TODAY') {
        params.dateFrom = today
        params.dateTo = today
      }

      if (recentOrdersFilter === 'UNPAID') {
        params.unpaidOnly = 1
      }

      const payload = await getServiceOrders(params)
      const rows = normalizeApiRows(payload)
      const summary = payload?.meta?.summary || {}

      setRecentOrdersSummary({
        totalAmount: Number(summary.totalAmount || 0),
        paidAmount: Number(summary.paidAmount || 0),
        debtAmount: Number(summary.debtAmount || 0),
      })

      setRecentOrders(rows.slice(0, 10))
    } catch (loadError) {
      setRecentOrders([])
      setRecentOrdersSummary({ totalAmount: 0, paidAmount: 0, debtAmount: 0 })
      setRecentOrdersError(loadError?.response?.data?.error?.message || loadError?.message || 'Không tải được danh sách đơn vừa bán')
    } finally {
      setRecentOrdersLoading(false)
    }
  }, [activeDepartment?.id, employee?.id, canViewRecentOrders, recentOrdersFilter])

  const buildMyOrdersParams = useCallback((page = 1, pageSize = 20) => {
    const today = toLocalDateYmd()
    const params = {
      page,
      pageSize,
      includeSummary: 0,
      sort: 'orderDate:desc',
      department: Number(activeDepartment?.id || 0),
      assignedEmployee: Number(employee?.id || 0),
    }

    if (recentOrdersFilter === 'TODAY') {
      params.dateFrom = today
      params.dateTo = today
    }

    if (recentOrdersFilter === 'UNPAID') {
      params.unpaidOnly = 1
    }

    return params
  }, [activeDepartment?.id, employee?.id, recentOrdersFilter])

  const exportMyOrdersExcel = useCallback(async () => {
    if (!canViewRecentOrders || !activeDepartment?.id || !employee?.id || recentOrdersExporting) return

    setRecentOrdersExporting(true)
    setRecentOrdersError('')
    try {
      const allRows = []
      const pageSize = 200
      let page = 1
      let total = 0

      while (true) {
        const payload = await getServiceOrders(buildMyOrdersParams(page, pageSize))
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

      if (!allRows.length) {
        setRecentOrdersError('Không có dữ liệu để xuất Excel')
        return
      }

      const sheetRows = allRows.map((row, index) => {
        const paymentMeta = getPaymentStatusMeta(row?.paymentStatus)
        const orderMeta = getOrderStatusMeta(row?.status)
        return {
          STT: index + 1,
          'Mã đơn': row?.code || `#${row?.id || ''}`,
          'Thời gian': formatDateTime(row?.orderDate || row?.createdAt),
          'Cửa hàng': row?.department?.name || activeDepartment?.name || '',
          'Khách hàng': row?.customer?.name || '',
          'SĐT khách hàng': row?.customer?.phone || '',
          'Tổng tiền': Number(row?.totalAmount || 0),
          'Đã thu': Number(row?.paidAmount || 0),
          'Còn nợ': Number(row?.debtAmount || 0),
          'TT thanh toán': paymentMeta?.label || row?.paymentStatus || '',
          'Trạng thái': orderMeta?.label || row?.status || '',
        }
      })

      const detailRows = allRows.flatMap((order) => {
        const items = Array.isArray(order?.items) ? order.items : []

        if (items.length === 0) {
          return [{
            'Mã đơn': order?.code || `#${order?.id || ''}`,
            'Thời gian': formatDateTime(order?.orderDate || order?.createdAt),
            'Cửa hàng': order?.department?.name || activeDepartment?.name || '',
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
          'Thời gian': formatDateTime(order?.orderDate || order?.createdAt),
          'Cửa hàng': order?.department?.name || activeDepartment?.name || '',
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DonHangCuaToi')
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'ChiTietDonHang')

      const today = new Date()
      const dateCode = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      XLSX.writeFile(workbook, `don-hang-cua-toi-${dateCode}.xlsx`)
    } catch (exportError) {
      setRecentOrdersError(exportError?.response?.data?.error?.message || exportError?.message || 'Xuất Excel thất bại')
    } finally {
      setRecentOrdersExporting(false)
    }
  }, [
    canViewRecentOrders,
    activeDepartment?.id,
    activeDepartment?.name,
    employee?.id,
    recentOrdersExporting,
    buildMyOrdersParams,
  ])

  const loadContext = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await getSalesCounterContext()
      const currentEmployee = toEmployee(payload)
      const accessibleDepartments = toDepartments(payload)

      setEmployee(currentEmployee)
      setDepartments(accessibleDepartments)

      if (!currentEmployee?.id || accessibleDepartments.length === 0) {
        setActiveDepartmentId('')
        writeStoredDepartmentId(null)
        return
      }

      if (accessibleDepartments.length === 1) {
        const onlyDepartmentId = parsePositiveId(accessibleDepartments[0]?.id)
        setActiveDepartmentId(onlyDepartmentId ? String(onlyDepartmentId) : '')
        writeStoredDepartmentId(onlyDepartmentId)
        setIsSelecting(false)
        return
      }

      const storedDepartmentId = readStoredDepartmentId()
      const hasStoredDepartment = accessibleDepartments.some((item) => parsePositiveId(item?.id) === storedDepartmentId)

      if (storedDepartmentId && hasStoredDepartment) {
        setActiveDepartmentId(String(storedDepartmentId))
        setIsSelecting(false)
      } else {
        writeStoredDepartmentId(null)
        setActiveDepartmentId('')
        setIsSelecting(true)
      }
    } catch (loadError) {
      setEmployee(null)
      setDepartments([])
      setActiveDepartmentId('')
      setError(loadError?.response?.data?.error?.message || loadError?.message || 'Không tải được ngữ cảnh bán hàng')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCustomerLookup = useCallback(async (keyword) => {
    const response = await getCustomersLookup({
      keyword: String(keyword || '').trim() || undefined,
      limit: 100,
    })
    const rows = normalizeApiRows(response)
    setCustomers(rows)
  }, [])

  const loadServiceItemLookup = useCallback(async (keyword) => {
    const response = await getServiceItemsLookup({
      keyword: String(keyword || '').trim() || undefined,
      limit: 200,
    })
    const rows = normalizeApiRows(response)
    setServiceItems(rows)
  }, [])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  useEffect(() => {
    if (!activeDepartment?.id || !employee?.id) return

    loadCustomerLookup('').catch(() => undefined)
    loadServiceItemLookup('').catch(() => undefined)
  }, [activeDepartment?.id, employee?.id, loadCustomerLookup, loadServiceItemLookup])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomerLookup(customerKeyword).catch(() => undefined)
    }, 250)

    return () => clearTimeout(timer)
  }, [customerKeyword, loadCustomerLookup])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadServiceItemLookup(serviceItemKeyword).catch(() => undefined)
    }, 250)

    return () => clearTimeout(timer)
  }, [serviceItemKeyword, loadServiceItemLookup])

  useEffect(() => {
    if (selectedCustomerId) return
    if (retailGuest?.id) {
      setSelectedCustomerId(String(retailGuest.id))
    }
  }, [retailGuest, selectedCustomerId])

  useEffect(() => {
    loadRecentOrders().catch(() => undefined)
  }, [loadRecentOrders])

  useEffect(() => {
    if (!highlightOrderId) return

    const timer = setTimeout(() => {
      setHighlightOrderId(null)
    }, 5000)

    return () => clearTimeout(timer)
  }, [highlightOrderId])

  useEffect(() => {
    if (paymentStatus !== 'PAID') return
    setPaymentAmount(String(toPositiveNumber(computedTotal)))
  }, [paymentStatus, computedTotal])

  function updateItem(index, patch) {
    setItems((prev) => {
      const next = [...prev]
      const target = { ...next[index], ...patch }
      target.quantity = toPositiveNumber(target.quantity)
      target.unitPrice = toPositiveNumber(target.unitPrice)
      target.amount = toPositiveNumber(target.quantity) * toPositiveNumber(target.unitPrice)
      next[index] = target
      return next
    })
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItemRow()])
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
  }

  function onSelectServiceItem(index, value) {
    const selected = serviceItemMap.get(Number(value)) || null
    const current = items[index]
    const currentPrice = toPositiveNumber(current?.unitPrice)
    const suggestedPrice = toPositiveNumber(selected?.defaultPrice)

    const patch = { serviceItem: value }

    if ((!currentPrice || currentPrice === 0) && suggestedPrice > 0) {
      patch.unitPrice = suggestedPrice
    }

    if (!String(current?.description || '').trim() && selected?.name) {
      patch.description = selected.name
    }

    updateItem(index, patch)
  }

  function onSelectRetailGuest() {
    if (!retailGuest?.id) return
    setSelectedCustomerId(String(retailGuest.id))
    setCustomerKeyword('')
  }

  function resetAfterSuccess() {
    setItems([createEmptyItemRow()])
    setOrderDescription('')
    setOrderNote('')
    setPaymentStatus('UNPAID')
    setPaymentAmount('')
    setPaymentMethod('CASH')
    setPaymentNote('')
    setSubmitError('')
    setCustomerKeyword('')
    setServiceItemKeyword('')

    if (retailGuest?.id) {
      setSelectedCustomerId(String(retailGuest.id))
    } else {
      setSelectedCustomerId('')
    }
  }

  async function onSubmitQuickOrder() {
    if (submitting) return

    setSubmitError('')
    setSubmitSuccess('')

    if (!canCreateOrder) {
      setSubmitError('Tài khoản hiện tại không có quyền tạo đơn bán hàng')
      return
    }

    if (!employee?.id) {
      setSubmitError('Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên')
      return
    }

    if (!activeDepartment?.id) {
      setSubmitError('Bạn cần chọn cửa hàng đang làm việc trước khi lưu đơn')
      return
    }

    if (!selectedCustomerId) {
      setSubmitError('Vui lòng chọn khách hàng')
      return
    }

    if (validItems.length === 0) {
      setSubmitError('Vui lòng thêm ít nhất 1 dòng dịch vụ hợp lệ')
      return
    }

    const shouldCreatePayment = paymentStatus !== 'UNPAID' && canCreatePayment
    const normalizedPaymentAmount = toPositiveNumber(paymentAmount)

    if (shouldCreatePayment) {
      if (toPositiveNumber(computedTotal) <= 0) {
        setSubmitError('Đơn có tổng tiền bằng 0 nên không thể thu tiền')
        return
      }

      if (normalizedPaymentAmount <= 0) {
        setSubmitError('Số tiền thu phải lớn hơn 0')
        return
      }
    }

    setSubmitting(true)

    let createdOrderId = null
    let createdOrderCode = null

    try {
      const paidAmount = shouldCreatePayment ? normalizedPaymentAmount : 0
      const totalAmount = toPositiveNumber(computedTotal)
      const orderPaymentStatus =
        paidAmount <= 0 || totalAmount <= 0
          ? 'UNPAID'
          : paidAmount >= totalAmount
            ? 'PAID'
            : 'PARTIAL'

      const createdOrder = await createServiceOrder({
        department: Number(activeDepartment.id),
        assignedEmployee: Number(employee.id),
        customer: Number(selectedCustomerId),
        source: 'DIRECT',
        orderDate: new Date().toISOString(),
        status: 'NEW',
        paymentStatus: orderPaymentStatus,
        description: String(orderDescription || '').trim() || null,
        note: String(orderNote || '').trim() || null,
      })

      createdOrderId = Number(createdOrder?.data?.id || createdOrder?.id || 0)
      createdOrderCode = createdOrder?.data?.code || createdOrder?.code || null

      if (!createdOrderId) {
        throw new Error('Không lấy được ID đơn hàng vừa tạo')
      }

      for (let index = 0; index < validItems.length; index += 1) {
        const item = validItems[index]
        await createServiceOrderItem({
          order: createdOrderId,
          serviceItem: item.serviceItem ? Number(item.serviceItem) : null,
          description: String(item.description || '').trim() || null,
          quantity: toPositiveNumber(item.quantity),
          unitPrice: toPositiveNumber(item.unitPrice),
          amount: toPositiveNumber(item.amount),
          note: String(item.note || '').trim() || null,
          sortOrder: index,
        })
      }

      if (shouldCreatePayment && normalizedPaymentAmount > 0) {
        await createPaymentTransaction({
          order: createdOrderId,
          customer: Number(selectedCustomerId),
          department: Number(activeDepartment.id),
          collectedBy: Number(employee.id),
          amount: normalizedPaymentAmount,
          method: paymentMethod,
          paidAt: new Date().toISOString(),
          note: String(paymentNote || '').trim() || null,
        })
      }

      setSubmitSuccess(
        `Đã tạo đơn ${createdOrderCode || `#${createdOrderId}`} thành công • Tổng tiền: ${formatMoney(totalAmount)}`,
      )
      if (createdOrderId) {
        setHighlightOrderId(createdOrderId)
      }
      resetAfterSuccess()
      await loadRecentOrders()
    } catch (submitFlowError) {
      const fallbackMessage = submitFlowError?.response?.data?.error?.message || submitFlowError?.message || 'Lưu đơn thất bại'

      if (createdOrderId) {
        setSubmitError(
          `Đơn ${createdOrderCode || `#${createdOrderId}`} đã được tạo nhưng phát sinh lỗi ở bước chi tiết/thanh toán: ${fallbackMessage}`,
        )
      } else {
        setSubmitError(fallbackMessage)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function onCreatedCustomer(customer) {
    setCustomers((prev) => {
      const next = [customer, ...prev.filter((item) => String(item?.id) !== String(customer?.id || ''))]
      return next
    })
    setSelectedCustomerId(String(customer.id))
    setCustomerKeyword('')
  }

  function confirmDepartmentSelection() {
    const selectedId = parsePositiveId(activeDepartmentId)
    if (!selectedId) return

    const isValid = departments.some((item) => parsePositiveId(item?.id) === selectedId)
    if (!isValid) return

    writeStoredDepartmentId(selectedId)
    setIsSelecting(false)
  }

  function onChangeDepartment(nextDepartmentId) {
    setActiveDepartmentId(nextDepartmentId)

    const selectedId = parsePositiveId(nextDepartmentId)
    if (selectedId) {
      writeStoredDepartmentId(selectedId)
      setIsSelecting(false)
    }
  }

  return (
    <CRow className="justify-content-center">
      <CCol xs={12}>
        <CCard className="mb-4 ai-card">
          <CCardHeader>
            <strong>Quầy bán hàng</strong>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className="d-flex align-items-center gap-2"><CSpinner size="sm" />Đang thiết lập ngữ cảnh bán hàng...</div>
            ) : (
              <>
                {error ? <CAlert color="danger">{error}</CAlert> : null}

                {!employee?.id ? (
                  <CAlert color="warning" className="mb-0">
                    Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.
                  </CAlert>
                ) : departments.length === 0 ? (
                  <CAlert color="warning" className="mb-0">
                    Bạn chưa được gán cửa hàng/đơn vị để bán hàng.
                  </CAlert>
                ) : (
                  <CRow className="g-3">
                    <CCol md={6}>
                      <CCard className="border-0 bg-light h-100">
                        <CCardHeader><strong>Nhân viên hiện tại</strong></CCardHeader>
                        <CCardBody>
                          <div className="mb-1"><strong>{employee.fullName || '-'}</strong></div>
                          <div className="small text-body-secondary">Mã NV: {employee.employeeCode || '-'}</div>
                        </CCardBody>
                      </CCard>
                    </CCol>

                    <CCol md={6}>
                      <CCard className="border-0 bg-light h-100">
                        <CCardHeader className="d-flex justify-content-between align-items-center">
                          <strong>Cửa hàng đang làm việc</strong>
                          {hasMultipleDepartments && activeDepartment ? (
                            <CButton size="sm" color="secondary" variant="outline" onClick={() => setIsSelecting(true)}>
                              Đổi cửa hàng
                            </CButton>
                          ) : null}
                        </CCardHeader>
                        <CCardBody>
                          {isSelecting || !activeDepartment ? (
                            <>
                              <CFormLabel>Chọn cửa hàng</CFormLabel>
                              <CFormSelect
                                value={activeDepartmentId}
                                onChange={(event) => setActiveDepartmentId(event.target.value)}
                              >
                                <option value="">-- Chọn cửa hàng --</option>
                                {departments.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name || `#${item.id}`}
                                  </option>
                                ))}
                              </CFormSelect>

                              {hasMultipleDepartments ? (
                                <div className="mt-3">
                                  <CButton color="primary" disabled={!parsePositiveId(activeDepartmentId)} onClick={confirmDepartmentSelection}>
                                    Xác nhận cửa hàng làm việc
                                  </CButton>
                                </div>
                              ) : (
                                <div className="mt-3">
                                  <CButton color="primary" disabled={!parsePositiveId(activeDepartmentId)} onClick={() => onChangeDepartment(activeDepartmentId)}>
                                    Chọn cửa hàng
                                  </CButton>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="mb-1"><strong>{activeDepartment.name || '-'}</strong></div>
                              <div className="small text-body-secondary">Mã cửa hàng: {activeDepartment.code || '-'}</div>
                            </>
                          )}
                        </CCardBody>
                      </CCard>
                    </CCol>

                    <CCol xs={12}>
                      <CCard className="border-0 bg-light">
                        <CCardBody className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                          <div>
                            <strong>Trạng thái vận hành</strong>
                            <div className="small text-body-secondary">Sẵn sàng nhập đơn nhanh tại quầy.</div>
                          </div>
                          <CBadge color={activeDepartment ? 'success' : 'warning'}>
                            {activeDepartment ? 'Sẵn sàng bán hàng' : 'Chưa sẵn sàng'}
                          </CBadge>
                        </CCardBody>
                      </CCard>
                    </CCol>

                    <CCol lg={12}>
                      {submitError ? <CAlert color="danger">{submitError}</CAlert> : null}
                      {submitSuccess ? <CAlert color="success">{submitSuccess}</CAlert> : null}

                      <CCard className="ai-card mb-3">
                        <CCardHeader className="d-flex justify-content-between align-items-center">
                          <strong>Khách hàng</strong>
                          <div className="d-flex gap-2">
                            <CButton
                              size="sm"
                              color="warning"
                              variant="outline"
                              disabled={!retailGuest?.id}
                              onClick={onSelectRetailGuest}
                            >
                              Chọn Khách lẻ
                            </CButton>
                            <CButton
                              size="sm"
                              color="primary"
                              variant="outline"
                              disabled={!canCreateCustomer}
                              onClick={() => setShowCustomerCreateModal(true)}
                            >
                              Thêm khách mới
                            </CButton>
                          </div>
                        </CCardHeader>
                        <CCardBody>
                          <CRow className="g-3 ai-form">
                            <CCol md={6}>
                              <CFormLabel>Chọn khách hàng (gõ để lọc)</CFormLabel>
                              <CFormSelect
                                value={selectedCustomerId}
                                onChange={(event) => setSelectedCustomerId(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Backspace') {
                                    setCustomerKeyword((prev) => prev.slice(0, -1))
                                    return
                                  }

                                  if (event.key === 'Escape') {
                                    setCustomerKeyword('')
                                    return
                                  }

                                  const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey
                                  if (isPrintable) {
                                    setCustomerKeyword((prev) => `${prev}${event.key}`)
                                  }
                                }}
                              >
                                <option value="">-- Chọn khách hàng --</option>
                                {filteredCustomers.map((item) => (
                                  <option key={item.id} value={item.id}>{getCustomerOptionLabel(item)}</option>
                                ))}
                              </CFormSelect>
                              <div className="small text-body-secondary mt-1">
                                Từ khóa lọc: {customerKeyword ? `"${customerKeyword}"` : '(trống)'} • Nhấn Esc để xóa lọc.
                              </div>
                            </CCol>
                            <CCol md={6}>
                              <CFormLabel>Khách hàng đã chọn</CFormLabel>
                              <CFormInput
                                readOnly
                                value={selectedCustomer ? getCustomerOptionLabel(selectedCustomer) : '-- Chưa chọn khách hàng --'}
                              />
                            </CCol>
                            <CCol md={12}>
                              <CFormLabel>Mô tả đơn hàng</CFormLabel>
                              <CFormInput
                                placeholder="Ví dụ: In tài liệu gấp trong ngày"
                                value={orderDescription}
                                onChange={(event) => setOrderDescription(event.target.value)}
                              />
                            </CCol>
                            <CCol md={12}>
                              <CFormLabel>Ghi chú đơn hàng</CFormLabel>
                              <CFormInput
                                placeholder="Ghi chú thêm cho đơn"
                                value={orderNote}
                                onChange={(event) => setOrderNote(event.target.value)}
                              />
                            </CCol>
                          </CRow>
                        </CCardBody>
                      </CCard>

                      <SalesCounterItemsEditor
                        items={items}
                        serviceItems={serviceItems}
                        serviceItemMap={serviceItemMap}
                        serviceItemKeyword={serviceItemKeyword}
                        onServiceItemKeywordChange={setServiceItemKeyword}
                        onAddItem={addItem}
                        onRemoveItem={removeItem}
                        onUpdateItem={updateItem}
                        onSelectServiceItem={onSelectServiceItem}
                      />

                      <SalesCounterSummaryCard
                        department={activeDepartment}
                        employee={employee}
                        customer={selectedCustomer}
                        itemCount={validItems.length}
                        totalAmount={computedTotal}
                      />

                      <SalesCounterPaymentSection
                        disabled={!canCreatePayment}
                        totalAmount={computedTotal}
                        paymentStatus={paymentStatus}
                        paymentAmount={paymentAmount}
                        paymentMethod={paymentMethod}
                        paymentNote={paymentNote}
                        onPaymentStatusChange={setPaymentStatus}
                        onPaymentAmountChange={setPaymentAmount}
                        onPaymentMethodChange={setPaymentMethod}
                        onPaymentNoteChange={setPaymentNote}
                      />

                      <CCard className="ai-card">
                        <CCardBody>
                          <CButton
                            color="primary"
                            className="w-100"
                            disabled={submitting || !activeDepartment?.id || !employee?.id}
                            onClick={onSubmitQuickOrder}
                          >
                            {submitting ? (
                              <span className="d-inline-flex align-items-center gap-2"><CSpinner size="sm" />Đang lưu đơn...</span>
                            ) : (
                              'Lưu đơn nhanh'
                            )}
                          </CButton>
                        </CCardBody>
                      </CCard>

                      <CCard className="ai-card mt-3">
                        <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                          <strong>Đơn vừa bán của tôi</strong>
                          <div className="d-flex align-items-center gap-2">
                            <CFormSelect
                              size="sm"
                              style={{ width: 170 }}
                              value={recentOrdersFilter}
                              onChange={(event) => setRecentOrdersFilter(event.target.value)}
                            >
                              {RECENT_ORDERS_FILTER_OPTIONS.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </CFormSelect>
                            <CButton
                              size="sm"
                              color="secondary"
                              variant="outline"
                              disabled={recentOrdersLoading || !canViewRecentOrders}
                              onClick={() => loadRecentOrders()}
                            >
                              Làm mới
                            </CButton>
                            <CButton
                              size="sm"
                              color="success"
                              variant="outline"
                              disabled={recentOrdersLoading || recentOrdersExporting || !canViewRecentOrders || !activeDepartment?.id || !employee?.id}
                              onClick={exportMyOrdersExcel}
                            >
                              {recentOrdersExporting ? 'Đang xuất...' : 'Xuất Excel'}
                            </CButton>
                          </div>
                        </CCardHeader>
                        <CCardBody>
                          {!canViewRecentOrders ? (
                            <CAlert color="warning" className="mb-0">Tài khoản hiện tại không có quyền xem danh sách đơn tại quầy.</CAlert>
                          ) : recentOrdersError ? (
                            <CAlert color="danger" className="mb-0">{recentOrdersError}</CAlert>
                          ) : recentOrdersLoading ? (
                            <div className="d-flex align-items-center gap-2"><CSpinner size="sm" />Đang tải đơn gần đây...</div>
                          ) : recentOrders.length === 0 ? (
                            <div className="text-body-secondary">Chưa có đơn phù hợp bộ lọc.</div>
                          ) : (
                            <div className="table-responsive">
                              <table className="table table-hover ai-table mb-0">
                                <thead>
                                  <tr>
                                    <th style={{ minWidth: 150 }}>Mã đơn</th>
                                    <th style={{ minWidth: 160 }}>Thời gian</th>
                                    <th style={{ minWidth: 220 }}>Khách hàng</th>
                                    <th className="text-end" style={{ minWidth: 120 }}>Tổng tiền</th>
                                    <th className="text-end" style={{ minWidth: 120 }}>Đã thu</th>
                                    <th className="text-end" style={{ minWidth: 120 }}>Còn nợ</th>
                                    <th style={{ minWidth: 130 }}>TT thanh toán</th>
                                    <th style={{ minWidth: 130 }}>Trạng thái</th>
                                    <th style={{ minWidth: 120 }}>Thao tác</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {recentOrders.map((row) => {
                                    const paymentMeta = getPaymentStatusMeta(row?.paymentStatus)
                                    const orderMeta = getOrderStatusMeta(row?.status)

                                    return (
                                      <tr key={row.id} className={row.id === highlightOrderId ? 'table-warning' : ''}>
                                        <td className="fw-semibold">{row.code || `#${row.id}`}</td>
                                        <td>{formatDateTime(row?.orderDate || row?.createdAt)}</td>
                                        <td>
                                          <div>{row?.customer?.name || '-'}</div>
                                          <div className="small text-body-secondary">{row?.customer?.phone || ''}</div>
                                        </td>
                                        <td className="text-end">{formatMoney(row?.totalAmount)}</td>
                                        <td className="text-end">{formatMoney(row?.paidAmount)}</td>
                                        <td className="text-end">{formatMoney(row?.debtAmount)}</td>
                                        <td><CBadge color={paymentMeta.color}>{paymentMeta.label}</CBadge></td>
                                        <td><CBadge color={orderMeta.color}>{orderMeta.label}</CBadge></td>
                                        <td>
                                          <CButton
                                            size="sm"
                                            color="info"
                                            variant="outline"
                                            onClick={() => navigate(`/sales-counters/orders/${row.id}`)}
                                          >
                                            Chi tiết
                                          </CButton>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                  {recentOrders.length > 0 ? (
                                    <tr className="fw-semibold">
                                      <td colSpan={3}>Tổng theo bộ lọc</td>
                                      <td className="text-end">{formatMoney(recentOrdersSummary.totalAmount)}</td>
                                      <td className="text-end">{formatMoney(recentOrdersSummary.paidAmount)}</td>
                                      <td className="text-end">{formatMoney(recentOrdersSummary.debtAmount)}</td>
                                      <td colSpan={3} />
                                    </tr>
                                  ) : null}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CCardBody>
                      </CCard>
                    </CCol>
                  </CRow>
                )}
              </>
            )}
          </CCardBody>
        </CCard>

        <CustomerQuickCreateModal
          visible={showCustomerCreateModal}
          onClose={() => setShowCustomerCreateModal(false)}
          onCreated={onCreatedCustomer}
        />
      </CCol>
    </CRow>
  )
}
