import api from '../../../api/axios'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function readFeeSheetStatus(raw) {
  return toText(raw?.feeSheetStatus || raw?.status) || 'draft'
}

function readFeeSheetClassStatus(raw) {
  return toText(raw?.feeSheetClassStatus || raw?.status) || 'draft'
}

function readFeeItemPaymentStatus(raw) {
  return toText(raw?.feeItemPaymentStatus || raw?.status) || 'unpaid'
}

function normalizeFeeSheet(raw) {
  if (!raw || typeof raw !== 'object') return null

  const feeSheetClasses = Array.isArray(raw.feeSheetClasses) ? raw.feeSheetClasses : []

  return {
    id: raw.id,
    name: toText(raw.name),
    fromDate: raw.fromDate || null,
    toDate: raw.toDate || null,
    feeSheetStatus: readFeeSheetStatus(raw),
    status: readFeeSheetStatus(raw),
    note: toText(raw.note),
    updatedAt: raw.updatedAt || null,
    feeSheetClasses: feeSheetClasses.map((item) => ({
      id: item.id,
      classNameSnapshot: toText(item.classNameSnapshot),
      teacherNameSnapshot: toText(item.teacherNameSnapshot),
      feeSheetClassStatus: readFeeSheetClassStatus(item),
      status: readFeeSheetClassStatus(item),
      feeItemsCount: Number(item.feeItemsCount || 0),
    })),
  }
}

function normalizeMyFeeSheetClass(raw) {
  if (!raw || typeof raw !== 'object') return null

  const feeItems = Array.isArray(raw.feeItems) ? raw.feeItems : []

  return {
    id: raw.id,
    feeSheetClassStatus: readFeeSheetClassStatus(raw),
    status: readFeeSheetClassStatus(raw),
    classNameSnapshot: toText(raw.classNameSnapshot),
    teacherNameSnapshot: toText(raw.teacherNameSnapshot),
    updatedAt: raw.updatedAt || null,
    canEdit: Boolean(raw.canEdit),
    feeItemsCount: Number(raw.feeItemsCount || feeItems.length || 0),
    feeSheet: raw.feeSheet && typeof raw.feeSheet === 'object'
      ? {
          id: raw.feeSheet.id,
          name: toText(raw.feeSheet.name),
          fromDate: raw.feeSheet.fromDate || null,
          toDate: raw.feeSheet.toDate || null,
          feeSheetStatus: readFeeSheetStatus(raw.feeSheet),
          status: readFeeSheetStatus(raw.feeSheet),
          note: toText(raw.feeSheet.note),
        }
      : null,
    feeItems: feeItems.map((item) => ({
      id: item.id,
      learnerCodeSnapshot: toText(item.learnerCodeSnapshot),
      learnerNameSnapshot: toText(item.learnerNameSnapshot),
      quantity: Number((item.quantity ?? item.sessions) || 0),
      sessions: Number((item.quantity ?? item.sessions) || 0),
      unitPrice: Number(item.unitPrice || 0),
      discountPercent: Number(item.discountPercent || 0),
      discountAmount: Number(item.discountAmount || 0),
      amount: Number(item.amount || 0),
      paidAmount: Number(item.paidAmount || 0),
      feeItemPaymentStatus: readFeeItemPaymentStatus(item),
      status: readFeeItemPaymentStatus(item),
      note: toText(item.note),
      updatedAt: item.updatedAt || null,
    })),
  }
}

function normalizeFeeSheetClass(raw) {
  if (!raw || typeof raw !== 'object') return null

  const feeItems = Array.isArray(raw.feeItems) ? raw.feeItems : []

  return {
    id: raw.id,
    feeSheetClassStatus: readFeeSheetClassStatus(raw),
    status: readFeeSheetClassStatus(raw),
    classNameSnapshot: toText(raw.classNameSnapshot),
    teacherNameSnapshot: toText(raw.teacherNameSnapshot),
    updatedAt: raw.updatedAt || null,
    feeItemsCount: Number(raw.feeItemsCount || feeItems.length || 0),
    feeSheet: raw.feeSheet && typeof raw.feeSheet === 'object'
      ? {
          id: raw.feeSheet.id,
          name: toText(raw.feeSheet.name),
          fromDate: raw.feeSheet.fromDate || null,
          toDate: raw.feeSheet.toDate || null,
          feeSheetStatus: readFeeSheetStatus(raw.feeSheet),
          status: readFeeSheetStatus(raw.feeSheet),
          note: toText(raw.feeSheet.note),
        }
      : null,
    feeItems: feeItems.map((item) => ({
      id: item.id,
      learnerCodeSnapshot: toText(item.learnerCodeSnapshot),
      learnerNameSnapshot: toText(item.learnerNameSnapshot),
      quantity: Number((item.quantity ?? item.sessions) || 0),
      sessions: Number((item.quantity ?? item.sessions) || 0),
      unitPrice: Number(item.unitPrice || 0),
      discountPercent: Number(item.discountPercent || 0),
      discountAmount: Number(item.discountAmount || 0),
      amount: Number(item.amount || 0),
      paidAmount: Number(item.paidAmount || 0),
      remaining: Math.max(0, Number(item.amount || 0) - Number(item.paidAmount || 0)),
      feeItemPaymentStatus: readFeeItemPaymentStatus(item),
      status: readFeeItemPaymentStatus(item),
      note: toText(item.note),
      updatedAt: item.updatedAt || null,
    })),
  }
}

