import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CSpinner } from '@coreui/react'
import AssessmentCampaignCompletionForm from '../components/AssessmentCampaignCompletionForm'
import AssessmentCampaignRecoveryCard from '../components/AssessmentCampaignRecoveryCard'
import CandidateAssessmentResultView from '../components/CandidateAssessmentResultView'
import { completeAssessmentCampaignResultProfile, getApiMessage, getAssessmentCampaignResultGate, requestAssessmentCampaignOtp, restorePublicAssessmentAttemptAccess, startPublicAssessmentCampaignRetake } from '../services/assessmentCampaignPublicService'
import { getFlowState, patchFlowState } from '../utils/assessmentFlowStorage'
import { buildAssessmentRunnerPath } from '../utils/assessmentRoutes'
import { getAssessmentAttemptResult, getRuntimeApiMessage } from '../../../modules/assessments/services/assessmentRuntimeApi'
import '../components/assessment-public.css'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function mapPublicResultError(error, fallback = 'Không tải được kết quả đánh giá.') {
  const message = getApiMessage(error, fallback)
  if (message === 'PUBLIC_SESSION_EXPIRED') return 'Phiên xác thực của bạn đã hết hạn. Vui lòng xác thực lại để xem kết quả.'
  if (message === 'PUBLIC_SESSION_MISMATCH') return 'Bạn không có quyền xem kết quả của lượt làm bài này.'
  if (message === 'ATTEMPT_NOT_OWNED') return 'Bạn không có quyền truy cập lượt làm bài này.'
  if (message === 'ATTEMPT_NOT_FOUND') return 'Không tìm thấy lượt làm bài.'
  if (message === 'INVALID_EMAIL') return 'Email chưa đúng định dạng.'
  if (message === 'INVALID_OTP') return 'Mã OTP chưa đúng. Vui lòng thử lại.'
  if (message === 'CAMPAIGN_PARTICIPATION_NOT_FOUND') return 'Không thể xác định thông tin chiến dịch của lượt làm bài này. Vui lòng thử lại hoặc liên hệ VitaminFun.'
  if (message === 'You do not have access to this assessment attempt') return 'Bạn không có quyền xem kết quả của lượt làm bài này.'
  if (message === 'Unauthorized') return 'Phiên truy cập hiện không hợp lệ. Vui lòng xác thực lại để tiếp tục.'
  return message || fallback
}

