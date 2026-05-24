import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CForm,
  CRow,
  CSpinner,
} from '@coreui/react'
import AdmissionReviewDecisionModal from '../components/AdmissionReviewDecisionModal'
import AdmissionReviewConversationPanel from '../components/AdmissionReviewConversationPanel'
import {
  getAdmissionReviewDetail,
  logAdmissionReviewDetailView,
  sendAdmissionApprovalReminder,
  submitAdmissionReviewDecision,
} from '../services/admissionManagementService'
import AdmissionReviewEvidenceWorkspace from '../components/AdmissionReviewEvidenceWorkspace'
import AdmissionReviewApplicationInfoPanel from '../components/AdmissionReviewApplicationInfoPanel'
import FormRenderer from '../../../pages/admission/form-renderer/FormRenderer'
import {
  buildInitialFormData,
  extractTemplateFields,
} from '../../../pages/admission/form-renderer/schema'
import {
  extractEvidenceFallback,
  getOpenableSnapshotEvidences,
  hasUsableReviewSnapshot,
  mergeReviewSectionsWithFormDataTables,
  normalizeReviewSnapshot,
} from '../utils/reviewSnapshot'
import { buildConfiguredReviewSections } from '../utils/reviewDisplayConfig'
import './admission-review-detail.css'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function getReviewStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'draft') return 'Nháp'
  if (normalized === 'submitted') return 'Chờ duyệt'
  if (normalized === 'returned') return 'Trả lại'
  if (normalized === 'accepted') return 'Đã tiếp nhận'
  return normalized || '-'
}

function getReviewStatusColor(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'draft') return 'secondary'
  if (normalized === 'submitted') return 'warning'
  if (normalized === 'returned') return 'danger'
  if (normalized === 'accepted') return 'success'
  return 'secondary'
}

