import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CNav, CNavItem, CNavLink, CRow, CSpinner } from '@coreui/react'
import { useFeature } from '../../../contexts/FeatureContext'
import ManagedClubAchievementsTab from '../components/ManagedClubAchievementsTab'
import ManagedClubHeader from '../components/ManagedClubHeader'
import ManagedClubMemberHistoryManager from '../components/ManagedClubMemberHistoryManager'
import ManagedClubMemberModal from '../components/ManagedClubMemberModal'
import ManagedClubMemberStatusActionModal from '../components/ManagedClubMemberStatusActionModal'
import { getManagedClubMember, getMyManagedClub, getSportsClubManagementApiMessage } from '../services/sportsClubManagementService'
import { formatSportsDate, formatSportsDateTime, getClubMembershipRoleLabel, getClubMembershipSourceLabel, getClubMembershipStatusMeta } from '../utils/clubMembershipUi'
import { formatSportsBirthDateOrYear, getSportsProfileGenderLabel } from '../utils/sportsProfileUi'

const MEMBER_TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'history', label: 'Lịch sử CLB' },
  { key: 'achievements', label: 'Thành tích' },
]

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

export default function ManagedClubMemberDetailPage() {
  const feature = useFeature()
  const navigate = useNavigate()
  const { clubId, membershipId, memberTabKey, tenantCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [club, setClub] = useState(null)
  const [membership, setMembership] = useState(null)
  const [editing, setEditing] = useState(false)
  const [statusAction, setStatusAction] = useState({ visible: false, type: '' })
  const [success, setSuccess] = useState('')

  const activeTab = useMemo(
    () => (MEMBER_TABS.some((item) => item.key === memberTabKey) ? memberTabKey : 'overview'),
    [memberTabKey],
  )
  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/my-clubs` : '/sports/my-clubs'
  const workspacePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/my-clubs/${clubId}/members` : `/sports/my-clubs/${clubId}/members`
  const detailBasePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/my-clubs/${clubId}/members/${membershipId}` : `/sports/my-clubs/${clubId}/members/${membershipId}`
  const sportsProfilePath = membership?.sportsProfile?.id ? (tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/profiles/${membership.sportsProfile.id}` : `/sports/profiles/${membership.sportsProfile.id}`) : null
  const canViewSportsProfile = Boolean(feature?.hasFeature?.('sports-profile.manage'))

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [nextClub, nextMembership] = await Promise.all([
          getMyManagedClub(clubId),
          getManagedClubMember(clubId, membershipId),
        ])
        if (!mounted) return
        setClub(nextClub || null)
        setMembership(nextMembership || null)
      } catch (requestError) {
        if (!mounted) return
        setClub(null)
        setMembership(null)
        setError(getSportsClubManagementApiMessage(requestError, 'Không tải được chi tiết thành viên CLB.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [clubId, membershipId])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  function handleMembershipChange(nextMembership) {
    if (!nextMembership?.id) return
    setMembership(nextMembership)
  }

  function handleEditSaved(nextMembership) {
    handleMembershipChange(nextMembership)
    setEditing(false)
    setSuccess('Đã cập nhật membership.')
  }

  function handleStatusSaved(nextMembership, message) {
    handleMembershipChange(nextMembership)
    setStatusAction({ visible: false, type: '' })
    setSuccess(message || 'Đã cập nhật trạng thái thành viên.')
  }

  if (!memberTabKey) {
    return <Navigate to={`${detailBasePath}/overview`} replace />
  }

  if (loading) {
    return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết thành viên CLB...</div>
  }

  if (!club || !membership) {
    return (
      <div>
        <CAlert color='danger'>{error || 'Không tìm thấy thành viên CLB hoặc bạn không có quyền truy cập.'}</CAlert>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(workspacePath)}>Quay lại danh sách thành viên</CButton>
          <CButton color='light' variant='outline' onClick={() => navigate(listPath)}>Quay lại CLB tôi quản lý</CButton>
        </div>
      </div>
    )
  }

  const statusMeta = getClubMembershipStatusMeta(membership.status)

  function renderOverviewTab() {
    return (
      <>
        <div className='fw-semibold mb-3'>A. Sports Profile</div>
        <CRow className='g-3 mb-4'>
          <CCol lg={4} md={6}>
            <CCard className='h-100'>
              <CCardBody>
                <div className='small text-body-secondary mb-2'>Avatar</div>
                {membership.sportsProfile?.avatar?.url
                  ? <img src={membership.sportsProfile.avatar.url} alt={membership.sportsProfile.fullName || membership.sportsProfile.code} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 16 }} />
                  : <div className='text-body-secondary'>Chưa có avatar</div>}
                {canViewSportsProfile && sportsProfilePath ? <div className='mt-3'><CButton color='secondary' variant='outline' size='sm' onClick={() => navigate(sportsProfilePath)}>Xem Sports Profile</CButton></div> : null}
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={8} md={6}>
            <CRow className='g-3'>
              <CCol sm={6}><InfoCard label='Profile Code' value={membership.sportsProfile?.code || '-'} /></CCol>
              <CCol sm={6}><InfoCard label='Họ tên' value={membership.sportsProfile?.fullName || '-'} /></CCol>
              <CCol sm={6}><InfoCard label='Tên hiển thị' value={membership.sportsProfile?.displayName || '-'} /></CCol>
              <CCol sm={6}><InfoCard label='Giới tính' value={getSportsProfileGenderLabel(membership.sportsProfile?.gender)} /></CCol>
              <CCol sm={6}><InfoCard label='Ngày/Năm sinh' value={formatSportsBirthDateOrYear(membership.sportsProfile?.dateOfBirth, membership.sportsProfile?.birthYear)} /></CCol>
              <CCol sm={6}><InfoCard label='Điện thoại' value={membership.sportsProfile?.contactPhone || '-'} /></CCol>
              <CCol xs={12}><InfoCard label='Email' value={membership.sportsProfile?.contactEmail || '-'} /></CCol>
            </CRow>
          </CCol>
        </CRow>

        <div className='fw-semibold mb-3'>B. Club Membership</div>
        <CRow className='g-3 mb-4'>
          <CCol md={4}><InfoCard label='Member Code' value={membership.memberCode || '-'} /></CCol>
          <CCol md={4}><InfoCard label='CLB' value={club?.name || club?.code || '-'} /></CCol>
          <CCol md={4}><InfoCard label='Trạng thái hiện tại' value={statusMeta.label} /></CCol>
          <CCol md={4}><InfoCard label='Vai trò' value={getClubMembershipRoleLabel(membership.role)} /></CCol>
          <CCol md={4}><InfoCard label='Chức danh' value={membership.positionTitle || '-'} /></CCol>
          <CCol md={4}><InfoCard label='Joined At' value={formatSportsDate(membership.joinedAt)} /></CCol>
          <CCol md={4}><InfoCard label='Nguồn tạo' value={getClubMembershipSourceLabel(membership.source)} /></CCol>
          <CCol md={4}><InfoCard label='Created At' value={formatSportsDateTime(membership.createdAt)} /></CCol>
          <CCol md={4}><InfoCard label='Updated At' value={formatSportsDateTime(membership.updatedAt)} /></CCol>
          {membership.oldMemberCode ? <CCol md={4}><InfoCard label='Old Member Code' value={membership.oldMemberCode} /></CCol> : null}
          {membership.leftAt ? <CCol md={4}><InfoCard label='Left At' value={formatSportsDate(membership.leftAt)} /></CCol> : null}
          {membership.sourceReference ? <CCol md={8}><InfoCard label='Source Reference' value={membership.sourceReference} /></CCol> : null}
        </CRow>

        {membership.joinMessage || membership.note ? (
          <CCard className='mb-4'>
            <CCardBody>
              <div className='small text-body-secondary mb-2'>Join Message</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{membership.joinMessage || 'Không có.'}</div>
              <div className='small text-body-secondary mt-3 mb-2'>Ghi chú nội bộ</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{membership.note || 'Không có.'}</div>
            </CCardBody>
          </CCard>
        ) : null}
      </>
    )
  }

  return (
    <div>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      <ManagedClubHeader club={club} onBack={() => navigate(listPath)} />
      <CCard className='mb-4'>
        <CCardBody>
          <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
            <div className='d-flex gap-3 align-items-start'>
              <div>
                {membership.sportsProfile?.avatar?.url
                  ? <img src={membership.sportsProfile.avatar.url} alt={membership.sportsProfile.fullName || membership.sportsProfile.code} style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 16 }} />
                  : <div className='d-inline-flex align-items-center justify-content-center rounded bg-body-tertiary text-body-secondary' style={{ width: 88, height: 88 }}>N/A</div>}
              </div>
              <div>
                <div className='fs-4 fw-semibold'>{membership.sportsProfile?.fullName || membership.sportsProfile?.displayName || 'Chi tiết thành viên CLB'}</div>
                <div className='text-body-secondary'>{membership.memberCode || 'Chưa có Member Code'}</div>
                <div className='text-body-secondary mt-1'>Sports Profile: {membership.sportsProfile?.code || '-'} · CLB: {club?.name || club?.code || '-'}</div>
                <div className='d-flex gap-2 mt-2 flex-wrap'>
                  <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                  <CBadge color='info'>{getClubMembershipRoleLabel(membership.role)}</CBadge>
                </div>
              </div>
            </div>
            <div className='d-flex gap-2 flex-wrap'>
              <CButton color='secondary' variant='outline' onClick={() => navigate(workspacePath)}>Quay lại danh sách thành viên</CButton>
              {!editing ? <CButton color='warning' variant='outline' onClick={() => setEditing(true)}>Sửa Membership</CButton> : null}
              {membership.status === 'active' ? <CButton color='warning' variant='outline' onClick={() => setStatusAction({ visible: true, type: 'deactivate' })}>Dừng hoạt động</CButton> : null}
              {membership.status === 'inactive' ? <CButton color='success' variant='outline' onClick={() => setStatusAction({ visible: true, type: 'reactivate' })}>Hoạt động lại</CButton> : null}
              {membership.status === 'left' ? <CButton color='success' variant='outline' onClick={() => setStatusAction({ visible: true, type: 'rejoin' })}>Gia nhập lại</CButton> : null}
              {membership.status !== 'left' ? <CButton color='dark' variant='outline' onClick={() => setStatusAction({ visible: true, type: 'leave' })}>Rời CLB</CButton> : null}
            </div>
          </div>
        </CCardBody>
      </CCard>

      {success ? <CAlert color='success'>{success}</CAlert> : null}

      <CNav variant='tabs' className='mb-4 flex-nowrap overflow-auto'>
        {MEMBER_TABS.map((item) => (
          <CNavItem key={item.key}>
            <CNavLink active={activeTab === item.key} onClick={() => navigate(`${detailBasePath}/${item.key}`)} role='button'>
              {item.label}
            </CNavLink>
          </CNavItem>
        ))}
      </CNav>

      {activeTab === 'overview' ? renderOverviewTab() : null}
      {activeTab === 'history' ? <ManagedClubMemberHistoryManager club={club} membership={membership} onMembershipChange={handleMembershipChange} /> : null}
      {activeTab === 'achievements' ? <ManagedClubAchievementsTab club={club} membership={membership} /> : null}

      <ManagedClubMemberModal visible={editing} club={club} initialMembership={membership} onClose={() => setEditing(false)} onSaved={handleEditSaved} />
      <ManagedClubMemberStatusActionModal visible={statusAction.visible} clubId={club?.id} membership={membership} actionType={statusAction.type} onClose={() => setStatusAction({ visible: false, type: '' })} onSaved={handleStatusSaved} />
    </div>
  )
}