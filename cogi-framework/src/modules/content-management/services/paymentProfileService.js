import api from '../../../api/axios'
import { uploadTenantWebsiteMedia } from './tenantWebsiteSettingsService'
import { normalizePaymentProfile, normalizePaymentProfileCollection, normalizePagination } from '../utils/paymentProfileUi'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) return payload.data
  return payload?.data !== undefined ? payload.data : payload
}

function buildListParams({ page = 1, pageSize = 10, search = '', paymentMethod = '', isActive = '', isDefault = '' } = {}) {
  const params = { page, pageSize }
  if (String(search || '').trim()) params.search = String(search || '').trim()
  if (paymentMethod) params.paymentMethod = paymentMethod
  if (isActive !== '') params.isActive = isActive
  if (isDefault !== '') params.isDefault = isDefault
  return params
}

export async function listPaymentProfiles(params = {}) {
  const response = await api.get('/tenant/settings/payment-profiles', { params: buildListParams(params) })
  return {
    rows: normalizePaymentProfileCollection(response.data),
    pagination: normalizePagination(response.data),
  }
}

export async function getPaymentProfile(id) {
  const response = await api.get(`/tenant/settings/payment-profiles/${id}`)
  return normalizePaymentProfile(unwrapSuccess(response.data))
}

export async function createPaymentProfile(payload) {
  const response = await api.post('/tenant/settings/payment-profiles', { data: payload })
  return normalizePaymentProfile(unwrapSuccess(response.data))
}

export async function updatePaymentProfile(id, payload) {
  const response = await api.put(`/tenant/settings/payment-profiles/${id}`, { data: payload })
  return normalizePaymentProfile(unwrapSuccess(response.data))
}

export async function setDefaultPaymentProfile(id) {
  const response = await api.post(`/tenant/settings/payment-profiles/${id}/set-default`, {})
  return normalizePaymentProfile(unwrapSuccess(response.data))
}

export async function activatePaymentProfile(id) {
  const response = await api.post(`/tenant/settings/payment-profiles/${id}/activate`, {})
  return normalizePaymentProfile(unwrapSuccess(response.data))
}

export async function deactivatePaymentProfile(id) {
  const response = await api.post(`/tenant/settings/payment-profiles/${id}/deactivate`, {})
  return normalizePaymentProfile(unwrapSuccess(response.data))
}

export async function uploadPaymentProfileQrImage(file) {
  return uploadTenantWebsiteMedia(file)
}