import api from '../../../api/axios'
import { normalizeCollectionData, normalizePagination } from '../utils/registrationCampaignUi'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

export async function getRegistrationCampaignFormOptions() {
  const response = await api.get('/registration-campaigns/form-options')
  return unwrapSuccess(response.data)
}

export async function getRegistrationCampaigns(params = {}) {
  const response = await api.get('/registration-campaigns', { params })
  const data = unwrapSuccess(response.data) || {}
  return {
    rows: normalizeCollectionData(data),
    pagination: normalizePagination(data),
  }
}

export async function createRegistrationCampaign(payload) {
  const response = await api.post('/registration-campaigns', payload)
  return unwrapSuccess(response.data)
}

export async function getRegistrationCampaign(id) {
  const response = await api.get(`/registration-campaigns/${id}`)
  return unwrapSuccess(response.data)
}

export async function updateRegistrationCampaignBasicInfo(id, payload) {
  const response = await api.put(`/registration-campaigns/${id}`, payload)
  return unwrapSuccess(response.data)
}

export async function updateRegistrationCampaignConfig(id, payload) {
  const response = await api.put(`/registration-campaigns/${id}/config`, payload)
  return unwrapSuccess(response.data)
}

export async function updateRegistrationCampaignForm(id, payload) {
  const response = await api.put(`/registration-campaigns/${id}/form`, payload)
  return unwrapSuccess(response.data)
}

export async function openRegistrationCampaign(id, payload = {}) {
  const response = await api.post(`/registration-campaigns/${id}/open`, payload)
  return unwrapSuccess(response.data)
}

export async function pauseRegistrationCampaign(id, payload = {}) {
  const response = await api.post(`/registration-campaigns/${id}/pause`, payload)
  return unwrapSuccess(response.data)
}

export async function closeRegistrationCampaign(id, payload = {}) {
  const response = await api.post(`/registration-campaigns/${id}/close`, payload)
  return unwrapSuccess(response.data)
}

export async function cancelRegistrationCampaign(id, payload = {}) {
  const response = await api.post(`/registration-campaigns/${id}/cancel`, payload)
  return unwrapSuccess(response.data)
}

export async function getCampaignRegistrations(campaignId, params = {}) {
  const response = await api.get(`/registration-campaigns/${campaignId}/registrations`, { params })
  const data = unwrapSuccess(response.data) || {}
  return {
    rows: normalizeCollectionData(data),
    pagination: normalizePagination(data),
  }
}

export async function getCampaignRegistrationDetail(campaignId, registrationId) {
  const response = await api.get(`/registration-campaigns/${campaignId}/registrations/${registrationId}`)
  return unwrapSuccess(response.data)
}

export async function resendCampaignRegistrationVerification(campaignId, registrationId) {
  const response = await api.post(`/registration-campaigns/${campaignId}/registrations/${registrationId}/resend-verification`)
  return response.data || null
}

export async function resendCampaignRegistrationCompletionEmail(campaignId, registrationId) {
  const response = await api.post(`/registration-campaigns/${campaignId}/registrations/${registrationId}/resend-completion-email`)
  return response.data || null
}

export async function resendCampaignRegistrationRejectionEmail(campaignId, registrationId) {
  const response = await api.post(`/registration-campaigns/${campaignId}/registrations/${registrationId}/resend-rejection-email`)
  return response.data || null
}

export async function changeCampaignRegistrationEmail(campaignId, registrationId, payload) {
  const response = await api.post(`/registration-campaigns/${campaignId}/registrations/${registrationId}/change-email`, payload)
  return response.data || null
}

export async function approveCampaignRegistration(registrationId) {
  const response = await api.post(`/registration-campaigns/registrations/${registrationId}/approve`)
  return response.data || null
}

export async function rejectCampaignRegistration(registrationId, payload = {}) {
  const response = await api.post(`/registration-campaigns/registrations/${registrationId}/reject`, payload)
  return response.data || null
}

export async function cancelCampaignRegistration(registrationId, payload = {}) {
  const response = await api.post(`/registration-campaigns/registrations/${registrationId}/cancel`, payload)
  return response.data || null
}

export async function retryCompleteCampaignRegistration(registrationId) {
  const response = await api.post(`/registration-campaigns/registrations/${registrationId}/retry-complete`)
  return response.data || null
}

export async function getCampaignEmails(campaignId, params = {}) {
  const response = await api.get(`/registration-campaigns/${campaignId}/emails`, { params })
  const data = unwrapSuccess(response.data) || {}
  return {
    rows: normalizeCollectionData(data),
    pagination: normalizePagination(data),
  }
}

export async function getCampaignEmailTemplateOptions(campaignId, params = {}) {
  const response = await api.get(`/registration-campaigns/${campaignId}/email-templates`, { params })
  return unwrapSuccess(response.data) || { defaultTestEmail: '', templates: {}, purposes: {} }
}

export async function updateCampaignEmailConfig(campaignId, payload) {
  const response = await api.put(`/registration-campaigns/${campaignId}/emails`, payload)
  return unwrapSuccess(response.data)
}

export async function previewCampaignEmailTemplate(campaignId, payload) {
  const response = await api.post(`/registration-campaigns/${campaignId}/emails/preview`, payload)
  return unwrapSuccess(response.data)
}

export async function sendCampaignEmailTemplateTest(campaignId, payload) {
  const response = await api.post(`/registration-campaigns/${campaignId}/emails/test-send`, payload)
  return unwrapSuccess(response.data)
}

export async function getCampaignEmailDetail(campaignId, mailLogId) {
  const response = await api.get(`/registration-campaigns/${campaignId}/emails/${mailLogId}`)
  return unwrapSuccess(response.data)
}