import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CAlert, CNav, CNavItem, CNavLink, CSpinner } from '@coreui/react'
import ManagedClubHeader from '../components/ManagedClubHeader'
import ManagedClubAchievementsTab from '../components/ManagedClubAchievementsTab'
import ManagedClubMembersTab from '../components/ManagedClubMembersTab'
import { getMyManagedClub, getSportsClubManagementApiMessage } from '../services/sportsClubManagementService'

const TABS = [
  { key: 'members', label: 'Thành viên' },
  { key: 'achievements', label: 'Thành tích' },
]

export default function ManagedClubWorkspacePage() {
  const navigate = useNavigate()
  const { clubId, tenantCode, tabKey } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [club, setClub] = useState(null)

  const activeTab = TABS.some((item) => item.key === tabKey) ? tabKey : 'members'
  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/my-clubs` : '/sports/my-clubs'
  const basePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/my-clubs/${clubId}` : `/sports/my-clubs/${clubId}`

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getMyManagedClub(clubId)
        if (!mounted) return
        setClub(result || null)
      } catch (requestError) {
        if (!mounted) return
        setClub(null)
        setError(getSportsClubManagementApiMessage(requestError, 'Không tải được workspace Club.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [clubId])

  if (!tabKey) {
    return <Navigate to={`${basePath}/members`} replace />
  }

  if (loading) {
    return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải workspace Club...</div>
  }

  if (!club) {
    return (
      <div>
        <CAlert color='danger'>{error || 'Không tìm thấy Club hoặc bạn không có assignment hợp lệ.'}</CAlert>
      </div>
    )
  }

  return (
    <div>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      <ManagedClubHeader club={club} onBack={() => navigate(listPath)} />
      <CNav variant='tabs' className='mb-4'>
        {TABS.map((item) => (
          <CNavItem key={item.key}>
            <CNavLink active={activeTab === item.key} onClick={() => navigate(`${basePath}/${item.key}`)} role='button'>
              {item.label}
            </CNavLink>
          </CNavItem>
        ))}
      </CNav>
      {activeTab === 'members' ? <ManagedClubMembersTab club={club} /> : null}
      {activeTab === 'achievements' ? <ManagedClubAchievementsTab club={club} /> : null}
    </div>
  )
}