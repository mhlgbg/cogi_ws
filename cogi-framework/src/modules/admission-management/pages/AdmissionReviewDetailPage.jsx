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
  CToast,
  CToastBody,
  CToaster,
} from '@coreui/react'
import AdmissionReviewDecisionModal from '../components/AdmissionReviewDecisionModal'
import AdmissionReviewEmailModal from '../components/AdmissionReviewEmailModal'
import AdmissionReviewEditApplicationModal from '../components/AdmissionReviewEditApplicationModal'
import {
  getAdmissionReviewEmailTemplates,
  getAdmissionReviewDetail,
  getAdmissionReviewNotificationTemplate,
  logAdmissionReviewDetailView,
  restoreAdmissionReview,
  sendAdmissionReviewEmail,
  softDeleteAdmissionReview,
  submitAdmissionReviewDecision,
  updateAdmissionReviewApplication,
  updateAdmissionReturnedReviewNote,
} from '../services/admissionManagementService'
import AdmissionReviewEvidenceWorkspace from '../components/AdmissionReviewEvidenceWorkspace'
import AdmissionReviewApplicationInfoPanel from '../components/AdmissionReviewApplicationInfoPanel'
import AdmissionReviewConversationPanel from '../components/AdmissionReviewConversationPanel'
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

function buildInitialEmailDraft() {
  return {
    subject: '',
    content: '',
    attachments: [],
    alsoCreateConversationMessage: true,
  }
}

