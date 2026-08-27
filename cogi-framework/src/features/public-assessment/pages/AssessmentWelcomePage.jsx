import { CAlert, CButton, CCard, CCardBody, CContainer } from '@coreui/react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AssessmentCampaignLandingRenderer, { getAssessmentCampaignPublicDescription, getAssessmentCampaignPublicTitle } from '../components/AssessmentCampaignLandingRenderer'
import { useTenant } from '../../../contexts/TenantContext'
import AssessmentCampaignRecoveryCard from '../components/AssessmentCampaignRecoveryCard'
import { getApiMessage, getPublicAssessmentCampaign, recoverPublicAssessmentCampaignParticipations, requestAssessmentCampaignOtp, startPublicAssessmentCampaignRetake } from '../services/assessmentCampaignPublicService'
import { getFlowState, patchFlowState } from '../utils/assessmentFlowStorage'
import { buildAssessmentRunnerPath, buildAssessmentRunnerResultPath, buildCampaignRegisterPath } from '../utils/assessmentRoutes'

function getRecoveryErrorMessage(error) {
  const message = getApiMessage(error, 'Không thể khôi phục lượt làm bài.')
  if (message === 'INVALID_EMAIL') return 'Email chưa đúng định dạng.'
  if (message === 'INVALID_OTP') return 'Mã OTP chưa đúng. Vui lòng thử lại.'
  if (message === 'ATTEMPT_NOT_OWNED') return 'Không tìm thấy lượt làm bài phù hợp với email này trong chiến dịch hiện tại.'
  return message
}

