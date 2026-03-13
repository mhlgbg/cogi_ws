import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
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
} from "@coreui/react"
import {
  createServiceOrder,
  createServiceOrderItem,
  deleteServiceOrderItem,
  getCustomersLookup,
  getDepartmentsLookup,
  getEmployeesLookup,
  getServiceItemsLookup,
  getServiceOrderById,
  getServiceOrderItemsByOrder,
  updateServiceOrder,
  updateServiceOrderItem,
  uploadFiles,
} from "../../api/serviceOrderApi"
import {
  ORDER_STATUS_OPTIONS,
  SOURCE_OPTIONS,
  formatMoney,
  normalizeApiRows,
  toPositiveNumber,
} from "./serviceOrderFormatters"

function createEmptyItem() {
  return {
    id: null,
    serviceItem: "",
    description: "",
    quantity: 1,
    unitPrice: 0,
    amount: 0,
    note: "",
    sortOrder: 0,
    attachments: [],
    selectedFiles: [],
  }
}

function toAttachmentRows(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

function toAttachmentId(file) {
  return Number(file?.id || file?.documentId || file?.attributes?.id || 0)
}

function toAttachmentName(file, index) {
  return file?.name || file?.attributes?.name || `Tệp ${index + 1}`
}

function toAttachmentUrl(url) {
  if (!url) return ""
  if (String(url).startsWith("http")) return url

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "")
  if (!apiBaseUrl) return url

  const normalizedPath = String(url).startsWith("/") ? String(url) : `/${String(url)}`
  const hostBase = apiBaseUrl.endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl
  return `${hostBase}${normalizedPath}`
}

function getRelationId(value) {
  if (!value) return ""
  if (value?.id) return String(value.id)
  const direct = Number(value)
  return Number.isInteger(direct) && direct > 0 ? String(direct) : ""
}

function getCustomerOptionLabel(item) {
  const name = item?.name || ""
  const code = item?.code ? `[${item.code}]` : ""
  const phone = item?.phone ? ` - ${item.phone}` : ""
  return `${code} ${name}${phone}`.trim()
}

function getServiceItemOptionLabel(item) {
  const code = item?.code ? `[${item.code}]` : ""
  const name = item?.name || ""
  const categoryName = item?.category?.name ? ` - ${item.category.name}` : ""
  return `${code} ${name}${categoryName}`.trim()
}

