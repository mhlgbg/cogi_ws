import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CTabContent,
  CTabPane,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import ExamCampaignFormModal, { formatDisplayDate, toCampaignFormValues } from '../components/ExamCampaignFormModal'
import AssessmentSessionModal, { DEFAULT_SESSION_FORM, toIsoDateTime, toSessionFormValues } from '../components/AssessmentSessionModal'
import AssessmentSessionCloneModal from '../components/AssessmentSessionCloneModal'
import ExamSlotFormModal, { DEFAULT_SLOT_FORM, formatSlotDateTime, toIsoDateTime as toSlotIsoDateTime, toSlotFormValues } from '../components/ExamSlotFormModal'
import { useFeature } from '../../../contexts/FeatureContext'
import api from '../../../api/axios'
import {
  cloneAssessmentSession,
  createAssessmentSession,
  createExamSlot,
  getExamCampaign,
  listAssessmentSessions,
  listExamSlots,
  updateAssessmentSession,
  updateExamCampaign,
  updateExamSlot,
} from '../services/examSessionApi'

function normalizeRowList(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.results)) return result.results
  return []
}

function formatDateRange(startAt, endAt) {
  const start = startAt ? new Date(startAt) : null
  const end = endAt ? new Date(endAt) : null
  if (!start && !end) return '—'
  const fmt = (value) => {
    if (!value || Number.isNaN(value.getTime())) return '—'
    return value.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  }
  return `${fmt(start)} → ${fmt(end)}`
}

function formatCampaignRange(startDate, endDate) {
  const startText = formatDisplayDate(startDate)
  const endText = formatDisplayDate(endDate)

  if (startText === '—' && endText === '—') return '—'
  if (startText === '—') return `Đến ${endText}`
  if (endText === '—') return `Từ ${startText}`
  return `${startText} - ${endText}`
}

function statusBadge(status) {
  const label = status === 'ready' ? 'Sẵn sàng' : status === 'draft' ? 'Bản nháp' : status || 'draft'
  const color = status === 'ready' ? 'success' : 'secondary'
  return <CBadge color={color}>{label}</CBadge>
}

function slotStatusBadge(status) {
  const normalized = status || 'draft'
  const config = {
    draft: { label: 'Bản nháp', color: 'secondary' },
    ready: { label: 'Sẵn sàng', color: 'success' },
    archived: { label: 'Lưu trữ', color: 'dark' },
  }
  const item = config[normalized] || { label: normalized, color: 'secondary' }
  return <CBadge color={item.color}>{item.label}</CBadge>
}

function sessionStatusBadge(status) {
  const normalized = status || 'draft'
  const config = {
    draft: { label: 'Bản nháp', color: 'secondary' },
    ready: { label: 'Sẵn sàng', color: 'success' },
  }
  const item = config[normalized] || { label: normalized, color: 'secondary' }
  return <CBadge color={item.color}>{item.label}</CBadge>
}

