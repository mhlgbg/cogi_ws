import api from '../../../api/axios'

function extractApiPayload(response) {
  if (!response) return null
  return response.data ?? null
}

function createRequestOptions(options = {}) {
  const requestOptions = {}
  if (options?.params) requestOptions.params = options.params
  if (options?.signal) requestOptions.signal = options.signal
  return requestOptions
}

export function getFitnessApiErrorMessage(error, fallback = 'Đã xảy ra lỗi khi xử lý yêu cầu Strava.') {
  const data = error?.response?.data
  const candidate = data?.error?.message || data?.message || error?.message || error

  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  if (candidate && typeof candidate === 'object') {
    const nestedMessage = candidate?.message
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage.trim()
  }

  return fallback
}

export function normalizeFitnessApiError(error, fallback = 'Đã xảy ra lỗi khi xử lý yêu cầu Strava.') {
  const normalized = new Error(getFitnessApiErrorMessage(error, fallback))
  normalized.name = 'FitnessApiError'
  normalized.status = Number(error?.response?.status || 0) || null
  normalized.code = String(error?.response?.data?.error?.code || error?.response?.data?.code || '').trim() || null
  normalized.details = error?.response?.data || null
  normalized.cause = error
  return normalized
}

function mapJobEnvelope(response) {
  const payload = extractApiPayload(response)
  const jobData = payload?.data || null

  return {
    data: jobData,
    status: Number(response?.status || 0) || null,
    alreadyRunning: Boolean(jobData?.alreadyRunning),
    message: typeof jobData?.message === 'string' && jobData.message.trim()
      ? jobData.message.trim()
      : '',
    async: jobData?.async === true,
  }
}

export async function getStravaStatus() {
  const response = await api.get('/strava/status')
  return extractApiPayload(response)
}

export async function getStravaSummary() {
  const response = await api.get('/strava/summary')
  return extractApiPayload(response)
}

export async function getStravaAnalyticsOverview() {
  const response = await api.get('/strava/analytics/overview')
  return extractApiPayload(response)
}

export async function getStravaAnalyticsTrends(params = {}) {
  const response = await api.get('/strava/analytics/trends', { params })
  return extractApiPayload(response) || { metric: 'distance', groupBy: 'month', items: [] }
}

export async function getStravaAnalyticsYearly() {
  const response = await api.get('/strava/analytics/yearly')
  return extractApiPayload(response) || { items: [] }
}

export async function getStravaAnalyticsInsights(params = {}) {
  const response = await api.get('/strava/analytics/insights', { params })
  return extractApiPayload(response) || null
}

export async function getStravaAnalyticsRecords(params = {}) {
  const response = await api.get('/strava/analytics/records', { params })
  return extractApiPayload(response) || { records: {} }
}

export async function getStravaAnalyticsTopActivities(params = {}) {
  const response = await api.get('/strava/analytics/top-activities', { params })
  return extractApiPayload(response) || { sortBy: 'distance', items: [] }
}

export async function getStravaAnalyticsYearlyRecords() {
  const response = await api.get('/strava/analytics/yearly-records')
  return extractApiPayload(response) || { items: [] }
}

export async function getStravaAnalyticsMilestones() {
  const response = await api.get('/strava/analytics/milestones')
  return extractApiPayload(response) || {
    distance: { currentValue: 0, achieved: [], next: null },
    activities: { currentValue: 0, achieved: [], next: null },
    activeDays: { currentValue: 0, achieved: [], next: null },
  }
}

export async function getStravaActivities(params = {}) {
  const response = await api.get('/strava/activities', { params })
  return extractApiPayload(response) || { items: [], pagination: { page: 1, pageSize: 20, pageCount: 1, total: 0 } }
}

export async function createStravaConnectUrl() {
  const frontendOrigin = typeof window !== 'undefined'
    ? String(window.location.origin || '').trim()
    : ''

  const response = await api.post('/strava/connect-url', {}, {
    headers: frontendOrigin
      ? { 'x-frontend-origin': frontendOrigin }
      : undefined,
  })
  return extractApiPayload(response)
}

export async function disconnectStrava() {
  const response = await api.post('/strava/disconnect')
  return extractApiPayload(response)
}

export async function startStravaSync(options = {}) {
  try {
    const response = await api.post('/strava/sync', {}, createRequestOptions(options))
    return mapJobEnvelope(response)
  } catch (error) {
    throw normalizeFitnessApiError(error, 'Không thể khởi tạo đồng bộ Strava.')
  }
}

export async function getCurrentStravaSyncJob(options = {}) {
  try {
    const response = await api.get('/strava/sync/current', createRequestOptions(options))
    return mapJobEnvelope(response)
  } catch (error) {
    throw normalizeFitnessApiError(error, 'Không thể tải trạng thái đồng bộ Strava.')
  }
}

export async function getStravaSyncJob(jobId, options = {}) {
  try {
    const response = await api.get(`/strava/sync/jobs/${jobId}`, createRequestOptions(options))
    return mapJobEnvelope(response)
  } catch (error) {
    throw normalizeFitnessApiError(error, 'Không thể tải chi tiết đồng bộ Strava.')
  }
}

export async function retryStravaSyncJob(jobId, options = {}) {
  try {
    const response = await api.post(`/strava/sync/jobs/${jobId}/retry`, {}, createRequestOptions(options))
    return mapJobEnvelope(response)
  } catch (error) {
    throw normalizeFitnessApiError(error, 'Không thể thử lại đồng bộ Strava.')
  }
}

export async function cancelStravaSyncJob(jobId, options = {}) {
  try {
    const response = await api.post(`/strava/sync/jobs/${jobId}/cancel`, {}, createRequestOptions(options))
    return mapJobEnvelope(response)
  } catch (error) {
    throw normalizeFitnessApiError(error, 'Không thể hủy đồng bộ Strava.')
  }
}

export function isStravaReconnectRequiredErrorCode(code) {
  return [
    'STRAVA_CONNECTION_REVOKED',
    'STRAVA_TOKEN_REFRESH_FAILED',
    'STRAVA_NOT_CONNECTED',
  ].includes(String(code || '').trim())
}
