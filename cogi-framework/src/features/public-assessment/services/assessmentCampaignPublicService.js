import publicApi from '../../../api/publicAxios'

function normalizeTenantCode(tenantCode) {
  return String(tenantCode || '').trim()
}

function withTenantHeaders(config = {}, tenantCode = '') {
  const normalizedTenantCode = normalizeTenantCode(tenantCode)
  if (!normalizedTenantCode) return config
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      'x-tenant-code': normalizedTenantCode,
    },
  }
}

function withPublicAccessHeaders(config = {}, tenantCode = '', publicAccessToken = '') {
  const nextConfig = withTenantHeaders(config, tenantCode)
  const normalizedToken = String(publicAccessToken || '').trim()
  if (!normalizedToken) return nextConfig
  return {
    ...nextConfig,
    headers: {
      ...(nextConfig.headers || {}),
      'x-assessment-public-token': normalizedToken,
    },
  }
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data
  return payload
}

function ensureMatchedPayload(payload) {
  const normalized = unwrapSuccess(payload)
  const status = String(normalized?.status || '').trim()
  if (!status || status === 'MATCHED') return normalized
  const error = new Error(status)
  error.payload = normalized
  throw error
}

export async function getPublicAssessmentCampaign(slug, tenantCode) {
  const response = await publicApi.get(`/public/assessment-campaigns/${encodeURIComponent(String(slug || '').trim())}`, withTenantHeaders({}, tenantCode))
  return unwrapSuccess(response?.data)
}

export async function resolvePublicAssessmentCampaign(slug, payload, tenantCode) {
  const response = await publicApi.post(`/public/assessment-campaigns/${encodeURIComponent(String(slug || '').trim())}/resolve`, payload, withTenantHeaders({}, tenantCode))
  return ensureMatchedPayload(response?.data)
}

export async function requestAssessmentCampaignOtp(slug, payload, tenantCode) {
  const response = await publicApi.post(`/public/assessment-campaigns/${encodeURIComponent(String(slug || '').trim())}/request-otp`, payload, withTenantHeaders({}, tenantCode))
  return unwrapSuccess(response?.data)
}

export async function verifyAssessmentCampaignOtp(slug, payload, tenantCode) {
  const response = await publicApi.post(`/public/assessment-campaigns/${encodeURIComponent(String(slug || '').trim())}/verify-otp`, payload, withTenantHeaders({}, tenantCode))
  return unwrapSuccess(response?.data)
}

export async function startPublicAssessmentCampaign(slug, payload, tenantCode) {
  const response = await publicApi.post(`/public/assessment-campaigns/${encodeURIComponent(String(slug || '').trim())}/start`, payload, withTenantHeaders({}, tenantCode))
  return ensureMatchedPayload(response?.data)
}

export async function recoverPublicAssessmentCampaignParticipations(slug, payload, tenantCode) {
  const response = await publicApi.post(`/public/assessment-campaigns/${encodeURIComponent(String(slug || '').trim())}/recover`, payload, withTenantHeaders({}, tenantCode))
  return unwrapSuccess(response?.data)
}

export async function restorePublicAssessmentAttemptAccess(attemptId, payload, tenantCode) {
  const response = await publicApi.post(`/public/assessment-campaigns/attempts/${encodeURIComponent(String(attemptId || '').trim())}/restore-access`, payload, withTenantHeaders({}, tenantCode))
  return unwrapSuccess(response?.data)
}

export async function startPublicAssessmentCampaignRetake(attemptId, tenantCode, publicAccessToken) {
  const response = await publicApi.post(`/public/assessment-campaigns/attempts/${encodeURIComponent(String(attemptId || '').trim())}/start-retake`, {}, withPublicAccessHeaders({}, tenantCode, publicAccessToken))
  return unwrapSuccess(response?.data)
}

export async function getAssessmentCampaignResultGate(attemptId, tenantCode, publicAccessToken) {
  const response = await publicApi.get(`/public/assessment-campaigns/attempts/${encodeURIComponent(String(attemptId || '').trim())}/result-gate`, withPublicAccessHeaders({}, tenantCode, publicAccessToken))
  return unwrapSuccess(response?.data)
}

export async function completeAssessmentCampaignResultProfile(attemptId, payload, tenantCode, publicAccessToken) {
  const response = await publicApi.post(`/public/assessment-campaigns/attempts/${encodeURIComponent(String(attemptId || '').trim())}/complete-result-profile`, payload, withPublicAccessHeaders({}, tenantCode, publicAccessToken))
  return unwrapSuccess(response?.data)
}
