import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CFormInput, CFormLabel, CFormTextarea, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow, CSpinner } from '@coreui/react'
import SportsAchievementSubmissionForm from '../components/SportsAchievementSubmissionForm'
import {
  cancelSportsAchievementSubmission,
  getSportsAchievementSubmission,
  getSportsAchievementSubmissionApiMessage,
  rejectSportsAchievementSubmission,
  submitSportsAchievementSubmission,
  updateSportsAchievementSubmission,
  verifySportsAchievementSubmission,
} from '../services/sportsAchievementSubmissionService'
import { formatSportsDateTime, getAchievementTypeLabel, getSportTypeLabel, getSubmissionSourceLabel, getSubmissionStatusMeta, getUserLabel } from '../utils/sportsAchievementUi'

function InfoCard({ label, value }) {
  return (
    <CCard className='h-100'>
      <CCardBody>
        <div className='small text-body-secondary'>{label}</div>
        <div className='fw-semibold'>{value || '-'}</div>
      </CCardBody>
    </CCard>
  )
}

export default function SportsAchievementSubmissionDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id, tenantCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [submission, setSubmission] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(location.state?.message || '')
  const [reviewModal, setReviewModal] = useState({ visible: false, action: '', note: '' })

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/achievement-submissions` : '/sports/achievement-submissions'
  const achievementPath = submission?.achievement?.id ? (tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/achievements/${submission.achievement.id}` : `/sports/achievements/${submission.achievement.id}`) : null

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getSportsAchievementSubmission(id)
        if (!mounted) return
        setSubmission(result || null)
      } catch (requestError) {
        if (!mounted) return
        setSubmission(null)
        setError(getSportsAchievementSubmissionApiMessage(requestError, 'Không tải được submission.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  async function handleUpdate(payload) {
    setSubmitting(true)
    setSubmitError('')
    try {
      const updated = await updateSportsAchievementSubmission(id, payload)
      setSubmission(updated)
      setEditing(false)
      setSuccess('Đã cập nhật submission.')
    } catch (requestError) {
      setSubmitError(getSportsAchievementSubmissionApiMessage(requestError, 'Không thể cập nhật submission.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitAction() {
    setSubmitting(true)
    setSubmitError('')
    try {
      const updated = await submitSportsAchievementSubmission(id)
      setSubmission(updated)
      setSuccess('Đã gửi submission.')
    } catch (requestError) {
      setSubmitError(getSportsAchievementSubmissionApiMessage(requestError, 'Không thể gửi submission.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancelAction() {
    setSubmitting(true)
    setSubmitError('')
    try {
      const updated = await cancelSportsAchievementSubmission(id)
      setSubmission(updated)
      setSuccess('Đã hủy submission.')
    } catch (requestError) {
      setSubmitError(getSportsAchievementSubmissionApiMessage(requestError, 'Không thể hủy submission.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReviewAction() {
    setSubmitting(true)
    setSubmitError('')
    try {
      const payload = { reviewNote: reviewModal.note || null }
      const updated = reviewModal.action === 'verify'
        ? await verifySportsAchievementSubmission(id, payload)
        : await rejectSportsAchievementSubmission(id, payload)
      setSubmission(updated)
      setReviewModal({ visible: false, action: '', note: '' })
      setSuccess(reviewModal.action === 'verify' ? 'Đã verify submission và tạo achievement.' : 'Đã reject submission.')
    } catch (requestError) {
      setSubmitError(getSportsAchievementSubmissionApiMessage(requestError, reviewModal.action === 'verify' ? 'Không thể verify submission.' : 'Không thể reject submission.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải submission...</div>
  }

  if (!submission) {
    return (
      <div>
        <CAlert color='danger'>{error || 'Không tìm thấy submission.'}</CAlert>
        <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
      </div>
    )
  }

  const statusMeta = getSubmissionStatusMeta(submission.status)
  const canEdit = submission.status === 'draft' || submission.status === 'submitted'

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>{submission.title || 'Sports Achievement Submission'}</div>
          <div className='text-body-secondary'>{submission.sportsProfile?.fullName || '-'} · {submission.club?.name || '-'}</div>
          <div className='d-flex gap-2 mt-2 flex-wrap'>
            <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
            <CBadge color='info'>{getAchievementTypeLabel(submission.achievementType)}</CBadge>
          </div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
          {canEdit && !editing ? <CButton color='warning' variant='outline' onClick={() => setEditing(true)} disabled={submitting}>Chỉnh sửa</CButton> : null}
          {submission.status === 'draft' ? <CButton color='primary' onClick={handleSubmitAction} disabled={submitting}>Gửi submission</CButton> : null}
          {submission.status === 'submitted' ? <CButton color='success' onClick={() => setReviewModal({ visible: true, action: 'verify', note: submission.reviewNote || '' })} disabled={submitting}>Verify</CButton> : null}
          {submission.status === 'submitted' ? <CButton color='danger' variant='outline' onClick={() => setReviewModal({ visible: true, action: 'reject', note: submission.reviewNote || '' })} disabled={submitting}>Reject</CButton> : null}
          {(submission.status === 'draft' || submission.status === 'submitted') ? <CButton color='dark' variant='outline' onClick={handleCancelAction} disabled={submitting}>Cancel</CButton> : null}
          {achievementPath ? <CButton color='info' variant='outline' onClick={() => navigate(achievementPath)}>Mở achievement</CButton> : null}
        </div>
      </div>

      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      {editing ? (
        <SportsAchievementSubmissionForm initialValues={submission} submitting={submitting} submitError='' onCancel={() => setEditing(false)} onSubmit={handleUpdate} />
      ) : (
        <>
          <CRow className='g-3 mb-4'>
            <CCol md={4}><InfoCard label='Sports Profile' value={[submission.sportsProfile?.fullName, submission.sportsProfile?.code].filter(Boolean).join(' - ')} /></CCol>
            <CCol md={4}><InfoCard label='CLB' value={[submission.club?.name, submission.club?.code].filter(Boolean).join(' - ')} /></CCol>
            <CCol md={4}><InfoCard label='Môn' value={getSportTypeLabel(submission.sportType)} /></CCol>
            <CCol md={4}><InfoCard label='Nguồn đề nghị' value={getSubmissionSourceLabel(submission.source)} /></CCol>
            <CCol md={4}><InfoCard label='Achieved At' value={formatSportsDateTime(submission.achievedAt)} /></CCol>
            <CCol md={4}><InfoCard label='Submitted At' value={formatSportsDateTime(submission.submittedAt)} /></CCol>
            <CCol md={4}><InfoCard label='Reviewed At' value={formatSportsDateTime(submission.reviewedAt)} /></CCol>
            <CCol md={4}><InfoCard label='Submitted By' value={getUserLabel(submission.submittedBy)} /></CCol>
            <CCol md={4}><InfoCard label='Reviewed By' value={getUserLabel(submission.reviewedBy)} /></CCol>
            <CCol md={4}><InfoCard label='Result Value' value={submission.resultValue === null ? '-' : String(submission.resultValue)} /></CCol>
            <CCol md={4}><InfoCard label='Result Unit' value={submission.resultUnit || '-'} /></CCol>
            <CCol md={4}><InfoCard label='Result Text' value={submission.resultText || '-'} /></CCol>
            <CCol md={4}><InfoCard label='Achievement linked' value={submission.achievement?.title || '-'} /></CCol>
          </CRow>

          <CCard className='mb-4'>
            <CCardBody>
              <div className='small text-body-secondary mb-2'>Mô tả</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{submission.description || 'Không có.'}</div>
              <div className='small text-body-secondary mt-3 mb-2'>Review Note</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{submission.reviewNote || 'Không có.'}</div>
              <div className='small text-body-secondary mt-3 mb-2'>Ghi chú nội bộ</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{submission.note || 'Không có.'}</div>
            </CCardBody>
          </CCard>

          <CCard className='mb-4'>
            <CCardBody>
              <div className='small text-body-secondary mb-2'>Evidence</div>
              {submission.evidence.length === 0 ? <div className='text-body-secondary'>Chưa có evidence.</div> : (
                <div className='d-flex flex-column gap-2'>
                  {submission.evidence.map((item) => <a key={item.id} href={item.url} target='_blank' rel='noreferrer'>{item.name || item.url || `Media #${item.id}`}</a>)}
                </div>
              )}
            </CCardBody>
          </CCard>

          <CRow className='g-3'>
            <CCol md={6}><InfoCard label='Tạo lúc' value={formatSportsDateTime(submission.createdAt)} /></CCol>
            <CCol md={6}><InfoCard label='Cập nhật lúc' value={formatSportsDateTime(submission.updatedAt)} /></CCol>
          </CRow>
        </>
      )}

      <CModal visible={reviewModal.visible} onClose={() => !submitting && setReviewModal({ visible: false, action: '', note: '' })}>
        <CModalHeader>
          <CModalTitle>{reviewModal.action === 'verify' ? 'Verify submission' : 'Reject submission'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CFormLabel>Review Note</CFormLabel>
          <CFormTextarea rows={4} value={reviewModal.note} onChange={(event) => setReviewModal((current) => ({ ...current, note: event.target.value }))} disabled={submitting} />
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setReviewModal({ visible: false, action: '', note: '' })} disabled={submitting}>Hủy</CButton>
          <CButton color={reviewModal.action === 'verify' ? 'success' : 'danger'} onClick={handleReviewAction} disabled={submitting}>{submitting ? 'Đang xử lý...' : (reviewModal.action === 'verify' ? 'Verify' : 'Reject')}</CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}
