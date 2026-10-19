import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import { getGameApiMessage, getGameCenterData } from '../services/gameService'
import { formatDateTime, getStatusBadgeConfig } from '../utils/gameUi'

const FILTERS = [
  { key: 'all', label: 'Tat ca' },
  { key: 'trial_upcoming', label: 'Sap choi thu' },
  { key: 'trial_running', label: 'Dang choi thu' },
  { key: 'official_pending', label: 'Cho chinh thuc' },
  { key: 'official_running', label: 'Dang chinh thuc' },
  { key: 'ended', label: 'Da ket thuc' },
]

function CenterStat({ label, value }) {
  return (
    <CCol xs={6} xl={3}>
      <CCard className='h-100 border-0 shadow-sm'>
        <CCardBody>
          <div className='small text-body-secondary'>{label}</div>
          <div className='h2 mb-0 mt-2'>{value}</div>
        </CCardBody>
      </CCard>
    </CCol>
  )
}

export default function GameCenterPage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const [centerData, setCenterData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getGameCenterData()
        if (!active) return
        setCenterData(result)
      } catch (requestError) {
        if (!active) return
        setError(getGameApiMessage(requestError, 'Khong tai duoc Game Center'))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const games = Array.isArray(centerData?.games) ? centerData.games : []
  const summary = centerData?.summary || {
    upcomingGames: 0,
    runningGames: 0,
    endedGames: 0,
    registeredGames: 0,
  }

  const filteredGames = useMemo(() => {
    if (activeFilter === 'all') return games
    return games.filter((game) => {
      const effectiveStatus = String(game?.effectiveStatus || '').toLowerCase()
      if (activeFilter === 'trial_upcoming') return effectiveStatus === 'trial_upcoming' || effectiveStatus === 'registration'
      if (activeFilter === 'trial_running') return effectiveStatus === 'trial_running'
      if (activeFilter === 'official_pending') return effectiveStatus === 'official_pending'
      if (activeFilter === 'official_running') return effectiveStatus === 'official_running'
      if (activeFilter === 'ended') return effectiveStatus === 'ended' || effectiveStatus === 'finalized'
      return true
    })
  }, [activeFilter, games])

  const brandName = tenant?.currentTenant?.tenantShortName
    || tenant?.currentTenant?.tenantName
    || tenant?.currentTenant?.tenantCode
    || 'Tenant'

  return (
    <div className='container-fluid py-4'>
      <div className='d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4'>
        <div>
          <h2 className='mb-1'>Game Center</h2>
          <p className='text-body-secondary mb-0'>
            Khong gian game cua {brandName}, noi thanh vien co the xem lich game, rule va dang ky tham gia XP Challenge.
          </p>
        </div>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CRow className='g-3 mb-4'>
        <CenterStat label='Sap choi thu / cho chinh thuc' value={summary.upcomingGames} />
        <CenterStat label='Dang trial / official' value={summary.runningGames} />
        <CenterStat label='Da ket thuc' value={summary.endedGames} />
        <CenterStat label='Ban da tham gia' value={summary.registeredGames} />
      </CRow>

      <CCard className='border-0 shadow-sm'>
        <CCardHeader className='d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3'>
          <strong>Danh sach game cong bo</strong>
          <CNav variant='underline'>
            {FILTERS.map((item) => (
              <CNavItem key={item.key}>
                <CNavLink
                  href='#'
                  active={activeFilter === item.key}
                  onClick={(event) => {
                    event.preventDefault()
                    setActiveFilter(item.key)
                  }}
                >
                  {item.label}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /> Dang tai Game Center...</div>
          ) : filteredGames.length === 0 ? (
            <div className='text-body-secondary'>Chua co game phu hop voi bo loc hien tai.</div>
          ) : (
            <CRow className='g-3'>
              {filteredGames.map((game) => {
                const lifecycleBadge = getStatusBadgeConfig(game.effectiveStatus)
                const registrationBadge = getStatusBadgeConfig(game.registration?.state)
                return (
                  <CCol xs={12} md={6} xl={4} key={game.id}>
                    <CCard className='h-100 border'>
                      <CCardBody className='d-flex flex-column'>
                        <div className='d-flex justify-content-between align-items-start gap-2 mb-3'>
                          <div>
                            <div className='small text-body-secondary'>{game.code}</div>
                            <div className='fw-semibold fs-5'>{game.name}</div>
                          </div>
                          <div className='d-flex flex-column gap-2 align-items-end'>
                            <CBadge color={lifecycleBadge.color}>{lifecycleBadge.label}</CBadge>
                            {game.myParticipation?.id ? <CBadge color='success'>Da tham gia</CBadge> : null}
                          </div>
                        </div>

                        <div className='text-body-secondary small mb-3'>
                          {game.description || 'Game XP Challenge da duoc cong bo cho tenant.'}
                        </div>

                        <div className='small mb-3'>
                          <div><strong>Dang ky:</strong> {formatDateTime(game.registrationOpenAt)} - {formatDateTime(game.registrationCloseAt)}</div>
                          {game.hasTrial ? (
                            <div><strong>Trial:</strong> {formatDateTime(game.trialStartAt)} - {formatDateTime(game.trialEndAt)}</div>
                          ) : null}
                          <div><strong>Official:</strong> {formatDateTime(game.startsAt)} - {formatDateTime(game.endsAt)}</div>
                          <div><strong>Timezone:</strong> {game.timezone || '-'}</div>
                          <div><strong>Game type:</strong> {game.gameType?.name || game.gameType?.code || '-'}</div>
                        </div>

                        <div className='mt-auto d-flex justify-content-between align-items-center gap-2'>
                          <div>
                            <CBadge color={registrationBadge.color}>{registrationBadge.label}</CBadge>
                            {game.effectivePhase?.notice ? (
                              <div className='small text-body-secondary mt-1'>{game.effectivePhase.notice}</div>
                            ) : null}
                            {game.registration?.reason ? (
                              <div className='small text-body-secondary mt-1'>{game.registration.reason}</div>
                            ) : null}
                          </div>
                          <CButton color='primary' onClick={() => navigate(`/game-center/${game.id}`)}>
                            Xem chi tiet
                          </CButton>
                        </div>
                      </CCardBody>
                    </CCard>
                  </CCol>
                )
              })}
            </CRow>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}