export default function AssessmentWelcomePage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recoveryVisible, setRecoveryVisible] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [retakeStarting, setRetakeStarting] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [recoveryResult, setRecoveryResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadCampaign() {
      setLoading(true)
      setError('')
      try {
        const payload = await getPublicAssessmentCampaign(campaignCode, tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '')
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
  }, [campaignCode, tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode])

  if (loading) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CAlert color='info' className='mb-0'>Đang tải chiến dịch đánh giá...</CAlert>
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

  const nextPath = buildCampaignRegisterPath(tenantCode, campaignCode, { isMainDomain: tenant?.isMainDomain })

  async function handleRecover(values) {
    setRecoveryLoading(true)
    setRecoveryError('')
    setRecoveryMessage('')
    try {
      const payload = await recoverPublicAssessmentCampaignParticipations(campaignCode, values, tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '')
      setRecoveryResult(payload)
      const participations = Array.isArray(payload?.participations) ? payload.participations : []
      if (participations.length === 1 && participations[0]?.recovery?.routeType !== 'retake') {
        handleOpenRecoveredParticipation(participations[0], values.email, payload?.campaign?.slug || campaignCode)
        return
      }
      setRecoveryMessage('Đã xác thực thành công. Chọn lượt làm bài bạn muốn tiếp tục.')
    } catch (requestError) {
      setRecoveryResult(null)
      setRecoveryError(getRecoveryErrorMessage(requestError))
    } finally {
      setRecoveryLoading(false)
    }
  }

  async function handleRequestRecoveryOtp(values) {
    const payload = await requestAssessmentCampaignOtp(campaignCode, values, tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '')
    setRecoveryMessage('Mã xác thực đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư đến hoặc thư rác.')
    return payload
  }

  function handleOpenRecoveredParticipation(item, email, resolvedCampaignCode) {
    patchFlowState({
      tenantCode: tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '',
      campaignCode: resolvedCampaignCode || campaignCode,
      participation: {
        attemptId: item?.assessmentAttempt?.id || item?.assessmentAttempt?.documentId || null,
        attemptCode: item?.assessmentAttempt?.code || null,
        participationCode: item?.code || null,
        status: item?.status || null,
        retakeAllowed: item?.retakeAllowed === true,
        retakeReason: item?.retakeReason || null,
        retakeCount: item?.retakeCount || 0,
      },
      publicSession: {
        token: item?.recovery?.publicAccessToken || '',
        expiresAt: item?.recovery?.publicAccessExpiresAt || null,
        attemptId: item?.assessmentAttempt?.id || item?.assessmentAttempt?.documentId || null,
      },
      verification: {
        method: 'email',
        target: email,
        emailVerified: true,
        phoneVerified: false,
        verifiedAt: new Date().toISOString(),
      },
    })
    const targetPath = item?.recovery?.routeType === 'runner'
      ? buildAssessmentRunnerPath(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '', item?.assessmentAttempt?.id || item?.assessmentAttempt?.documentId)
      : item?.recovery?.routeType === 'result'
        ? buildAssessmentRunnerResultPath(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '', item?.assessmentAttempt?.id || item?.assessmentAttempt?.documentId)
        : null
    if (!targetPath) return
    navigate(targetPath)
  }

  async function handleStartRetake(item) {
    setRetakeStarting(true)
    setRecoveryError('')
    try {
      const payload = await startPublicAssessmentCampaignRetake(item?.assessmentAttempt?.id || item?.assessmentAttempt?.documentId, tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '', item?.recovery?.publicAccessToken || '')
      patchFlowState({
        tenantCode: tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '',
        campaignCode: campaignCode,
        participation: {
          attemptId: payload?.attempt?.id || payload?.attempt?.documentId || null,
          attemptCode: payload?.attempt?.code || null,
          participationCode: payload?.participation?.code || null,
          status: payload?.participation?.status || null,
          retakeAllowed: false,
        },
        publicSession: {
          token: payload?.publicAccessToken || '',
          expiresAt: payload?.publicAccessExpiresAt || null,
          attemptId: payload?.attempt?.id || payload?.attempt?.documentId || null,
        },
      })
      navigate(buildAssessmentRunnerPath(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '', payload?.attempt?.id || payload?.attempt?.documentId))
    } catch (requestError) {
      setRecoveryError(getRecoveryErrorMessage(requestError))
    } finally {
      setRetakeStarting(false)
    }
  }

  function handleToggleRecovery() {
    setRecoveryVisible((current) => {
      const next = !current
      if (!current) {
        window.requestAnimationFrame(() => {
          const node = document.getElementById('assessment-campaign-recovery-section')
          if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
      return next
    })
  }

  return (
    <CContainer className='assessment-public-shell'>
      <div className='py-3 py-md-4'>
        <CCard className='assessment-card mb-4'>
          <CCardBody className='p-4 p-md-5'>
            <AssessmentCampaignLandingRenderer
              campaign={campaign}
              renderStartAction={(key) => (
                <CButton key={`start:${key}`} type='button' color='primary' className='assessment-primary-cta' onClick={() => navigate(nextPath)}>
                  BẮT ĐẦU KIỂM TRA
                </CButton>
              )}
              renderRecoveryAction={(key) => (
                <CButton key={`recovery:${key}`} type='button' color='secondary' variant='outline' className='assessment-primary-cta' onClick={handleToggleRecovery}>
                  TIẾP TỤC / XEM LẠI KẾT QUẢ
                </CButton>
              )}
            />
            {recoveryVisible ? <div className='assessment-secondary-note mt-3'>Nhập email đã dùng trước đó để tiếp tục bài làm hoặc xem lại kết quả.</div> : null}
          </CCardBody>
        </CCard>

        {recoveryVisible ? (
          <div className='mb-4' id='assessment-campaign-recovery-section'>
            <AssessmentCampaignRecoveryCard
              title='Tiếp tục hoặc xem lại kết quả'
              description='Nhập email đã dùng khi đăng ký. Sau khi xác thực OTP, hệ thống sẽ tìm các lượt làm bài thuộc chiến dịch này để bạn tiếp tục hoặc xem lại kết quả.'
              initialEmail={getFlowState()?.verification?.target || ''}
              loading={recoveryLoading}
              error={recoveryError}
              message={recoveryMessage}
              onRequestOtp={handleRequestRecoveryOtp}
              submitLabel='Xác thực và tìm lượt làm bài'
              onSubmit={handleRecover}
            />
            {Array.isArray(recoveryResult?.participations) && recoveryResult.participations.length > 1 ? (
              <CCard className='assessment-card mt-3'>
                <CCardBody className='p-4 p-md-5'>
                  <div className='assessment-section-title mb-3'>Các lượt làm bài đã tìm thấy</div>
                  <div className='d-flex flex-column gap-3'>
                    {recoveryResult.participations.map((item) => (
                      <div key={item?.code || item?.assessmentAttempt?.code} className='assessment-trust-panel'>
                        <div className='d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3'>
                          <div>
                            <div className='fw-semibold'>{item?.lead?.fullName || item?.assessmentAttempt?.code || item?.code || 'Lượt làm bài'}</div>
                            <div className='assessment-secondary-note'>{`Lớp: ${item?.collectedData?.grade ?? item?.sourceMetadata?.grade ?? '-'}`}</div>
                            <div className='assessment-secondary-note'>{`Attempt: ${item?.assessmentAttempt?.code || '-'}`}</div>
                            <div className='assessment-domain-copy'>{item?.recovery?.description || ''}</div>
                            <div className='assessment-secondary-note'>{`Trạng thái: ${item?.status || '-'}`}</div>
                          </div>
                          <CButton color={item?.recovery?.suggested ? 'primary' : 'secondary'} variant={item?.recovery?.suggested ? undefined : 'outline'} disabled={retakeStarting} onClick={() => item?.recovery?.routeType === 'retake' ? handleStartRetake(item) : handleOpenRecoveredParticipation(item, recoveryResult?.email || '', recoveryResult?.campaign?.slug || campaignCode)}>{retakeStarting && item?.recovery?.routeType === 'retake' ? 'Đang chuẩn bị...' : item?.recovery?.actionLabel || 'Tiếp tục'}</CButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </CCardBody>
              </CCard>
            ) : null}
          </div>
        ) : null}

        {!String(campaign?.landingHtml || campaign?.publicContent || '').trim() ? (
          <div className='small text-body-secondary px-2'>{`${getAssessmentCampaignPublicTitle(campaign)} · ${getAssessmentCampaignPublicDescription(campaign)}`.trim()}</div>
        ) : null}
      </div>
    </CContainer>
  )
}
