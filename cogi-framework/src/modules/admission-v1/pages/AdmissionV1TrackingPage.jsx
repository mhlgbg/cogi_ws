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
  buildAdmissionV1Path,
  clearAdmissionV1Token,
  formatAdmissionStatus,
  formatDate,
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
  const safeReviewNoteHtml = sanitizeHtml(session?.application?.reviewNote)

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
                  <div className='admission-v1-summary-item'>
                    <div className='fw-semibold mb-2'>Hồ sơ hiện tại</div>
                    <div className='text-body-secondary small mb-2'>
                      Mã hồ sơ: {session.application.applicationCode || '-'}
                    </div>
                    <div className='text-body-secondary small mb-3'>
                      Tạo lúc {formatDate(session.application.createdAt, true)}
                    </div>
                    {safeReviewNoteHtml ? (
                      <CAlert color='warning' className='mb-3'>
                        <div dangerouslySetInnerHTML={{ __html: safeReviewNoteHtml }} />
                      </CAlert>
                    ) : null}
                    <div className='admission-v1-actions'>
                      <CButton
                        color={session?.permissions?.canEdit ? 'success' : 'secondary'}
                        onClick={() => navigate(buildAdmissionV1Path(campaignCode, 'ho-so', resolvedTenantCode))}
                      >
                        {session?.permissions?.canEdit ? 'Cập nhật hồ sơ' : 'Xem hồ sơ'}
                      </CButton>
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
                  <CButton color='success' onClick={() => navigate(buildAdmissionV1Path(campaignCode, 'ho-so', resolvedTenantCode))}>
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