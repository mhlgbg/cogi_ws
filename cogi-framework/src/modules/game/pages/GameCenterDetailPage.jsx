import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAccordion,
  CAccordionBody,
  CAccordionHeader,
  CAccordionItem,
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
} from '@coreui/react'
import { getGameApiMessage, getGameCenterDetail, registerForGame } from '../services/gameService'
import { formatDateTime, getStatusBadgeConfig } from '../utils/gameUi'

function getMedal(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

function getActivityLabel(activityCode) {
  const normalized = String(activityCode || '')
  if (normalized === 'daily_active') return 'Hoạt động hằng ngày'
  if (normalized === 'community_post') return 'Bài viết cộng đồng'
  if (normalized === 'community_comment') return 'Bình luận cộng đồng'
  return normalized || '-'
}

function detectGhostRaceClientPlatform() {
  if (typeof navigator === 'undefined') return null
  const userAgent = String(navigator.userAgent || '').toLowerCase()
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) return 'mobile'
  if (/windows nt|macintosh|x11|linux x86_64|cros/i.test(userAgent)) return 'desktop'
  return null
}

function getGhostRaceDeviceCompatibility(game) {
  const expectedPlatform = String(game?.settings?.playPlatform || game?.settings?.play_platform || 'desktop').toLowerCase()
  const detectedPlatform = detectGhostRaceClientPlatform()

  if (!expectedPlatform || expectedPlatform === 'web' || !detectedPlatform) return true
  if (expectedPlatform === 'desktop') return detectedPlatform === 'desktop'
  if (expectedPlatform === 'mobile') return detectedPlatform === 'mobile'
  return true
}

function getGhostRaceActionConfig(game, isRegistered) {
  const phaseCode = String(game?.effectivePhase?.code || '')
  const effectiveStatus = String(game?.effectiveStatus || '').toLowerCase()
  const registrationState = String(game?.registration?.state || '').toLowerCase()
  const isTrialOpen = phaseCode === 'trial_running'
  const isOfficialOpen = phaseCode === 'official_running'
  const isBeforeOpen = ['trial_upcoming', 'official_pending', 'waiting_official', 'registration', 'draft'].includes(phaseCode)
    || effectiveStatus === 'trial_upcoming'
    || effectiveStatus === 'official_pending'
  const isEnded = effectiveStatus === 'ended' || effectiveStatus === 'finalized'
  const isDeviceCompatible = getGhostRaceDeviceCompatibility(game)

  if (!isRegistered) {
    const canRegister = game?.registration?.canRegister === true
    return {
      kind: canRegister ? 'register' : 'register-disabled',
      label: 'ĐĂNG KÝ THAM GIA',
      disabled: !canRegister,
      reason: game?.registration?.reason || 'Bạn chưa thể đăng ký game ở thời điểm hiện tại.',
      secondaryLabel: null,
      secondaryAction: null,
    }
  }

  if (!isDeviceCompatible) {
    const expectedLabel = String(game?.settings?.playPlatform || game?.settings?.play_platform || 'desktop').toLowerCase() === 'mobile' ? 'mobile' : 'desktop'
    return {
      kind: 'device-mismatch',
      label: 'THIẾT BỊ KHÔNG PHÙ HỢP',
      disabled: true,
      reason: `Game Ghost Race yêu cầu thiết bị ${expectedLabel}. Hãy chuyển sang thiết bị phù hợp để vào đường đua.`,
      secondaryLabel: 'XEM KẾT QUẢ',
      secondaryAction: `/game-center/ghost-race?gameId=${game.id}`,
    }
  }

  if (isTrialOpen) {
    return {
      kind: 'trial',
      label: 'VÀO CHẠY THỬ',
      disabled: false,
      reason: 'Trial đang mở. Hãy bắt đầu lượt thử của bạn.',
      secondaryLabel: 'XEM KẾT QUẢ',
      secondaryAction: `/game-center/ghost-race?gameId=${game.id}`,
    }
  }

  if (isOfficialOpen) {
    return {
      kind: 'official',
      label: 'THI CHÍNH THỨC',
      disabled: false,
      reason: 'Official đang mở. Hãy tham gia đua chính thức.',
      secondaryLabel: 'XEM KẾT QUẢ',
      secondaryAction: `/game-center/ghost-race?gameId=${game.id}`,
    }
  }

  if (isBeforeOpen) {
    return {
      kind: 'upcoming',
      label: 'SẮP MỞ ĐƯỜNG ĐUA',
      disabled: true,
      reason: game?.effectivePhase?.notice || 'Giai đoạn đua chưa mở. Hãy chờ theo thời gian do backend quy định.',
      secondaryLabel: 'XEM KẾT QUẢ',
      secondaryAction: `/game-center/ghost-race?gameId=${game.id}`,
    }
  }

  if (isEnded) {
    return {
      kind: 'ended',
      label: 'XEM KẾT QUẢ',
      disabled: false,
      reason: 'Đã kết thúc. Không bắt đầu lượt mới, ưu tiên xem kết quả.',
      secondaryLabel: null,
      secondaryAction: null,
    }
  }

  if (registrationState === 'closed' || registrationState === 'unavailable') {
    return {
      kind: 'closed',
      label: 'KHÔNG THỂ THAM GIA',
      disabled: true,
      reason: game?.registration?.reason || 'Không thể tham gia ở thời điểm hiện tại.',
      secondaryLabel: 'XEM KẾT QUẢ',
      secondaryAction: `/game-center/ghost-race?gameId=${game.id}`,
    }
  }

  return {
    kind: 'default',
    label: 'SẮP MỞ ĐƯỜNG ĐUA',
    disabled: true,
    reason: game?.effectivePhase?.notice || 'Game chưa mở thời gian chơi.',
    secondaryLabel: 'XEM KẾT QUẢ',
    secondaryAction: `/game-center/ghost-race?gameId=${game.id}`,
  }
}

