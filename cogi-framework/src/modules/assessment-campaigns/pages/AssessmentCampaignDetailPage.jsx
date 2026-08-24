import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CFormInput, CFormLabel, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CNav, CNavItem, CNavLink, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import AssessmentCampaignEditorModal from '../components/AssessmentCampaignEditorModal'
import AssessmentCampaignFieldEditorModal from '../components/AssessmentCampaignFieldEditorModal'
import AssessmentCampaignRuleEditorModal from '../components/AssessmentCampaignRuleEditorModal'
import AssessmentCampaignResolverPreview from '../components/AssessmentCampaignResolverPreview'
import { createAssessmentCampaignField, createAssessmentCampaignRule, deleteAssessmentCampaignField, deleteAssessmentCampaignRule, finalizeAssessmentCampaignAttemptTimeout, finalizeOverdueAssessmentCampaignAttempts, getApiMessage, getAssessmentCampaign, listAssessmentCampaignLeads, listAssessmentCampaignParticipations, listAssessmentCampaignResults, reorderAssessmentCampaignFields, updateAssessmentCampaign, updateAssessmentCampaignField, updateAssessmentCampaignRule } from '../services/assessmentCampaignService'
import { getAssessmentVersions } from '../../assessments/services/assessmentService'
import { formatDateTime, getEntityId } from '../../learning-management/utils/questionBankUi'

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'leads', label: 'Lead' },
  { key: 'fields', label: 'Cấu hình thu thập' },
  { key: 'rules', label: 'Bài đánh giá' },
  { key: 'participations', label: 'Lượt tham gia' },
  { key: 'results', label: 'Kết quả' },
  { key: 'public', label: 'Nội dung/Public' },
  { key: 'tracking', label: 'Theo dõi' },
]

function getStatusLabel(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'draft') return 'Bản nháp'
  if (normalized === 'active') return 'Hoạt động'
  if (normalized === 'paused') return 'Tạm dừng'
  if (normalized === 'ended') return 'Kết thúc'
  if (normalized === 'archived') return 'Lưu trữ'
  return value || '-'
}

function getStatusColor(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'active') return 'success'
  if (normalized === 'draft' || normalized === 'paused') return 'warning'
  if (normalized === 'ended' || normalized === 'archived') return 'secondary'
  return 'secondary'
}

function getFieldTypeLabel(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'text') return 'Văn bản'
  if (normalized === 'email') return 'Email'
  if (normalized === 'phone') return 'Số điện thoại'
  if (normalized === 'number') return 'Số'
  if (normalized === 'date') return 'Ngày'
  if (normalized === 'select') return 'Danh sách chọn'
  if (normalized === 'radio') return 'Chọn một'
  if (normalized === 'checkbox') return 'Chọn nhiều'
  if (normalized === 'textarea') return 'Văn bản dài'
  return value || '-'
}

function getCollectStageLabel(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'before_start') return 'Trước khi bắt đầu'
  if (normalized === 'before_result') return 'Trước khi xem kết quả'
  if (normalized === 'optional') return 'Không bắt buộc / bổ sung'
  return value || '-'
}

function getFieldStatusLabel(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'active') return 'Hoạt động'
  if (normalized === 'inactive') return 'Ngừng dùng'
  return value || '-'
}

function getFieldStatusColor(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'active') return 'success'
  if (normalized === 'inactive') return 'secondary'
  return 'secondary'
}

function getParticipationStatusLabel(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'verified') return 'Đã xác thực'
  if (normalized === 'ready') return 'Sẵn sàng'
  if (normalized === 'in_progress') return 'Đang làm'
  if (normalized === 'submitted') return 'Đã nộp'
  if (normalized === 'result_pending') return 'Chờ kết quả'
  if (normalized === 'completed') return 'Hoàn thành'
  if (normalized === 'cancelled') return 'Đã hủy'
  if (normalized === 'expired' || normalized === 'expired_legacy') return 'Hết hạn'
  if (normalized === 'overdue') return 'Quá hạn'
  if (normalized === 'created') return 'Đã tạo'
  return value || '-'
}

