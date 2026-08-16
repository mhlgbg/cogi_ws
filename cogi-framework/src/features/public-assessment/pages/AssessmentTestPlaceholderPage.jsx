import { CButton, CCard, CCardBody, CContainer } from '@coreui/react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AssessmentProgress from '../components/AssessmentProgress'
import { buildCampaignSoundCheckPath } from '../utils/assessmentRoutes'
import { getFlowState } from '../utils/assessmentFlowStorage'
import { resolveMockTestByGrade } from '../utils/assessmentRuntime'

export default function AssessmentTestPlaceholderPage() {
  const navigate = useNavigate()
  const { tenantCode, campaignCode } = useParams()
  const flowState = getFlowState() || {}
  const qualification = flowState?.qualification || null
  const testConfig = useMemo(() => flowState?.assessment?.test || resolveMockTestByGrade(qualification?.student?.grade), [flowState?.assessment?.test, qualification?.student?.grade])
  const backPath = buildCampaignSoundCheckPath(tenantCode, campaignCode)

  return (
    <CContainer className='assessment-public-shell py-3 py-md-4'>
      <CCard className='assessment-card'>
        <CCardBody className='p-4 p-md-5 text-center'>
          <AssessmentProgress currentStep={4} totalSteps={5} label='Bài kiểm tra' />
          <div className='assessment-section-title'>Bài kiểm tra sắp bắt đầu</div>
          <p className='assessment-section-lead mb-4'>{testConfig.title}</p>
          <div className='assessment-secondary-note mb-4'>{`${testConfig.gradeRange} · ${testConfig.estimatedMinutes}`}</div>
          <div className='assessment-trust-panel mb-4'>
            <div className='assessment-domain-copy'>Test Runner sẽ được triển khai ở Phase tiếp theo.</div>
          </div>
          <CButton color='secondary' variant='outline' onClick={() => navigate(backPath)}>Quay lại kiểm tra âm thanh</CButton>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}
