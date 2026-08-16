import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CRow, CSpinner } from '@coreui/react'
import ClubMembershipForm from '../components/ClubMembershipForm'
import ClubMembershipHistorySection from '../components/ClubMembershipHistorySection'
import {
  activateClubMembership,
  deactivateClubMembership,
  getClubMembership,
  getClubMembershipApiMessage,
  leaveClubMembership,
  suspendClubMembership,
  updateClubMembership,
} from '../services/clubMembershipService'
import {
  formatSportsDate,
  formatSportsDateTime,
  getApprovedByLabel,
  getClubMembershipRoleLabel,
  getClubMembershipSourceLabel,
  getClubMembershipStatusMeta,
} from '../utils/clubMembershipUi'

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

export default function ClubMembershipDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id, tenantCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [membership, setMembership] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(location.state?.message || '')

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/memberships` : '/sports/memberships'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getClubMembership(id)
        if (!mounted) return
        setMembership(result || null)
      } catch (requestError) {
        if (!mounted) return
        setMembership(null)
        setError(getClubMembershipApiMessage(requestError, 'Không tải được chi tiết membership.'))
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
      const updated = await updateClubMembership(id, payload)
      setMembership(updated)
      setEditing(false)
      setSuccess('Đã cập nhật club membership.')
    } catch (requestError) {
      setSubmitError(getClubMembershipApiMessage(requestError, 'Không thể cập nhật club membership.'))
      throw requestError
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAction(type) {
    setSubmitting(true)
    setSubmitError('')
    try {
      let updated = null
      if (type === 'activate') updated = await activateClubMembership(id)
      if (type === 'deactivate') updated = await deactivateClubMembership(id)
      if (type === 'leave') updated = await leaveClubMembership(id)
      if (type === 'suspend') updated = await suspendClubMembership(id)
      setMembership(updated)
      setSuccess('Đã cập nhật trạng thái membership.')
    } catch (requestError) {
      setSubmitError(getClubMembershipApiMessage(requestError, 'Không thể cập nhật trạng thái membership.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết membership...</div>
  }

  if (!membership) {
    return (
      <div>
        <CAlert color='danger'>{error || 'Không tìm thấy club membership.'}</CAlert>
        <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
      </div>
    )
  }

  const statusMeta = getClubMembershipStatusMeta(membership.status)

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>{membership.sportsProfile?.fullName || '-'} · {membership.club?.name || '-'}</div>
          <div className='text-body-secondary'>{membership.memberCode || 'Chưa có memberCode'}</div>
          <div className='d-flex gap-2 mt-2 flex-wrap'>
            <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
            <CBadge color='info'>{getClubMembershipRoleLabel(membership.role)}</CBadge>
          </div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
          {!editing ? <CButton color='warning' variant='outline' onClick={() => setEditing(true)} disabled={submitting}>Chỉnh sửa</CButton> : null}
          <CButton color='success' variant='outline' onClick={() => handleAction('activate')} disabled={submitting}>Activate</CButton>
          <CButton color='secondary' variant='outline' onClick={() => handleAction('deactivate')} disabled={submitting}>Deactivate</CButton>
          <CButton color='warning' variant='outline' onClick={() => handleAction('suspend')} disabled={submitting}>Suspend</CButton>
          <CButton color='dark' variant='outline' onClick={() => handleAction('leave')} disabled={submitting}>Leave</CButton>
        </div>
      </div>

      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      {editing ? (
        <ClubMembershipForm initialValues={membership} submitting={submitting} submitError='' onCancel={() => setEditing(false)} onSubmit={handleUpdate} />
      ) : (
        <>
          <div className='fw-semibold mb-3'>A. Thành viên</div>
          <CRow className='g-3 mb-4'>
            <CCol md={6}><InfoCard label='Sports Profile' value={[membership.sportsProfile?.fullName, membership.sportsProfile?.code].filter(Boolean).join(' - ')} /></CCol>
            <CCol md={3}><InfoCard label='Member Code' value={membership.memberCode || '-'} /></CCol>
            <CCol md={3}><InfoCard label='Old Member Code' value={membership.oldMemberCode || '-'} /></CCol>
          </CRow>

          <div className='fw-semibold mb-3'>B. Quan hệ với Club</div>
          <CRow className='g-3 mb-4'>
            <CCol md={4}><InfoCard label='Club' value={[membership.club?.name, membership.club?.code].filter(Boolean).join(' - ')} /></CCol>
            <CCol md={2}><InfoCard label='Status' value={statusMeta.label} /></CCol>
            <CCol md={2}><InfoCard label='Role' value={getClubMembershipRoleLabel(membership.role)} /></CCol>
            <CCol md={2}><InfoCard label='Joined At' value={formatSportsDate(membership.joinedAt)} /></CCol>
            <CCol md={2}><InfoCard label='Left At' value={formatSportsDate(membership.leftAt)} /></CCol>
            <CCol md={12}><InfoCard label='Position Title' value={membership.positionTitle || '-'} /></CCol>
          </CRow>

          <div className='fw-semibold mb-3'>C. Nguồn / quản trị</div>
          <CRow className='g-3 mb-4'>
            <CCol md={3}><InfoCard label='Source' value={getClubMembershipSourceLabel(membership.source)} /></CCol>
            <CCol md={5}><InfoCard label='Source Reference' value={membership.sourceReference || '-'} /></CCol>
            <CCol md={2}><InfoCard label='Approved At' value={formatSportsDateTime(membership.approvedAt)} /></CCol>
            <CCol md={2}><InfoCard label='Approved By' value={getApprovedByLabel(membership.approvedBy)} /></CCol>
          </CRow>
          <CCard className='mb-4'>
            <CCardBody>
              <div className='small text-body-secondary mb-2'>Join Message</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{membership.joinMessage || 'Không có.'}</div>
              <div className='small text-body-secondary mt-3 mb-2'>Ghi chú nội bộ</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{membership.note || 'Không có.'}</div>
            </CCardBody>
          </CCard>
          <CRow className='g-3'>
            <CCol md={6}><InfoCard label='Tạo lúc' value={formatSportsDateTime(membership.createdAt)} /></CCol>
            <CCol md={6}><InfoCard label='Cập nhật lúc' value={formatSportsDateTime(membership.updatedAt)} /></CCol>
          </CRow>
          <ClubMembershipHistorySection membershipId={membership.id} />
        </>
      )}
    </div>
  )
}