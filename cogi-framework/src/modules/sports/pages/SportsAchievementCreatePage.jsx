import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CButton } from '@coreui/react'
import SportsAchievementForm from '../components/SportsAchievementForm'
import { createSportsAchievement, getSportsAchievementApiMessage } from '../services/sportsAchievementService'

export default function SportsAchievementCreatePage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/achievements` : '/sports/achievements'

  async function handleSubmit(payload) {
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await createSportsAchievement(payload)
      navigate(`${listPath}/${result.id}`, { replace: true, state: { message: 'Đã tạo achievement.' } })
    } catch (requestError) {
      setSubmitError(getSportsAchievementApiMessage(requestError, 'Không thể tạo achievement.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>Tạo Sports Achievement</div>
          <div className='text-body-secondary'>Tạo trực tiếp một achievement đã được ghi nhận. Flow này dành cho correction/import trong tenant admin.</div>
        </div>
        <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)} disabled={submitting}>Quay lại danh sách</CButton>
      </div>
      <SportsAchievementForm initialValues={null} submitting={submitting} submitError={submitError} onCancel={() => navigate(listPath)} onSubmit={handleSubmit} />
    </div>
  )
}
