import { CButton, CCard, CCardBody, CContainer } from '@coreui/react'
import { useNavigate, useParams } from 'react-router-dom'
import AssessmentProgress from '../components/AssessmentProgress'
import { buildCampaignTestPath } from '../utils/assessmentRoutes'

export default function AssessmentResultPlaceholderPage() {
  const navigate = useNavigate()
  const { tenantCode, campaignCode } = useParams()

  return (
    <CContainer className='assessment-public-shell py-3 py-md-4'>
      <CCard className='assessment-card'>
        <CCardBody className='p-4 p-md-5 text-center'>
          <AssessmentProgress currentStep={5} totalSteps={5} label='Kết quả sơ bộ' />
          <div className='assessment-section-title'>Kết quả sơ bộ</div>
          <p className='assessment-section-lead mb-4'>Đang chuẩn bị kết quả của bạn.</p>
          <div className='assessment-trust-panel mb-4'>
            <div className='assessment-domain-copy'>Preliminary Result UI sẽ được triển khai ở phase tiếp theo.</div>
          </div>
          <CButton color='secondary' variant='outline' onClick={() => navigate(buildCampaignTestPath(tenantCode, campaignCode))}>Quay lại bài kiểm tra</CButton>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}
