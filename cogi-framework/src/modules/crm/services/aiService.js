import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

export async function getAiAssistant() {
  const res = await api.get('/ai/assistant')
  return unwrapSuccess(res.data)
}

export async function saveAiAssistant(payload) {
  const res = await api.put('/ai/assistant', payload)
  return unwrapSuccess(res.data)
}

export async function testAiAssistant() {
  const res = await api.post('/ai/assistant/test')
  return res.data
}

export async function getAiKnowledgeList(params = {}) {
  const res = await api.get('/ai/knowledge', { params })
  return unwrapSuccess(res.data)
}

export async function getAiKnowledgeDetail(id) {
  const res = await api.get(`/ai/knowledge/${id}`)
  return unwrapSuccess(res.data)
}

export async function createAiKnowledge(payload) {
  const res = await api.post('/ai/knowledge', payload)
  return unwrapSuccess(res.data)
}

export async function updateAiKnowledge(id, payload) {
  const res = await api.put(`/ai/knowledge/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function deleteAiKnowledge(id) {
  const res = await api.delete(`/ai/knowledge/${id}`)
  return unwrapSuccess(res.data)
}