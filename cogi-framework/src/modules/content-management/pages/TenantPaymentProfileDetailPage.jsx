import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CRow, CSpinner } from '@coreui/react'
import TenantSettingsLayout from '../components/TenantSettingsLayout'
import PaymentProfileForm from '../components/PaymentProfileForm'
import {
  activatePaymentProfile,
  deactivatePaymentProfile,
  getPaymentProfile,
  setDefaultPaymentProfile,
  updatePaymentProfile,
} from '../services/paymentProfileService'
import {
  getPaymentProfileApiMessage,
  getPaymentProfileMethodLabel,
  getPaymentProfileReceiverSummary,
  getPaymentProfileStatusMeta,
} from '../utils/paymentProfileUi'

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

export default function TenantPaymentProfileDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id, tenantCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(location.state?.message || '')

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/tenant/settings/payment-profiles` : '/tenant/settings/payment-profiles'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getPaymentProfile(id)
        if (!mounted) return
        setProfile(result || null)
      } catch (requestError) {
        if (!mounted) return
        setProfile(null)
        setError(getPaymentProfileApiMessage(requestError, 'Không tải được chi tiết hồ sơ thanh toán.'))
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
      const updated = await updatePaymentProfile(id, payload)
      setProfile(updated)
      setEditing(false)
      setSuccess('Đã cập nhật hồ sơ thanh toán.')
    } catch (requestError) {
      setSubmitError(getPaymentProfileApiMessage(requestError, 'Không thể cập nhật hồ sơ thanh toán.'))
      throw requestError
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSetDefault() {
    setSubmitting(true)
    setSubmitError('')
    try {
      const updated = await setDefaultPaymentProfile(id)
      setProfile(updated)
      setSuccess('Đã đặt hồ sơ thanh toán làm mặc định.')
    } catch (requestError) {
      setSubmitError(getPaymentProfileApiMessage(requestError, 'Không thể đặt hồ sơ mặc định.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(nextActive) {
    const confirmed = window.confirm(nextActive
      ? 'Kích hoạt lại hồ sơ thanh toán này?'
      : 'Ngừng sử dụng hồ sơ thanh toán này? Hồ sơ sẽ không còn được chọn cho các nghiệp vụ mới.')
    if (!confirmed) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const updated = nextActive ? await activatePaymentProfile(id) : await deactivatePaymentProfile(id)
      setProfile(updated)
      setSuccess(nextActive ? 'Đã kích hoạt hồ sơ thanh toán.' : 'Đã ngừng sử dụng hồ sơ thanh toán.')
    } catch (requestError) {
      setSubmitError(getPaymentProfileApiMessage(requestError, nextActive ? 'Không thể kích hoạt hồ sơ.' : 'Không thể ngừng sử dụng hồ sơ.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <TenantSettingsLayout activeTab='payment-profiles' pageTitle='Hồ sơ thanh toán' pageDescription='Đang tải chi tiết hồ sơ thanh toán.'>
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết hồ sơ thanh toán...</div>
      </TenantSettingsLayout>
    )
  }

  if (!profile) {
    return (
      <TenantSettingsLayout activeTab='payment-profiles' pageTitle='Hồ sơ thanh toán' pageDescription='Không tìm thấy hồ sơ thanh toán.'>
        <CAlert color='danger'>{error || 'Không tìm thấy hồ sơ thanh toán.'}</CAlert>
        <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
      </TenantSettingsLayout>
    )
  }

  const statusMeta = getPaymentProfileStatusMeta(profile)

  return (
    <TenantSettingsLayout activeTab='payment-profiles' pageTitle='Hồ sơ thanh toán' pageDescription='Xem và cập nhật chi tiết hồ sơ thanh toán của tenant hiện tại.'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>{profile.name || '-'}</div>
          <div className='text-body-secondary'>{profile.code || '-'}</div>
          <div className='d-flex gap-2 mt-2 flex-wrap'>
            <CBadge color={statusMeta.activeColor}>{statusMeta.activeLabel}</CBadge>
            <CBadge color={statusMeta.defaultColor}>{statusMeta.defaultLabel}</CBadge>
          </div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
          {!editing ? <CButton color='warning' variant='outline' onClick={() => setEditing(true)} disabled={submitting}>Chỉnh sửa</CButton> : null}
          {!profile.isDefault ? <CButton color='primary' variant='outline' onClick={handleSetDefault} disabled={submitting || !profile.isActive}>Đặt làm mặc định</CButton> : null}
          {profile.isActive ? <CButton color='warning' onClick={() => handleToggleActive(false)} disabled={submitting}>Ngừng sử dụng</CButton> : <CButton color='success' onClick={() => handleToggleActive(true)} disabled={submitting}>Kích hoạt</CButton>}
        </div>
      </div>

      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      {editing ? (
        <PaymentProfileForm initialValues={profile} submitting={submitting} submitError='' onCancel={() => setEditing(false)} onSubmit={handleUpdate} />
      ) : (
        <>
          <CRow className='g-3 mb-4'>
            <CCol md={3} sm={6}><InfoCard label='Mã hồ sơ' value={profile.code} /></CCol>
            <CCol md={3} sm={6}><InfoCard label='Phương thức' value={getPaymentProfileMethodLabel(profile.paymentMethod)} /></CCol>
            <CCol md={3} sm={6}><InfoCard label='Loại tiền' value={profile.currency} /></CCol>
            <CCol md={3} sm={6}><InfoCard label='Thứ tự hiển thị' value={String(profile.sortOrder ?? 0)} /></CCol>
          </CRow>
          <CRow className='g-3 mb-4'>
            <CCol md={6}><InfoCard label='Tài khoản nhận' value={getPaymentProfileReceiverSummary(profile)} /></CCol>
            <CCol md={6}><InfoCard label='Email hỗ trợ' value={profile.supportEmail || '-'} /></CCol>
          </CRow>
          <CRow className='g-3 mb-4'>
            <CCol md={6}><InfoCard label='Điện thoại hỗ trợ' value={profile.supportPhone || '-'} /></CCol>
            <CCol md={6}><InfoCard label='Chi nhánh' value={profile.bankBranch || '-'} /></CCol>
          </CRow>
          <CCard className='mb-4'>
            <CCardBody>
              <div className='small text-body-secondary mb-2'>Mô tả</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{profile.description || 'Chưa có mô tả.'}</div>
            </CCardBody>
          </CCard>
          <CCard className='mb-4'>
            <CCardBody>
              <div className='small text-body-secondary mb-2'>Mẫu nội dung chuyển khoản</div>
              <div>{profile.transferContentTemplate || '-'}</div>
              <div className='small text-body-secondary mt-3 mb-2'>Hướng dẫn thanh toán</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{profile.paymentInstruction || 'Chưa có hướng dẫn.'}</div>
            </CCardBody>
          </CCard>
          <CCard className='mb-4'>
            <CCardBody>
              <div className='small text-body-secondary mb-2'>Mã QR</div>
              {profile.qrImage?.url ? <img src={profile.qrImage.url} alt='QR preview' style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }} /> : <div className='text-body-secondary'>Chưa có ảnh QR.</div>}
            </CCardBody>
          </CCard>
          <CRow className='g-3'>
            <CCol md={6}><InfoCard label='Tạo lúc' value={profile.createdAt || '-'} /></CCol>
            <CCol md={6}><InfoCard label='Cập nhật lúc' value={profile.updatedAt || '-'} /></CCol>
          </CRow>
        </>
      )}
    </TenantSettingsLayout>
  )
}