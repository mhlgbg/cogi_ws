import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CFormSelect,
  CFormTextarea,
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
  createResetChallenge,
  getGameApiMessage,
  getGameDetail,
  publishGame,
  resetGameProgress,
  unpublishGame,
  updateGameRules,
} from '../services/gameService'
import { createRuleDrafts, formatDateTime, getStatusBadgeConfig } from '../utils/gameUi'

function StatTile({ label, value, helper }) {
  return (
    <CCol sm={6} xl={3}>
      <div className='border rounded p-3 h-100'>
        <div className='small text-body-secondary'>{label}</div>
        <div className='h3 mb-1 mt-2'>{value}</div>
        {helper ? <div className='small text-body-secondary'>{helper}</div> : null}
      </div>
    </CCol>
  )
}

export default function GameDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [detail, setDetail] = useState(null)
  const [ruleDrafts, setRuleDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingRules, setSavingRules] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)
  const [resetModalVisible, setResetModalVisible] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetChallenge, setResetChallenge] = useState(null)
  const [resetReason, setResetReason] = useState('')
  const [resetAnswer, setResetAnswer] = useState('')
  const [resetConfirmed, setResetConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadDetail() {
    setLoading(true)
    setError('')
    try {
      const result = await getGameDetail(id)
      setDetail(result)
      setRuleDrafts(createRuleDrafts(result?.rules || []))
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Khong tai duoc chi tiet game'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id])

  const game = detail?.game || null
  const adminActions = detail?.adminActions || null
  const legacyEditable = ['draft', 'registration', 'trial_upcoming'].includes(String(game?.effectiveStatus || '').toLowerCase())
  const canEditRules = adminActions?.rules?.available === undefined
    ? legacyEditable
    : adminActions?.rules?.available === true
  const statusBadge = getStatusBadgeConfig(game?.effectiveStatus)
  const phaseLabel = game?.effectivePhase?.label || statusBadge.label
  const phaseNotice = game?.effectivePhase?.notice || ''
  const xpSummary = detail?.xpSummary || { byActivity: [], byPhase: [], eventStatus: [], recentLedgers: [] }
  const leaderboards = detail?.leaderboards || { officialTop10: [], trialTop10: [] }
  const recentEvents = Array.isArray(detail?.recentEvents) ? detail.recentEvents : []

  async function handleSaveRules() {
    setSavingRules(true)
    setError('')
    setSuccess('')
    try {
      const payload = ruleDrafts.map((rule) => ({
        activityCode: rule.activityCode,
        description: rule.description,
        isEnabled: rule.isEnabled,
        xpAmount: Number(rule.xpAmount || 0),
        maxCount: Number(rule.maxCount || 0),
        limitPeriod: rule.limitPeriod,
      }))

      const nextDetail = await updateGameRules(id, payload)
      setDetail(nextDetail)
      setRuleDrafts(createRuleDrafts(nextDetail?.rules || []))
      setSuccess('Da cap nhat XP rules cho game')
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Khong cap nhat duoc XP rules'))
    } finally {
      setSavingRules(false)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setError('')
    setSuccess('')
    try {
      const nextDetail = await publishGame(id)
      setDetail(nextDetail)
      setRuleDrafts(createRuleDrafts(nextDetail?.rules || []))
      setSuccess('Da cong bo game thanh cong')
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Khong cong bo duoc game'))
    } finally {
      setPublishing(false)
    }
  }

  async function handleUnpublish() {
    if (!adminActions?.unpublish?.available) return

    const confirmed = window.confirm(
      adminActions?.unpublish?.warning
        || 'Ban co chac chan muon rut lai cong bo game nay ve draft?'
    )
    if (!confirmed) return

    setUnpublishing(true)
    setError('')
    setSuccess('')
    try {
      const nextDetail = await unpublishGame(id)
      setDetail(nextDetail)
      setRuleDrafts(createRuleDrafts(nextDetail?.rules || []))
      setSuccess(nextDetail?.message || 'Da rut lai cong bo game thanh cong')
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Khong rut lai cong bo duoc game'))
    } finally {
      setUnpublishing(false)
    }
  }

  async function handleOpenResetModal() {
    if (!adminActions?.reset?.available) return

    setResetModalVisible(true)
    setResetLoading(true)
    setResetSubmitting(false)
    setResetChallenge(null)
    setResetReason('')
    setResetAnswer('')
    setResetConfirmed(false)
    setError('')
    setSuccess('')

    try {
      const result = await createResetChallenge(id)
      setResetChallenge(result?.challenge || null)
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Khong tao duoc challenge reset'))
      setResetModalVisible(false)
    } finally {
      setResetLoading(false)
    }
  }

  function handleCloseResetModal() {
    if (resetLoading || resetSubmitting) return
    setResetModalVisible(false)
    setResetChallenge(null)
    setResetReason('')
    setResetAnswer('')
    setResetConfirmed(false)
  }

  async function handleConfirmReset() {
    if (!resetChallenge?.id) return

    setResetSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const result = await resetGameProgress(id, {
        challengeId: resetChallenge.id,
        answer: Number(resetAnswer),
        reason: resetReason,
        acknowledged: resetConfirmed,
      })
      if (result?.detail) {
        setDetail(result.detail)
        setRuleDrafts(createRuleDrafts(result.detail?.rules || []))
      }
      setSuccess(result?.message || 'Da reset game thanh cong')
      setResetModalVisible(false)
      setResetChallenge(null)
      setResetReason('')
      setResetAnswer('')
      setResetConfirmed(false)
    } catch (requestError) {
      setError(getGameApiMessage(requestError, 'Khong reset duoc game'))
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <div className='container-fluid py-4'>
      <div className='d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4'>
        <div>
          <CButton color='secondary' variant='outline' size='sm' className='mb-3' onClick={() => navigate('/games')}>
            Quay lai danh sach game
          </CButton>
          <h2 className='mb-1'>{game?.name || 'Chi tiet Game'}</h2>
          <p className='text-body-secondary mb-0'>
            Xem vòng đời game, cấu hình luật XP, danh sách đăng ký và vị trí dành cho bảng xếp hạng Phase 3.
          </p>
        </div>
        <div className='d-flex flex-wrap align-items-center gap-2'>
          <CBadge color={statusBadge.color}>{phaseLabel}</CBadge>
          {game?.adminStatus === 'draft' ? (
            <CButton color='success' onClick={handlePublish} disabled={publishing}>
              {publishing ? 'Dang cong bo...' : 'Cong bo game'}
            </CButton>
          ) : null}
        </div>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {phaseNotice ? <CAlert color={game?.effectivePhase?.isTrial ? 'warning' : 'info'}>{phaseNotice}</CAlert> : null}

      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /> Dang tai chi tiet game...</div>
      ) : !game ? (
        <CAlert color='warning'>Khong tim thay game.</CAlert>
      ) : (
        <>
          <CRow className='g-3 mb-4'>
            <StatTile label='Người đăng ký' value={detail?.stats?.totalParticipants || 0} helper='Tổng số participant' />
            <StatTile label='Đang hoạt động' value={detail?.stats?.activeParticipants || 0} helper='Người tham gia active' />
            <StatTile label='Luật đã cấu hình' value={detail?.stats?.configuredRules || 0} helper='3 luật mục tiêu' />
            <StatTile label='Luật đang bật' value={detail?.stats?.enabledRules || 0} helper='Hoạt động được tính điểm' />
          </CRow>

          <CRow className='g-3 mb-4'>
            <CCol xl={6}>
              <CCard className='h-100 border-0 shadow-sm'>
                <CCardHeader><strong>Thong tin game</strong></CCardHeader>
                <CCardBody>
                  <dl className='row mb-0'>
                    <dt className='col-sm-4'>Code</dt>
                    <dd className='col-sm-8'>{game.code}</dd>
                    <dt className='col-sm-4'>Loại game</dt>
                    <dd className='col-sm-8'>{game.gameType?.name || game.gameType?.code || '-'}</dd>
                    <dt className='col-sm-4'>Múi giờ</dt>
                    <dd className='col-sm-8'>{game.timezone || '-'}</dd>
                    <dt className='col-sm-4'>Mở đăng ký</dt>
                    <dd className='col-sm-8'>{formatDateTime(game.registrationOpenAt)}</dd>
                    <dt className='col-sm-4'>Đóng đăng ký</dt>
                    <dd className='col-sm-8'>{formatDateTime(game.registrationCloseAt)}</dd>
                    <dt className='col-sm-4'>Bắt đầu official</dt>
                    <dd className='col-sm-8'>{formatDateTime(game.startsAt)}</dd>
                    <dt className='col-sm-4'>Kết thúc official</dt>
                    <dd className='col-sm-8'>{formatDateTime(game.endsAt)}</dd>
                    <dt className='col-sm-4'>Có trial</dt>
                    <dd className='col-sm-8'>{game.hasTrial ? 'Có' : 'Không'}</dd>
                    {game.hasTrial ? (
                      <>
                        <dt className='col-sm-4'>Bắt đầu trial</dt>
                        <dd className='col-sm-8'>{formatDateTime(game.trialStartAt)}</dd>
                        <dt className='col-sm-4'>Kết thúc trial</dt>
                        <dd className='col-sm-8'>{formatDateTime(game.trialEndAt)}</dd>
                      </>
                    ) : null}
                    <dt className='col-sm-4'>Giai đoạn hiện tại</dt>
                    <dd className='col-sm-8'>{phaseLabel}</dd>
                    <dt className='col-sm-4'>Đăng ký muộn</dt>
                    <dd className='col-sm-8'>{game.lateRegistrationEnabled ? 'Cho phép' : 'Không cho phép'}</dd>
                    <dt className='col-sm-4'>Mô tả</dt>
                    <dd className='col-sm-8'>{game.description || 'Không có mô tả'}</dd>
                  </dl>
                </CCardBody>
              </CCard>
            </CCol>

            <CCol xl={6}>
              <CCard className='h-100 border-0 shadow-sm'>
                <CCardHeader><strong>Dành cho Phase 3</strong></CCardHeader>
                <CCardBody>
                  <div className='border rounded p-3 mb-3'>
                    <div className='fw-semibold mb-1'>Bảng xếp hạng</div>
                    <div className='text-body-secondary small'>
                      Chưa hiển thị bảng xếp hạng vì XP Engine và cơ chế cộng điểm thực tế sẽ được triển khai ở Phase 3.
                    </div>
                  </div>
                  <div className='border rounded p-3'>
                    <div className='fw-semibold mb-1'>Thong ke XP theo giai doan</div>
                    <div className='text-body-secondary small'>
                      Vung nay duoc giu cho Trial XP va Official XP khi XP Engine duoc trien khai o Phase 3.
                    </div>
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <CRow className='g-3 mb-4'>
            <CCol xl={6}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Bang xep hang Official</strong></CCardHeader>
                <CCardBody>
                  {!leaderboards?.officialTop10?.length ? (
                    <div className='text-body-secondary'>Chua co du lieu leaderboard official.</div>
                  ) : (
                    <div className='d-grid gap-2'>
                      {leaderboards.officialTop10.map((item) => (
                        <div key={`official:${item.participantId}`} className='d-flex justify-content-between align-items-center border rounded px-3 py-2'>
                          <div>
                            <div className='fw-semibold'>#{item.rank} {item.fullName || item.username || `User ${item.userId}`}</div>
                            <div className='small text-body-secondary'>{item.username || item.email || '-'}</div>
                          </div>
                          <div className='fw-semibold'>{item.rankScore}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
            <CCol xl={6}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Bang xep hang Trial</strong></CCardHeader>
                <CCardBody>
                  {!leaderboards?.trialTop10?.length ? (
                    <div className='text-body-secondary'>Chua co du lieu leaderboard trial.</div>
                  ) : (
                    <div className='d-grid gap-2'>
                      {leaderboards.trialTop10.map((item) => (
                        <div key={`trial:${item.participantId}`} className='d-flex justify-content-between align-items-center border rounded px-3 py-2'>
                          <div>
                            <div className='fw-semibold'>#{item.rank} {item.fullName || item.username || `User ${item.userId}`}</div>
                            <div className='small text-body-secondary'>{item.username || item.email || '-'}</div>
                          </div>
                          <div className='fw-semibold'>{item.rankScore}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <CRow className='g-3 mb-4'>
            <CCol xl={6}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Thong ke XP theo activity</strong></CCardHeader>
                <CCardBody>
                  {!xpSummary.byActivity?.length ? (
                    <div className='text-body-secondary'>Chua co thong ke XP.</div>
                  ) : (
                    <CTable responsive hover align='middle'>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Activity</CTableHeaderCell>
                          <CTableHeaderCell>Phase</CTableHeaderCell>
                          <CTableHeaderCell>So lan</CTableHeaderCell>
                          <CTableHeaderCell>Tong XP</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {xpSummary.byActivity.map((item) => (
                          <CTableRow key={`${item.activityCode}:${item.phase}`}>
                            <CTableDataCell>{item.activityCode}</CTableDataCell>
                            <CTableDataCell>{item.phase}</CTableDataCell>
                            <CTableDataCell>{item.awardCount}</CTableDataCell>
                            <CTableDataCell>{item.totalXp}</CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
            <CCol xl={6}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Trang thai xu ly event</strong></CCardHeader>
                <CCardBody>
                  {!xpSummary.eventStatus?.length ? (
                    <div className='text-body-secondary'>Chua co event nao.</div>
                  ) : (
                    <div className='d-grid gap-2'>
                      {xpSummary.eventStatus.map((item) => (
                        <div key={item.status} className='d-flex justify-content-between border rounded px-3 py-2'>
                          <span>{item.status}</span>
                          <strong>{item.total}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <CCard className='border-0 shadow-sm mb-4'>
            <CCardHeader><strong>Thao tac quan tri</strong></CCardHeader>
            <CCardBody>
              <div className='small text-body-secondary mb-3'>
                Phien hien tai: Run version {game.currentRunVersion || 1}. Reset se mo mot phien moi va giu lai lich su phien cu de audit.
              </div>
              <CRow className='g-3'>
                <CCol lg={6}>
                  <div className='border rounded p-3 h-100'>
                    <div className='fw-semibold mb-2'>Rut lai cong bo</div>
                    <div className='small text-body-secondary mb-3'>
                      Dua game ve draft de tam ngung dang ky/ghi XP moi truoc Official. Du lieu participants, events va ledgers da co se duoc giu nguyen de audit.
                    </div>
                    {adminActions?.unpublish?.reason ? (
                      <CAlert color='warning' className='py-2 mb-3'>{adminActions.unpublish.reason}</CAlert>
                    ) : null}
                    {adminActions?.unpublish?.warning ? (
                      <CAlert color='info' className='py-2 mb-3'>{adminActions.unpublish.warning}</CAlert>
                    ) : null}
                    <CButton
                      color='secondary'
                      variant='outline'
                      disabled={!adminActions?.unpublish?.available || unpublishing}
                      onClick={handleUnpublish}
                    >
                      {unpublishing ? 'Dang xu ly...' : 'Rut lai cong bo'}
                    </CButton>
                  </div>
                </CCol>

                <CCol lg={6}>
                  <div className='border rounded p-3 h-100'>
                    <div className='fw-semibold mb-2 text-danger'>Reset du lieu choi</div>
                    <div className='small text-body-secondary mb-3'>
                      Chi reset du lieu phien hien tai. Rules, Game Type va cau hinh game duoc giu nguyen, nhung nguoi choi se phai dang ky lai o phien moi.
                    </div>
                    {adminActions?.reset?.reason ? (
                      <CAlert color='warning' className='py-2 mb-3'>{adminActions.reset.reason}</CAlert>
                    ) : null}
                    <CAlert color='danger' className='py-2 mb-3'>
                      {adminActions?.reset?.warning || 'Reset chi duoc phep sau khi game da ve draft va khong duoc thao tac nham.'}
                    </CAlert>
                    <CButton
                      color='danger'
                      disabled={!adminActions?.reset?.available || resetLoading || resetSubmitting}
                      onClick={handleOpenResetModal}
                    >
                      {resetLoading ? 'Dang tao challenge...' : 'Reset du lieu choi'}
                    </CButton>
                  </div>
                </CCol>
              </CRow>
            </CCardBody>
          </CCard>

          <CCard className='border-0 shadow-sm mb-4'>
            <CCardHeader className='d-flex justify-content-between align-items-center gap-2'>
              <strong>Cấu hình luật XP</strong>
              {savingRules ? <CSpinner size='sm' /> : null}
            </CCardHeader>
            <CCardBody>
              <CRow className='g-3'>
                {ruleDrafts.map((rule, index) => (
                  <CCol lg={4} key={rule.activityCode}>
                    <div className='border rounded p-3 h-100'>
                      <div className='d-flex justify-content-between align-items-start gap-2 mb-3'>
                        <div>
                          <div className='fw-semibold'>{rule.activityName}</div>
                          <div className='small text-body-secondary'>{rule.activityCode}</div>
                        </div>
                        <CFormCheck
                          type='checkbox'
                          checked={Boolean(rule.isEnabled)}
                          disabled={savingRules}
                          onChange={(event) => setRuleDrafts((prev) => prev.map((item, itemIndex) => (
                            itemIndex === index
                              ? { ...item, isEnabled: event.target.checked }
                              : item
                          )))}
                        />
                      </div>

                      <div className='mb-3'>
                        <CFormLabel>Mô tả</CFormLabel>
                        <CFormTextarea
                          rows={2}
                          value={rule.description}
                          disabled={savingRules}
                          onChange={(event) => setRuleDrafts((prev) => prev.map((item, itemIndex) => (
                            itemIndex === index
                              ? { ...item, description: event.target.value }
                              : item
                          )))}
                        />
                      </div>

                      <CRow className='g-3'>
                        <CCol md={6}>
                          <CFormLabel>XP mỗi lần</CFormLabel>
                          <CFormInput
                            type='number'
                            min='0'
                            value={rule.xpAmount}
                            disabled={savingRules}
                            onChange={(event) => setRuleDrafts((prev) => prev.map((item, itemIndex) => (
                              itemIndex === index
                                ? { ...item, xpAmount: event.target.value }
                                : item
                            )))}
                          />
                        </CCol>
                        <CCol md={6}>
                          <CFormLabel>Số lượt tính điểm</CFormLabel>
                          <CFormInput
                            type='number'
                            min='0'
                            value={rule.maxCount}
                            disabled={savingRules}
                            onChange={(event) => setRuleDrafts((prev) => prev.map((item, itemIndex) => (
                              itemIndex === index
                                ? { ...item, maxCount: event.target.value }
                                : item
                            )))}
                          />
                        </CCol>
                        <CCol md={12}>
                          <CFormLabel>Chu kỳ giới hạn</CFormLabel>
                          <CFormSelect
                            value={rule.limitPeriod}
                            disabled={savingRules}
                            onChange={(event) => setRuleDrafts((prev) => prev.map((item, itemIndex) => (
                              itemIndex === index
                                ? { ...item, limitPeriod: event.target.value }
                                : item
                            )))}
                          >
                            <option value='daily'>Theo ngày</option>
                            <option value='game'>Toàn bộ game</option>
                          </CFormSelect>
                        </CCol>
                      </CRow>
                    </div>
                  </CCol>
                ))}
              </CRow>
              {adminActions?.rules?.reason ? (
                <CAlert color='warning' className='mt-3 mb-0'>{adminActions.rules.reason}</CAlert>
              ) : null}
              <div className='mt-3 d-flex justify-content-end'>
                <CButton color='primary' onClick={handleSaveRules} disabled={savingRules}>
                  {savingRules ? 'Đang lưu...' : 'Lưu luật XP'}
                </CButton>
              </div>
            </CCardBody>
          </CCard>

          <CRow className='g-3 mb-4'>
            <CCol xl={6}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Lich su XP gan day</strong></CCardHeader>
                <CCardBody>
                  {!xpSummary.recentLedgers?.length ? (
                    <div className='text-body-secondary'>Chua co ledger nao.</div>
                  ) : (
                    <CTable responsive hover align='middle'>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Thoi diem</CTableHeaderCell>
                          <CTableHeaderCell>Activity</CTableHeaderCell>
                          <CTableHeaderCell>Phase</CTableHeaderCell>
                          <CTableHeaderCell>XP</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {xpSummary.recentLedgers.map((item) => (
                          <CTableRow key={item.id}>
                            <CTableDataCell>{formatDateTime(item.recordedAt)}</CTableDataCell>
                            <CTableDataCell>{item.activityCode}</CTableDataCell>
                            <CTableDataCell>{item.phase}</CTableDataCell>
                            <CTableDataCell>{item.xpAmount}</CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
            <CCol xl={6}>
              <CCard className='border-0 shadow-sm h-100'>
                <CCardHeader><strong>Event processing status</strong></CCardHeader>
                <CCardBody>
                  {!recentEvents.length ? (
                    <div className='text-body-secondary'>Chua co event nao.</div>
                  ) : (
                    <CTable responsive hover align='middle'>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Thoi diem</CTableHeaderCell>
                          <CTableHeaderCell>Activity</CTableHeaderCell>
                          <CTableHeaderCell>Status</CTableHeaderCell>
                          <CTableHeaderCell>Loi</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {recentEvents.map((item) => (
                          <CTableRow key={item.id}>
                            <CTableDataCell>{formatDateTime(item.occurredAt)}</CTableDataCell>
                            <CTableDataCell>{item.activityCode}</CTableDataCell>
                            <CTableDataCell>{item.status}</CTableDataCell>
                            <CTableDataCell>{item.errorMessage || item.lastErrorCode || '-'}</CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <CCard className='border-0 shadow-sm'>
            <CCardHeader><strong>Danh sach nguoi dang ky</strong></CCardHeader>
            <CCardBody>
              {!detail?.participants?.length ? (
                <div className='text-body-secondary'>Chưa có người đăng ký game này.</div>
              ) : (
                <CTable responsive hover align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Username</CTableHeaderCell>
                      <CTableHeaderCell>Họ tên</CTableHeaderCell>
                      <CTableHeaderCell>Email</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Thời điểm đăng ký</CTableHeaderCell>
                      <CTableHeaderCell>Tổng XP</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {detail.participants.map((participant) => (
                      <CTableRow key={participant.id}>
                        <CTableDataCell>{participant.user?.username || '-'}</CTableDataCell>
                        <CTableDataCell>{participant.user?.fullName || '-'}</CTableDataCell>
                        <CTableDataCell>{participant.user?.email || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={participant.status === 'active' ? 'success' : 'secondary'}>
                            {participant.status || '-'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{formatDateTime(participant.registeredAt)}</CTableDataCell>
                        <CTableDataCell>{participant.totalXp}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </>
      )}

      <CModal visible={resetModalVisible} onClose={handleCloseResetModal} backdrop='static'>
        <CModalHeader>
          <CModalTitle>Reset du lieu choi</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {resetLoading ? (
            <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /> Dang tao challenge...</div>
          ) : (
            <>
              <CAlert color='danger'>
                Thao tac nay se mo mot run version moi. Participant, leaderboard va tong XP hien tai se tro ve trang thai rong; nguoi choi phai dang ky lai.
              </CAlert>

              <div className='mb-3'>
                <CFormLabel htmlFor='reset-reason'>Ly do reset</CFormLabel>
                <CFormTextarea
                  id='reset-reason'
                  rows={3}
                  value={resetReason}
                  onChange={(event) => setResetReason(event.target.value)}
                  disabled={resetSubmitting}
                />
              </div>

              {resetChallenge ? (
                <div className='border rounded p-3 mb-3 bg-light'>
                  <div className='fw-semibold mb-2'>Xac nhan bang phep nhan</div>
                  <div className='mb-2'>
                    Nhap ket qua cua phep tinh: <strong>{resetChallenge.leftOperand} x {resetChallenge.rightOperand}</strong>
                  </div>
                  <div className='small text-body-secondary'>
                    Challenge het han luc: {formatDateTime(resetChallenge.expiresAt)}. So lan con lai: {resetChallenge.remainingAttempts}.
                  </div>
                </div>
              ) : null}

              <div className='mb-3'>
                <CFormLabel htmlFor='reset-answer'>Ket qua phep nhan</CFormLabel>
                <CFormInput
                  id='reset-answer'
                  type='number'
                  value={resetAnswer}
                  onChange={(event) => setResetAnswer(event.target.value)}
                  disabled={resetSubmitting || !resetChallenge}
                />
              </div>

              <CFormCheck
                id='reset-confirmed'
                label='Toi hieu reset se tao mot phien choi moi va nguoi choi phai dang ky lai.'
                checked={Boolean(resetConfirmed)}
                onChange={(event) => setResetConfirmed(event.target.checked)}
                disabled={resetSubmitting}
              />
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleCloseResetModal} disabled={resetLoading || resetSubmitting}>
            Dong
          </CButton>
          <CButton
            color='danger'
            disabled={
              resetLoading
              || resetSubmitting
              || !resetChallenge
              || !resetConfirmed
              || !String(resetReason || '').trim()
              || !String(resetAnswer || '').trim()
            }
            onClick={handleConfirmReset}
          >
            {resetSubmitting ? 'Dang reset...' : 'Xac nhan reset'}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}
