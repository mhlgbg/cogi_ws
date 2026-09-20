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
  CFormInput,
  CFormLabel,
  CFormSelect,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
} from '@coreui/react'
import SimplePagination from '../../../components/SimplePagination'
import StudentAssignmentDetailModal from '../components/StudentAssignmentDetailModal'
import StudentPortalContextCard from '../components/StudentPortalContextCard'
import { getStudentAssignments, getStudentClasses, startStudentAssignmentAssessmentAttempt, updateStudentAssignmentTodoProgress } from '../services/classService'
import { getClassSessionContentPreview } from '../utils/classSessionContentHtml'
import { formatSessionDate, formatSessionDateTime, formatSessionTime, formatTeacherDisplay } from '../utils/classSessionUi'
import useStudentPortalContext from '../utils/useStudentPortalContext'

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Cần hoàn thành' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'completed', label: 'Đã hoàn thành' },
  { value: 'overdue', label: 'Quá hạn' },
]

const TASK_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'assessment', label: 'Bài kiểm tra' },
  { value: 'submission', label: 'Nộp bài' },
  { value: 'todo', label: 'Todo/checklist' },
]

const STATUS_META = {
  pending: { label: 'Cần hoàn thành', color: 'warning' },
  in_progress: { label: 'Đang làm', color: 'info' },
  completed: { label: 'Đã hoàn thành', color: 'success' },
  overdue: { label: 'Quá hạn', color: 'danger' },
}

const TASK_TYPE_LABELS = {
  assessment: 'Bài kiểm tra',
  submission: 'Nộp bài',
  todo: 'Todo/checklist',
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function buildInitialFilters() {
  return {
    search: '',
    classId: '',
    taskType: '',
    dueFrom: '',
    dueTo: '',
  }
}

function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.pending
}

function getTaskTypeLabel(taskType) {
  return TASK_TYPE_LABELS[taskType] || taskType || 'Khác'
}

function getRelativeDueLabel(item, serverNow) {
  const dueAt = item?.dueAt
  if (!dueAt) return 'Không có hạn nộp'
  const dueMs = new Date(dueAt).getTime()
  const nowMs = new Date(serverNow || Date.now()).getTime()
  if (Number.isNaN(dueMs) || Number.isNaN(nowMs)) return `Hạn: ${formatSessionDateTime(dueAt)}`
  const deltaDays = Math.round((dueMs - nowMs) / (24 * 60 * 60 * 1000))
  if (item?.normalizedStatus === 'overdue') return `Quá hạn từ ${formatSessionDateTime(dueAt)}`
  if (deltaDays <= 1) return `Còn ${Math.max(0, deltaDays)} ngày`
  return `Còn ${deltaDays} ngày`
}

function getPrimaryAction(item) {
  if (item?.taskType === 'assessment') {
    if (item?.learnerTaskStatus === 'in_progress' && item?.attemptId) return { label: 'Tiếp tục', type: 'assessment' }
    if ((item?.learnerTaskStatus === 'completed' || item?.learnerTaskStatus === 'submitted') && item?.showScoreAfterSubmit !== false) return { label: 'Xem kết quả', type: 'assessment' }
    if (item?.learnerTaskStatus === 'completed' || item?.learnerTaskStatus === 'submitted') return { label: 'Xem bài đã nộp', type: 'assessment' }
    return { label: 'Làm bài', type: 'assessment' }
  }
  if (item?.taskType === 'submission') {
    return { label: item?.latestSubmissionId ? 'Xem/Nộp bài' : 'Nhập bài', type: 'detail' }
  }
  if (item?.taskType === 'todo') {
    if (item?.learnerTaskStatus === 'completed') return { label: 'Đã hoàn thành', type: 'detail', disabled: true }
    return { label: 'Đánh dấu hoàn thành', type: 'todo' }
  }
  return { label: 'Mở', type: 'detail' }
}

