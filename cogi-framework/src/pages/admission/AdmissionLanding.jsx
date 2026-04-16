import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CCol,
  CContainer,
  CRow,
} from '@coreui/react'
import api from '../../api/axios'
import { useTenant } from '../../contexts/TenantContext'
import './AdmissionLanding.css'
import {
  AdmissionForm,
  AdmissionInfoPanel,
  AdmissionTopHeader,
} from './AdmissionLandingSections'
import { buildTenantUrl, isBrowserOnMainDomain } from '../../utils/tenantRouting'

function toAbsoluteUrl(url) {
  const rawUrl = String(url || '').trim()
  if (!rawUrl) return ''
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl

  try {
    const apiBase = String(api.defaults.baseURL || window.location.origin)
    const origin = new URL(apiBase, window.location.origin).origin
    return new URL(rawUrl, origin).toString()
  } catch {
    return rawUrl
  }
}

function hasHtmlContent(value) {
  return /<[^>]+>/.test(String(value || ''))
}

function resolveCampaignDescription(description, tenant, campaign) {
  const tenantLogo = toAbsoluteUrl(tenant?.logo || '')

  return String(description || '')
    .split('{{tenantLogo}}').join(tenantLogo)
    .split('{{tenantName}}').join(String(tenant?.name || ''))
    .split('{{campaignName}}').join(String(campaign?.name || ''))
}

const INITIAL_FORM = {
  fullName: '',
  email: '',
  phone: '',
}

export default function AdmissionLanding() {
  const navigate = useNavigate()
  const tenantContext = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const resolvedTenantCode = String(
    tenantCode
    || tenantContext?.resolvedTenant?.tenantCode
    || tenantContext?.currentTenant?.tenantCode
    || '',
  ).trim()
  const [tenant, setTenant] = useState({ name: '', logo: '', code: '' })
  const [campaign, setCampaign] = useState({ name: '', description: '', code: '' })
  const [form, setForm] = useState(INITIAL_FORM)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [existingUserMessage, setExistingUserMessage] = useState('')
  const resolvedCampaignDescription = resolveCampaignDescription(campaign.description, tenant, campaign)
  const admissionRedirectPath = useMemo(
    () => `/admission/${encodeURIComponent(String(campaignCode || '').trim())}`,
    [campaignCode],
  )
  const loginPath = useMemo(() => {
    const tenantLoginPath = buildTenantUrl('/login', {
      tenantCode: resolvedTenantCode,
      isMainDomain: isBrowserOnMainDomain(),
    }) || '/login'
    return `${tenantLoginPath}?redirect=${encodeURIComponent(admissionRedirectPath)}`
  }, [admissionRedirectPath, resolvedTenantCode])

  useEffect(() => {
    let isCancelled = false

    async function loadTenant() {
      setLoading(true)
      setErrorMessage('')

      try {
        const [tenantResponse, campaignResponse] = await Promise.all([
          api.get(`/tenants/by-code/${encodeURIComponent(resolvedTenantCode)}`),
          api.get(`/admission-campaigns/by-code/${encodeURIComponent(String(campaignCode || '').trim())}`),
        ])
        if (isCancelled) return

        setTenant({
          name: String(tenantResponse?.data?.name || '').trim(),
          code: String(tenantResponse?.data?.code || '').trim(),
          logo: toAbsoluteUrl(tenantResponse?.data?.logoUrl || tenantResponse?.data?.logo?.url || ''),
        })

        setCampaign({
          name: String(campaignResponse?.data?.name || '').trim(),
          code: String(campaignResponse?.data?.code || '').trim(),
          description: String(campaignResponse?.data?.description || '').trim(),
        })
      } catch (error) {
        if (isCancelled) return

        if (error?.response?.status === 404 && String(campaignCode || '').trim()) {
          setCampaign({ name: '', description: '', code: '' })
          setErrorMessage('Không tìm thấy kỳ tuyển sinh')
          return
        }

        const apiMessage =
          error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          'Không thể tải thông tin đơn vị tuyển sinh'

        setErrorMessage(apiMessage)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    if (resolvedTenantCode && campaignCode) {
      loadTenant()
    } else {
      setLoading(false)
      setErrorMessage('Không tìm thấy kỳ tuyển sinh')
    }

    return () => {
      isCancelled = true
    }
  }, [resolvedTenantCode, campaignCode])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    if (successMessage) setSuccessMessage('')
    if (errorMessage) setErrorMessage('')
    if (existingUserMessage) setExistingUserMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setExistingUserMessage('')

    const fullName = form.fullName.trim()
    const email = form.email.trim().toLowerCase()
    const phone = form.phone.trim()

    if (!fullName || !email || !phone) {
      setErrorMessage('Vui lòng nhập đầy đủ họ tên, email và số điện thoại')
      return
    }

    if (!campaignCode) {
      setErrorMessage('Không tìm thấy kỳ tuyển sinh')
      return
    }

    setSubmitting(true)
    try {
      const response = await api.post('/auth/invite', {
        fullName,
        email,
        phone,
        tenantCode: resolvedTenantCode,
        campaignCode,
        templateCode: 'admission_invite',
      })

      const payload = response?.data || {}
      if (payload?.status === 'EXISTING_USER' && payload?.requireLogin === true) {
        setSuccessMessage(String(payload?.message || '').trim())
        setExistingUserMessage('Bạn đã có tài khoản. Vui lòng đăng nhập để tiếp tục đăng ký hồ sơ.')
        return
      }

      setForm(INITIAL_FORM)
      setSuccessMessage('Vui lòng kiểm tra email để kích hoạt tài khoản và tiếp tục đăng ký tuyển sinh')
    } catch (error) {
      const apiMessage =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Không thể gửi đăng ký tuyển sinh'

      setErrorMessage(apiMessage)
    } finally {
      setSubmitting(false)
    }
  }

  function handleLoginRedirect() {
    navigate(loginPath)
  }

  return (
    <div className='admission-landing-shell py-4 py-lg-5'>
      <CContainer fluid className='admission-landing-content px-3 px-lg-4'>
        <div className='mb-4 mb-lg-5'>
          <AdmissionTopHeader
            tenant={tenant}
            campaign={campaign}
            title='Tuyển sinh lớp 6 năm học 2026–2027'
          />
        </div>

        <CRow className='g-4 align-items-start'>
          <CCol xs={12} lg={5} xl={4}>
            <div className='admission-sticky-column'>
              <AdmissionInfoPanel
                tenant={tenant}
                campaign={campaign}
                title='Tuyển sinh lớp 6 năm học 2026–2027'
                description={resolvedCampaignDescription}
                hasHtmlContent={hasHtmlContent}
              />
            </div>
          </CCol>

          <CCol xs={12} lg={7} xl={8}>
            <AdmissionForm
              form={form}
              loading={loading}
              submitting={submitting}
              successMessage={successMessage}
              existingUserMessage={existingUserMessage}
              errorMessage={errorMessage}
              campaign={campaign}
              handleChange={handleChange}
              handleSubmit={handleSubmit}
              handleLoginRedirect={handleLoginRedirect}
            />
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}