import { useEffect, useState } from 'react'
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
  createAiKnowledge,
  deleteAiKnowledge,
  getAiKnowledgeDetail,
  getAiKnowledgeList,
  updateAiKnowledge,
} from '../services/aiService'

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE']

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getStatusColor(status) {
  return String(status || '').toUpperCase() === 'ACTIVE' ? 'success' : 'secondary'
}

function createFormState(payload = {}) {
  return {
    id: payload?.id || null,
    title: String(payload?.title || '').trim(),
    content: String(payload?.content || '').trim(),
    status: String(payload?.status || 'ACTIVE').trim() || 'ACTIVE',
    priority: String(payload?.priority ?? 0).trim() || '0',
  }
}

export default function AiKnowledgeManagerPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [rows, setRows] = useState([])
  const [keywordDraft, setKeywordDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const [statusDraft, setStatusDraft] = useState('')
  const [status, setStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(() => createFormState())

  async function loadRows(nextQuery = {}) {
    setLoading(true)
    setError('')

    try {
      const payload = await getAiKnowledgeList({
        keyword: nextQuery.keyword ?? keyword,
        status: nextQuery.status ?? status,
      })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không tải được dữ liệu tri thức AI'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [keyword, status])

  function applyFilters() {
    setKeyword(String(keywordDraft || '').trim())
    setStatus(String(statusDraft || '').trim())
  }

  function resetFilters() {
    setKeywordDraft('')
    setKeyword('')
    setStatusDraft('')
    setStatus('')
  }

  function handleCreate() {
    setForm(createFormState())
    setError('')
    setSuccess('')
    setShowModal(true)
  }

  async function handleEdit(row) {
    if (!row?.id) return
    setActionId(row.id)
    setError('')
    setSuccess('')

    try {
      const payload = await getAiKnowledgeDetail(row.id)
      setForm(createFormState(payload))
      setShowModal(true)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được chi tiết tri thức AI'))
    } finally {
      setActionId(null)
    }
  }

  async function handleToggleStatus(row) {
    if (!row?.id) return
    setActionId(row.id)
    setError('')
    setSuccess('')

    try {
      await updateAiKnowledge(row.id, {
        title: row.title,
        content: row.content,
        status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        priority: row.priority,
      })
      setSuccess('Đã cập nhật trạng thái tri thức AI')
      loadRows()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không cập nhật được trạng thái tri thức AI'))
    } finally {
      setActionId(null)
    }
  }

  async function handleDelete(row) {
    if (!row?.id) return
    if (!window.confirm(`Xóa tri thức AI "${row.title || row.id}"?`)) return
    setActionId(row.id)
    setError('')
    setSuccess('')

    try {
      await deleteAiKnowledge(row.id)
      setSuccess('Đã xóa tri thức AI')
      loadRows()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được tri thức AI'))
    } finally {
      setActionId(null)
    }
  }

  async function handleSave() {
    if (!String(form.title || '').trim()) {
      setError('Vui lòng nhập tiêu đề tri thức AI')
      return
    }
    if (!String(form.content || '').trim()) {
      setError('Vui lòng nhập nội dung tri thức AI')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        title: String(form.title || '').trim(),
        content: String(form.content || '').trim(),
        status: String(form.status || 'ACTIVE').trim(),
        priority: Number(form.priority || 0),
      }

      if (form.id) {
        await updateAiKnowledge(form.id, payload)
      } else {
        await createAiKnowledge(payload)
      }

      setShowModal(false)
      setForm(createFormState())
      setSuccess('Lưu tri thức AI thành công')
      loadRows()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được tri thức AI'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Dữ liệu tri thức AI</strong>
            <CButton color='primary' onClick={handleCreate}>Thêm tri thức</CButton>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={6}>
                <CFormLabel>Từ khóa</CFormLabel>
                <CFormInput value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} placeholder='Tìm theo title hoặc content' onKeyDown={(event) => { if (event.key === 'Enter') applyFilters() }} />
              </CCol>
              <CCol md={3}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                  <option value=''>ALL</option>
                  {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </CFormSelect>
              </CCol>
              <CCol md={3} className='d-flex align-items-end gap-2'>
                <CButton color='primary' className='w-100' onClick={applyFilters} disabled={loading}>Lọc</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={loading}>Xóa</CButton>
              </CCol>
            </CRow>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            {success ? <CAlert color='success'>{success}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu tri thức AI...</span>
              </div>
            ) : (
              <CTable hover responsive align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                    <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell>Priority</CTableHeaderCell>
                    <CTableHeaderCell>Cập nhật lúc</CTableHeaderCell>
                    <CTableHeaderCell>Thao tác</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rows.length > 0 ? rows.map((row) => (
                    <CTableRow key={row.id}>
                      <CTableDataCell>
                        <div className='fw-semibold'>{row.title || '-'}</div>
                        <div className='small text-body-secondary text-truncate' style={{ maxWidth: 520 }}>{row.content || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell><CBadge color={getStatusColor(row.status)}>{row.status || '-'}</CBadge></CTableDataCell>
                      <CTableDataCell>{row.priority ?? 0}</CTableDataCell>
                      <CTableDataCell>{formatDateTime(row.updatedAt)}</CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex flex-wrap gap-2'>
                          <CButton size='sm' color='info' variant='outline' onClick={() => handleEdit(row)} disabled={saving || actionId === row.id}>Sửa</CButton>
                          <CButton size='sm' color='warning' variant='outline' onClick={() => handleToggleStatus(row)} disabled={saving || actionId === row.id}>{row.status === 'ACTIVE' ? 'Inactive' : 'Active'}</CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(row)} disabled={saving || actionId === row.id}>Xóa</CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  )) : (
                    <CTableRow>
                      <CTableDataCell colSpan={5} className='text-center text-body-secondary'>Chưa có tri thức AI nào</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <CModal visible={showModal} backdrop='static' onClose={() => !saving && setShowModal(false)} size='lg'>
        <CModalHeader>
          <CModalTitle>{form.id ? 'Chỉnh sửa tri thức AI' : 'Thêm tri thức AI'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            <CCol xs={12}>
              <CFormLabel>Tiêu đề</CFormLabel>
              <CFormInput value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} disabled={saving} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Nội dung</CFormLabel>
              <CFormTextarea rows={12} value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} disabled={saving} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} disabled={saving}>
                {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Priority</CFormLabel>
              <CFormInput type='number' value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))} disabled={saving} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowModal(false)} disabled={saving}>Đóng</CButton>
          <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}