import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data
  return payload
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function listAssessmentCampaigns(params = {}) {
  const res = await api.get('/assessment-campaigns', { params })
  return unwrapSuccess(res.data)
}

export async function getAssessmentCampaign(id) {
  const res = await api.get(`/assessment-campaigns/${id}`)
  return unwrapSuccess(res.data)
}

export async function createAssessmentCampaign(data) {
  const res = await api.post('/assessment-campaigns', data)
  return unwrapSuccess(res.data)
}

export async function updateAssessmentCampaign(id, data) {
  const res = await api.put(`/assessment-campaigns/${id}`, data)
  return unwrapSuccess(res.data)
}

export async function listAssessmentCampaignFields(campaignId) {
  const res = await api.get(`/assessment-campaigns/${campaignId}/fields`)
  return unwrapSuccess(res.data)
}

export async function createAssessmentCampaignField(campaignId, data) {
  const res = await api.post(`/assessment-campaigns/${campaignId}/fields`, data)
  return unwrapSuccess(res.data)
}

export async function updateAssessmentCampaignField(campaignId, fieldId, data) {
  const res = await api.put(`/assessment-campaigns/${campaignId}/fields/${fieldId}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteAssessmentCampaignField(campaignId, fieldId) {
  const res = await api.delete(`/assessment-campaigns/${campaignId}/fields/${fieldId}`)
  return unwrapSuccess(res.data)
}

export async function reorderAssessmentCampaignFields(campaignId, items) {
  const res = await api.post(`/assessment-campaigns/${campaignId}/fields/reorder`, { items })
  return unwrapSuccess(res.data)
}

export async function listAssessmentCampaignRules(campaignId) {
  const res = await api.get(`/assessment-campaigns/${campaignId}/rules`)
  return unwrapSuccess(res.data)
}

export async function createAssessmentCampaignRule(campaignId, data) {
  const res = await api.post(`/assessment-campaigns/${campaignId}/rules`, data)
  return unwrapSuccess(res.data)
}

export async function updateAssessmentCampaignRule(campaignId, ruleId, data) {
  const res = await api.put(`/assessment-campaigns/${campaignId}/rules/${ruleId}`, data)
  return unwrapSuccess(res.data)
}

export async function deleteAssessmentCampaignRule(campaignId, ruleId) {
  const res = await api.delete(`/assessment-campaigns/${campaignId}/rules/${ruleId}`)
  return unwrapSuccess(res.data)
}

export async function resolveAssessmentCampaignAssessment(campaignId, data) {
  const res = await api.post(`/assessment-campaigns/${campaignId}/rules/resolve`, data)
  return unwrapSuccess(res.data)
}

export async function listAssessmentCampaignLeads(campaignId, params = {}) {
  const res = await api.get(`/assessment-campaigns/${campaignId}/leads`, { params })
  return unwrapSuccess(res.data)
}

export async function listAssessmentCampaignParticipations(campaignId, params = {}) {
  const res = await api.get(`/assessment-campaigns/${campaignId}/participations`, { params })
  return unwrapSuccess(res.data)
}

export async function listAssessmentCampaignResults(campaignId, params = {}) {
  const res = await api.get(`/assessment-campaigns/${campaignId}/results`, { params })
  return unwrapSuccess(res.data)
}

export async function cancelAssessmentCampaignAttempt(attemptId, data = {}) {
  const res = await api.post(`/assessment-campaigns/assessment-attempts/${attemptId}/cancel`, data)
  return unwrapSuccess(res.data)
}

export async function finalizeAssessmentCampaignAttemptTimeout(attemptId) {
  const res = await api.post(`/assessment-campaigns/assessment-attempts/${attemptId}/finalize-timeout`)
  return unwrapSuccess(res.data)
}

export async function finalizeOverdueAssessmentCampaignAttempts(campaignId) {
  const res = await api.post(`/assessment-campaigns/${campaignId}/finalize-overdue`)
  return unwrapSuccess(res.data)
}

export async function allowAssessmentCampaignRetake(attemptId, data = {}) {
  const res = await api.post(`/assessment-campaigns/assessment-attempts/${attemptId}/allow-retake`, data)
  return unwrapSuccess(res.data)
}