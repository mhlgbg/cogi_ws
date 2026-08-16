import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CBreadcrumb,
  CBreadcrumbItem,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
} from '@coreui/react'
import { useAuth } from '../../../contexts/AuthContext'
import { useFeature } from '../../../contexts/FeatureContext'
import ExamErrorAlert from '../components/ExamErrorAlert'
import ExamRoundAllocationTab from '../components/ExamRoundAllocationTab'
import ExamRoundCandidateListsTab from '../components/ExamRoundCandidateListsTab'
import ExamRoundConfigurationTab from '../components/ExamRoundConfigurationTab'
import ExamRoundEligibilitiesTab from '../components/ExamRoundEligibilitiesTab'
import ExamRoundOverviewTab from '../components/ExamRoundOverviewTab'
import ExamRoundPaymentsTab from '../components/ExamRoundPaymentsTab'
import ExamRoundPlaceholderTab from '../components/ExamRoundPlaceholderTab'
import ExamRoundRegistrationsTab from '../components/ExamRoundRegistrationsTab'
import ExamRoundReviewsTab from '../components/ExamRoundReviewsTab'
import ExamRoundSchedulesTab from '../components/ExamRoundSchedulesTab'
import ExamRoundStatusBadge from '../components/ExamRoundStatusBadge'
import ExamRoundStructureTab from '../components/ExamRoundStructureTab'
import ExamRoundVenueRoomsTab from '../components/ExamRoundVenueRoomsTab'
import ExamRoundWorkflowActions from '../components/ExamRoundWorkflowActions'
import {
  approveExamRound,
  closeExamRoundRegistration,
  getExamRound,
  openExamRoundRegistration,
  pauseExamRoundRegistration,
  resumeExamRoundRegistration,
  returnExamRoundToDraft,
  submitExamRoundForApproval,
  updateExamRoundStructure,
} from '../services/examRoundApi'
import {
  buildExamRoundPath,
  buildExamRoundsPath,
  EXAM_ROUND_TABS,
  canEditExamRound,
  formatDateTime,
  getApiMessage,
  getExamErrorCode,
  getExamErrorDetails,
  resolveExamRoundTab,
} from '../utils/examRoundUi'

function SpinnerCenter() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <CSpinner />
    </div>
  )
}

function mergeWorkflowResultIntoRound(currentRound, actionKey, result) {
  if (!currentRound || !result || typeof result !== 'object') return currentRound

  const nextRound = { ...currentRound }

  if (result.status) nextRound.status = result.status

  if (actionKey === 'submit') {
    nextRound.submittedAt = result.submittedAt || nextRound.submittedAt
    nextRound.submittedBy = result.submittedBy || nextRound.submittedBy
  }

  if (actionKey === 'approve') {
    nextRound.approvedAt = result.approvedAt || nextRound.approvedAt
    nextRound.approvedBy = result.approvedBy || nextRound.approvedBy
  }

  if (actionKey === 'return') {
    nextRound.returnedAt = result.returnedAt || nextRound.returnedAt
    nextRound.returnReason = result.returnReason || nextRound.returnReason
  }

  if (actionKey === 'open') {
    nextRound.registrationOpenedAt = result.registrationOpenedAt || nextRound.registrationOpenedAt
    nextRound.registrationOpenedBy = result.registrationOpenedBy || nextRound.registrationOpenedBy
  }

  if (actionKey === 'pause') {
    nextRound.registrationPausedAt = result.registrationPausedAt || nextRound.registrationPausedAt
    nextRound.registrationPauseReason = result.registrationPauseReason || nextRound.registrationPauseReason
  }

  if (actionKey === 'resume') {
    nextRound.registrationResumedAt = result.registrationResumedAt || nextRound.registrationResumedAt
  }

  if (actionKey === 'close') {
    nextRound.registrationClosedAt = result.registrationClosedAt || nextRound.registrationClosedAt
    nextRound.registrationCloseReason = result.registrationCloseReason || nextRound.registrationCloseReason
  }

  return nextRound
}

