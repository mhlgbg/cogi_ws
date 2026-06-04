import api from '../../../api/axios'

const STORAGE_PREFIX = 'admission-v1-session'
const ADMISSION_CAMPAIGN_PENDING_REQUESTS = new Map()
const ADMISSION_CAMPAIGN_RECENT_RESULTS = new Map()
const ADMISSION_CAMPAIGN_CACHE_TTL_MS = 2000

function normalizePayload(payload) {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') {
    return payload.data
  }
  return payload
}

function normalizeTenantCode(tenantCode) {
  return String(tenantCode || '').trim()
}

function normalizeCampaignCode(campaignCode) {
  return String(campaignCode || '').trim()
}

function buildAdmissionCampaignRequestKey(campaignCode, tenantCode = '') {
  return `${normalizeTenantCode(tenantCode).toLowerCase()}::${normalizeCampaignCode(campaignCode).toLowerCase()}`
}

function readRecentAdmissionCampaignResult(cacheKey) {
  const cachedEntry = ADMISSION_CAMPAIGN_RECENT_RESULTS.get(cacheKey)
  if (!cachedEntry) return null

  if (cachedEntry.expiresAt <= Date.now()) {
    ADMISSION_CAMPAIGN_RECENT_RESULTS.delete(cacheKey)
    return null
  }

  return cachedEntry.data
}

function writeRecentAdmissionCampaignResult(cacheKey, data) {
  ADMISSION_CAMPAIGN_RECENT_RESULTS.set(cacheKey, {
    data,
    expiresAt: Date.now() + ADMISSION_CAMPAIGN_CACHE_TTL_MS,
  })
}

function buildTenantRequestConfig(tenantCode) {
  const normalizedTenantCode = normalizeTenantCode(tenantCode)
  if (!normalizedTenantCode) return undefined

  return {
    headers: {
      'x-tenant-code': normalizedTenantCode,
    },
  }
}

export function readAdmissionV1MaxFileSizeBytes() {
  const configuredMb = Number(import.meta.env.VITE_ADMISSION_V1_MAX_FILE_SIZE_MB || 20)
  if (!Number.isFinite(configuredMb) || configuredMb <= 0) {
    return 20 * 1024 * 1024
  }

  return configuredMb * 1024 * 1024
}

export function formatAdmissionV1FileSize(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return '0 MB'
  return `${(size / (1024 * 1024)).toFixed(0)} MB`
}