function getParticipationStatusColor(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'submitted' || normalized === 'completed') return 'success'
  if (normalized === 'in_progress' || normalized === 'verified' || normalized === 'ready') return 'info'
  if (normalized === 'overdue') return 'danger'
  if (normalized === 'expired' || normalized === 'expired_legacy') return 'warning'
  if (normalized === 'cancelled') return 'secondary'
  return 'secondary'
}

export default function AssessmentCampaignDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = String(searchParams.get('tab') || '').trim()
  const activeTab = TABS.some((item) => item.key === requestedTab) ? requestedTab : 'overview'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [campaign, setCampaign] = useState(null)
  const [assessmentVersions, setAssessmentVersions] = useState([])
  const [leads, setLeads] = useState([])
  const [participations, setParticipations] = useState([])
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editorVisible, setEditorVisible] = useState(false)
  const [fieldEditorVisible, setFieldEditorVisible] = useState(false)
  const [ruleEditorVisible, setRuleEditorVisible] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [editingRule, setEditingRule] = useState(null)
  const [timeoutDialog, setTimeoutDialog] = useState({ visible: false, mode: 'single', row: null })
  const [processingTimeout, setProcessingTimeout] = useState(false)

  const overdueParticipations = useMemo(() => participations.filter((row) => row?.canFinalizeTimeout), [participations])

  useEffect(() => {
    loadCore()
  }, [id])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (activeTab !== requestedTab) {
      next.set('tab', activeTab)
      setSearchParams(next, { replace: true })
    }
  }, [activeTab, requestedTab, searchParams, setSearchParams])

  useEffect(() => {
    if (!campaign) return
    if (activeTab === 'leads') loadLeads()
    if (activeTab === 'participations') loadParticipations()
    if (activeTab === 'results') loadResults()
  }, [campaign?.id, activeTab])

  async function loadCore() {
    setLoading(true)
    setError('')
    try {
      const [campaignPayload, versionsPayload] = await Promise.all([
        getAssessmentCampaign(id),
        getAssessmentVersions({ page: 1, pageSize: 200, versionStatus: 'published' }),
      ])
      setCampaign(campaignPayload)
      setAssessmentVersions(Array.isArray(versionsPayload?.data) ? versionsPayload.data : [])
    } catch (requestError) {
      setCampaign(null)
      setError(getApiMessage(requestError, 'Không tải được chi tiết chiến dịch đánh giá'))
    } finally {
      setLoading(false)
    }
  }

  async function loadLeads() {
    try {
      const payload = await listAssessmentCampaignLeads(id)
      setLeads(Array.isArray(payload) ? payload : [])
    } catch {
      setLeads([])
    }
  }

  async function loadParticipations() {
    try {
      const payload = await listAssessmentCampaignParticipations(id)
      setParticipations(Array.isArray(payload?.data) ? payload.data : [])
    } catch {
      setParticipations([])
    }
  }

  async function loadResults() {
    try {
      const payload = await listAssessmentCampaignResults(id)
      setResults(Array.isArray(payload) ? payload : [])
    } catch {
      setResults([])
    }
  }

  function closeTimeoutDialog() {
    if (processingTimeout) return
    setTimeoutDialog({ visible: false, mode: 'single', row: null })
  }

  function openSingleTimeoutDialog(row) {
    setTimeoutDialog({ visible: true, mode: 'single', row })
  }

  function openBulkTimeoutDialog() {
    if (overdueParticipations.length === 0) {
      setSuccess('Không có lượt quá hạn cần xử lý.')
      setError('')
      return
    }
    setTimeoutDialog({ visible: true, mode: 'bulk', row: null })
  }

  async function handleConfirmTimeoutFinalize() {
    setProcessingTimeout(true)
    setError('')
    setSuccess('')
    try {
      if (timeoutDialog.mode === 'bulk') {
        const summary = await finalizeOverdueAssessmentCampaignAttempts(id)
        await Promise.all([loadCore(), loadParticipations(), loadResults()])
        setSuccess(`Đã xử lý ${summary?.processed || 0}/${summary?.found || 0} lượt quá hạn.${Number(summary?.alreadyFinalized || 0) > 0 ? ` ${summary.alreadyFinalized} lượt đã được kết thúc trước đó.` : ''}${Number(summary?.failed || 0) > 0 ? ` ${summary.failed} lượt chưa xử lý được.` : ''}`)
      } else {
        const attemptId = timeoutDialog?.row?.assessmentAttempt?.id
        await finalizeAssessmentCampaignAttemptTimeout(attemptId)
        await Promise.all([loadCore(), loadParticipations(), loadResults()])
        setSuccess('Đã kết thúc lượt làm do hết giờ và tạo kết quả đánh giá.')
      }
      setTimeoutDialog({ visible: false, mode: 'single', row: null })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xử lý được lượt quá hạn'))
    } finally {
      setProcessingTimeout(false)
    }
  }

  async function handleCampaignSubmit(payload) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const next = await updateAssessmentCampaign(id, payload)
      setCampaign(next)
      setEditorVisible(false)
      setSuccess('Đã cập nhật chiến dịch đánh giá')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không cập nhật được chiến dịch đánh giá'))
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  async function handleFieldSubmit(payload) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingField) await updateAssessmentCampaignField(id, editingField.id, payload)
      else await createAssessmentCampaignField(id, payload)
      await loadCore()
      setFieldEditorVisible(false)
      setEditingField(null)
      setSuccess(editingField ? 'Đã cập nhật trường thu thập' : 'Đã tạo trường thu thập')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được trường thu thập'))
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteField(field) {
    if (!window.confirm(`Xóa trường ${field.label || field.key}?`)) return
    setSaving(true)
    try {
      await deleteAssessmentCampaignField(id, field.id)
      await loadCore()
    } finally {
      setSaving(false)
    }
  }

  async function handleMoveField(field, direction) {
    const ordered = [...(campaign?.fields || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    const index = ordered.findIndex((item) => String(item.id || item.documentId) === String(field.id || field.documentId))
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return
    const swapped = [...ordered]
    const temp = swapped[index]
    swapped[index] = swapped[targetIndex]
    swapped[targetIndex] = temp
    await reorderAssessmentCampaignFields(id, swapped.map((item, itemIndex) => ({ id: item.id || item.documentId, order: itemIndex + 1 })))
    await loadCore()
  }

  async function handleRuleSubmit(payload) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingRule) await updateAssessmentCampaignRule(id, editingRule.id, payload)
      else await createAssessmentCampaignRule(id, payload)
      await loadCore()
      setRuleEditorVisible(false)
      setEditingRule(null)
      setSuccess(editingRule ? 'Đã cập nhật rule phân đề' : 'Đã tạo rule phân đề')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được rule phân đề'))
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRule(rule) {
    if (!window.confirm(`Xóa rule ${rule.name || rule.code}?`)) return
    setSaving(true)
    try {
      await deleteAssessmentCampaignRule(id, rule.id)
      await loadCore()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className='py-4 d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải chi tiết chiến dịch đánh giá...</span></div>
  if (!campaign) return <CAlert color='warning'>Không tìm thấy chiến dịch đánh giá.</CAlert>

  return (
    <>
      <CCard className='mb-4 ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <div className='d-flex align-items-center gap-2 flex-wrap mb-2'>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => navigate('/assessment-campaigns')}>Về danh sách</CButton>
              <CBadge color={getStatusColor(campaign.status)}>{getStatusLabel(campaign.status)}</CBadge>
            </div>
            <div className='fs-4 fw-semibold'>{campaign.name}</div>
            <div className='text-body-secondary'>{`${campaign.code} · ${campaign.slug}`}</div>
          </div>
          <div className='d-flex gap-2 flex-wrap'>
            <CButton color='secondary' variant='outline' onClick={() => setEditorVisible(true)}>Sửa</CButton>
            <CButton color='primary' variant='outline' onClick={() => window.open(`/campaign/${campaign.slug}`, '_blank', 'noopener,noreferrer')}>Mở trang public</CButton>
          </div>
        </CCardHeader>
      </CCard>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      <CNav variant='tabs' className='mb-4 flex-nowrap overflow-auto'>
        {TABS.map((tab) => <CNavItem key={tab.key}><CNavLink active={tab.key === activeTab} href='#' onClick={(event) => { event.preventDefault(); const next = new URLSearchParams(searchParams); next.set('tab', tab.key); setSearchParams(next) }}>{tab.label}</CNavLink></CNavItem>)}
      </CNav>

      {activeTab === 'overview' ? (
        <div className='d-grid gap-4'>
          <CRow className='g-3'>
            <CCol md={6} lg={3}><CCard className='h-100 border'><CCardBody><div className='small text-body-secondary'>Tổng Lead</div><div className='fs-4 fw-semibold'>{campaign?.summary?.totalLeads || 0}</div></CCardBody></CCard></CCol>
            <CCol md={6} lg={3}><CCard className='h-100 border'><CCardBody><div className='small text-body-secondary'>Đã xác thực</div><div className='fs-4 fw-semibold'>{campaign?.summary?.totalVerified || 0}</div></CCardBody></CCard></CCol>
            <CCol md={6} lg={3}><CCard className='h-100 border'><CCardBody><div className='small text-body-secondary'>Đã bắt đầu</div><div className='fs-4 fw-semibold'>{campaign?.summary?.totalStarted || 0}</div></CCardBody></CCard></CCol>
            <CCol md={6} lg={3}><CCard className='h-100 border'><CCardBody><div className='small text-body-secondary'>Đã hoàn thành</div><div className='fs-4 fw-semibold'>{campaign?.summary?.totalCompleted || 0}</div></CCardBody></CCard></CCol>
          </CRow>
          <CCard className='ai-card'><CCardBody><div className='d-grid gap-2'><div><strong>Tên:</strong> {campaign.name}</div><div><strong>Mã:</strong> {campaign.code}</div><div><strong>Slug:</strong> {campaign.slug}</div><div><strong>Trạng thái:</strong> {getStatusLabel(campaign.status)}</div><div><strong>Thời gian:</strong> {`${formatDateTime(campaign.startAt)} - ${formatDateTime(campaign.endAt)}`}</div><div><strong>Mô tả:</strong> {campaign.description || '-'}</div><div><strong>Public URL:</strong> {campaign.publicUrl || '-'}</div></div></CCardBody></CCard>
        </div>
      ) : null}

      {activeTab === 'leads' ? <CCard className='ai-card'><CCardHeader><strong>Lead</strong></CCardHeader><CCardBody>{leads.length === 0 ? <div className='text-body-secondary'>Chưa có lead nào.</div> : <CTable responsive hover align='middle'><CTableHead><CTableRow><CTableHeaderCell>Họ tên</CTableHeaderCell><CTableHeaderCell>Điện thoại</CTableHeaderCell><CTableHeaderCell>Email</CTableHeaderCell><CTableHeaderCell>Lớp</CTableHeaderCell><CTableHeaderCell>Trạng thái</CTableHeaderCell><CTableHeaderCell>Lượt tham gia</CTableHeaderCell></CTableRow></CTableHead><CTableBody>{leads.map((row) => <CTableRow key={row.id || row.phone}><CTableDataCell>{row.fullName || '-'}</CTableDataCell><CTableDataCell>{row.phone || '-'}</CTableDataCell><CTableDataCell>{row.email || '-'}</CTableDataCell><CTableDataCell>{row.grade || '-'}</CTableDataCell><CTableDataCell>{row.status || '-'}</CTableDataCell><CTableDataCell>{row.participationCount || 0}</CTableDataCell></CTableRow>)}</CTableBody></CTable>}</CCardBody></CCard> : null}

      {activeTab === 'fields' ? <CCard className='ai-card'><CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'><div><strong>Cấu hình thu thập</strong></div><div className='d-flex gap-2'><CButton color='primary' onClick={() => { setEditingField(null); setFieldEditorVisible(true) }}>+ Thêm</CButton></div></CCardHeader><CCardBody>{(campaign.fields || []).length === 0 ? <div className='text-body-secondary'>Chưa có cấu hình thu thập.</div> : <CTable responsive hover align='middle'><CTableHead><CTableRow><CTableHeaderCell>Thứ tự</CTableHeaderCell><CTableHeaderCell>Key</CTableHeaderCell><CTableHeaderCell>Nhãn</CTableHeaderCell><CTableHeaderCell>Kiểu</CTableHeaderCell><CTableHeaderCell>Bắt buộc</CTableHeaderCell><CTableHeaderCell>Giai đoạn</CTableHeaderCell><CTableHeaderCell>Trạng thái</CTableHeaderCell><CTableHeaderCell>Actions</CTableHeaderCell></CTableRow></CTableHead><CTableBody>{campaign.fields.map((row, index) => <CTableRow key={row.id}><CTableDataCell>{row.order}</CTableDataCell><CTableDataCell>{row.key}</CTableDataCell><CTableDataCell>{row.label}</CTableDataCell><CTableDataCell>{row.fieldType}</CTableDataCell><CTableDataCell>{row.required ? 'Có' : 'Không'}</CTableDataCell><CTableDataCell>{row.collectStage}</CTableDataCell><CTableDataCell>{row.status}</CTableDataCell><CTableDataCell><div className='d-flex gap-2 flex-wrap'><CButton size='sm' color='secondary' variant='outline' onClick={() => handleMoveField(row, 'up')} disabled={saving || index === 0}>Lên</CButton><CButton size='sm' color='secondary' variant='outline' onClick={() => handleMoveField(row, 'down')} disabled={saving || index === campaign.fields.length - 1}>Xuống</CButton><CButton size='sm' color='secondary' variant='outline' onClick={() => { setEditingField(row); setFieldEditorVisible(true) }}>Sửa</CButton><CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteField(row)}>Xóa</CButton></div></CTableDataCell></CTableRow>)}</CTableBody></CTable>}</CCardBody></CCard> : null}

      {activeTab === 'rules' ? <div className='d-grid gap-4'><CCard className='ai-card'><CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'><div><strong>Bài đánh giá</strong></div><CButton color='primary' onClick={() => { setEditingRule(null); setRuleEditorVisible(true) }}>+ Thêm rule</CButton></CCardHeader><CCardBody>{(campaign.rules || []).length === 0 ? <div className='text-body-secondary'>Chưa có rule phân đề.</div> : <CTable responsive hover align='middle'><CTableHead><CTableRow><CTableHeaderCell>Rule</CTableHeaderCell><CTableHeaderCell>Điều kiện</CTableHeaderCell><CTableHeaderCell>Assessment</CTableHeaderCell><CTableHeaderCell>Version</CTableHeaderCell><CTableHeaderCell>Priority</CTableHeaderCell><CTableHeaderCell>Status</CTableHeaderCell><CTableHeaderCell>Actions</CTableHeaderCell></CTableRow></CTableHead><CTableBody>{campaign.rules.map((row) => <CTableRow key={row.id}><CTableDataCell><div className='fw-semibold'>{row.name}</div><div className='small text-body-secondary'>{row.code}</div></CTableDataCell><CTableDataCell>{row.gradeFrom !== null && row.gradeTo !== null ? `Lớp ${row.gradeFrom}–${row.gradeTo}` : 'Không giới hạn'}</CTableDataCell><CTableDataCell>{row.assessment?.name || row.assessment?.code || '-'}</CTableDataCell><CTableDataCell>{row.assessmentVersion?.code || '-'}</CTableDataCell><CTableDataCell>{row.priority}</CTableDataCell><CTableDataCell>{row.status}</CTableDataCell><CTableDataCell><div className='d-flex gap-2'><CButton size='sm' color='secondary' variant='outline' onClick={() => { setEditingRule(row); setRuleEditorVisible(true) }}>Sửa</CButton><CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteRule(row)}>Xóa</CButton></div></CTableDataCell></CTableRow>)}</CTableBody></CTable>}</CCardBody></CCard><AssessmentCampaignResolverPreview campaignId={id} /></div> : null}

      {activeTab === 'participations' ? <CCard className='ai-card'><CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'><strong>Lượt tham gia</strong><div className='d-flex align-items-center gap-2 flex-wrap'><CBadge color={overdueParticipations.length > 0 ? 'danger' : 'secondary'}>{overdueParticipations.length} quá hạn</CBadge><CButton color='warning' variant='outline' onClick={openBulkTimeoutDialog} disabled={processingTimeout}>Xử lý các lượt quá hạn</CButton></div></CCardHeader><CCardBody>{participations.length === 0 ? <div className='text-body-secondary'>Chưa có lượt tham gia.</div> : <CTable responsive hover align='middle'><CTableHead><CTableRow><CTableHeaderCell>Lead</CTableHeaderCell><CTableHeaderCell>Lớp</CTableHeaderCell><CTableHeaderCell>Trạng thái</CTableHeaderCell><CTableHeaderCell>Rule</CTableHeaderCell><CTableHeaderCell>Assessment</CTableHeaderCell><CTableHeaderCell>Attempt</CTableHeaderCell><CTableHeaderCell>Bắt đầu</CTableHeaderCell><CTableHeaderCell>Hết giờ lúc</CTableHeaderCell><CTableHeaderCell>Nộp bài</CTableHeaderCell><CTableHeaderCell>Actions</CTableHeaderCell></CTableRow></CTableHead><CTableBody>{participations.map((row) => <CTableRow key={row.id}><CTableDataCell><div className='fw-semibold'>{row.lead?.fullName || '-'}</div><div className='small text-body-secondary'>{row.lead?.phone || '-'}</div></CTableDataCell><CTableDataCell>{row.collectedData?.grade ?? row.sourceMetadata?.grade ?? '-'}</CTableDataCell><CTableDataCell><div className='d-flex align-items-center gap-2 flex-wrap'><CBadge color={getParticipationStatusColor(row.status)}>{getParticipationStatusLabel(row.status)}</CBadge>{row.assessmentAttempt?.deadlineSource === 'derived' ? <span className='small text-body-secondary'>Legacy deadline</span> : null}</div></CTableDataCell><CTableDataCell>{row.matchedRule?.code || '-'}</CTableDataCell><CTableDataCell>{row.assessmentVersion?.code || '-'}</CTableDataCell><CTableDataCell><div className='fw-semibold'>{row.assessmentAttempt?.code || '-'}</div><div className='small text-body-secondary'>{row.assessmentAttempt?.status || '-'}</div></CTableDataCell><CTableDataCell>{formatDateTime(row.assessmentAttempt?.startedAt || row.assessmentStartedAt || row.startedAt)}</CTableDataCell><CTableDataCell>{formatDateTime(row.assessmentAttempt?.expiresAt)}</CTableDataCell><CTableDataCell>{formatDateTime(row.assessmentAttempt?.submittedAt || row.submittedAt)}</CTableDataCell><CTableDataCell><div className='d-flex gap-2 flex-wrap'>{row.canFinalizeTimeout ? <CButton size='sm' color='warning' variant='outline' onClick={() => openSingleTimeoutDialog(row)} disabled={processingTimeout}>Kết thúc do hết giờ</CButton> : null}{row.result?.id ? <CButton size='sm' color='info' variant='outline' onClick={() => navigate(`/assessment-results/${getEntityId(row.result)}`)}>Xem kết quả</CButton> : null}</div></CTableDataCell></CTableRow>)}</CTableBody></CTable>}</CCardBody></CCard> : null}

      {activeTab === 'results' ? <CCard className='ai-card'><CCardHeader><strong>Kết quả</strong></CCardHeader><CCardBody>{results.length === 0 ? <div className='text-body-secondary'>Chưa có kết quả nào.</div> : <CTable responsive hover align='middle'><CTableHead><CTableRow><CTableHeaderCell>Lead</CTableHeaderCell><CTableHeaderCell>Lớp</CTableHeaderCell><CTableHeaderCell>Assessment</CTableHeaderCell><CTableHeaderCell>Submitted</CTableHeaderCell><CTableHeaderCell>Provisional Level</CTableHeaderCell><CTableHeaderCell>Confirmed Level</CTableHeaderCell><CTableHeaderCell>Status</CTableHeaderCell><CTableHeaderCell>Actions</CTableHeaderCell></CTableRow></CTableHead><CTableBody>{results.map((row) => <CTableRow key={`${row.participationId}-${row.result?.id || ''}`}><CTableDataCell>{row.lead?.fullName || '-'}</CTableDataCell><CTableDataCell>{row.grade || '-'}</CTableDataCell><CTableDataCell>{row.assessmentVersion?.code || '-'}</CTableDataCell><CTableDataCell>{formatDateTime(row.assessmentAttempt?.submittedAt)}</CTableDataCell><CTableDataCell>{row.provisionalLevel || '-'}</CTableDataCell><CTableDataCell>{row.confirmedLevel || '-'}</CTableDataCell><CTableDataCell>{row.status || '-'}</CTableDataCell><CTableDataCell>{row.result?.id ? <CButton size='sm' color='info' variant='outline' onClick={() => navigate(`/assessment-results/${row.result.id}`)}>Xem kết quả</CButton> : null}</CTableDataCell></CTableRow>)}</CTableBody></CTable>}</CCardBody></CCard> : null}

      {activeTab === 'public' ? <CCard className='ai-card'><CCardHeader><strong>Nội dung/Public</strong></CCardHeader><CCardBody><div className='d-grid gap-2'><div><strong>Public title:</strong> {campaign.publicTitle || '-'}</div><div><strong>Public description:</strong> {campaign.publicDescription || '-'}</div><div><strong>Success message:</strong> {campaign.successMessage || '-'}</div><div><strong>Result intro:</strong> {campaign.resultIntro || '-'}</div><div><strong>Public URL:</strong> {campaign.publicUrl || '-'}</div></div></CCardBody></CCard> : null}

      {activeTab === 'tracking' ? <CCard className='ai-card'><CCardHeader><strong>Theo dõi</strong></CCardHeader><CCardBody><div className='d-grid gap-2 text-body-secondary'><div>Lead created</div><div>OTP verified</div><div>Participation created</div><div>Assessment selected</div><div>Assessment started</div><div>Submitted</div><div>Result ready</div><div>Speaking completed</div><div>Confirmed</div></div></CCardBody></CCard> : null}

      <AssessmentCampaignEditorModal visible={editorVisible} saving={saving} campaign={campaign} onClose={() => { if (!saving) setEditorVisible(false) }} onSubmit={handleCampaignSubmit} />
      <AssessmentCampaignFieldEditorModal visible={fieldEditorVisible} saving={saving} field={editingField} onClose={() => { if (!saving) { setFieldEditorVisible(false); setEditingField(null) } }} onSubmit={handleFieldSubmit} />
      <AssessmentCampaignRuleEditorModal visible={ruleEditorVisible} saving={saving} rule={editingRule} assessmentVersions={assessmentVersions} onClose={() => { if (!saving) { setRuleEditorVisible(false); setEditingRule(null) } }} onSubmit={handleRuleSubmit} />
      <CModal visible={timeoutDialog.visible} onClose={closeTimeoutDialog} alignment='center'>
        <CModalHeader closeButton={!processingTimeout}>
          <CModalTitle>{timeoutDialog.mode === 'bulk' ? 'Xử lý các lượt quá hạn' : 'Kết thúc do hết giờ'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {timeoutDialog.mode === 'bulk'
            ? overdueParticipations.length > 0
              ? `Tìm thấy ${overdueParticipations.length} lượt đã quá thời gian nhưng chưa được kết thúc. Hệ thống sẽ tự động nộp các câu trả lời đã lưu của các lượt này.`
              : 'Không có lượt quá hạn cần xử lý.'
            : 'Lượt làm này đã vượt quá thời gian cho phép. Hệ thống sẽ nộp các câu trả lời đã được lưu và tạo kết quả đánh giá. Bạn có muốn tiếp tục?'}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeTimeoutDialog} disabled={processingTimeout}>Hủy</CButton>
          <CButton color='warning' onClick={handleConfirmTimeoutFinalize} disabled={processingTimeout || (timeoutDialog.mode === 'bulk' && overdueParticipations.length === 0)}>{processingTimeout ? 'Đang xử lý...' : timeoutDialog.mode === 'bulk' ? `Xử lý ${overdueParticipations.length} lượt` : 'Xác nhận kết thúc'}</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}