import api from '../../../api/axios'

function unwrapSuccess(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

function toSerializableAttachment(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      resolve(null)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: typeof reader.result === 'string' ? reader.result : '',
      })
    }
    reader.onerror = () => reject(new Error('Không thể đọc file tải lên'))
    reader.readAsDataURL(file)
  })
}

async function toSerializableAttachments(files) {
  const normalizedFiles = Array.from(files || []).filter((file) => file instanceof File)
  if (normalizedFiles.length === 0) return []

  const attachments = await Promise.all(normalizedFiles.map((file) => toSerializableAttachment(file)))
  return attachments.filter(Boolean)
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

export async function exportAdmissionReviewList(params = {}) {
  const res = await api.get('/admission-management/reviews/export', {
    params,
    responseType: 'blob',
  })

  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)

  return {
    blob: res.data,
    fileName: matchedName?.[1] || 'admission-reviews.xlsx',
  }
}

export async function getAdmissionReviewDetail(id) {
  const res = await api.get(`/admission-management/reviews/${id}`)
  return unwrapSuccess(res.data)
}

export async function getAdmissionReviewMessages(id) {
  const res = await api.get(`/admission/reviews/${id}/messages`)
  return unwrapSuccess(res.data)
}

export async function getAdmissionReviewEmailTemplates(id) {
  const res = await api.get(`/admission/reviews/${id}/email-templates`)
  return unwrapSuccess(res.data)
}

export async function getAdmissionReviewNotificationTemplate(id, code) {
  const res = await api.get(`/admission/reviews/${id}/notification-template`, {
    params: { code },
  })
  return unwrapSuccess(res.data)
}

export async function sendAdmissionReviewMessage(id, payload = {}) {
  const attachments = await toSerializableAttachments(payload?.attachments)

  const res = await api.post(`/admission/reviews/${id}/messages`, {
    content: String(payload?.content || ''),
    attachments,
  })
  return unwrapSuccess(res.data)
}

export async function logAdmissionReviewDetailView(id) {
  const res = await api.post(`/admission/reviews/${id}/view-detail-activity`)
  return unwrapSuccess(res.data)
}

export async function getAdmissionReviewSnapshot(id) {
  const res = await api.get(`/admission-management/reviews/${id}/snapshot`)
  return unwrapSuccess(res.data)
}

export async function getAdmissionReviewFormData(id) {
  const res = await api.get(`/admission-management/reviews/${id}/form-data`)
  return unwrapSuccess(res.data)
}

export async function rebuildAdmissionReviewSnapshot(id) {
  const res = await api.post(`/admission/reviews/${id}/rebuild-snapshot`)
  return unwrapSuccess(res.data)
}

export async function updateAdmissionReviewAccount(id, payload) {
  const res = await api.put(`/admission-management/reviews/${id}/account`, payload)
  return unwrapSuccess(res.data)
}

export async function updateAdmissionReviewApplication(id, payload) {
  const res = await api.put(`/admission-management/reviews/${id}/application`, payload)
  return unwrapSuccess(res.data)
}

export async function submitAdmissionReviewDecision(id, payload) {
  const res = await api.post(`/admission-management/reviews/${id}/decision`, payload)
  return unwrapSuccess(res.data)
}

export async function updateAdmissionReturnedReviewNote(id, payload) {
  const res = await api.post(`/admission/reviews/${id}/update-returned-note`, payload)
  return unwrapSuccess(res.data)
}

export async function resetAdmissionReviewToDraft(id) {
  const res = await api.post(`/admission/reviews/${id}/reset-to-draft`)
  return unwrapSuccess(res.data)
}

export async function softDeleteAdmissionReview(id, payload = {}) {
  const res = await api.post(`/admission/reviews/${id}/soft-delete`, payload)
  return unwrapSuccess(res.data)
}

export async function restoreAdmissionReview(id, payload = {}) {
  const res = await api.post(`/admission/reviews/${id}/restore`, payload)
  return unwrapSuccess(res.data)
}

export async function sendAdmissionApprovalReminder(id) {
  const res = await api.post(`/admission/reviews/${id}/send-approval-reminder`)
  return unwrapSuccess(res.data)
}

export async function sendAdmissionReviewEmail(id, payload = {}) {
  const attachments = await toSerializableAttachments(payload?.attachments)

  const res = await api.post(`/admission/reviews/${id}/send-email`, {
    subject: String(payload?.subject || ''),
    content: String(payload?.content || ''),
    attachments,
    alsoCreateConversationMessage: payload?.alsoCreateConversationMessage !== false,
  })
  return unwrapSuccess(res.data)
}

export async function getCandidateExamAdmissionSeasons() {
  const res = await api.get('/candidate-exams/admission-seasons')
  return unwrapSuccess(res.data)
}

export async function getCandidateExams(params = {}) {
  const res = await api.get('/candidate-exams', { params })
  return unwrapSuccess(res.data)
}

export async function getCandidateExamDetail(id) {
  const res = await api.get(`/candidate-exams/${id}`)
  return unwrapSuccess(res.data)
}

export async function createCandidateExam(payload) {
  const res = await api.post('/candidate-exams', payload)
  return unwrapSuccess(res.data)
}

export async function updateCandidateExam(id, payload) {
  const res = await api.put(`/candidate-exams/${id}`, payload)
  return unwrapSuccess(res.data)
}

export async function softDeleteCandidateExam(id, payload = {}) {
  const res = await api.delete(`/candidate-exams/${id}`, { data: payload })
  return unwrapSuccess(res.data)
}

export async function restoreCandidateExam(id, payload = {}) {
  const res = await api.put(`/candidate-exams/${id}/restore`, payload)
  return unwrapSuccess(res.data)
}

export async function getCandidateExamLogs(id, params = {}) {
  const res = await api.get(`/candidate-exams/${id}/logs`, { params })
  return unwrapSuccess(res.data)
}

export async function getCandidateExamExamCard(id) {
  const res = await api.get(`/candidate-exams/${id}/exam-card`)
  return unwrapSuccess(res.data)
}

export async function downloadCandidateExamImportTemplate() {
  const res = await api.get('/candidate-exams/import-template', {
    responseType: 'blob',
  })

  const headerValue = String(res.headers?.['content-disposition'] || '')
  const matchedName = headerValue.match(/filename="?([^";]+)"?/i)

  return {
    blob: res.data,
    fileName: matchedName?.[1] || 'candidate-exam-import-template.xlsx',
  }
}

export async function previewCandidateExamImport({ admissionSeasonId, file }) {
  const formData = new FormData()
  formData.append('admissionSeasonId', String(admissionSeasonId || ''))
  formData.append('file', file)

  const res = await api.post('/candidate-exams/import-preview', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return unwrapSuccess(res.data)
}

export async function confirmCandidateExamImport({ admissionSeasonId, file, options = {} }) {
  const formData = new FormData()
  formData.append('admissionSeasonId', String(admissionSeasonId || ''))
  formData.append('updateExisting', String(options.updateExisting !== false))
  formData.append('restoreDeleted', String(options.restoreDeleted === true))
  formData.append('overwriteScores', String(options.overwriteScores === true))
  formData.append('overwriteExamAssignment', String(options.overwriteExamAssignment !== false))
  formData.append('file', file)

  const res = await api.post('/candidate-exams/import-confirm', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return unwrapSuccess(res.data)
}