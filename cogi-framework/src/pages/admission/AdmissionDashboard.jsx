import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CListGroup,
  CListGroupItem,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import api from '../../api/axios'
import { useTenant } from '../../contexts/TenantContext'

function unwrapRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}

function hasHtmlContent(value) {
  return /<[^>]+>/.test(String(value || ''))
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function getStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'draft') return 'Nháp'
  if (normalized === 'submitted') return 'Đã nộp'
  if (normalized === 'reviewing') return 'Đang xét duyệt'
  if (normalized === 'approved') return 'Đã duyệt'
  if (normalized === 'rejected') return 'Đề nghị khai lại'
  if (normalized === 'exam_scheduled') return 'Đã xếp lịch'
  if (normalized === 'passed') return 'Đạt'
  if (normalized === 'failed') return 'Chưa đạt'
  if (normalized === 'enrolled') return 'Nhập học'
  return normalized || '-'
}

function getStatusColor(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'approved' || normalized === 'passed' || normalized === 'enrolled') return 'success'
  if (normalized === 'submitted' || normalized === 'reviewing' || normalized === 'exam_scheduled') return 'info'
  if (normalized === 'draft') return 'secondary'
  if (normalized === 'rejected' || normalized === 'failed') return 'warning'
  return 'secondary'
}

function canEditApplication(application) {
  const normalized = String(application?.status || '').trim().toLowerCase()
  return application?.isEditable === true && (normalized === 'draft' || normalized === 'rejected')
}

function buildCampaignCards(campaigns, applications) {
  return campaigns.map((campaign) => {
    const matchedApplications = applications.filter(
      (application) => String(application?.campaign?.code || '').trim() === String(campaign?.code || '').trim(),
    )

    return {
      ...campaign,
      applications: matchedApplications,
    }
  })
}

