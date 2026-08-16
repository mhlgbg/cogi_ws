import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert } from '@coreui/react'
import SportsClubForm from '../components/SportsClubForm'
import { createSportsClub, getSportsClubApiMessage } from '../services/sportsClubService'

export default function SportsClubCreatePage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/clubs` : '/sports/clubs'

  async function handleSubmit(payload) {
    setSubmitting(true)
    setSubmitError('')
    try {
      const created = await createSportsClub(payload)
      navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/clubs/${created?.id || created?.documentId}` : `/sports/clubs/${created?.id || created?.documentId}`, {
        replace: true,
        state: { message: 'Đã tạo câu lạc bộ thể thao.' },
      })
    } catch (requestError) {
      setSubmitError(getSportsClubApiMessage(requestError, 'Không thể tạo câu lạc bộ thể thao.'))
      throw requestError
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className='mb-4'>
        <div className='fs-5 fw-semibold'>Thêm câu lạc bộ thể thao</div>
        <div className='text-body-secondary'>Tạo club, team, chapter hoặc cộng đồng thể thao trong tenant hiện tại.</div>
      </div>
      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      <SportsClubForm initialValues={{}} submitting={submitting} submitError='' onCancel={() => navigate(listPath)} onSubmit={handleSubmit} />
    </div>
  )
}