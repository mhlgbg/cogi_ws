import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CCard,
  CCardBody,
  CCardHeader,
  CSpinner,
} from '@coreui/react'
import { useParams } from 'react-router-dom'
import { useTenant } from '../../contexts/TenantContext'
import useTenantPageTitle from '../../utils/useTenantPageTitle'
import { extractTemplateFields } from '../admission/form-renderer/schema'
import PublicLeadForm from '../../components/public/PublicLeadForm'
import { getPublicPageBySlug } from '../../modules/content-management/services/publicPageService'

function normalizeText(value) {
  return String(value || '').trim()
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function renderHtmlBlock(html, key) {
  const source = String(html || '')
  if (!source.trim()) return null
  return <div key={key} className='public-page-html-content' dangerouslySetInnerHTML={{ __html: source }} />
}

function buildShortcodeSections(contentHtml) {
  const token = '[LEAD_FORM]'
  const source = String(contentHtml || '')
  const parts = source.split(token)
  return {
    parts,
    hasToken: parts.length > 1,
  }
}

export default function PublicPageDetailPage() {
  const tenant = useTenant()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const slug = String(params?.slug || '').trim()
  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()

  useTenantPageTitle(page?.seoTitle || page?.title || '')

  useEffect(() => {
    let cancelled = false

    async function loadPage() {
      if (!slug) {
        setPage(null)
        setErrorMessage('Slug trang không hợp lệ')
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {
        const payload = await getPublicPageBySlug(slug)
        if (cancelled) return
        const nextPage = Array.isArray(payload?.data) ? payload.data[0] || null : payload?.data || null
        if (!nextPage) {
          setPage(null)
          setErrorMessage('Không tìm thấy PublicPage')
          return
        }

        console.info('[PublicPageDetailPage] loaded page', {
          pageId: nextPage?.id || null,
          slug: nextPage?.slug || slug,
          leadCampaignId: nextPage?.leadCampaign?.id || null,
          leadCampaignStatus: nextPage?.leadCampaign?.leadCampaignStatus || nextPage?.leadCampaign?.status || null,
          formTemplateId: nextPage?.leadCampaign?.formTemplate?.id || null,
          hasFormTemplateSchema: Boolean(nextPage?.leadCampaign?.formTemplate?.schema),
          pageType: nextPage?.pageType || null,
        })

        setPage(nextPage)
      } catch (error) {
        if (cancelled) return
        setPage(null)
        setErrorMessage(getApiMessage(error, 'Không tải được PublicPage'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPage()

    return () => {
      cancelled = true
    }
  }, [slug, tenantCode])

  const formFields = useMemo(
    () => extractTemplateFields(page?.leadCampaign?.formTemplate?.schema),
    [page?.leadCampaign?.formTemplate?.schema],
  )

  const normalizedLeadCampaignStatus = String(page?.leadCampaign?.leadCampaignStatus || page?.leadCampaign?.status || '').trim().toLowerCase()

  const canRenderLeadForm = Boolean(page?.leadCampaign?.id)
    && (normalizedLeadCampaignStatus === 'active' || normalizedLeadCampaignStatus === 'published')
    && Boolean(page?.leadCampaign?.formTemplate)

  console.info('[PublicPageDetailPage] lead form eligibility', {
    pageId: page?.id || null,
    pageType: page?.pageType || null,
    leadCampaignId: page?.leadCampaign?.id || null,
    normalizedLeadCampaignStatus,
    hasFormTemplate: Boolean(page?.leadCampaign?.formTemplate),
    fieldCount: formFields.length,
    canRenderLeadForm,
  })

  function renderLeadFormElement(key = 'lead-form') {
    if (!canRenderLeadForm) return null

    return (
      <PublicLeadForm
        key={key}
        campaign={page?.leadCampaign}
        formTemplate={page?.leadCampaign?.formTemplate}
        successMessage={page?.leadCampaign?.successMessage}
      />
    )
  }

  const shortcodeSections = useMemo(() => buildShortcodeSections(page?.contentHtml || ''), [page?.contentHtml])
  const shouldUseShortcode = canRenderLeadForm && page?.leadFormPosition === 'shortcode' && shortcodeSections.hasToken
  const shouldRenderTop = canRenderLeadForm && page?.leadFormPosition === 'top'
  const shouldRenderBottom = canRenderLeadForm && (!shouldUseShortcode && page?.leadFormPosition !== 'top')

  return (
    <CCard className='public-page-detail'>
      <CCardHeader>
        <strong>{page?.title || slug || 'Public Page'}</strong>
      </CCardHeader>
      <CCardBody>
        {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải nội dung...</span>
          </div>
        ) : null}

        {!loading && page ? (
          <div className='d-flex flex-column gap-4'>
            {shouldRenderTop ? renderLeadFormElement('lead-form-top') : null}

            {shouldUseShortcode ? (
              <div className='d-flex flex-column gap-4'>
                {shortcodeSections.parts.map((part, index) => (
                  <div key={`content-part-${index}`}>
                    {renderHtmlBlock(part, `html-${index}`)}
                    {index < shortcodeSections.parts.length - 1 ? renderLeadFormElement(`lead-form-shortcode-${index}`) : null}
                  </div>
                ))}
              </div>
            ) : (
              renderHtmlBlock(page.contentHtml, 'content-html')
            )}

            {shouldRenderBottom ? renderLeadFormElement('lead-form-bottom') : null}
          </div>
        ) : null}
      </CCardBody>
    </CCard>
  )
}