export default function AdmissionDashboard() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [campaignCards, setCampaignCards] = useState([])
  const [selectedApplication, setSelectedApplication] = useState(null)

  const tenantCode = useMemo(
    () => String(tenant?.currentTenant?.tenantCode || '').trim().toLowerCase(),
    [tenant?.currentTenant?.tenantCode],
  )

  useEffect(() => {
    let isCancelled = false

    async function loadDashboard() {
      if (!tenantCode) {
        setErrorMessage('Không tìm thấy tenant')
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      setCampaignCards([])

      try {
        const [campaignsResponse, applicationsResponse] = await Promise.all([
          api.get('/admission-campaigns', {
            params: {
              status: 'open',
            },
          }),
          api.get('/admission-applications/me/list'),
        ])
        if (isCancelled) return

        const campaigns = unwrapRows(campaignsResponse?.data)
        const applications = unwrapRows(applicationsResponse?.data)
        setCampaignCards(buildCampaignCards(campaigns, applications))
      } catch (error) {
        if (isCancelled) return

        const apiMessage =
          error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          'Không thể kiểm tra hồ sơ tuyển sinh'

        setCampaignCards([])
        setErrorMessage(apiMessage)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      isCancelled = true
    }
  }, [navigate, tenantCode])

  function handleRegisterNow(campaignCode) {
    if (!campaignCode) return
    navigate(`/admission/applications/new/${encodeURIComponent(campaignCode)}`)
  }

  function handleManageApplications(applicationId) {
    if (!applicationId) return
    navigate(`/admission/applications/${encodeURIComponent(String(applicationId))}/edit`)
  }

  function handleViewApplications(applicationId) {
    if (!applicationId) return
    navigate(`/admission/applications/${encodeURIComponent(String(applicationId))}/view`)
  }

  return (
    <CContainer fluid className='py-4 px-3 px-lg-4 h-100'>
      <CCard className='border-0 shadow-sm h-100'>
        <CCardHeader className='bg-white border-0 py-3'>
          <div className='fw-semibold fs-5'>Hồ sơ tuyển sinh của bạn</div>
        </CCardHeader>
        <CCardBody>
          {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}

          {loading ? (
            <div className='text-center py-5'>
              <CSpinner />
            </div>
          ) : campaignCards.length === 0 ? (
            <div className='text-center py-5'>
              <div className='fs-5 fw-semibold mb-2'>Hiện chưa có kỳ tuyển sinh đang mở</div>
              <div className='text-body-secondary'>Tenant này chưa có kỳ tuyển sinh mở để phụ huynh khai hồ sơ.</div>
            </div>
          ) : (
            <CRow className='g-4'>
              {campaignCards.map((campaign) => (
                <CCol md={12} key={campaign.id || campaign.code}>
                  <CRow className='g-4 align-items-start'>
                    <CCol md={8}>
                      <CCard className='border rounded-3 h-100'>
                        <CCardHeader className='bg-white border-0'>
                          <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
                            <div>
                              <div className='fw-semibold fs-5'>{campaign.name || 'Kỳ tuyển sinh'}</div>
                              <div className='text-body-secondary small'>
                                Mã kỳ: {campaign.code || '-'} · Diễn ra từ {formatDate(campaign.startDate)} đến {formatDate(campaign.endDate)}
                              </div>
                            </div>
                            <CBadge color='success'>Đang mở</CBadge>
                          </div>
                        </CCardHeader>
                        <CCardBody>
                          {campaign.applications.length > 0 ? (
                            <>
                              <div className='fw-semibold mb-3'>Hồ sơ của phụ huynh trong kỳ này</div>
                              <CListGroup flush>
                                {campaign.applications.map((application) => {
                                  const isEditable = canEditApplication(application)

                                  return (
                                    <CListGroupItem
                                      key={application.id}
                                      className='px-0 d-flex justify-content-between align-items-start gap-3 flex-wrap'
                                    >
                                      <div>
                                        <div className='fw-semibold'>{application.studentName || 'Chưa có tên học sinh'}</div>
                                        <div className='small text-body-secondary'>
                                          Mã hồ sơ: {application.applicationCode || '-'} · Tạo lúc {formatDateTime(application.createdAt)}
                                        </div>
                                      </div>
                                      <div className='d-flex align-items-center gap-2 flex-wrap justify-content-end'>
                                        <CBadge color={getStatusColor(application.status)}>{getStatusLabel(application.status)}</CBadge>
                                        <CButton
                                          color='primary'
                                          variant='outline'
                                          size='sm'
                                          onClick={() => handleViewApplications(application.id)}
                                        >
                                          Xem hồ sơ
                                        </CButton>
                                        {isEditable ? (
                                          <CButton
                                            color='warning'
                                            variant='outline'
                                            size='sm'
                                            onClick={() => handleManageApplications(application.id)}
                                          >
                                            Sửa hồ sơ
                                          </CButton>
                                        ) : (
                                          <CButton
                                            color='secondary'
                                            variant='outline'
                                            size='sm'
                                            onClick={() => setSelectedApplication(application)}
                                          >
                                            Theo dõi
                                          </CButton>
                                        )}
                                      </div>
                                    </CListGroupItem>
                                  )
                                })}
                              </CListGroup>

                              <div className='mt-3 d-flex justify-content-end'>
                                <CButton color='primary' variant='outline' onClick={() => handleRegisterNow(campaign.code)}>
                                  Thêm hồ sơ mới (Khi PH muốn đk cho 2 con trở lên)
                                </CButton>
                              </div>
                            </>
                          ) : (
                            <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
                              <div>
                                <div className='fw-semibold'>Chưa có hồ sơ nào cho kỳ này</div>
                                <div className='text-body-secondary small'>
                                  Phụ huynh có thể khai hồ sơ mới theo mẫu của kỳ tuyển sinh này.
                                </div>
                              </div>
                              <CButton color='primary' onClick={() => handleRegisterNow(campaign.code)}>
                                Khai hồ sơ
                              </CButton>
                            </div>
                          )}
                        </CCardBody>
                      </CCard>
                    </CCol>

                    <CCol md={4}>
                      <CCard className='border rounded-3 h-100'>
                        <CCardHeader className='bg-white border-0'>📘 Giới thiệu tuyển sinh</CCardHeader>
                        <CCardBody>
                          {campaign.description ? (
                            hasHtmlContent(campaign.description)
                              ? <div className='text-body-secondary' dangerouslySetInnerHTML={{ __html: campaign.description }} />
                              : <div className='text-body-secondary'>{campaign.description}</div>
                          ) : (
                            <div className='text-body-secondary'>-</div>
                          )}
                        </CCardBody>
                      </CCard>
                    </CCol>
                  </CRow>
                </CCol>
              ))}
            </CRow>
          )}
        </CCardBody>
      </CCard>

      <CModal visible={Boolean(selectedApplication)} onClose={() => setSelectedApplication(null)} alignment='center'>
        <CModalHeader>
          <CModalTitle>Chi tiết hồ sơ tuyển sinh</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-2'><strong>Đợt tuyển sinh:</strong> {selectedApplication?.campaign?.name || '-'}</div>
          <div className='mb-2'><strong>Học sinh:</strong> {selectedApplication?.studentName || '-'}</div>
          <div className='mb-2'><strong>Mã hồ sơ:</strong> {selectedApplication?.applicationCode || '-'}</div>
          <div className='mb-2'><strong>Trạng thái:</strong> {getStatusLabel(selectedApplication?.status)}</div>
          <div className='mb-2'><strong>Ngày nộp:</strong> {formatDateTime(selectedApplication?.submittedAt)}</div>
          <div><strong>Cập nhật:</strong> {formatDateTime(selectedApplication?.reviewedAt || selectedApplication?.createdAt)}</div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setSelectedApplication(null)}>
            Đóng
          </CButton>
        </CModalFooter>
      </CModal>
    </CContainer>
  )
}