export default function AdmissionReviewDetailPage() {
  const navigate = useNavigate()
  const params = useParams()
  const applicationId = String(params?.id || '').trim()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [detail, setDetail] = useState(null)
  const [decisionAction, setDecisionAction] = useState('')
  const [snapshotWarning, setSnapshotWarning] = useState('')
  const [useFallbackRenderer, setUseFallbackRenderer] = useState(false)
  const [conversationRefreshKey, setConversationRefreshKey] = useState(0)
  const [sendingApprovalReminder, setSendingApprovalReminder] = useState(false)
  const viewActivityLoggedRef = useRef('')

  const normalizedSnapshot = useMemo(() => normalizeReviewSnapshot(detail?.reviewSnapshot), [detail?.reviewSnapshot])
  const configuredReviewSections = useMemo(() => buildConfiguredReviewSections(detail), [detail])
  const reviewSections = useMemo(() => (
    Array.isArray(configuredReviewSections) && configuredReviewSections.length > 0
      ? configuredReviewSections
      : mergeReviewSectionsWithFormDataTables(normalizedSnapshot.sections, detail?.formData)
  ), [configuredReviewSections, normalizedSnapshot.sections, detail?.formData])
  const templateFields = useMemo(() => (
    useFallbackRenderer ? extractTemplateFields(detail?.campaign?.formTemplate?.schema) : []
  ), [detail?.campaign?.formTemplate?.schema, useFallbackRenderer])
  const formData = useMemo(() => (
    useFallbackRenderer ? buildInitialFormData(detail, templateFields) : {}
  ), [detail, templateFields, useFallbackRenderer])
  const evidences = useMemo(() => {
    const snapshotEvidences = getOpenableSnapshotEvidences(detail?.reviewSnapshot)
    if (snapshotEvidences.images.length > 0 || snapshotEvidences.pdfs.length > 0) {
      return snapshotEvidences
    }
    return extractEvidenceFallback(detail)
  }, [detail])

  const currentReviewStatus = String(detail?.reviewStatus || '').trim().toLowerCase()
  const canReview = currentReviewStatus === 'submitted'
  const canRequestRevision = currentReviewStatus === 'submitted' || currentReviewStatus === 'accepted'
  const canSendApprovalReminder = String(detail?.admissionStatus || '').trim().toLowerCase() === 'approved' && !detail?.approvedAcknowledgedAt

  const loadDetail = useCallback(async () => {
    if (!applicationId) return

    setLoading(true)
    setError('')
    setSnapshotWarning('')

    try {
      const data = await getAdmissionReviewDetail(applicationId)
      const usableSnapshot = hasUsableReviewSnapshot(data?.reviewSnapshot)
      const shouldUseFallback = !usableSnapshot
      const nextWarning = usableSnapshot
        ? ''
        : 'Chưa có dữ liệu snapshot. Vui lòng quay lại danh sách hồ sơ và bấm "Làm mới" để sinh snapshot.'

      setDetail(data)
      setUseFallbackRenderer(shouldUseFallback)
      setSnapshotWarning(nextWarning)
    } catch (requestError) {
      setDetail(null)
      setUseFallbackRenderer(false)
      setError(getApiMessage(requestError, 'Không tải được chi tiết hồ sơ tuyển sinh'))
    } finally {
      setLoading(false)
    }
  }, [applicationId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (!applicationId || viewActivityLoggedRef.current === applicationId) return
    viewActivityLoggedRef.current = applicationId
    logAdmissionReviewDetailView(applicationId).catch(() => {})
  }, [applicationId])

  async function handleDecision(payload) {
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await submitAdmissionReviewDecision(applicationId, payload)
      setDecisionAction('')
      setSuccess(payload.action === 'returned' ? 'Đã cập nhật hồ sơ cần chỉnh sửa để phụ huynh xem và bổ sung' : 'Đã tiếp nhận hồ sơ')
      if (payload.action === 'returned') {
        setConversationRefreshKey((current) => current + 1)
      }
      await loadDetail()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật kết quả duyệt hồ sơ'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSendApprovalReminder() {
    if (!applicationId || sendingApprovalReminder) return

    setSendingApprovalReminder(true)
    setError('')
    setSuccess('')

    try {
      const updated = await sendAdmissionApprovalReminder(applicationId)
      setDetail(updated)
      setSuccess('Đã gửi nhắc xác nhận tới phụ huynh')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gửi nhắc xác nhận'))
    } finally {
      setSendingApprovalReminder(false)
    }
  }

  return (
    <CContainer fluid className='py-4 px-0'>
      <CRow className='g-4'>
        <CCol xs={12}>
          <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
            <div>
              <div className='fw-semibold fs-4'>{detail?.studentName || 'Chi tiết hồ sơ tuyển sinh'}</div>
              <div className='text-body-secondary'>Mã hồ sơ: {detail?.applicationCode || '-'}</div>
              <div className='small text-body-secondary mt-1'>
                Kỳ tuyển sinh: {detail?.campaign?.name || '-'}
                {detail?.submittedAt || detail?.createdAt ? ` · Nộp ngày ${formatDate(detail?.submittedAt || detail?.createdAt)}` : ''}
              </div>
            </div>
            <CBadge color={getReviewStatusColor(detail?.reviewStatus)}>{getReviewStatusLabel(detail?.reviewStatus)}</CBadge>
          </div>
        </CCol>

        <CCol xs={12} lg={7} xl={7}>
          <div className='admission-review-panel-scroll'>
            <CCard className='border-0 shadow-sm'>
              <CCardHeader className='bg-white border-0 py-3'>
                <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
                  <div>
                    <div className='fw-semibold fs-5'>Workspace minh chứng</div>
                    <div className='small text-body-secondary'>Xem hình ảnh và PDF phục vụ duyệt hồ sơ</div>
                  </div>
                </div>
              </CCardHeader>
              <CCardBody>
                {loading ? (
                  <div className='text-center py-5'>
                    <CSpinner />
                  </div>
                ) : (
                  <>
                    {error ? <CAlert color='danger'>{error}</CAlert> : null}
                    {success ? <CAlert color='success'>{success}</CAlert> : null}
                    <AdmissionReviewEvidenceWorkspace evidences={evidences} />

                    {!loading && !error ? (
                      <div className='mt-4'>
                        <AdmissionReviewConversationPanel
                          applicationId={applicationId}
                          refreshKey={conversationRefreshKey}
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </CCardBody>
            </CCard>
          </div>
        </CCol>

        <CCol xs={12} lg={5} xl={5}>
          <div className='admission-review-panel-scroll'>
            <AdmissionReviewApplicationInfoPanel
              detail={detail}
              sections={reviewSections}
              warningMessage={snapshotWarning}
              canReview={canReview}
              canRequestRevision={canRequestRevision}
              canSendApprovalReminder={canSendApprovalReminder}
              approvalNotifiedAt={formatDate(detail?.approvalNotifiedAt)}
              approvalNotificationCount={Number(detail?.approvalNotificationCount || 0)}
              approvedAcknowledgedAt={formatDate(detail?.approvedAcknowledgedAt)}
              onSendApprovalReminder={handleSendApprovalReminder}
              sendingApprovalReminder={sendingApprovalReminder}
              submitting={submitting}
              onBack={() => navigate('/admission/reviews')}
              onAction={setDecisionAction}
              reviewStatusLabel={getReviewStatusLabel(detail?.reviewStatus)}
              reviewStatusColor={getReviewStatusColor(detail?.reviewStatus)}
              reviewerName={detail?.reviewedBy?.fullName || detail?.reviewedBy?.username || '-'}
              reviewedAt={formatDate(detail?.reviewedAt)}
              note={detail?.reviewNote || '-'}
            />

            {useFallbackRenderer ? (
              <CCard className='border-0 shadow-sm mt-4'>
                <CCardHeader className='bg-white border-0 fw-semibold'>Hiển thị dữ liệu gốc</CCardHeader>
                <CCardBody>
                  {templateFields.length === 0 ? (
                    <CAlert color='warning' className='mb-0'>FormTemplate chưa có schema.fields hoặc schema.sections để render.</CAlert>
                  ) : (
                    <CForm>
                      <FormRenderer
                        schema={detail?.campaign?.formTemplate?.schema}
                        formData={formData}
                        formErrors={{}}
                        submitting={false}
                        isReadOnly
                        fileNamesOnlyOnReadOnly
                        onValueChange={() => {}}
                        onFileChange={() => {}}
                        onTableCellChange={() => {}}
                      />
                    </CForm>
                  )}
                </CCardBody>
              </CCard>
            ) : null}
          </div>
        </CCol>
      </CRow>

      <AdmissionReviewDecisionModal
        visible={Boolean(decisionAction)}
        action={decisionAction}
        submitting={submitting}
        onClose={() => {
          if (submitting) return
          setDecisionAction('')
        }}
        onSubmit={handleDecision}
      />
    </CContainer>
  )
}
