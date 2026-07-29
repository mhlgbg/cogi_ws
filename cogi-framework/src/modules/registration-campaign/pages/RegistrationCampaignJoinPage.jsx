import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CContainer,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CSpinner,
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import { buildTenantUrl } from '../../../utils/tenantRouting'
import { getApiMessage, getPublicRegistrationCampaign, submitPublicRegistration } from '../services/registrationCampaignPublicService'
import { getCampaignMediaUrl } from '../utils/registrationCampaignUi'
import './registration-campaign-join.css'

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase()
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function buildInitialForm(campaign) {
  const fields = Array.isArray(campaign?.formConfig?.fields) ? campaign.formConfig.fields : []
  const next = {
    fullName: '',
    email: '',
    phone: '',
    termsAccepted: false,
  }

  for (const field of fields) {
    if (!field?.key || ['fullName', 'email', 'phone'].includes(field.key)) continue
    next[field.key] = field.type === 'checkbox' ? [] : ''
  }

  return next
}

function getCampaignStateMessage(campaign) {
  const status = normalizeStatus(campaign?.status)
  if (status === 'draft') return 'Chiến dịch chưa được mở.'
  if (status === 'paused') return 'Chiến dịch đang tạm dừng nhận đăng ký.'
  if (status === 'closed') return 'Chiến dịch đã kết thúc nhận đăng ký.'
  if (status === 'cancelled') return 'Chiến dịch không còn hiệu lực.'
  return ''
}

function canShowForm(campaign) {
  const status = normalizeStatus(campaign?.status)
  if (status !== 'open') return false
  const now = Date.now()
  const startAt = campaign?.startAt ? new Date(campaign.startAt).getTime() : null
  const endAt = campaign?.endAt ? new Date(campaign.endAt).getTime() : null
  if (startAt && startAt > now) return false
  if (endAt && endAt < now) return false
  return true
}

function renderDynamicField(field, value, onChange) {
  if (field.type === 'textarea') {
    return <textarea className='form-control registration-campaign-join-control registration-campaign-join-control--textarea' rows={4} value={value || ''} onChange={(event) => onChange(field.key, event.target.value)} placeholder={field.placeholder || ''} />
  }
  if (field.type === 'select') {
    return (
      <select className='form-select registration-campaign-join-control' value={value || ''} onChange={(event) => onChange(field.key, event.target.value)}>
        <option value=''>{field.placeholder || 'Chọn giá trị'}</option>
        {(field.options || []).map((option) => <option key={`${field.key}:${option.value}`} value={option.value}>{option.label}</option>)}
      </select>
    )
  }
  if (field.type === 'radio') {
    return (
      <div className='d-flex flex-column gap-2'>
        {(field.options || []).map((option) => (
          <CFormCheck key={`${field.key}:${option.value}`} type='radio' name={field.key} label={option.label} checked={String(value || '') === String(option.value)} onChange={() => onChange(field.key, option.value)} />
        ))}
      </div>
    )
  }
  if (field.type === 'checkbox') {
    const values = Array.isArray(value) ? value : []
    return (
      <div className='d-flex flex-column gap-2 registration-campaign-join-checkbox-group'>
        {(field.options || []).map((option) => (
          <CFormCheck
            key={`${field.key}:${option.value}`}
            type='checkbox'
            label={option.label}
            checked={values.includes(option.value)}
            onChange={(event) => {
              const nextValues = event.target.checked
                ? [...values, option.value]
                : values.filter((item) => item !== option.value)
              onChange(field.key, nextValues)
            }}
          />
        ))}
      </div>
    )
  }
  return <CFormInput className='registration-campaign-join-control' type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} value={value || ''} onChange={(event) => onChange(field.key, event.target.value)} placeholder={field.placeholder || ''} />
}

function getFieldClassName(field) {
  const key = String(field?.key || '').trim()
  const type = String(field?.type || '').trim().toLowerCase()
  const classes = ['registration-campaign-join-field']

  if (key === 'phone') {
    classes.push('registration-campaign-join-field--phone')
  }

  if (['textarea', 'checkbox', 'radio'].includes(type)) {
    classes.push('registration-campaign-join-field--full')
  }

  return classes.join(' ')
}

