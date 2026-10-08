import { useCallback, useEffect, useMemo, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CFormInput, CFormLabel, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { getTeacherAssignmentDetail, getTeacherAssignmentLearnerTaskDetail, publishTeacherAssignment, closeTeacherAssignment, cancelTeacherAssignment, reviewTeacherAssignmentLearnerTask, startTeacherAssignmentAssessmentPreview, updateTeacherAssignment } from '../services/classService'
import { sanitizeClassSessionContentHtml } from '../utils/classSessionContentHtml'
import { formatSessionDateTime } from '../utils/classSessionUi'
import SubmissionViewer from './SubmissionViewer'
import TeacherAssignmentEditorModal from './TeacherAssignmentEditorModal'
import { getSubmissionStatusMeta, getSubmissionVersionLabel } from './submissionViewerMeta'

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

function getDefaultReviewForm(payload = null) {
  return {
    status: payload?.progress?.status === 'returned' ? 'returned' : 'completed',
    teacherFeedback: payload?.progress?.teacherFeedback || '<p></p>',
    score: payload?.progress?.score ?? '',
    maxScore: payload?.progress?.maxScore ?? '',
  }
}

export function TeacherAssignmentDetailModal({ visible = false, assignmentId = null, onClose, onChanged }) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [previewLoadingTaskId, setPreviewLoadingTaskId] = useState(null)

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
    setActionLoading(action)
    setError('')
    try {
      const nextDetail = action === 'publish'
        ? await publishTeacherAssignment(assignmentId)
        : action === 'close'
          ? await closeTeacherAssignment(assignmentId)
          : await cancelTeacherAssignment(assignmentId)
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
                          <div className='small text-body-secondary'>{task.taskType} · {task.required ? 'Bắt buộc' : 'Tùy chọn'}</div>
                          {task.taskType === 'assessment' && task.assessmentVersion?.id ? (
                            <CButton size='sm' color='info' variant='outline' onClick={() => openAssessmentPreview(task)} disabled={previewLoadingTaskId === task.id}>
                              {previewLoadingTaskId === task.id ? 'Đang mở...' : 'Xem lại bài kiểm tra'}
                            </CButton>
                          ) : null}
                        </div>
                      </div>
                      <HtmlView value={task.description} />
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
    </>
  )
}

export function TeacherAssignmentProgressModal({ visible = false, assignmentId = null, onClose, onChanged }) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
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
                          {task.title || `Task ${task.order || ''}`}
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
                              {clickable ? (
                                <CButton size='sm' color={meta.color} variant='outline' onClick={() => { setSelectedTask({ taskId: taskCell.taskId, learnerId: row.learner.id }); setTaskDetailOpen(true) }}>
                                  {meta.label}
                                </CButton>
                              ) : (
                                <span className='text-body-secondary'>{meta.label}</span>
                              )}
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
  const [reviewForm, setReviewForm] = useState({ status: 'completed', teacherFeedback: '<p></p>', score: '', maxScore: '' })
  const [savingReview, setSavingReview] = useState(false)
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

  async function handleSaveReview() {
    if (!assignmentId || !taskId || !learnerId || !detail) return
    setSavingReview(true)
    setError('')
    try {
      await reviewTeacherAssignmentLearnerTask(assignmentId, taskId, learnerId, {
        status: reviewForm.status,
        teacherFeedback: reviewForm.teacherFeedback,
        score: reviewForm.score,
        maxScore: reviewForm.maxScore,
        submissionId: currentSubmission?.id,
      })
      await load()
      onChanged?.()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu review cho learner.'))
    } finally {
      setSavingReview(false)
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

            {detail?.task?.description ? (
              <div className='border rounded-3 p-3 bg-body-tertiary'>
                <div className='fw-semibold mb-2'>Hướng dẫn task</div>
                <HtmlView value={detail.task.description} />
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
                <CFormLabel>TeacherFeedback</CFormLabel>
                <CFormInput value={reviewForm.teacherFeedback} onChange={(event) => setReviewForm((prev) => ({ ...prev, teacherFeedback: event.target.value }))} />
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
