import { CAlert, CContainer } from '@coreui/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTenant } from '../../../contexts/TenantContext'
import AssessmentCampaignStartForm from '../components/AssessmentCampaignStartForm'
import { getApiMessage, getPublicAssessmentCampaign, resolvePublicAssessmentCampaign } from '../services/assessmentCampaignPublicService'
import { buildAssessmentRunnerPath, buildCampaignVerifyPath } from '../utils/assessmentRoutes'
import { getFlowState, setFlowState } from '../utils/assessmentFlowStorage'
import { OTP_RESEND_SECONDS } from '../utils/assessmentRuntime'
import { buildInitialBeforeStartValues, getCandidateDisplayName, getGradeValue, normalizeContactTarget } from '../utils/assessmentCampaignFlow'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function sanitizeBeforeStartValues(values = {}) {
  return Object.entries(values || {}).reduce((result, [key, value]) => {
    if (String(key || '').startsWith('__')) return result
    result[key] = value
    return result
  }, {})
}

export default function AssessmentRegistrationPage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const flowState = getFlowState()
  const resolvedTenantCode = useMemo(() => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(), [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode])

  useEffect(() => {
    let cancelled = false
    async function loadCampaign() {
      setLoading(true)
      setError('')
      try {
        const payload = await getPublicAssessmentCampaign(campaignCode, resolvedTenantCode)
        if (cancelled) return
        setCampaign(payload)
      } catch (requestError) {
        if (cancelled) return
        setCampaign(null)
        setError(getApiMessage(requestError, 'Chiến dịch đánh giá này hiện chưa tồn tại hoặc chưa sẵn sàng.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (campaignCode) loadCampaign()
    return () => { cancelled = true }
  }, [campaignCode, resolvedTenantCode])

  if (loading) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CAlert color='info' className='mb-0'>Đang tải cấu hình chiến dịch đánh giá...</CAlert>
      </CContainer>
    )
  }

  if (!campaign) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CAlert color='warning' className='mb-0'>{error || 'Chiến dịch đánh giá này hiện chưa tồn tại hoặc chưa sẵn sàng.'}</CAlert>
      </CContainer>
    )
  }

  const brandName = toText(tenant?.currentTenant?.tenantShortName || tenant?.currentTenant?.tenantName || tenant?.resolvedTenant?.tenantShortName || tenant?.resolvedTenant?.tenantName) || 'Vitaminfun'
  const initialValues = (() => {
    const saved = flowState
    if (saved?.campaignCode !== campaignCode || saved?.tenantCode !== tenantCode) return buildInitialBeforeStartValues(campaign)
    return { ...buildInitialBeforeStartValues(campaign), ...(saved?.beforeStartData || {}) }
  })()
  const resumeAvailable = Boolean(flowState?.campaignCode === campaignCode && flowState?.tenantCode === tenantCode && flowState?.participation?.attemptId && ['created', 'verified', 'ready', 'in_progress'].includes(String(flowState?.participation?.status || '')))

  async function handleValidSubmit(values) {
    setSubmitError('')
    setFieldErrors({})
    setSubmitting(true)
    const attributes = sanitizeBeforeStartValues(values)
    try {
      await resolvePublicAssessmentCampaign(campaignCode, { attributes }, resolvedTenantCode)
    } catch (requestError) {
      const details = requestError?.payload?.details || requestError?.response?.data?.error?.details || null
      const nextFieldErrors = Array.isArray(details?.fields)
        ? details.fields.reduce((result, item) => {
          if (item?.key) result[item.key] = item?.message || 'Dữ liệu chưa hợp lệ.'
          return result
        }, {})
        : {}
      if (Object.keys(nextFieldErrors).length > 0) setFieldErrors(nextFieldErrors)
      const message = getApiMessage(requestError, 'Không thể xác thực cấu hình chiến dịch.')
      if (message === 'NO_MATCH') setSubmitError('Hiện chưa tìm thấy bài đánh giá phù hợp với dữ liệu đã nhập. Vui lòng kiểm tra lại hoặc liên hệ VitaminFun.')
      else if (message === 'AMBIGUOUS_MATCH') setSubmitError('Hiện hệ thống chưa thể xác định bài đánh giá phù hợp. Vui lòng liên hệ VitaminFun để được hỗ trợ.')
      else if (message === 'INVALID_GRADE') setSubmitError('Lớp đã chọn chưa hợp lệ.')
      else if (message === 'CAMPAIGN_NOT_STARTED') setSubmitError('Chiến dịch chưa bắt đầu.')
      else if (message === 'CAMPAIGN_PAUSED') setSubmitError('Chiến dịch đang tạm dừng.')
      else if (message === 'CAMPAIGN_ENDED') setSubmitError('Chiến dịch đã kết thúc.')
      else setSubmitError(message)
      setSubmitting(false)
      return
    }
    const contactTarget = normalizeContactTarget(attributes)
    const nextState = {
      tenantCode,
      campaignCode,
      campaign,
      beforeStartData: attributes,
      verification: {
        method: contactTarget.type,
        target: contactTarget.value,
        emailVerified: contactTarget.type === 'email' ? false : true,
        phoneVerified: contactTarget.type === 'phone' ? true : false,
        verifiedAt: null,
        failedAttempts: 0,
        lockedUntil: 0,
        resendAvailableAt: Math.floor(Date.now() / 1000) + OTP_RESEND_SECONDS,
      },
      assessment: {
        soundConfirmed: false,
        finished: false,
        qualificationCompleted: false,
        resultStatus: null,
      },
      candidate: {
        name: getCandidateDisplayName(attributes),
        grade: getGradeValue(attributes),
      },
      participation: {
        status: contactTarget.type === 'email' ? 'created' : 'verified',
        attemptId: null,
        attemptCode: null,
        participationCode: null,
        retakeAllowed: false,
        retakeReason: null,
        retakeCount: 0,
      },
      publicSession: {
        token: '',
        expiresAt: null,
        attemptId: null,
      },
    }
    setFlowState(nextState)
    navigate(buildCampaignVerifyPath(tenantCode, campaignCode, { isMainDomain: tenant?.isMainDomain }))
    setSubmitting(false)
  }

  return (
    <CContainer className='assessment-public-shell'>
      <div className='py-3 py-md-4'>
        <AssessmentCampaignStartForm campaign={campaign} brandName={brandName} initialValues={initialValues} submitting={submitting} submitError={submitError} fieldErrors={fieldErrors} onValidSubmit={handleValidSubmit} resumeAvailable={resumeAvailable} onResume={() => navigate(buildAssessmentRunnerPath(resolvedTenantCode, flowState?.participation?.attemptId))} />
      </div>
    </CContainer>
  )
}
