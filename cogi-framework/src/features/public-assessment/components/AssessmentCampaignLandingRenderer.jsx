import { useMemo } from 'react'
import { sanitizeHtml } from '../../../pages/journal/journalPublicUtils'

const START_MARKER = '{{start}}'
const RECOVERY_MARKER = '{{recovery}}'
const TITLE_MARKER = '{{publicTitle}}'
const DESCRIPTION_MARKER = '{{publicDescription}}'
const ACTION_MARKER_REGEX = /(\{\{start\}\}|\{\{recovery\}\})/g

const DEFAULT_LANDING_HTML = `
<section class="assessment-landing-block">
  <div class="assessment-badge mb-3">ĐÁNH GIÁ NĂNG LỰC</div>
  <h1 style="margin:0 0 16px;">{{publicTitle}}</h1>
  <p style="margin:0 0 20px;line-height:1.7;color:#5a6477;">{{publicDescription}}</p>
  <div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 28px;">
    {{start}}
    {{recovery}}
  </div>
</section>
<section class="assessment-trust-panel">
  <div class="assessment-section-title mb-3">Bài đánh giá gồm những gì?</div>
  <div class="assessment-trust-list">
    <div class="assessment-trust-item"><div class="assessment-trust-icon">1</div><div class="assessment-domain-copy">Bài đánh giá được lựa chọn dựa trên thông tin bạn cung cấp.</div></div>
    <div class="assessment-trust-item"><div class="assessment-trust-icon">2</div><div class="assessment-domain-copy">Nội dung có thể gồm nhiều phần và kỹ năng khác nhau.</div></div>
    <div class="assessment-trust-item"><div class="assessment-trust-icon">3</div><div class="assessment-domain-copy">Sau khi hoàn thành, bạn có thể xem kết quả theo quy trình của chiến dịch.</div></div>
  </div>
</section>
`.trim()

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function escapeHtmlText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function getAssessmentCampaignPublicTitle(campaign) {
  return toText(campaign?.publicTitle) || 'Kiểm tra trình độ'
}

export function getAssessmentCampaignPublicDescription(campaign) {
  return toText(campaign?.publicDescription) || 'Thực hiện bài đánh giá ngắn để xác định mức hiện tại và nhận thông tin kết quả phù hợp.'
}

export function getAssessmentCampaignLandingHtml(campaign) {
  return toText(campaign?.landingHtml || campaign?.publicContent)
}

export function getDefaultAssessmentCampaignLandingHtml() {
  return DEFAULT_LANDING_HTML
}

function interpolateContentTokens(html, campaign) {
  return String(html || '')
    .split(TITLE_MARKER).join(escapeHtmlText(getAssessmentCampaignPublicTitle(campaign)))
    .split(DESCRIPTION_MARKER).join(escapeHtmlText(getAssessmentCampaignPublicDescription(campaign)))
}

function normalizeActionMarker(token) {
  if (token === START_MARKER) return 'start'
  if (token === RECOVERY_MARKER) return 'recovery'
  return ''
}

function buildRenderParts(rawHtml, campaign) {
  return String(rawHtml || '')
    .split(ACTION_MARKER_REGEX)
    .map((part) => {
      const marker = normalizeActionMarker(part)
      if (marker) {
        return { type: 'action', marker }
      }

      const sanitizedHtml = sanitizeHtml(interpolateContentTokens(part, campaign))
      return {
        type: 'html',
        html: sanitizedHtml,
      }
    })
    .filter((part) => part.type === 'action' || toText(part.html))
}

function hasRenderableParts(parts) {
  return parts.some((part) => part.type === 'action' || toText(part.html))
}

export function buildAssessmentCampaignLandingRenderModel(campaign, options = {}) {
  const customHtml = toText(options?.html ?? getAssessmentCampaignLandingHtml(campaign))
  const sourceHtml = customHtml || DEFAULT_LANDING_HTML
  const parts = buildRenderParts(sourceHtml, campaign)

  if (hasRenderableParts(parts)) {
    return {
      parts,
      usedFallback: !customHtml,
      usedCustomHtml: Boolean(customHtml),
      hasStartMarker: parts.some((part) => part.type === 'action' && part.marker === 'start'),
      hasRecoveryMarker: parts.some((part) => part.type === 'action' && part.marker === 'recovery'),
    }
  }

  if (customHtml) {
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error('[assessment-campaign] landingHtml produced no renderable content, falling back to default template')
    }
  }

  const fallbackParts = buildRenderParts(DEFAULT_LANDING_HTML, campaign)
  return {
    parts: fallbackParts,
    usedFallback: true,
    usedCustomHtml: false,
    hasStartMarker: fallbackParts.some((part) => part.type === 'action' && part.marker === 'start'),
    hasRecoveryMarker: fallbackParts.some((part) => part.type === 'action' && part.marker === 'recovery'),
  }
}

export default function AssessmentCampaignLandingRenderer({
  campaign,
  html,
  renderStartAction,
  renderRecoveryAction,
  className = '',
}) {
  const model = useMemo(
    () => buildAssessmentCampaignLandingRenderModel(campaign, { html }),
    [campaign, html],
  )

  return (
    <div className={['assessment-landing-renderer', className].filter(Boolean).join(' ')}>
      {model.parts.map((part, index) => {
        if (part.type === 'action') {
          if (part.marker === 'start') return renderStartAction?.(index) || null
          if (part.marker === 'recovery') return renderRecoveryAction?.(index) || null
          return null
        }

        return (
          <div
            key={`html:${index}`}
            className='assessment-landing-fragment'
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        )
      })}
    </div>
  )
}