export function buildAdmissionV1FileTooLargeMessage(fileName = '', maxFileSizeBytes = readAdmissionV1MaxFileSizeBytes()) {
  const limitLabel = formatAdmissionV1FileSize(maxFileSizeBytes)
  if (fileName) {
    return `Tệp "${fileName}" vượt quá dung lượng cho phép. Hiện hệ thống hỗ trợ tối đa ${limitLabel} mỗi tệp.`
  }

  return `Tệp tải lên vượt quá dung lượng cho phép. Hiện hệ thống hỗ trợ tối đa ${limitLabel} mỗi tệp.`
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

export function buildAdmissionV1Path(campaignCode, suffix = '', tenantCode = '') {
  const normalizedCampaignCode = encodeURIComponent(normalizeCampaignCode(campaignCode))
  const normalizedTenantCode = normalizeTenantCode(tenantCode)
  const basePath = normalizedTenantCode
    ? `/t/${encodeURIComponent(normalizedTenantCode)}/dang-ky-tuyen-sinh-v1/${normalizedCampaignCode}`
    : `/dang-ky-tuyen-sinh-v1/${normalizedCampaignCode}`

  if (!suffix) return basePath
  return `${basePath}/${String(suffix).replace(/^\/+/, '')}`
}

export function buildAdmissionResultLookupPath(campaignCode, tenantCode = '') {
  const normalizedCampaignCode = encodeURIComponent(normalizeCampaignCode(campaignCode))
  const normalizedTenantCode = normalizeTenantCode(tenantCode)
  return normalizedTenantCode
    ? `/t/${encodeURIComponent(normalizedTenantCode)}/tra-cuu-tuyen-sinh/${normalizedCampaignCode}`
    : `/tra-cuu-tuyen-sinh/${normalizedCampaignCode}`
}

export function buildAdmissionExamCardPath(campaignCode, tenantCode = '', params = {}) {
  const basePath = `${buildAdmissionResultLookupPath(campaignCode, tenantCode)}/the-du-kiem-tra`
  const searchParams = new URLSearchParams()

  const studentCode = String(params?.studentCode || '').trim()
  const applicationCode = String(params?.applicationCode || '').trim()

  if (studentCode) searchParams.set('studentCode', studentCode)
  if (applicationCode) searchParams.set('applicationCode', applicationCode)

  const queryString = searchParams.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}

export function buildAdmissionV1StorageKey(campaignCode, tenantCode = '') {
  return `${STORAGE_PREFIX}:${normalizeTenantCode(tenantCode).toLowerCase()}:${normalizeCampaignCode(campaignCode).toLowerCase()}`
}

export function storeAdmissionV1Token(campaignCode, token, tenantCode = '') {
  const normalizedToken = String(token || '').trim()
  if (!normalizedToken) return
  sessionStorage.setItem(buildAdmissionV1StorageKey(campaignCode, tenantCode), normalizedToken)
}

export function readAdmissionV1Token(campaignCode, tenantCode = '') {
  return String(sessionStorage.getItem(buildAdmissionV1StorageKey(campaignCode, tenantCode)) || '').trim()
}

export function clearAdmissionV1Token(campaignCode, tenantCode = '') {
  sessionStorage.removeItem(buildAdmissionV1StorageKey(campaignCode, tenantCode))
}

export async function getPublicAdmissionCampaign(campaignCode, tenantCode = '') {
  const normalizedCampaignCode = normalizeCampaignCode(campaignCode)
  const normalizedTenantCode = normalizeTenantCode(tenantCode)
  const cacheKey = buildAdmissionCampaignRequestKey(normalizedCampaignCode, normalizedTenantCode)
  const requestLabel = `[admission-v1.by-code] ${cacheKey}`

  console.count(`${requestLabel} call-count`)

  const recentResult = readRecentAdmissionCampaignResult(cacheKey)
  if (recentResult) {
    console.info(`${requestLabel} recent-cache-hit`)
    return recentResult
  }

  const pendingRequest = ADMISSION_CAMPAIGN_PENDING_REQUESTS.get(cacheKey)
  if (pendingRequest) {
    console.info(`${requestLabel} deduped-pending`)
    return pendingRequest
  }

  const requestPromise = api.get(
    `/admission-campaigns/by-code/${encodeURIComponent(normalizedCampaignCode)}`,
    buildTenantRequestConfig(normalizedTenantCode),
  )
    .then((response) => {
      const payload = normalizePayload(response?.data)
      writeRecentAdmissionCampaignResult(cacheKey, payload)
      return payload
    })
    .catch((error) => {
      ADMISSION_CAMPAIGN_RECENT_RESULTS.delete(cacheKey)
      throw error
    })
    .finally(() => {
      console.timeEnd(requestLabel)
      ADMISSION_CAMPAIGN_PENDING_REQUESTS.delete(cacheKey)
    })

  ADMISSION_CAMPAIGN_PENDING_REQUESTS.set(cacheKey, requestPromise)
  console.info(`${requestLabel} start`, {
    tenantCode: normalizedTenantCode,
    campaignCode: normalizedCampaignCode,
    url: `/admission-campaigns/by-code/${encodeURIComponent(normalizedCampaignCode)}`,
  })
  console.time(requestLabel)

  return requestPromise
}

export async function lookupAdmissionV1Access(payload, tenantCode = '') {
  const response = await api.post('/admission-public-v1/lookup', payload, buildTenantRequestConfig(tenantCode))
  return normalizePayload(response?.data)
}

export async function startAdmissionV1Registration(payload, tenantCode = '') {
  const response = await api.post('/admission-public-v1/start-registration', payload, buildTenantRequestConfig(tenantCode))
  return normalizePayload(response?.data)
}

export async function resendAdmissionV1ApplicationCode(payload, tenantCode = '') {
  const response = await api.post('/admission-public-v1/resend-application-code', payload, buildTenantRequestConfig(tenantCode))
  return normalizePayload(response?.data)
}

export async function lookupAdmissionV1Result(payload, tenantCode = '') {
  const response = await api.post('/admission-public-v1/result-lookup', payload, buildTenantRequestConfig(tenantCode))
  return normalizePayload(response?.data)
}

export async function getPublicAdmissionExamCard(campaignCode, payload, tenantCode = '') {
  const response = await api.get(`/public/admission-campaigns/${encodeURIComponent(normalizeCampaignCode(campaignCode))}/exam-card`, {
    ...buildTenantRequestConfig(tenantCode),
    params: {
      studentCode: String(payload?.studentCode || '').trim(),
      applicationCode: String(payload?.applicationCode || '').trim(),
    },
  })
  return normalizePayload(response?.data)
}

export async function logPublicAdmissionExamCardPrint(campaignCode, payload, tenantCode = '') {
  const response = await api.post(
    `/public/admission-campaigns/${encodeURIComponent(normalizeCampaignCode(campaignCode))}/exam-card/print-log`,
    {
      studentCode: String(payload?.studentCode || '').trim(),
      applicationCode: String(payload?.applicationCode || '').trim(),
    },
    buildTenantRequestConfig(tenantCode),
  )
  return normalizePayload(response?.data)
}

export async function openAdmissionV1Session(payload, tenantCode = '') {
  const response = await api.post('/admission-public-v1/open-session', payload, buildTenantRequestConfig(tenantCode))
  return normalizePayload(response?.data)
}

export async function getAdmissionV1Session(token, tenantCode = '') {
  const response = await api.get('/admission-public-v1/session', {
    ...buildTenantRequestConfig(tenantCode),
    params: {
      token,
    },
  })
  return normalizePayload(response?.data)
}

export async function getAdmissionV1ConversationMessages(applicationId, token, tenantCode = '') {
  const response = await api.get(`/admission-public-v1/applications/${encodeURIComponent(String(applicationId || ''))}/messages`, {
    ...buildTenantRequestConfig(tenantCode),
    params: {
      token,
    },
  })
  return normalizePayload(response?.data)
}

export async function sendAdmissionV1ConversationMessage(applicationId, token, payload, tenantCode = '') {
  const attachments = await toSerializableAttachments(payload?.attachments)

  const response = await api.post(
    `/admission-public-v1/applications/${encodeURIComponent(String(applicationId || ''))}/messages`,
    {
      token: String(token || ''),
      content: String(payload?.content || ''),
      attachments,
    },
    buildTenantRequestConfig(tenantCode),
  )
  return normalizePayload(response?.data)
}

export async function trackAdmissionV1ParentView(applicationId, token, tenantCode = '') {
  const response = await api.post(
    `/admission-public-v1/applications/${encodeURIComponent(String(applicationId || ''))}/track-view`,
    { token },
    buildTenantRequestConfig(tenantCode),
  )
  return normalizePayload(response?.data)
}

export async function acknowledgeAdmissionV1Approval(applicationId, token, payload = {}, tenantCode = '') {
  const response = await api.post(
    `/admission-applications/${encodeURIComponent(String(applicationId || ''))}/acknowledge-approval`,
    {
      token: String(token || ''),
      note: String(payload?.note || ''),
    },
    buildTenantRequestConfig(tenantCode),
  )
  return normalizePayload(response?.data)
}

export async function createAdmissionV1Application(token, payload, tenantCode = '') {
  const response = await api.post('/admission-public-v1/applications', {
    ...payload,
    token,
  }, buildTenantRequestConfig(tenantCode))
  return normalizePayload(response?.data)
}

export async function updateAdmissionV1Application(applicationId, token, payload, tenantCode = '') {
  const response = await api.put(`/admission-public-v1/applications/${encodeURIComponent(String(applicationId || ''))}`, {
    ...payload,
    token,
  }, buildTenantRequestConfig(tenantCode))
  return normalizePayload(response?.data)
}

export function getAdmissionV1ErrorMessage(error, fallbackMessage) {
  const status = Number(error?.response?.status || error?.status || 0)
  if (status === 413) {
    return buildAdmissionV1FileTooLargeMessage()
  }

  return (
    error?.response?.data?.error?.message
    || error?.response?.data?.message
    || error?.message
    || fallbackMessage
  )
}

export function readAdmissionV1CampaignStatus(source) {
  return String(source?.campaignStatus || source?.status || 'draft').trim().toLowerCase() || 'draft'
}

export function readAdmissionV1ApplicationStatus(source) {
  return String(source?.admissionStatus || source?.status || 'draft').trim().toLowerCase() || 'draft'
}

export function readAdmissionV1ReviewStatus(source) {
  return String(source?.reviewStatus || '').trim().toLowerCase() || null
}

export function getApplicationStatusGuideKey(application) {
  const admissionStatus = String(application?.admissionStatus || application?.status || '').trim().toLowerCase()
  const reviewStatus = String(application?.reviewStatus || '').trim().toLowerCase()
  const candidates = [reviewStatus, admissionStatus].filter(Boolean)

  if (candidates.some((value) => value === 'draft')) {
    return 'draft'
  }
  if (candidates.some((value) => value === 'returned' || value === 'need_update' || value === 'rejected-as-need-update' || value === 'application_needs_update')) {
    return 'need_update'
  }
  if (candidates.some((value) => value === 'accepted' || value === 'approved' || value === 'exam_scheduled' || value === 'passed' || value === 'enrolled')) {
    return 'accepted'
  }
  if (candidates.some((value) => value === 'reviewing' || value === 'in_review' || value === 'under_review')) {
    return 'reviewing'
  }
  if (candidates.some((value) => value === 'rejected' || value === 'not_accepted' || value === 'failed')) {
    return 'rejected'
  }
  return 'submitted'
}

export function getAdmissionV1CampaignStatusMessage(campaign) {
  const campaignStatus = readAdmissionV1CampaignStatus(campaign)
  if (campaignStatus === 'draft') return 'Kỳ tuyển sinh này hiện chưa mở nhận hồ sơ.'
  if (campaignStatus === 'closed') return 'Kỳ tuyển sinh này đã đóng nhận hồ sơ mới.'
  return ''
}

export function buildAdmissionV1Permissions(campaign, application) {
  const campaignStatus = readAdmissionV1CampaignStatus(campaign)
  const applicationStatus = readAdmissionV1ApplicationStatus(application)
  const reviewStatus = readAdmissionV1ReviewStatus(application)
  const hasApplication = Boolean(application?.id)
  const isDraft = hasApplication && applicationStatus === 'draft'
  const isNeedUpdate = hasApplication && (applicationStatus === 'rejected' || reviewStatus === 'returned')
  const canCreate = !hasApplication && campaignStatus === 'open'
  const canEditDraft = isDraft && campaignStatus === 'open'
  const canSubmitDraft = canEditDraft
  const canEditNeedUpdate = isNeedUpdate
  const canResubmitNeedUpdate = isNeedUpdate
  const canUploadMainEvidence = (isDraft && campaignStatus === 'open') || isNeedUpdate
  const canSendConversationAttachment = false

  return {
    campaignStatus,
    applicationStatus,
    reviewStatus,
    isDraft,
    isNeedUpdate,
    canCreate,
    canEditDraft,
    canSubmitDraft,
    canEditNeedUpdate,
    canResubmitNeedUpdate,
    canUploadMainEvidence,
    canSendConversationAttachment,
    canTrack: hasApplication,
    canEdit: canEditDraft || canEditNeedUpdate,
    canSubmit: canSubmitDraft || canResubmitNeedUpdate,
    isMainFormFileEditAllowed: canUploadMainEvidence,
  }
}

export function formatAdmissionStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'draft') return 'Nháp'
  if (normalized === 'submitted') return 'Đang tiếp nhận'
  if (normalized === 'reviewing') return 'Đang xét duyệt'
  if (normalized === 'approved') return 'Đã duyệt'
  if (normalized === 'rejected') return 'Cần bổ sung'
  if (normalized === 'exam_scheduled') return 'Đã xếp lịch'
  if (normalized === 'passed') return 'Đạt'
  if (normalized === 'failed') return 'Chưa đạt'
  if (normalized === 'enrolled') return 'Đã nhập học'
  return normalized || '-'
}

export function getAdmissionStatusColor(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'approved' || normalized === 'passed' || normalized === 'enrolled') return 'success'
  if (normalized === 'submitted' || normalized === 'reviewing' || normalized === 'exam_scheduled') return 'info'
  if (normalized === 'rejected' || normalized === 'failed') return 'warning'
  if (normalized === 'draft') return 'secondary'
  return 'secondary'
}

export function formatDate(value, withTime = false) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  if (withTime) {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}