import { CAlert, CButton, CCard, CCardBody, CContainer } from '@coreui/react'
import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AssessmentPriorities from '../components/AssessmentPriorities'
import AssessmentProgress from '../components/AssessmentProgress'
import AssessmentResultHero from '../components/AssessmentResultHero'
import AssessmentStrengths from '../components/AssessmentStrengths'
import DomainResultCard from '../components/DomainResultCard'
import LockedRecommendation from '../components/LockedRecommendation'
import SpeakingNextStep from '../components/SpeakingNextStep'
import { getMockAssessmentCampaign } from '../mock/assessmentCampaignMock'
import { getMockAssessmentPreliminaryResult } from '../mock/assessmentPreliminaryResultMock'
import { getFlowState } from '../utils/assessmentFlowStorage'
import { buildCampaignQualificationPath, buildCampaignSpeakingPath, buildCampaignTestPath } from '../utils/assessmentRoutes'

function resolveFinishedAssessment(assessment) {
  return assessment?.finished === true || Boolean(assessment?.attempt?.finishedAt)
}

function getSpeakingStatusLabel(speaking) {
  if (speaking?.status === 'booked' && speaking?.mode === 'live') return 'Speaking: Đã đặt lịch'
  if (speaking?.status === 'submitted' && speaking?.mode === 'audio') return 'Speaking: Đã gửi audio'
  return ''
}

export default function AssessmentPreliminaryResultPage() {
  const navigate = useNavigate()
  const { tenantCode, campaignCode } = useParams()
  const flowState = getFlowState()
  const campaign = getMockAssessmentCampaign(campaignCode)
  const isSameFlow = flowState?.campaignCode === campaignCode && flowState?.tenantCode === tenantCode
  const qualification = isSameFlow ? flowState?.qualification : null
  const assessment = isSameFlow ? flowState?.assessment : null
  const speaking = isSameFlow ? flowState?.speaking : null
  const isFinished = resolveFinishedAssessment(assessment)
  const qualificationCompleted = assessment?.qualificationCompleted === true
  const testCode = assessment?.test?.code
  const assessmentTitle = assessment?.test?.title || campaign?.title || 'English Level Check'
  const result = useMemo(() => getMockAssessmentPreliminaryResult(testCode), [testCode])
  const speakingPath = buildCampaignSpeakingPath(tenantCode, campaignCode)
  const testPath = buildCampaignTestPath(tenantCode, campaignCode)
  const qualificationPath = buildCampaignQualificationPath(tenantCode, campaignCode)

  useEffect(() => {
    if (!campaign) return
    if (!isFinished) {
      navigate(testPath, { replace: true })
      return
    }
    if (!qualificationCompleted) {
      navigate(qualificationPath, { replace: true })
    }
  }, [campaign, isFinished, navigate, qualificationCompleted, qualificationPath, testPath])

  if (!campaign) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CAlert color='warning' className='mb-0'>Chiến dịch đánh giá này hiện chưa tồn tại hoặc chưa sẵn sàng.</CAlert>
      </CContainer>
    )
  }

  if (!isFinished) {
    return null
  }
  if (!qualificationCompleted) {
    return null
  }

  function handleGoToSpeaking(mode) {
    navigate(`${speakingPath}?mode=${encodeURIComponent(mode)}`)
  }

  return (
    <CContainer className='assessment-public-shell py-3 py-md-4'>
      <CCard className='assessment-card'>
        <CCardBody className='p-4 p-md-5'>
          <AssessmentProgress currentStep={5} totalSteps={6} label='Kết quả sơ bộ' />

          <AssessmentResultHero
            status={result.status}
            title={result.overallLabel}
            studentName={qualification?.student?.name || ''}
            grade={qualification?.student?.grade || ''}
            assessmentTitle={assessmentTitle}
            provisionalLevel={result.provisionalLevel}
          />

          {getSpeakingStatusLabel(speaking) ? (
            <div className='assessment-speaking-status-banner'>
              <span className='assessment-speaking-status-banner__label'>{getSpeakingStatusLabel(speaking)}</span>
              <span className='assessment-speaking-status-banner__copy'>Kết quả vẫn ở trạng thái PROVISIONAL cho tới khi giáo viên hoàn tất đánh giá.</span>
            </div>
          ) : null}

          {import.meta.env.DEV ? (
            <div className='assessment-dev-note' role='note'>Mock result UI only. Đây là dữ liệu demo phía frontend, chưa phải kết quả chấm thật.</div>
          ) : null}

          <section className='assessment-result-section' aria-labelledby='assessment-domain-results-title'>
            <h2 id='assessment-domain-results-title' className='assessment-form-section-title'>Kết quả theo từng kỹ năng</h2>
            <div className='assessment-domain-result-grid'>
              {result.domains.map((domain) => <DomainResultCard key={domain.code} domain={domain} />)}
            </div>
          </section>

          <section className='assessment-result-section'>
            <div className='assessment-trust-panel'>
              <h2 className='assessment-form-section-title mb-2'>Kết quả này được hiểu như thế nào?</h2>
              <div className='assessment-domain-copy'>Listening và Reading là hai nhóm năng lực chính để ước lượng mức hiện tại.</div>
              <div className='assessment-domain-copy'>Language in Use và Writing cung cấp thêm bằng chứng để giáo viên xem xét.</div>
              <div className='assessment-domain-copy'>Speaking là bước xác nhận quan trọng trước khi đưa ra kết quả cuối cùng và tư vấn lớp học.</div>
            </div>
          </section>

          <section className='assessment-result-section assessment-result-two-column'>
            <AssessmentStrengths items={result.strengths} />
            <AssessmentPriorities items={result.priorities} />
          </section>

          <section className='assessment-result-section'>
            <SpeakingNextStep
              onChooseLive={() => handleGoToSpeaking('live')}
              onChooseAudio={() => handleGoToSpeaking('audio')}
            />
          </section>

          <section className='assessment-result-section'>
            <LockedRecommendation />
          </section>

          <div className='d-flex justify-content-start mt-4'>
            <CButton color='secondary' variant='outline' onClick={() => navigate(testPath)}>Quay lại bài kiểm tra</CButton>
          </div>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}
