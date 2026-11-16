import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

function normalizeListPayload(payload) {
  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload
  }

  const unwrapped = unwrapSuccess(payload)
  if (Array.isArray(unwrapped)) {
    return {
      data: unwrapped,
      meta: payload?.meta || null,
    }
  }

  return unwrapped
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

export async function deleteSurveyCampaign(id) {
  const res = await api.delete(`/survey-campaigns/${id}`)
  return unwrapSuccess(res.data)
}

export async function getSurveyAssignments(params = {}) {
  const res = await api.get('/survey-assignments', { params })
  return unwrapSuccess(res.data)
}

export async function createSurveyAssignment(payload) {
  const res = await api.post('/survey-assignments', payload)
  return unwrapSuccess(res.data)
}

export async function deleteSurveyAssignmentsByFilter(payload) {
  const res = await api.post('/survey-assignments/delete-filtered', payload)
  return unwrapSuccess(res.data)
}

export async function restoreSurveyAssignmentsByFilter(payload) {
  const res = await api.post('/survey-assignments/restore-filtered', payload)
  return unwrapSuccess(res.data)
}

export async function restoreSurveyAssignment(id) {
  const res = await api.post(`/survey-assignments/${id}/restore`)
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

export async function exportSurveyCampaignCourseReport(campaignId, courseId) {
  const res = await api.get(`/survey-reports/campaign/${campaignId}/course/${encodeURIComponent(String(courseId || '').trim())}/export`, {
    responseType: 'blob',
  })

  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)

  return {
    blob: res.data,
    fileName: matchedName?.[1] || `survey-report-${campaignId}-${courseId}.xlsx`,
  }
}

export async function exportSurveyCampaignProgressReport(campaignId) {
  const res = await api.get(`/survey-reports/campaign/${campaignId}/progress/export`, {
    responseType: 'blob',
  })

  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)

  return {
    blob: res.data,
    fileName: matchedName?.[1] || `survey-progress-${campaignId}.xlsx`,
  }
}

export async function exportSurveyCampaignAnswersReport(campaignId) {
  const res = await api.get(`/survey-reports/campaign/${campaignId}/answers/export`, {
    responseType: 'blob',
  })

  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)

  return {
    blob: res.data,
    fileName: matchedName?.[1] || `survey-answers-${campaignId}.xlsx`,
  }
}

export async function generateSurveyCampaignAnswersReportFile(campaignId) {
  try {
    const res = await api.post(`/survey-reports/campaign/${campaignId}/answers/file/generate`)
    return unwrapSuccess(res.data)
  } catch (error) {
    const status = Number(error?.response?.status || 0)
    if (status === 404 || status === 405) {
      const fallbackRes = await api.get(`/survey-reports/campaign/${campaignId}/answers/file/generate`)
      return unwrapSuccess(fallbackRes.data)
    }
    throw error
  }
}

export async function getSurveyCampaignAnswersReportLatestFile(campaignId) {
  try {
    const res = await api.get(`/survey-reports/campaign/${campaignId}/answers/file/latest`)
    return unwrapSuccess(res.data)
  } catch (error) {
    const status = Number(error?.response?.status || 0)
    if (status === 404) {
      return {
        prefix: '',
        hasFile: false,
        fileName: null,
        generatedAt: null,
        size: 0,
      }
    }
    throw error
  }
}

