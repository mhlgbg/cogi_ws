import api from '../../../api/axios'

export const ORDER_STATUS_META = {
  DRAFT: { label: 'Nháp', color: 'secondary' },
  OPEN: { label: 'Mở', color: 'info' },
  PARTIAL_PAID: { label: 'Đã thu một phần', color: 'warning' },
  NEW: { label: 'Mới', color: 'secondary' },
  PROCESSING: { label: 'Đang xử lý', color: 'warning' },
  READY: { label: 'Sẵn sàng', color: 'info' },
  DELIVERED: { label: 'Đã giao', color: 'success' },
  CANCELLED: { label: 'Đã hủy', color: 'dark' },
  LOCKED: { label: 'Đã khóa', color: 'dark' },
  COMPLETED: { label: 'Hoàn tất', color: 'success' },
}

export const PAYMENT_STATUS_META = {
  UNPAID: { label: 'Chưa thu', color: 'danger' },
  PARTIAL: { label: 'Thu một phần', color: 'warning' },
  PAID: { label: 'Đã thu đủ', color: 'success' },
}

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'TRANSFER', label: 'Chuyển khoản' },
  { value: 'MOMO', label: 'MoMo' },
  { value: 'OTHER', label: 'Khác' },
]

function toNumberOrZero(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return parsed
}

export function normalizeApiRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}

export function toPositiveNumber(value, fallback = 0) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  if (numeric < 0) return 0
  return numeric
}

export function formatMoney(value) {
  const numeric = toNumberOrZero(value)
  return new Intl.NumberFormat('vi-VN').format(numeric)
}

export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

export function getOrderStatusMeta(status) {
  return ORDER_STATUS_META[status] || { label: status || '-', color: 'secondary' }
}

export function getPaymentStatusMeta(status) {
  return PAYMENT_STATUS_META[status] || { label: status || '-', color: 'secondary' }
}

export function isEditableOrderState(order) {
  const status = String(order?.status || '').trim().replace(/[\s-]+/g, '_').toUpperCase()
  if (!status) return true
  return !new Set(['READY', 'DELIVERED']).has(status)
}

export async function getSalesCounterContext() {
  const res = await api.get('/service-orders/counter-context')
  return res.data
}

export async function quickCreateCounterCustomer(payload) {
  const res = await api.post('/service-orders/lookups/customers/quick-create', {
    data: payload,
  })
  return res.data
}

export async function getServiceOrders(params = {}) {
  const res = await api.get('/service-orders/list', { params })
  return res.data
}

export async function getServiceOrderById(id) {
  const res = await api.get(`/service-orders/${id}`)
  return res.data
}

export async function createServiceOrder(payload) {
  const res = await api.post('/service-orders', { data: payload })
  return res.data
}

export async function updateServiceOrder(id, payload) {
  const res = await api.put(`/service-orders/${id}`, { data: payload })
  return res.data
}

export async function createServiceOrderItem(payload) {
  const res = await api.post('/service-order-items', { data: payload })
  return res.data
}

export async function updateServiceOrderItem(id, payload) {
  const res = await api.put(`/service-order-items/${id}`, { data: payload })
  return res.data
}

export async function deleteServiceOrderItem(id) {
  const res = await api.delete(`/service-order-items/${id}`)
  return res.data
}

export async function createPaymentTransaction(payload) {
  const res = await api.post('/payment-transactions', { data: payload })
  return res.data
}

export async function getCustomersLookup(params = {}) {
  try {
    const res = await api.get('/service-orders/lookups/customers', {
      params,
    })
    return res.data
  } catch {
    const keyword = String(params?.keyword || '').trim()
    const limit = Number(params?.limit) > 0 ? Number(params.limit) : 100

    const fallbackParams = {
      'pagination[page]': 1,
      'pagination[pageSize]': Math.min(limit, 500),
      'sort[0]': 'isDefaultRetailGuest:desc',
      'sort[1]': 'name:asc',
      'filters[isActive][$eq]': true,
    }

    if (keyword) {
      fallbackParams['filters[$or][0][name][$containsi]'] = keyword
      fallbackParams['filters[$or][1][phone][$containsi]'] = keyword
      fallbackParams['filters[$or][2][code][$containsi]'] = keyword
      fallbackParams['filters[$or][3][zalo][$containsi]'] = keyword
    }

    const fallback = await api.get('/customers', { params: fallbackParams })
    return fallback.data
  }
}

export async function getServiceItemsLookup(params = {}) {
  try {
    const res = await api.get('/service-orders/lookups/service-items', {
      params,
    })
    return res.data
  } catch {
    const keyword = String(params?.keyword || '').trim()
    const limit = Number(params?.limit) > 0 ? Number(params.limit) : 200
    const category = Number(params?.category)

    const fallbackParams = {
      'pagination[page]': 1,
      'pagination[pageSize]': Math.min(limit, 500),
      'sort[0]': 'sortOrder:asc',
      'sort[1]': 'name:asc',
      'filters[isActive][$eq]': true,
      'populate[category][fields][0]': 'code',
      'populate[category][fields][1]': 'name',
      'populate[category][fields][2]': 'isActive',
    }

    if (Number.isInteger(category) && category > 0) {
      fallbackParams['filters[category][id][$eq]'] = category
      fallbackParams['filters[category][isActive][$eq]'] = true
    }

    if (keyword) {
      fallbackParams['filters[$or][0][name][$containsi]'] = keyword
      fallbackParams['filters[$or][1][code][$containsi]'] = keyword
    }

    const fallback = await api.get('/service-items', { params: fallbackParams })
    return fallback.data
  }
}
