import { useEffect, useMemo, useState } from 'react'
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
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { createQuestionStimulus, deleteQuestionStimulus, getQuestionStimuli, updateQuestionStimulus } from '../services/learningObjectApi'
import QuestionStimulusEditorModal from './QuestionStimulusEditorModal'
import StimulusPreview from './StimulusPreview'
import { buildPages, formatDateTime, getApiMessage, getEntityId, getStatusBadgeColor, getStimulusTypeLabel, normalizePagination } from '../utils/questionBankUi'

export default function QuestionBankStimuliTab({ setWorkspaceActions }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [qDraft, setQDraft] = useState('')
  const [filters, setFilters] = useState({ q: '', type: '', stimulusStatus: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingStimulus, setEditingStimulus] = useState(null)

  const pagination = normalizePagination(meta?.pagination)
  const pages = useMemo(() => buildPages(page, pagination.pageCount), [page, pagination.pageCount])

  useEffect(() => {
    setWorkspaceActions?.(<CButton color='primary' onClick={() => { setEditingStimulus(null); setShowEditor(true) }}>+ Tạo Stimulus</CButton>)
    return () => setWorkspaceActions?.(null)
  }, [setWorkspaceActions])

  useEffect(() => {
    loadRows()
  }, [filters, page, pageSize])

  async function loadRows() {
    setLoading(true)
    setError('')
    try {
      const payload = await getQuestionStimuli({ page, pageSize, q: filters.q || undefined, type: filters.type || undefined, stimulusStatus: filters.stimulusStatus || undefined })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
      setMeta(payload?.meta || null)
    } catch (requestError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(requestError, 'Không tải được stimulus'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(payload) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingStimulus) {
        await updateQuestionStimulus(getEntityId(editingStimulus), payload)
        setSuccess('Cập nhật stimulus thành công')
      } else {
        await createQuestionStimulus(payload)
        setSuccess('Tạo stimulus thành công')
      }
      setShowEditor(false)
      setEditingStimulus(null)
      await loadRows()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được stimulus'))
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Bạn chắc chắn muốn xóa stimulus ${row?.code || ''}?`)) return
    setError('')
    setSuccess('')
    try {
      await deleteQuestionStimulus(getEntityId(row))
      setSuccess('Xóa stimulus thành công')
      await loadRows()
    } catch (requestError) {
      const message = getApiMessage(requestError, 'Không xóa được stimulus')
      setError(message)
    }
  }

  return (
    <>
      <CCard className='mb-4 ai-card'>
        <CCardHeader><strong>Bộ lọc</strong></CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol md={6}><CFormInput label='Từ khóa' value={qDraft} onChange={(event) => setQDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setFilters((prev) => ({ ...prev, q: String(qDraft || '').trim() })); setPage(1) } }} placeholder='Tìm theo code, title, content...' /></CCol>
            <CCol md={2}><CFormLabel>Loại</CFormLabel><CFormSelect value={filters.type} onChange={(event) => { setFilters((prev) => ({ ...prev, type: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{['text', 'audio', 'image', 'mixed'].map((item) => <option key={item} value={item}>{getStimulusTypeLabel(item)}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.stimulusStatus} onChange={(event) => { setFilters((prev) => ({ ...prev, stimulusStatus: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{['draft', 'active', 'archived'].map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={2} className='d-flex gap-2'>
              <CButton color='primary' onClick={() => { setFilters((prev) => ({ ...prev, q: String(qDraft || '').trim() })); setPage(1) }}>Search</CButton>
              <CButton color='secondary' variant='outline' onClick={() => { setQDraft(''); setFilters({ q: '', type: '', stimulusStatus: '' }); setPage(1) }}>Đặt lại</CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CCard className='ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <div>
            <strong>Stimulus</strong>
            <CBadge color='secondary' className='ms-2'>{pagination.total}</CBadge>
          </div>
        </CCardHeader>
        <CCardBody>
          {loading ? <div className='d-flex align-items-center gap-2 py-3'><CSpinner size='sm' /><span>Đang tải dữ liệu...</span></div> : (
            <>
              <CTable hover responsive align='middle' className='ai-table'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell style={{ width: 140 }}>Code</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 220 }}>Title</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 120 }}>Type</CTableHeaderCell>
                    <CTableHeaderCell style={{ minWidth: 280 }}>Preview</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 120 }}>Số câu hỏi</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 120 }}>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 160 }}>Hành động</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rows.length === 0 ? (
                    <CTableRow><CTableDataCell colSpan={7} className='text-center text-body-secondary'>Chưa có stimulus.</CTableDataCell></CTableRow>
                  ) : rows.map((item) => (
                    <CTableRow key={getEntityId(item) || item.code}>
                      <CTableDataCell>{item.code || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{item.title || '-'}</div>
                        <div className='small text-body-secondary'>{formatDateTime(item.updatedAt)}</div>
                      </CTableDataCell>
                      <CTableDataCell>{getStimulusTypeLabel(item.type)}</CTableDataCell>
                      <CTableDataCell><StimulusPreview stimulus={item} compact /></CTableDataCell>
                      <CTableDataCell>{Number(item?.usageCount || 0)} câu hỏi</CTableDataCell>
                      <CTableDataCell><CBadge color={getStatusBadgeColor(item.stimulusStatus)}>{item.stimulusStatus || '-'}</CBadge></CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex gap-2'>
                          <CButton size='sm' color='info' variant='outline' onClick={() => { setEditingStimulus(item); setShowEditor(true) }}>Sửa</CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item)}>Xóa</CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>

              <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3'>
                <div className='small text-body-secondary'>{pagination.total > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, pagination.total)}/${pagination.total}` : '0'}</div>
                <div className='d-flex align-items-center gap-2'>
                  <CFormSelect value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value || 10)); setPage(1) }} style={{ width: 110 }}>
                    {[10, 20, 50].map((size) => <option key={size} value={size}>{size}/trang</option>)}
                  </CFormSelect>
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

      <QuestionStimulusEditorModal
        visible={showEditor}
        saving={saving}
        editingStimulus={editingStimulus}
        onClose={() => { if (!saving) { setShowEditor(false); setEditingStimulus(null) } }}
        onSubmit={handleSubmit}
      />
    </>
  )
}
