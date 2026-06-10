import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

export async function getLeadCampaigns(params = {}) {
  const res = await api.get('/lead-management/campaigns', { params })
  return unwrapSuccess(res.data)
}

export async function getLeadCampaignFormOptions() {
  const res = await api.get('/lead-management/campaigns/form-options')
  return unwrapSuccess(res.data)
}

export async function createLeadCampaign(payload) {
  const res = await api.post('/lead-management/campaigns', payload)
  return unwrapSuccess(res.data)
}

export async function updateLeadCampaign(id, payload) {
  const res = await api.put(`/lead-management/campaigns/${id}`, payload)
  return unwrapSuccess(res.data)
}
