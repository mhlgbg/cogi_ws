import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

export async function getChatSessions(params = {}) {
  const res = await api.get('/chat-sessions', { params })
  return unwrapSuccess(res.data)
}

export async function getChatSessionDetail(id) {
  const res = await api.get(`/chat-sessions/${id}`)
  return unwrapSuccess(res.data)
}

export async function updateChatSession(id, payload = {}) {
  const res = await api.patch(`/chat-sessions/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function sendChatSessionAdminReply(id, payload = {}) {
  const res = await api.post(`/chat-sessions/${id}/admin-reply`, payload)
  return unwrapSuccess(res.data)
}
