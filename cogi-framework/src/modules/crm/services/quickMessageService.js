import api from '../../../api/axios'

function unwrapPayload(payload) {
  if (payload && typeof payload === 'object') {
    return payload
  }
  return {}
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function listQuickMessages(params = {}) {
  const response = await api.get('/quick-messages/manage', { params })
  const payload = unwrapPayload(response.data)
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    pagination: payload?.pagination || null,
  }
}

export async function getQuickMessage(id) {
  const response = await api.get(`/quick-messages/manage/${encodeURIComponent(id)}`)
  const payload = unwrapPayload(response.data)
  return payload?.data || null
}

export async function createQuickMessage(payload) {
  const response = await api.post('/quick-messages/manage', payload)
  return unwrapPayload(response.data)?.data || null
}

export async function updateQuickMessage(id, payload) {
  const response = await api.put(`/quick-messages/manage/${encodeURIComponent(id)}`, payload)
  return unwrapPayload(response.data)?.data || null
}

export async function lockQuickMessage(id) {
  const response = await api.post(`/quick-messages/manage/${encodeURIComponent(id)}/lock`)
  return unwrapPayload(response.data)?.data || null
}

export async function unlockQuickMessage(id, payload = {}) {
  const response = await api.post(`/quick-messages/manage/${encodeURIComponent(id)}/unlock`, payload)
  return unwrapPayload(response.data)?.data || null
}

export async function cancelQuickMessage(id) {
  const response = await api.post(`/quick-messages/manage/${encodeURIComponent(id)}/cancel`)
  return unwrapPayload(response.data)?.data || null
}

export async function createQuickMessageAccess(messageId, payload) {
  const response = await api.post(`/quick-messages/manage/${encodeURIComponent(messageId)}/accesses`, payload)
  return unwrapPayload(response.data)?.data || null
}

export async function updateQuickMessageAccess(accessId, payload) {
  const response = await api.put(`/quick-message-accesses/manage/${encodeURIComponent(accessId)}`, payload)
  return unwrapPayload(response.data)?.data || null
}

export async function enableQuickMessageAccessPin(accessId, pin) {
  const response = await api.post(`/quick-message-accesses/manage/${encodeURIComponent(accessId)}/enable-pin`, { pin })
  return unwrapPayload(response.data)?.data || null
}

export async function changeQuickMessageAccessPin(accessId, pin) {
  const response = await api.post(`/quick-message-accesses/manage/${encodeURIComponent(accessId)}/change-pin`, { pin })
  return unwrapPayload(response.data)?.data || null
}

export async function disableQuickMessageAccessPin(accessId) {
  const response = await api.post(`/quick-message-accesses/manage/${encodeURIComponent(accessId)}/disable-pin`)
  return unwrapPayload(response.data)?.data || null
}

export async function lockQuickMessageAccess(accessId) {
  const response = await api.post(`/quick-message-accesses/manage/${encodeURIComponent(accessId)}/lock`)
  return unwrapPayload(response.data)?.data || null
}

export async function unlockQuickMessageAccess(accessId, payload = {}) {
  const response = await api.post(`/quick-message-accesses/manage/${encodeURIComponent(accessId)}/unlock`, payload)
  return unwrapPayload(response.data)?.data || null
}

export async function cancelQuickMessageAccess(accessId) {
  const response = await api.post(`/quick-message-accesses/manage/${encodeURIComponent(accessId)}/cancel`)
  return unwrapPayload(response.data)?.data || null
}

export async function cloneQuickMessageAccessBatch(accessId, payload) {
  const response = await api.post(`/quick-message-accesses/manage/${encodeURIComponent(accessId)}/clone-batch`, payload)
  return unwrapPayload(response.data)?.data || null
}

export async function listQuickMessageActivityAccesses(messageId, params = {}) {
  const response = await api.get(`/quick-messages/manage/${encodeURIComponent(messageId)}/activity/accesses`, { params })
  const payload = unwrapPayload(response.data)
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    message: payload?.message || null,
    pagination: payload?.pagination || null,
  }
}

export async function getQuickMessageActivityAccessDetail(messageId, accessId) {
  const response = await api.get(`/quick-messages/manage/${encodeURIComponent(messageId)}/activity/accesses/${encodeURIComponent(accessId)}`)
  return unwrapPayload(response.data)?.data || null
}

export async function listQuickMessageActivityMessages(messageId, accessId, params = {}) {
  const response = await api.get(`/quick-messages/manage/${encodeURIComponent(messageId)}/activity/accesses/${encodeURIComponent(accessId)}/messages`, { params })
  const payload = unwrapPayload(response.data)
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    pagination: payload?.pagination || null,
  }
}

export async function createQuickMessageActivityMessage(messageId, accessId, payload) {
  const response = await api.post(`/quick-messages/manage/${encodeURIComponent(messageId)}/activity/accesses/${encodeURIComponent(accessId)}/messages`, payload)
  return unwrapPayload(response.data)?.data || null
}

export async function markQuickMessageActivityRead(messageId, accessId) {
  const response = await api.post(`/quick-messages/manage/${encodeURIComponent(messageId)}/activity/accesses/${encodeURIComponent(accessId)}/read`, {})
  return unwrapPayload(response.data)?.data || null
}

export async function listQuickMessageActivityLogs(messageId, accessId, params = {}) {
  const response = await api.get(`/quick-messages/manage/${encodeURIComponent(messageId)}/activity/accesses/${encodeURIComponent(accessId)}/logs`, { params })
  const payload = unwrapPayload(response.data)
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    pagination: payload?.pagination || null,
  }
}