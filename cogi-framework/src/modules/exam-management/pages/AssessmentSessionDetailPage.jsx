import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTabContent,
  CTabPane,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import SessionExamFormModal from '../components/SessionExamFormModal'
import ApplySessionExamFormsModal from '../components/ApplySessionExamFormsModal'
import AssessmentSessionCandidateImportModal from '../components/AssessmentSessionCandidateImportModal'
import { getAssessments, getAssessmentVersions } from '../../assessments/services/assessmentService'
import {
  addSessionCandidateManual,
  checkSessionExamForms,
  confirmApplySessionExamForms,
  createSessionExamForm,
  deleteSessionExamForm,
  finalizeSessionExamForms,
  getAssessmentSession,
  listAssessmentSessions,
  listSessionCandidates,
  listSessionExamForms,
  lookupSessionCandidateLearner,
  previewApplySessionExamForms,
  removeSessionCandidate,
} from '../services/examSessionApi'

function normalizeRows(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.results)) return result.results
  return []
}

function unwrapRelationData(value) {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value[0] || null
  if (value.data && typeof value.data === 'object') return value.data
  return value
}

function getEntityId(value) {
  const normalized = unwrapRelationData(value)
  if (!normalized) return ''
  if (typeof normalized === 'string' || typeof normalized === 'number') return String(normalized)
  if (typeof normalized === 'object') return String(normalized.documentId || normalized.id || '')
  return String(normalized)
}

function getEntityDocumentId(value) {
  const normalized = unwrapRelationData(value)
  if (!normalized || typeof normalized !== 'object') return ''
  return String(normalized.documentId || '').trim()
}

function formatRelationLabel(value, fallback = '—') {
  const normalized = unwrapRelationData(value)
  if (!normalized) return fallback
  if (typeof normalized === 'string' || typeof normalized === 'number') return String(normalized)
  if (typeof normalized === 'object') {
    const direct = normalized.name || normalized.title || normalized.code || normalized.label || normalized.slug || normalized.documentId || normalized.id
    return direct ? String(direct) : fallback
  }
  return fallback
}

function formatStatusLabel(value) {
  const status = String(value || '').toLowerCase()
  const map = {
    draft: 'Nháp',
    ready: 'Sẵn sàng',
    active: 'Đang diễn ra',
    ended: 'Đã kết thúc',
    finalized: 'Đã hoàn tất',
  }
  return map[status] || status || '—'
}

