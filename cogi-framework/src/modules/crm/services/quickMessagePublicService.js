import publicApi from '../../../api/publicAxios'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function normalizeQuickMessageCode(value) {
  return toText(value).toUpperCase()
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export function getApiErrorCode(error) {
  return toText(error?.response?.data?.error?.code || error?.response?.data?.code || '')
}

export async function lookupQuickMessage(code) {
  const normalizedCode = normalizeQuickMessageCode(code)
  const response = await publicApi.get(`/quick-messages/public/${encodeURIComponent(normalizedCode)}`)
  return response?.data?.data || null
}

export async function verifyQuickMessagePin(code, pin) {
  const normalizedCode = normalizeQuickMessageCode(code)
  const response = await publicApi.post(`/quick-messages/public/${encodeURIComponent(normalizedCode)}/verify-pin`, { pin })
  return response?.data?.data || null
}

export async function requestQuickMessageAccess(code) {
  const normalizedCode = normalizeQuickMessageCode(code)
  const response = await publicApi.post(`/quick-messages/public/${encodeURIComponent(normalizedCode)}/access`, {})
  return response?.data?.data || null
}

export async function openQuickMessage(code, accessToken) {
  const normalizedCode = normalizeQuickMessageCode(code)
  const response = await publicApi.post(
    `/quick-messages/public/${encodeURIComponent(normalizedCode)}/open`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )
  return response?.data?.data || null
}

function buildPublicAuthHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

export async function getQuickMessagePublicMessages(code, accessToken, params = {}) {
  const normalizedCode = normalizeQuickMessageCode(code)
  const response = await publicApi.get(
    `/quick-messages/public/${encodeURIComponent(normalizedCode)}/messages`,
    {
      params,
      headers: buildPublicAuthHeaders(accessToken),
    },
  )
  return response?.data?.data || null
}

export async function sendQuickMessagePublicReply(code, accessToken, payload) {
  const normalizedCode = normalizeQuickMessageCode(code)
  const response = await publicApi.post(
    `/quick-messages/public/${encodeURIComponent(normalizedCode)}/messages`,
    payload,
    {
      headers: buildPublicAuthHeaders(accessToken),
    },
  )
  return response?.data?.data || null
}

export async function markQuickMessagePublicMessagesRead(code, accessToken) {
  const normalizedCode = normalizeQuickMessageCode(code)
  const response = await publicApi.post(
    `/quick-messages/public/${encodeURIComponent(normalizedCode)}/messages/read`,
    {},
    {
      headers: buildPublicAuthHeaders(accessToken),
    },
  )
  return response?.data?.data || null
}