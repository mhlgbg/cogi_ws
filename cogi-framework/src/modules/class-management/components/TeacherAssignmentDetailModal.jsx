import { useCallback, useEffect, useMemo, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CFormInput, CFormLabel, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { getTeacherAssignmentDetail, getTeacherAssignmentLearnerTaskDetail, publishTeacherAssignment, closeTeacherAssignment, cancelTeacherAssignment, reopenTeacherAssignment, reviewTeacherAssignmentLearnerTask, startTeacherAssignmentAssessmentPreview, updateTeacherAssignment, autoGradeTeacherAssignmentLearnerTask, updateTeacherAssignmentTaskGradingDefinition, batchRegradeStaleUnreviewedTeacherAssignmentTask } from '../services/classService'
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'
import { hasClassSessionContent, normalizeClassSessionContentForEditor, sanitizeClassSessionContentHtml } from '../utils/classSessionContentHtml'
import { formatSessionDateTime } from '../utils/classSessionUi'
import SubmissionViewer from './SubmissionViewer'
import TeacherAssignmentEditorModal from './TeacherAssignmentEditorModal'
import { getSubmissionVersionLabel } from './submissionViewerMeta'

const STATUS_META = {
  draft: { label: 'Draft', color: 'secondary' },
  published: { label: 'Published', color: 'primary' },
  closed: { label: 'Closed', color: 'dark' },
  cancelled: { label: 'Cancelled', color: 'danger' },
  assigned: { label: 'Chưa bắt đầu', color: 'secondary' },
  in_progress: { label: 'Đang làm', color: 'info' },
  submitted: { label: 'Đã nộp', color: 'warning' },
  completed: { label: 'Hoàn thành', color: 'success' },
  returned: { label: 'Làm lại', color: 'danger' },
  missing: { label: 'Thiếu', color: 'secondary' },
}

const REVIEW_FEEDBACK_TOOLBAR = [
  { label: 'P', command: 'formatBlock', value: 'p' },
  { label: 'B', command: 'bold' },
  { label: 'I', command: 'italic' },
  { label: 'UL', command: 'insertUnorderedList' },
  { label: 'OL', command: 'insertOrderedList' },
]

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function HtmlView({ value }) {
  const html = sanitizeClassSessionContentHtml(value || '')
  return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div className='text-body-secondary'>Chưa có nội dung.</div>
}

function getTaskStatusLabel(status) {
  return (STATUS_META[status] || STATUS_META.assigned).label
}

function getTaskStatusColor(status) {
  return (STATUS_META[status] || STATUS_META.assigned).color
}

function isTaskDetailClickable(status) {
  const normalized = String(status || '').toLowerCase()
  return ['in_progress', 'submitted', 'completed', 'returned'].includes(normalized)
}

function normalizeTeacherFeedbackValue(value) {
  const normalized = normalizeClassSessionContentForEditor(value)
  const sanitized = sanitizeClassSessionContentHtml(normalized)
  return sanitized || '<p></p>'
}

function getDefaultReviewForm(payload = null) {
  return {
    status: payload?.progress?.status === 'returned' ? 'returned' : 'completed',
    teacherFeedback: normalizeTeacherFeedbackValue(payload?.progress?.teacherFeedback),
    score: payload?.progress?.score ?? '',
    maxScore: payload?.progress?.maxScore ?? '',
  }
}

function normalizeGradingDefinitionHtml(value) {
  const normalized = normalizeClassSessionContentForEditor(value)
  const sanitized = sanitizeClassSessionContentHtml(normalized)
  if (!hasClassSessionContent(sanitized)) return ''
  return sanitized
}

function TaskGradingDefinitionModal({ visible = false, task = null, saving = false, submitError = '', onClose, onSave }) {
  const [expectedOutcome, setExpectedOutcome] = useState(() => task?.expectedOutcome || '<p></p>')
  const [gradingRubric, setGradingRubric] = useState(() => task?.gradingRubric || '<p></p>')

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl'>
      <CModalHeader>
        <CModalTitle>Sửa tiêu chí chấm</CModalTitle>
      </CModalHeader>
      <CModalBody className='d-flex flex-column gap-3'>
        {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
        <div className='small text-body-secondary'>
          Task: <strong>{task?.title || '-'}</strong> · Phiên bản tiêu chí hiện tại: <strong>v{Number(task?.gradingVersion || 0) || 1}</strong>
        </div>
        {Number(task?.stats?.staleAiCount || 0) > 0 ? (
          <CAlert color='warning' className='mb-0'>
            Có {task?.stats?.staleAiCount || 0} bài đã AI chấm theo phiên bản cũ ({task?.stats?.staleUnreviewedCount || 0} chưa duyệt, {task?.stats?.staleReviewedCount || 0} đã duyệt).
          </CAlert>
        ) : null}
        <SimpleHtmlEditor
          label='Kỳ vọng đầu ra'
          value={expectedOutcome}
          onChange={setExpectedOutcome}
          disabled={saving}
          rows={6}
          showImageControls={false}
          showColorControls={false}
          allowHtmlMode
          helperText='Mô tả giáo viên mong muốn học sinh đạt được gì. Nội dung này dùng để hỗ trợ chấm bài và có thể không hiển thị cho học sinh.'
        />
        <SimpleHtmlEditor
          label='Tiêu chí chấm'
          value={gradingRubric}
          onChange={setGradingRubric}
          disabled={saving}
          rows={6}
          showImageControls={false}
          showColorControls={false}
          allowHtmlMode
          helperText='Mô tả cách đánh giá hoặc phân bổ điểm. Có thể để trống nếu không cần.'
        />
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={saving}>Đóng</CButton>
        <CButton
          color='primary'
          onClick={() => onSave?.({
            expectedOutcome: normalizeGradingDefinitionHtml(expectedOutcome),
            gradingRubric: normalizeGradingDefinitionHtml(gradingRubric),
          })}
          disabled={saving}
        >
          {saving ? 'Đang lưu...' : 'Lưu tiêu chí chấm'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export function TeacherAssignmentDetailModal({ visible = false, assignmentId = null, canManage = false, onClose, onChanged }) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [previewLoadingTaskId, setPreviewLoadingTaskId] = useState(null)
  const [gradingEditorTask, setGradingEditorTask] = useState(null)
  const [gradingEditorError, setGradingEditorError] = useState('')

  const load = useCallback(async () => {
    if (!assignmentId) {
      setDetail(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      setDetail(await getTeacherAssignmentDetail(assignmentId))
    } catch (requestError) {
      setDetail(null)
      setError(getApiMessage(requestError, 'Không thể tải chi tiết bài tập.'))
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => {
    if (!visible) return
    load()
  }, [load, visible])

  async function handleAction(action) {
    if (!assignmentId) return
    if (action === 'reopen') {
      const dueAtMs = detail?.dueAt ? new Date(detail.dueAt).getTime() : null
      const isOverdue = dueAtMs !== null && Number.isFinite(dueAtMs) && dueAtMs < Date.now()
      const confirmMessage = isOverdue
        ? 'Bài tập đã quá hạn nộp. Bạn vẫn muốn mở lại bài tập này không?\n\nLưu ý: Nếu muốn học viên tiếp tục nộp bài, bạn cần gia hạn deadline.'
        : 'Bạn có chắc chắn muốn mở lại bài tập này không?'
      if (!window.confirm(confirmMessage)) return
    }
    setActionLoading(action)
    setError('')
    try {
      const nextDetail = action === 'publish'
        ? await publishTeacherAssignment(assignmentId)
        : action === 'close'
          ? await closeTeacherAssignment(assignmentId)
          : action === 'cancel'
            ? await cancelTeacherAssignment(assignmentId)
            : await reopenTeacherAssignment(assignmentId)
      setDetail(nextDetail)
      onChanged?.()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật bài tập.'))
    } finally {
      setActionLoading('')
    }
  }

  async function openAssessmentPreview(task) {
    const assessmentVersionId = task?.assessmentVersion?.id
    if (!assignmentId || !assessmentVersionId) return
    setPreviewLoadingTaskId(task.id)
    setError('')
    try {
      const payload = await startTeacherAssignmentAssessmentPreview(assignmentId, assessmentVersionId)
      if (payload?.runnerPath) {
        window.open(payload.runnerPath, '_blank', 'noopener,noreferrer')
      }
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể mở preview bài kiểm tra.'))
    } finally {
      setPreviewLoadingTaskId(null)
    }
  }

  async function handleBatchRegradeTask(task) {
    const taskId = Number(task?.id || 0) || 0
    if (!assignmentId || !taskId) return
    const staleCount = Number(task?.stats?.staleUnreviewedCount || 0) || 0
    if (staleCount <= 0) return
    const confirmed = window.confirm(`Bạn muốn chấm lại ${staleCount} bài chưa duyệt theo tiêu chí mới cho task "${task?.title || 'Task'}"?`)
    if (!confirmed) return
    setActionLoading(`regrade-${taskId}`)
    setError('')
    try {
      const result = await batchRegradeStaleUnreviewedTeacherAssignmentTask(assignmentId, taskId)
      await load()
      onChanged?.()
      window.alert(`Đã chấm lại ${result?.regradedCount || 0}/${result?.totalCandidates || staleCount} bài. Còn ${result?.staleUnreviewedCount || 0} bài AI theo tiêu chí cũ chưa duyệt.`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể chấm lại theo tiêu chí mới.'))
    } finally {
      setActionLoading('')
    }
  }

  return (
    <>
      <CModal visible={visible} onClose={() => !actionLoading && onClose?.()} size='xl'>
        <CModalHeader>
          <CModalTitle>{detail?.title || 'Chi tiết bài tập'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          {loading ? <div className='text-center py-4'><CSpinner color='primary' /></div> : detail ? (
            <div className='d-flex flex-column gap-4'>
              <CCard className='border-0 shadow-sm'>
                <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                  <strong>Thông tin bài tập</strong>
                  <div className='d-flex gap-2 flex-wrap'>
                    {detail.status === 'draft' ? <CButton size='sm' color='secondary' variant='outline' onClick={() => setEditorOpen(true)}>Chỉnh sửa</CButton> : null}
                    {detail.status === 'draft' ? <CButton size='sm' color='primary' onClick={() => handleAction('publish')} disabled={actionLoading === 'publish'}>{actionLoading === 'publish' ? 'Đang giao...' : 'Giao bài'}</CButton> : null}
                    {detail.status === 'published' ? <CButton size='sm' color='dark' variant='outline' onClick={() => handleAction('close')} disabled={actionLoading === 'close'}>{actionLoading === 'close' ? 'Đang đóng...' : 'Đóng bài tập'}</CButton> : null}
                    {detail.status !== 'cancelled' ? <CButton size='sm' color='danger' variant='outline' onClick={() => handleAction('cancel')} disabled={actionLoading === 'cancel'}>{actionLoading === 'cancel' ? 'Đang hủy...' : 'Hủy'}</CButton> : null}
                    {canManage && detail.status === 'cancelled' ? <CButton size='sm' color='success' onClick={() => handleAction('reopen')} disabled={actionLoading === 'reopen'}>{actionLoading === 'reopen' ? 'Đang mở lại...' : 'Mở lại bài tập'}</CButton> : null}
                  </div>
                </CCardHeader>
                <CCardBody>
                  <CRow className='g-3'>
                    <CCol md={8}><div className='mb-2'><strong>Tiêu đề:</strong> {detail.title || '-'}</div><div className='mb-2'><strong>Hạn nộp:</strong> {formatSessionDateTime(detail.dueAt)}</div><div className='mb-2'><strong>Trạng thái:</strong> <CBadge color={(STATUS_META[detail.status] || STATUS_META.draft).color}>{(STATUS_META[detail.status] || STATUS_META.draft).label}</CBadge></div></CCol>
                    <CCol md={4}><div><strong>Task:</strong> {detail.taskCount || 0}</div><div><strong>Học viên:</strong> {detail.learnerCount || 0}</div><div><strong>Hoàn thành:</strong> {detail.completedCount || 0}</div><div><strong>Đã nộp:</strong> {detail.submittedCount || 0}</div></CCol>
                  </CRow>
                  <div className='mt-3'><strong>Mô tả</strong><HtmlView value={detail.description} /></div>
                </CCardBody>
              </CCard>

              <CCard className='border-0 shadow-sm'>
                <CCardHeader><strong>Danh sách task</strong></CCardHeader>
                <CCardBody className='d-flex flex-column gap-3'>
                  {(detail.tasks || []).map((task) => (
                    <div key={task.id} className='border rounded-3 p-3'>
                      <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                        <div className='fw-semibold'>{task.title}</div>
                        <div className='d-flex align-items-center gap-2 flex-wrap'>
                          <div className='small text-body-secondary'>{task.taskType} · {task.required ? 'Bắt buộc' : 'Tùy chọn'} · Grading v{Number(task?.gradingVersion || 0) || 1}</div>
                          {detail.status === 'published' ? (
                            <CButton size='sm' color='secondary' variant='outline' onClick={() => { setGradingEditorTask(task); setGradingEditorError('') }}>
                              Sửa tiêu chí chấm
                            </CButton>
                          ) : null}
                          {task.taskType === 'submission' && Number(task?.stats?.staleUnreviewedCount || 0) > 0 ? (
                            <CButton
                              size='sm'
                              color='warning'
                              variant='outline'
                              onClick={() => handleBatchRegradeTask(task)}
                              disabled={actionLoading === `regrade-${task.id}`}
                            >
                              {actionLoading === `regrade-${task.id}` ? 'Đang chấm lại...' : `Chấm lại ${task.stats.staleUnreviewedCount} bài chưa duyệt`}
                            </CButton>
                          ) : null}
                          {task.taskType === 'assessment' && task.assessmentVersion?.id ? (
                            <CButton size='sm' color='info' variant='outline' onClick={() => openAssessmentPreview(task)} disabled={previewLoadingTaskId === task.id}>
                              {previewLoadingTaskId === task.id ? 'Đang mở...' : 'Xem lại bài kiểm tra'}
                            </CButton>
                          ) : null}
                        </div>
                      </div>
                      <HtmlView value={task.description} />
                      {hasClassSessionContent(task.expectedOutcome) ? (
                        <div className='mt-2'>
                          <div className='small fw-semibold text-body-secondary'>Kỳ vọng đầu ra</div>
                          <HtmlView value={task.expectedOutcome} />
                        </div>
                      ) : null}
                      {hasClassSessionContent(task.gradingRubric) ? (
                        <div className='mt-2'>
                          <div className='small fw-semibold text-body-secondary'>Tiêu chí chấm</div>
                          <HtmlView value={task.gradingRubric} />
                        </div>
                      ) : null}
                      {Number(task?.stats?.staleAiCount || 0) > 0 ? (
                        <div className='small text-warning mt-2'>
                          Có {task.stats.staleAiCount} bài AI chấm theo tiêu chí cũ ({task.stats.staleUnreviewedCount} chưa duyệt, {task.stats.staleReviewedCount} đã duyệt).
                        </div>
                      ) : null}
                      {task.taskType === 'assessment' && task.assessment ? (
                        <div className='small text-body-secondary mt-2 d-grid gap-1'>
                          <div>{`${task.assessment.code || '-'} · ${task.assessment.title || '-'} · ${task.assessmentVersion?.code || '-'} · ${task.assessmentVersion?.durationMinutes || 0} phút · ${task.assessmentVersion?.questionCount || 0} câu`}</div>
                          <div>{`Xem điểm sau khi nộp: ${task?.assessmentSettings?.showScoreAfterSubmit !== false ? 'Có' : 'Không'}`}</div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </CCardBody>
              </CCard>
            </div>
          ) : <div className='text-body-secondary'>Không có dữ liệu bài tập.</div>}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => onClose?.()}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <TeacherAssignmentEditorModal
        visible={editorOpen}
        saving={actionLoading === 'save'}
        assignment={detail}
        assignmentId={detail?.id || assignmentId}
        submitError={editorError}
        onClose={() => { if (!actionLoading) setEditorOpen(false) }}
        onSave={async (payload) => {
          setActionLoading('save')
          setEditorError('')
          try {
            const nextDetail = await updateTeacherAssignment(detail.id, payload)
            setDetail(nextDetail)
            setEditorOpen(false)
            onChanged?.()
          } catch (requestError) {
            setEditorError(getApiMessage(requestError, 'Không thể lưu bài tập.'))
          } finally {
            setActionLoading('')
          }
        }}
      />

      <TaskGradingDefinitionModal
        key={gradingEditorTask?.id || 'grading-definition-empty'}
        visible={Boolean(gradingEditorTask)}
        task={gradingEditorTask}
        saving={actionLoading === 'save-grading-definition'}
        submitError={gradingEditorError}
        onClose={() => {
          if (!actionLoading) setGradingEditorTask(null)
        }}
        onSave={async (payload) => {
          const taskId = Number(gradingEditorTask?.id || 0) || 0
          if (!detail?.id || !taskId) return
          setActionLoading('save-grading-definition')
          setGradingEditorError('')
          setError('')
          try {
            const result = await updateTeacherAssignmentTaskGradingDefinition(detail.id, taskId, payload)
            const refreshed = await getTeacherAssignmentDetail(detail.id)
            setDetail(refreshed)
            setGradingEditorTask(null)
            onChanged?.()
            if (result?.gradingChanged) {
              window.alert(`Tiêu chí chấm đã được cập nhật lên phiên bản ${result?.gradingVersion || 1}. Có ${result?.staleAiCount || 0} bài đã được AI chấm theo tiêu chí cũ.`)
            }
          } catch (requestError) {
            setGradingEditorError(getApiMessage(requestError, 'Không thể lưu tiêu chí chấm.'))
          } finally {
            setActionLoading('')
          }
        }}
      />
    </>
  )
}

export function TeacherAssignmentProgressModal({ visible = false, assignmentId = null, onClose, onChanged }) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [selectedTask, setSelectedTask] = useState({ taskId: null, learnerId: null })
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)

  const load = useCallback(async () => {
    if (!assignmentId) {
      setDetail(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      setDetail(await getTeacherAssignmentDetail(assignmentId))
    } catch (requestError) {
      setDetail(null)
      setError(getApiMessage(requestError, 'Không thể tải tiến độ bài tập.'))
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => {
    if (!visible) return
    load()
  }, [load, visible])

  async function handleBatchRegrade(task) {
    const taskId = Number(task?.id || 0) || 0
    if (!assignmentId || !taskId) return
    const staleCount = Number(task?.stats?.staleUnreviewedCount || 0) || 0
    if (staleCount <= 0) return
    const confirmed = window.confirm(`Chấm lại ${staleCount} bài chưa duyệt của task "${task?.title || 'Task'}" theo tiêu chí mới?`)
    if (!confirmed) return
    setActionLoading(`regrade-${taskId}`)
    setError('')
    try {
      const result = await batchRegradeStaleUnreviewedTeacherAssignmentTask(assignmentId, taskId)
      await load()
      onChanged?.()
      window.alert(`Đã chấm lại ${result?.regradedCount || 0}/${result?.totalCandidates || staleCount} bài. Còn ${result?.staleUnreviewedCount || 0} bài stale.`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể batch regrade theo tiêu chí mới.'))
    } finally {
      setActionLoading('')
    }
  }

  const summary = useMemo(() => {
    const learners = Array.isArray(detail?.learners) ? detail.learners : []
    const tasks = Array.isArray(detail?.tasks) ? detail.tasks : []
    const totalLearners = learners.length
    const totalTasks = tasks.length
    const completed = learners.reduce((sum, learner) => sum + Number(learner?.completedCount || 0), 0)
    const submitted = learners.reduce((sum, learner) => sum + Number(learner?.submittedCount || 0), 0)
    return { totalLearners, totalTasks, completed, submitted }
  }, [detail])

  return (
    <>
      <CModal visible={visible} onClose={() => !loading && onClose?.()} size='xl'>
        <CModalHeader>
          <CModalTitle>Tiến độ learner</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          {loading ? <div className='text-center py-4'><CSpinner color='primary' /></div> : detail ? (
            <div className='d-flex flex-column gap-3'>
              <CCard className='border-0 shadow-sm'>
                <CCardBody>
                  <CRow className='g-3'>
                    <CCol md={3}><div className='small text-body-secondary'>Assignment</div><div className='fw-semibold'>{detail.title || '-'}</div></CCol>
                    <CCol md={3}><div className='small text-body-secondary'>Hạn nộp</div><div>{formatSessionDateTime(detail.dueAt)}</div></CCol>
                    <CCol md={2}><div className='small text-body-secondary'>Learner</div><div>{summary.totalLearners}</div></CCol>
                    <CCol md={2}><div className='small text-body-secondary'>Task</div><div>{summary.totalTasks}</div></CCol>
                    <CCol md={2}><div className='small text-body-secondary'>Completed / Submitted</div><div>{summary.completed} / {summary.submitted}</div></CCol>
                  </CRow>
                </CCardBody>
              </CCard>

              <div className='table-responsive'>
                <CTable hover bordered style={{ minWidth: 900 }}>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ minWidth: 180, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Học viên</CTableHeaderCell>
                      {(detail.tasks || []).map((task) => (
                        <CTableHeaderCell key={`progress-head-${task.id}`} title={task.title} style={{ minWidth: 130 }}>
                          <div className='fw-semibold'>{task.title || `Task ${task.order || ''}`}</div>
                          <div className='small text-body-secondary'>v{Number(task?.gradingVersion || 0) || 1}</div>
                          {Number(task?.stats?.staleUnreviewedCount || 0) > 0 ? (
                            <div className='d-flex flex-column gap-1 mt-1'>
                              <div className='small text-warning'>{task.stats.staleUnreviewedCount} stale chưa duyệt</div>
                              <CButton
                                size='sm'
                                color='warning'
                                variant='outline'
                                onClick={() => handleBatchRegrade(task)}
                                disabled={actionLoading === `regrade-${task.id}`}
                              >
                                {actionLoading === `regrade-${task.id}` ? 'Đang chấm lại...' : 'Chấm lại'}
                              </CButton>
                            </div>
                          ) : null}
                        </CTableHeaderCell>
                      ))}
                      <CTableHeaderCell style={{ minWidth: 100 }}>Tổng</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {(detail.learners || []).length === 0 ? (
                      <CTableRow><CTableDataCell colSpan={(detail.tasks || []).length + 2} className='text-center text-body-secondary'>Chưa có learner progress.</CTableDataCell></CTableRow>
                    ) : (detail.learners || []).map((row) => (
                      <CTableRow key={row?.learner?.id || Math.random()}>
                        <CTableDataCell style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{row?.learner?.fullName || row?.learner?.code || '-'}</CTableDataCell>
                        {(row.tasks || []).map((taskCell) => {
                          const meta = STATUS_META[taskCell.status] || STATUS_META.assigned
                          const clickable = isTaskDetailClickable(taskCell.status) && Boolean(taskCell.taskId) && Boolean(row?.learner?.id)
                          return (
                            <CTableDataCell key={`progress-cell-${row?.learner?.id}-${taskCell.taskId}`}>
                              <div className='d-flex flex-column gap-1'>
                                {clickable ? (
                                  <CButton size='sm' color={meta.color} variant='outline' onClick={() => { setSelectedTask({ taskId: taskCell.taskId, learnerId: row.learner.id }); setTaskDetailOpen(true) }}>
                                    {meta.label}
                                  </CButton>
                                ) : (
                                  <span className='text-body-secondary'>{meta.label}</span>
                                )}
                                {taskCell?.aiStale ? <span className='small text-warning'>AI stale {taskCell?.aiGradingVersion ? `(v${taskCell.aiGradingVersion})` : '(unknown)'}</span> : null}
                                {taskCell?.teacherReviewGradingVersion ? <span className='small text-body-secondary'>Review v{taskCell.teacherReviewGradingVersion}</span> : null}
                              </div>
                            </CTableDataCell>
                          )
                        })}
                        <CTableDataCell>{row.completedCount || 0}/{detail.taskCount || 0}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>
            </div>
          ) : <div className='text-body-secondary'>Không có dữ liệu tiến độ.</div>}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => onClose?.()}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <TeacherAssignmentLearnerTaskDetailModal
        visible={taskDetailOpen}
        assignmentId={assignmentId}
        taskId={selectedTask.taskId}
        learnerId={selectedTask.learnerId}
        onClose={() => {
          setTaskDetailOpen(false)
          setSelectedTask({ taskId: null, learnerId: null })
        }}
        onChanged={onChanged}
      />
    </>
  )
}

export function TeacherAssignmentLearnerTaskDetailModal({ visible = false, assignmentId = null, taskId = null, learnerId = null, onClose, onChanged }) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [reviewForm, setReviewForm] = useState({ status: 'completed', teacherFeedback: normalizeTeacherFeedbackValue(''), score: '', maxScore: '' })
  const [savingReview, setSavingReview] = useState(false)
  const [autoGrading, setAutoGrading] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState(null)

  const load = useCallback(async () => {
    if (!visible || !assignmentId || !taskId || !learnerId) {
      setDetail(null)
      setSelectedVersion(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const payload = await getTeacherAssignmentLearnerTaskDetail(assignmentId, taskId, learnerId)
      setDetail(payload)
      setReviewForm(getDefaultReviewForm(payload))
      const versions = Array.isArray(payload?.submissions) ? payload.submissions : []
      if (versions.length > 0) {
        const newest = [...versions].sort((left, right) => Number(right.version || 0) - Number(left.version || 0))[0]
        setSelectedVersion(newest?.id ?? versions[0]?.id ?? null)
      } else {
        setSelectedVersion(null)
      }
    } catch (requestError) {
      setDetail(null)
      setError(getApiMessage(requestError, 'Không thể tải chi tiết bài làm học sinh.'))
    } finally {
      setLoading(false)
    }
  }, [assignmentId, learnerId, taskId, visible])

  useEffect(() => {
    load()
  }, [load])

  const currentSubmission = useMemo(() => {
    if (!Array.isArray(detail?.submissions) || detail.submissions.length === 0) return null
    return detail.submissions.find((submission) => String(submission.id) === String(selectedVersion)) || detail.submissions[0]
  }, [detail, selectedVersion])

  const currentTaskGradingVersion = Number(detail?.task?.gradingVersion || 0) || 1
  const currentAiGradingVersion = Number(detail?.progress?.aiGradingVersion || 0) || null
  const aiStale = detail?.progress?.aiStale === true || (currentAiGradingVersion !== null && currentAiGradingVersion < currentTaskGradingVersion)

  async function handleSaveReview(confirmStaleAiReview = false) {
    if (!assignmentId || !taskId || !learnerId || !detail) return
    setSavingReview(true)
    setError('')
    try {
      await reviewTeacherAssignmentLearnerTask(assignmentId, taskId, learnerId, {
        status: reviewForm.status,
        teacherFeedback: normalizeTeacherFeedbackValue(reviewForm.teacherFeedback),
        score: reviewForm.score,
        maxScore: reviewForm.maxScore,
        submissionId: currentSubmission?.id,
        confirmStaleAiReview: confirmStaleAiReview === true,
      })
      await load()
      onChanged?.()
    } catch (requestError) {
      const message = getApiMessage(requestError, 'Không thể lưu review cho learner.')
      const shouldConfirmStale = requestError?.response?.status === 409 && /tiêu chí cũ|grading|version/i.test(message)
      if (shouldConfirmStale) {
        const confirmed = window.confirm(`${message}\n\nBạn có muốn vẫn lưu review theo phiên bản tiêu chí hiện tại không?`)
        if (confirmed) {
          await handleSaveReview(true)
          return
        }
      }
      setError(message)
    } finally {
      setSavingReview(false)
    }
  }

  async function handleAutoGrade() {
    if (!assignmentId || !taskId || !learnerId || !detail) return
    const confirmMessage = aiStale
      ? `AI hiện đang ở phiên bản tiêu chí cũ (${currentAiGradingVersion ? `v${currentAiGradingVersion}` : 'unknown'}), task hiện tại v${currentTaskGradingVersion}.\n\nBạn muốn chấm lại theo tiêu chí mới?`
      : 'Bạn muốn chấm tự động bài nộp này bằng AI? Kết quả sẽ là đề xuất chấm, cần giáo viên xác nhận trước khi lưu.'
    const confirmed = window.confirm(confirmMessage)
    if (!confirmed) return
    setAutoGrading(true)
    setError('')
    try {
      const proposal = await autoGradeTeacherAssignmentLearnerTask(assignmentId, taskId, learnerId)
      const proposalScore = proposal?.proposal?.score ?? proposal?.score ?? ''
      const proposalMaxScore = proposal?.proposal?.maxScore ?? proposal?.maxScore ?? (reviewForm.maxScore || '')
      const proposalFeedback = proposal?.proposal?.teacherFeedback ?? proposal?.teacherFeedback ?? (reviewForm.teacherFeedback || '<p></p>')
      setReviewForm((prev) => ({
        ...prev,
        score: proposalScore,
        maxScore: proposalMaxScore,
        teacherFeedback: normalizeTeacherFeedbackValue(proposalFeedback),
      }))
      setDetail((prev) => prev ? {
        ...prev,
        progress: {
          ...(prev.progress || {}),
          aiGradingVersion: Number(proposal?.proposal?.gradingVersion || prev?.task?.gradingVersion || currentTaskGradingVersion),
          aiGradedAt: proposal?.proposal?.generatedAt || new Date().toISOString(),
          aiSuggestedScore: proposalScore === '' ? null : Number(proposalScore),
          aiSuggestedMaxScore: proposalMaxScore === '' ? null : Number(proposalMaxScore),
          aiSuggestedFeedback: normalizeTeacherFeedbackValue(proposalFeedback),
          aiStale: false,
        },
      } : prev)
      if (proposal?.proposal?.teacherFeedback || proposal?.teacherFeedback) {
        setError('')
      }
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể chấm tự động bài nộp.'))
    } finally {
      setAutoGrading(false)
    }
  }

  return (
    <CModal visible={visible} onClose={() => onClose?.()} size='xl'>
      <CModalHeader>
        <CModalTitle>Bài làm của học sinh</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {loading ? <div className='text-center py-4'><CSpinner color='primary' /></div> : detail ? (
          <div className='d-flex flex-column gap-3'>
            <CCard className='border-0 shadow-sm'>
              <CCardBody>
                <CRow className='g-3'>
                  <CCol md={4}><div className='small text-body-secondary'>Học viên</div><div className='fw-semibold'>{detail?.learner?.fullName || detail?.learner?.code || '-'}</div></CCol>
                  <CCol md={4}><div className='small text-body-secondary'>Assignment</div><div>{detail?.assignment?.title || detail?.task?.title || '-'}</div></CCol>
                  <CCol md={4}><div className='small text-body-secondary'>Task</div><div>{detail?.task?.title || '-'}</div></CCol>
                </CRow>
                <CRow className='g-3 mt-1'>
                  <CCol md={3}><div className='small text-body-secondary'>Status</div><CBadge color={getTaskStatusColor(detail?.progress?.status)}>{getTaskStatusLabel(detail?.progress?.status)}</CBadge></CCol>
                  <CCol md={3}><div className='small text-body-secondary'>SubmittedAt</div><div>{detail?.progress?.submittedAt ? formatSessionDateTime(detail.progress.submittedAt) : '—'}</div></CCol>
                  <CCol md={3}><div className='small text-body-secondary'>CompletedAt</div><div>{detail?.progress?.completedAt ? formatSessionDateTime(detail.progress.completedAt) : '—'}</div></CCol>
                  <CCol md={3}><div className='small text-body-secondary'>Score</div><div>{detail?.progress?.score ?? '—'}</div></CCol>
                </CRow>
              </CCardBody>
            </CCard>

            {aiStale ? (
              <CAlert color='warning' className='mb-0'>
                AI đã chấm theo tiêu chí cũ ({currentAiGradingVersion ? `v${currentAiGradingVersion}` : 'unknown'}), hiện tại task đang ở v{currentTaskGradingVersion}. Vui lòng bấm <strong>Chấm lại theo tiêu chí mới</strong> trước khi duyệt nếu cần.
              </CAlert>
            ) : null}
            {detail?.progress?.teacherReviewGradingVersion ? (
              <div className='small text-body-secondary'>
                Bản review gần nhất được lưu theo grading version v{detail.progress.teacherReviewGradingVersion}.
              </div>
            ) : null}

            {detail?.task?.description ? (
              <div className='border rounded-3 p-3 bg-body-tertiary'>
                <div className='fw-semibold mb-2'>Hướng dẫn task</div>
                <HtmlView value={detail.task.description} />
              </div>
            ) : null}
            {hasClassSessionContent(detail?.task?.expectedOutcome) ? (
              <div className='border rounded-3 p-3 bg-body-tertiary'>
                <div className='fw-semibold mb-2'>Kỳ vọng đầu ra</div>
                <HtmlView value={detail.task.expectedOutcome} />
              </div>
            ) : null}
            {hasClassSessionContent(detail?.task?.gradingRubric) ? (
              <div className='border rounded-3 p-3 bg-body-tertiary'>
                <div className='fw-semibold mb-2'>Tiêu chí chấm</div>
                <HtmlView value={detail.task.gradingRubric} />
              </div>
            ) : null}

            {Array.isArray(detail?.submissions) && detail.submissions.length > 0 ? (
              <CCard className='border-0 shadow-sm'>
                <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                  <strong>Submission</strong>
                  <div className='d-flex gap-2 flex-wrap'>
                    {detail.submissions.map((submission) => (
                      <CButton
                        key={submission.id}
                        size='sm'
                        color={String(selectedVersion) === String(submission.id) ? 'primary' : 'secondary'}
                        variant={String(selectedVersion) === String(submission.id) ? 'solid' : 'outline'}
                        onClick={() => setSelectedVersion(submission.id)}
                      >
                        {getSubmissionVersionLabel(submission.version)}
                      </CButton>
                    ))}
                  </div>
                </CCardHeader>
                <CCardBody>
                  {currentSubmission ? (
                    <>
                      <div className='mb-3 small text-body-secondary'>
                        {currentSubmission?.submittedAt ? formatSessionDateTime(currentSubmission.submittedAt) : 'Chưa có thời gian nộp'}
                      </div>
                      {currentSubmission?.comment ? <div className='mb-3'><strong>Ghi chú học sinh:</strong> {currentSubmission.comment}</div> : null}
                      <SubmissionViewer submission={currentSubmission} showHeader={false} />
                    </>
                  ) : <div className='text-body-secondary'>Không có submission để hiển thị.</div>}
                </CCardBody>
              </CCard>
            ) : (
              <CCard className='border-0 shadow-sm'>
                <CCardBody>
                  <div className='text-body-secondary'>Task này không có submission data.</div>
                </CCardBody>
              </CCard>
            )}

            <div className='border rounded-3 p-3 bg-body-tertiary'>
              <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3'>
                <div className='fw-semibold'>Kết quả review</div>
                <CButton size='sm' color='primary' variant='outline' onClick={handleAutoGrade} disabled={autoGrading || !detail || !currentSubmission}>
                  {autoGrading ? 'Đang chấm...' : aiStale ? 'Chấm lại theo tiêu chí mới' : 'Chấm tự động'}
                </CButton>
              </div>
              <CRow className='g-3'>
                <CCol md={4}>
                  <CFormLabel>Kết quả review</CFormLabel>
                  <CFormSelect value={reviewForm.status} onChange={(event) => setReviewForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value='completed'>Hoàn thành</option>
                    <option value='returned'>Trả lại làm lại</option>
                  </CFormSelect>
                </CCol>
                <CCol md={4}>
                  <CFormLabel>Score</CFormLabel>
                  <CFormInput value={reviewForm.score} onChange={(event) => setReviewForm((prev) => ({ ...prev, score: event.target.value }))} />
                </CCol>
                <CCol md={4}>
                  <CFormLabel>Max score</CFormLabel>
                  <CFormInput value={reviewForm.maxScore} onChange={(event) => setReviewForm((prev) => ({ ...prev, maxScore: event.target.value }))} />
                </CCol>
              </CRow>
              <div className='mt-3'>
                <SimpleHtmlEditor
                  label='Nhận xét của giáo viên'
                  value={reviewForm.teacherFeedback}
                  onChange={(value) => setReviewForm((prev) => ({ ...prev, teacherFeedback: value }))}
                  disabled={savingReview}
                  rows={8}
                  toolbarActions={REVIEW_FEEDBACK_TOOLBAR}
                  showLinkControls
                  showImageControls={false}
                  showColorControls={false}
                  allowHtmlMode
                  helperText='Hỗ trợ đoạn văn, in đậm, in nghiêng, danh sách, liên kết và chỉnh HTML cơ bản. Nội dung sẽ được sanitize an toàn.'
                />
              </div>
            </div>
          </div>
        ) : <div className='text-body-secondary'>Không có dữ liệu bài làm học sinh.</div>}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()}>Đóng</CButton>
        <CButton color='primary' onClick={handleSaveReview} disabled={savingReview || !detail}>{savingReview ? 'Đang lưu...' : 'Lưu review'}</CButton>
      </CModalFooter>
    </CModal>
  )
}

export default TeacherAssignmentDetailModal
