import { useCallback, useEffect, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CSpinner } from '@coreui/react'
import { getStudentAssignmentDetail, getStudentSubmissionVersionDetail, saveStudentAssignmentSubmissionDraft, startStudentAssignmentAssessmentAttempt, submitStudentAssignmentSubmission, updateStudentAssignmentTodoProgress } from '../services/classService'
import { sanitizeClassSessionContentHtml } from '../utils/classSessionContentHtml'
import { formatSessionDateTime } from '../utils/classSessionUi'
import SubmissionViewer from './SubmissionViewer'
import StudentSubmissionEditorModal from './StudentSubmissionEditorModal'
import { getSubmissionStatusMeta, getSubmissionVersionLabel } from './submissionViewerMeta'

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

function getSubmissionGroups(task) {
  const submissions = Array.isArray(task?.submissions) ? task.submissions : []
  const currentDraft = submissions.find((item) => item?.status === 'draft') || null
  const submittedHistory = submissions.filter((item) => item?.status !== 'draft')
  return {
    currentDraft,
    submittedHistory,
    latestSubmitted: submittedHistory[0] || null,
  }
}

export default function StudentAssignmentDetailModal({ visible = false, assignmentId = null, learnerId = '', onClose, onChanged }) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submissionTask, setSubmissionTask] = useState(null)
  const [viewerState, setViewerState] = useState({ open: false, loading: false, error: '', data: null, submissionId: null })

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

  async function openSubmissionViewer(submission) {
    const submissionId = Number(submission?.id || 0) || 0
    if (!submissionId || !learnerId) return
    setViewerState({ open: true, loading: true, error: '', data: null, submissionId })
    try {
      const data = await getStudentSubmissionVersionDetail(submissionId, { learnerId })
      setViewerState({ open: true, loading: false, error: '', data, submissionId })
    } catch (requestError) {
      setViewerState({ open: true, loading: false, error: getApiMessage(requestError, 'Không thể tải nội dung bài đã nộp.'), data: null, submissionId })
    }
  }

  function closeSubmissionViewer() {
    if (viewerState.loading) return
    setViewerState({ open: false, loading: false, error: '', data: null, submissionId: null })
  }

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
                        {(() => {
                          const { currentDraft, submittedHistory, latestSubmitted } = getSubmissionGroups(task)
                          const latestStatusMeta = latestSubmitted ? getSubmissionStatusMeta(latestSubmitted.status) : null
                          const canCreateNewVersion = detail?.status === 'published' && !currentDraft

                          return (
                            <div className='d-flex flex-column gap-3'>
                              <CCard className='border-0 shadow-sm bg-body-tertiary'>
                                <CCardHeader className='bg-transparent'><strong>Nộp bài</strong></CCardHeader>
                                <CCardBody className='d-flex flex-column gap-3'>
                                  {currentDraft ? (
                                    <div className='border rounded-3 p-3 bg-white'>
                                      <div className='fw-semibold mb-1'>Bản nháp hiện tại</div>
                                      <div className='small text-body-secondary'>{getSubmissionVersionLabel(currentDraft.version)} đang được soạn và chưa nộp.</div>
                                    </div>
                                  ) : null}
                                  {!currentDraft && !latestSubmitted ? <div className='small text-body-secondary'>Bạn chưa có bài nộp cho task này.</div> : null}
                                  <div className='d-flex gap-2 flex-wrap'>
                                    {!latestSubmitted && !currentDraft ? <CButton size='sm' color='primary' onClick={() => { setSubmitError(''); setSubmissionTask(task) }}>Nộp bài</CButton> : null}
                                    {currentDraft ? <CButton size='sm' color='primary' onClick={() => { setSubmitError(''); setSubmissionTask(task) }}>Tiếp tục soạn</CButton> : null}
                                    {latestSubmitted ? <CButton size='sm' color='secondary' variant='outline' onClick={() => openSubmissionViewer(latestSubmitted)}>Xem bài đã nộp</CButton> : null}
                                    {latestSubmitted && canCreateNewVersion ? <CButton size='sm' color='primary' onClick={() => { setSubmitError(''); setSubmissionTask(task) }}>Nộp phiên bản mới</CButton> : null}
                                  </div>
                                </CCardBody>
                              </CCard>

                              {latestSubmitted ? (
                                <CCard className='border-0 shadow-sm' style={{ background: '#fcfcfd' }}>
                                  <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                                    <strong>Bài đã nộp</strong>
                                    <CBadge color={latestStatusMeta?.color || 'warning'}>{latestStatusMeta?.label || 'Đã nộp'}</CBadge>
                                  </CCardHeader>
                                  <CCardBody className='d-flex flex-column gap-3'>
                                    <div>
                                      <div className='small text-body-secondary mb-1'>Lần nộp gần nhất</div>
                                      <div className='fw-semibold'>{getSubmissionVersionLabel(latestSubmitted.version)}</div>
                                    </div>
                                    <div className='d-grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                                      <div className='border rounded-3 p-3'>
                                        <div className='small text-body-secondary mb-1'>Nộp lúc</div>
                                        <div className='fw-semibold'>{formatSessionDateTime(latestSubmitted.submittedAt)}</div>
                                      </div>
                                      <div className='border rounded-3 p-3'>
                                        <div className='small text-body-secondary mb-1'>Trạng thái</div>
                                        <div className='fw-semibold'>{latestStatusMeta?.label || 'Đã nộp'}</div>
                                      </div>
                                    </div>
                                    <div>
                                      <CButton size='sm' color='secondary' variant='outline' onClick={() => openSubmissionViewer(latestSubmitted)}>Xem nội dung đã nộp</CButton>
                                    </div>
                                  </CCardBody>
                                </CCard>
                              ) : null}

                              {submittedHistory.length > 1 ? (
                                <CCard className='border-0 shadow-sm'>
                                  <CCardHeader><strong>Lịch sử nộp bài</strong></CCardHeader>
                                  <CCardBody className='d-flex flex-column gap-3'>
                                    {submittedHistory.map((submission) => {
                                      const statusMeta = getSubmissionStatusMeta(submission.status)
                                      return (
                                        <div key={submission.id} className='border rounded-3 p-3 d-flex justify-content-between align-items-center gap-3 flex-wrap'>
                                          <div className='d-flex flex-column gap-1'>
                                            <div className='fw-semibold'>{getSubmissionVersionLabel(submission.version)}</div>
                                            <div className='small text-body-secondary'>{`${formatSessionDateTime(submission.submittedAt)} · ${statusMeta.label}`}</div>
                                          </div>
                                          <CButton size='sm' color='secondary' variant='outline' onClick={() => openSubmissionViewer(submission)}>Xem</CButton>
                                        </div>
                                      )
                                    })}
                                  </CCardBody>
                                </CCard>
                              ) : null}
                            </div>
                          )
                        })()}
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

      <CModal visible={viewerState.open} onClose={closeSubmissionViewer} size='xl'>
        <CModalHeader>
          <CModalTitle>{viewerState?.data?.submission ? `Bài đã nộp - ${getSubmissionVersionLabel(viewerState.data.submission.version)}` : 'Bài đã nộp'}</CModalTitle>
        </CModalHeader>
        <CModalBody className='d-flex flex-column gap-3' style={{ background: '#f7f8fa' }}>
          {viewerState.error ? <CAlert color='danger'>{viewerState.error}</CAlert> : null}
          {viewerState.loading ? <div className='text-center py-4'><CSpinner color='primary' /></div> : <SubmissionViewer submission={viewerState?.data?.submission || null} />}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeSubmissionViewer}>Đóng</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}