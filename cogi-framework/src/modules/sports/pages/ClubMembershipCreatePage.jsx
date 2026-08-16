import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert } from '@coreui/react'
import ClubMembershipForm from '../components/ClubMembershipForm'
import { createClubMembership, getClubMembershipApiMessage } from '../services/clubMembershipService'

export default function ClubMembershipCreatePage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/memberships` : '/sports/memberships'

  async function handleSubmit(payload) {
    setSubmitting(true)
    setSubmitError('')
    try {
      const created = await createClubMembership(payload)
      navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/memberships/${created?.id || created?.documentId}` : `/sports/memberships/${created?.id || created?.documentId}`, {
        replace: true,
        state: { message: 'Đã tạo club membership.' },
      })
    } catch (requestError) {
      setSubmitError(getClubMembershipApiMessage(requestError, 'Không thể tạo club membership.'))
      throw requestError
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className='mb-4'>
        <div className='fs-5 fw-semibold'>Thêm Club Membership</div>
        <div className='text-body-secondary'>Tạo quan hệ hiện tại giữa Sports Profile và Sports Club trong tenant hiện tại.</div>
      </div>
      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      <ClubMembershipForm initialValues={{}} submitting={submitting} submitError='' onCancel={() => navigate(listPath)} onSubmit={handleSubmit} />
    </div>
  )
}