function parseCollection(response) {
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

function parseSingle(response) {
  return response?.data?.data || null
}

function parsePagination(response) {
  return response?.data?.meta?.pagination || {
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  }
}

export async function getFeeSheetPage({ page = 1, pageSize = 10, q = '' } = {}) {
  const response = await api.get('/fee-sheets', {
    params: {
      'pagination[page]': page,
      'pagination[pageSize]': pageSize,
      q: String(q || '').trim(),
      populate: '*',
    },
  })

  return {
    rows: parseCollection(response).map(normalizeFeeSheet).filter(Boolean),
    pagination: parsePagination(response),
  }
}

export async function getFeeSheetById(id) {
  const response = await api.get(`/fee-sheets/${id}`, {
    params: { populate: '*' },
  })
  return normalizeFeeSheet(parseSingle(response))
}

export async function getFeeSheetClassById(id) {
  const response = await api.get(`/fee-sheet-classes/${id}`)
  return normalizeFeeSheetClass(parseSingle(response))
}

export async function getFeeSheetFormOptions() {
  const response = await api.get('/fee-sheets/form-options')
  return {
    classes: Array.isArray(response?.data?.data?.classes) ? response.data.data.classes : [],
  }
}

export async function createFeeSheet(payload) {
  const data = payload?.status && !payload?.feeSheetStatus
    ? { ...payload, feeSheetStatus: payload.status }
    : payload

  const response = await api.post('/fee-sheets', { data })
  return normalizeFeeSheet(parseSingle(response))
}

export async function updateFeeSheet(id, payload) {
  const data = payload?.status && !payload?.feeSheetStatus
    ? { ...payload, feeSheetStatus: payload.status }
    : payload

  const response = await api.put(`/fee-sheets/${id}`, { data })
  return normalizeFeeSheet(parseSingle(response))
}

export async function generateFeeSheet(id, payload) {
  const response = await api.post(`/fee-sheets/${id}/generate`, payload)
  return response?.data?.data || null
}

export async function getMyFeeSheetClassPage({ page = 1, pageSize = 10, q = '', status = '' } = {}) {
  const normalizedStatus = String(status || '').trim()
  const response = await api.get('/my-fee-sheet-classes', {
    params: {
      'pagination[page]': page,
      'pagination[pageSize]': pageSize,
      q: String(q || '').trim(),
      feeSheetClassStatus: normalizedStatus,
      status: normalizedStatus,
    },
  })

  return {
    rows: parseCollection(response).map(normalizeMyFeeSheetClass).filter(Boolean),
    pagination: parsePagination(response),
  }
}

export async function getMyFeeSheetClassById(id) {
  const response = await api.get(`/my-fee-sheet-classes/${id}`)
  return normalizeMyFeeSheetClass(parseSingle(response))
}

export async function updateMyFeeItem(feeSheetClassId, feeItemId, payload) {
  const data = payload?.status && !payload?.feeItemPaymentStatus
    ? { ...payload, feeItemPaymentStatus: payload.status }
    : payload

  const response = await api.put(`/my-fee-sheet-classes/${feeSheetClassId}/fee-items/${feeItemId}`, { data })
  return response?.data?.data || null
}

export async function submitMyFeeSheetClass(id) {
  const response = await api.post(`/my-fee-sheet-classes/${id}/submit`)
  return normalizeMyFeeSheetClass(parseSingle(response))
}

function normalizeFeeItemRow(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    id: raw.id,
    learner: raw.learner && typeof raw.learner === 'object'
      ? {
          id: raw.learner.id,
          name: toText(raw.learner.name),
        }
      : { id: null, name: '' },
    class: raw.class && typeof raw.class === 'object'
      ? {
          id: raw.class.id,
          name: toText(raw.class.name),
        }
      : { id: null, name: '' },
    quantity: Number(raw.quantity || 0),
    unitPrice: Number(raw.unitPrice || 0),
    amount: Number(raw.amount || 0),
    paidAmount: Number(raw.paidAmount || 0),
    remaining: Number(raw.remaining || 0),
    feeItemPaymentStatus: readFeeItemPaymentStatus(raw),
    status: readFeeItemPaymentStatus(raw),
  }
}

export async function getFeeItemListing({ feeSheetId, keyword = '', classId = '', status = '', page = 1, pageSize = 20 } = {}) {
  const normalizedStatus = String(status || '').trim()
  const response = await api.get('/fee-items/listing', {
    params: {
      feeSheetId,
      keyword: String(keyword || '').trim(),
      classId: classId || undefined,
      feeItemPaymentStatus: normalizedStatus,
      status: normalizedStatus,
      page,
      pageSize,
    },
  })

  return {
    rows: (Array.isArray(response?.data?.data) ? response.data.data : []).map(normalizeFeeItemRow).filter(Boolean),
    pagination: response?.data?.pagination || { page: 1, pageSize, total: 0 },
    summary: response?.data?.summary || { totalAmount: 0, totalPaid: 0, totalRemaining: 0 },
  }
}