function toOrderFormData(order) {
  return {
    department: getRelationId(order?.department),
    assignedEmployee: getRelationId(order?.assignedEmployee),
    customer: getRelationId(order?.customer),
    source: order?.source || "DIRECT",
    orderDate: order?.orderDate ? new Date(order.orderDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    status: order?.status || "NEW",
    description: order?.description || "",
    note: order?.note || "",
  }
}

function toItemFormRow(item, index) {
  return {
    id: item?.id || null,
    documentId: item?.documentId || null,
    serviceItem: getRelationId(item?.serviceItem),
    description: item?.description || "",
    quantity: Number(item?.quantity || 0),
    unitPrice: Number(item?.unitPrice || 0),
    amount: Number(item?.amount || 0),
    note: item?.note || "",
    sortOrder: Number(item?.sortOrder || index),
    attachments: toAttachmentRows(item?.attachments),
    selectedFiles: [],
  }
}

function getItemIdentifier(item) {
  if (!item) return null
  if (item?.documentId) return String(item.documentId)
  if (item?.id) return String(item.id)
  return null
}

export default function ServiceOrderFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = Boolean(id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [warning, setWarning] = useState("")

  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [customers, setCustomers] = useState([])
  const [serviceItems, setServiceItems] = useState([])
  const [customerKeyword, setCustomerKeyword] = useState("")
  const [serviceItemKeyword, setServiceItemKeyword] = useState("")

  const [form, setForm] = useState({
    department: "",
    assignedEmployee: "",
    customer: "",
    source: "DIRECT",
    orderDate: new Date().toISOString().slice(0, 16),
    status: "NEW",
    description: "",
    note: "",
  })

  const [items, setItems] = useState([createEmptyItem()])

  const computedTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + toPositiveNumber(item.quantity) * toPositiveNumber(item.unitPrice), 0)
  }, [items])

  const retailGuest = useMemo(() => {
    return customers.find((item) => item?.isDefaultRetailGuest)
  }, [customers])

  const selectedCustomer = useMemo(() => {
    return customers.find((item) => String(item?.id) === String(form.customer || "")) || null
  }, [customers, form.customer])

  const serviceItemMap = useMemo(() => {
    return new Map(serviceItems.map((item) => [Number(item.id), item]))
  }, [serviceItems])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const [depRes, empRes, customerRes, itemRes, orderRes, orderItemsRes] = await Promise.allSettled([
        getDepartmentsLookup(),
        getEmployeesLookup(),
        getCustomersLookup({ limit: 100 }),
        getServiceItemsLookup({ limit: 300 }),
        isEditMode ? getServiceOrderById(id) : Promise.resolve(null),
        isEditMode ? getServiceOrderItemsByOrder(id) : Promise.resolve(null),
      ])

      const depRows = depRes.status === "fulfilled" ? normalizeApiRows(depRes.value) : []
      const empRows = empRes.status === "fulfilled" ? normalizeApiRows(empRes.value) : []
      const customerRows = customerRes.status === "fulfilled" ? normalizeApiRows(customerRes.value) : []
      const itemRows = itemRes.status === "fulfilled" ? normalizeApiRows(itemRes.value) : []

      setDepartments(depRows)
      setEmployees(empRows)
      setCustomers(customerRows)
      setServiceItems(itemRows)

      if (isEditMode) {
        const order = orderRes.status === "fulfilled" ? orderRes.value?.data || null : null
        const orderItems = orderItemsRes.status === "fulfilled" ? normalizeApiRows(orderItemsRes.value) : []

        setForm(toOrderFormData(order))
        setItems(orderItems.length > 0 ? orderItems.map(toItemFormRow) : [createEmptyItem()])
      } else {
        const guest = customerRows.find((item) => item?.isDefaultRetailGuest)
        setForm((prev) => ({ ...prev, customer: guest?.id ? String(guest.id) : prev.customer }))
      }
    } catch (loadError) {
      setError(loadError?.response?.data?.error?.message || loadError?.message || "Không tải được dữ liệu biểu mẫu")
    } finally {
      setLoading(false)
    }
  }, [id, isEditMode])

  const loadCustomerLookup = useCallback(async (keyword) => {
    const response = await getCustomersLookup({
      keyword: String(keyword || "").trim() || undefined,
      limit: 100,
    })
    setCustomers(normalizeApiRows(response))
  }, [])

  const loadServiceItemLookup = useCallback(async (keyword) => {
    const response = await getServiceItemsLookup({
      keyword: String(keyword || "").trim() || undefined,
      limit: 300,
    })
    setServiceItems(normalizeApiRows(response))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

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
    setItems((prev) => [...prev, { ...createEmptyItem(), sortOrder: prev.length }])
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function onSelectRetailGuest() {
    if (!retailGuest?.id) return
    setForm((prev) => ({ ...prev, customer: String(retailGuest.id) }))
  }

  function onChangeServiceItem(index, value) {
    const selected = serviceItemMap.get(Number(value)) || null
    const current = items[index]
    const currentPrice = toPositiveNumber(current?.unitPrice)
    const suggestedPrice = toPositiveNumber(selected?.defaultPrice)

    const patch = {
      serviceItem: value,
    }

    if ((!currentPrice || currentPrice === 0) && suggestedPrice > 0) {
      patch.unitPrice = suggestedPrice
    }

    if (!String(current?.description || "").trim() && selected?.name) {
      patch.description = selected.name
    }

    updateItem(index, patch)
  }

  function validateBeforeSubmit() {
    if (!form.customer) {
      setError("Khách hàng là bắt buộc")
      return false
    }

    if (!form.orderDate) {
      setError("Ngày nhận đơn là bắt buộc")
      return false
    }

    const hasInvalid = items.some((item) => toPositiveNumber(item.quantity) < 0 || toPositiveNumber(item.unitPrice) < 0)
    if (hasInvalid) {
      setError("Số lượng và đơn giá không được âm")
      return false
    }

    if (items.length === 0) {
      setWarning("Đơn hiện chưa có item, hệ thống vẫn cho lưu")
    } else {
      setWarning("")
    }

    return true
  }

  async function buildAttachmentIds(item) {
    const existingIds = (item.attachments || [])
      .map((file) => toAttachmentId(file))
      .filter((value) => Number.isInteger(value) && value > 0)

    if (!Array.isArray(item.selectedFiles) || item.selectedFiles.length === 0) {
      return existingIds
    }

    const uploaded = await uploadFiles(item.selectedFiles)
    const uploadedIds = Array.isArray(uploaded?.fileIds) ? uploaded.fileIds : []
    return Array.from(new Set([...existingIds, ...uploadedIds]))
  }

  async function saveItems(orderId) {
    const existingItemsPayload = isEditMode ? normalizeApiRows(await getServiceOrderItemsByOrder(orderId)) : []
    const existingMap = new Map(
      existingItemsPayload
        .map((item) => [getItemIdentifier(item), item])
        .filter(([identifier]) => Boolean(identifier))
    )

    const currentIds = []

    for (let index = 0; index < items.length; index += 1) {
      const row = items[index]
      const attachmentIds = await buildAttachmentIds(row)

      const payload = {
        order: Number(orderId),
        serviceItem: row.serviceItem ? Number(row.serviceItem) : null,
        description: String(row.description || "").trim() || null,
        quantity: toPositiveNumber(row.quantity),
        unitPrice: toPositiveNumber(row.unitPrice),
        amount: toPositiveNumber(row.quantity) * toPositiveNumber(row.unitPrice),
        note: String(row.note || "").trim() || null,
        sortOrder: index,
        attachments: { set: attachmentIds },
      }

      const rowIdentifier = getItemIdentifier(row)
      if (rowIdentifier) {
        await updateServiceOrderItem(rowIdentifier, payload)
        currentIds.push(String(rowIdentifier))
      } else {
        const created = await createServiceOrderItem(payload)
        const newIdentifier = getItemIdentifier(created?.data || created)
        if (newIdentifier) currentIds.push(String(newIdentifier))
      }
    }

    const toDelete = [...existingMap.keys()].filter((itemId) => itemId && !currentIds.includes(String(itemId)))
    for (const itemIdentifier of toDelete) {
      await deleteServiceOrderItem(itemIdentifier)
    }
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (saving) return
    setError("")

    if (!validateBeforeSubmit()) return

    setSaving(true)
    try {
      const orderPayload = {
        department: form.department ? Number(form.department) : null,
        assignedEmployee: form.assignedEmployee ? Number(form.assignedEmployee) : null,
        customer: form.customer ? Number(form.customer) : null,
        source: form.source,
        orderDate: new Date(form.orderDate).toISOString(),
        status: form.status,
        description: String(form.description || "").trim() || null,
        note: String(form.note || "").trim() || null,
      }

      let orderId = id
      if (isEditMode) {
        await updateServiceOrder(orderId, orderPayload)
      } else {
        const created = await createServiceOrder(orderPayload)
        orderId = created?.data?.id || created?.id
      }

      if (!orderId) {
        throw new Error("Không lấy được ID đơn hàng sau khi lưu")
      }

      await saveItems(orderId)
      navigate(`/service-orders/${orderId}`)
    } catch (submitError) {
      setError(submitError?.response?.data?.error?.message || submitError?.message || "Lưu đơn thất bại")
    } finally {
      setSaving(false)
    }
  }

  return (
    <CRow className="justify-content-center">
      <CCol xs={12} style={{ maxWidth: 1500 }}>
        <CCard className="mb-4 ai-card">
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <strong>{isEditMode ? "Cập nhật đơn dịch vụ" : "Tạo đơn dịch vụ"}</strong>
            <div className="d-flex gap-2">
              <CButton color="secondary" variant="outline" onClick={() => navigate("/service-orders")}>Quay lại</CButton>
              <CButton color="primary" disabled={saving || loading} onClick={onSubmit}>{saving ? "Đang lưu..." : "Lưu đơn"}</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            {error ? <CAlert color="danger">{error}</CAlert> : null}
            {warning ? <CAlert color="warning">{warning}</CAlert> : null}

            {loading ? (
              <div className="d-flex align-items-center gap-2"><CSpinner size="sm" />Đang tải dữ liệu...</div>
            ) : (
              <form onSubmit={onSubmit}>
                <CCard className="mb-4 border-0 bg-light">
                  <CCardHeader><strong>Thông tin chung</strong></CCardHeader>
                  <CCardBody>
                    <CRow className="g-3 ai-form">
                      <CCol md={3}>
                        <CFormLabel>Department</CFormLabel>
                        <CFormSelect value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}>
                          <option value="">-- Chọn --</option>
                          {departments.map((item) => <option key={item.id} value={item.id}>{item.name || `#${item.id}`}</option>)}
                        </CFormSelect>
                      </CCol>
                      <CCol md={3}>
                        <CFormLabel>Nhân viên phụ trách</CFormLabel>
                        <CFormSelect value={form.assignedEmployee} onChange={(e) => setForm((prev) => ({ ...prev, assignedEmployee: e.target.value }))}>
                          <option value="">-- Chọn --</option>
                          {employees.map((item) => <option key={item.id} value={item.id}>{item.fullName || item.employeeCode || `#${item.id}`}</option>)}
                        </CFormSelect>
                      </CCol>
                      <CCol md={3}>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <CFormLabel className="mb-0">Khách hàng</CFormLabel>
                          <CButton
                            type="button"
                            size="sm"
                            color="warning"
                            variant="outline"
                            disabled={!retailGuest?.id}
                            onClick={onSelectRetailGuest}
                          >
                            Chọn Khách lẻ
                          </CButton>
                        </div>
                        <CFormInput
                          className="mb-2"
                          placeholder="Tìm theo tên / SĐT / mã / zalo"
                          value={customerKeyword}
                          onChange={(e) => setCustomerKeyword(e.target.value)}
                        />
                        <CFormSelect value={form.customer} onChange={(e) => setForm((prev) => ({ ...prev, customer: e.target.value }))}>
                          <option value="">-- Chọn --</option>
                          {customers.map((item) => <option key={item.id} value={item.id}>{getCustomerOptionLabel(item)}</option>)}
                        </CFormSelect>
                        {selectedCustomer?.isDefaultRetailGuest ? (
                          <div className="mt-2 d-flex flex-column gap-1">
                            <div><CBadge color="warning">Khách lẻ</CBadge></div>
                            <small className="text-body-secondary">Gợi ý: Khách lẻ không phù hợp để theo dõi công nợ dài hạn.</small>
                          </div>
                        ) : null}
                      </CCol>
                      <CCol md={3}>
                        <CFormLabel>Nguồn</CFormLabel>
                        <CFormSelect value={form.source} onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}>
                          {SOURCE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </CFormSelect>
                      </CCol>
                      <CCol md={3}>
                        <CFormLabel>Ngày nhận đơn</CFormLabel>
                        <CFormInput type="datetime-local" value={form.orderDate} onChange={(e) => setForm((prev) => ({ ...prev, orderDate: e.target.value }))} />
                      </CCol>
                      <CCol md={3}>
                        <CFormLabel>Trạng thái</CFormLabel>
                        <CFormSelect value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                          {ORDER_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </CFormSelect>
                      </CCol>
                      <CCol md={3}>
                        <CFormLabel>Tổng tiền tạm tính</CFormLabel>
                        <div><CBadge color="info">{formatMoney(computedTotal)}</CBadge></div>
                      </CCol>
                      <CCol md={12}>
                        <CFormLabel>Mô tả</CFormLabel>
                        <CFormTextarea rows={2} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                      </CCol>
                      <CCol md={12}>
                        <CFormLabel>Ghi chú</CFormLabel>
                        <CFormTextarea rows={2} value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} />
                      </CCol>
                    </CRow>
                  </CCardBody>
                </CCard>

                <CCard className="ai-card">
                  <CCardHeader className="d-flex justify-content-between align-items-center">
                    <strong>Danh sách items</strong>
                    <CButton color="success" size="sm" onClick={addItem}>Thêm item</CButton>
                  </CCardHeader>
                  <CCardBody>
                    <CRow className="g-3 mb-3 ai-form">
                      <CCol md={4}>
                        <CFormLabel>Tìm service item</CFormLabel>
                        <CFormInput
                          placeholder="Tìm theo mã hoặc tên"
                          value={serviceItemKeyword}
                          onChange={(e) => setServiceItemKeyword(e.target.value)}
                        />
                      </CCol>
                    </CRow>
                    <CTable responsive hover className="mb-0 ai-table">
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                          <CTableHeaderCell style={{ minWidth: 220 }}>Service Item</CTableHeaderCell>
                          <CTableHeaderCell style={{ minWidth: 220 }}>Mô tả</CTableHeaderCell>
                          <CTableHeaderCell style={{ minWidth: 110 }}>SL</CTableHeaderCell>
                          <CTableHeaderCell style={{ minWidth: 140 }}>Đơn giá</CTableHeaderCell>
                          <CTableHeaderCell style={{ minWidth: 150 }}>Thành tiền</CTableHeaderCell>
                          <CTableHeaderCell style={{ minWidth: 220 }}>Attachments</CTableHeaderCell>
                          <CTableHeaderCell style={{ minWidth: 220 }}>Ghi chú</CTableHeaderCell>
                          <CTableHeaderCell style={{ minWidth: 90 }}>Xóa</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {items.map((row, index) => {
                          const selectedServiceItem = serviceItemMap.get(Number(row.serviceItem)) || null

                          return (
                          <CTableRow key={`${row.id || "new"}-${index}`}>
                            <CTableDataCell>{index + 1}</CTableDataCell>
                            <CTableDataCell>
                              <CFormSelect value={row.serviceItem} onChange={(e) => onChangeServiceItem(index, e.target.value)}>
                                <option value="">-- Chọn --</option>
                                {serviceItems.map((item) => (
                                  <option key={item.id} value={item.id}>{getServiceItemOptionLabel(item)}</option>
                                ))}
                              </CFormSelect>
                              {selectedServiceItem?.unit ? (
                                <div className="small text-body-secondary mt-1">Đơn vị gợi ý: {selectedServiceItem.unit}</div>
                              ) : null}
                            </CTableDataCell>
                            <CTableDataCell>
                              <CFormTextarea rows={2} value={row.description} onChange={(e) => updateItem(index, { description: e.target.value })} />
                            </CTableDataCell>
                            <CTableDataCell>
                              <CFormInput type="number" min="0" step="1" value={row.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} />
                            </CTableDataCell>
                            <CTableDataCell>
                              <CFormInput type="number" min="0" step="1000" value={row.unitPrice} onChange={(e) => updateItem(index, { unitPrice: e.target.value })} />
                            </CTableDataCell>
                            <CTableDataCell>
                              <strong>{formatMoney(row.amount)}</strong>
                            </CTableDataCell>
                            <CTableDataCell>
                              <CFormInput
                                type="file"
                                multiple
                                onChange={(e) => updateItem(index, { selectedFiles: Array.from(e.target.files || []) })}
                              />
                              {(row.attachments || []).length > 0 ? (
                                <div className="small mt-1">
                                  {(row.attachments || []).map((file, fileIndex) => {
                                    const url = toAttachmentUrl(file?.url || file?.attributes?.url)
                                    const name = toAttachmentName(file, fileIndex)
                                    return url ? <div key={`${name}-${fileIndex}`}><a href={url} target="_blank" rel="noreferrer">{name}</a></div> : <div key={`${name}-${fileIndex}`}>{name}</div>
                                  })}
                                </div>
                              ) : null}
                              {Array.isArray(row.selectedFiles) && row.selectedFiles.length > 0 ? (
                                <div className="small text-body-secondary mt-1">{row.selectedFiles.length} file mới</div>
                              ) : null}
                            </CTableDataCell>
                            <CTableDataCell>
                              <CFormTextarea rows={2} value={row.note} onChange={(e) => updateItem(index, { note: e.target.value })} />
                            </CTableDataCell>
                            <CTableDataCell>
                              <CButton size="sm" color="danger" variant="outline" onClick={() => removeItem(index)} disabled={items.length <= 1}>Xóa</CButton>
                            </CTableDataCell>
                            </CTableRow>
                          )})}
                      </CTableBody>
                    </CTable>
                  </CCardBody>
                </CCard>
              </form>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}