export default function ExamCampaignDetailPage() {
  const { documentId, id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const feature = useFeature()
  const campaignId = documentId || id

  const [campaign, setCampaign] = useState(null)
  const [slots, setSlots] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [showSlotModal, setShowSlotModal] = useState(false)
  const [slotEditingId, setSlotEditingId] = useState(null)
  const [slotForm, setSlotForm] = useState(DEFAULT_SLOT_FORM)
  const [savingSlot, setSavingSlot] = useState(false)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionEditingId, setSessionEditingId] = useState(null)
  const [sessionForm, setSessionForm] = useState(DEFAULT_SESSION_FORM)
  const [savingSession, setSavingSession] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneTargetSession, setCloneTargetSession] = useState(null)
  const [savingClone, setSavingClone] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [subjectsError, setSubjectsError] = useState('')

  const canManageCampaign = Boolean(feature?.hasFeature?.('exam-campaign.manage'))
  const canManageSlots = canManageCampaign || Boolean(feature?.hasFeature?.('exam-slot.manage'))
  const canManageSessions = canManageCampaign || Boolean(feature?.hasFeature?.('assessment-session.manage'))
  const canViewSlots = canManageSlots
  const canViewSessions = canManageSessions

  async function loadCampaign() {
    if (!campaignId) return
    setLoading(true)
    setError('')
    try {
      const result = await getExamCampaign(campaignId)
      const nextCampaign = result?.data || result || null
      setCampaign(nextCampaign)
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không tải được đợt thi')
    } finally {
      setLoading(false)
    }
  }

  async function loadSlots() {
    if (!campaignId) return
    try {
      const result = await listExamSlots({ campaignId: campaign?.id || campaignId })
      setSlots(normalizeRowList(result))
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không tải được danh sách ca thi')
    }
  }

  async function loadSessions() {
    if (!campaignId) return
    try {
      const campaignRef = campaign?.id || campaignId
      const result = await listAssessmentSessions({ campaign: campaignRef })
      setSessions(normalizeRowList(result))
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không tải được danh sách phiên thi')
    }
  }

  async function loadSubjects() {
    setSubjectsLoading(true)
    setSubjectsError('')

    try {
      const response = await api.get('/learning-management/subjects', { params: { pageSize: 200 } })
      const payload = response?.data?.data ?? response?.data ?? []
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
      setSubjects(rows.map((subject) => ({
        ...subject,
        id: subject?.id ?? subject?.documentId ?? '',
        documentId: subject?.documentId ?? null,
      })))
    } catch (err) {
      setSubjects([])
      setSubjectsError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Không tải được danh sách môn học thuộc tenant hiện tại.')
    } finally {
      setSubjectsLoading(false)
    }
  }

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab)
    }
  }, [location.state?.activeTab])

  useEffect(() => { loadCampaign() }, [campaignId])
  useEffect(() => { loadSubjects() }, [])
  useEffect(() => {
    if (campaign) {
      loadSlots()
      loadSessions()
    }
  }, [campaign])

  async function handleCampaignSave(nextForm) {
    if (!campaignId) return
    try {
      setSavingCampaign(true)
      setError('')
      const payload = {
        ...toCampaignFormValues(nextForm),
        code: String(nextForm?.code || '').trim(),
        name: String(nextForm?.name || '').trim(),
        description: String(nextForm?.description || '').trim(),
      }
      if (!payload.code || !payload.name) {
        setError('Mã và tên đợt thi là bắt buộc')
        return
      }
      if (payload.startDate && payload.endDate && payload.startDate > payload.endDate) {
        setError('Ngày bắt đầu không được sau ngày kết thúc')
        return
      }
      await updateExamCampaign(campaignId, payload)
      setShowEditModal(false)
      await loadCampaign()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không cập nhật được đợt thi')
    } finally {
      setSavingCampaign(false)
    }
  }

  async function handleSlotSubmit(nextForm) {
    if (!campaignId) return
    try {
      setSavingSlot(true)
      setError('')

      const payload = {
        campaign: campaign?.id || Number(campaignId),
        code: String(nextForm?.code || '').trim(),
        name: String(nextForm?.name || '').trim(),
        startAt: toSlotIsoDateTime(nextForm?.startAt),
        endAt: toSlotIsoDateTime(nextForm?.endAt),
        status: nextForm?.status || 'draft',
      }

      if (!payload.code || !payload.name || !payload.startAt || !payload.endAt) {
        setError('Mã, tên, thời gian bắt đầu và kết thúc ca thi là bắt buộc')
        return
      }
      if (new Date(payload.endAt).getTime() <= new Date(payload.startAt).getTime()) {
        setError('Thời gian kết thúc phải sau thời gian bắt đầu')
        return
      }

      let createdOrUpdated = null
      if (slotEditingId) {
        createdOrUpdated = await updateExamSlot(slotEditingId, payload)
      } else {
        createdOrUpdated = await createExamSlot(payload)
        setSlots((prev) => {
          const base = Array.isArray(prev) ? prev : []
          const key = createdOrUpdated?.id || createdOrUpdated?.documentId
          const exists = base.some((item) => (item.id || item.documentId) === key)
          return exists ? base : [createdOrUpdated, ...base]
        })
      }

      setShowSlotModal(false)
      setSlotForm(DEFAULT_SLOT_FORM)
      setSlotEditingId(null)
      await loadSlots()
      setError('')
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không lưu được ca thi')
    } finally {
      setSavingSlot(false)
    }
  }

  async function handleSessionSubmit(nextForm) {
    if (!campaignId) return
    try {
      setSavingSession(true)
      setError('')

      const normalizedCampaignRef = campaign?.id ?? campaign?.documentId ?? campaignId ?? ''
      const payload = {
        campaign: normalizedCampaignRef,
        campaignId: normalizedCampaignRef,
        slot: nextForm?.slot || '',
        slotId: nextForm?.slot || '',
        subject: nextForm?.subject || '',
        subjectId: nextForm?.subject || '',
        code: String(nextForm?.code || '').trim(),
        name: String(nextForm?.name || '').trim(),
        durationMinutes: Number(nextForm?.durationMinutes || 60),
        status: 'draft',
        startAt: nextForm?.startAt ? toIsoDateTime(nextForm.startAt) : null,
        endAt: nextForm?.endAt ? toIsoDateTime(nextForm.endAt) : null,
        examLocation: String(nextForm?.examLocation || '').trim() || null,
        roomCode: String(nextForm?.roomCode || '').trim() || null,
        roomName: String(nextForm?.roomName || '').trim() || null,
        roomCapacity: nextForm?.roomCapacity === '' || nextForm?.roomCapacity === null || nextForm?.roomCapacity === undefined ? null : Number(nextForm.roomCapacity),
      }

      if (!payload.slot || !payload.subject || !payload.code || !payload.name) {
        setError('Cần chọn ca thi, môn thi, mã và tên phiên')
        return
      }
      if (!Number.isFinite(payload.durationMinutes) || payload.durationMinutes <= 0) {
        setError('Thời lượng phải là số nguyên dương')
        return
      }
      if (payload.startAt && payload.endAt && new Date(payload.endAt).getTime() <= new Date(payload.startAt).getTime()) {
        setError('Thời gian kết thúc phải sau thời gian bắt đầu')
        return
      }

      let createdOrUpdated = null
      if (sessionEditingId) {
        createdOrUpdated = await updateAssessmentSession(sessionEditingId, payload)
      } else {
        createdOrUpdated = await createAssessmentSession(payload)
        setSessions((prev) => {
          const base = Array.isArray(prev) ? prev : []
          const key = createdOrUpdated?.id || createdOrUpdated?.documentId
          const exists = base.some((item) => (item.id || item.documentId) === key)
          return exists ? base : [createdOrUpdated, ...base]
        })
      }

      setShowSessionModal(false)
      setSessionEditingId(null)
      setSessionForm(DEFAULT_SESSION_FORM)
      await loadSessions()
      setError('')
      setActiveTab('sessions')
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không lưu được phiên thi')
    } finally {
      setSavingSession(false)
    }
  }

  async function handleSessionClone(count) {
    if (!cloneTargetSession) return
    try {
      setSavingClone(true)
      setError('')
      const sessionId = cloneTargetSession.id || cloneTargetSession.documentId
      if (!sessionId) {
        throw new Error('Không xác định được phiên thi nguồn để nhân bản')
      }

      const requestCount = Number(count)
      if (!Number.isInteger(requestCount) || requestCount < 1 || requestCount > 10) {
        throw new Error('Số phiên cần nhân bản phải từ 1 đến 10')
      }

      await cloneAssessmentSession(sessionId, {
        count: requestCount,
        idempotencyKey: `clone:${sessionId}:${Date.now()}`,
      })

      setShowCloneModal(false)
      setCloneTargetSession(null)
      await loadSessions()
      setActiveTab('sessions')
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.message || 'Không nhân bản được phiên thi')
    } finally {
      setSavingClone(false)
    }
  }

  const stats = useMemo(() => ({
    slotCount: slots.length,
    sessionCount: sessions.length,
  }), [slots.length, sessions.length])

  if (!campaign && loading) {
    return <div>Đang tải đợt thi...</div>
  }

  if (!campaign) {
    return <CAlert color='danger'>{error || 'Không tìm thấy đợt thi'}</CAlert>
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <div className='d-flex align-items-center justify-content-between gap-3 flex-wrap'>
          <div>
            <h4 className='mb-1'>{campaign.name}</h4>
            <small className='text-medium-emphasis'>Mã: {campaign.code}</small>
          </div>
          <div className='d-flex gap-2'>
            <CButton color='primary' onClick={() => setShowEditModal(true)}>Sửa đợt thi</CButton>
            <CButton color='secondary' variant='outline' onClick={() => navigate('/exam-campaigns')}>Quay lại danh sách</CButton>
          </div>
        </div>
      </CCol>

      <CCol xs={12}>
        <div className='d-flex gap-2 mb-3 flex-wrap'>
          <CButton color={activeTab === 'overview' ? 'primary' : 'light'} onClick={() => setActiveTab('overview')}>Tổng quan</CButton>
          {canViewSlots ? <CButton color={activeTab === 'slots' ? 'primary' : 'light'} onClick={() => setActiveTab('slots')}>Ca thi</CButton> : null}
          {canViewSessions ? <CButton color={activeTab === 'sessions' ? 'primary' : 'light'} onClick={() => setActiveTab('sessions')}>Phiên thi</CButton> : null}
        </div>
        <CTabContent>
          <CTabPane visible={activeTab === 'overview'}>
            <CRow className='g-4'>
              <CCol md={8}>
                <CCard>
                  <CCardHeader className='d-flex justify-content-between align-items-center'>
                    <strong>Thông tin đợt thi</strong>
                    <CButton size='sm' color='primary' onClick={() => setShowEditModal(true)}>Sửa đợt thi</CButton>
                  </CCardHeader>
                  <CCardBody>
                    {error ? <CAlert color='danger'>{error}</CAlert> : null}
                    <CRow className='g-3'>
                      <CCol md={6}>
                        <div className='small text-medium-emphasis'>Mã đợt thi</div>
                        <div className='fw-semibold'>{campaign.code || '—'}</div>
                      </CCol>
                      <CCol md={6}>
                        <div className='small text-medium-emphasis'>Trạng thái</div>
                        <div>{statusBadge(campaign.status)}</div>
                      </CCol>
                      <CCol xs={12}>
                        <div className='small text-medium-emphasis'>Tên đợt thi</div>
                        <div className='fw-semibold'>{campaign.name || '—'}</div>
                      </CCol>
                      <CCol md={6}>
                        <div className='small text-medium-emphasis'>Ngày bắt đầu</div>
                        <div>{formatDisplayDate(campaign.startDate || campaign.startAt) || '—'}</div>
                      </CCol>
                      <CCol md={6}>
                        <div className='small text-medium-emphasis'>Ngày kết thúc</div>
                        <div>{formatDisplayDate(campaign.endDate || campaign.endAt) || '—'}</div>
                      </CCol>
                      <CCol xs={12}>
                        <div className='small text-medium-emphasis'>Mô tả</div>
                        <div>{campaign.description ? campaign.description : 'Chưa có mô tả'}</div>
                      </CCol>
                    </CRow>
                  </CCardBody>
                </CCard>
              </CCol>

              <CCol md={4}>
                <CCard>
                  <CCardHeader><strong>Thống kê</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-3'>
                      <div className='small text-medium-emphasis'>Số ca thi</div>
                      <div className='fs-5 fw-semibold'>{stats.slotCount}</div>
                    </div>
                    <div>
                      <div className='small text-medium-emphasis'>Số phiên thi</div>
                      <div className='fs-5 fw-semibold'>{stats.sessionCount}</div>
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          </CTabPane>

          {canViewSlots ? (
            <CTabPane visible={activeTab === 'slots'}>
              <CCard>
                <CCardHeader className='d-flex justify-content-between align-items-center'>
                  <strong>Danh sách ca thi</strong>
                  <CButton
                    color='primary'
                    onClick={() => {
                      setSlotEditingId(null)
                      setSlotForm(DEFAULT_SLOT_FORM)
                      setShowSlotModal(true)
                    }}
                  >
                    Thêm ca thi
                  </CButton>
                </CCardHeader>
                <CCardBody>
                  {error ? <CAlert color='danger' className='mb-3'>{error}</CAlert> : null}
                  <CTable responsive hover>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Mã ca</CTableHeaderCell>
                        <CTableHeaderCell>Tên ca</CTableHeaderCell>
                        <CTableHeaderCell>Bắt đầu</CTableHeaderCell>
                        <CTableHeaderCell>Kết thúc</CTableHeaderCell>
                        <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                        <CTableHeaderCell>Thao tác</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {slots.length === 0 ? (
                        <CTableRow>
                          <CTableDataCell colSpan={6} className='text-center text-medium-emphasis'>Chưa có ca thi</CTableDataCell>
                        </CTableRow>
                      ) : null}
                      {slots.map((slot) => (
                        <CTableRow key={slot.id || slot.documentId || slot.code}>
                          <CTableDataCell>{slot.code}</CTableDataCell>
                          <CTableDataCell>{slot.name}</CTableDataCell>
                          <CTableDataCell>{slot.startAt ? formatSlotDateTime(slot.startAt) : '—'}</CTableDataCell>
                          <CTableDataCell>{slot.endAt ? formatSlotDateTime(slot.endAt) : '—'}</CTableDataCell>
                          <CTableDataCell>{slotStatusBadge(slot.status)}</CTableDataCell>
                          <CTableDataCell>
                            <CButton
                              size='sm'
                              color='secondary'
                              variant='outline'
                              onClick={() => {
                                const slotId = slot.id || slot.documentId
                                setSlotEditingId(slotId)
                                setSlotForm(toSlotFormValues(slot))
                                setShowSlotModal(true)
                              }}
                            >
                              Sửa
                            </CButton>
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            </CTabPane>
          ) : null}

          {canViewSessions ? (
            <CTabPane visible={activeTab === 'sessions'}>
              <CCard>
                <CCardHeader className='d-flex justify-content-between align-items-center'>
                  <strong>Danh sách phiên thi</strong>
                  <CButton
                    color='primary'
                    onClick={() => {
                      setSessionEditingId(null)
                      setSessionForm(toSessionFormValues({
                        slot: slots[0]?.id || slots[0]?.documentId || '',
                        durationMinutes: '60',
                        status: 'draft',
                      }))
                      setShowSessionModal(true)
                    }}
                  >
                    Thêm phiên thi
                  </CButton>
                </CCardHeader>
                <CCardBody>
                  {error ? <CAlert color='danger' className='mb-3'>{error}</CAlert> : null}
                  <CTable responsive hover>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Mã phiên</CTableHeaderCell>
                        <CTableHeaderCell>Tên phiên</CTableHeaderCell>
                        <CTableHeaderCell>Ca thi</CTableHeaderCell>
                        <CTableHeaderCell>Môn thi</CTableHeaderCell>
                        <CTableHeaderCell>Thời gian</CTableHeaderCell>
                        <CTableHeaderCell>Thời lượng</CTableHeaderCell>
                        <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                        <CTableHeaderCell>Thao tác</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {sessions.length === 0 ? (
                        <CTableRow>
                          <CTableDataCell colSpan={8} className='text-center text-medium-emphasis'>Chưa có phiên thi</CTableDataCell>
                        </CTableRow>
                      ) : null}
                      {sessions.map((row) => (
                        <CTableRow key={row.id || row.documentId || row.code}>
                          <CTableDataCell>{row.code}</CTableDataCell>
                          <CTableDataCell>{row.name}</CTableDataCell>
                          <CTableDataCell>{row.slot?.code || row.slot?.name || '—'}</CTableDataCell>
                          <CTableDataCell>{row.subject?.code || row.subject?.title || '—'}</CTableDataCell>
                          <CTableDataCell>
                            {row.startAt || row.endAt ? `${row.startAt ? new Date(row.startAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'} → ${row.endAt ? new Date(row.endAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}` : '—'}
                          </CTableDataCell>
                          <CTableDataCell>{row.durationMinutes ? `${row.durationMinutes} phút` : '—'}</CTableDataCell>
                          <CTableDataCell>{sessionStatusBadge(row.status)}</CTableDataCell>
                          <CTableDataCell>
                            <div className='d-flex gap-2'>
                              <CButton
                                size='sm'
                                color='secondary'
                                variant='outline'
                                onClick={() => navigate('/assessment-sessions/' + (row.documentId || row.id), { state: { returnTo: `/exam-campaigns/${campaignId}`, returnTab: 'sessions' } })}
                              >
                                Chi tiết
                              </CButton>
                              <CButton
                                size='sm'
                                color='secondary'
                                variant='outline'
                                onClick={() => {
                                  setSessionEditingId(row.id || row.documentId)
                                  setSessionForm(toSessionFormValues({
                                    ...row,
                                    slot: row.slot?.id || row.slot?.documentId || '',
                                    subject: row.subject?.id || row.subject?.documentId || '',
                                    startAt: row.startAt || '',
                                    endAt: row.endAt || '',
                                    durationMinutes: row.durationMinutes || '60',
                                    status: row.status || 'draft',
                                  }))
                                  setShowSessionModal(true)
                                }}
                              >
                                Sửa
                              </CButton>
                              <CButton
                                size='sm'
                                color='primary'
                                variant='outline'
                                onClick={() => {
                                  setCloneTargetSession(row)
                                  setShowCloneModal(true)
                                }}
                              >
                                Nhân bản
                              </CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            </CTabPane>
          ) : null}
        </CTabContent>
      </CCol>

      <ExamCampaignFormModal
        visible={showEditModal}
        title='Sửa đợt thi'
        initialValues={toCampaignFormValues(campaign)}
        submitLabel='Lưu thay đổi'
        saving={savingCampaign}
        onClose={() => setShowEditModal(false)}
        onSave={handleCampaignSave}
      />

      <ExamSlotFormModal
        visible={showSlotModal}
        title={slotEditingId ? 'Sửa ca thi' : 'Thêm ca thi'}
        initialValues={slotForm}
        saveLabel={slotEditingId ? 'Lưu thay đổi' : 'Tạo ca thi'}
        saving={savingSlot}
        onClose={() => {
          setShowSlotModal(false)
          setSlotEditingId(null)
          setSlotForm(DEFAULT_SLOT_FORM)
        }}
        onSave={handleSlotSubmit}
      />

      <AssessmentSessionModal
        visible={showSessionModal}
        title={sessionEditingId ? 'Sửa phiên thi' : 'Thêm phiên thi'}
        slots={slots}
        subjects={subjects}
        subjectsLoading={subjectsLoading}
        subjectsError={subjectsError}
        initialValues={sessionForm}
        submitLabel={sessionEditingId ? 'Lưu thay đổi' : 'Tạo phiên thi'}
        saving={savingSession}
        onClose={() => {
          setShowSessionModal(false)
          setSessionEditingId(null)
          setSessionForm(DEFAULT_SESSION_FORM)
        }}
        onSave={handleSessionSubmit}
      />

      <AssessmentSessionCloneModal
        visible={showCloneModal}
        sourceSession={cloneTargetSession}
        saving={savingClone}
        onClose={() => {
          setShowCloneModal(false)
          setCloneTargetSession(null)
        }}
        onClone={handleSessionClone}
      />
    </CRow>
  )
}
