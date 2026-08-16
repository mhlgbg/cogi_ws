import { CAlert, CContainer } from '@coreui/react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTenant } from '../../../contexts/TenantContext'
import QualificationForm, { buildInitialQualificationForm } from '../components/QualificationForm'
import { getMockAssessmentCampaign } from '../mock/assessmentCampaignMock'
import { buildCampaignVerifyPath } from '../utils/assessmentRoutes'
import { getFlowState, setFlowState } from '../utils/assessmentFlowStorage'
import { OTP_RESEND_SECONDS, resolveMockTestByGrade } from '../utils/assessmentRuntime'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export default function AssessmentRegistrationPage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const campaign = getMockAssessmentCampaign(campaignCode)

  if (!campaign) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CAlert color='warning' className='mb-0'>Chiến dịch đánh giá này hiện chưa tồn tại hoặc chưa sẵn sàng.</CAlert>
      </CContainer>
    )
  }

  const brandName = toText(tenant?.currentTenant?.tenantShortName || tenant?.currentTenant?.tenantName || tenant?.resolvedTenant?.tenantShortName || tenant?.resolvedTenant?.tenantName) || 'Vitaminfun'
  const initialValues = (() => {
    const saved = getFlowState()
    if (saved?.campaignCode !== campaignCode || saved?.tenantCode !== tenantCode) return buildInitialQualificationForm()
    return saved?.qualification || buildInitialQualificationForm()
  })()

  function handleValidSubmit(values) {
    const nextState = {
      tenantCode,
      campaignCode,
      qualification: values,
      verification: {
        emailVerified: false,
        verifiedAt: null,
        failedAttempts: 0,
        lockedUntil: 0,
        resendAvailableAt: Math.floor(Date.now() / 1000) + OTP_RESEND_SECONDS,
      },
      assessment: {
        test: resolveMockTestByGrade(values?.student?.grade),
        soundConfirmed: false,
      },
    }
    setFlowState(nextState)
    navigate(buildCampaignVerifyPath(tenantCode, campaignCode, { isMainDomain: tenant?.isMainDomain }))
  }

  return (
    <CContainer className='assessment-public-shell'>
      <div className='py-3 py-md-4'>
        <QualificationForm campaign={campaign} brandName={brandName} initialValues={initialValues} onValidSubmit={handleValidSubmit} />
      </div>
    </CContainer>
  )
}