const RETURNED_NOTE_TEMPLATE_FALLBACK = `<div style="background:#fff7e6; border:1px solid #ffd591; border-left:6px solid #faad14; padding:16px 18px; border-radius:10px; color:#613400; line-height:1.6; font-size:15px;">
  <div style="font-size:18px; font-weight:700; margin-bottom:8px;">
    ⚠️ Hồ sơ cần bổ sung / chỉnh sửa
  </div>

  <p style="margin:0 0 12px 0;">
    Nhà trường đã tiếp nhận hồ sơ đăng ký dự tuyển của học sinh. Tuy nhiên, hồ sơ hiện cần được bổ sung hoặc điều chỉnh một số nội dung như sau:
  </p>

  <div style="background:#ffffff; border:1px dashed #faad14; padding:12px 14px; border-radius:8px; margin-bottom:12px;">
    <b>Nội dung cần bổ sung / chỉnh sửa:</b>

    <ol style="margin-top:8px; padding-left:20px;">
      <li>............................................................</li>
      <li>............................................................</li>
    </ol>
  </div>

  <p style="margin:0 0 10px 0;">
    👉 Quý phụ huynh vui lòng nhấn nút <b>“Cập nhật hồ sơ”</b> để bổ sung và chỉnh sửa theo yêu cầu trên.
  </p>

  <p style="margin:0;">
    Sau khi hoàn thiện, hồ sơ sẽ được Nhà trường tiếp tục xem xét và cập nhật trạng thái trên hệ thống.
  </p>
</div>`

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
  const [emailModalVisible, setEmailModalVisible] = useState(false)
  const [editApplicationModalVisible, setEditApplicationModalVisible] = useState(false)
  const [sendingReviewEmail, setSendingReviewEmail] = useState(false)
  const [savingApplication, setSavingApplication] = useState(false)
  const [decisionInitialTemplate, setDecisionInitialTemplate] = useState('')
  const [loadingDecisionTemplate, setLoadingDecisionTemplate] = useState(false)
  const [emailDraft, setEmailDraft] = useState(() => buildInitialEmailDraft())
  const [emailTemplates, setEmailTemplates] = useState([])
  const [loadingEmailTemplates, setLoadingEmailTemplates] = useState(false)
  const [emailTemplateError, setEmailTemplateError] = useState('')
  const [selectedEmailTemplateKey, setSelectedEmailTemplateKey] = useState('')
  const [emailFileInputKey, setEmailFileInputKey] = useState(0)
  const [emailToast, setEmailToast] = useState({ visible: false, color: 'success', message: '' })
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
  const isDeleted = detail?.isDeleted === true
  const canReview = !isDeleted && currentReviewStatus === 'submitted'
  const canRequestRevision = !isDeleted && (currentReviewStatus === 'submitted' || currentReviewStatus === 'accepted')
  const canEditReturnedNote = !isDeleted && currentReviewStatus === 'returned'
  const deletedSummary = isDeleted
    ? `Hồ sơ này đã bị xóa mềm${detail?.deletedAt ? ` lúc ${formatDate(detail.deletedAt)}` : ''}${detail?.deletedBy?.fullName || detail?.deletedBy?.username ? ` bởi ${detail?.deletedBy?.fullName || detail?.deletedBy?.username}` : ''}.${detail?.deleteReason ? ` Lý do: ${detail.deleteReason}` : ''}`
    : ''

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
      if (payload.action === 'edit-returned-note') {
        const updated = await updateAdmissionReturnedReviewNote(applicationId, {
          reviewNote: payload.reviewNote,
        })
        setDetail(updated)
        setSuccess('Đã cập nhật nội dung nhận xét')
      } else {
        await submitAdmissionReviewDecision(applicationId, payload)
        setSuccess(payload.action === 'returned' ? 'Đã cập nhật hồ sơ cần chỉnh sửa để phụ huynh xem và bổ sung' : 'Đã tiếp nhận hồ sơ')
        await loadDetail()
      }
      setDecisionAction('')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật kết quả duyệt hồ sơ'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOpenEmailModal() {
    if (!loadingEmailTemplates && emailTemplates.length === 0 && applicationId) {
      setLoadingEmailTemplates(true)
      setEmailTemplateError('')
      try {
        const rows = await getAdmissionReviewEmailTemplates(applicationId)
        setEmailTemplates(Array.isArray(rows) ? rows : [])
      } catch (requestError) {
        setEmailTemplates([])
        setEmailTemplateError(getApiMessage(requestError, 'Không tải được mẫu thư từ Notification Template'))
      } finally {
        setLoadingEmailTemplates(false)
      }
    }
    setEmailModalVisible(true)
  }

  function handleOpenEditApplication() {
    if (isDeleted || loading || !detail) return
    setEditApplicationModalVisible(true)
  }

  function handleOpenDecision(action) {
    setDecisionAction(action)

    if (action !== 'returned' && action !== 'edit-returned-note') {
      setDecisionInitialTemplate('')
      setLoadingDecisionTemplate(false)
      return
    }

    if (action === 'edit-returned-note' && String(detail?.reviewNote || '').trim()) {
      setDecisionInitialTemplate(String(detail.reviewNote || '').trim())
      setLoadingDecisionTemplate(false)
      return
    }

    setDecisionInitialTemplate(RETURNED_NOTE_TEMPLATE_FALLBACK)
    if (!applicationId) return

    setLoadingDecisionTemplate(true)
    getAdmissionReviewNotificationTemplate(applicationId, 'mau-tin-nhan-yeu-cau-bo-sung')
      .then((template) => {
        const nextContent = String(template?.content || '').trim()
        setDecisionInitialTemplate(nextContent || RETURNED_NOTE_TEMPLATE_FALLBACK)
      })
      .catch(() => {
        setDecisionInitialTemplate(RETURNED_NOTE_TEMPLATE_FALLBACK)
      })
      .finally(() => {
        setLoadingDecisionTemplate(false)
      })
  }

  function handleCloseEmailModal() {
    if (sendingReviewEmail) return
    setEmailModalVisible(false)
  }

  function handleEmailDraftChange(patch) {
    setEmailDraft((current) => ({
      ...current,
      ...(patch || {}),
    }))
  }

  function handleEmailTemplateChange(templateKey) {
    setSelectedEmailTemplateKey(templateKey)
    const template = emailTemplates.find((entry) => entry.key === templateKey)
    if (!template) return

    setEmailDraft((current) => ({
      ...current,
      subject: template.subject,
      content: template.content,
    }))
  }

  async function handleSendReviewEmail() {
    if (!applicationId || sendingReviewEmail) return

    setSendingReviewEmail(true)
    setError('')
    setSuccess('')

    try {
      const result = await sendAdmissionReviewEmail(applicationId, emailDraft)
      if (result?.application) {
        setDetail(result.application)
      }
      setEmailModalVisible(false)
      setSelectedEmailTemplateKey('')
      setEmailDraft(buildInitialEmailDraft())
      setEmailFileInputKey((current) => current + 1)
      setEmailToast({ visible: true, color: 'success', message: 'Đã gửi email cho phụ huynh' })
    } catch (requestError) {
      setEmailToast({
        visible: true,
        color: 'danger',
        message: getApiMessage(requestError, 'Không thể gửi email cho phụ huynh'),
      })
    } finally {
      setSendingReviewEmail(false)
    }
  }

  async function handleSoftDelete() {
  if (!applicationId || submitting || isDeleted) return
  const confirmed = window.confirm('Xóa mềm hồ sơ này? Hồ sơ sẽ bị ẩn khỏi các luồng làm việc thông thường và có thể khôi phục sau.')
  if (!confirmed) return
  const reason = window.prompt('Lý do xóa mềm (có thể để trống):', detail?.deleteReason || '')
  if (reason === null) return

  setSubmitting(true)
  setError('')
  setSuccess('')
  try {
    const updated = await softDeleteAdmissionReview(applicationId, {
      reason: String(reason || '').trim() || undefined,
    })
    setDetail(updated)
    setSuccess('Đã xóa mềm hồ sơ')
  } catch (requestError) {
    setError(getApiMessage(requestError, 'Không thể xóa mềm hồ sơ'))
  } finally {
    setSubmitting(false)
  }
  }

  async function handleRestoreDeleted() {
  if (!applicationId || submitting || !isDeleted) return
  const confirmed = window.confirm('Khôi phục hồ sơ này về trạng thái hoạt động?')
  if (!confirmed) return
  const reason = window.prompt('Lý do khôi phục (có thể để trống):', detail?.restoreReason || '')
  if (reason === null) return

  setSubmitting(true)
  setError('')
  setSuccess('')
  try {
    const updated = await restoreAdmissionReview(applicationId, {
      reason: String(reason || '').trim() || undefined,
    })
    setDetail(updated)
    setSuccess('Đã khôi phục hồ sơ')
  } catch (requestError) {
    setError(getApiMessage(requestError, 'Không thể khôi phục hồ sơ'))
  } finally {
    setSubmitting(false)
  }

  }

  async function handleSaveApplication(payload) {
    if (!applicationId || savingApplication) return

    setSavingApplication(true)
    setError('')
    setSuccess('')
    try {
      const updated = await updateAdmissionReviewApplication(applicationId, payload)
      const usableSnapshot = hasUsableReviewSnapshot(updated?.reviewSnapshot)
      setDetail(updated)
      setUseFallbackRenderer(!usableSnapshot)
      setSnapshotWarning(usableSnapshot ? '' : 'Chưa có dữ liệu snapshot. Vui lòng quay lại danh sách hồ sơ và bấm "Làm mới" để sinh snapshot.')
      setEditApplicationModalVisible(false)
      setSuccess('Đã cập nhật hồ sơ tuyển sinh')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật hồ sơ tuyển sinh'))
      throw requestError
    } finally {
      setSavingApplication(false)
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
          {isDeleted ? (
            <CAlert color='warning' className='mt-3 mb-0'>
              {deletedSummary}
            </CAlert>
          ) : null}
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
              canEditReturnedNote={canEditReturnedNote}
              approvalNotifiedAt={formatDate(detail?.approvalNotifiedAt)}
              approvalNotificationCount={Number(detail?.approvalNotificationCount || 0)}
              approvedAcknowledgedAt={formatDate(detail?.approvedAcknowledgedAt)}
              onOpenEmailModal={handleOpenEmailModal}
              onEditApplication={handleOpenEditApplication}
              onEditReturnedNote={() => handleOpenDecision('edit-returned-note')}
              onRestoreDeleted={handleRestoreDeleted}
              onSoftDelete={handleSoftDelete}
              submitting={submitting}
              editingApplication={savingApplication}
              restoringDeleted={submitting && isDeleted}
              softDeleting={submitting && !isDeleted}
              onBack={() => navigate('/admission/reviews')}
              onAction={handleOpenDecision}
              isDeleted={isDeleted}
              reviewStatusLabel={getReviewStatusLabel(detail?.reviewStatus)}
              reviewStatusColor={getReviewStatusColor(detail?.reviewStatus)}
              reviewerName={detail?.reviewedBy?.fullName || detail?.reviewedBy?.username || '-'}
              reviewedAt={formatDate(detail?.reviewedAt)}
              note={detail?.reviewNote || '-'}
            />

            <div className='mt-4'>
              <AdmissionReviewConversationPanel applicationId={applicationId} />
            </div>

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
        initialNoteTemplate={(decisionAction === 'returned' || decisionAction === 'edit-returned-note') ? decisionInitialTemplate : ''}
        loadingInitialNote={(decisionAction === 'returned' || decisionAction === 'edit-returned-note') && loadingDecisionTemplate}
        title={decisionAction === 'edit-returned-note' ? 'Sửa nội dung nhận xét' : undefined}
        submitLabel={decisionAction === 'edit-returned-note' ? 'Lưu nhận xét' : undefined}
        submitting={submitting}
        onClose={() => {
          if (submitting) return
          setDecisionAction('')
          setLoadingDecisionTemplate(false)
        }}
        onSubmit={handleDecision}
      />

      <AdmissionReviewEmailModal
        visible={emailModalVisible}
        sending={sendingReviewEmail}
        recipientEmail={detail?.parent?.email || ''}
        draft={emailDraft}
        loadingTemplates={loadingEmailTemplates}
        templateError={emailTemplateError}
        templates={emailTemplates}
        selectedTemplateKey={selectedEmailTemplateKey}
        fileInputKey={emailFileInputKey}
        onClose={handleCloseEmailModal}
        onTemplateChange={handleEmailTemplateChange}
        onDraftChange={handleEmailDraftChange}
        onFilesChange={(files) => handleEmailDraftChange({ attachments: files })}
        onSubmit={handleSendReviewEmail}
      />

      <AdmissionReviewEditApplicationModal
        visible={editApplicationModalVisible}
        detail={detail}
        saving={savingApplication}
        onClose={() => {
          if (savingApplication) return
          setEditApplicationModalVisible(false)
        }}
        onSubmit={handleSaveApplication}
      />

      <CToaster placement='top-end'>
        <CToast
          visible={emailToast.visible}
          autohide
          delay={2500}
          color={emailToast.color}
          onClose={() => setEmailToast((current) => ({ ...current, visible: false }))}
        >
          <CToastBody>{emailToast.message}</CToastBody>
        </CToast>
      </CToaster>
    </CContainer>
  )
}
