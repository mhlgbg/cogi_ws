import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CFormInput, CFormLabel, CFormSelect, CPagination, CPaginationItem, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import AssessmentCampaignEditorModal from '../components/AssessmentCampaignEditorModal'
import { createAssessmentCampaign, getApiMessage, listAssessmentCampaigns, updateAssessmentCampaign } from '../services/assessmentCampaignService'
import { buildPages, formatDateTime, normalizePagination } from '../../learning-management/utils/questionBankUi'

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

export default function AssessmentCampaignListPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [qDraft, setQDraft] = useState('')
  const [filters, setFilters] = useState({ q: '', status: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)

  const pagination = normalizePagination(meta?.pagination)
  const pages = useMemo(() => buildPages(page, pagination.pageCount), [page, pagination.pageCount])

  useEffect(() => { loadCampaigns() }, [page, pageSize, filters])

  async function loadCampaigns() {
    setLoading(true)
    setError('')
    try {
      const payload = await listAssessmentCampaigns({ page, pageSize, q: filters.q || undefined, status: filters.status || undefined })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
      setMeta(payload?.meta || null)
    } catch (requestError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(requestError, 'Không tải được chiến dịch đánh giá'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(payload) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const saved = editingCampaign ? await updateAssessmentCampaign(editingCampaign.id, payload) : await createAssessmentCampaign(payload)
      setEditorVisible(false)
      setEditingCampaign(null)
      setSuccess(editingCampaign ? 'Đã cập nhật chiến dịch đánh giá' : 'Đã tạo chiến dịch đánh giá')
      await loadCampaigns()
      if (!editingCampaign) navigate(`/assessment-campaigns/${saved.id}`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được chiến dịch đánh giá'))
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CCard className='mb-4 ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <div className='fs-4 fw-semibold'>Chiến dịch đánh giá</div>
            <div className='text-body-secondary'>Quản lý các chiến dịch sử dụng bài đánh giá để thu lead, phân bài kiểm tra và theo dõi kết quả.</div>
          </div>
          <CButton color='primary' onClick={() => { setEditingCampaign(null); setEditorVisible(true) }}>+ Tạo chiến dịch đánh giá</CButton>
        </CCardHeader>
      </CCard>

      <CCard className='mb-4 ai-card'>
        <CCardHeader><strong>Bộ lọc</strong></CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol md={5}><CFormInput label='Keyword' value={qDraft} placeholder='Mã, tên hoặc slug...' onChange={(event) => setQDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setFilters((prev) => ({ ...prev, q: qDraft.trim() })); setPage(1) } }} /></CCol>
            <CCol md={3}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.status} onChange={(event) => { setFilters((prev) => ({ ...prev, status: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{['draft','active','paused','ended','archived'].map((item) => <option key={item} value={item}>{getStatusLabel(item)}</option>)}</CFormSelect></CCol>
            <CCol md={4} className='d-flex gap-2'>
              <CButton color='primary' onClick={() => { setFilters((prev) => ({ ...prev, q: qDraft.trim() })); setPage(1) }}>Search</CButton>
              <CButton color='secondary' variant='outline' onClick={() => { setQDraft(''); setFilters({ q: '', status: '' }); setPage(1) }}>Xóa bộ lọc</CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CCard className='ai-card'>
        <CCardHeader><strong>Danh sách chiến dịch</strong></CCardHeader>
        <CCardBody>
          {loading ? <div className='d-flex align-items-center gap-2 py-3'><CSpinner size='sm' /><span>Đang tải chiến dịch đánh giá...</span></div> : (
            <>
              <div className='d-none d-lg-block'>
                <CTable responsive hover align='middle'>
                  <CTableHead><CTableRow><CTableHeaderCell>Mã</CTableHeaderCell><CTableHeaderCell>Tên chiến dịch</CTableHeaderCell><CTableHeaderCell>Slug</CTableHeaderCell><CTableHeaderCell>Thời gian</CTableHeaderCell><CTableHeaderCell>Lead</CTableHeaderCell><CTableHeaderCell>Lượt tham gia</CTableHeaderCell><CTableHeaderCell>Trạng thái</CTableHeaderCell><CTableHeaderCell>Cập nhật</CTableHeaderCell><CTableHeaderCell>Actions</CTableHeaderCell></CTableRow></CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? <CTableRow><CTableDataCell colSpan={9} className='text-center text-body-secondary'>Chưa có chiến dịch đánh giá.</CTableDataCell></CTableRow> : rows.map((row) => (
                      <CTableRow key={row.id}>
                        <CTableDataCell>{row.code}</CTableDataCell>
                        <CTableDataCell>{row.name}</CTableDataCell>
                        <CTableDataCell>{row.slug}</CTableDataCell>
                        <CTableDataCell>{`${formatDateTime(row.startAt)} - ${formatDateTime(row.endAt)}`}</CTableDataCell>
                        <CTableDataCell>{row.leadCount || 0}</CTableDataCell>
                        <CTableDataCell>{row.participationCount || 0}</CTableDataCell>
                        <CTableDataCell><CBadge color={getStatusColor(row.status)}>{getStatusLabel(row.status)}</CBadge></CTableDataCell>
                        <CTableDataCell>{formatDateTime(row.updatedAt)}</CTableDataCell>
                        <CTableDataCell><div className='d-flex gap-2'><CButton size='sm' color='info' variant='outline' onClick={() => navigate(`/assessment-campaigns/${row.id}`)}>Mở</CButton><CButton size='sm' color='secondary' variant='outline' onClick={() => { setEditingCampaign(row); setEditorVisible(true) }}>Sửa</CButton></div></CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>
              <div className='d-lg-none d-grid gap-3'>
                {rows.length === 0 ? <div className='text-center text-body-secondary py-4'>Chưa có chiến dịch đánh giá.</div> : rows.map((row) => (
                  <CCard key={row.id} className='border'><CCardBody><div className='fw-semibold'>{row.name}</div><div className='small text-body-secondary mb-2'>{row.code}</div><div className='small text-body-secondary'>Slug: {row.slug}</div><div className='small text-body-secondary'>Lượt tham gia: {row.participationCount || 0}</div><div className='small text-body-secondary mb-3'>Trạng thái: {getStatusLabel(row.status)}</div><div className='d-flex gap-2'><CButton size='sm' color='info' variant='outline' onClick={() => navigate(`/assessment-campaigns/${row.id}`)}>Mở</CButton><CButton size='sm' color='secondary' variant='outline' onClick={() => { setEditingCampaign(row); setEditorVisible(true) }}>Sửa</CButton></div></CCardBody></CCard>
                ))}
              </div>
              <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3'>
                <div className='small text-body-secondary'>{pagination.total > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, pagination.total)}/${pagination.total}` : '0'}</div>
                <div className='d-flex align-items-center gap-2'>
                  <CFormSelect value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value || 10)); setPage(1) }} style={{ width: 110 }}>{[10,20,50].map((size) => <option key={size} value={size}>{size}/trang</option>)}</CFormSelect>
                  <CPagination className='mb-0'>
                    <CPaginationItem disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => item === '...' ? <CPaginationItem key={`ellipsis-${index}`} disabled>…</CPaginationItem> : <CPaginationItem key={item} active={item === page} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pagination.pageCount} onClick={() => setPage((prev) => Math.min(pagination.pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </div>
            </>
          )}
        </CCardBody>
      </CCard>

      <AssessmentCampaignEditorModal visible={editorVisible} saving={saving} campaign={editingCampaign} onClose={() => { if (!saving) { setEditorVisible(false); setEditingCampaign(null) } }} onSubmit={handleSubmit} />
    </>
  )
}