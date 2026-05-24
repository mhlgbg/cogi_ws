import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCollapse,
  CContainer,
  CForm,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import FormRenderer from '../../../pages/admission/form-renderer/FormRenderer'
import AdmissionV1Hero from '../components/AdmissionV1Hero'
import AdmissionV1GuideModal from '../components/AdmissionV1GuideModal'
import AdmissionV1ConversationPanel from '../components/AdmissionV1ConversationPanel'
import {
  buildInitialFormData,
  extractTemplateFields,
  validateFieldValue,
  validateFormData,
} from '../../../pages/admission/form-renderer/schema'
import { useTenant } from '../../../contexts/TenantContext'
import { sanitizeHtml } from '../../../pages/journal/journalPublicUtils'
import {
  acknowledgeAdmissionV1Approval,
  buildAdmissionV1Path,
  formatAdmissionStatus,
  getAdmissionV1ErrorMessage,
  getPublicAdmissionCampaign,
  getAdmissionV1Session,
  trackAdmissionV1ParentView,
  readAdmissionV1Token,
  updateAdmissionV1Application,
  createAdmissionV1Application,
} from '../services/admissionV1Service'
import './admission-v1.css'

function readAdmissionMaxFileSizeBytes() {
  const configuredMb = Number(import.meta.env.VITE_ADMISSION_V1_MAX_FILE_SIZE_MB || 20)
  if (!Number.isFinite(configuredMb) || configuredMb <= 0) {
    return 20 * 1024 * 1024
  }

  return configuredMb * 1024 * 1024
}

const ADMISSION_V1_MAX_FILE_SIZE_BYTES = readAdmissionMaxFileSizeBytes()

function formatBytes(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return '0 MB'
  return `${(size / (1024 * 1024)).toFixed(0)} MB`
}

function formatDateTime(value) {
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

function hasCampaignTenant(campaign) {
  return Boolean(campaign?.tenant?.name || campaign?.tenant?.note)
}

function toSerializableFile(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      resolve(null)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: typeof reader.result === 'string' ? reader.result : '',
      })
    }
    reader.onerror = () => reject(new Error('Không thể đọc file tải lên'))
    reader.readAsDataURL(file)
  })
}

async function toSerializableFiles(fileList, multiple) {
  const files = Array.from(fileList || []).filter((file) => file instanceof File)
  if (files.length === 0) {
    return multiple ? [] : null
  }

  const serializedFiles = await Promise.all(files.map((file) => toSerializableFile(file)))
  const normalizedFiles = serializedFiles.filter(Boolean)
  return multiple ? normalizedFiles : normalizedFiles[0] || null
}

function readStringValue(formData, key) {
  const value = formData?.[key]
  if (value === null || value === undefined || typeof value === 'object') return ''
  return String(value).trim()
}

