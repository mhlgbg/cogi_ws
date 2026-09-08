import { useEffect, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CFormInput, CFormLabel, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { getFileAssetUrl } from '../../learning-management/utils/questionBankUi'
import { getTeacherAssignmentDetail, getTeacherAssignmentLearnerTaskDetail, publishTeacherAssignment, closeTeacherAssignment, cancelTeacherAssignment, reviewTeacherAssignmentLearnerTask, updateTeacherAssignment } from '../services/classService'
import { sanitizeClassSessionContentHtml } from '../utils/classSessionContentHtml'
import { formatSessionDateTime } from '../utils/classSessionUi'
import TeacherAssignmentEditorModal from './TeacherAssignmentEditorModal'

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

export default function TeacherAssignmentDetailModal({ visible = false, assignmentId = null, onClose, onChanged }) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewDetail, setReviewDetail] = useState(null)
  const [reviewError, setReviewError] = useState('')
  const [reviewForm, setReviewForm] = useState({ status: 'completed', teacherFeedback: '<p></p>', score: '', maxScore: '' })

  async function load() {
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
  }

  useEffect(() => {
    if (!visible) return
    load()
  }, [assignmentId, visible])

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

  async function openReview(taskId, learnerId) {
    setReviewOpen(true)
    setReviewLoading(true)
    setReviewError('')
    try {
      const payload = await getTeacherAssignmentLearnerTaskDetail(assignmentId, taskId, learnerId)
      setReviewDetail(payload)
      setReviewForm({
        status: payload?.progress?.status === 'returned' ? 'returned' : 'completed',
        teacherFeedback: payload?.progress?.teacherFeedback || '<p></p>',
        score: payload?.progress?.score ?? '',
        maxScore: payload?.progress?.maxScore ?? '',
      })
    } catch (requestError) {
      setReviewDetail(null)
      setReviewError(getApiMessage(requestError, 'Không thể tải chi tiết learner/task.'))
    } finally {
      setReviewLoading(false)
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
                <CCardHeader><strong>Tasks</strong></CCardHeader>
                <CCardBody className='d-flex flex-column gap-3'>
                  {(detail.tasks || []).map((task) => (
                    <div key={task.id} className='border rounded-3 p-3'>
                      <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                        <div className='fw-semibold'>{task.title}</div>
                        <div className='small text-body-secondary'>{task.taskType} · {task.required ? 'Bắt buộc' : 'Tùy chọn'}</div>
                      </div>
                      <HtmlView value={task.description} />
                    </div>
                  ))}
                </CCardBody>
              </CCard>

              <CCard className='border-0 shadow-sm'>
                <CCardHeader><strong>Tiến độ learner</strong></CCardHeader>
                <CCardBody>
                  <CTable hover responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Học sinh</CTableHeaderCell>
                        {(detail.tasks || []).map((task) => <CTableHeaderCell key={`task-head-${task.id}`}>{task.title}</CTableHeaderCell>)}
                        <CTableHeaderCell>Tổng</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {(detail.learners || []).length === 0 ? (
                        <CTableRow><CTableDataCell colSpan={(detail.tasks || []).length + 2} className='text-center text-body-secondary'>Chưa có learner progress.</CTableDataCell></CTableRow>
                      ) : (detail.learners || []).map((row) => (
                        <CTableRow key={row?.learner?.id || Math.random()}>
                          <CTableDataCell>{row?.learner?.fullName || row?.learner?.code || '-'}</CTableDataCell>
                          {(row.tasks || []).map((taskCell) => {
                            const meta = STATUS_META[taskCell.status] || STATUS_META.assigned
                            return (
                              <CTableDataCell key={`task-cell-${row?.learner?.id}-${taskCell.taskId}`}>
                                <CButton size='sm' color={meta.color} variant='outline' onClick={() => openReview(taskCell.taskId, row?.learner?.id)}>{meta.label}</CButton>
                              </CTableDataCell>
                            )
                          })}
                          <CTableDataCell>{row.completedCount || 0}/{detail.taskCount || 0}</CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
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

      <CModal visible={reviewOpen} onClose={() => !actionLoading && setReviewOpen(false)} size='xl'>
        <CModalHeader><CModalTitle>Review task của learner</CModalTitle></CModalHeader>
        <CModalBody>
          {reviewError ? <CAlert color='danger'>{reviewError}</CAlert> : null}
          {reviewLoading ? <div className='text-center py-4'><CSpinner color='primary' /></div> : reviewDetail ? (
            <div className='d-flex flex-column gap-3'>
              <div><strong>{reviewDetail?.learner?.fullName || reviewDetail?.learner?.code || '-'}</strong> · {reviewDetail?.task?.title || '-'}</div>
              <div>Trạng thái hiện tại: <CBadge color={(STATUS_META[reviewDetail?.progress?.status] || STATUS_META.assigned).color}>{(STATUS_META[reviewDetail?.progress?.status] || STATUS_META.assigned).label}</CBadge></div>
              {(reviewDetail.submissions || []).map((submission) => (
                <CCard key={submission.id} className='border-0 shadow-sm'>
                  <CCardHeader><strong>Version {submission.version}</strong> · <CBadge color={(STATUS_META[submission.status] || STATUS_META.draft).color}>{(STATUS_META[submission.status] || STATUS_META.draft).label}</CBadge></CCardHeader>
                  <CCardBody className='d-flex flex-column gap-2'>
                    {submission.comment ? <div><strong>Ghi chú:</strong> {submission.comment}</div> : null}
                    {(submission.items || []).map((item) => {
                      const assetUrl = item?.fileAsset ? getFileAssetUrl(item.fileAsset) : ''
                      return (
                        <div key={item.id} className='border rounded-3 p-3'>
                          <div className='fw-semibold mb-2'>{item.type.toUpperCase()} {item.caption ? `· ${item.caption}` : ''}</div>
                          {item.type === 'html' ? <HtmlView value={item.contentHtml} /> : null}
                          {item.type === 'link' && item.url ? <a href={item.url} target='_blank' rel='noreferrer'>{item.url}</a> : null}
                          {item.type === 'image' && assetUrl ? <img src={assetUrl} alt={item.caption || 'submission'} style={{ maxWidth: 240, borderRadius: 8 }} /> : null}
                          {item.type === 'audio' && assetUrl ? <audio controls preload='none' src={assetUrl} style={{ width: '100%' }} /> : null}
                          {item.type === 'video' && assetUrl ? <video controls preload='metadata' src={assetUrl} style={{ width: '100%', maxHeight: 260 }} /> : null}
                          {item.type === 'file' && assetUrl ? <a href={assetUrl} target='_blank' rel='noreferrer'>{item?.fileAsset?.originalName || item?.fileAsset?.fileName || 'Mở file'}</a> : null}
                        </div>
                      )
                    })}
                  </CCardBody>
                </CCard>
              ))}
              <div className='d-grid' style={{ gridTemplateColumns: 'minmax(180px, 220px) minmax(160px, 1fr) minmax(160px, 1fr)', gap: 16 }}>
                <div>
                  <CFormLabel>Kết quả review</CFormLabel>
                  <CFormSelect value={reviewForm.status} onChange={(event) => setReviewForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value='completed'>Hoàn thành</option>
                    <option value='returned'>Trả lại làm lại</option>
                  </CFormSelect>
                </div>
                <div>
                  <CFormLabel>Score</CFormLabel>
                  <CFormInput value={reviewForm.score} onChange={(event) => setReviewForm((prev) => ({ ...prev, score: event.target.value }))} />
                </div>
                <div>
                  <CFormLabel>Max score</CFormLabel>
                  <CFormInput value={reviewForm.maxScore} onChange={(event) => setReviewForm((prev) => ({ ...prev, maxScore: event.target.value }))} />
                </div>
              </div>
              <div>
                <CFormLabel>Feedback</CFormLabel>
                <CFormInput value={reviewForm.teacherFeedback} onChange={(event) => setReviewForm((prev) => ({ ...prev, teacherFeedback: event.target.value }))} />
              </div>
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setReviewOpen(false)} disabled={actionLoading === 'review'}>Đóng</CButton>
          <CButton color='primary' onClick={async () => {
            if (!reviewDetail?.task?.id || !reviewDetail?.learner?.id) return
            setActionLoading('review')
            setReviewError('')
            try {
              await reviewTeacherAssignmentLearnerTask(detail.id, reviewDetail.task.id, reviewDetail.learner.id, {
                status: reviewForm.status,
                teacherFeedback: reviewForm.teacherFeedback,
                score: reviewForm.score,
                maxScore: reviewForm.maxScore,
                submissionId: reviewDetail?.submissions?.[0]?.id,
              })
              setReviewOpen(false)
              await load()
              onChanged?.()
            } catch (requestError) {
              setReviewError(getApiMessage(requestError, 'Không thể review task.'))
            } finally {
              setActionLoading('')
            }
          }} disabled={actionLoading === 'review'}>{actionLoading === 'review' ? 'Đang lưu...' : 'Lưu review'}</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}