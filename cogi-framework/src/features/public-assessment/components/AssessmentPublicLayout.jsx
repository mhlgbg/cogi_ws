import React from 'react'
import { CContainer } from '@coreui/react'
import { Outlet } from 'react-router-dom'
import { useMemo } from 'react'
import { useTenant } from '../../../contexts/TenantContext'
import { getTenantConfigByKey } from '../../../modules/content-management/services/tenantConfigService'
import './assessment-public.css'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toInitials(input) {
  const text = toText(input)
  if (!text) return 'T'
  return text.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'T'
}

function normalizeHtmlContent(config) {
  const directHtml = toText(config?.html)
  if (directHtml) return directHtml
  return toText(config?.jsonContent?.html)
}

function normalizeContactInfo(config) {
  const json = config?.jsonContent && typeof config.jsonContent === 'object' ? config.jsonContent : {}
  return {
    hotline: toText(json.hotline || json.supportPhone || json.contactPhone),
    email: toText(json.email || json.contactEmail || json.supportEmail),
    address: toText(json.address || json.contactAddress),
    website: toText(json.website || json.supportWebsite),
  }
}

export default function AssessmentPublicLayout() {
  const tenant = useTenant()
  const tenantCode = toText(tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode)
  const tenantName = toText(tenant?.currentTenant?.tenantShortName || tenant?.currentTenant?.tenantName || tenant?.resolvedTenant?.tenantShortName || tenant?.resolvedTenant?.tenantName || tenantCode || 'Tenant')
  const tenantLogoUrl = toText(tenant?.currentTenant?.tenantLogoUrl || tenant?.resolvedTenant?.tenantLogoUrl)

  const [footerHtml, setFooterHtml] = React.useState('')
  const [contactInfo, setContactInfo] = React.useState({ hotline: '', email: '', address: '', website: '' })

  React.useEffect(() => {
    let cancelled = false
    async function loadConfig() {
      try {
        const [footerConfig, homepageLayoutConfig] = await Promise.all([
          getTenantConfigByKey('footerHtml', { tenantCode }),
          getTenantConfigByKey('homepageLayout', { tenantCode }),
        ])
        if (cancelled) return
        setFooterHtml(normalizeHtmlContent(footerConfig))
        setContactInfo(normalizeContactInfo(homepageLayoutConfig))
      } catch {
        if (cancelled) return
        setFooterHtml('')
        setContactInfo({ hotline: '', email: '', address: '', website: '' })
      }
    }
    if (tenantCode) loadConfig()
    return () => { cancelled = true }
  }, [tenantCode])

  const contactLine = useMemo(() => [contactInfo.hotline, contactInfo.email, contactInfo.website].filter(Boolean).join(' · '), [contactInfo])

  return (
    <div className='assessment-public'>
      <header className='assessment-public-header'>
        <CContainer className='assessment-public-shell'>
          <div className='assessment-public-header-inner'>
            <div className='assessment-public-brand'>
              {tenantLogoUrl ? <img src={tenantLogoUrl} alt={tenantName} className='assessment-public-brand-logo' /> : <div className='assessment-public-brand-logo assessment-public-brand-logo-fallback'>{toInitials(tenantName)}</div>}
              <div className='assessment-public-brand-copy'>
                <div className='assessment-public-brand-name'>{tenantName}</div>
              </div>
            </div>
            {contactInfo.hotline ? <div className='assessment-public-contact'>Hotline: {contactInfo.hotline}</div> : null}
          </div>
        </CContainer>
      </header>

      <main className='assessment-public-main'>
        <Outlet />
      </main>

      <footer className='assessment-public-footer'>
        <CContainer className='assessment-public-shell'>
          {footerHtml ? <div className='assessment-public-footer-html' dangerouslySetInnerHTML={{ __html: footerHtml }} /> : (
            <div className='assessment-public-footer-fallback'>
              <div className='assessment-public-footer-title'>{tenantName}</div>
              {contactLine ? <div className='assessment-public-footer-copy'>{contactLine}</div> : null}
              {contactInfo.address ? <div className='assessment-public-footer-copy'>{contactInfo.address}</div> : null}
            </div>
          )}
        </CContainer>
      </footer>
    </div>
  )
}
