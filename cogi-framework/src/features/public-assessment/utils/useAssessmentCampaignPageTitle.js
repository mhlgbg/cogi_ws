import useTenantPageTitle from '../../../utils/useTenantPageTitle'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function resolveAssessmentCampaignPageTitle(campaign, fallbackTitle = '') {
  return toText(campaign?.seoTitle)
    || toText(campaign?.title)
    || toText(campaign?.publicTitle)
    || toText(campaign?.name)
    || toText(fallbackTitle)
}

export default function useAssessmentCampaignPageTitle(campaign, fallbackTitle = '') {
  useTenantPageTitle(resolveAssessmentCampaignPageTitle(campaign, fallbackTitle))
}