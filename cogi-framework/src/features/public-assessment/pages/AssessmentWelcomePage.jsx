import { CAlert, CButton, CCard, CCardBody, CContainer } from '@coreui/react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTenant } from '../../../contexts/TenantContext'
import { getMockAssessmentCampaign } from '../mock/assessmentCampaignMock'
import { buildCampaignRegisterPath } from '../utils/assessmentRoutes'

export default function AssessmentWelcomePage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const campaign = useMemo(() => getMockAssessmentCampaign(campaignCode), [campaignCode])

  if (!campaign) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CAlert color='warning' className='mb-0'>Chiến dịch đánh giá này hiện chưa tồn tại hoặc chưa sẵn sàng.</CAlert>
      </CContainer>
    )
  }

  const nextPath = buildCampaignRegisterPath(tenantCode, campaignCode, { isMainDomain: tenant?.isMainDomain })

  return (
    <CContainer className='assessment-public-shell'>
      <div className='py-3 py-md-4'>
        <CCard className='assessment-card mb-4'>
          <CCardBody className='p-4 p-md-5'>
            <div className='assessment-badge mb-3'>{campaign.badge}</div>
            <div className='row g-4 align-items-center'>
              <div className='col-lg-7'>
                <h1 className='display-5 fw-bold mb-3'>{campaign.headline}</h1>
                <p className='assessment-section-lead mb-4'>{campaign.description}</p>
                <div className='assessment-chip-grid mb-4'>
                  {campaign.highlights.map((item) => (
                    <div key={item} className='assessment-chip'>
                      <div className='assessment-chip-title'>{item}</div>
                    </div>
                  ))}
                </div>
                <div className='d-flex flex-column align-items-start gap-3'>
                  <CButton color='primary' className='assessment-primary-cta' onClick={() => navigate(nextPath)}>BẮT ĐẦU KIỂM TRA</CButton>
                  <div className='assessment-secondary-note'>Thực hiện ngay trên điện thoại hoặc máy tính</div>
                </div>
              </div>
              <div className='col-lg-5'>
                <div className='assessment-trust-panel h-100'>
                  <div className='assessment-section-title mb-3'>Bài đánh giá gồm những gì?</div>
                  <div className='assessment-trust-list'>
                    {campaign.domains.map((item) => (
                      <div key={item.key} className='assessment-trust-item'>
                        <div className='assessment-trust-icon'>{item.title.slice(0, 1)}</div>
                        <div>
                          <div className='fw-semibold'>{item.title}</div>
                          <div className='assessment-domain-copy'>{item.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CCardBody>
        </CCard>

        <CCard className='assessment-card mb-4'>
          <CCardBody className='p-4 p-md-5'>
            <div className='assessment-section-title'>Quy trình đánh giá</div>
            <p className='assessment-section-lead mb-4'>Từng bước đều được thiết kế để phụ huynh và học sinh dễ theo dõi trên điện thoại.</p>
            <div className='assessment-step-grid'>
              {campaign.steps.map((item, index) => (
                <div key={item} className='assessment-step-card'>
                  <div className='assessment-step-number'>{index + 1}</div>
                  <div className='assessment-step-label'>{item}</div>
                </div>
              ))}
            </div>
          </CCardBody>
        </CCard>

        <CCard className='assessment-card mb-4'>
          <CCardBody className='p-4 p-md-5'>
            <div className='assessment-section-title'>Các phần đánh giá</div>
            <p className='assessment-section-lead mb-4'>Listening, Reading, Language in Use và Writing sẽ được thực hiện trực tuyến. Speaking là bước xác nhận tiếp theo cùng giáo viên.</p>
            <div className='assessment-domain-grid'>
              {campaign.domains.map((item) => (
                <div key={item.key} className='assessment-domain-card'>
                  <div className='assessment-domain-title'>{item.title}</div>
                  <div className='assessment-domain-copy'>{item.description}</div>
                </div>
              ))}
            </div>
          </CCardBody>
        </CCard>

        <CCard className='assessment-card mb-4'>
          <CCardBody className='p-4 p-md-5'>
            <div className='assessment-section-title'>Thông tin cần biết</div>
            <div className='assessment-trust-panel'>
              <div className='assessment-trust-list'>
                {campaign.trustInfo.map((item, index) => (
                  <div key={item} className='assessment-trust-item'>
                    <div className='assessment-trust-icon'>{index + 1}</div>
                    <div className='assessment-domain-copy'>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </CCardBody>
        </CCard>

        <CCard className='assessment-card'>
          <CCardBody className='p-4 p-md-5 text-center'>
            <div className='assessment-section-title'>Sẵn sàng bắt đầu?</div>
            <p className='assessment-section-lead mb-4'>Thực hiện bài đánh giá chỉ trong khoảng {campaign.estimatedMinutes}.</p>
            <CButton color='primary' className='assessment-primary-cta' onClick={() => navigate(nextPath)}>BẮT ĐẦU KIỂM TRA</CButton>
          </CCardBody>
        </CCard>
      </div>
    </CContainer>
  )
}
