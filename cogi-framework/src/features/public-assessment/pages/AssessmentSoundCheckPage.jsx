import { useEffect, useMemo, useRef, useState } from 'react'
import { CAlert, CButton, CCard, CCardBody, CContainer } from '@coreui/react'
import { useNavigate, useParams } from 'react-router-dom'
import AssessmentProgress from '../components/AssessmentProgress'
import { buildAssessmentRunnerPath, buildCampaignVerifyPath } from '../utils/assessmentRoutes'
import { getFlowState, patchFlowState } from '../utils/assessmentFlowStorage'
import { createMockAudioSampleDataUri } from '../utils/assessmentRuntime'
import { getApiMessage, startPublicAssessmentCampaign } from '../services/assessmentCampaignPublicService'

function sanitizeBeforeStartData(value) {
  return Object.entries(value || {}).reduce((result, [key, itemValue]) => {
    if (String(key || '').startsWith('__')) return result
    result[key] = itemValue
    return result
  }, {})
}

export default function AssessmentSoundCheckPage() {
  const navigate = useNavigate()
  const { tenantCode, campaignCode } = useParams()
  const [flowState, setFlowState] = useState(() => getFlowState())
  const [audioState, setAudioState] = useState('idle')
  const [soundConfirmed, setSoundConfirmed] = useState(Boolean(flowState?.assessment?.soundConfirmed))
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const audioRef = useRef(null)

  const isSameFlow = flowState?.tenantCode === tenantCode && flowState?.campaignCode === campaignCode
  const beforeStartData = isSameFlow ? sanitizeBeforeStartData(flowState?.beforeStartData || null) : null
  const verification = flowState?.verification || {}
  const verifyPath = buildCampaignVerifyPath(tenantCode, campaignCode)
  const hasQualification = Boolean(isSameFlow && beforeStartData)
  const emailVerified = verification?.emailVerified === true
  const testConfig = useMemo(() => flowState?.assessment?.resolvedAssessment || null, [flowState?.assessment?.resolvedAssessment])
  const sampleAudioSrc = useMemo(() => createMockAudioSampleDataUri(), [])

  useEffect(() => {
    if (!audioRef.current) return undefined
    const audio = audioRef.current
    function handlePlay() {
      setAudioState('playing')
    }
    function handleEnded() {
      setAudioState('finished')
    }
    function handlePause() {
      setAudioState((current) => (current === 'finished' ? current : 'paused'))
    }
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
    }
  }, [])

  function syncState(nextState) {
    setFlowState(nextState)
    return nextState
  }

  function handleConfirmSound(value) {
    setSoundConfirmed(value)
    const nextState = patchFlowState({
      assessment: {
        ...(flowState?.assessment || {}),
        soundConfirmed: value,
      },
    })
    syncState(nextState)
  }

  function handleStartTest() {
    setStarting(true)
    setError('')
    startPublicAssessmentCampaign(campaignCode, { attributes: beforeStartData }, tenantCode)
      .then((payload) => {
        const nextState = patchFlowState({
          assessment: {
            ...(flowState?.assessment || {}),
            soundConfirmed: true,
            resolvedAssessment: {
              assessmentVersionCode: payload?.assessmentVersion?.code || '',
              assessmentTitle: payload?.campaign?.publicTitle || payload?.campaign?.code || '',
            },
          },
          participation: {
            ...(flowState?.participation || {}),
            status: payload?.participation?.status || 'in_progress',
            attemptId: payload?.attempt?.id || payload?.attempt?.documentId || null,
            attemptCode: payload?.attempt?.code || null,
            participationCode: payload?.participation?.code || null,
            matchedRuleCode: payload?.matchedRule?.code || null,
            assessmentVersionCode: payload?.assessmentVersion?.code || null,
          },
          publicSession: {
            token: payload?.publicAccessToken || '',
            expiresAt: payload?.publicAccessExpiresAt || null,
            attemptId: payload?.attempt?.id || payload?.attempt?.documentId || null,
          },
        })
        syncState(nextState)
        navigate(buildAssessmentRunnerPath(tenantCode, payload?.attempt?.id || payload?.attempt?.documentId))
      })
      .catch((requestError) => {
        const message = getApiMessage(requestError, 'Không thể chuẩn bị bài kiểm tra.')
        if (message === 'NO_MATCH') setError('Hiện chưa tìm thấy bài đánh giá phù hợp với lớp đã chọn. Vui lòng kiểm tra lại thông tin hoặc liên hệ VitaminFun để được hỗ trợ.')
        else if (message === 'INVALID_GRADE') setError('Lớp đã chọn không hợp lệ. Vui lòng kiểm tra lại.')
        else if (message === 'AMBIGUOUS_MATCH') setError('Hiện hệ thống chưa thể xác định bài kiểm tra phù hợp. Vui lòng liên hệ VitaminFun để được hỗ trợ.')
        else if (message === 'ASSESSMENT_VERSION_UNAVAILABLE') setError('Bài đánh giá cho lớp này hiện chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ VitaminFun.')
        else if (message === 'CAMPAIGN_PAUSED') setError('Chiến dịch đang tạm dừng. Vui lòng thử lại sau.')
        else if (message === 'CAMPAIGN_ENDED') setError('Chiến dịch đã kết thúc.')
        else if (message === 'CAMPAIGN_NOT_STARTED') setError('Chiến dịch chưa bắt đầu.')
        else setError(message)
      })
      .finally(() => setStarting(false))
  }

  if (!hasQualification) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CAlert color='warning' className='mb-0'>Thông tin đăng ký chưa đầy đủ. Vui lòng quay lại bước nhập thông tin để tiếp tục.</CAlert>
      </CContainer>
    )
  }

  if (!emailVerified) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CCard className='assessment-card'>
          <CCardBody className='p-4 p-md-5 text-center'>
            <div className='assessment-section-title'>Bạn cần xác thực email trước</div>
            <p className='assessment-section-lead mb-4'>Hãy hoàn thành bước xác thực email để tiếp tục sang phần kiểm tra âm thanh.</p>
            <CButton color='primary' className='assessment-primary-cta' onClick={() => navigate(verifyPath)}>QUAY LẠI XÁC THỰC EMAIL</CButton>
          </CCardBody>
        </CCard>
      </CContainer>
    )
  }

  return (
    <CContainer className='assessment-public-shell py-3 py-md-4'>
      <CCard className='assessment-card mb-4'>
        <CCardBody className='p-4 p-md-5'>
          <AssessmentProgress currentStep={3} totalSteps={6} label='Kiểm tra âm thanh' />
          <div className='assessment-section-title'>Kiểm tra âm thanh</div>
          <p className='assessment-section-lead mb-4'>Phần đầu của bài đánh giá có nội dung Listening. Hãy kiểm tra loa hoặc tai nghe trước khi bắt đầu.</p>
          {beforeStartData?.fullName ? <div className='assessment-secondary-note mb-3'>Bài đánh giá dành cho: {beforeStartData.fullName}</div> : null}
          {error ? <CAlert color='danger'>{error}</CAlert> : null}

          <CCard className='assessment-form-card border-0 shadow-sm mb-4'>
            <CCardBody>
              <div className='assessment-section-title h5 mb-2'>Assessment sẽ được phân tự động</div>
              <div className='assessment-secondary-note'>Sau bước này, hệ thống sẽ resolve Assessment Version phù hợp theo lớp và chuyển bạn sang Assessment Runner hiện có.</div>
              {testConfig?.assessmentVersionCode ? <div className='assessment-secondary-note mt-1'>{`Version gần nhất đã resolve: ${testConfig.assessmentVersionCode}`}</div> : null}
            </CCardBody>
          </CCard>

          <div className='assessment-trust-panel mb-4'>
            <div className='assessment-trust-list'>
              {['Chọn nơi yên tĩnh.', 'Bật loa hoặc sử dụng tai nghe.', 'Điều chỉnh âm lượng ở mức nghe rõ.', 'Không rời khỏi trang khi đang làm bài Listening.'].map((item, index) => (
                <div key={item} className='assessment-trust-item'>
                  <div className='assessment-trust-icon'>{index + 1}</div>
                  <div className='assessment-domain-copy'>{item}</div>
                </div>
              ))}
            </div>
          </div>

          <CCard className='assessment-form-card border-0 shadow-sm'>
            <CCardBody>
              <div className='assessment-form-section-title'>Thử âm thanh</div>
              <audio ref={audioRef} className='w-100 mb-3' controls src={sampleAudioSrc} preload='metadata' />
              <div className='d-flex flex-column flex-md-row gap-3 align-items-start align-items-md-center justify-content-between'>
                <div>
                  {audioState === 'playing' ? <div className='assessment-secondary-note'>Đang phát âm thanh...</div> : null}
                  {audioState === 'finished' || audioState === 'paused' ? <div className='assessment-secondary-note'>Bạn có nghe rõ âm thanh không?</div> : <div className='assessment-secondary-note'>Nhấn phát âm thanh mẫu để kiểm tra thiết bị nghe.</div>}
                </div>
                <div className='d-flex gap-2 flex-wrap'>
                  <CButton type='button' color={soundConfirmed ? 'secondary' : 'success'} variant={soundConfirmed ? 'outline' : undefined} onClick={() => handleConfirmSound(true)}>Tôi nghe rõ</CButton>
                  <CButton type='button' color={!soundConfirmed ? 'secondary' : 'dark'} variant='outline' onClick={() => handleConfirmSound(false)}>Tôi chưa nghe được</CButton>
                </div>
              </div>
              {!soundConfirmed && (audioState === 'finished' || audioState === 'paused') ? (
                <CAlert color='warning' className='mt-3 mb-0'>
                  Hãy kiểm tra âm lượng thiết bị, loa hoặc tai nghe đã kết nối, trình duyệt không bị tắt tiếng và thử phát lại âm thanh.
                </CAlert>
              ) : null}
            </CCardBody>
          </CCard>

          <div className='d-flex justify-content-end mt-4'>
            <CButton color='primary' className='assessment-primary-cta' disabled={!soundConfirmed || starting} onClick={handleStartTest}>{starting ? 'Đang chuẩn bị bài kiểm tra...' : 'BẮT ĐẦU LÀM BÀI'}</CButton>
          </div>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}
