import api from '../../../api/axios'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function parseCollection(response) {
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

function parseSingle(response) {
  return response?.data?.data || null
}

function parsePagination(response) {
  return response?.data?.meta?.pagination || { page: 1, pageSize: 10, pageCount: 1, total: 0 }
}

export async function getLuckyWheels({ page = 1, pageSize = 10, q = '', status = '' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    q: String(q || '').trim(),
    status: String(status || '').trim(),
    'sort[0]': 'createdAt:desc',
  }

  const response = await api.get('/lucky-wheels', { params })
  const rows = parseCollection(response).map((raw) => {
    const attrs = raw.attributes || raw
    return {
      id: raw.id,
      name: toText(attrs.name),
      code: toText(attrs.code),
      description: toText(attrs.description),
      status: toText(attrs.status),
      startAt: attrs.startAt || null,
      endAt: attrs.endAt || null,
      participantCount: attrs.participantCount || 0,
      spinCount: attrs.spinCount || 0,
      claimedCount: attrs.claimedCount || 0,
      createdAt: attrs.createdAt || null,
    }
  })

  return { rows, pagination: parsePagination(response) }
}

export async function createLuckyWheel(payload) {
  const data = { ...payload }
  // Strapi admin service expects top-level fields (not wrapped in { data })
  const response = await api.post('/lucky-wheels', data)
  const raw = parseSingle(response)
  return raw
}

export async function getLuckyWheel(id) {
  const response = await api.get(`/lucky-wheels/${id}`)
  const raw = parseSingle(response)
  if (!raw) return null
  const attrs = raw.attributes || raw
  return {
    id: raw.id || attrs.id,
    name: toText(attrs.name),
    code: toText(attrs.code),
    description: toText(attrs.description),
    status: toText(attrs.status),
    startAt: attrs.startAt || null,
    endAt: attrs.endAt || null,
    participationMode: attrs.participationMode || null,
    openedAt: attrs.openedAt || null,
    closedAt: attrs.closedAt || null,
    cancelledAt: attrs.cancelledAt || null,
    publicMessage: attrs.publicMessage || null,
    resultNotice: attrs.resultNotice || null,
    participantFormConfig: attrs.participantFormConfig || null,
    maxParticipants: attrs.maxParticipants || null,
  }
}

export async function getPublicLuckyWheel(code) {
  const response = await api.get(`/public/lucky-wheels/${encodeURIComponent(code)}`)
  return response?.data?.data || null
}

export async function lookupPublicParticipant(code, payload) {
  const response = await api.post(`/public/lucky-wheels/${encodeURIComponent(code)}/participants/lookup`, payload)
  return response?.data || null
}

export async function preparePublicParticipant(code, payload) {
  const response = await api.post(`/public/lucky-wheels/${encodeURIComponent(code)}/participants/prepare`, payload)
  return response?.data || null
}

export async function spinPublic(code, payload) {
  const response = await api.post(`/public/lucky-wheels/${encodeURIComponent(code)}/spin`, payload)
  return response?.data || null
}

export async function spinLuckyWheel(code, payload) {
  return spinPublic(code, payload)
}

export async function getLuckyWheelPrizes(wheelId) {
  const response = await api.get(`/lucky-wheels/${wheelId}/prizes`)
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

export async function getLuckyWheelParticipants(wheelId, { page = 1, pageSize = 10, search = '', status = '', source = '', sort = 'createdAt:desc' } = {}) {
  const params = { page, pageSize, search: String(search || '').trim(), status: String(status || '').trim(), source: String(source || '').trim(), sort: String(sort || 'createdAt:desc') }
  const response = await api.get(`/lucky-wheels/${wheelId}/participants`, { params })
  return response?.data || null
}

export async function getLuckyWheelResults(wheelId, { page = 1, pageSize = 10, search = '', resultType = '', status = '', prizeId = '', claimStatus = '', dateFrom = '', dateTo = '', sort = 'spunAt:desc' } = {}) {
  const params = { page, pageSize, search: String(search || '').trim(), resultType: String(resultType || '').trim(), status: String(status || '').trim(), prizeId: String(prizeId || '').trim(), claimStatus: String(claimStatus || '').trim(), dateFrom: dateFrom || '', dateTo: dateTo || '', sort: String(sort || 'spunAt:desc') }
  const response = await api.get(`/lucky-wheels/${wheelId}/results`, { params })
  return response?.data || null
}

export async function getLuckyWheelResultDetail(wheelId, spinId) {
  const response = await api.get(`/lucky-wheels/${wheelId}/results/${spinId}`)
  return response?.data || null
}

export async function verifyLuckyWheelResult(wheelId, verificationCode) {
  const normalizedCode = String(verificationCode || '').trim().toUpperCase()
  const response = await api.get(`/lucky-wheels/${wheelId}/results/verify/${encodeURIComponent(normalizedCode)}`)
  return response?.data || null
}

export async function getLuckyWheelPresentation(wheelId) {
  const response = await api.get(`/lucky-wheels/${wheelId}/presentation`)
  return response?.data || null
}

export async function getLuckyWheelPresentationStatus(wheelId) {
  const response = await api.get(`/lucky-wheels/${wheelId}/presentation/status`)
  return response?.data || null
}

export async function getLuckyWheelPresentationEligibleParticipants(wheelId, params = {}) {
  const response = await api.get(`/lucky-wheels/${wheelId}/presentation/eligible-participants`, { params })
  return response?.data || null
}

export async function spinPresentationParticipant(wheelId, payload) {
  const response = await api.post(`/lucky-wheels/${wheelId}/presentation/spin-for-participant`, payload)
  return response?.data || null
}

export async function claimLuckyWheelResult(wheelId, spinId, payload) {
  const response = await api.post(`/lucky-wheels/${wheelId}/results/${spinId}/claim`, payload)
  return response?.data || null
}

export async function previewImportParticipants(wheelId, rows) {
  const response = await api.post(`/lucky-wheels/${wheelId}/participants/import-preview`, { rows })
  return response?.data || null
}

export async function importParticipants(wheelId, rows) {
  const response = await api.post(`/lucky-wheels/${wheelId}/participants/import`, { rows })
  return response?.data || null
}

export async function exportParticipants(wheelId, params = {}) {
  const response = await api.get(`/lucky-wheels/${wheelId}/participants/export`, { params, responseType: 'blob' })
  return response
}

export async function exportResults(wheelId, params = {}) {
  const response = await api.get(`/lucky-wheels/${wheelId}/results/export`, { params, responseType: 'blob' })
  return response
}

export async function createLuckyWheelParticipant(wheelId, payload) {
  const response = await api.post(`/lucky-wheels/${wheelId}/participants`, payload)
  return response?.data || null
}

export async function generateLuckyWheelParticipantCodes(wheelId, payload) {
  const response = await api.post(`/lucky-wheels/${wheelId}/participants/generate-codes`, payload)
  return response?.data || null
}

export async function updateLuckyWheelParticipant(wheelId, participantId, payload) {
  const response = await api.put(`/lucky-wheels/${wheelId}/participants/${participantId}`, payload)
  return response?.data || null
}

export async function blockLuckyWheelParticipant(wheelId, participantId) {
  const response = await api.post(`/lucky-wheels/${wheelId}/participants/${participantId}/block`)
  return response?.data || null
}

export async function unblockLuckyWheelParticipant(wheelId, participantId) {
  const response = await api.post(`/lucky-wheels/${wheelId}/participants/${participantId}/unblock`)
  return response?.data || null
}

export async function createLuckyWheelPrize(wheelId, payload) {
  const response = await api.post(`/lucky-wheels/${wheelId}/prizes`, payload)
  return response?.data?.data || null
}

export async function updateLuckyWheelPrize(wheelId, prizeId, payload) {
  const response = await api.put(`/lucky-wheels/${wheelId}/prizes/${prizeId}`, payload)
  return response?.data?.data || null
}

export async function adjustLuckyWheelPrizeQuantity(wheelId, prizeId, newQuantity, reason) {
  const response = await api.post(`/lucky-wheels/${wheelId}/prizes/${prizeId}/adjust-quantity`, { newQuantity, reason })
  return response?.data?.data || null
}

export async function toggleLuckyWheelPrizeActive(wheelId, prizeId) {
  const response = await api.post(`/lucky-wheels/${wheelId}/prizes/${prizeId}/toggle-active`)
  return response?.data?.data || null
}

export async function updateLuckyWheel(id, payload) {
  // Send top-level payload to match backend expectation
  const response = await api.put(`/lucky-wheels/${id}`, payload)
  const raw = parseSingle(response)
  if (!raw) return null
  const attrs = raw.attributes || raw
  return {
    id: raw.id || attrs.id,
    name: toText(attrs.name),
    code: toText(attrs.code),
    description: toText(attrs.description),
    status: toText(attrs.status),
    startAt: attrs.startAt || null,
    endAt: attrs.endAt || null,
    participationMode: attrs.participationMode || null,
    openedAt: attrs.openedAt || null,
    closedAt: attrs.closedAt || null,
    cancelledAt: attrs.cancelledAt || null,
    publicMessage: attrs.publicMessage || null,
    resultNotice: attrs.resultNotice || null,
    participantFormConfig: attrs.participantFormConfig || null,
    maxParticipants: attrs.maxParticipants || null,
  }
}

export async function openLuckyWheel(id) {
  const response = await api.post(`/lucky-wheels/${id}/open`)
  return response?.data?.data || null
}

export async function closeLuckyWheel(id) {
  const response = await api.post(`/lucky-wheels/${id}/close`)
  return response?.data?.data || null
}

export async function cancelLuckyWheel(id, reason) {
  const response = await api.post(`/lucky-wheels/${id}/cancel`, { reason })
  return response?.data?.data || null
}

export default {
  getLuckyWheels,
  createLuckyWheel,
  getLuckyWheel,
  getLuckyWheelParticipants,
  getLuckyWheelResults,
  getLuckyWheelPresentation,
  getLuckyWheelPresentationStatus,
  getLuckyWheelPresentationEligibleParticipants,
  getLuckyWheelPrizes,
  spinLuckyWheel,
  spinPresentationParticipant,
  getLuckyWheelResultDetail,
  verifyLuckyWheelResult,
  claimLuckyWheelResult,
  exportParticipants,
  exportResults,
  getPublicLuckyWheel,
  updateLuckyWheel,
  openLuckyWheel,
  closeLuckyWheel,
  cancelLuckyWheel,
}
