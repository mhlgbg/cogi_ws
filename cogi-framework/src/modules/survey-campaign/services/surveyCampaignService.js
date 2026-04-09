import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

export async function getSurveyCampaigns(params = {}) {
  const res = await api.get('/survey-campaigns', { params })
  return unwrapSuccess(res.data)
}

export async function getSurveyCampaignDetail(id) {
  const res = await api.get(`/survey-campaigns/${id}`)
  return unwrapSuccess(res.data)
}

export async function getSurveyCampaignFormOptions() {
  const res = await api.get('/survey-campaigns/form-options')
  return unwrapSuccess(res.data)
}

export async function createSurveyCampaign(payload) {
  const res = await api.post('/survey-campaigns', payload)
  return unwrapSuccess(res.data)
}

export async function updateSurveyCampaign(id, payload) {
  const res = await api.put(`/survey-campaigns/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function getSurveyAssignments(params = {}) {
  const res = await api.get('/survey-assignments', { params })
  return unwrapSuccess(res.data)
}

export async function resetSurveyCampaignResponses(campaignId) {
  const res = await api.post(`/survey-campaigns/${campaignId}/reset-responses`)
  return unwrapSuccess(res.data)
}

export async function getSurveyCampaignReportSummary(campaignId) {
  const res = await api.get(`/survey-reports/campaign/${campaignId}/summary`)
  return unwrapSuccess(res.data)
}

export async function getSurveyCampaignReportLecturers(campaignId) {
  const res = await api.get(`/survey-reports/campaign/${campaignId}/lecturers`)
  return unwrapSuccess(res.data)
}

export async function getSurveyCampaignReportCourses(campaignId) {
  const res = await api.get(`/survey-reports/campaign/${campaignId}/courses`)
  return unwrapSuccess(res.data)
}

export async function exportSurveyCampaignLecturerReport(campaignId, lecturerId) {
  const res = await api.get(`/survey-reports/campaign/${campaignId}/lecturer/${encodeURIComponent(String(lecturerId || '').trim())}/export`, {
    responseType: 'blob',
  })

  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)

  return {
    blob: res.data,
    fileName: matchedName?.[1] || `survey-report-${campaignId}-${lecturerId}.xlsx`,
  }
}

export async function importSurveyAssignments(formData) {
  const res = await api.post('/survey-campaigns/import-assignments', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return unwrapSuccess(res.data)
}