export async function downloadSurveyCampaignAnswersReportLatestFile(campaignId) {
  try {
    const res = await api.get(`/survey-reports/campaign/${campaignId}/answers/file/download`, {
      responseType: 'blob',
    })

    const headerValue = String(res.headers?.['content-disposition'] || '')
    const matchedName = headerValue.match(/filename="?([^";]+)"?/i)

    return {
      blob: res.data,
      fileName: matchedName?.[1] || `survey-answers-${campaignId}.xlsx`,
    }
  } catch (error) {
    const status = Number(error?.response?.status || 0)
    if (status === 404 || status === 405) {
      return exportSurveyCampaignAnswersReport(campaignId)
    }
    throw error
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

export async function getMyManagedSurveyCampaigns(params = {}) {
  const res = await api.get('/survey/my-campaigns', { params })
  return unwrapSuccess(res.data)
}

export async function getMyManagedSurveyCampaignDetail(id) {
  const res = await api.get(`/survey/my-campaigns/${id}`)
  return unwrapSuccess(res.data)
}

export async function importMyManagedSurveyAssignments(formData) {
  const res = await api.post('/survey/my-campaigns/import-assignments', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return unwrapSuccess(res.data)
}

export async function resetMyManagedSurveyCampaignResponses(campaignId) {
  const res = await api.post(`/survey/my-campaigns/${campaignId}/reset-responses`)
  return unwrapSuccess(res.data)
}

export async function getMyManagedSurveyAssignments(campaignId, params = {}) {
  const res = await api.get(`/survey/my-campaigns/${campaignId}/assignments`, { params })
  return unwrapSuccess(res.data)
}

export async function createMyManagedSurveyAssignment(campaignId, payload) {
  const res = await api.post(`/survey/my-campaigns/${campaignId}/assignments`, payload)
  return unwrapSuccess(res.data)
}

export async function deleteMyManagedSurveyAssignmentsByFilter(campaignId, payload) {
  const res = await api.post(`/survey/my-campaigns/${campaignId}/assignments/delete-filtered`, payload)
  return unwrapSuccess(res.data)
}

export async function restoreMyManagedSurveyAssignmentsByFilter(campaignId, payload) {
  const res = await api.post(`/survey/my-campaigns/${campaignId}/assignments/restore-filtered`, payload)
  return unwrapSuccess(res.data)
}

export async function restoreMyManagedSurveyAssignment(id) {
  const res = await api.post(`/survey/my-campaigns/assignments/${id}/restore`)
  return unwrapSuccess(res.data)
}

export async function getMyManagedSurveyCampaignReportSummary(campaignId) {
  const res = await api.get(`/survey/my-campaigns/${campaignId}/reports/summary`)
  return unwrapSuccess(res.data)
}

export async function getMyManagedSurveyCampaignReportLecturers(campaignId) {
  const res = await api.get(`/survey/my-campaigns/${campaignId}/reports/lecturers`)
  return unwrapSuccess(res.data)
}

export async function getMyManagedSurveyCampaignReportCourses(campaignId) {
  const res = await api.get(`/survey/my-campaigns/${campaignId}/reports/courses`)
  return unwrapSuccess(res.data)
}

export async function exportMyManagedSurveyCampaignLecturerReport(campaignId, lecturerId) {
  const res = await api.get(`/survey/my-campaigns/${campaignId}/reports/lecturer/${encodeURIComponent(String(lecturerId || '').trim())}/export`, {
    responseType: 'blob',
  })
  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)
  return {
    blob: res.data,
    fileName: matchedName?.[1] || `survey-report-${campaignId}-${lecturerId}.xlsx`,
  }
}

export async function exportMyManagedSurveyCampaignCourseReport(campaignId, courseId) {
  const res = await api.get(`/survey/my-campaigns/${campaignId}/reports/course/${encodeURIComponent(String(courseId || '').trim())}/export`, {
    responseType: 'blob',
  })
  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)
  return {
    blob: res.data,
    fileName: matchedName?.[1] || `survey-report-${campaignId}-${courseId}.xlsx`,
  }
}

export async function exportMyManagedSurveyCampaignProgressReport(campaignId) {
  const res = await api.get(`/survey/my-campaigns/${campaignId}/reports/progress/export`, {
    responseType: 'blob',
  })
  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)
  return {
    blob: res.data,
    fileName: matchedName?.[1] || `survey-progress-${campaignId}.xlsx`,
  }
}

export async function exportMyManagedSurveyCampaignAnswersReport(campaignId) {
  const res = await api.get(`/survey/my-campaigns/${campaignId}/reports/answers/export`, {
    responseType: 'blob',
  })
  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)
  return {
    blob: res.data,
    fileName: matchedName?.[1] || `survey-answers-${campaignId}.xlsx`,
  }
}

export async function generateMyManagedSurveyCampaignAnswersReportFile(campaignId) {
  const res = await api.post(`/survey/my-campaigns/${campaignId}/reports/answers/file/generate`)
  return unwrapSuccess(res.data)
}

export async function getMyManagedSurveyCampaignAnswersReportLatestFile(campaignId) {
  try {
    const res = await api.get(`/survey/my-campaigns/${campaignId}/reports/answers/file/latest`)
    return unwrapSuccess(res.data)
  } catch (error) {
    const status = Number(error?.response?.status || 0)
    if (status === 404) {
      return {
        prefix: '',
        hasFile: false,
        fileName: null,
        generatedAt: null,
        size: 0,
      }
    }
    throw error
  }
}

export async function downloadMyManagedSurveyCampaignAnswersReportLatestFile(campaignId) {
  const res = await api.get(`/survey/my-campaigns/${campaignId}/reports/answers/file/download`, {
    responseType: 'blob',
  })
  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)
  return {
    blob: res.data,
    fileName: matchedName?.[1] || `survey-answers-${campaignId}.xlsx`,
  }
}

export async function getSurveyCampaignUserAssignments(params = {}) {
  const res = await api.get('/survey/campaign-user-assignments', { params })
  return normalizeListPayload(res.data)
}

export async function getSurveyCampaignAssignableUsers(params = {}) {
  const res = await api.get('/survey/campaign-user-assignments/assignable-users', { params })
  return normalizeListPayload(res.data)
}

export async function createSurveyCampaignUserAssignment(payload) {
  const res = await api.post('/survey/campaign-user-assignments', payload)
  return unwrapSuccess(res.data)
}

export async function activateSurveyCampaignUserAssignment(id) {
  const res = await api.post(`/survey/campaign-user-assignments/${id}/activate`)
  return unwrapSuccess(res.data)
}

export async function deactivateSurveyCampaignUserAssignment(id) {
  const res = await api.post(`/survey/campaign-user-assignments/${id}/deactivate`)
  return unwrapSuccess(res.data)
}