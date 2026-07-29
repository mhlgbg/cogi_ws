import api from '../../../api/axios'

function normalizeTenantCode(tenantCode) {
  return String(tenantCode || '').trim()
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
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

export async function getPublicRegistrationCampaign(campaignCode, tenantCode) {
  const response = await api.get(`/public/registration-campaigns/${encodeURIComponent(String(campaignCode || '').trim())}`, withTenantHeaders({}, tenantCode))
  return response?.data?.data || null
}

export async function submitPublicRegistration(campaignCode, payload, tenantCode) {
  const response = await api.post(`/public/registration-campaigns/${encodeURIComponent(String(campaignCode || '').trim())}/register`, payload, withTenantHeaders({}, tenantCode))
  return response?.data || null
}

export async function resendPublicRegistrationVerification(payload, tenantCode) {
  const response = await api.post('/public/campaign-registrations/resend-verification', payload, withTenantHeaders({}, tenantCode))
  return response?.data || null
}

export async function changePublicRegistrationEmail(payload, tenantCode) {
  const response = await api.post('/public/campaign-registrations/change-email', payload, withTenantHeaders({}, tenantCode))
  return response?.data || null
}

export async function verifyPublicRegistration(token, tenantCode) {
  const response = await api.get('/public/campaign-registrations/verify', withTenantHeaders({ params: { token, redirect: 0 } }, tenantCode))
  return response?.data || null
}

export async function completePublicRegistrationAccount(payload, tenantCode) {
  const response = await api.post('/public/campaign-registrations/complete-account', payload, withTenantHeaders({}, tenantCode))
  return response?.data || null
}

export async function completePublicRegistration(payload, tenantCode) {
  const response = await api.post('/public/campaign-registrations/complete', payload, withTenantHeaders({}, tenantCode))
  return response?.data || null
}

export { getApiMessage }