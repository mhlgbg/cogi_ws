function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function buildPublicCampaignTenantPath(tenantCode, campaignCode, suffix = '') {
  const tenant = encodeURIComponent(toText(tenantCode))
  const campaign = encodeURIComponent(toText(campaignCode))
  const normalizedSuffix = toText(suffix).replace(/^\/+/, '')
  if (!tenant || !campaign) return '/'
  return normalizedSuffix
    ? `/t/${tenant}/campaign/${campaign}/${normalizedSuffix}`
    : `/t/${tenant}/campaign/${campaign}`
}

export function buildCampaignPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignTenantPath(tenantCode, campaignCode)
}

export function buildCampaignRegisterPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignTenantPath(tenantCode, campaignCode, 'register')
}

export function buildCampaignVerifyPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignTenantPath(tenantCode, campaignCode, 'verify')
}

export function buildCampaignSoundCheckPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignTenantPath(tenantCode, campaignCode, 'sound-check')
}

export function buildCampaignTestPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignTenantPath(tenantCode, campaignCode, 'test')
}

export function buildCampaignResultPath(tenantCode, campaignCode, options = {}) {
  return buildPublicCampaignTenantPath(tenantCode, campaignCode, 'result')
}
