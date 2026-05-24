import { useEffect, useMemo, useState } from 'react'
import { useTenant } from '../../../contexts/TenantContext'
import { getPublicAdmissionCampaign } from '../services/admissionV1Service'

function resolveTenantDisplayName(tenantContext) {
  return String(
    tenantContext?.resolvedTenant?.tenantName
    || tenantContext?.currentTenant?.tenantName
    || tenantContext?.resolvedTenant?.tenantCode
    || tenantContext?.currentTenant?.tenantCode
    || '',
  ).trim()
}

function hasCampaignTenant(campaign) {
  return Boolean(campaign?.tenant?.name || campaign?.tenant?.note)
}

export default function AdmissionV1Hero({ campaign, campaignCode, resolvedTenantCode = '', allowAutoLoad = true }) {
  const tenant = useTenant()
  const [heroCampaign, setHeroCampaign] = useState(campaign || null)

  useEffect(() => {
    let isCancelled = false

    if (campaign) {
      setHeroCampaign(campaign)
      return () => {
        isCancelled = true
      }
    }

    if (!allowAutoLoad) {
      setHeroCampaign(null)
      return () => {
        isCancelled = true
      }
    }

    async function loadCampaign() {
      if (!campaignCode) {
        if (!isCancelled) {
          setHeroCampaign(campaign || null)
        }
        return
      }

      try {
        const payload = await getPublicAdmissionCampaign(campaignCode, resolvedTenantCode)
        if (isCancelled) return
        setHeroCampaign(payload || campaign || null)
      } catch {
        if (isCancelled) return
        setHeroCampaign(campaign || null)
      }
    }

    loadCampaign()

    return () => {
      isCancelled = true
    }
  }, [allowAutoLoad, campaign, campaignCode, resolvedTenantCode])

  const tenantName = useMemo(
    () => String(heroCampaign?.tenant?.name || resolveTenantDisplayName(tenant)).trim(),
    [heroCampaign?.tenant?.name, tenant],
  )
  const tenantNote = String(heroCampaign?.tenant?.note || '').trim()
  const tenantLogoUrl = String(tenant?.currentTenant?.tenantLogoUrl || tenant?.resolvedTenant?.tenantLogoUrl || '').trim()

  return (
    <div className='admission-v1-hero mb-4 mb-lg-5'>
      <div className='admission-v1-hero-head'>
        <div className='admission-v1-brand-mark'>
          {tenantLogoUrl ? <img src={tenantLogoUrl} alt={tenantName || 'Tenant logo'} className='admission-v1-tenant-logo' /> : <div className='admission-v1-brand-fallback'>Admission V1</div>}
        </div>
        <div className='admission-v1-hero-copy'>
          <h1 className='admission-v1-hero-title'>{tenantName}</h1>
          {tenantNote ? <div className='fw-semibold fs-5 mt-3'>{tenantNote}</div> : null}
          <p className='admission-v1-hero-subtitle'>
            Trang web tuyển sinh trực tuyến.
          </p>
        </div>
      </div>
    </div>
  )
}
