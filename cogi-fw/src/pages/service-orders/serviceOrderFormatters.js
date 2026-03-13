export const ORDER_STATUS_META = {
  NEW: { label: "Mới", color: "secondary" },
  PROCESSING: { label: "Đang xử lý", color: "warning" },
  READY: { label: "Sẵn sàng", color: "info" },
  DELIVERED: { label: "Đã giao", color: "success" },
  CANCELLED: { label: "Đã hủy", color: "dark" },
}

export const PAYMENT_STATUS_META = {
  UNPAID: { label: "Chưa thu", color: "danger" },
  PARTIAL: { label: "Thu một phần", color: "warning" },
  PAID: { label: "Đã thu đủ", color: "success" },
}

export const SOURCE_OPTIONS = [
  { value: "DIRECT", label: "Trực tiếp" },
  { value: "PHONE", label: "Điện thoại" },
  { value: "ZALO", label: "Zalo" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "OTHER", label: "Khác" },
]

export const ORDER_STATUS_OPTIONS = Object.keys(ORDER_STATUS_META).map((key) => ({
  value: key,
  label: ORDER_STATUS_META[key].label,
}))

export const PAYMENT_STATUS_OPTIONS = Object.keys(PAYMENT_STATUS_META).map((key) => ({
  value: key,
  label: PAYMENT_STATUS_META[key].label,
}))

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "TRANSFER", label: "Chuyển khoản" },
  { value: "MOMO", label: "MoMo" },
  { value: "OTHER", label: "Khác" },
]

export function getOrderStatusMeta(status) {
  return ORDER_STATUS_META[status] || { label: status || "-", color: "secondary" }
}

export function getPaymentStatusMeta(status) {
  return PAYMENT_STATUS_META[status] || { label: status || "-", color: "secondary" }
}

export function formatMoney(value) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return "0"
  return new Intl.NumberFormat("vi-VN").format(numeric)
}

export function formatDateTime(value) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("vi-VN")
}

export function formatDateInput(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function toPositiveNumber(value, fallback = 0) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  if (numeric < 0) return 0
  return numeric
}

export function normalizeApiRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}