export default function AssessmentSessionDetailPage() {
  const { id, documentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const sessionId = id || documentId
  const [row, setRow] = useState(null)
  const [examForms, setExamForms] = useState([])
  const [assessments, setAssessments] = useState([])
  const [versions, setVersions] = useState([])
  const [validationReport, setValidationReport] = useState(null)
  const [showExamFormModal, setShowExamFormModal] = useState(false)
  const [showCandidateImportModal, setShowCandidateImportModal] = useState(false)
  const [showCandidateManualModal, setShowCandidateManualModal] = useState(false)
  const [showApplyFormsModal, setShowApplyFormsModal] = useState(false)
  const [candidateRows, setCandidateRows] = useState([])
  const [candidatePagination, setCandidatePagination] = useState({ page: 1, pageSize: 20, total: 0, pageCount: 1 })
  const [candidateFilter, setCandidateFilter] = useState('')
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [savingCandidate, setSavingCandidate] = useState(false)
  const [lookupCandidateLoading, setLookupCandidateLoading] = useState(false)
  const [manualCandidateForm, setManualCandidateForm] = useState({ studentCode: '' })
  const [manualCandidateLookup, setManualCandidateLookup] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingForms, setLoadingForms] = useState(false)
  const [checkingForms, setCheckingForms] = useState(false)
  const [finalizingForms, setFinalizingForms] = useState(false)
  const [savingForm, setSavingForm] = useState(false)
  const [applyTargetSessions, setApplyTargetSessions] = useState([])
  const [loadingApplyTargets, setLoadingApplyTargets] = useState(false)
  const [previewingApplyForms, setPreviewingApplyForms] = useState(false)
  const [confirmingApplyForms, setConfirmingApplyForms] = useState(false)
  const [applyFormsPreview, setApplyFormsPreview] = useState(null)
  const [applyFormsConfirmResult, setApplyFormsConfirmResult] = useState(null)
  const [applyFormsModalKey, setApplyFormsModalKey] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')

  async function loadSession() {
    setLoading(true)
    setError('')
    try {
      const result = await getAssessmentSession(sessionId)
      setRow(result)
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không tải được phiên thi')
    } finally {
      setLoading(false)
    }
  }

  async function loadForms() {
    if (!sessionId) return
    setLoadingForms(true)
    try {
      const result = await listSessionExamForms(sessionId)
      setExamForms(normalizeRows(result))
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không tải được bộ đề thi')
    } finally {
      setLoadingForms(false)
    }
  }

  async function loadCandidates({ page = candidatePagination.page || 1, pageSize = candidatePagination.pageSize || 20, keyword = candidateFilter } = {}) {
    if (!sessionId) return
    setLoadingCandidates(true)
    try {
      const result = await listSessionCandidates(sessionId, {
        page,
        pageSize,
        ...(String(keyword || '').trim() ? { q: String(keyword || '').trim() } : {}),
      })
      setCandidateRows(normalizeRows(result))
      const pagination = result?.meta?.pagination || {}
      setCandidatePagination({
        page: Number(pagination.page || page || 1),
        pageSize: Number(pagination.pageSize || pageSize || 20),
        total: Number(pagination.total || 0),
        pageCount: Number(pagination.pageCount || 1),
      })
    } catch (err) {
      setCandidateRows([])
      setCandidatePagination({ page: 1, pageSize: 20, total: 0, pageCount: 1 })
      setError(err?.response?.data?.error?.message || 'Không tải được danh sách thí sinh')
    } finally {
      setLoadingCandidates(false)
    }
  }

  useEffect(() => {
    if (sessionId) {
      loadSession()
      loadForms()
      loadCandidates({ page: 1, pageSize: 20, keyword: '' })
    }
  }, [sessionId])

  useEffect(() => {
    async function loadAssessmentOptions() {
      if (!row?.subject) {
        setAssessments([])
        return
      }
      try {
        const subjectRef = getEntityId(row.subject)
        const result = await getAssessments({ page: 1, pageSize: 200, subject: subjectRef })
        const normalized = normalizeRows(result)
        const matched = normalized.filter((item) => {
          const subject = item?.subject || item?.subjectRef || null
          const subjectId = getEntityId(subject)
          const subjectDocumentId = subject?.documentId || subject?.id || ''
          return !subjectRef || subjectId === subjectRef || subjectDocumentId === subjectRef || String(subject?.id || '') === String(row.subject?.id || '') || String(subject?.documentId || '') === String(row.subject?.documentId || '')
        })
        setAssessments(matched)
      } catch {
        setAssessments([])
      }
    }
    loadAssessmentOptions()
  }, [row?.subject])

  const sessionFormCount = examForms.length

  const totalQuestions = useMemo(() => {
    return examForms.reduce((sum, item) => sum + Number(item?.questionCount || item?.assessmentVersion?.questionCount || 0), 0)
  }, [examForms])

  const totalPoints = useMemo(() => {
    return examForms.reduce((sum, item) => sum + Number(item?.totalPoints || item?.assessmentVersion?.totalPoints || 0), 0)
  }, [examForms])

  const usedVersionDocumentIds = useMemo(() => {
    return examForms
      .map((item) => getEntityDocumentId(item?.assessmentVersion))
      .filter(Boolean)
  }, [examForms])

  async function handleOpenExamFormModal() {
    if (!row?.subject) {
      setVersions([])
      setError('Phiên thi chưa có môn học để lọc đề.')
      return
    }
    try {
      const subjectRef = getEntityId(row.subject)
      const [assessmentResult, versionResult] = await Promise.all([
        getAssessments({ page: 1, pageSize: 200, subject: subjectRef }),
        getAssessmentVersions({ page: 1, pageSize: 200 }),
      ])
      const normalizedAssessments = normalizeRows(assessmentResult)
      const filteredAssessments = normalizedAssessments.filter((item) => {
        const subject = item?.subject || null
        const subjectId = getEntityId(subject)
        return !subjectRef || subjectId === subjectRef || String(subject?.id || '') === String(row.subject?.id || '') || String(subject?.documentId || '') === String(row.subject?.documentId || '')
      })
      setAssessments(filteredAssessments)
      setVersions(normalizeRows(versionResult))
      setError(filteredAssessments.length === 0 ? 'Không tìm thấy đề phù hợp với môn học của phiên. Kiểm tra quyền truy cập Assessment, tenant và subject đang khớp.' : '')
      setShowExamFormModal(true)
    } catch (err) {
      setAssessments([])
      setVersions([])
      const status = Number(err?.response?.status || 0)
      const message = status === 403
        ? 'Bạn không có quyền xem dữ liệu đề thi trong tenant hiện tại.'
        : err?.response?.data?.error?.message || err?.message || 'Không tải được danh sách đề thi.'
      setError(message)
      setShowExamFormModal(true)
    }
  }

  async function handleAddExamForm(payload) {
    if (!sessionId) return
    setSavingForm(true)
    setError('')
    try {
      await createSessionExamForm(sessionId, payload)
      setShowExamFormModal(false)
      await Promise.all([loadSession(), loadForms()])
      setValidationReport(null)
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không thêm được đề thi')
    } finally {
      setSavingForm(false)
    }
  }

  async function handleRemoveExamForm(formId) {
    if (!formId || !window.confirm('Gỡ đề khỏi Phiên thi?')) return
    setError('')
    try {
      await deleteSessionExamForm(formId)
      await Promise.all([loadSession(), loadForms()])
      setValidationReport(null)
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không gỡ đề thi được')
    }
  }

  async function handleCheckExamForms() {
    if (!sessionId) return
    setCheckingForms(true)
    setError('')
    try {
      const result = await checkSessionExamForms(sessionId)
      setValidationReport(result)
    } catch (err) {
      setValidationReport({ valid: false, errors: [err?.response?.data?.error?.message || 'Không kiểm tra được bộ đề'], warnings: [], forms: [] })
      setError(err?.response?.data?.error?.message || 'Không kiểm tra được bộ đề')
    } finally {
      setCheckingForms(false)
    }
  }

  async function handleFinalizeExamForms() {
    if (!sessionId) return
    setFinalizingForms(true)
    setError('')
    try {
      const draftVersionCodes = examForms
        .filter((item) => String(item?.assessmentVersion?.versionStatus || '').toLowerCase() === 'draft')
        .map((item) => item?.assessmentVersion?.code || item?.assessmentVersion?.title || item?.assessment?.code || 'Version')
      const draftWarning = draftVersionCodes.length > 0
        ? `\n\nLưu ý: Bộ đề đang có version ở trạng thái Bản nháp (${draftVersionCodes.join(', ')}). Snapshot sẽ chốt theo dữ liệu hiện tại tại thời điểm này.`
        : ''
      const confirmText = `Chốt bộ đề sẽ khóa snapshot và chuyển phiên sang ready. Tiếp tục?${draftWarning}`
      if (!window.confirm(confirmText)) return
      const result = await finalizeSessionExamForms(sessionId)
      if (result?.session) {
        setRow(result.session)
      }
      await Promise.all([loadSession(), loadForms()])
      setValidationReport(null)
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không chốt được bộ đề')
    } finally {
      setFinalizingForms(false)
    }
  }

  async function handleOpenApplyFormsModal() {
    if (!sessionId || !row?.campaign) {
      setError('Phiên thi chưa có đợt thi để lọc phiên đích.')
      return
    }
    setShowApplyFormsModal(true)
    setApplyFormsModalKey((current) => current + 1)
    setApplyFormsPreview(null)
    setApplyFormsConfirmResult(null)
    setLoadingApplyTargets(true)
    try {
      const campaignRef = getEntityId(row.campaign)
      const result = await listAssessmentSessions({ campaign: campaignRef, pageSize: 500 })
      const sessions = normalizeRows(result)
      setApplyTargetSessions(sessions)
    } catch (err) {
      setApplyTargetSessions([])
      setError(err?.response?.data?.error?.message || 'Không tải được danh sách phiên đích')
    } finally {
      setLoadingApplyTargets(false)
    }
  }

  async function handlePreviewApplyForms(targetSessionIds = []) {
    if (!sessionId) return
    setPreviewingApplyForms(true)
    setError('')
    setApplyFormsConfirmResult(null)
    try {
      const result = await previewApplySessionExamForms(sessionId, { targetSessionIds })
      setApplyFormsPreview(result || null)
    } catch (err) {
      setApplyFormsPreview(null)
      setError(err?.response?.data?.error?.message || 'Không preview được áp dụng bộ đề')
    } finally {
      setPreviewingApplyForms(false)
    }
  }

  async function handleConfirmApplyForms(payload = {}) {
    if (!sessionId) return
    setConfirmingApplyForms(true)
    setError('')
    try {
      const result = await confirmApplySessionExamForms(sessionId, payload)
      setApplyFormsConfirmResult(result || null)
      await loadForms()
    } catch (err) {
      setApplyFormsConfirmResult(null)
      setError(err?.response?.data?.error?.message || 'Không thể áp dụng bộ đề')
    } finally {
      setConfirmingApplyForms(false)
    }
  }

  async function handleCandidateImported() {
    setShowCandidateImportModal(false)
    await loadCandidates({ page: 1 })
  }

  async function handleAddCandidateManual() {
    if (!sessionId || savingCandidate) return
    if (!manualCandidateLookup?.learner?.code) {
      setError('Vui lòng tra cứu Learner trước khi ghi danh.')
      return
    }
    if (manualCandidateLookup?.alreadyEnrolled) {
      setError('Learner đã được ghi danh trong phiên thi.')
      return
    }
    setSavingCandidate(true)
    setError('')
    try {
      await addSessionCandidateManual(sessionId, {
        studentCode: manualCandidateLookup.learner.code,
      })
      setShowCandidateManualModal(false)
      setManualCandidateForm({ studentCode: '' })
      setManualCandidateLookup(null)
      await loadCandidates({ page: 1 })
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không thể thêm thí sinh')
    } finally {
      setSavingCandidate(false)
    }
  }

  async function handleLookupManualCandidate() {
    if (!sessionId || lookupCandidateLoading) return
    const studentCode = String(manualCandidateForm.studentCode || '').trim()
    if (!studentCode) {
      setError('Vui lòng nhập mã sinh viên để tra cứu Learner.')
      return
    }
    setLookupCandidateLoading(true)
    setError('')
    try {
      const result = await lookupSessionCandidateLearner(sessionId, studentCode)
      setManualCandidateLookup(result || null)
    } catch (err) {
      setManualCandidateLookup(null)
      setError(err?.response?.data?.error?.message || 'Không tra cứu được Learner')
    } finally {
      setLookupCandidateLoading(false)
    }
  }

  async function handleRemoveCandidate(candidateId) {
    if (!sessionId || !candidateId) return
    if (!window.confirm('Gỡ thí sinh khỏi phiên thi?')) return
    setError('')
    try {
      await removeSessionCandidate(sessionId, candidateId)
      await loadCandidates({ page: candidatePagination.page })
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không thể gỡ thí sinh')
    }
  }

  const returnTo = location.state?.returnTo || '/exam-campaigns'
  const returnTab = location.state?.returnTab || 'overview'

  if (loading) return <div>Đang tải...</div>
  if (!row) return <CAlert color='info'>Không tìm thấy phiên thi</CAlert>

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
            <span>Chi tiết phiên thi: {row.code}</span>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={() => navigate(returnTo, { state: { activeTab: returnTab } })}>Quay lại đợt thi</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            {error ? <CAlert color='danger'>{error}</CAlert> : null}

            <div className='d-flex align-items-center gap-2 mb-3 flex-wrap'>
              <h4 className='mb-0'>{row.name}</h4>
              <CBadge color={row.status === 'ready' ? 'success' : row.status === 'draft' ? 'secondary' : 'warning'}>{formatStatusLabel(row.status)}</CBadge>
            </div>

            <CNav variant='tabs' className='mb-3'>
              {[
                { key: 'overview', label: 'Tổng quan' },
                { key: 'exam-forms', label: 'Bộ đề thi' },
                { key: 'students', label: 'Thí sinh' },
                { key: 'monitoring', label: 'Theo dõi thi' },
                { key: 'results', label: 'Kết quả' },
                { key: 'logs', label: 'Nhật ký' },
              ].map((tab) => (
                <CNavItem key={tab.key}>
                  <CNavLink active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
                    {tab.label}
                  </CNavLink>
                </CNavItem>
              ))}
            </CNav>

            <CTabContent>
              <CTabPane visible={activeTab === 'overview'}>
                <CRow className='g-3'>
                  <CCol md={6}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Mã phiên</div>
                      <div className='fw-semibold'>{row.code || '—'}</div>
                    </div>
                  </CCol>
                  <CCol md={6}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Tên phiên</div>
                      <div className='fw-semibold'>{row.name || '—'}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Đợt thi</div>
                      <div>{formatRelationLabel(row.campaign)}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Ca thi</div>
                      <div>{formatRelationLabel(row.slot)}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Môn thi</div>
                      <div>{formatRelationLabel(row.subject)}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Thời gian</div>
                      <div>{row.startAt ? new Date(row.startAt).toLocaleString('vi-VN') : '—'} → {row.endAt ? new Date(row.endAt).toLocaleString('vi-VN') : '—'}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Thời lượng</div>
                      <div>{row.durationMinutes || 0} phút</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Trạng thái</div>
                      <div>{formatStatusLabel(row.status)}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Địa điểm</div>
                      <div>{row.examLocation || 'Chưa phân công'}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Phòng</div>
                      <div>{row.roomName || row.roomCode || 'Chưa phân công'}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Sức chứa</div>
                      <div>{row.roomCapacity ? `${row.roomCapacity} thí sinh` : '—'}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Số đề trong bộ đề</div>
                      <div>{sessionFormCount}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Tổng câu hỏi</div>
                      <div>{totalQuestions}</div>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <div className='border rounded p-3 h-100'>
                      <div className='text-body-secondary small'>Tổng điểm</div>
                      <div>{totalPoints}</div>
                    </div>
                  </CCol>
                </CRow>
              </CTabPane>

              <CTabPane visible={activeTab === 'exam-forms'}>
                <div className='d-flex gap-2 flex-wrap mb-3'>
                  <CButton color='primary' onClick={handleOpenExamFormModal} disabled={!row?.subject || loadingForms}>Thêm đề thi</CButton>
                  <CButton color='info' variant='outline' onClick={handleOpenApplyFormsModal} disabled={loadingForms || examForms.length === 0}>Áp dụng cho phiên khác</CButton>
                  <CButton color='secondary' variant='outline' onClick={handleCheckExamForms} disabled={checkingForms || loadingForms}>Kiểm tra bộ đề</CButton>
                  <CButton color='success' onClick={handleFinalizeExamForms} disabled={row?.status !== 'draft' || checkingForms || finalizingForms || examForms.length === 0}>Chốt bộ đề</CButton>
                </div>

                {validationReport ? (
                  <div className='mb-3'>
                    {validationReport.errors?.length ? (
                      <CAlert color='danger'>
                        <div className='fw-semibold mb-2'>Lỗi bắt buộc</div>
                        <ul className='mb-0'>
                          {validationReport.errors.map((msg, index) => <li key={`${msg}-${index}`}>{msg}</li>)}
                        </ul>
                      </CAlert>
                    ) : null}
                    {validationReport.warnings?.length ? (
                      <CAlert color='warning'>
                        <div className='fw-semibold mb-2'>Cảnh báo</div>
                        <ul className='mb-0'>
                          {validationReport.warnings.map((msg, index) => <li key={`${msg}-${index}`}>{msg}</li>)}
                        </ul>
                      </CAlert>
                    ) : null}
                    {!validationReport.errors?.length && !validationReport.warnings?.length ? (
                      <CAlert color='success'>Bộ đề hợp lệ.</CAlert>
                    ) : null}
                  </div>
                ) : null}

                {loadingForms ? <div>Đang tải bộ đề...</div> : null}

                {!loadingForms && examForms.length === 0 ? (
                  <CAlert color='info'>Phiên này chưa có đề thi nào trong bộ đề.</CAlert>
                ) : null}

                {!loadingForms && examForms.length > 0 ? (
                  <CTable responsive hover>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Mã đề</CTableHeaderCell>
                        <CTableHeaderCell>Tên đề</CTableHeaderCell>
                        <CTableHeaderCell>Version</CTableHeaderCell>
                        <CTableHeaderCell>Số câu</CTableHeaderCell>
                        <CTableHeaderCell>Tổng điểm</CTableHeaderCell>
                        <CTableHeaderCell>Thời lượng</CTableHeaderCell>
                        <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                        <CTableHeaderCell>Thao tác</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {examForms.map((item) => {
                        const version = item.assessmentVersion || {}
                        const assessment = item.assessment || {}
                        const formStatus = item.status || 'draft'
                        return (
                          <CTableRow key={item.id || item.documentId}>
                            <CTableDataCell>{version.code || assessment.code || '—'}</CTableDataCell>
                            <CTableDataCell>{version.title || assessment.name || '—'}</CTableDataCell>
                            <CTableDataCell>{version.title || version.code || '—'}</CTableDataCell>
                            <CTableDataCell>{version.questionCount || version.questionsCount || 0}</CTableDataCell>
                            <CTableDataCell>{version.totalPoints || version.points || 0}</CTableDataCell>
                            <CTableDataCell>{version.durationMinutes || 0} phút</CTableDataCell>
                            <CTableDataCell><CBadge color={formStatus === 'locked' ? 'success' : 'secondary'}>{formStatus === 'locked' ? 'Đã chốt' : 'Nháp'}</CBadge></CTableDataCell>
                            <CTableDataCell>
                              {row.status === 'draft' ? (
                                <CButton size='sm' color='danger' variant='outline' onClick={() => handleRemoveExamForm(item.id || item.documentId)}>Gỡ</CButton>
                              ) : (
                                <span className='text-body-secondary'>Khóa</span>
                              )}
                            </CTableDataCell>
                          </CTableRow>
                        )
                      })}
                    </CTableBody>
                  </CTable>
                ) : null}
              </CTabPane>

              <CTabPane visible={activeTab === 'students'}>
                <div className='d-flex gap-2 flex-wrap mb-3'>
                  <CButton color='primary' onClick={() => setShowCandidateImportModal(true)} disabled={row?.status !== 'draft' && row?.status !== 'ready'}>Import từ Excel</CButton>
                  <CButton color='secondary' variant='outline' onClick={() => {
                    setManualCandidateForm({ studentCode: '' })
                    setManualCandidateLookup(null)
                    setShowCandidateManualModal(true)
                  }} disabled={row?.status !== 'draft' && row?.status !== 'ready'}>Thêm thủ công</CButton>
                </div>

                <CCard className='mb-3'>
                  <CCardBody>
                    <CRow className='g-3 align-items-end'>
                      <CCol md={4}>
                        <CFormLabel>Tìm kiếm</CFormLabel>
                        <CFormInput
                          value={candidateFilter}
                          onChange={(event) => setCandidateFilter(event.target.value)}
                          placeholder='Mã học viên, họ tên...'
                        />
                      </CCol>
                      <CCol md={2}>
                        <CFormLabel>Trang</CFormLabel>
                        <CFormSelect
                          value={candidatePagination.pageSize}
                          onChange={(event) => loadCandidates({ page: 1, pageSize: Number(event.target.value || 20) })}
                        >
                          {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                        </CFormSelect>
                      </CCol>
                      <CCol md={6}>
                        <div className='d-flex gap-2 flex-wrap'>
                          <CButton color='primary' onClick={() => loadCandidates({ page: 1 })}>Tìm</CButton>
                          <CButton color='secondary' variant='outline' onClick={() => {
                            setCandidateFilter('')
                            loadCandidates({ page: 1, keyword: '' })
                          }}>Xóa lọc</CButton>
                        </div>
                      </CCol>
                    </CRow>
                  </CCardBody>
                </CCard>

                {loadingCandidates ? <div>Đang tải thí sinh...</div> : null}

                {!loadingCandidates && candidateRows.length === 0 ? (
                  <CAlert color='info'>Phiên thi chưa có thí sinh.</CAlert>
                ) : null}

                {!loadingCandidates && candidateRows.length > 0 ? (
                  <>
                    <CTable responsive hover>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>STT</CTableHeaderCell>
                          <CTableHeaderCell>Mã phiên</CTableHeaderCell>
                          <CTableHeaderCell>Mã học viên</CTableHeaderCell>
                          <CTableHeaderCell>Họ tên</CTableHeaderCell>
                          <CTableHeaderCell>Ngày sinh</CTableHeaderCell>
                          <CTableHeaderCell>Trạng thái ghi danh</CTableHeaderCell>
                          <CTableHeaderCell>Nguồn</CTableHeaderCell>
                          <CTableHeaderCell>Thời điểm thêm</CTableHeaderCell>
                          <CTableHeaderCell>Thao tác</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {candidateRows.map((candidate, index) => (
                          <CTableRow key={candidate.id || candidate.documentId}>
                            <CTableDataCell>{(candidatePagination.page - 1) * candidatePagination.pageSize + index + 1}</CTableDataCell>
                            <CTableDataCell>{candidate.sessionCode || row?.code || '—'}</CTableDataCell>
                            <CTableDataCell>{candidate.studentCode || '—'}</CTableDataCell>
                            <CTableDataCell>{candidate.fullName || '—'}</CTableDataCell>
                            <CTableDataCell>{candidate.dateOfBirth || '—'}</CTableDataCell>
                            <CTableDataCell>{candidate.enrollmentStatus === 'enrolled' ? 'Đã ghi danh' : (candidate.enrollmentStatus || '—')}</CTableDataCell>
                            <CTableDataCell>{candidate.source === 'excel_import' ? 'Excel' : 'Thủ công'}</CTableDataCell>
                            <CTableDataCell>{candidate.enrolledAt ? new Date(candidate.enrolledAt).toLocaleString('vi-VN') : '—'}</CTableDataCell>
                            <CTableDataCell>
                              {(row?.status === 'draft' || row?.status === 'ready')
                                ? <CButton size='sm' color='danger' variant='outline' onClick={() => handleRemoveCandidate(candidate.id || candidate.documentId)}>Gỡ</CButton>
                                : <span className='text-body-secondary'>Khóa</span>}
                            </CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>

                    <div className='d-flex align-items-center justify-content-between flex-wrap gap-2'>
                      <div className='small text-body-secondary'>Tổng: {candidatePagination.total || 0}</div>
                      <div className='d-flex gap-2'>
                        <CButton
                          size='sm'
                          color='secondary'
                          variant='outline'
                          disabled={candidatePagination.page <= 1}
                          onClick={() => loadCandidates({ page: candidatePagination.page - 1 })}
                        >
                          Trước
                        </CButton>
                        <span className='align-self-center small'>Trang {candidatePagination.page}/{candidatePagination.pageCount}</span>
                        <CButton
                          size='sm'
                          color='secondary'
                          variant='outline'
                          disabled={candidatePagination.page >= candidatePagination.pageCount}
                          onClick={() => loadCandidates({ page: candidatePagination.page + 1 })}
                        >
                          Sau
                        </CButton>
                      </div>
                    </div>
                  </>
                ) : null}
              </CTabPane>

              <CTabPane visible={activeTab === 'monitoring'}>
                <CAlert color='secondary'>Theo dõi thi sẽ được triển khai ở bước sau.</CAlert>
              </CTabPane>

              <CTabPane visible={activeTab === 'results'}>
                <CAlert color='secondary'>Kết quả sẽ được triển khai ở bước sau.</CAlert>
              </CTabPane>

              <CTabPane visible={activeTab === 'logs'}>
                <CAlert color='secondary'>Nhật ký vận hành sẽ được triển khai ở bước sau.</CAlert>
              </CTabPane>
            </CTabContent>
          </CCardBody>
        </CCard>
      </CCol>

      <SessionExamFormModal
        visible={showExamFormModal}
        session={row}
        assessments={assessments}
        versions={versions}
        usedVersionDocumentIds={usedVersionDocumentIds}
        saving={savingForm}
        onClose={() => setShowExamFormModal(false)}
        onSubmit={handleAddExamForm}
      />

      <ApplySessionExamFormsModal
        key={`apply-forms-${applyFormsModalKey}-${applyFormsPreview?.previewToken || 'none'}`}
        visible={showApplyFormsModal}
        sourceSession={row}
        sourceForms={applyFormsPreview?.source?.forms || examForms.map((item) => ({
          id: item.id || item.documentId,
          assessmentVersionId: item?.assessmentVersion?.id,
          code: item?.assessmentVersion?.code || item?.assessment?.code || '',
          title: item?.assessmentVersion?.title || item?.assessment?.name || '',
          questionCount: item?.assessmentVersion?.questionCount || item?.assessmentVersion?.questionsCount || 0,
          totalPoints: item?.assessmentVersion?.totalPoints || item?.assessmentVersion?.points || 0,
        }))}
        targetSessions={applyTargetSessions}
        previewData={applyFormsPreview}
        confirmData={applyFormsConfirmResult}
        loadingTargets={loadingApplyTargets}
        previewing={previewingApplyForms}
        confirming={confirmingApplyForms}
        onClose={() => {
          if (previewingApplyForms || confirmingApplyForms) return
          setShowApplyFormsModal(false)
        }}
        onPreview={handlePreviewApplyForms}
        onConfirm={handleConfirmApplyForms}
      />

      <AssessmentSessionCandidateImportModal
        visible={showCandidateImportModal}
        sessionId={sessionId}
        onClose={() => setShowCandidateImportModal(false)}
        onImported={handleCandidateImported}
      />

      <CModal visible={showCandidateManualModal} onClose={() => !savingCandidate && setShowCandidateManualModal(false)}>
        <CModalHeader>
          <CModalTitle>Thêm thí sinh thủ công</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='d-flex flex-column gap-3'>
            <div>
              <CFormLabel>Mã học viên</CFormLabel>
              <CFormInput
                value={manualCandidateForm.studentCode}
                onChange={(event) => {
                  setManualCandidateForm((current) => ({ ...current, studentCode: event.target.value }))
                  setManualCandidateLookup(null)
                }}
                placeholder='VD: HCCT0001'
              />
            </div>
            <div className='d-flex gap-2'>
              <CButton color='info' variant='outline' onClick={handleLookupManualCandidate} disabled={lookupCandidateLoading || savingCandidate}>
                {lookupCandidateLoading ? 'Đang tra cứu...' : 'Tra cứu Learner'}
              </CButton>
            </div>
            {manualCandidateLookup?.learner ? (
              <div className='border rounded p-3'>
                <div><strong>Learner:</strong> {manualCandidateLookup.learner.code} - {manualCandidateLookup.learner.fullName || '—'}</div>
                <div><strong>Ngày sinh:</strong> {manualCandidateLookup.learner.dateOfBirth || '—'}</div>
                <div><strong>Trạng thái hồ sơ:</strong> {manualCandidateLookup.learner.learnerStatus || '—'}</div>
                {manualCandidateLookup.alreadyEnrolled ? (
                  <CAlert color='warning' className='mt-2 mb-0'>Learner đã được ghi danh trong phiên thi này.</CAlert>
                ) : (
                  <CAlert color='success' className='mt-2 mb-0'>Learner hợp lệ. Bạn có thể xác nhận ghi danh.</CAlert>
                )}
              </div>
            ) : null}
            <div className='small text-body-secondary'>
              Tab Thí sinh chỉ ghi danh Learner đã tồn tại. Nếu chưa có Learner, vui lòng tạo trong Learner Management.
            </div>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowCandidateManualModal(false)} disabled={savingCandidate}>Đóng</CButton>
          <CButton color='primary' onClick={handleAddCandidateManual} disabled={savingCandidate || !manualCandidateLookup?.learner || manualCandidateLookup?.alreadyEnrolled}>
            {savingCandidate ? 'Đang lưu...' : 'Thêm thí sinh'}
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}