export default function CandidateAssessmentResultPage() {
  const navigate = useNavigate()
  const { attemptId, tenantCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [retakeStarting, setRetakeStarting] = useState(false)
  const [payload, setPayload] = useState(null)
  const [gate, setGate] = useState(null)
  const [error, setError] = useState('')
  const [completionError, setCompletionError] = useState('')
  const [completionFieldErrors, setCompletionFieldErrors] = useState({})
  const [statusCode, setStatusCode] = useState('')
  const flowState = getFlowState()
  const publicSession = useMemo(() => {
    if (!flowState) return null
    const flowAttemptId = String(flowState?.publicSession?.attemptId || flowState?.participation?.attemptId || '')
    if (!flowAttemptId || flowAttemptId !== String(attemptId || '')) return null
    return {
      token: toText(flowState?.publicSession?.token),
      expiresAt: flowState?.publicSession?.expiresAt || null,
      campaignCode: flowState?.campaignCode || '',
      tenantCode: flowState?.tenantCode || tenantCode || '',
      verification: flowState?.verification || {},
    }
  }, [attemptId, flowState, tenantCode])

  const workflowState = payload?.workflowState || ''
  const canPoll = ['scoring', 'manual_scoring_pending', 'speaking_pending', 'speaking_in_review', 'confirmation_pending'].includes(workflowState)

  useEffect(() => {
    loadResult(true)
  }, [attemptId, publicSession?.token])

  useEffect(() => {
    if (!canPoll) return undefined
    const timerId = window.setInterval(() => {
      loadResult(false, true)
    }, 20000)
    return () => window.clearInterval(timerId)
  }, [attemptId, canPoll])

  async function loadResult(showLoading = false, silent = false) {
    if (showLoading) setLoading(true)
    if (!silent) {
      setError('')
      setCompletionError('')
      setRefreshing(true)
    }
    try {
      const gateTenantCode = publicSession?.tenantCode || tenantCode || flowState?.tenantCode || ''
      try {
        const nextGate = await getAssessmentCampaignResultGate(attemptId, gateTenantCode, publicSession?.token || '')
        setGate(nextGate)
        setPayload(nextGate?.candidateResult || null)
        setStatusCode('')
        return
      } catch (gateError) {
        const gateMessage = getApiMessage(gateError, '')
        if (gateMessage !== 'ATTEMPT_IS_NOT_CAMPAIGN') {
          throw gateError
        }
      }

      const next = await getAssessmentAttemptResult(attemptId)
      setGate(null)
      setPayload(next)
      setStatusCode('')
    } catch (requestError) {
      setPayload(null)
      setGate(null)
      const message = getApiMessage(requestError, '')
      setStatusCode(message)
      const shouldUsePublicError = ['PUBLIC_SESSION_EXPIRED', 'PUBLIC_SESSION_MISMATCH', 'CAMPAIGN_PARTICIPATION_NOT_FOUND'].includes(message)
      setError(shouldUsePublicError ? mapPublicResultError(requestError, 'Không tải được kết quả đánh giá.') : getRuntimeApiMessage(requestError, 'Không tải được kết quả đánh giá.'))
    } finally {
      if (showLoading) setLoading(false)
      if (!silent) setRefreshing(false)
    }
  }

  async function handleCompleteProfile(values) {
    if (!publicSession?.token) return
    setCompleting(true)
    setError('')
    setCompletionError('')
    setCompletionFieldErrors({})
    try {
      const nextGate = await completeAssessmentCampaignResultProfile(attemptId, { attributes: values }, publicSession?.tenantCode || tenantCode || '', publicSession.token)
      setGate(nextGate)
      setPayload(nextGate?.candidateResult || null)
      patchFlowState({
        publicSession: {
          ...(flowState?.publicSession || {}),
          token: publicSession.token,
          attemptId,
        },
      })
    } catch (requestError) {
      const details = requestError?.response?.data?.error?.details || null
      const nextFieldErrors = Array.isArray(details?.fields)
        ? details.fields.reduce((result, item) => {
          if (item?.key) result[item.key] = item?.message || 'Dữ liệu chưa hợp lệ.'
          return result
        }, {})
        : {}
      if (Object.keys(nextFieldErrors).length > 0) setCompletionFieldErrors(nextFieldErrors)
      setCompletionError(mapPublicResultError(requestError, 'Không thể lưu thông tin hoàn tất kết quả.'))
    } finally {
      setCompleting(false)
    }
  }

  async function handleRecoverAccess(values) {
    setRecovering(true)
    setError('')
    try {
      const restored = await restorePublicAssessmentAttemptAccess(attemptId, values, publicSession?.tenantCode || tenantCode || flowState?.tenantCode || '')
      patchFlowState({
        tenantCode: publicSession?.tenantCode || tenantCode || flowState?.tenantCode || '',
        campaignCode: restored?.campaign?.slug || publicSession?.campaignCode || flowState?.campaignCode || '',
        participation: {
          ...(flowState?.participation || {}),
          attemptId: restored?.attempt?.id || restored?.attempt?.documentId || attemptId,
          attemptCode: restored?.attempt?.code || flowState?.participation?.attemptCode || null,
          participationCode: restored?.participation?.code || flowState?.participation?.participationCode || null,
          status: restored?.participation?.status || flowState?.participation?.status || null,
          retakeAllowed: restored?.participation?.retakeAllowed === true,
          retakeReason: restored?.participation?.retakeReason || null,
          retakeCount: restored?.participation?.retakeCount || 0,
        },
        publicSession: {
          token: restored?.publicAccessToken || '',
          expiresAt: restored?.publicAccessExpiresAt || null,
          attemptId: restored?.attempt?.id || restored?.attempt?.documentId || attemptId,
        },
        verification: {
          ...(flowState?.verification || {}),
          method: 'email',
          target: values.email,
          emailVerified: true,
          phoneVerified: false,
          verifiedAt: new Date().toISOString(),
        },
      })
      await loadResult(false)
    } catch (requestError) {
      const message = getApiMessage(requestError, '')
      setStatusCode(message)
      setError(mapPublicResultError(requestError, 'Không thể xác thực để xem kết quả.'))
    } finally {
      setRecovering(false)
    }
  }

  async function handleRequestRecoverOtp(values) {
    return requestAssessmentCampaignOtp(publicSession?.campaignCode || flowState?.campaignCode || '', values, publicSession?.tenantCode || tenantCode || flowState?.tenantCode || '')
  }

  async function handleStartRetake() {
    if (!publicSession?.token) return
    setRetakeStarting(true)
    setError('')
    try {
      const next = await startPublicAssessmentCampaignRetake(attemptId, publicSession?.tenantCode || tenantCode || flowState?.tenantCode || '', publicSession.token)
      patchFlowState({
        participation: {
          ...(flowState?.participation || {}),
          attemptId: next?.attempt?.id || next?.attempt?.documentId || null,
          attemptCode: next?.attempt?.code || null,
          participationCode: next?.participation?.code || flowState?.participation?.participationCode || null,
          status: next?.participation?.status || null,
          retakeAllowed: false,
        },
        publicSession: {
          token: next?.publicAccessToken || '',
          expiresAt: next?.publicAccessExpiresAt || null,
          attemptId: next?.attempt?.id || next?.attempt?.documentId || null,
        },
      })
      navigate(buildAssessmentRunnerPath(publicSession?.tenantCode || tenantCode || flowState?.tenantCode || '', next?.attempt?.id || next?.attempt?.documentId))
    } catch (requestError) {
      setError(mapPublicResultError(requestError, 'Không thể bắt đầu lại bài đánh giá.'))
    } finally {
      setRetakeStarting(false)
    }
  }

  if (loading) {
    return <div className='py-4 d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải kết quả đánh giá...</span></div>
  }

  const shouldShowReverify = ['PUBLIC_SESSION_EXPIRED', 'PUBLIC_SESSION_MISMATCH', 'ATTEMPT_NOT_OWNED'].includes(statusCode)
  const shouldShowCompletion = Boolean(publicSession?.token && gate && gate?.canViewResult === false)
  const retakeAvailable = gate?.reason === 'RETAKE_AVAILABLE' || flowState?.participation?.retakeAllowed === true
  const cancelledResultState = gate?.reason === 'ATTEMPT_CANCELLED' || retakeAvailable
  const completionFields = Array.isArray(gate?.fields) ? gate.fields : []
  const completionInitialValues = completionFields.reduce((result, field) => {
    result[field.key] = field?.value ?? (field?.fieldType === 'checkbox' ? [] : '')
    return result
  }, {})

  return (
    <>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {shouldShowReverify ? <AssessmentCampaignRecoveryCard title='Xác thực để xem kết quả' description='Phiên truy cập hiện tại không còn hiệu lực hoặc chưa được khôi phục. Vui lòng nhập email đã dùng khi đăng ký và mã OTP để tiếp tục.' initialEmail={publicSession?.verification?.target || flowState?.verification?.target || ''} loading={recovering} error='' message='' onRequestOtp={handleRequestRecoverOtp} submitLabel='Xác thực và tiếp tục' onSubmit={handleRecoverAccess} /> : null}
      {!shouldShowReverify && gate?.reason === 'ATTEMPT_CANCELLED' ? <CAlert color='warning'>Lượt làm bài này đã được hủy.</CAlert> : null}
      {!shouldShowReverify && retakeAvailable ? <div className='mb-3'><CAlert color='info'>Bài đánh giá trước của bạn đã được hủy. VitaminFun đã cho phép bạn thực hiện lại bài đánh giá.</CAlert><button type='button' className='btn btn-primary' onClick={handleStartRetake} disabled={retakeStarting}>{retakeStarting ? 'Đang chuẩn bị...' : 'Bắt đầu làm lại'}</button></div> : null}
      {shouldShowCompletion ? <AssessmentCampaignCompletionForm fields={completionFields} initialValues={completionInitialValues} submitting={completing} submitError={completionError} fieldErrors={completionFieldErrors} onSubmit={handleCompleteProfile} /> : null}
      {!shouldShowCompletion && !payload && !cancelledResultState ? <CAlert color='warning'>Không tìm thấy lượt làm bài.</CAlert> : null}
      {!shouldShowCompletion && payload ? <CandidateAssessmentResultView payload={payload} refreshing={refreshing} onRefresh={() => loadResult(false)} onBack={() => navigate(buildAssessmentRunnerPath(publicSession?.tenantCode || tenantCode || flowState?.tenantCode || '', attemptId))} /> : null}
    </>
  )
}