export default function ExamRoundDetailPage() {
  const { id, tenantCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
  const feature = useFeature()
  const canManage = feature?.hasFeature?.('exam-round.manage') || false
  const canApprove = feature?.hasFeature?.('exam-round.approve') || false
  const currentUserId = Number(auth?.user?.id || 0) || 0
  const activeTab = useMemo(() => resolveExamRoundTab(location.pathname), [location.pathname])

  const [loading, setLoading] = useState(true)
  const [submittingActionKey, setSubmittingActionKey] = useState('')
  const [round, setRound] = useState(null)
  const [success, setSuccess] = useState(location.state?.message || '')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [errorDetails, setErrorDetails] = useState([])
  const [savingTab, setSavingTab] = useState('')
  const [tabError, setTabError] = useState('')
  const [tabErrorCode, setTabErrorCode] = useState('')
  const [tabErrorDetails, setTabErrorDetails] = useState([])
  const loadRequestIdRef = useRef(0)

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1
    loadRequestIdRef.current = requestId
    setLoading(true)
    setError('')
    setErrorCode('')
    setErrorDetails([])
    try {
      const payload = await getExamRound(id)
      setRound((current) => (requestId === loadRequestIdRef.current ? (payload || null) : current))
    } catch (requestError) {
      setRound((current) => (requestId === loadRequestIdRef.current ? null : current))
      if (requestId === loadRequestIdRef.current) {
        setError(getApiMessage(requestError, 'Không tải được chi tiết đợt thi.'))
        setErrorCode(getExamErrorCode(requestError))
        setErrorDetails(getExamErrorDetails(requestError))
      }
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  function goTab(tab) {
    setTabError('')
    setTabErrorCode('')
    setTabErrorDetails([])
    navigate(buildExamRoundPath(id, tab, tenantCode))
  }

  async function handleStructureSave(payload, successMessage) {
    setSavingTab(activeTab)
    setTabError('')
    setTabErrorCode('')
    setTabErrorDetails([])
    try {
      await updateExamRoundStructure(id, payload)
      await loadData()
      setSuccess(successMessage || 'Đã cập nhật cấu hình đợt thi.')
      return true
    } catch (requestError) {
      setTabError(getApiMessage(requestError, 'Không thể lưu cấu hình/cấu trúc đợt thi.'))
      setTabErrorCode(getExamErrorCode(requestError))
      setTabErrorDetails(getExamErrorDetails(requestError))
      return false
    } finally {
      setSavingTab('')
    }
  }

  async function handleWorkflowAction(actionKey, payload = {}) {
    setSubmittingActionKey(actionKey)
    setError('')
    setErrorCode('')
    setErrorDetails([])
    try {
      let result = null
      if (actionKey === 'submit') result = await submitExamRoundForApproval(id, payload)
      if (actionKey === 'approve') result = await approveExamRound(id, payload)
      if (actionKey === 'return') result = await returnExamRoundToDraft(id, payload)
      if (actionKey === 'open') result = await openExamRoundRegistration(id, payload)
      if (actionKey === 'pause') result = await pauseExamRoundRegistration(id, payload)
      if (actionKey === 'resume') result = await resumeExamRoundRegistration(id, payload)
      if (actionKey === 'close') result = await closeExamRoundRegistration(id, payload)

      setRound((current) => mergeWorkflowResultIntoRound(current, actionKey, result))

      const warnings = Array.isArray(result?.warnings) ? result.warnings : []
      if (actionKey === 'submit') setSuccess(warnings.length > 0 ? `Đã gửi đợt thi để phê duyệt. ${warnings.map((item) => item.message).join(' ')}` : 'Đã gửi đợt thi để phê duyệt.')
      if (actionKey === 'approve') setSuccess('Đã phê duyệt đợt thi.')
      if (actionKey === 'return') setSuccess('Đã trả đợt thi về bản nháp.')
      if (actionKey === 'open') setSuccess(warnings.length > 0 ? `Đã mở đăng ký dự thi. ${warnings.map((item) => item.message).join(' ')}` : 'Đã mở đăng ký dự thi.')
      if (actionKey === 'pause') setSuccess('Đã tạm dừng đăng ký.')
      if (actionKey === 'resume') setSuccess('Đã tiếp tục nhận đăng ký.')
      if (actionKey === 'close') setSuccess('Đã đóng đăng ký dự thi.')
      if (!['submit', 'approve', 'return', 'open', 'pause', 'resume', 'close'].includes(actionKey)) {
        setSuccess(warnings.length > 0 ? `Thao tác thành công. ${warnings.map((item) => item.message).join(' ')}` : 'Thao tác thành công.')
      }
      await loadData()
      return true
    } catch (requestError) {
      const nextErrorCode = getExamErrorCode(requestError)
      setError(getApiMessage(requestError, 'Không thể thực hiện workflow đợt thi.'))
      setErrorCode(nextErrorCode)
      setErrorDetails(getExamErrorDetails(requestError))
      if (nextErrorCode && /CANNOT_|NOT_FOUND|SELF_APPROVAL/i.test(String(nextErrorCode))) {
        await loadData()
      }
      return false
    } finally {
      setSubmittingActionKey('')
    }
  }

  if (loading) return <SpinnerCenter />
  if (!round) {
    return (
      <CContainer fluid className='py-4'>
        <ExamErrorAlert message={error || 'Không tìm thấy đợt thi.'} code={errorCode} details={errorDetails} />
        <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamRoundsPath(tenantCode))}>Quay lại danh sách</CButton>
      </CContainer>
    )
  }

  const activeTabMeta = EXAM_ROUND_TABS.find((tab) => tab.key === activeTab) || EXAM_ROUND_TABS[0]

  return (
    <CContainer fluid className='py-4'>
      <CBreadcrumb className='mb-3'>
        <CBreadcrumbItem><button type='button' className='btn btn-link p-0 text-decoration-none' onClick={() => navigate(buildExamRoundsPath(tenantCode))}>Đợt thi</button></CBreadcrumbItem>
        <CBreadcrumbItem active>{round.code || 'Chi tiết đợt thi'}</CBreadcrumbItem>
      </CBreadcrumb>

      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
        <div className='flex-grow-1'>
          <div className='d-flex align-items-center gap-2 flex-wrap mb-2'>
            <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamRoundsPath(tenantCode))}>Quay lại</CButton>
            <div className='fs-4 fw-semibold'>{round.name || '-'}</div>
            <ExamRoundStatusBadge status={round.status} />
          </div>
          <div className='text-body-secondary mb-2'>{round.code || '-'}{round.examProgram?.name ? ` | ${round.examProgram.name}` : ''}</div>
          <div className='small text-body-secondary'>Năm học: {round.academicYear || '-'} | Học kỳ: {round.semester || '-'}</div>
        </div>

        <div className='d-flex flex-column align-items-stretch gap-2'>
          <ExamRoundWorkflowActions
            round={round}
            permissions={{ canManage, canApprove }}
            currentUserId={currentUserId}
            submittingActionKey={submittingActionKey}
            errorMessage={error}
            errorDetails={errorDetails}
            onAction={handleWorkflowAction}
            onOpenTab={goTab}
          />
        </div>
      </div>

      <CRow className='g-3 mb-4'>
        <CCol md={3} sm={6}>
          <CCard className='h-100'>
            <CCardBody>
              <div className='small text-body-secondary'>Chương trình</div>
              <div className='fw-semibold'>{round.examProgram?.name || '-'}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6}>
          <CCard className='h-100'>
            <CCardBody>
              <div className='small text-body-secondary'>Thời gian đăng ký</div>
              <div className='fw-semibold'>{formatDateTime(round.registrationStartAt)}</div>
              <div className='small text-body-secondary'>{formatDateTime(round.registrationEndAt)}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6}>
          <CCard className='h-100'>
            <CCardBody>
              <div className='small text-body-secondary'>Thời gian thi</div>
              <div className='fw-semibold'>{formatDateTime(round.examStartAt)}</div>
              <div className='small text-body-secondary'>{formatDateTime(round.examEndAt)}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6}>
          <CCard className='h-100'>
            <CCardBody>
              <div className='small text-body-secondary'>Cập nhật gần nhất</div>
              <div className='fw-semibold'>{formatDateTime(round.updatedAt)}</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <div className='alert alert-info mb-3'>Cấu trúc môn và kỹ năng trong đợt thi là snapshot riêng. Việc chỉnh sửa chương trình nguồn không tự động thay đổi đợt thi này.</div>

      {success ? <div className='mb-3'><div className='alert alert-success mb-0'>{success}</div></div> : null}
      {error && !errorDetails.length && !submittingActionKey ? <div className='mb-3'><div className='alert alert-danger mb-0'>{error}</div></div> : null}
      <ExamErrorAlert message={errorDetails.length ? error : ''} code={errorCode} details={errorDetails} />

      <CNav variant='tabs' className='mb-3 flex-wrap'>
        {EXAM_ROUND_TABS.map((tab) => (
          <CNavItem key={tab.key}>
            <CNavLink href='#' active={activeTab === tab.key} onClick={(event) => { event.preventDefault(); goTab(tab.key) }}>{tab.label}</CNavLink>
          </CNavItem>
        ))}
      </CNav>

      {activeTabMeta.key === 'overview' ? <ExamRoundOverviewTab round={round} onOpenStructure={() => goTab('structure')} /> : null}
      {activeTabMeta.key === 'configuration' ? (
        <ExamRoundConfigurationTab
          round={round}
          permissions={{ canManage, canApprove }}
          saving={savingTab === 'configuration'}
          errorMessage={tabErrorDetails.length ? tabError : ''}
          errorCode={tabErrorCode}
          errorDetails={tabErrorDetails}
          onSave={handleStructureSave}
        />
      ) : null}
      {activeTabMeta.key === 'structure' ? (
        <ExamRoundStructureTab
          round={round}
          permissions={{ canManage, canApprove }}
          saving={savingTab === 'structure'}
          errorMessage={tabErrorDetails.length ? tabError : ''}
          errorCode={tabErrorCode}
          errorDetails={tabErrorDetails}
          onSave={handleStructureSave}
        />
      ) : null}
      {activeTabMeta.key === 'eligibilities' ? (
        <ExamRoundEligibilitiesTab round={round} permissions={{ canManage, canApprove }} />
      ) : null}
      {activeTabMeta.key === 'registrations' ? (
        <ExamRoundRegistrationsTab round={round} />
      ) : null}
      {activeTabMeta.key === 'payments' ? (
        <ExamRoundPaymentsTab
          round={round}
          permissions={{ canManage, canApprove }}
          onRefresh={loadData}
          onOpenConfiguration={() => goTab('configuration')}
        />
      ) : null}
      {activeTabMeta.key === 'reviews' ? (
        <ExamRoundReviewsTab round={round} permissions={{ canManage, canApprove }} onRefresh={loadData} />
      ) : null}
      {activeTabMeta.key === 'venues-rooms' ? (
        <ExamRoundVenueRoomsTab round={round} permissions={{ canManage, canApprove }} onRefresh={loadData} />
      ) : null}
      {activeTabMeta.key === 'schedules' ? (
        <ExamRoundSchedulesTab round={round} permissions={{ canManage, canApprove }} onRefresh={loadData} />
      ) : null}
      {activeTabMeta.key === 'allocation' ? (
        <ExamRoundAllocationTab round={round} permissions={{ canManage, canApprove }} onRefresh={loadData} />
      ) : null}
      {activeTabMeta.key === 'candidate-lists' ? (
        <ExamRoundCandidateListsTab round={round} permissions={{ canManage, canApprove }} onRefresh={loadData} />
      ) : null}
      {!['overview', 'configuration', 'structure', 'eligibilities', 'registrations', 'payments', 'reviews', 'venues-rooms', 'schedules', 'allocation', 'candidate-lists'].includes(activeTabMeta.key) ? <ExamRoundPlaceholderTab title={activeTabMeta.label} /> : null}
    </CContainer>
  )
}