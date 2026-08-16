import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CRow, CSpinner } from '@coreui/react'
import SportsProfileForm from '../components/SportsProfileForm'
import SportsProfileLinkUserModal from '../components/SportsProfileLinkUserModal'
import {
  activateSportsProfile,
  deactivateSportsProfile,
  getSportsProfile,
  getSportsProfileApiMessage,
  unlinkSportsProfileUser,
  updateSportsProfile,
} from '../services/sportsProfileService'
import {
  formatSportsBirthDate,
  formatSportsBirthDateOrYear,
  formatSportsDateTime,
  getLinkedUserLabel,
  getSportsProfileGenderLabel,
  getSportsProfileSourceLabel,
  getSportsProfileStatusMeta,
} from '../utils/sportsProfileUi'

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

export default function SportsProfileDetailPage() {
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
  const [showLinkUserModal, setShowLinkUserModal] = useState(false)

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/profiles` : '/sports/profiles'

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const result = await getSportsProfile(id)
        if (!mounted) return
        setProfile(result || null)
      } catch (requestError) {
        if (!mounted) return
        setProfile(null)
        setError(getSportsProfileApiMessage(requestError, 'Không tải được chi tiết hồ sơ thể thao.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    setLoading(true)
    setError('')
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
      const updated = await updateSportsProfile(id, payload)
      setProfile(updated)
      setEditing(false)
      setSuccess('Đã cập nhật hồ sơ thể thao.')
    } catch (requestError) {
      setSubmitError(getSportsProfileApiMessage(requestError, 'Không thể cập nhật hồ sơ thể thao.'))
      throw requestError
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(nextActive) {
    const confirmed = window.confirm(nextActive
      ? 'Kích hoạt lại hồ sơ thể thao này?'
      : 'Chuyển hồ sơ thể thao này sang trạng thái ngưng hoạt động?')
    if (!confirmed) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const updated = nextActive ? await activateSportsProfile(id) : await deactivateSportsProfile(id)
      setProfile(updated)
      setSuccess(nextActive ? 'Đã kích hoạt hồ sơ thể thao.' : 'Đã ngưng hoạt động hồ sơ thể thao.')
    } catch (requestError) {
      setSubmitError(getSportsProfileApiMessage(requestError, nextActive ? 'Không thể kích hoạt hồ sơ.' : 'Không thể ngưng hoạt động hồ sơ.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnlinkUser() {
    const confirmed = window.confirm('Gỡ liên kết User khỏi Sports Profile?\n\nViệc này không xóa tài khoản User, hồ sơ thể thao, membership hay thành tích.')
    if (!confirmed) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const updated = await unlinkSportsProfileUser(id)
      setProfile(updated)
      setSuccess('Đã gỡ liên kết User khỏi hồ sơ thể thao.')
    } catch (requestError) {
      setSubmitError(getSportsProfileApiMessage(requestError, 'Không thể gỡ liên kết User khỏi hồ sơ thể thao.'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleLinkedUserSaved(updatedProfile) {
    setProfile(updatedProfile)
    setShowLinkUserModal(false)
    setSuccess('Đã liên kết User với hồ sơ thể thao.')
  }

  if (loading) {
    return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết hồ sơ thể thao...</div>
  }

  if (!profile) {
    return (
      <div>
        <CAlert color='danger'>{error || 'Không tìm thấy hồ sơ thể thao.'}</CAlert>
        <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
      </div>
    )
  }

  const statusMeta = getSportsProfileStatusMeta(profile.status)

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>{profile.fullName || '-'}</div>
          <div className='text-body-secondary'>{profile.code || '-'}</div>
          <div className='d-flex gap-2 mt-2 flex-wrap'>
            <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
            <CBadge color='info'>{profile.user?.id ? 'Đã liên kết User' : 'Chưa liên kết User'}</CBadge>
          </div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
          {!editing ? <CButton color='warning' variant='outline' onClick={() => setEditing(true)} disabled={submitting}>Chỉnh sửa</CButton> : null}
          {profile.status === 'active'
            ? <CButton color='warning' onClick={() => handleToggleActive(false)} disabled={submitting}>Ngưng hoạt động</CButton>
            : profile.status !== 'merged'
              ? <CButton color='success' onClick={() => handleToggleActive(true)} disabled={submitting}>Kích hoạt</CButton>
              : null}
        </div>
      </div>

      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      {editing ? (
        <SportsProfileForm initialValues={profile} submitting={submitting} submitError='' onCancel={() => setEditing(false)} onSubmit={handleUpdate} />
      ) : (
        <>
          <CRow className='g-3 mb-4'>
            <CCol md={3}><InfoCard label='Mã hồ sơ' value={profile.code} /></CCol>
            <CCol md={3}><InfoCard label='Tên hiển thị' value={profile.displayName || '-'} /></CCol>
            <CCol md={3}><InfoCard label='Giới tính' value={getSportsProfileGenderLabel(profile.gender)} /></CCol>
            <CCol md={3}><InfoCard label={profile.dateOfBirth ? 'Ngày sinh' : (profile.birthYear ? 'Năm sinh' : 'Ngày sinh')} value={profile.dateOfBirth ? formatSportsBirthDate(profile.dateOfBirth) : (profile.birthYear ? String(profile.birthYear) : 'Chưa có thông tin')} /></CCol>
          </CRow>
          <CRow className='g-3 mb-4'>
            <CCol md={4}><InfoCard label='Quê quán' value={profile.hometown || '-'} /></CCol>
            <CCol md={4}><InfoCard label='Điện thoại liên hệ' value={profile.contactPhone || '-'} /></CCol>
            <CCol md={4}><InfoCard label='Email liên hệ' value={profile.contactEmail || '-'} /></CCol>
          </CRow>
          <CRow className='g-3 mb-4'>
            <CCol md={4}><InfoCard label='Nguồn tạo' value={getSportsProfileSourceLabel(profile.source)} /></CCol>
            <CCol md={8}><InfoCard label='Tham chiếu nguồn' value={profile.sourceReference || '-'} /></CCol>
          </CRow>
          <CRow className='g-3 mb-4'>
            <CCol md={4}>
              <CCard className='h-100'>
                <CCardBody>
                  <div className='small text-body-secondary mb-2'>Avatar</div>
                  {profile.avatar?.url ? <img src={profile.avatar.url} alt={profile.fullName || profile.code} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12 }} /> : <div className='text-body-secondary'>Chưa có avatar</div>}
                </CCardBody>
              </CCard>
            </CCol>
            <CCol md={8}>
              <CCard className='h-100'>
                <CCardBody>
                  <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
                    <div>
                      <div className='small text-body-secondary mb-2'>User liên kết</div>
                      <div className='fw-semibold'>{getLinkedUserLabel(profile.user)}</div>
                      {profile.user?.id ? (
                        <div className='small text-body-secondary mt-2'>
                          <div>{profile.user?.username || '-'}</div>
                          <div>{profile.user?.email || '-'}</div>
                          <div>{profile.user?.phone || '-'}</div>
                        </div>
                      ) : null}
                    </div>
                    <div className='d-flex gap-2 flex-wrap'>
                      {!profile.user?.id ? (
                        <CButton color='primary' onClick={() => setShowLinkUserModal(true)} disabled={submitting || profile.status === 'merged'}>Liên kết User</CButton>
                      ) : (
                        <CButton color='danger' variant='outline' onClick={handleUnlinkUser} disabled={submitting}>Gỡ liên kết</CButton>
                      )}
                    </div>
                  </div>
                  <div className='small text-body-secondary mt-3 mb-2'>Giới thiệu</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{profile.bio || 'Chưa có mô tả.'}</div>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
          <CRow className='g-3'>
            <CCol md={6}><InfoCard label='Tạo lúc' value={formatSportsDateTime(profile.createdAt)} /></CCol>
            <CCol md={6}><InfoCard label='Cập nhật lúc' value={formatSportsDateTime(profile.updatedAt)} /></CCol>
          </CRow>
        </>
      )}

      <SportsProfileLinkUserModal
        visible={showLinkUserModal}
        profile={profile}
        onClose={() => setShowLinkUserModal(false)}
        onLinked={handleLinkedUserSaved}
      />
    </div>
  )
}