function normalizeDateForApi(value) {
  const text = String(value || '').trim()
  if (!text) return ''

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  const localMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (!localMatch) return text

  const day = Number(localMatch[1])
  const month = Number(localMatch[2])
  const year = Number(localMatch[3])
  const normalized = new Date(Date.UTC(year, month - 1, day))

  if (
    Number.isNaN(normalized.getTime())
    || normalized.getUTCFullYear() !== year
    || normalized.getUTCMonth() + 1 !== month
    || normalized.getUTCDate() !== day
  ) {
    return text
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function normalizeFormDateFields(formData, fields) {
  const nextFormData = { ...(formData || {}) }

  ;(fields || []).forEach((field) => {
    if (!field?.key) return

    if (field.type === 'date') {
      nextFormData[field.key] = normalizeDateForApi(nextFormData[field.key])
      return
    }

    if (field.type !== 'table' || !Array.isArray(field.columns)) return

    const tableValue = Array.isArray(nextFormData[field.key]) ? nextFormData[field.key] : []
    nextFormData[field.key] = tableValue.map((row) => {
      if (!row || typeof row !== 'object') return row

      const nextRow = { ...row }
      field.columns.forEach((column) => {
        if (column?.type === 'date' && column.key) {
          nextRow[column.key] = normalizeDateForApi(nextRow[column.key])
        }
      })
      return nextRow
    })
  })

  return nextFormData
}

function buildSubmissionPayload(formData, templateFields, submissionMode, fallbackStudentName, fallbackDob) {
  const normalizedFormData = normalizeFormDateFields(formData, templateFields)
  return {
    submissionMode,
    studentName: readStringValue(normalizedFormData, 'studentName') || fallbackStudentName,
    dob: normalizeDateForApi(readStringValue(normalizedFormData, 'dob')) || normalizeDateForApi(fallbackDob),
    gender: readStringValue(normalizedFormData, 'gender') || null,
    currentSchool: readStringValue(normalizedFormData, 'currentSchool'),
    address: readStringValue(normalizedFormData, 'address'),
    formData: normalizedFormData,
  }
}

function ensureAdmissionDefaults(formData, learner) {
  const nextFormData = { ...(formData || {}) }
  if (!readStringValue(nextFormData, 'studentName')) {
    nextFormData.studentName = learner?.fullName || ''
  }
  if (!readStringValue(nextFormData, 'dob')) {
    nextFormData.dob = String(learner?.dateOfBirth || '').slice(0, 10)
  }
  if (!readStringValue(nextFormData, 'studentCode')) {
    nextFormData.studentCode = learner?.studentCode || ''
  }
  return nextFormData
}

export default function AdmissionV1FormPage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const resolvedTenantCode = useMemo(
    () => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(),
    [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode],
  )

  const [session, setSession] = useState(null)
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false)
  const [formData, setFormData] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [conversationHasMessages, setConversationHasMessages] = useState(Boolean(session?.application?.lastMessageAt))
  const [acknowledgingApproval, setAcknowledgingApproval] = useState(false)
  const [approvalAcknowledgeError, setApprovalAcknowledgeError] = useState('')
  const viewLoggedRef = useRef('')
  const conversationInteractedRef = useRef(false)

  const templateFields = useMemo(
    () => extractTemplateFields(session?.campaign?.formTemplate?.schema),
    [session?.campaign?.formTemplate?.schema],
  )

  const isReadOnly = Boolean(session?.application && session?.permissions?.canEdit === false)
  const safeReviewNoteHtml = sanitizeHtml(session?.application?.reviewNote)
  const applicationStatus = String(session?.application?.status || '').trim().toLowerCase()
  const showConversationPanel = Boolean(session?.application?.id) && applicationStatus !== 'draft'
  const shouldAutoExpandConversation = showConversationPanel && (
    String(session?.application?.conversationStatus || '').trim().toLowerCase() === 'need_update'
    || Number(session?.application?.parentUnreadMessageCount || 0) > 0
  )
  const approvedAcknowledgedAt = session?.application?.approvedAcknowledgedAt || null
  const isApprovedAwaitingAcknowledgement = applicationStatus === 'approved' && !approvedAcknowledgedAt
  const isApprovedAcknowledged = applicationStatus === 'approved' && Boolean(approvedAcknowledgedAt)
  const shouldShowReviewNotice = Boolean(safeReviewNoteHtml) && !conversationHasMessages
  const fileFieldsLocked = Boolean(session?.application?.id) && applicationStatus !== 'draft'
  const [conversationExpanded, setConversationExpanded] = useState(shouldAutoExpandConversation)
  const fieldOverrides = useMemo(() => {
    if (!fileFieldsLocked) return {}

    return Object.fromEntries(
      templateFields
        .filter((field) => field?.type === 'file' || field?.type === 'image')
        .map((field) => ([field.key, {
          isReadOnly: true,
          helperText: 'Minh chứng bổ sung hoặc thay thế vui lòng gửi trong mục Trao đổi với nhà trường.',
        }])),
    )
  }, [fileFieldsLocked, templateFields])

  useEffect(() => {
    if (conversationInteractedRef.current) return
    if (shouldAutoExpandConversation) {
      setConversationExpanded(true)
    }
  }, [shouldAutoExpandConversation])

  useEffect(() => {
    setConversationHasMessages(Boolean(session?.application?.lastMessageAt))
  }, [session?.application?.id, session?.application?.lastMessageAt])

  function handleToggleConversation() {
    conversationInteractedRef.current = true
    setConversationExpanded((current) => !current)
  }

  useEffect(() => {
    let isCancelled = false

    async function loadSession() {
      const token = readAdmissionV1Token(campaignCode, resolvedTenantCode)
      if (!token) {
        navigate(buildAdmissionV1Path(campaignCode, '', resolvedTenantCode), { replace: true })
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {
        const payload = await getAdmissionV1Session(token, resolvedTenantCode)
        if (isCancelled) return

        setSession(payload)
        setCampaign((current) => {
          if (current && hasCampaignTenant(current)) return current
          return payload?.campaign || current || null
        })
        setFormData(ensureAdmissionDefaults(buildInitialFormData(payload?.application, extractTemplateFields(payload?.campaign?.formTemplate?.schema)), payload?.learner))
      } catch (error) {
        if (isCancelled) return
        setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể tải hồ sơ tuyển sinh'))
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
  }, [campaignCode, navigate, resolvedTenantCode])

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

  useEffect(() => {
    const applicationId = Number(session?.application?.id || 0)
    const token = readAdmissionV1Token(campaignCode, resolvedTenantCode)
    const trackKey = applicationId > 0 ? `${applicationId}:${token}` : ''
    if (!applicationId || !token || viewLoggedRef.current === trackKey) return

    viewLoggedRef.current = trackKey
    trackAdmissionV1ParentView(applicationId, token, resolvedTenantCode).catch(() => {})
  }, [campaignCode, resolvedTenantCode, session?.application?.id])

  function updateFormValue(key, value) {
    if (isReadOnly) return

    const field = templateFields.find((item) => item.key === key)
    const nextFormData = {
      ...formData,
      [key]: value,
    }
    const nextFieldError = validateFieldValue(field, value, nextFormData)

    setFormData(nextFormData)

    setFormErrors((current) => {
      const next = { ...current }
      if (nextFieldError) {
        next[key] = nextFieldError
      } else {
        delete next[key]
      }
      return next
    })

    if (errorMessage) setErrorMessage('')
    if (successMessage) setSuccessMessage('')
    if (approvalAcknowledgeError) setApprovalAcknowledgeError('')
  }

  async function handleFileChange(field, event) {
    if (isReadOnly || fileFieldsLocked) return

    try {
      const files = Array.from(event.target.files || []).filter((file) => file instanceof File)
      const oversizedFile = files.find((file) => file.size > ADMISSION_V1_MAX_FILE_SIZE_BYTES)
      if (oversizedFile) {
        throw new Error(`Tệp "${oversizedFile.name}" vượt quá dung lượng cho phép. Hiện hệ thống hỗ trợ tối đa ${formatBytes(ADMISSION_V1_MAX_FILE_SIZE_BYTES)} mỗi tệp.`)
      }

      const serialized = await toSerializableFiles(event.target.files, field.multiple === true)
      updateFormValue(field.key, serialized)
    } catch (error) {
      setErrorMessage(error?.message || 'Không thể đọc file tải lên')
    } finally {
      event.target.value = ''
    }
  }

  function handleTableCellChange(fieldKey, rowIndex, columnKey, cellValue) {
    if (isReadOnly) return

    const tableField = templateFields.find((item) => item.key === fieldKey && item.type === 'table')

    setFormData((current) => {
      const currentTableValue = Array.isArray(current?.[fieldKey]) ? current[fieldKey] : []
      const nextTableValue = currentTableValue.map((row, index) => (
        index === rowIndex ? { ...row, [columnKey]: cellValue } : row
      ))
      const nextFormData = {
        ...current,
        [fieldKey]: nextTableValue,
      }

      const nextTableError = validateFieldValue(tableField, nextTableValue, nextFormData)

      setFormErrors((currentErrors) => {
        const nextErrors = { ...currentErrors }
        if (nextTableError) {
          nextErrors[fieldKey] = nextTableError
        } else {
          delete nextErrors[fieldKey]
        }
        return nextErrors
      })

      return {
        ...nextFormData,
      }
    })
  }

  async function submitForm(submissionMode) {
    if (!session) return
    if (isReadOnly) {
      navigate(buildAdmissionV1Path(campaignCode, 'theo-doi', resolvedTenantCode))
      return
    }

    const nextErrors = validateFormData(formData, templateFields)
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      setErrorMessage('Vui lòng kiểm tra lại các trường được đánh dấu')
      return
    }

    const token = readAdmissionV1Token(campaignCode, resolvedTenantCode)
    if (!token) {
      navigate(buildAdmissionV1Path(campaignCode, '', resolvedTenantCode), { replace: true })
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const payload = buildSubmissionPayload(
        formData,
        templateFields,
        submissionMode,
        session?.learner?.fullName || '',
        String(session?.learner?.dateOfBirth || '').slice(0, 10),
      )

      const response = session?.application?.id
        ? await updateAdmissionV1Application(session.application.id, token, payload, resolvedTenantCode)
        : await createAdmissionV1Application(token, payload, resolvedTenantCode)

      setSuccessMessage(submissionMode === 'submitted' ? 'Đã nộp hồ sơ tuyển sinh' : 'Đã lưu nháp hồ sơ tuyển sinh')
      if (response?.application) {
        setSession((current) => ({
          ...current,
          application: response.application,
          permissions: {
            canCreate: false,
            canEdit: response.application.isEditable === true,
          },
        }))
      }

      navigate(buildAdmissionV1Path(campaignCode, 'theo-doi', resolvedTenantCode), {
        replace: true,
        state: {
          submissionSuccessNotice: submissionMode === 'submitted'
            ? {
                title: 'Đã nộp hồ sơ thành công.',
                message: 'Vui lòng lưu lại mã tra cứu hồ sơ để quay trở lại xem tình trạng hồ sơ đã được nhà trường chấp nhận chưa hay còn phải sửa, đồng thời dùng để in thẻ dự thi cũng như xem điểm thi.',
              }
            : null,
        },
      })
    } catch (error) {
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không thể lưu hồ sơ tuyển sinh'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleRequestSubmit() {
    setShowSubmitConfirmModal(true)
  }

  async function handleConfirmSubmit() {
    setShowSubmitConfirmModal(false)
    await submitForm('submitted')
  }

  async function handleAcknowledgeApproval() {
    const applicationId = Number(session?.application?.id || 0)
    const token = readAdmissionV1Token(campaignCode, resolvedTenantCode)
    if (!applicationId || !token || acknowledgingApproval) return

    setAcknowledgingApproval(true)
    setApprovalAcknowledgeError('')

    try {
      const payload = await acknowledgeAdmissionV1Approval(applicationId, token, {}, resolvedTenantCode)
      if (payload?.application) {
        setSession((current) => ({
          ...current,
          application: payload.application,
        }))
      } else {
        setSession((current) => ({
          ...current,
          application: {
            ...(current?.application || {}),
            approvedAcknowledgedAt: payload?.acknowledgedAt || new Date().toISOString(),
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

        <CCard className='admission-v1-card'>
          <CCardBody className='p-4 p-lg-5'>
            {loading ? (
              <div className='text-center py-5'>
                <CSpinner />
              </div>
            ) : (
              <>
                {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}
                {successMessage ? <CAlert color='success'>{successMessage}</CAlert> : null}

                <div className='admission-v1-form-head mb-4'>
                  <div>
                    <div className='fw-semibold fs-4'>{session?.campaign?.name || 'Kỳ tuyển sinh'}</div>
                    <div className='text-body-secondary small'>
                      Học sinh: {session?.learner?.fullName || '-'} · Mã học sinh: {session?.learner?.studentCode || '-'}
                    </div>
                    {session?.application?.applicationCode ? (
                      <div className='text-body-secondary small'>Mã hồ sơ: {session.application.applicationCode}</div>
                    ) : null}
                  </div>
                  <div className='admission-v1-actions'>
                    <CButton type='button' color='light' onClick={() => setShowGuideModal(true)}>
                      Xem lại hướng dẫn
                    </CButton>
                    {session?.application ? (
                      <div className='text-body-secondary'>Trạng thái: {formatAdmissionStatus(session.application.status)}</div>
                    ) : null}
                  </div>
                </div>

                {isApprovedAwaitingAcknowledgement ? (
                  <CAlert color='warning' className='mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap'>
                    <div>
                      <div className='fw-semibold mb-1'>Hồ sơ đã được duyệt</div>
                      <div>Nhà trường đã duyệt hồ sơ của học sinh. Quý phụ huynh vui lòng xác nhận đã nhận được thông tin.</div>
                      {approvalAcknowledgeError ? <div className='small text-danger mt-2'>{approvalAcknowledgeError}</div> : null}
                    </div>
                    <CButton color='success' disabled={acknowledgingApproval} onClick={handleAcknowledgeApproval}>
                      {acknowledgingApproval ? 'Đang xác nhận...' : 'Tôi đã nắm được thông tin'}
                    </CButton>
                  </CAlert>
                ) : null}

                {isApprovedAcknowledged ? (
                  <CAlert color='success' className='mb-4'>
                    <div className='fw-semibold mb-1'>Hồ sơ đã được duyệt</div>
                    <div>Quý phụ huynh đã xác nhận đã nhận thông tin vào lúc {formatDateTime(approvedAcknowledgedAt)}.</div>
                  </CAlert>
                ) : null}

                {session?.application ? (
                  <div className='admission-v1-section mb-4'>
                    <div className='admission-v1-section__title mb-3'>Trạng thái hồ sơ</div>
                    <div className='admission-v1-status-card'>
                      <div>
                        <div className='fw-semibold'>Hồ sơ {session.application.applicationCode || '-'}</div>
                        <div className='text-body-secondary small mt-1'>
                          Trạng thái hiện tại: {formatAdmissionStatus(session.application.status)}
                        </div>
                        {!showConversationPanel && session?.application?.lastMessageAt ? (
                          <div className='text-body-secondary small'>Trao đổi gần nhất: {session.application.lastMessageAt}</div>
                        ) : null}
                      </div>
                      <div className='d-flex align-items-center gap-2 flex-wrap'>
                        <CBadge color={applicationStatus === 'rejected' ? 'warning' : 'info'}>
                          {formatAdmissionStatus(session.application.status)}
                        </CBadge>
                        {Number(session?.application?.parentUnreadMessageCount || 0) > 0 ? (
                          <CBadge color='warning'>{session.application.parentUnreadMessageCount} phản hồi mới</CBadge>
                        ) : null}
                      </div>
                    </div>
                    <CCollapse visible={!showConversationPanel || conversationExpanded}>
                      <div>
                        {session?.application?.lastMessageAt ? (
                          <div className='text-body-secondary small mt-3'>Trao đổi gần nhất: {session.application.lastMessageAt}</div>
                        ) : null}
                        {shouldShowReviewNotice ? (
                          <CAlert color='warning' className='mb-0 mt-3'>
                            <div className='fw-semibold mb-1'>Lý do cần bổ sung hồ sơ</div>
                            <div dangerouslySetInnerHTML={{ __html: safeReviewNoteHtml }} />
                          </CAlert>
                        ) : null}
                      </div>
                    </CCollapse>
                  </div>
                ) : null}

                {showConversationPanel ? (
                  <div className='admission-v1-section mb-4'>
                    <div className='admission-v1-section__title'>Trao đổi với nhà trường</div>
                    <AdmissionV1ConversationPanel
                      application={session?.application}
                      token={readAdmissionV1Token(campaignCode, resolvedTenantCode)}
                      tenantCode={resolvedTenantCode}
                      expanded={conversationExpanded}
                      onToggle={handleToggleConversation}
                      onMessagesChange={setConversationHasMessages}
                      onApplicationChange={(application) => {
                        if (!application) return
                        setSession((current) => ({
                          ...current,
                          application,
                        }))
                      }}
                    />
                  </div>
                ) : null}

                <div className='admission-v1-section__title mb-3'>Thông tin hồ sơ</div>

                {templateFields.length === 0 ? (
                  <CAlert color='warning'>FormTemplate chưa có schema.fields hoặc schema.sections để render.</CAlert>
                ) : (
                  <CForm>
                    <FormRenderer
                      schema={session?.campaign?.formTemplate?.schema}
                      formData={formData}
                      formErrors={formErrors}
                      fieldOverrides={fieldOverrides}
                      submitting={submitting}
                      isReadOnly={isReadOnly}
                      onValueChange={updateFormValue}
                      onFileChange={handleFileChange}
                      onTableCellChange={handleTableCellChange}
                    />

                    <div className='admission-v1-actions mt-4'>
                      <CButton color='light' onClick={() => navigate(buildAdmissionV1Path(campaignCode, 'theo-doi', resolvedTenantCode))}>
                        Quay lại theo dõi
                      </CButton>
                      {!isReadOnly ? (
                        <CButton color='secondary' disabled={submitting} onClick={() => submitForm('draft')}>
                          Lưu nháp
                        </CButton>
                      ) : null}
                      <CButton color='success' disabled={submitting} onClick={() => (isReadOnly ? submitForm('submitted') : handleRequestSubmit())}>
                        {isReadOnly ? 'Xem trạng thái hồ sơ' : 'Nộp hồ sơ'}
                      </CButton>
                    </div>
                  </CForm>
                )}
              </>
            )}
          </CCardBody>
        </CCard>
      </CContainer>

      <AdmissionV1GuideModal
        visible={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        campaign={session?.campaign || null}
        fallbackContent='Mở lại hướng dẫn kỳ tuyển sinh để đối chiếu yêu cầu hồ sơ trước khi lưu hoặc nộp.'
      />

      <CModal visible={showSubmitConfirmModal} onClose={() => setShowSubmitConfirmModal(false)} alignment='center'>
        <CModalHeader>
          <CModalTitle>Xác nhận nộp hồ sơ</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Bạn có chắc chắn muốn nộp hồ sơ này không? Sau khi nộp, hồ sơ sẽ được chuyển sang bước theo dõi để chờ nhà trường xử lý.
        </CModalBody>
        <CModalFooter>
          <CButton color='light' onClick={() => setShowSubmitConfirmModal(false)} disabled={submitting}>
            Hủy
          </CButton>
          <CButton color='success' onClick={handleConfirmSubmit} disabled={submitting}>
            {submitting ? 'Đang nộp...' : 'Xác nhận nộp'}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}