export default function GameCenterDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadDetail() {
    setLoading(true)
    setError('')
    try {
      const result = await getGameCenterDetail(id)
      setDetail(result)
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Không tải được chi tiết Game Center'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id])

  const game = detail?.game || null
  const lifecycleBadge = getStatusBadgeConfig(game?.effectiveStatus)
  const registrationBadge = getStatusBadgeConfig(game?.registration?.state)
  const phaseLabel = game?.effectivePhase?.label || lifecycleBadge.label
  const phaseNotice = game?.effectivePhase?.notice || ''
  const mySummary = detail?.mySummary || null
  const progress = Array.isArray(detail?.progress) ? detail.progress : []
  const history = Array.isArray(detail?.history) ? detail.history : []
  const rules = Array.isArray(detail?.rules) ? detail.rules : []
  const leaderboard = game?.effectivePhase?.isTrial ? detail?.leaderboards?.trialTop10 || [] : detail?.leaderboards?.officialTop10 || []
  const currentPhaseLabel = game?.effectivePhase?.isTrial ? 'Trial' : 'Official'
  const myRank = game?.effectivePhase?.isTrial ? mySummary?.trialRank : mySummary?.officialRank
  const myTotalXp = game?.effectivePhase?.isTrial
    ? (mySummary?.trialXp ?? game?.myParticipation?.trialXp ?? 0)
    : (mySummary?.officialXp ?? game?.myParticipation?.officialXp ?? 0)
  const myUserId = Number(game?.myParticipation?.user?.id || 0)
  const top10HasMe = leaderboard.some((item) => {
    if (myUserId > 0 && Number(item?.userId || 0) === myUserId) return true
    return Number(myRank || 0) > 0 && Number(item?.rank || 0) === Number(myRank || 0)
  })
  const progressByCode = new Map(progress.map((item) => [String(item?.activityCode || ''), item]))
  const isGhostRaceGame = String(game?.gameType?.code || '').toLowerCase() === 'ghost_race'
  const ghostRaceAction = isGhostRaceGame ? getGhostRaceActionConfig(game, Boolean(game?.myParticipation?.id)) : null

  async function handleRegister() {
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const result = await registerForGame(id)
      await loadDetail()
      setSuccess(result?.created === false ? 'Bạn đã đăng ký game này trước đó.' : 'Đăng ký tham gia game thành công.')
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Không đăng ký được game'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='container-fluid py-4'>
      <CButton color='secondary' variant='outline' size='sm' className='mb-3' onClick={() => navigate('/game-center')}>
        Quay lại Game Center
      </CButton>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {phaseNotice ? <CAlert color={game?.effectivePhase?.isTrial ? 'warning' : 'info'}>{phaseNotice}</CAlert> : null}

      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /> Đang tải chi tiết game...</div>
      ) : !game ? (
        <CAlert color='warning'>Không tìm thấy game.</CAlert>
      ) : (
        <>
          <CCard className='border-0 shadow-sm mb-3'>
            <CCardBody className='d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3'>
              <div>
                <div className='small text-body-secondary mb-1'>{game.code}</div>
                <h2 className='mb-1'>{game.name}</h2>
                <p className='text-body-secondary mb-2'>{game.description || 'Game đã được công bố cho tenant.'}</p>
                <div className='d-flex flex-wrap align-items-center gap-2'>
                  <CBadge color={lifecycleBadge.color}>{phaseLabel}</CBadge>
                  <CBadge color={registrationBadge.color}>{registrationBadge.label}</CBadge>
                  {game.myParticipation?.id ? <CBadge color='success'>Đã tham gia</CBadge> : <CBadge color='secondary'>Chưa tham gia</CBadge>}
                </div>
              </div>
              <div className='d-flex flex-column align-items-stretch gap-2 w-100 w-lg-auto' style={{ minWidth: 260, maxWidth: 360 }}>
                {isGhostRaceGame && ghostRaceAction ? (
                  <>
                    <CButton
                      type='button'
                      size='lg'
                      disabled={ghostRaceAction.disabled || submitting}
                      onClick={() => {
                        if (ghostRaceAction.kind === 'register' && !ghostRaceAction.disabled) {
                          handleRegister()
                          return
                        }
                        if (ghostRaceAction.secondaryAction && ghostRaceAction.kind !== 'register') {
                          navigate(ghostRaceAction.secondaryAction)
                        }
                      }}
                      style={{
                        backgroundColor: ghostRaceAction.disabled ? '#e9e7df' : '#A71919',
                        borderColor: ghostRaceAction.disabled ? '#d0d5dd' : '#FACC15',
                        color: ghostRaceAction.disabled ? '#6b7280' : '#FACC15',
                        fontWeight: 700,
                        fontSize: '1rem',
                        borderWidth: '2px',
                        boxShadow: ghostRaceAction.disabled ? 'none' : '0 8px 18px rgba(167, 25, 25, 0.18)',
                        transition: 'all 0.2s ease',
                        opacity: ghostRaceAction.disabled ? 0.8 : 1,
                        letterSpacing: '0.02em',
                      }}
                      onMouseEnter={(event) => {
                        if (!ghostRaceAction.disabled) {
                          event.currentTarget.style.filter = 'brightness(1.04)'
                          event.currentTarget.style.transform = 'translateY(-1px)'
                        }
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.filter = 'none'
                        event.currentTarget.style.transform = 'none'
                      }}
                    >
                      <span className='me-2' aria-hidden='true'>{ghostRaceAction.kind === 'trial' || ghostRaceAction.kind === 'official' ? '▶' : ghostRaceAction.kind === 'register' ? '⚑' : '⏱'}</span>
                      {submitting && ghostRaceAction.kind === 'register' ? 'Đang xử lý...' : ghostRaceAction.label}
                    </CButton>
                    {ghostRaceAction.reason ? (
                      <div className='small text-body-secondary text-lg-end' style={{ lineHeight: 1.5 }}>
                        {ghostRaceAction.reason}
                      </div>
                    ) : null}
                    {ghostRaceAction.secondaryLabel && ghostRaceAction.secondaryAction ? (
                      <CButton
                        variant='outline'
                        color='warning'
                        className='w-100'
                        onClick={() => navigate(ghostRaceAction.secondaryAction)}
                      >
                        {ghostRaceAction.secondaryLabel}
                      </CButton>
                    ) : null}
                  </>
                ) : (
                  <>
                    <CButton color='primary' disabled={!game.registration?.canRegister || submitting} onClick={handleRegister}>
                      {submitting ? 'Đang xử lý...' : game.myParticipation?.id ? 'Đã đăng ký' : 'Đăng ký tham gia'}
                    </CButton>
                    <div className='small text-body-secondary text-lg-end'>Run version hiện tại: {game.currentRunVersion || 1}</div>
                  </>
                )}
                {!isGhostRaceGame ? <div className='small text-body-secondary text-lg-end'>Run version hiện tại: {game.currentRunVersion || 1}</div> : null}
              </div>
            </CCardBody>
          </CCard>

          {isGhostRaceGame ? (
            <CAlert color='info'>
              {game.myParticipation?.id
                ? `Lane của bạn: ${game.myParticipation?.laneNumber || '-'} • Phase hiện tại: ${phaseLabel}.`
                : 'Đăng ký để nhận lane và mở lượt đua theo phase hiện tại.'}
            </CAlert>
          ) : null}

          {game.registration?.reason ? (
            <CAlert color={game.registration?.canRegister ? 'info' : 'warning'}>{game.registration.reason}</CAlert>
          ) : null}

          {!isGhostRaceGame ? (
            <>
              <CRow className='g-3 mb-3'>
            <CCol lg={4}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Thành tích cá nhân</strong></CCardHeader>
                <CCardBody>
                  {!game.myParticipation?.id ? (
                    <div className='text-body-secondary'>Bạn chưa đăng ký game này. Hãy đăng ký để bắt đầu tích lũy XP.</div>
                  ) : (
                    <div className='d-grid gap-2'>
                      <div className='border rounded p-3'>
                        <div className='small text-body-secondary'>XP hiện tại ({currentPhaseLabel})</div>
                        <div className='h4 mb-0 mt-1'>{myTotalXp}</div>
                      </div>
                      <div className='border rounded p-3'>
                        <div className='small text-body-secondary'>Thứ hạng {currentPhaseLabel}</div>
                        <div className='h4 mb-0 mt-1'>{myRank || '-'}</div>
                      </div>
                      <div className='border rounded p-3 d-flex justify-content-between gap-3'>
                        <div>
                          <div className='small text-body-secondary'>Trial XP</div>
                          <div className='fw-semibold'>{mySummary?.trialXp ?? game.myParticipation.trialXp ?? 0}</div>
                        </div>
                        <div>
                          <div className='small text-body-secondary'>Official XP</div>
                          <div className='fw-semibold'>{mySummary?.officialXp ?? game.myParticipation.officialXp ?? 0}</div>
                        </div>
                      </div>
                      <div className='small text-body-secondary'>Đăng ký lúc: {formatDateTime(game.myParticipation.registeredAt)}</div>
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
            <CCol lg={8}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader className='d-flex justify-content-between align-items-center'>
                  <strong>Bảng xếp hạng {currentPhaseLabel} - Top 10</strong>
                  <span className='small text-body-secondary'>Điểm chính: {currentPhaseLabel} XP</span>
                </CCardHeader>
                <CCardBody>
                  {!leaderboard.length ? (
                    <div className='text-body-secondary'>Chưa có dữ liệu bảng xếp hạng.</div>
                  ) : (
                    <div className='d-grid gap-2'>
                      {leaderboard.map((item) => {
                        const isMe = myUserId > 0 && Number(item?.userId || 0) === myUserId
                        return (
                          <div
                            key={`${item.participantId}:${item.rank}`}
                            className={`border rounded px-3 py-2 d-flex justify-content-between align-items-center ${isMe ? 'border-primary bg-primary bg-opacity-10' : ''}`}
                          >
                            <div>
                              <div className='fw-semibold'>
                                {getMedal(Number(item.rank))} #{item.rank} {item.fullName || item.username || `User ${item.userId}`}
                                {isMe ? <CBadge color='primary' className='ms-2'>Bạn</CBadge> : null}
                              </div>
                              <div className='small text-body-secondary'>{item.username || item.email || '-'}</div>
                            </div>
                            <div className='text-end'>
                              <div className='small text-body-secondary'>{currentPhaseLabel} XP</div>
                              <div className='fw-semibold'>{item.rankScore}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {Number(myRank || 0) > 0 && !top10HasMe ? (
                    <div className='mt-3 border rounded p-3 bg-light'>
                      <div className='small text-body-secondary mb-1'>Thứ hạng của bạn (ngoài Top 10)</div>
                      <div className='fw-semibold'>#{myRank} • {myTotalXp} {currentPhaseLabel} XP</div>
                    </div>
                  ) : null}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <CRow className='g-3 mb-3'>
            <CCol lg={6}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Tiến độ hoạt động</strong></CCardHeader>
                <CCardBody>
                  {!rules.length ? (
                    <div className='text-body-secondary'>Chưa có cấu hình hoạt động.</div>
                  ) : (
                    <CRow className='g-3'>
                      {rules.map((rule) => {
                        const currentProgress = progressByCode.get(String(rule.activityCode)) || null
                        return (
                          <CCol md={6} key={rule.activityCode}>
                            <div className='border rounded p-3 h-100'>
                              <div className='d-flex justify-content-between align-items-start gap-2 mb-2'>
                                <div className='fw-semibold'>{rule.activityName || getActivityLabel(rule.activityCode)}</div>
                                <CBadge color={rule.isEnabled ? 'success' : 'secondary'}>
                                  {rule.isEnabled ? 'Đang bật' : 'Đang tắt'}
                                </CBadge>
                              </div>
                              <div className='small text-body-secondary mb-2'>{rule.description || 'Không có mô tả'}</div>
                              <div className='small'>
                                <div><strong>XP có thể nhận:</strong> {rule.xpAmount}</div>
                                <div><strong>Đã dùng:</strong> {currentProgress?.earnedCount ?? 0}</div>
                                <div><strong>Giới hạn:</strong> {rule.maxCount || 'Không giới hạn'}</div>
                                <div><strong>Còn lại:</strong> {currentProgress?.remainingCount ?? (rule.maxCount || '-')}</div>
                              </div>
                            </div>
                          </CCol>
                        )
                      })}
                    </CRow>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
            <CCol lg={6}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Lịch sử nhận XP</strong></CCardHeader>
                <CCardBody>
                  {!history.length ? (
                    <div className='text-body-secondary'>Bạn chưa có lịch sử nhận XP.</div>
                  ) : (
                    <div className='d-grid gap-3'>
                      {history.map((item) => (
                        <div key={item.id} className='border-start border-4 border-primary ps-3 py-2'>
                          <div className='d-flex justify-content-between flex-wrap gap-2'>
                            <div>
                              <div className='fw-semibold'>{getActivityLabel(item.activityCode)}</div>
                              <div className='small text-body-secondary'>{formatDateTime(item.recordedAt)}</div>
                            </div>
                            <div className='text-end'>
                              <CBadge color={item.phase === 'official' ? 'success' : 'warning'} className='mb-1'>
                                {String(item.phase || '').toUpperCase() || '-'}
                              </CBadge>
                              <div className='fw-semibold'>+{item.xpAmount} XP</div>
                            </div>
                          </div>
                          <details className='mt-2'>
                            <summary className='small text-body-secondary' style={{ cursor: 'pointer' }}>Chi tiết kỹ thuật</summary>
                            <div className='small text-body-secondary mt-1'>
                              Event #{item.id} • Source: {item.sourceType}:{item.sourceId}
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
              </CRow>

              <CRow className='g-3 mb-3'>
            <CCol lg={6}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Tiến độ hoạt động</strong></CCardHeader>
                <CCardBody>
                  {!rules.length ? (
                    <div className='text-body-secondary'>Chưa có cấu hình hoạt động.</div>
                  ) : (
                    <CRow className='g-3'>
                      {rules.map((rule) => {
                        const currentProgress = progressByCode.get(String(rule.activityCode)) || null
                        return (
                          <CCol md={6} key={rule.activityCode}>
                            <div className='border rounded p-3 h-100'>
                              <div className='d-flex justify-content-between align-items-start gap-2 mb-2'>
                                <div className='fw-semibold'>{rule.activityName || getActivityLabel(rule.activityCode)}</div>
                                <CBadge color={rule.isEnabled ? 'success' : 'secondary'}>
                                  {rule.isEnabled ? 'Đang bật' : 'Đang tắt'}
                                </CBadge>
                              </div>
                              <div className='small text-body-secondary mb-2'>{rule.description || 'Không có mô tả'}</div>
                              <div className='small'>
                                <div><strong>XP có thể nhận:</strong> {rule.xpAmount}</div>
                                <div><strong>Đã dùng:</strong> {currentProgress?.earnedCount ?? 0}</div>
                                <div><strong>Giới hạn:</strong> {rule.maxCount || 'Không giới hạn'}</div>
                                <div><strong>Còn lại:</strong> {currentProgress?.remainingCount ?? (rule.maxCount || '-')}</div>
                              </div>
                            </div>
                          </CCol>
                        )
                      })}
                    </CRow>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
            <CCol lg={6}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Lịch sử nhận XP</strong></CCardHeader>
                <CCardBody>
                  {!history.length ? (
                    <div className='text-body-secondary'>Bạn chưa có lịch sử nhận XP.</div>
                  ) : (
                    <div className='d-grid gap-3'>
                      {history.map((item) => (
                        <div key={item.id} className='border-start border-4 border-primary ps-3 py-2'>
                          <div className='d-flex justify-content-between flex-wrap gap-2'>
                            <div>
                              <div className='fw-semibold'>{getActivityLabel(item.activityCode)}</div>
                              <div className='small text-body-secondary'>{formatDateTime(item.recordedAt)}</div>
                            </div>
                            <div className='text-end'>
                              <CBadge color={item.phase === 'official' ? 'success' : 'warning'} className='mb-1'>
                                {String(item.phase || '').toUpperCase() || '-'}
                              </CBadge>
                              <div className='fw-semibold'>+{item.xpAmount} XP</div>
                            </div>
                          </div>
                          <details className='mt-2'>
                            <summary className='small text-body-secondary' style={{ cursor: 'pointer' }}>Chi tiết kỹ thuật</summary>
                            <div className='small text-body-secondary mt-1'>
                              Event #{item.id} • Source: {item.sourceType}:{item.sourceId}
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
              </CRow>
            </>
          ) : null}

          <CCard className='border-0 shadow-sm'>
            <CCardHeader><strong>Thông tin mở rộng</strong></CCardHeader>
            <CCardBody>
              <CAccordion>
                <CAccordionItem itemKey={1}>
                  <CAccordionHeader>Lịch trình game</CAccordionHeader>
                  <CAccordionBody>
                    <div className='d-grid gap-2 small'>
                      <div><strong>Mở đăng ký:</strong> {formatDateTime(game.registrationOpenAt)}</div>
                      <div><strong>Đóng đăng ký:</strong> {formatDateTime(game.registrationCloseAt)}</div>
                      {game.hasTrial ? <div><strong>Bắt đầu trial:</strong> {formatDateTime(game.trialStartAt)}</div> : null}
                      {game.hasTrial ? <div><strong>Kết thúc trial:</strong> {formatDateTime(game.trialEndAt)}</div> : null}
                      <div><strong>Bắt đầu official:</strong> {formatDateTime(game.startsAt)}</div>
                      <div><strong>Kết thúc official:</strong> {formatDateTime(game.endsAt)}</div>
                      <div><strong>Múi giờ:</strong> {game.timezone || '-'}</div>
                    </div>
                  </CAccordionBody>
                </CAccordionItem>
                <CAccordionItem itemKey={2}>
                  <CAccordionHeader>Thông tin đăng ký</CAccordionHeader>
                  <CAccordionBody>
                    <div className='d-grid gap-2 small'>
                      <div><strong>Trạng thái đăng ký:</strong> {registrationBadge.label}</div>
                      <div><strong>Đăng ký muộn:</strong> {game.lateRegistrationEnabled ? 'Cho phép' : 'Không cho phép'}</div>
                      <div><strong>Tổng người tham gia:</strong> {detail?.stats?.totalParticipants || 0}</div>
                      <div><strong>Người chơi đang active:</strong> {detail?.stats?.activeParticipants || 0}</div>
                      {game.registration?.reason ? <div><strong>Ghi chú:</strong> {game.registration.reason}</div> : null}
                    </div>
                  </CAccordionBody>
                </CAccordionItem>
                {!isGhostRaceGame ? (
                  <CAccordionItem itemKey={3}>
                  <CAccordionHeader>XP Rules chi tiết</CAccordionHeader>
                  <CAccordionBody>
                    {!rules.length ? (
                      <div className='text-body-secondary'>Chưa có rule nào được cấu hình.</div>
                    ) : (
                      <div className='d-grid gap-2 small'>
                        {rules.map((rule) => (
                          <div key={`rule-detail:${rule.activityCode}`} className='border rounded p-2'>
                            <div className='fw-semibold'>{rule.activityName || getActivityLabel(rule.activityCode)}</div>
                            <div>Trạng thái: {rule.isEnabled ? 'Bật' : 'Tắt'}</div>
                            <div>XP: {rule.xpAmount} • Giới hạn: {rule.maxCount || 'Không giới hạn'} • Chu kỳ: {rule.limitPeriod}</div>
                            <div className='text-body-secondary'>{rule.description || 'Không có mô tả'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CAccordionBody>
                  </CAccordionItem>
                ) : null}
                {!isGhostRaceGame ? (
                  <CAccordionItem itemKey={4}>
                  <CAccordionHeader>Giải thích Trial XP và Official XP</CAccordionHeader>
                  <CAccordionBody>
                    <div className='small text-body-secondary'>
                      Trial XP và Official XP được tách riêng. Điểm chính của bảng xếp hạng sẽ bám theo phase hiện tại.
                      Khi game ở trial, trang ưu tiên Trial XP; khi game vào official, trang ưu tiên Official XP.
                    </div>
                  </CAccordionBody>
                  </CAccordionItem>
                ) : null}
              </CAccordion>
            </CCardBody>
          </CCard>
        </>
      )}
    </div>
  )
}
