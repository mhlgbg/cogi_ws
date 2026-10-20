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
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSwitch,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  createGame,
  getGameApiMessage,
  getGameManagementDashboard,
  publishGame,
  updateGame,
  updateTenantGameTypeEnablement,
} from '../services/gameService'
import {
  buildGameFormState,
  createEmptyGameFormState,
  formatDateTime,
  getStatusBadgeConfig,
  toSubmitDateTime,
} from '../utils/gameUi'

function SummaryCard({ label, value, color = 'primary' }) {
  return (
    <CCol xs={12} md={6} xl={3}>
      <CCard className='h-100 border-0 shadow-sm'>
        <CCardBody>
          <div className='text-body-secondary small'>{label}</div>
          <div className={`display-6 fw-semibold text-${color} mt-2`}>{value}</div>
        </CCardBody>
      </CCard>
    </CCol>
  )
}

export default function GameDashboardPage() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  const [formState, setFormState] = useState(createEmptyGameFormState())
  const [actionKey, setActionKey] = useState('')

  async function loadDashboard() {
    setLoading(true)
    setError('')
    try {
      const nextDashboard = await getGameManagementDashboard()
      setDashboard(nextDashboard)
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Không tải được game dashboard'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const xpChallengeType = useMemo(
    () => (dashboard?.gameTypes || []).find((item) => String(item?.code || '').toLowerCase() === 'xp_challenge') || null,
    [dashboard?.gameTypes],
  )

  function openCreateModal() {
    setEditingGame(null)
    setFormState(createEmptyGameFormState())
    setModalVisible(true)
  }

  function openEditModal(game) {
    if (game?.editability?.canEdit === false) {
      setError(      game?.editability?.reason || 'Game này không còn cho phép chỉnh sửa.')
      setSuccess('')
      return
    }
    setEditingGame(game)
    setFormState(buildGameFormState(game))
    setModalVisible(true)
  }

  function closeModal() {
    if (actionKey) return
    setModalVisible(false)
    setEditingGame(null)
    setFormState(createEmptyGameFormState())
  }

  async function handleToggleGameType(event) {
    if (!xpChallengeType?.id) return
    const nextEnabled = event.target.checked
    setActionKey(`game-type:${xpChallengeType.id}`)
    setError('')
    setSuccess('')
    try {
      await updateTenantGameTypeEnablement(xpChallengeType.id, nextEnabled)
      await loadDashboard()
      setSuccess(nextEnabled ? 'Đã bật XP Challenge cho tenant' : 'Đã tắt XP Challenge cho tenant')
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Không cập nhật được game type'))
    } finally {
      setActionKey('')
    }
  }

  async function handleSubmitForm() {
    const payload = {
      code: formState.code,
      name: formState.name,
      description: formState.description,
      gameTypeCode: 'xp_challenge',
      hasTrial: formState.hasTrial,
      registrationOpenAt: toSubmitDateTime(formState.registrationOpenAt),
      registrationCloseAt: toSubmitDateTime(formState.registrationCloseAt),
      trialStartAt: formState.hasTrial ? toSubmitDateTime(formState.trialStartAt) : null,
      trialEndAt: formState.hasTrial ? toSubmitDateTime(formState.trialEndAt) : null,
      startsAt: toSubmitDateTime(formState.startsAt),
      endsAt: toSubmitDateTime(formState.endsAt),
      timezone: formState.timezone,
      lateRegistrationEnabled: formState.lateRegistrationEnabled,
    }

    setActionKey(editingGame?.id ? `update:${editingGame.id}` : 'create')
    setError('')
    setSuccess('')
    try {
      const isEditing = Boolean(editingGame?.id)
      const result = editingGame?.id
        ? await updateGame(editingGame.id, payload)
        : await createGame(payload)
      setSuccess(isEditing ? 'Cập nhật game thành công' : 'Tạo game thành công')
      setModalVisible(false)
      setEditingGame(null)
      setFormState(createEmptyGameFormState())

      if (!isEditing && result?.game?.id) {
        setActionKey('')
        navigate(`/games/${result.game.id}`)
        return
      }

      await loadDashboard()
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Không lưu được game'))
    } finally {
      setActionKey('')
    }
  }

  async function handlePublish(game) {
    if (game?.editability?.canPublish === false) {
      setError(      game?.editability?.publishReason || 'Game này không còn cho phép công bố.')
      setSuccess('')
      return
    }
    setActionKey(`publish:${game.id}`)
    setError('')
    setSuccess('')
    try {
      await publishGame(game.id)
      await loadDashboard()
      setSuccess(`Đã công bố game ${game.name || game.code}`)
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Không công bố được game'))
    } finally {
      setActionKey('')
    }
  }

  const summary = dashboard?.summary || {
    totalGames: 0,
    upcomingGames: 0,
    runningGames: 0,
    endedGames: 0,
    totalParticipants: 0,
  }

  const games = Array.isArray(dashboard?.games) ? dashboard.games : []

  return (
    <div className='container-fluid py-4'>
      <div className='d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4'>
        <div>
          <h2 className='mb-1'>Game Platform</h2>
          <p className='text-body-secondary mb-0'>
            Quản trị game XP Challenge, bật tắt game type, vòng đời game, cấu hình luật và danh sách đăng ký.
          </p>
        </div>
        <CButton color='primary' onClick={openCreateModal} disabled={!xpChallengeType?.isEnabled || Boolean(actionKey)}>
          Tạo XP Challenge
        </CButton>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      <CRow className='g-3 mb-4'>
        <SummaryCard label='Tổng số game' value={summary.totalGames} />
        <SummaryCard label='Sắp diễn ra / chờ chạy' value={summary.upcomingGames} color='info' />
        <SummaryCard label='Đang trial / official' value={summary.runningGames} color='success' />
        <SummaryCard label='Đã kết thúc' value={summary.endedGames} color='dark' />
      </CRow>

      <CRow className='g-3 mb-4'>
        <CCol xl={4}>
          <CCard className='h-100 border-0 shadow-sm'>
            <CCardHeader className='d-flex justify-content-between align-items-center gap-2'>
              <strong>Game Type enablement</strong>
              {actionKey.startsWith('game-type:') ? <CSpinner size='sm' /> : null}
            </CCardHeader>
            <CCardBody>
              {loading ? (
                <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /> Đang tải...</div>
              ) : xpChallengeType ? (
                <>
                  <div className='d-flex justify-content-between align-items-start gap-3 mb-3'>
                    <div>
                      <div className='fw-semibold'>{xpChallengeType.name || 'XP Challenge'}</div>
                      <div className='small text-body-secondary'>{xpChallengeType.description || 'Game type tích hợp sẵn cho XP Challenge.'}</div>
                    </div>
                    <CBadge color={xpChallengeType.isLicensed ? 'success' : 'secondary'}>
                      {xpChallengeType.isLicensed ? 'Licensed' : 'Not licensed'}
                    </CBadge>
                  </div>
                  <CFormSwitch
                    id='tenant-game-type-enable'
                    label='Cho phép tenant sử dụng XP Challenge'
                    checked={Boolean(xpChallengeType.isEnabled)}
                    disabled={!xpChallengeType.isLicensed || Boolean(actionKey)}
                    onChange={handleToggleGameType}
                  />
                  {!xpChallengeType.isLicensed ? (
                    <div className='small text-danger mt-3'>
                      Platform chưa cấp phép XP Challenge cho tenant này.
                    </div>
                  ) : (
                    <div className='small text-body-secondary mt-3'>
                      {xpChallengeType.isEnabled
                        ? 'Tenant Admin có thể tạo và công bố game XP Challenge.'
                        : 'Cần bật game type trước khi tạo game mới.'}
                    </div>
                  )}
                </>
              ) : (
                <div className='text-body-secondary'>Không tìm thấy game type xp_challenge.</div>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={8}>
          <CCard className='h-100 border-0 shadow-sm'>
            <CCardHeader><strong>Trạng thái hệ thống</strong></CCardHeader>
            <CCardBody>
              <div className='row g-3'>
                <div className='col-md-4'>
                  <div className='border rounded p-3 h-100'>
                    <div className='small text-body-secondary'>Người đăng ký</div>
                    <div className='h3 mb-0 mt-2'>{summary.totalParticipants}</div>
                  </div>
                </div>
                <div className='col-md-4'>
                  <div className='border rounded p-3 h-100'>
                    <div className='small text-body-secondary'>Bảng xếp hạng</div>
                    <div className='fw-semibold mt-2'>Phase 3</div>
                    <div className='small text-body-secondary'>Vị trí sẽ có khi XP Engine hoạt động.</div>
                  </div>
                </div>
                <div className='col-md-4'>
                  <div className='border rounded p-3 h-100'>
                    <div className='small text-body-secondary'>Thống kê XP</div>
                    <div className='fw-semibold mt-2'>Phase 3</div>
                    <div className='small text-body-secondary'>Chưa phát sinh dữ liệu điểm.</div>
                  </div>
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CCard className='border-0 shadow-sm'>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2'>
          <strong>Danh sách game</strong>
          {loading ? <CSpinner size='sm' /> : null}
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /> Đang tải game...</div>
          ) : games.length === 0 ? (
            <div className='text-body-secondary'>Chưa có game nào trong tenant.</div>
          ) : (
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Code</CTableHeaderCell>
                  <CTableHeaderCell>Tên game</CTableHeaderCell>
                  <CTableHeaderCell>Game Type</CTableHeaderCell>
                  <CTableHeaderCell>Giai đoạn hiệu lực</CTableHeaderCell>
                  <CTableHeaderCell>Đăng ký</CTableHeaderCell>
                  <CTableHeaderCell>Các mốc thời gian</CTableHeaderCell>
                  <CTableHeaderCell>Người tham gia</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Tác vụ</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {games.map((game) => {
                  const statusBadge = getStatusBadgeConfig(game.effectiveStatus)
                  const isEditable = game?.editability?.canEdit !== false
                  const canPublish = game?.adminStatus === 'draft' && game?.editability?.canPublish !== false
                  return (
                    <CTableRow key={game.id}>
                      <CTableDataCell className='fw-semibold'>{game.code}</CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{game.name}</div>
                        <div className='small text-body-secondary'>{game.description || 'Không có mô tả'}</div>
                      </CTableDataCell>
                      <CTableDataCell>{game.gameType?.name || game.gameType?.code || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex flex-column gap-1'>
                          <CBadge color={statusBadge.color}>{statusBadge.label}</CBadge>
                          <span className='small text-body-secondary'>Admin: {game.adminStatus || '-'}</span>
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div>{formatDateTime(game.registrationOpenAt)}</div>
                        <div className='small text-body-secondary'>đến {formatDateTime(game.registrationCloseAt)}</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div>{formatDateTime(game.startsAt)}</div>
                        <div className='small text-body-secondary'>den {formatDateTime(game.endsAt)}</div>
                        {game.hasTrial ? (
                          <div className='small text-body-secondary'>Trial: {formatDateTime(game.trialStartAt)} đến {formatDateTime(game.trialEndAt)}</div>
                        ) : null}
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{game.participantCount}</div>
                        <div className='small text-body-secondary'>{game.activeParticipantCount} đang hoạt động</div>
                      </CTableDataCell>
                      <CTableDataCell className='text-end'>
                        <div className='d-inline-flex flex-wrap justify-content-end gap-2'>
                          <CButton color='info' variant='outline' size='sm' onClick={() => navigate(`/games/${game.id}`)}>
                            Chi tiết
                          </CButton>
                          <CButton color='secondary' variant='outline' size='sm' onClick={() => openEditModal(game)} disabled={!isEditable || Boolean(actionKey)}>
                            Sửa
                          </CButton>
                          <CButton
                            color='success'
                            variant='outline'
                            size='sm'
                            disabled={!canPublish || Boolean(actionKey)}
                            onClick={() => handlePublish(game)}
                          >
                            {actionKey === `publish:${game.id}` ? 'Đang công bố...' : 'Công bố'}
                          </CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      <CModal visible={modalVisible} onClose={closeModal} size='lg' backdrop='static'>
        <CModalHeader>
          <CModalTitle>{editingGame?.id ? 'Cập nhật game XP Challenge' : 'Tạo game XP Challenge'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            <CCol md={6}>
              <CFormLabel htmlFor='game-code'>Code</CFormLabel>
              <CFormInput
                id='game-code'
                value={formState.code}
                onChange={(event) => setFormState((prev) => ({ ...prev, code: event.target.value }))}
                disabled={Boolean(actionKey)}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='game-name'>Tên game</CFormLabel>
              <CFormInput
                id='game-name'
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                disabled={Boolean(actionKey)}
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel htmlFor='game-description'>Mô tả</CFormLabel>
              <CFormTextarea
                id='game-description'
                rows={4}
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                disabled={Boolean(actionKey)}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='game-type-display'>Game Type</CFormLabel>
              <CFormInput id='game-type-display' value='XP Challenge' disabled />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='game-timezone'>Timezone</CFormLabel>
              <CFormInput
                id='game-timezone'
                value={formState.timezone}
                onChange={(event) => setFormState((prev) => ({ ...prev, timezone: event.target.value }))}
                disabled={Boolean(actionKey)}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='registration-open-at'>Mở đăng ký</CFormLabel>
              <CFormInput
                id='registration-open-at'
                type='datetime-local'
                value={formState.registrationOpenAt}
                onChange={(event) => setFormState((prev) => ({ ...prev, registrationOpenAt: event.target.value }))}
                disabled={Boolean(actionKey)}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='registration-close-at'>Đóng đăng ký</CFormLabel>
              <CFormInput
                id='registration-close-at'
                type='datetime-local'
                value={formState.registrationCloseAt}
                onChange={(event) => setFormState((prev) => ({ ...prev, registrationCloseAt: event.target.value }))}
                disabled={Boolean(actionKey)}
              />
            </CCol>
            <CCol xs={12}>
              <CFormCheck
                id='has-trial-enabled'
                label='Có giai đoạn chơi thử'
                checked={Boolean(formState.hasTrial)}
                onChange={(event) => setFormState((prev) => ({
                  ...prev,
                  hasTrial: event.target.checked,
                  trialStartAt: event.target.checked ? prev.trialStartAt : '',
                  trialEndAt: event.target.checked ? prev.trialEndAt : '',
                }))}
                disabled={Boolean(actionKey)}
              />
            </CCol>
            {formState.hasTrial ? (
              <>
                <CCol md={6}>
                  <CFormLabel htmlFor='trial-start-at'>Bắt đầu chơi thử</CFormLabel>
                  <CFormInput
                    id='trial-start-at'
                    type='datetime-local'
                    value={formState.trialStartAt}
                    onChange={(event) => setFormState((prev) => ({ ...prev, trialStartAt: event.target.value }))}
                    disabled={Boolean(actionKey)}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='trial-end-at'>Kết thúc chơi thử</CFormLabel>
                  <CFormInput
                    id='trial-end-at'
                    type='datetime-local'
                    value={formState.trialEndAt}
                    onChange={(event) => setFormState((prev) => ({ ...prev, trialEndAt: event.target.value }))}
                    disabled={Boolean(actionKey)}
                  />
                </CCol>
              </>
            ) : null}
            <CCol md={6}>
              <CFormLabel htmlFor='starts-at'>Bắt đầu chính thức</CFormLabel>
              <CFormInput
                id='starts-at'
                type='datetime-local'
                value={formState.startsAt}
                onChange={(event) => setFormState((prev) => ({ ...prev, startsAt: event.target.value }))}
                disabled={Boolean(actionKey)}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='ends-at'>Kết thúc game</CFormLabel>
              <CFormInput
                id='ends-at'
                type='datetime-local'
                value={formState.endsAt}
                onChange={(event) => setFormState((prev) => ({ ...prev, endsAt: event.target.value }))}
                disabled={Boolean(actionKey)}
              />
            </CCol>
            <CCol xs={12}>
              <CFormCheck
                id='late-registration-enabled'
                label='Cho phép đăng ký muộn khi game đã bắt đầu'
                checked={Boolean(formState.lateRegistrationEnabled)}
                onChange={(event) => setFormState((prev) => ({ ...prev, lateRegistrationEnabled: event.target.checked }))}
                disabled={Boolean(actionKey)}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeModal} disabled={Boolean(actionKey)}>
            Huỷ
          </CButton>
          <CButton color='primary' onClick={handleSubmitForm} disabled={Boolean(actionKey)}>
            {actionKey === 'create' || actionKey.startsWith('update:') ? 'Đang lưu...' : 'Lưu game'}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}
