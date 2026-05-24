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

export async function submitAdmissionReviewDecision(id, payload) {
  const res = await api.post(`/admission-management/reviews/${id}/decision`, payload)
  return unwrapSuccess(res.data)
}

export async function sendAdmissionApprovalReminder(id) {
  const res = await api.post(`/admission/reviews/${id}/send-approval-reminder`)
  return unwrapSuccess(res.data)
}