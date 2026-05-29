import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CContainer,
  CSpinner,
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import { sanitizeHtml } from '../../../pages/journal/journalPublicUtils'
import AdmissionV1Hero from '../components/AdmissionV1Hero'
import AdmissionV1GuideModal from '../components/AdmissionV1GuideModal'
import {
  acknowledgeAdmissionV1Approval,
  buildAdmissionV1Permissions,
  buildAdmissionV1Path,
  clearAdmissionV1Token,
  formatAdmissionStatus,
  formatDate,
  getAdmissionV1CampaignStatusMessage,
  getAdmissionStatusColor,
  getAdmissionV1ErrorMessage,
  getPublicAdmissionCampaign,
  getAdmissionV1Session,
  readAdmissionV1Token,
  storeAdmissionV1Token,
} from '../services/admissionV1Service'
import './admission-v1.css'

function hasCampaignTenant(campaign) {
  return Boolean(campaign?.tenant?.name || campaign?.tenant?.note)
}

function isAcceptedApplication(application) {
  const admissionStatus = String(application?.status || application?.admissionStatus || '').trim().toLowerCase()
  const reviewStatus = String(application?.reviewStatus || '').trim().toLowerCase()
  return admissionStatus === 'approved' || reviewStatus === 'accepted'
}

function readApprovedAcknowledgedAt(source) {
  return source?.application?.approvedAcknowledgedAt || source?.approvedAcknowledgedAt || source?.acknowledgedAt || null
}