function getLeadDescription(campaign) {
  return String(campaign?.shortDescription || '').trim() || String(campaign?.description || '').trim()
}

function getBodyDescription(campaign) {
  const shortDescription = String(campaign?.shortDescription || '').trim()
  const description = String(campaign?.description || '').trim()
  if (!description || description === shortDescription) return ''
  return description
}

export default function RegistrationCampaignJoinPage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const resolvedTenantCode = useMemo(() => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(), [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode])
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(buildInitialForm(null))

  useEffect(() => {
    let cancelled = false
    async function loadCampaign() {
      setLoading(true)
      setError('')
      try {
        const payload = await getPublicRegistrationCampaign(campaignCode, resolvedTenantCode)
        if (cancelled) return
        setCampaign(payload)
        setForm(buildInitialForm(payload))
      } catch (requestError) {
        if (cancelled) return
        setCampaign(null)
        setError(getApiMessage(requestError, 'Không thể tải chiến dịch đăng ký'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (campaignCode) loadCampaign()
    return () => { cancelled = true }
  }, [campaignCode, resolvedTenantCode])

  const fields = Array.isArray(campaign?.formConfig?.fields) ? campaign.formConfig.fields.filter((field) => field?.enabled !== false) : []
  const canRegister = canShowForm(campaign)
  const stateMessage = getCampaignStateMessage(campaign)
  const coverImageUrl = getCampaignMediaUrl(campaign?.coverImage)
  const leadDescription = getLeadDescription(campaign)
  const bodyDescription = getBodyDescription(campaign)
  const requiresTermsAcceptance = campaign?.requireTermsAcceptance === true
  const canSubmitRegistration = !submitting && (!requiresTermsAcceptance || form.termsAccepted === true)

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (requiresTermsAcceptance && form.termsAccepted !== true) {
      setError('Vui lòng đồng ý với điều khoản của chiến dịch trước khi gửi đăng ký.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const payload = {
        fullName: String(form.fullName || '').trim(),
        email: String(form.email || '').trim().toLowerCase(),
        phone: String(form.phone || '').trim(),
        termsAccepted: form.termsAccepted === true,
        formData: fields
          .filter((field) => !['fullName', 'email', 'phone'].includes(field.key))
          .reduce((accumulator, field) => ({
            ...accumulator,
            [field.key]: form[field.key],
          }), {}),
      }

      const result = await submitPublicRegistration(campaignCode, payload, resolvedTenantCode)
      if (result?.checkEmailPath) {
        navigate(result.checkEmailPath, {
          replace: true,
          state: {
            campaign,
            maskedEmail: result.maskedEmail,
            registrationToken: result.registrationToken,
            registration: result.registration,
            message: result.message,
          },
        })
        return
      }

      if (result?.loginPath) {
        navigate(result.loginPath, { replace: true })
        return
      }

      if (result?.completeAccountPath) {
        navigate(result.completeAccountPath, { replace: true })
        return
      }

      if (result?.redirectPath) {
        navigate(buildTenantUrl(result.redirectPath, { tenantCode: resolvedTenantCode, isMainDomain: tenant?.isMainDomain }), { replace: true })
        return
      }

      setError(result?.message || 'Không thể tiếp tục đăng ký')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gửi đăng ký'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='registration-campaign-join-page'>
      <CContainer>
        <div className='registration-campaign-join-shell'>
          <CCard className='registration-campaign-join-card'>
            <CCardBody className='registration-campaign-join-card-body'>
              {loading ? (
                <div className='registration-campaign-join-loading'>
                  <CSpinner />
                </div>
              ) : campaign ? (
                <>
                  {coverImageUrl ? <img className='registration-campaign-join-cover' src={coverImageUrl} alt={campaign.name || 'Campaign cover'} /> : null}

                  <div className='registration-campaign-join-header'>
                    <h1 className='registration-campaign-join-title'>{campaign.name || 'Chiến dịch đăng ký'}</h1>
                    {leadDescription ? <p className='registration-campaign-join-lead'>{leadDescription}</p> : null}
                  </div>

                  <div className='registration-campaign-join-meta'>
                    <div className='registration-campaign-join-meta-item'>
                      <span className='registration-campaign-join-meta-label'>Đơn vị:</span>
                      <span className='registration-campaign-join-meta-value'>{campaign.tenant?.name || '-'}</span>
                    </div>
                    <div className='registration-campaign-join-meta-item'>
                      <span className='registration-campaign-join-meta-label'>Thời gian:</span>
                      <span className='registration-campaign-join-meta-value'>{`${formatDateTime(campaign.startAt)} - ${formatDateTime(campaign.endAt)}`}</span>
                    </div>
                  </div>

                  {bodyDescription ? (
                    <div className='registration-campaign-join-description-wrap'>
                      <div className='registration-campaign-join-description-label'>Mô tả chi tiết</div>
                      <textarea
                        className='registration-campaign-join-description-box'
                        value={bodyDescription}
                        readOnly
                        aria-label='Mô tả chi tiết chiến dịch'
                      />
                    </div>
                  ) : null}
                  {error ? <CAlert color='danger' className='registration-campaign-join-alert'>{error}</CAlert> : null}

                  {!canRegister ? <CAlert color='warning' className='registration-campaign-join-alert'>{stateMessage || 'Chiến dịch hiện chưa thể nhận đăng ký.'}</CAlert> : null}

                  {canRegister ? (
                    <div className='registration-campaign-join-form-section'>
                      <div className='registration-campaign-join-section-title'>Thông tin đăng ký</div>

                      <CForm className='registration-campaign-join-form' onSubmit={handleSubmit}>
                        <div className='registration-campaign-join-grid'>
                          {fields.map((field) => (
                            <div className={getFieldClassName(field)} key={field.key}>
                              <CFormLabel className='registration-campaign-join-label'>
                                {field.label || field.key}
                                {field.required ? <span className='registration-campaign-join-required'> *</span> : null}
                              </CFormLabel>
                              <div className='registration-campaign-join-control-wrap'>
                                {['fullName', 'email', 'phone'].includes(field.key)
                                  ? <CFormInput className='registration-campaign-join-control' type={field.key === 'email' ? 'email' : 'text'} value={form[field.key] || ''} onChange={(event) => updateField(field.key, event.target.value)} placeholder={field.placeholder || ''} />
                                  : renderDynamicField(field, form[field.key], updateField)}
                              </div>
                              {field.helpText ? <div className='registration-campaign-join-help'>{field.helpText}</div> : null}
                            </div>
                          ))}

                          {campaign.requireTermsAcceptance ? (
                            <div className='registration-campaign-join-field registration-campaign-join-field--full'>
                              <div className='registration-campaign-join-terms'>
                                <div className='registration-campaign-join-terms-title'>Điều khoản</div>
                                <div className='registration-campaign-join-terms-content'>{campaign.termsContent || 'Bạn cần đồng ý với điều khoản để tiếp tục.'}</div>
                                <CFormCheck className='registration-campaign-join-terms-check' label='Tôi đồng ý với điều khoản của chiến dịch' checked={form.termsAccepted === true} onChange={(event) => updateField('termsAccepted', event.target.checked)} />
                                {!form.termsAccepted ? <div className='registration-campaign-join-terms-hint'>Bạn cần tích xác nhận trước khi gửi đăng ký.</div> : null}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className='registration-campaign-join-actions'>
                          <CButton className='registration-campaign-join-submit' type='submit' color='primary' disabled={!canSubmitRegistration}>
                            {submitting ? (
                              <span className='registration-campaign-join-submit-content'>
                                <CSpinner size='sm' className='registration-campaign-join-submit-spinner' />
                                <span>Đang gửi đăng ký...</span>
                              </span>
                            ) : 'Đăng ký tham gia'}
                          </CButton>
                        </div>
                      </CForm>
                    </div>
                  ) : null}
                </>
              ) : (
                <CAlert color='danger' className='mb-0'>Không tìm thấy chiến dịch đăng ký.</CAlert>
              )}
            </CCardBody>
          </CCard>
        </div>
      </CContainer>
    </div>
  )
}