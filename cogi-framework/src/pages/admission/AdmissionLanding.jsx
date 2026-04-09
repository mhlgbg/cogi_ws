import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CFormLabel,
  CRow,
  CSpinner,
} from '@coreui/react'
import api from '../../api/axios'

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
  const { tenantCode, campaignCode } = useParams()
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
    const normalizedTenantCode = encodeURIComponent(String(tenantCode || '').trim())
    return `/${normalizedTenantCode}/login?redirect=${encodeURIComponent(admissionRedirectPath)}`
  }, [admissionRedirectPath, tenantCode])

  useEffect(() => {
    let isCancelled = false

    async function loadTenant() {
      setLoading(true)
      setErrorMessage('')

      try {
        const [tenantResponse, campaignResponse] = await Promise.all([
          api.get(`/tenants/by-code/${encodeURIComponent(String(tenantCode || '').trim())}`),
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

    if (tenantCode && campaignCode) {
      loadTenant()
    } else {
      setLoading(false)
      setErrorMessage('Không tìm thấy kỳ tuyển sinh')
    }

    return () => {
      isCancelled = true
    }
  }, [tenantCode, campaignCode])

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
        tenantCode,
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
    <CContainer className="py-5">
      <CRow className="justify-content-center">
        <CCol md={7} lg={5}>
          <CCard className="shadow-sm border-0">
            <CCardHeader className="bg-white text-center border-0 pt-4 pb-0">
              {tenant.logo ? (
                <div className="mb-3">
                  <img
                    src={tenant.logo}
                    alt={tenant.name || 'Tenant logo'}
                    style={{ maxHeight: 72, maxWidth: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : null}
              <div className="fs-4 fw-semibold">{tenant.name || 'Đăng ký tuyển sinh'}</div>
              {campaign.name ? <div className="fw-bold mt-3">{campaign.name}</div> : null}
              {resolvedCampaignDescription ? (
                hasHtmlContent(resolvedCampaignDescription)
                  ? (
                    <div
                      className="text-body-secondary small mt-2 text-start"
                      dangerouslySetInnerHTML={{ __html: resolvedCampaignDescription }}
                    />
                  )
                  : <div className="text-body-secondary small mt-2 text-start">{resolvedCampaignDescription}</div>
              ) : null}
              <div className="text-body-secondary mt-1">Đăng ký tuyển sinh</div>
            </CCardHeader>

            <CCardBody className="p-4 p-lg-5">
              {loading ? (
                <div className="text-center py-4">
                  <CSpinner />
                </div>
              ) : (
                <>
                  {successMessage ? <CAlert color="success">{successMessage}</CAlert> : null}
                  {existingUserMessage ? <CAlert color="info">{existingUserMessage}</CAlert> : null}
                  {errorMessage ? <CAlert color="danger">{errorMessage}</CAlert> : null}

                  <CForm onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <CFormLabel htmlFor="admission-fullName">Họ và tên</CFormLabel>
                      <CFormInput
                        id="admission-fullName"
                        name="fullName"
                        value={form.fullName}
                        onChange={handleChange}
                        placeholder="Nhập họ và tên phụ huynh"
                        required
                        disabled={submitting}
                      />
                    </div>

                    <div className="mb-3">
                      <CFormLabel htmlFor="admission-email">Email</CFormLabel>
                      <CFormInput
                        id="admission-email"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="Nhập email nhận thư mời"
                        required
                        disabled={submitting}
                      />
                    </div>

                    <div className="mb-4">
                      <CFormLabel htmlFor="admission-phone">Số điện thoại</CFormLabel>
                      <CFormInput
                        id="admission-phone"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="Nhập số điện thoại liên hệ"
                        required
                        disabled={submitting}
                      />
                    </div>

                    {existingUserMessage ? (
                      <div className="d-grid gap-2">
                        <CButton type="button" color="primary" onClick={handleLoginRedirect} disabled={submitting || loading}>
                          Đăng nhập
                        </CButton>
                      </div>
                    ) : (
                      <div className="d-grid">
                        <CButton type="submit" color="primary" disabled={submitting || loading || !campaignCode || !campaign.name}>
                          {submitting ? <CSpinner size="sm" className="me-2" /> : null}
                          Đăng ký ngay
                        </CButton>
                      </div>
                    )}
                  </CForm>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}