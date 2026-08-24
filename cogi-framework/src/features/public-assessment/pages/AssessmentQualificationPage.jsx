import { CAlert, CContainer } from '@coreui/react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTenant } from '../../../contexts/TenantContext'
import QualificationForm, { buildInitialQualificationForm } from '../components/QualificationForm'
import { getMockAssessmentCampaign } from '../mock/assessmentCampaignMock'
import { getFlowState, mergeFlowState } from '../utils/assessmentFlowStorage'
import { buildCampaignResultPath, buildCampaignTestPath } from '../utils/assessmentRoutes'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function resolveFinishedAssessment(assessment) {
  return assessment?.finished === true || Boolean(assessment?.attempt?.finishedAt)
}

export default function AssessmentQualificationPage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const flowState = getFlowState()
  const campaign = getMockAssessmentCampaign(campaignCode)
  const isSameFlow = flowState?.campaignCode === campaignCode && flowState?.tenantCode === tenantCode
  const qualification = isSameFlow ? (flowState?.qualification || null) : null
  const verification = isSameFlow ? flowState?.verification : null
  const assessment = isSameFlow ? flowState?.assessment : null
  const testPath = buildCampaignTestPath(tenantCode, campaignCode)
  const resultPath = buildCampaignResultPath(tenantCode, campaignCode)
  const emailVerified = verification?.emailVerified === true
  const isFinished = resolveFinishedAssessment(assessment)

  useEffect(() => {
    if (!campaign) return
    if (!emailVerified || !isFinished) {
      navigate(testPath, { replace: true })
    }
  }, [campaign, emailVerified, isFinished, navigate, testPath])

  if (!campaign) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CAlert color='warning' className='mb-0'>Chiến dịch đánh giá này hiện chưa tồn tại hoặc chưa sẵn sàng.</CAlert>
      </CContainer>
    )
  }

  if (!emailVerified || !isFinished) return null

  const brandName = toText(tenant?.currentTenant?.tenantShortName || tenant?.currentTenant?.tenantName || tenant?.resolvedTenant?.tenantShortName || tenant?.resolvedTenant?.tenantName) || 'Vitaminfun'
  const initialValues = qualification || buildInitialQualificationForm()

  function handleDraftChange(nextValues) {
    mergeFlowState((current) => ({
      ...current,
      qualification: {
        ...(current?.qualification || {}),
        ...nextValues,
      },
    }))
  }

  function handleValidSubmit(values) {
    mergeFlowState((current) => ({
      ...current,
      qualification: values,
      assessment: {
        ...(current.assessment || {}),
        qualificationCompleted: true,
      },
    }))
    navigate(resultPath)
  }

  return (
    <CContainer className='assessment-public-shell'>
      <div className='py-3 py-md-4'>
        <QualificationForm campaign={campaign} brandName={brandName} initialValues={initialValues} onDraftChange={handleDraftChange} onValidSubmit={handleValidSubmit} />
      </div>
    </CContainer>
  )
}