export default function StudentAssignmentsPage() {
  const navigate = useNavigate()
  const portal = useStudentPortalContext()
  const [classes, setClasses] = useState([])
  const [filters, setFilters] = useState(buildInitialFilters)
  const [draftFilters, setDraftFilters] = useState(buildInitialFilters)
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ countsByStatus: { pending: 0, in_progress: 0, completed: 0, overdue: 0 } })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, pageCount: 1, total: 0 })
  const [serverNow, setServerNow] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailAssignmentId, setDetailAssignmentId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionKey, setActionKey] = useState('')

  const hasLearners = Array.isArray(portal.context?.learners) && portal.context.learners.length > 0
  const selectedLearnerName = portal.context?.learnerContext?.fullName || 'Hồ sơ hiện tại'
  const tenantName = portal.context?.tenant?.name || 'tenant hiện tại'

  async function loadData(page = pagination.page, activeFilters = filters, activeStatus = status) {
    if (!portal.context || !portal.selectedLearnerId) {
      setRows([])
      setSummary({ countsByStatus: { pending: 0, in_progress: 0, completed: 0, overdue: 0 } })
      setPagination((prev) => ({ ...prev, page: 1, total: 0, pageCount: 1 }))
      return
    }

    setLoading(true)
    setError('')
    setActionError('')
    try {
      const [classResult, assignmentResult] = await Promise.all([
        getStudentClasses({ learnerId: portal.selectedLearnerId }),
        getStudentAssignments({
          learnerId: portal.selectedLearnerId,
          status: activeStatus,
          classId: activeFilters.classId,
          taskType: activeFilters.taskType,
          dueFrom: activeFilters.dueFrom,
          dueTo: activeFilters.dueTo,
          search: activeFilters.search,
          page,
          pageSize: pagination.pageSize,
        }),
      ])
      setClasses(Array.isArray(classResult?.rows) ? classResult.rows : [])
      setRows(Array.isArray(assignmentResult?.rows) ? assignmentResult.rows : [])
      setSummary(assignmentResult?.summary || { countsByStatus: { pending: 0, in_progress: 0, completed: 0, overdue: 0 } })
      setPagination(assignmentResult?.pagination || { page: 1, pageSize: 10, pageCount: 1, total: 0 })
      setServerNow(assignmentResult?.serverNow || null)
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không thể tải danh sách bài tập.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setFilters(buildInitialFilters())
    setDraftFilters(buildInitialFilters())
    setStatus('pending')
    setPagination({ page: 1, pageSize: 10, pageCount: 1, total: 0 })
  }, [portal.selectedLearnerId])

  useEffect(() => {
    loadData(1, filters, status)
  }, [portal.context, portal.selectedLearnerId, filters, status])

  const activeClassIds = useMemo(() => new Set(classes.filter((item) => item?.enrollmentContext?.isCurrent).map((item) => item.id)), [classes])
  const selectedLearnerHasClasses = classes.length > 0
  const selectedLearnerHasCurrentClasses = activeClassIds.size > 0
  const emptyMessage = !hasLearners
    ? 'Bạn chưa có hồ sơ học tập được liên kết trong không gian số này.'
    : !selectedLearnerHasClasses
      ? `Hồ sơ ${selectedLearnerName} hiện chưa tham gia lớp học nào tại ${tenantName}.`
      : 'Hiện bạn chưa có bài tập nào.'
  const emptyHint = !hasLearners
    ? ''
    : !selectedLearnerHasClasses
      ? 'Khi bạn được xếp vào lớp, các bài tập được giao sẽ xuất hiện tại đây.'
      : filters.search || filters.classId || filters.taskType || filters.dueFrom || filters.dueTo || status
        ? 'Không có bài tập phù hợp với bộ lọc hiện tại.'
        : ''

  async function handlePrimaryAction(item) {
    const action = getPrimaryAction(item)
    if (!item?.taskId || action?.disabled) return
    setActionError('')
    setActionKey(`${action.type}-${item.taskId}`)
    try {
      if (action.type === 'assessment') {
        const payload = await startStudentAssignmentAssessmentAttempt(item.taskId, { learnerId: portal.selectedLearnerId })
        const targetPath = payload?.maxAttemptsReached && payload?.showScoreAfterSubmit !== false
          ? (payload?.resultPath || payload?.runnerPath)
          : (payload?.runnerPath || payload?.resultPath)
        await loadData(pagination.page, filters, status)
        if (targetPath) {
          window.open(targetPath, '_blank', 'noopener,noreferrer')
        }
        return
      }
      if (action.type === 'todo') {
        await updateStudentAssignmentTodoProgress(item.taskId, { status: 'completed' }, { learnerId: portal.selectedLearnerId })
        await loadData(pagination.page, filters, status)
        return
      }
      setDetailAssignmentId(item.assignmentId)
    } catch (requestError) {
      setActionError(getApiMessage(requestError, 'Không thể thực hiện thao tác bài tập.'))
    } finally {
      setActionKey('')
    }
  }

  return (
    <div className='container-fluid py-4'>
      <StudentPortalContextCard
        title='Bài tập của tôi'
        description='Tổng hợp bài tập của hồ sơ học tập đang chọn từ tất cả lớp và tất cả buổi học trong tenant hiện tại.'
        context={portal.context}
        selectedLearnerId={portal.selectedLearnerId}
        onSelectLearner={portal.setSelectedLearnerId}
        error={portal.error}
      />

      <CCard className='mb-4'>
        <CCardHeader><strong>Bộ lọc bài tập</strong></CCardHeader>
        <CCardBody>
          <CNav variant='tabs' className='mb-3 flex-nowrap overflow-auto'>
            {STATUS_TABS.map((item) => (
              <CNavItem key={item.value || 'all'}>
                <CNavLink active={status === item.value} onClick={() => { setStatus(item.value); setPagination((prev) => ({ ...prev, page: 1 })) }} role='button'>
                  {item.label}
                  <CBadge color='secondary' className='ms-2'>
                    {item.value === ''
                      ? summary?.totalCount || 0
                      : item.value === 'pending'
                        ? summary?.countsByStatus?.pending || 0
                        : item.value === 'in_progress'
                          ? summary?.countsByStatus?.in_progress || 0
                          : item.value === 'completed'
                            ? summary?.countsByStatus?.completed || 0
                            : summary?.countsByStatus?.overdue || 0}
                  </CBadge>
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>

          <CRow className='g-3'>
            <CCol lg={4}><CFormLabel>Từ khóa</CFormLabel><CFormInput value={draftFilters.search} onChange={(event) => setDraftFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder='Tìm theo tiêu đề, lớp, môn học...' /></CCol>
            <CCol md={4} lg={2}><CFormLabel>Lớp</CFormLabel><CFormSelect value={draftFilters.classId} onChange={(event) => setDraftFilters((prev) => ({ ...prev, classId: event.target.value }))}><option value=''>Tất cả lớp</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</CFormSelect></CCol>
            <CCol md={4} lg={2}><CFormLabel>Loại bài</CFormLabel><CFormSelect value={draftFilters.taskType} onChange={(event) => setDraftFilters((prev) => ({ ...prev, taskType: event.target.value }))}>{TASK_TYPE_OPTIONS.map((item) => <option key={item.value || 'all'} value={item.value}>{item.label}</option>)}</CFormSelect></CCol>
            <CCol md={6} lg={2}><CFormLabel>Từ hạn nộp</CFormLabel><CFormInput type='date' value={draftFilters.dueFrom} onChange={(event) => setDraftFilters((prev) => ({ ...prev, dueFrom: event.target.value }))} /></CCol>
            <CCol md={6} lg={2}><CFormLabel>Đến hạn nộp</CFormLabel><CFormInput type='date' value={draftFilters.dueTo} onChange={(event) => setDraftFilters((prev) => ({ ...prev, dueTo: event.target.value }))} /></CCol>
          </CRow>

          <div className='d-flex gap-2 mt-3 flex-wrap'>
            <CButton color='primary' onClick={() => { setFilters(draftFilters); setPagination((prev) => ({ ...prev, page: 1 })) }}>Search</CButton>
            <CButton color='secondary' variant='outline' onClick={() => {
              const next = buildInitialFilters()
              setDraftFilters(next)
              setFilters(next)
              setStatus('pending')
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}>Đặt lại</CButton>
            <CButton color='secondary' variant='ghost' onClick={() => navigate('/student/sessions')}>Buổi học của tôi</CButton>
            <CButton color='secondary' variant='ghost' onClick={() => navigate('/student/classes')}>Lớp của tôi</CButton>
          </div>
        </CCardBody>
      </CCard>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {actionError ? <CAlert color='danger'>{actionError}</CAlert> : null}

      <CCard className='border-0 shadow-sm'>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <div>
            <strong>Danh sách bài tập</strong>
            <CBadge color='secondary' className='ms-2'>{pagination.total || 0}</CBadge>
          </div>
          <div className='small text-body-secondary'>10 / trang</div>
        </CCardHeader>
        <CCardBody>
          {portal.loading || loading ? (
            <div className='text-center py-5'><CSpinner color='primary' /></div>
          ) : rows.length === 0 ? (
            <div className='py-4 text-center'>
              <div className='fw-semibold mb-2'>{emptyMessage}</div>
              {emptyHint ? <div className='text-body-secondary'>{emptyHint}</div> : null}
            </div>
          ) : (
            <div className='d-flex flex-column gap-3'>
              {rows.map((item) => {
                const statusMeta = getStatusMeta(item.normalizedStatus)
                const action = getPrimaryAction(item)
                const buttonDisabled = action.disabled || actionKey === `${action.type}-${item.taskId}`
                return (
                  <CCard key={item.id} className='border rounded-3'>
                    <CCardBody>
                      <div className='d-flex justify-content-between gap-3 flex-wrap'>
                        <div className='flex-grow-1'>
                          <div className='d-flex gap-2 align-items-center flex-wrap mb-2'>
                            <div className='fw-semibold'>{item.taskTitle || item.assignmentTitle || 'Bài tập'}</div>
                            <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                            {item.required ? <CBadge color='dark' shape='rounded-pill'>Bắt buộc</CBadge> : null}
                          </div>
                          <div className='text-body-secondary small mb-2'>{getClassSessionContentPreview(item.taskDescription || item.assignmentDescription, 180)}</div>
                          <div className='small mb-1'><strong>Lớp:</strong> {item.className || '-'}{item.classCode ? ` (${item.classCode})` : ''}</div>
                          <div className='small mb-1'><strong>Môn:</strong> {item.subject || '-'}</div>
                          <div className='small mb-1'><strong>Buổi học:</strong> {item.sessionDate ? `${formatSessionDate(item.sessionDate)} · ${formatSessionTime(item.sessionStartTime)}-${formatSessionTime(item.sessionEndTime)}` : 'Không gắn buổi học'}</div>
                          <div className='small mb-1'><strong>Giáo viên:</strong> {formatTeacherDisplay(item.teacher)}</div>
                          <div className='small mb-1'><strong>Loại:</strong> {getTaskTypeLabel(item.taskType)}</div>
                          <div className='small mb-1'><strong>Hạn:</strong> {item.dueAt ? formatSessionDateTime(item.dueAt) : 'Không có hạn nộp'}</div>
                          <div className='small text-body-secondary'>{getRelativeDueLabel(item, serverNow)}</div>
                          {item.taskType === 'assessment' && item.showScoreAfterSubmit !== false && item.score !== null ? <div className='small mt-2'><strong>Điểm:</strong> {item.score}{item.maxScore ? `/${item.maxScore}` : ''}</div> : null}
                        </div>
                        <div className='d-flex flex-column align-items-start align-items-md-end gap-2'>
                          <CButton size='sm' color='primary' disabled={buttonDisabled} onClick={() => handlePrimaryAction(item)}>{action.label}</CButton>
                          <CButton size='sm' color='secondary' variant='outline' onClick={() => setDetailAssignmentId(item.assignmentId)}>Xem chi tiết</CButton>
                        </div>
                      </div>
                    </CCardBody>
                  </CCard>
                )
              })}

              <div className='d-flex justify-content-center pt-2'>
                <SimplePagination currentPage={pagination.page || 1} pageCount={pagination.pageCount || 1} disabled={loading} onPageChange={(nextPage) => loadData(nextPage, filters, status)} />
              </div>
            </div>
          )}
        </CCardBody>
      </CCard>

      <StudentAssignmentDetailModal
        visible={Boolean(detailAssignmentId)}
        assignmentId={detailAssignmentId}
        learnerId={portal.selectedLearnerId}
        onClose={() => setDetailAssignmentId(null)}
        onChanged={() => loadData(pagination.page, filters, status)}
      />
    </div>
  )
}