import { useNavigate, useParams } from 'react-router-dom'
import { CAlert } from '@coreui/react'
import TenantSettingsLayout from '../components/TenantSettingsLayout'
import PaymentProfileForm from '../components/PaymentProfileForm'
import { createPaymentProfile } from '../services/paymentProfileService'
import { getPaymentProfileApiMessage } from '../utils/paymentProfileUi'
import { useState } from 'react'

export default function TenantPaymentProfileCreatePage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/tenant/settings/payment-profiles` : '/tenant/settings/payment-profiles'

  async function handleSubmit(payload) {
    setSubmitting(true)
    setSubmitError('')
    try {
      const created = await createPaymentProfile(payload)
      navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/tenant/settings/payment-profiles/${created?.id || created?.documentId}` : `/tenant/settings/payment-profiles/${created?.id || created?.documentId}`, {
        replace: true,
        state: { message: 'Đã tạo hồ sơ thanh toán.' },
      })
    } catch (requestError) {
      setSubmitError(getPaymentProfileApiMessage(requestError, 'Không thể tạo hồ sơ thanh toán.'))
      throw requestError
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <TenantSettingsLayout activeTab='payment-profiles' pageTitle='Hồ sơ thanh toán' pageDescription='Tạo hồ sơ thanh toán mới cho tenant hiện tại.'>
      <div className='mb-4'>
        <div className='fs-5 fw-semibold'>Thêm hồ sơ thanh toán</div>
        <div className='text-body-secondary'>Tạo hồ sơ dùng chung để lưu tài khoản nhận tiền, hướng dẫn thanh toán và mã QR tĩnh.</div>
      </div>
      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      <PaymentProfileForm initialValues={{}} submitting={submitting} submitError='' onCancel={() => navigate(listPath)} onSubmit={handleSubmit} />
    </TenantSettingsLayout>
  )
}