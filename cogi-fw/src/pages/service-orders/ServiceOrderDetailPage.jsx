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
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react"
import { useIam } from "../../contexts/IamContext"
import {
  getServiceOrderById,
  updateServiceOrder,
} from "../../api/serviceOrderApi"
import PaymentCreateModal from "../../components/service-orders/PaymentCreateModal"
import {
  ORDER_STATUS_OPTIONS,
  formatDateTime,
  formatMoney,
  getOrderStatusMeta,
  getPaymentStatusMeta,
} from "./serviceOrderFormatters"

const ORDER_UPDATE_KEYS = [
  "serviceSales.order.update.self",
  "serviceSales.order.update.department",
  "serviceSales.order.update.all",
]

const PAYMENT_CREATE_KEYS = [
  "serviceSales.payment.create.self",
  "serviceSales.payment.create.department",
  "serviceSales.payment.create.all",
]

const NEXT_STATUS_MAP = {
  NEW: "PROCESSING",
  PROCESSING: "READY",
  READY: "DELIVERED",
}

function normalizeAttachments(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

function toFileUrl(url) {
  if (!url) return ""
  if (String(url).startsWith("http")) return url

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "")
  if (!apiBaseUrl) return url

  const normalizedPath = String(url).startsWith("/") ? String(url) : `/${String(url)}`
  const hostBase = apiBaseUrl.endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl
  return `${hostBase}${normalizedPath}`
}

export default function ServiceOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canAny } = useIam()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [payments, setPayments] = useState([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  const hasServiceOrdersKey = canAny(["service-orders"])
  const canUpdateOrder = hasServiceOrdersKey || canAny(ORDER_UPDATE_KEYS)
  const canCreatePayment = hasServiceOrdersKey || canAny(PAYMENT_CREATE_KEYS)

  const nextStatus = useMemo(() => {
    return NEXT_STATUS_MAP[order?.status] || null
  }, [order?.status])

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const orderRes = await getServiceOrderById(id)
      const orderData = orderRes?.data || null
      const itemRows = Array.isArray(orderData?.items) ? orderData.items : []
      const paymentRows = Array.isArray(orderData?.payments) ? orderData.payments : []

      setOrder(orderData)
      setItems(itemRows)
      setPayments(paymentRows)
    } catch (loadError) {
      setOrder(null)
      setItems([])
      setPayments([])
      setError(loadError?.response?.data?.error?.message || loadError?.message || "Không tải được chi tiết đơn")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  async function onAdvanceStatus() {
    if (!order?.id || !nextStatus || !canUpdateOrder) return

    setStatusUpdating(true)
    setError("")
    try {
      await updateServiceOrder(order.id, { status: nextStatus })
      await loadDetail()
    } catch (updateError) {
      setError(updateError?.response?.data?.error?.message || updateError?.message || "Không cập nhật được trạng thái đơn")
    } finally {
      setStatusUpdating(false)
    }
  }

  const statusMeta = getOrderStatusMeta(order?.status)
  const paymentMeta = getPaymentStatusMeta(order?.paymentStatus)

  return (
    <CRow className="justify-content-center">
      <CCol xs={12} style={{ maxWidth: 1500 }}>
        <CCard className="mb-4 ai-card">
          <CCardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <strong>Chi tiết đơn dịch vụ</strong>
            <div className="d-flex gap-2">
              <CButton color="secondary" variant="outline" onClick={() => navigate("/service-orders")}>Quay lại</CButton>
              {canUpdateOrder ? (
                <CButton color="primary" onClick={() => navigate(`/service-orders/${id}/edit`)}>Sửa đơn</CButton>
              ) : null}
              {canCreatePayment ? (
                <CButton color="success" onClick={() => setShowPaymentModal(true)}>Thêm thanh toán</CButton>
              ) : null}
              {canUpdateOrder && nextStatus ? (
                <CButton color="warning" disabled={statusUpdating} onClick={onAdvanceStatus}>
                  {statusUpdating ? "Đang cập nhật..." : `Chuyển trạng thái: ${nextStatus}`}
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
                <CRow className="g-3 mb-4">
                  <CCol lg={8}>
                    <CCard className="border-0 bg-light h-100">
                      <CCardHeader><strong>Thông tin chung</strong></CCardHeader>
                      <CCardBody>
                        <CRow className="g-2 small">
                          <CCol md={6}><strong>Mã đơn:</strong> {order.code || `#${order.id}`}</CCol>
                          <CCol md={6}><strong>Ngày nhận:</strong> {formatDateTime(order.orderDate)}</CCol>
                          <CCol md={6}><strong>Department:</strong> {order.department?.name || "-"}</CCol>
                          <CCol md={6}><strong>Khách hàng:</strong> {order.customer?.name || "-"}</CCol>
                          <CCol md={6}><strong>Điện thoại KH:</strong> {order.customer?.phone || "-"}</CCol>
                          <CCol md={6}><strong>Phụ trách:</strong> {order.assignedEmployee?.fullName || "-"}</CCol>
                          <CCol md={6}><strong>Nguồn:</strong> {order.source || "-"}</CCol>
                          <CCol md={6}><strong>Trạng thái:</strong> <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CCol>
                          <CCol md={12}><strong>Mô tả:</strong> {order.description || "-"}</CCol>
                          <CCol md={12}><strong>Ghi chú:</strong> {order.note || "-"}</CCol>
                        </CRow>
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
                        <div><strong>TT thanh toán:</strong> <CBadge color={paymentMeta.color}>{paymentMeta.label}</CBadge></div>
                      </CCardBody>
                    </CCard>
                  </CCol>
                </CRow>

                <CCard className="mb-4 ai-card">
                  <CCardHeader><strong>Items</strong></CCardHeader>
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
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {items.length === 0 ? (
                          <CTableRow>
                            <CTableDataCell colSpan={8} className="text-center text-body-secondary py-4">Không có item</CTableDataCell>
                          </CTableRow>
                        ) : items.map((item, index) => {
                          const attachments = normalizeAttachments(item.attachments)
                          return (
                            <CTableRow key={item.id || index}>
                              <CTableDataCell>{index + 1}</CTableDataCell>
                              <CTableDataCell>{item.serviceItem?.name || item.serviceItem?.code || "-"}</CTableDataCell>
                              <CTableDataCell>{item.description || "-"}</CTableDataCell>
                              <CTableDataCell className="text-end">{item.quantity || 0}</CTableDataCell>
                              <CTableDataCell className="text-end">{formatMoney(item.unitPrice)}</CTableDataCell>
                              <CTableDataCell className="text-end">{formatMoney(item.amount)}</CTableDataCell>
                              <CTableDataCell>
                                {attachments.length === 0 ? "-" : attachments.map((file, fileIndex) => {
                                  const url = toFileUrl(file?.url || file?.attributes?.url)
                                  const name = file?.name || file?.attributes?.name || `Tệp ${fileIndex + 1}`
                                  return url
                                    ? <div key={`${name}-${fileIndex}`}><a href={url} target="_blank" rel="noreferrer">{name}</a></div>
                                    : <div key={`${name}-${fileIndex}`}>{name}</div>
                                })}
                              </CTableDataCell>
                              <CTableDataCell>{item.note || "-"}</CTableDataCell>
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
                            <CTableDataCell>{payment.method || "-"}</CTableDataCell>
                            <CTableDataCell>{payment.collectedBy?.fullName || "-"}</CTableDataCell>
                            <CTableDataCell>{payment.note || "-"}</CTableDataCell>
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
