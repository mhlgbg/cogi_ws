function toTimestamp(value) {
  const text = String(value || '').trim()
  if (!text) return null

  const timestamp = new Date(text).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function canParentViewExamCard(admissionCampaign, nowInput = new Date()) {
  if (!admissionCampaign || admissionCampaign.allowExamCardPrinting !== true) {
    return false
  }

  const now = new Date(nowInput).getTime()
  if (!Number.isFinite(now)) return false

  const startAt = toTimestamp(admissionCampaign.examCardPrintStartAt)
  if (startAt !== null && now < startAt) {
    return false
  }

  const endAt = toTimestamp(admissionCampaign.examCardPrintEndAt)
  if (endAt !== null && now > endAt) {
    return false
  }

  return true
}