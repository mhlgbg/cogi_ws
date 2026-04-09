import api from '../../../api/axios'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function readFeeItemPaymentStatus(raw) {
  return toText(raw?.feeItemPaymentStatus || raw?.status) || 'unpaid'
}

function normalizePaymentRow(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    id: raw.id,
    learner: raw.learner && typeof raw.learner === 'object'
      ? { id: raw.learner.id, name: toText(raw.learner.name) }
      : { id: null, name: '' },
    amount: Number(raw.amount || 0),
    paymentDate: raw.paymentDate || null,
    method: toText(raw.method) || 'cash',
    note: toText(raw.note),
    allocationCount: Number(raw.allocationCount || 0),
    allocatedAmount: Number(raw.allocatedAmount || 0),
    unallocatedAmount: Number(raw.unallocatedAmount || 0),
  }
}

function normalizeAllocationRow(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    id: raw.id,
    amount: Number(raw.amount || 0),
    feeItem: raw.feeItem && typeof raw.feeItem === 'object'
      ? {
          id: raw.feeItem.id,
          learnerName: toText(raw.feeItem.learnerName),
          className: toText(raw.feeItem.className),
          feeSheetName: toText(raw.feeItem.feeSheetName),
          feeItemAmount: Number(raw.feeItem.feeItemAmount || 0),
          feeItemPaidAmount: Number(raw.feeItem.feeItemPaidAmount || 0),
          feeItemRemaining: Number(raw.feeItem.feeItemRemaining || 0),
          feeItemPaymentStatus: readFeeItemPaymentStatus(raw.feeItem),
          status: readFeeItemPaymentStatus(raw.feeItem),
        }
      : null,
  }
}

function normalizePaymentDetail(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    id: raw.id,
    learner: raw.learner && typeof raw.learner === 'object'
      ? { id: raw.learner.id, name: toText(raw.learner.name) }
      : { id: null, name: '' },
    amount: Number(raw.amount || 0),
    paymentDate: raw.paymentDate || null,
    method: toText(raw.method) || 'cash',
    note: toText(raw.note),
    allocatedAmount: Number(raw.allocatedAmount || 0),
    unallocatedAmount: Number(raw.unallocatedAmount || 0),
    allocations: (Array.isArray(raw.allocations) ? raw.allocations : []).map(normalizeAllocationRow).filter(Boolean),
  }
}

export async function getPaymentTrackingPage({ page = 1, pageSize = 20, keyword = '', method = '', dateFrom = '', dateTo = '' } = {}) {
  const response = await api.get('/payments/tracking', {
    params: {
      page,
      pageSize,
      keyword: String(keyword || '').trim(),
      method: String(method || '').trim(),
      dateFrom: String(dateFrom || '').trim(),
      dateTo: String(dateTo || '').trim(),
    },
  })

  return {
    rows: (Array.isArray(response?.data?.data) ? response.data.data : []).map(normalizePaymentRow).filter(Boolean),
    pagination: response?.data?.pagination || { page: 1, pageSize, total: 0 },
    summary: response?.data?.summary || { totalAmount: 0, totalAllocated: 0, totalUnallocated: 0 },
  }
}

export async function getPaymentTrackingById(id) {
  const response = await api.get(`/payments/tracking/${id}`)
  return normalizePaymentDetail(response?.data?.data || null)
}