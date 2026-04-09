import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

export async function getAdmissionCampaigns(params = {}) {
  const res = await api.get('/admission-management/campaigns', { params })
  return unwrapSuccess(res.data)
}

export async function getAdmissionCampaignFormOptions() {
  const res = await api.get('/admission-management/campaigns/form-options')
  return unwrapSuccess(res.data)
}

export async function createAdmissionCampaign(payload) {
  const res = await api.post('/admission-management/campaigns', payload)
  return unwrapSuccess(res.data)
}

export async function updateAdmissionCampaign(id, payload) {
  const res = await api.put(`/admission-management/campaigns/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function getFormTemplates(params = {}) {
  const res = await api.get('/admission-management/form-templates', { params })
  return unwrapSuccess(res.data)
}

export async function getFormTemplateDetail(id) {
  const res = await api.get(`/admission-management/form-templates/${id}`)
  return unwrapSuccess(res.data)
}

export async function createFormTemplate(payload) {
  const res = await api.post('/admission-management/form-templates', payload)
  return unwrapSuccess(res.data)
}

export async function updateFormTemplate(id, payload) {
  const res = await api.put(`/admission-management/form-templates/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function getNotificationTemplates(params = {}) {
  const res = await api.get('/admission-management/notification-templates', { params })
  return unwrapSuccess(res.data)
}

export async function getNotificationTemplateDetail(id) {
  const res = await api.get(`/admission-management/notification-templates/${id}`)
  return unwrapSuccess(res.data)
}

export async function createNotificationTemplate(payload) {
  const res = await api.post('/admission-management/notification-templates', payload)
  return unwrapSuccess(res.data)
}

export async function updateNotificationTemplate(id, payload) {
  const res = await api.put(`/admission-management/notification-templates/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function getAdmissionReviewList(params = {}) {
  const res = await api.get('/admission-management/reviews', { params })
  return unwrapSuccess(res.data)
}

export async function getAdmissionReviewDetail(id) {
  const res = await api.get(`/admission-management/reviews/${id}`)
  return unwrapSuccess(res.data)
}

export async function submitAdmissionReviewDecision(id, payload) {
  const res = await api.post(`/admission-management/reviews/${id}/decision`, payload)
  return unwrapSuccess(res.data)
}