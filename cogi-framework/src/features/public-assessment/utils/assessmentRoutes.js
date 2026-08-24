function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function buildPublicCampaignPath(tenantCode, campaignCode, suffix = '') {
  const tenant = encodeURIComponent(toText(tenantCode))
  const campaign = encodeURIComponent(toText(campaignCode))
  const normalizedSuffix = toText(suffix).replace(/^\/+/, '')
  if (!campaign) return '/'

  const basePath = tenant
    ? `/t/${tenant}/campaign/${campaign}`
    : `/campaign/${campaign}`

  return normalizedSuffix
    ? `${basePath}/${normalizedSuffix}`
    : basePath
}

export function buildCampaignPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignPath(tenantCode, campaignCode)
}

export function buildCampaignRegisterPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignPath(tenantCode, campaignCode, 'register')
}

export function buildCampaignVerifyPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignPath(tenantCode, campaignCode, 'verify')
}

export function buildCampaignSoundCheckPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignPath(tenantCode, campaignCode, 'sound-check')
}

export function buildCampaignTestPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignPath(tenantCode, campaignCode, 'test')
}

export function buildCampaignQualificationPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignPath(tenantCode, campaignCode, 'qualification')
}

export function buildCampaignResultPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignPath(tenantCode, campaignCode, 'result')
}

export function buildCampaignSpeakingPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignPath(tenantCode, campaignCode, 'speaking')
}

export function buildAssessmentRunnerPath(tenantCode, attemptId, options = {}) {
  const tenant = encodeURIComponent(toText(tenantCode))
  const attempt = encodeURIComponent(toText(attemptId))
  if (!attempt) return '/'
  return tenant
    ? `/t/${tenant}/assessment-runner/${attempt}`
    : `/assessment-runner/${attempt}`
}

export function buildAssessmentRunnerResultPath(tenantCode, attemptId, options = {}) {
  const tenant = encodeURIComponent(toText(tenantCode))
  const attempt = encodeURIComponent(toText(attemptId))
  if (!attempt) return '/'
  return tenant
    ? `/t/${tenant}/assessment-runner/${attempt}/result`
    : `/assessment-runner/${attempt}/result`
}