export default function AdmissionV1TrackingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const [searchParams] = useSearchParams()
  const queryToken = String(searchParams.get('token') || '').trim()
  const resolvedTenantCode = useMemo(
    () => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(),
    [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode],
  )

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [session, setSession] = useState(location.state?.session || null)
  const [campaign, setCampaign] = useState(location.state?.session?.campaign || null)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [submissionSuccessNotice] = useState(location.state?.submissionSuccessNotice || null)
  const [acknowledgingApproval, setAcknowledgingApproval] = useState(false)
  const [approvalAcknowledgeError, setApprovalAcknowledgeError] = useState('')
  const permissions = useMemo(
    () => ({
      ...buildAdmissionV1Permissions(session?.campaign || campaign, session?.application),
      ...(session?.permissions || {}),
    }),
    [campaign, session?.application, session?.campaign, session?.permissions],
  )
  const campaignStatusMessage = getAdmissionV1CampaignStatusMessage(session?.campaign || campaign)
  const safeReviewNoteHtml = sanitizeHtml(session?.application?.reviewNote)
  const approvedAcknowledgedAt = readApprovedAcknowledgedAt(session)
  const isAcceptedAwaitingAcknowledgement = isAcceptedApplication(session?.application) && !approvedAcknowledgedAt
  const isAcceptedAcknowledged = isAcceptedApplication(session?.application) && Boolean(approvedAcknowledgedAt)

  useEffect(() => {
    let isCancelled = false

    async function loadSession() {
      const fallbackToken = readAdmissionV1Token(campaignCode, resolvedTenantCode)
      const token = queryToken || fallbackToken
      if (!token) {
        navigate(buildAdmissionV1Path(campaignCode, '', resolvedTenantCode), { replace: true })
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {
        const payload = await getAdmissionV1Session(token, resolvedTenantCode)
        if (isCancelled) return
        storeAdmissionV1Token(campaignCode, token, resolvedTenantCode)
        setSession(payload)
        setCampaign((current) => {
          if (current && hasCampaignTenant(current)) return current
          return payload?.campaign || current || null
        })
      } catch (error) {
        if (isCancelled) return
        clearAdmissionV1Token(campaignCode, resolvedTenantCode)
        setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể tải phiên admission'))
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      isCancelled = true
    }
  }, [campaignCode, navigate, queryToken, resolvedTenantCode])

  useEffect(() => {
    let isCancelled = false

    if (campaign && hasCampaignTenant(campaign)) {
      return () => {
        isCancelled = true
      }
    }

    async function loadCampaign() {
      if (!campaignCode) {
        if (!isCancelled) {
          setCampaign((current) => current || session?.campaign || null)
        }
        return
      }

      try {
        const payload = await getPublicAdmissionCampaign(campaignCode, resolvedTenantCode)
        if (isCancelled) return
        setCampaign(payload || session?.campaign || null)
      } catch {
        if (isCancelled) return
        setCampaign((current) => current || session?.campaign || null)
      }
    }

    loadCampaign()

    return () => {
      isCancelled = true
    }
  }, [campaign, campaignCode, resolvedTenantCode, session?.campaign])

  async function handleAcknowledgeApproval() {
    const applicationId = Number(session?.application?.id || 0)
    const token = readAdmissionV1Token(campaignCode, resolvedTenantCode)
    if (!applicationId || !token || acknowledgingApproval) return

    setAcknowledgingApproval(true)
    setApprovalAcknowledgeError('')

    try {
      const payload = await acknowledgeAdmissionV1Approval(applicationId, token, {}, resolvedTenantCode)
      const nextAcknowledgedAt = readApprovedAcknowledgedAt(payload) || new Date().toISOString()
      if (payload?.application) {
        setSession((current) => ({
          ...current,
          approvedAcknowledgedAt: nextAcknowledgedAt,
          application: {
            ...payload.application,
            approvedAcknowledgedAt: payload?.application?.approvedAcknowledgedAt || nextAcknowledgedAt,
          },
        }))
      } else {
        setSession((current) => ({
          ...current,
          approvedAcknowledgedAt: nextAcknowledgedAt,
          application: {
            ...(current?.application || {}),
            approvedAcknowledgedAt: nextAcknowledgedAt,
          },
        }))
      }
    } catch (requestError) {
      setApprovalAcknowledgeError(getAdmissionV1ErrorMessage(requestError, 'Không thể xác nhận đã nhận thông tin duyệt hồ sơ'))
    } finally {
      setAcknowledgingApproval(false)
    }
  }

  return (
    <div className='admission-v1-shell py-4 py-lg-5'>
      <CContainer fluid className='admission-v1-content px-3 px-lg-4'>
        <AdmissionV1Hero campaign={campaign || session?.campaign || null} campaignCode={campaignCode} resolvedTenantCode={resolvedTenantCode} allowAutoLoad={false} />

        {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}
        {submissionSuccessNotice ? (
          <CAlert color='success'>
            <div className='fw-semibold mb-1'>{submissionSuccessNotice.title || 'Đã nộp hồ sơ thành công.'}</div>
            <div>{submissionSuccessNotice.message || ''}</div>
          </CAlert>
        ) : null}
        {campaignStatusMessage ? <CAlert color='warning'>{campaignStatusMessage}</CAlert> : null}

        {loading ? (
          <div className='text-center py-5'>
            <CSpinner />
          </div>
        ) : session ? (
          <CCard className='admission-v1-card'>
            <CCardBody className='p-4 p-lg-5'>
              <div className='admission-v1-form-head mb-4'>
                <div>
                  <div className='fw-semibold fs-5'>{session?.campaign?.name || 'Kỳ tuyển sinh'}</div>
                  <div className='text-body-secondary small'>Mã kỳ: {session?.campaign?.code || '-'}</div>
                </div>
                <div className='admission-v1-actions'>
                  <CButton type='button' color='light' onClick={() => setShowGuideModal(true)}>
                    Xem lại hướng dẫn
                  </CButton>
                  {session?.application ? (
                    <CBadge color={getAdmissionStatusColor(session.application.status)}>{formatAdmissionStatus(session.application.status)}</CBadge>
                  ) : (
                    <CBadge color='secondary'>Chưa có hồ sơ</CBadge>
                  )}
                </div>
              </div>

              <div className='fw-semibold fs-5 mb-3'>Thông tin học sinh</div>
              <div className='admission-v1-detail-grid mb-4'>
                <div className='admission-v1-detail-item'>
                  <span className='admission-v1-detail-label'>Mã học sinh</span>
                  <span className='admission-v1-detail-value'>{session?.learner?.studentCode || '-'}</span>
                </div>
                <div className='admission-v1-detail-item'>
                  <span className='admission-v1-detail-label'>Họ tên</span>
                  <span className='admission-v1-detail-value'>{session?.learner?.fullName || '-'}</span>
                </div>
                <div className='admission-v1-detail-item'>
                  <span className='admission-v1-detail-label'>Ngày sinh</span>
                  <span className='admission-v1-detail-value'>{formatDate(session?.learner?.dateOfBirth)}</span>
                </div>
                <div className='admission-v1-detail-item'>
                  <span className='admission-v1-detail-label'>Phụ huynh</span>
                  <span className='admission-v1-detail-value'>{session?.learner?.parent?.fullName || session?.learner?.parentName || '-'}</span>
                </div>
              </div>

              {session?.application ? (
                <div className='admission-v1-summary-list'>
                  <div className={`admission-v1-summary-item ${isAcceptedAwaitingAcknowledgement ? 'admission-v1-summary-item--attention' : ''} ${isAcceptedAcknowledged ? 'admission-v1-summary-item--confirmed' : ''}`}>
                    <div className='fw-semibold mb-2'>Hồ sơ hiện tại</div>
                    <div className='text-body-secondary small mb-2'>
                      Mã hồ sơ: {session.application.applicationCode || '-'}
                    </div>
                    <div className='text-body-secondary small mb-3'>
                      Tạo lúc {formatDate(session.application.createdAt, true)}
                    </div>
                    {isAcceptedAwaitingAcknowledgement ? (
                      <CAlert color='success' className='admission-v1-attention-banner mb-3'>
                        <div className='fw-semibold mb-1'>Nhà trường đã tiếp nhận hồ sơ</div>
                        <div>
                          Quý phụ huynh vui lòng xem hướng dẫn tiếp theo và xác nhận đã nắm được thông tin từ nhà trường.
                        </div>
                        {approvalAcknowledgeError ? <div className='small text-danger mt-2'>{approvalAcknowledgeError}</div> : null}
                      </CAlert>
                    ) : null}
                    {isAcceptedAcknowledged ? (
                      <CAlert color='success' className='admission-v1-confirmed-banner mb-3'>
                        <div className='fw-semibold mb-1'>Phụ huynh đã xác nhận thông tin</div>
                        <div>Phụ huynh đã xác nhận đã nắm được thông tin từ nhà trường.</div>
                        {approvedAcknowledgedAt ? (
                          <div className='small mt-2'>Thời gian xác nhận: {formatDate(approvedAcknowledgedAt, true)}</div>
                        ) : null}
                      </CAlert>
                    ) : null}
                    {safeReviewNoteHtml ? (
                      <CAlert color='warning' className='mb-3'>
                        <div dangerouslySetInnerHTML={{ __html: safeReviewNoteHtml }} />
                      </CAlert>
                    ) : null}
                    <div className='admission-v1-actions'>
                      {isAcceptedAwaitingAcknowledgement ? (
                        <CButton
                          color='success'
                          className='admission-v1-cta-button admission-v1-cta-button--attention'
                          disabled={acknowledgingApproval}
                          onClick={handleAcknowledgeApproval}
                        >
                          {acknowledgingApproval ? 'Đang xác nhận...' : 'Tôi đã nắm được thông tin từ nhà trường'}
                        </CButton>
                      ) : null}
                      <CButton
                        color={permissions?.canEdit ? 'success' : 'secondary'}
                        className='admission-v1-cta-button'
                        onClick={() => navigate(buildAdmissionV1Path(campaignCode, 'ho-so', resolvedTenantCode))}
                      >
                        {permissions?.canEdit ? 'Cập nhật hồ sơ' : 'Xem hồ sơ'}
                      </CButton>
                      {isAcceptedAwaitingAcknowledgement ? <CBadge color='warning'>Cần xác nhận</CBadge> : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className='admission-v1-step-note'>
                  Học sinh này chưa có hồ sơ trong kỳ tuyển sinh hiện tại. Bạn có thể tạo mới ngay bây giờ.
                </div>
              )}

              <div className='admission-v1-actions mt-4'>
                {!session?.application ? (
                  <CButton color='success' disabled={!permissions.canCreate} onClick={() => navigate(buildAdmissionV1Path(campaignCode, 'ho-so', resolvedTenantCode))}>
                    Tạo hồ sơ mới
                  </CButton>
                ) : null}
                <CButton color='light' onClick={() => navigate(buildAdmissionV1Path(campaignCode, '', resolvedTenantCode))}>
                  Tra cứu học sinh khác
                </CButton>
              </div>
            </CCardBody>
          </CCard>
        ) : null}
      </CContainer>

      <AdmissionV1GuideModal
        visible={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        campaign={campaign || session?.campaign || null}
        fallbackContent='Trang này hiển thị hồ sơ tuyển sinh tương ứng với mã học sinh và mã hồ sơ phụ huynh đã nhập.'
      />
    </div>
  )
}