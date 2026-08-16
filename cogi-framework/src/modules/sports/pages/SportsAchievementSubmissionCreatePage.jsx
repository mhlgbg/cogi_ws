import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CButton } from '@coreui/react'
import SportsAchievementSubmissionForm from '../components/SportsAchievementSubmissionForm'
import { createSportsAchievementSubmission, getSportsAchievementSubmissionApiMessage } from '../services/sportsAchievementSubmissionService'

export default function SportsAchievementSubmissionCreatePage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/achievement-submissions` : '/sports/achievement-submissions'

  async function handleSubmit(payload) {
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await createSportsAchievementSubmission(payload)
      navigate(`${listPath}/${result.id}`, { replace: true, state: { message: 'Đã tạo submission.' } })
    } catch (requestError) {
      setSubmitError(getSportsAchievementSubmissionApiMessage(requestError, 'Không thể tạo submission.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>Tạo Sports Achievement Submission</div>
          <div className='text-body-secondary'>Mọi đề nghị thành tích mới đều đi qua Submission trước khi có Achievement đã được ghi nhận.</div>
        </div>
        <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)} disabled={submitting}>Quay lại danh sách</CButton>
      </div>
      <SportsAchievementSubmissionForm initialValues={null} submitting={submitting} submitError={submitError} onCancel={() => navigate(listPath)} onSubmit={handleSubmit} />
    </div>
  )
}
