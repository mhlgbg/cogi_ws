import { useCallback, useEffect, useMemo, useState } from 'react'
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
  CFormTextarea,
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
import PaymentCreateModal from '../components/PaymentCreateModal'
import {
  createServiceOrderItem,
  deleteServiceOrderItem,
  formatDateTime,
  formatMoney,
  getCustomersLookup,
  getOrderStatusMeta,
  getPaymentStatusMeta,
  getSalesCounterContext,
  getServiceOrderById,
  getServiceItemsLookup,
  isEditableOrderState,
  updateServiceOrder,
  updateServiceOrderItem,
} from '../services/salesCounterService'

const SALES_COUNTER_FEATURE_KEYS = [
  'sales-counters.manage',
  'sales-counter.manage',
  'salesCounters.manage',
  'salesCounter.manage',
]

const NEXT_STATUS_MAP = {
  NEW: 'PROCESSING',
  PROCESSING: 'READY',
  READY: 'DELIVERED',
}

function normalizeAttachments(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

function toFileUrl(url) {
  if (!url) return ''
  if (String(url).startsWith('http')) return url

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
  if (!apiBaseUrl) return url

  const normalizedPath = String(url).startsWith('/') ? String(url) : `/${String(url)}`
  const hostBase = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl
  return `${hostBase}${normalizedPath}`
}

function toPositiveNumber(value, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed < 0 ? 0 : parsed
}

function toLocalDateTimeInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (number) => String(number).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function toIsoDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function toCustomerLabel(customer) {
  const code = customer?.code ? `[${customer.code}]` : ''
  const name = customer?.name || ''
  const phone = customer?.phone ? ` - ${customer.phone}` : ''
  return `${code} ${name}${phone}`.trim() || `#${customer?.id || ''}`
}

function toServiceItemLabel(item) {
  const code = item?.code ? `[${item.code}]` : ''
  const name = item?.name || ''
  const category = item?.category?.name ? ` - ${item.category.name}` : ''
  return `${code} ${name}${category}`.trim() || `#${item?.id || ''}`
}

function createDraftItem(item = null) {
  return {
    rowKey: item?.id ? `existing-${item.id}` : `new-${Date.now()}-${Math.random()}`,
    id: item?.id || null,
    serviceItem: item?.serviceItem?.id || item?.serviceItem || '',
    description: item?.description || '',
    quantity: toPositiveNumber(item?.quantity, 1),
    unitPrice: toPositiveNumber(item?.unitPrice, 0),
    amount: toPositiveNumber(item?.amount, 0),
    note: item?.note || '',
    sortOrder: Number(item?.sortOrder || 0),
  }
}

export default function SalesCounterOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const feature = useFeature()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [payments, setPayments] = useState([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  const [contextEmployee, setContextEmployee] = useState(null)

  const [editMode, setEditMode] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [customers, setCustomers] = useState([])
  const [customerKeyword, setCustomerKeyword] = useState('')
  const [serviceItems, setServiceItems] = useState([])
  const [serviceItemKeyword, setServiceItemKeyword] = useState('')

  const [orderForm, setOrderForm] = useState({
    customer: '',
    orderDate: '',
    description: '',
    note: '',
  })
  const [itemDrafts, setItemDrafts] = useState([])
  const [removedItemIds, setRemovedItemIds] = useState([])

  const canUpdateOrder = SALES_COUNTER_FEATURE_KEYS.some((key) => feature?.hasFeature?.(key))
  const canCreatePayment = SALES_COUNTER_FEATURE_KEYS.some((key) => feature?.hasFeature?.(key))

  const serviceItemMap = useMemo(() => {
    return new Map((Array.isArray(serviceItems) ? serviceItems : []).map((item) => [Number(item.id), item]))
  }, [serviceItems])

  const isOwnOrder = useMemo(() => {
    const currentEmployeeId = Number(contextEmployee?.id || 0)
    const assignedEmployeeId = Number(order?.assignedEmployee?.id || 0)
    return Boolean(currentEmployeeId > 0 && assignedEmployeeId > 0 && currentEmployeeId === assignedEmployeeId)
  }, [contextEmployee?.id, order?.assignedEmployee?.id])

  const isEditableByState = useMemo(() => isEditableOrderState(order), [order])
  const canEditOrder = Boolean(canUpdateOrder && isOwnOrder && isEditableByState)

  const nextStatus = useMemo(() => {
    return NEXT_STATUS_MAP[order?.status] || null
  }, [order?.status])

  const itemDraftTotal = useMemo(() => {
    return itemDrafts.reduce((sum, item) => sum + toPositiveNumber(item.amount), 0)
  }, [itemDrafts])

  const overpaidAmount = useMemo(() => {
    const totalAmount = Number(order?.totalAmount || 0)
    const paidAmount = Number(order?.paidAmount || 0)
    return Math.max(0, paidAmount - totalAmount)
  }, [order?.totalAmount, order?.paidAmount])

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [orderRes, contextRes] = await Promise.all([
        getServiceOrderById(id),
        getSalesCounterContext().catch(() => null),
      ])
      const orderData = orderRes?.data || null
      const itemRows = Array.isArray(orderData?.items) ? orderData.items : []
      const paymentRows = Array.isArray(orderData?.payments) ? orderData.payments : []

      setOrder(orderData)
      setItems(itemRows)
      setPayments(paymentRows)
      setContextEmployee(contextRes?.data?.employee || contextRes?.employee || null)

      setOrderForm({
        customer: orderData?.customer?.id ? String(orderData.customer.id) : '',
        orderDate: toLocalDateTimeInputValue(orderData?.orderDate),
        description: orderData?.description || '',
        note: orderData?.note || '',
      })
      setItemDrafts(itemRows.map((item) => createDraftItem(item)))
      setRemovedItemIds([])
    } catch (loadError) {
      setOrder(null)
      setItems([])
      setPayments([])
      setError(loadError?.response?.data?.error?.message || loadError?.message || 'Không tải được chi tiết đơn')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadCustomerLookup = useCallback(async (keyword) => {
    const payload = await getCustomersLookup({ keyword: String(keyword || '').trim() || undefined, limit: 100 })
    const rows = Array.isArray(payload?.data) ? payload.data : []
    setCustomers(rows)
  }, [])

  const loadServiceItemLookup = useCallback(async (keyword) => {
    const payload = await getServiceItemsLookup({ keyword: String(keyword || '').trim() || undefined, limit: 200 })
    const rows = Array.isArray(payload?.data) ? payload.data : []
    setServiceItems(rows)
  }, [])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (!editMode) return undefined

    const timer = setTimeout(() => {
      loadCustomerLookup(customerKeyword).catch(() => undefined)
    }, 250)

    return () => clearTimeout(timer)
  }, [customerKeyword, editMode, loadCustomerLookup])

  useEffect(() => {
    if (!editMode) return
    loadCustomerLookup('').catch(() => undefined)
  }, [editMode, loadCustomerLookup])

  useEffect(() => {
    if (!editMode) return undefined

    const timer = setTimeout(() => {
      loadServiceItemLookup(serviceItemKeyword).catch(() => undefined)
    }, 250)

    return () => clearTimeout(timer)
  }, [editMode, serviceItemKeyword, loadServiceItemLookup])

  useEffect(() => {
    if (!editMode) return
    loadServiceItemLookup('').catch(() => undefined)
  }, [editMode, loadServiceItemLookup])

  async function onAdvanceStatus() {
    if (!order?.id || !nextStatus || !canUpdateOrder) return

    setStatusUpdating(true)
    setError('')
    try {
      await updateServiceOrder(order.id, { status: nextStatus })
      await loadDetail()
    } catch (updateError) {
      setError(updateError?.response?.data?.error?.message || updateError?.message || 'Không cập nhật được trạng thái đơn')
    } finally {
      setStatusUpdating(false)
    }
  }

  function onToggleEditMode() {
    if (!canEditOrder) return
    if (editMode) {
      setOrderForm({
        customer: order?.customer?.id ? String(order.customer.id) : '',
        orderDate: toLocalDateTimeInputValue(order?.orderDate),
        description: order?.description || '',
        note: order?.note || '',
      })
      setItemDrafts(items.map((item) => createDraftItem(item)))
      setRemovedItemIds([])
      setCustomerKeyword('')
      setServiceItemKeyword('')
    }
    setEditMode((prev) => !prev)
  }

  function updateDraftItem(index, patch) {
    setItemDrafts((prev) => {
      const next = [...prev]
      const target = { ...next[index], ...patch }
      target.quantity = toPositiveNumber(target.quantity, 0)
      target.unitPrice = toPositiveNumber(target.unitPrice, 0)
      target.amount = Math.round(target.quantity * target.unitPrice * 100) / 100
      next[index] = target
      return next
    })
  }

  function addDraftItem() {
    setItemDrafts((prev) => [...prev, createDraftItem(null)])
  }

  function removeDraftItem(index) {
    setItemDrafts((prev) => {
      const target = prev[index]
      if (target?.id) {
        setRemovedItemIds((current) => (current.includes(target.id) ? current : [...current, target.id]))
      }
      return prev.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  async function onSaveEdit() {
    if (!order?.id || !canEditOrder || savingEdit) return

    const validItems = itemDrafts.filter((item) => {
      const hasService = Boolean(item.serviceItem)
      const hasDescription = Boolean(String(item.description || '').trim())
      return (hasService || hasDescription) && toPositiveNumber(item.amount) > 0
    })

    if (!orderForm.customer) {
      setError('Vui lòng chọn khách hàng')
      return
    }

    if (validItems.length === 0) {
      setError('Đơn phải có ít nhất 1 dòng dịch vụ hợp lệ')
      return
    }

    setSavingEdit(true)
    setError('')

    try {
      const orderPayload = {
        customer: Number(orderForm.customer),
        orderDate: toIsoDateTime(orderForm.orderDate) || order?.orderDate,
        description: String(orderForm.description || '').trim() || null,
        note: String(orderForm.note || '').trim() || null,
      }

      await updateServiceOrder(order.id, orderPayload)

      for (let index = 0; index < validItems.length; index += 1) {
        const item = validItems[index]
        const itemPayload = {
          order: Number(order.id),
          serviceItem: item.serviceItem ? Number(item.serviceItem) : null,
          description: String(item.description || '').trim() || null,
          quantity: toPositiveNumber(item.quantity),
          unitPrice: toPositiveNumber(item.unitPrice),
          amount: toPositiveNumber(item.amount),
          note: String(item.note || '').trim() || null,
          sortOrder: index,
        }

        if (item.id) {
          await updateServiceOrderItem(item.id, itemPayload)
        } else {
          await createServiceOrderItem(itemPayload)
        }
      }

      for (const removedId of removedItemIds) {
        await deleteServiceOrderItem(removedId)
      }

      setEditMode(false)
      await loadDetail()
    } catch (saveError) {
      setError(saveError?.response?.data?.error?.message || saveError?.message || 'Không lưu được thay đổi đơn hàng')
    } finally {
      setSavingEdit(false)
    }
  }

  const statusMeta = getOrderStatusMeta(order?.status)
  const paymentMeta = getPaymentStatusMeta(order?.paymentStatus)

  return (
    <CRow className="g-0">
      <CCol xs={12}>
        <CCard className="mb-4 ai-card">
          <CCardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <strong>Chi tiết đơn dịch vụ</strong>
            <div className="d-flex gap-2">
              <CButton color="secondary" variant="outline" onClick={() => navigate('/sales-counters')}>Quay lại</CButton>
              {canEditOrder ? (
                <CButton color={editMode ? 'secondary' : 'primary'} variant={editMode ? 'outline' : undefined} onClick={onToggleEditMode}>
                  {editMode ? 'Hủy chỉnh sửa' : 'Chỉnh sửa đơn'}
                </CButton>
              ) : null}
              {editMode ? (
                <CButton color="primary" disabled={savingEdit} onClick={onSaveEdit}>
                  {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                </CButton>
              ) : null}
              {canCreatePayment ? (
                <CButton color="success" onClick={() => setShowPaymentModal(true)}>Thêm thanh toán</CButton>
              ) : null}
              {canUpdateOrder && nextStatus ? (
                <CButton color="warning" disabled={statusUpdating || editMode} onClick={onAdvanceStatus}>
                  {statusUpdating ? 'Đang cập nhật...' : `Chuyển trạng thái: ${nextStatus}`}
                </CButton>
              ) : null}
            </div>
          </CCardHeader>
          <CCardBody>
            {error ? <CAlert color="danger">{error}</CAlert> : null}

            {loading ? (
              <div className="d-flex align-items-center gap-2"><CSpinner size="sm" />Đang tải dữ liệu...</div>
            ) : !order ? (
              <CAlert color="warning">Không tìm thấy đơn hàng</CAlert>
            ) : (
              <>
                {!canEditOrder && canUpdateOrder ? (
                  <CAlert color="warning" className="mb-3">
                    Đơn này không thể chỉnh sửa trong ngữ cảnh hiện tại (không phải đơn của bạn hoặc đã ở trạng thái khóa/final).
                  </CAlert>
                ) : null}

                <CRow className="g-3 mb-4">
                  <CCol lg={8}>
                    <CCard className="border-0 bg-light h-100">
                      <CCardHeader><strong>Thông tin chung</strong></CCardHeader>
                      <CCardBody>
                        {editMode ? (
                          <CRow className="g-3 ai-form">
                            <CCol md={6}>
                              <CFormLabel>Mã đơn</CFormLabel>
                              <CFormInput value={order.code || `#${order.id}`} disabled />
                            </CCol>
                            <CCol md={6}>
                              <CFormLabel>Ngày nhận</CFormLabel>
                              <CFormInput
                                type="datetime-local"
                                value={orderForm.orderDate}
                                onChange={(event) => setOrderForm((prev) => ({ ...prev, orderDate: event.target.value }))}
                              />
                            </CCol>
                            <CCol md={8}>
                              <CFormLabel>Tìm khách hàng</CFormLabel>
                              <CFormInput
                                placeholder="Nhập để tìm theo mã/tên/sđt"
                                value={customerKeyword}
                                onChange={(event) => setCustomerKeyword(event.target.value)}
                              />
                            </CCol>
                            <CCol md={4}>
                              <CFormLabel>Khách hàng</CFormLabel>
                              <CFormSelect
                                value={orderForm.customer}
                                onChange={(event) => setOrderForm((prev) => ({ ...prev, customer: event.target.value }))}
                              >
                                <option value="">-- Chọn --</option>
                                {customers.map((customer) => (
                                  <option key={customer.id} value={customer.id}>{toCustomerLabel(customer)}</option>
                                ))}
                              </CFormSelect>
                            </CCol>
                            <CCol md={12}>
                              <CFormLabel>Mô tả</CFormLabel>
                              <CFormTextarea
                                rows={2}
                                value={orderForm.description}
                                onChange={(event) => setOrderForm((prev) => ({ ...prev, description: event.target.value }))}
                              />
                            </CCol>
                            <CCol md={12}>
                              <CFormLabel>Ghi chú</CFormLabel>
                              <CFormTextarea
                                rows={2}
                                value={orderForm.note}
                                onChange={(event) => setOrderForm((prev) => ({ ...prev, note: event.target.value }))}
                              />
                            </CCol>
                          </CRow>
                        ) : (
                          <CRow className="g-2 small">
                            <CCol md={6}><strong>Mã đơn:</strong> {order.code || `#${order.id}`}</CCol>
                            <CCol md={6}><strong>Ngày nhận:</strong> {formatDateTime(order.orderDate)}</CCol>
                            <CCol md={6}><strong>Department:</strong> {order.department?.name || '-'}</CCol>
                            <CCol md={6}><strong>Khách hàng:</strong> {order.customer?.name || '-'}</CCol>
                            <CCol md={6}><strong>Điện thoại KH:</strong> {order.customer?.phone || '-'}</CCol>
                            <CCol md={6}><strong>Phụ trách:</strong> {order.assignedEmployee?.fullName || '-'}</CCol>
                            <CCol md={6}><strong>Nguồn:</strong> {order.source || '-'}</CCol>
                            <CCol md={6}><strong>Trạng thái:</strong> <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CCol>
                            <CCol md={12}><strong>Mô tả:</strong> {order.description || '-'}</CCol>
                            <CCol md={12}><strong>Ghi chú:</strong> {order.note || '-'}</CCol>
                          </CRow>
                        )}
                      </CCardBody>
                    </CCard>
                  </CCol>
                  <CCol lg={4}>
                    <CCard className="border-0 bg-light h-100">
                      <CCardHeader><strong>Tổng hợp tiền</strong></CCardHeader>
                      <CCardBody>
                        <div className="mb-2"><strong>Tổng tiền:</strong> {formatMoney(order.totalAmount)}</div>
                        <div className="mb-2"><strong>Đã thu:</strong> {formatMoney(order.paidAmount)}</div>
                        <div className="mb-2"><strong>Còn nợ:</strong> {formatMoney(order.debtAmount)}</div>
                        {(Number(order.overpaidAmount || 0) > 0 || overpaidAmount > 0) ? (
                          <div className="mb-2 text-danger"><strong>Thu vượt:</strong> {formatMoney(order.overpaidAmount || overpaidAmount)}</div>
                        ) : null}
                        <div><strong>TT thanh toán:</strong> <CBadge color={paymentMeta.color}>{paymentMeta.label}</CBadge></div>
                        {editMode ? (
                          <div className="small text-body-secondary mt-2">Tổng dự kiến sau chỉnh sửa: {formatMoney(itemDraftTotal)}</div>
                        ) : null}
                      </CCardBody>
                    </CCard>
                  </CCol>
                </CRow>

                <CCard className="mb-4 ai-card">
                  <CCardHeader className="d-flex justify-content-between align-items-center">
                    <strong>Items</strong>
                    <div className="d-flex align-items-center gap-2">
                      {editMode ? (
                        <>
                          <CFormInput
                            size="sm"
                            style={{ width: 260 }}
                            placeholder="Tìm service item theo mã/tên"
                            value={serviceItemKeyword}
                            onChange={(event) => setServiceItemKeyword(event.target.value)}
                          />
                          <CButton color="success" size="sm" onClick={addDraftItem}>Thêm dòng</CButton>
                        </>
                      ) : null}
                    </div>
                  </CCardHeader>
                  <CCardBody>
                    <CTable hover responsive className="mb-0 ai-table">
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>STT</CTableHeaderCell>
                          <CTableHeaderCell>Service item</CTableHeaderCell>
                          <CTableHeaderCell>Mô tả</CTableHeaderCell>
                          <CTableHeaderCell className="text-end">SL</CTableHeaderCell>
                          <CTableHeaderCell className="text-end">Đơn giá</CTableHeaderCell>
                          <CTableHeaderCell className="text-end">Thành tiền</CTableHeaderCell>
                          <CTableHeaderCell>Attachments</CTableHeaderCell>
                          <CTableHeaderCell>Ghi chú</CTableHeaderCell>
                          {editMode ? <CTableHeaderCell>Xóa</CTableHeaderCell> : null}
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {(editMode ? itemDrafts : items).length === 0 ? (
                          <CTableRow>
                            <CTableDataCell colSpan={editMode ? 9 : 8} className="text-center text-body-secondary py-4">Không có item</CTableDataCell>
                          </CTableRow>
                        ) : (editMode ? itemDrafts : items).map((item, index) => {
                          const attachments = normalizeAttachments(item.attachments)
                          return (
                            <CTableRow key={item.id || item.rowKey || index}>
                              <CTableDataCell>{index + 1}</CTableDataCell>
                              <CTableDataCell>
                                {editMode ? (
                                  <CFormSelect
                                    value={item.serviceItem || ''}
                                    onChange={(event) => updateDraftItem(index, { serviceItem: event.target.value })}
                                  >
                                    <option value="">-- Chọn --</option>
                                    {item.serviceItem && !serviceItemMap.has(Number(item.serviceItem)) ? (
                                      <option value={item.serviceItem}>{`#${item.serviceItem}`}</option>
                                    ) : null}
                                    {serviceItems.map((serviceItem) => (
                                      <option key={serviceItem.id} value={serviceItem.id}>{toServiceItemLabel(serviceItem)}</option>
                                    ))}
                                  </CFormSelect>
                                ) : (item.serviceItem?.name || item.serviceItem?.code || '-')}
                              </CTableDataCell>
                              <CTableDataCell>
                                {editMode ? (
                                  <CFormTextarea
                                    rows={2}
                                    value={item.description || ''}
                                    onChange={(event) => updateDraftItem(index, { description: event.target.value })}
                                  />
                                ) : (item.description || '-')}
                              </CTableDataCell>
                              <CTableDataCell className="text-end">
                                {editMode ? (
                                  <CFormInput
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={item.quantity || 0}
                                    onChange={(event) => updateDraftItem(index, { quantity: event.target.value })}
                                  />
                                ) : (item.quantity || 0)}
                              </CTableDataCell>
                              <CTableDataCell className="text-end">
                                {editMode ? (
                                  <CFormInput
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={item.unitPrice || 0}
                                    onChange={(event) => updateDraftItem(index, { unitPrice: event.target.value })}
                                  />
                                ) : formatMoney(item.unitPrice)}
                              </CTableDataCell>
                              <CTableDataCell className="text-end">{formatMoney(item.amount)}</CTableDataCell>
                              <CTableDataCell>
                                {attachments.length === 0 ? '-' : attachments.map((file, fileIndex) => {
                                  const url = toFileUrl(file?.url || file?.attributes?.url)
                                  const name = file?.name || file?.attributes?.name || `Tệp ${fileIndex + 1}`
                                  return url
                                    ? <div key={`${name}-${fileIndex}`}><a href={url} target="_blank" rel="noreferrer">{name}</a></div>
                                    : <div key={`${name}-${fileIndex}`}>{name}</div>
                                })}
                              </CTableDataCell>
                              <CTableDataCell>
                                {editMode ? (
                                  <CFormTextarea
                                    rows={2}
                                    value={item.note || ''}
                                    onChange={(event) => updateDraftItem(index, { note: event.target.value })}
                                  />
                                ) : (item.note || '-')}
                              </CTableDataCell>
                              {editMode ? (
                                <CTableDataCell>
                                  <CButton
                                    size="sm"
                                    color="danger"
                                    variant="outline"
                                    disabled={itemDrafts.length <= 1}
                                    onClick={() => removeDraftItem(index)}
                                  >
                                    Xóa
                                  </CButton>
                                </CTableDataCell>
                              ) : null}
                            </CTableRow>
                          )
                        })}
                      </CTableBody>
                    </CTable>
                  </CCardBody>
                </CCard>

                <CCard className="ai-card">
                  <CCardHeader><strong>Lịch sử thanh toán</strong></CCardHeader>
                  <CCardBody>
                    <CTable hover responsive className="mb-0 ai-table">
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Thời gian</CTableHeaderCell>
                          <CTableHeaderCell className="text-end">Số tiền</CTableHeaderCell>
                          <CTableHeaderCell>Phương thức</CTableHeaderCell>
                          <CTableHeaderCell>Người thu</CTableHeaderCell>
                          <CTableHeaderCell>Ghi chú</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {payments.length === 0 ? (
                          <CTableRow>
                            <CTableDataCell colSpan={5} className="text-center text-body-secondary py-4">Chưa có thanh toán</CTableDataCell>
                          </CTableRow>
                        ) : payments.map((payment) => (
                          <CTableRow key={payment.id}>
                            <CTableDataCell>{formatDateTime(payment.paidAt)}</CTableDataCell>
                            <CTableDataCell className="text-end">{formatMoney(payment.amount)}</CTableDataCell>
                            <CTableDataCell>{payment.method || '-'}</CTableDataCell>
                            <CTableDataCell>{payment.collectedBy?.fullName || '-'}</CTableDataCell>
                            <CTableDataCell>{payment.note || '-'}</CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  </CCardBody>
                </CCard>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <PaymentCreateModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        order={order}
        onCreated={loadDetail}
      />
    </CRow>
  )
}
