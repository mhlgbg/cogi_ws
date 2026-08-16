import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert } from '@coreui/react'
import SportsProfileForm from '../components/SportsProfileForm'
import { createSportsProfile, getSportsProfileApiMessage } from '../services/sportsProfileService'

export default function SportsProfileCreatePage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/profiles` : '/sports/profiles'

  async function handleSubmit(payload) {
    setSubmitting(true)
    setSubmitError('')
    try {
      const created = await createSportsProfile(payload)
      navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/profiles/${created?.id || created?.documentId}` : `/sports/profiles/${created?.id || created?.documentId}`, {
        replace: true,
        state: { message: 'Đã tạo hồ sơ thể thao.' },
      })
    } catch (requestError) {
      setSubmitError(getSportsProfileApiMessage(requestError, 'Không thể tạo hồ sơ thể thao.'))
      throw requestError
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className='mb-4'>
        <div className='fs-5 fw-semibold'>Thêm hồ sơ thể thao</div>
        <div className='text-body-secondary'>Tạo hồ sơ thể thao cho một cá nhân trong tenant hiện tại. Hồ sơ có thể chưa gắn User.</div>
      </div>
      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      <SportsProfileForm initialValues={{}} submitting={submitting} submitError='' onCancel={() => navigate(listPath)} onSubmit={handleSubmit} />
    </div>
  )
}