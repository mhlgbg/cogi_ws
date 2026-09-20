import { useCallback, useEffect, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CSpinner } from '@coreui/react'
import { getStudentAssignmentDetail, saveStudentAssignmentSubmissionDraft, startStudentAssignmentAssessmentAttempt, submitStudentAssignmentSubmission, updateStudentAssignmentTodoProgress } from '../services/classService'
import { sanitizeClassSessionContentHtml } from '../utils/classSessionContentHtml'
import { formatSessionDateTime } from '../utils/classSessionUi'
import StudentSubmissionEditorModal from './StudentSubmissionEditorModal'

const STATUS_META = {
  assigned: { label: 'Chưa bắt đầu', color: 'secondary' },
  in_progress: { label: 'Đang làm', color: 'info' },
  submitted: { label: 'Đã nộp', color: 'warning' },
  completed: { label: 'Hoàn thành', color: 'success' },
  returned: { label: 'Làm lại', color: 'danger' },
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function HtmlView({ value }) {
  const html = sanitizeClassSessionContentHtml(value || '')
  return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div className='text-body-secondary'>Chưa có nội dung.</div>
}

function getAssessmentTaskActionLabel(task) {
  if (task?.myProgress?.status === 'in_progress') return 'Tiếp tục làm bài'
  if ((task?.myProgress?.status === 'completed' || task?.myProgress?.status === 'submitted') && task?.assessmentSettings?.showScoreAfterSubmit !== false) return 'Xem kết quả'
  if (task?.myProgress?.status === 'completed' || task?.myProgress?.status === 'submitted') return 'Mở bài kiểm tra'
  return 'Làm bài kiểm tra'
}

export default function StudentAssignmentDetailModal({ visible = false, assignmentId = null, learnerId = '', onClose, onChanged }) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submissionTask, setSubmissionTask] = useState(null)

  const load = useCallback(async () => {
    if (!assignmentId || !learnerId) {
      setDetail(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      setDetail(await getStudentAssignmentDetail(assignmentId, { learnerId }))
    } catch (requestError) {
      setDetail(null)
      setError(getApiMessage(requestError, 'Không thể tải assignment.'))
    } finally {
      setLoading(false)
    }
  }, [assignmentId, learnerId])

  useEffect(() => {
    if (!visible) return
    load()
  }, [load, visible])

  return (
    <>
      <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl'>
        <CModalHeader><CModalTitle>{detail?.title || 'Bài tập'}</CModalTitle></CModalHeader>
        <CModalBody>
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          {loading ? <div className='text-center py-4'><CSpinner color='primary' /></div> : detail ? (
            <div className='d-flex flex-column gap-4'>
              <CCard className='border-0 shadow-sm'>
                <CCardHeader><strong>Tổng quan</strong></CCardHeader>
                <CCardBody>
                  <div className='mb-2'><strong>Hạn nộp:</strong> {formatSessionDateTime(detail.dueAt)}</div>
                  <div className='mb-2'><strong>Trạng thái:</strong> {detail.status}</div>
                  <div className='mb-2'><strong>Tiến độ:</strong> {detail.completedTaskCount || 0}/{detail.totalTaskCount || detail.taskCount || 0}</div>
                  <HtmlView value={detail.description} />
                </CCardBody>
              </CCard>

              {(detail.tasks || []).map((task) => (
                <CCard key={task.id} className='border-0 shadow-sm'>
                  <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                    <div>
                      <strong>{task.title}</strong>
                      <div className='small text-body-secondary'>{task.taskType} · {task.required ? 'Bắt buộc' : 'Tùy chọn'}</div>
                    </div>
                    <CBadge color={(STATUS_META[task?.myProgress?.status] || STATUS_META.assigned).color}>{(STATUS_META[task?.myProgress?.status] || STATUS_META.assigned).label}</CBadge>
                  </CCardHeader>
                  <CCardBody className='d-flex flex-column gap-3'>
                    <HtmlView value={task.description} />
                    {task?.myProgress?.teacherFeedback ? <div><strong>Feedback:</strong><HtmlView value={task.myProgress.teacherFeedback} /></div> : null}
                    {(task.taskType !== 'assessment' || task?.assessmentSettings?.showScoreAfterSubmit !== false) && task?.myProgress?.score !== null && task?.myProgress?.score !== undefined ? <div><strong>Điểm:</strong> {task.myProgress.score}{task?.myProgress?.maxScore ? ` / ${task.myProgress.maxScore}` : ''}</div> : null}

                    {task.taskType === 'todo' ? (
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton size='sm' color='info' variant='outline' disabled={saving === `todo-${task.id}`} onClick={async () => {
                          setSaving(`todo-${task.id}`)
                          setSubmitError('')
                          try {
                            const next = await updateStudentAssignmentTodoProgress(task.id, { status: 'in_progress' }, { learnerId })
                            setDetail(next)
                            onChanged?.()
                          } catch (requestError) {
                            setSubmitError(getApiMessage(requestError, 'Không thể cập nhật tiến độ task.'))
                          } finally {
                            setSaving('')
                          }
                        }}>Đánh dấu đang làm</CButton>
                        <CButton size='sm' color='success' disabled={saving === `todo-${task.id}`} onClick={async () => {
                          setSaving(`todo-${task.id}`)
                          setSubmitError('')
                          try {
                            const next = await updateStudentAssignmentTodoProgress(task.id, { status: 'completed' }, { learnerId })
                            setDetail(next)
                            onChanged?.()
                          } catch (requestError) {
                            setSubmitError(getApiMessage(requestError, 'Không thể đánh dấu hoàn thành task.'))
                          } finally {
                            setSaving('')
                          }
                        }}>Hoàn thành</CButton>
                      </div>
                    ) : null}

                    {task.taskType === 'submission' ? (
                      <div className='d-flex flex-column gap-2'>
                        <div className='d-flex gap-2 flex-wrap'>
                          <CButton size='sm' color='primary' onClick={() => { setSubmitError(''); setSubmissionTask(task) }}>Mở bài nộp</CButton>
                        </div>
                        {(task.submissions || []).map((submission) => (
                          <div key={submission.id} className='small text-body-secondary'>Version {submission.version} · {submission.status} · {formatSessionDateTime(submission.submittedAt)}</div>
                        ))}
                      </div>
                    ) : null}

                    {task.taskType === 'assessment' ? (
                      <div className='d-flex flex-column gap-2'>
                        {task.assessment ? (
                          <div className='small text-body-secondary'>
                            {`${task.assessment.code || '-'} · ${task.assessment.title || '-'} · ${task.assessmentVersion?.code || '-'} · ${task.assessmentVersion?.durationMinutes || 0} phút · ${task.assessmentVersion?.questionCount || 0} câu`}
                          </div>
                        ) : null}
                        <div className='d-flex gap-2 flex-wrap'>
                          <CButton size='sm' color='primary' disabled={saving === `assessment-${task.id}` || !task?.assessment?.id} onClick={async () => {
                            setSaving(`assessment-${task.id}`)
                            setSubmitError('')
                            try {
                              const payload = await startStudentAssignmentAssessmentAttempt(task.id, { learnerId })
                              await load()
                              const targetPath = payload?.maxAttemptsReached && payload?.showScoreAfterSubmit !== false
                                ? (payload?.resultPath || payload?.runnerPath)
                                : (payload?.runnerPath || payload?.resultPath)
                              if (targetPath) {
                                window.open(targetPath, '_blank', 'noopener,noreferrer')
                              }
                            } catch (requestError) {
                              setSubmitError(getApiMessage(requestError, 'Không thể mở bài kiểm tra.'))
                            } finally {
                              setSaving('')
                            }
                          }}>{getAssessmentTaskActionLabel(task)}</CButton>
                        </div>
                        {task?.myProgress?.status === 'submitted' && task?.assessmentSettings?.showScoreAfterSubmit === false ? <div className='small text-body-secondary'>Bài làm đã được nộp.</div> : null}
                        {task?.myProgress?.status === 'submitted' && task?.assessmentSettings?.showScoreAfterSubmit !== false && (task?.myProgress?.score === null || task?.myProgress?.score === undefined) ? <div className='small text-body-secondary'>Đã nộp – đang chờ chấm.</div> : null}
                        {task?.myProgress?.status === 'completed' && task?.assessmentSettings?.showScoreAfterSubmit !== false ? <div className='small text-success'>Bài làm đã được nộp và đã có kết quả.</div> : null}
                      </div>
                    ) : null}
                  </CCardBody>
                </CCard>
              ))}

              {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => onClose?.()}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <StudentSubmissionEditorModal
        visible={Boolean(submissionTask)}
        task={submissionTask}
        learnerId={learnerId}
        saving={Boolean(saving)}
        submitError={submitError}
        onClose={() => { if (!saving) setSubmissionTask(null) }}
        onSaveDraft={async (payload) => {
          if (!submissionTask?.id) return
          setSaving(`draft-${submissionTask.id}`)
          setSubmitError('')
          try {
            const next = await saveStudentAssignmentSubmissionDraft(submissionTask.id, payload, { learnerId })
            setDetail(next)
            const refreshedTask = (next?.tasks || []).find((item) => item.id === submissionTask.id) || null
            setSubmissionTask(refreshedTask)
            onChanged?.()
          } catch (requestError) {
            setSubmitError(getApiMessage(requestError, 'Không thể lưu nháp bài nộp.'))
          } finally {
            setSaving('')
          }
        }}
        onSubmit={async (payload) => {
          if (!submissionTask?.id) return
          setSaving(`submit-${submissionTask.id}`)
          setSubmitError('')
          try {
            const next = await submitStudentAssignmentSubmission(submissionTask.id, payload, { learnerId })
            setDetail(next)
            setSubmissionTask(null)
            onChanged?.()
          } catch (requestError) {
            setSubmitError(getApiMessage(requestError, 'Không thể nộp bài.'))
          } finally {
            setSaving('')
          }
        }}
      />
    </>
  )
}