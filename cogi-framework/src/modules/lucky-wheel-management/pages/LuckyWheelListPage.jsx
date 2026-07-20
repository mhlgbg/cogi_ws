import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
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
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CFormLabel,
  CForm,

} from '@coreui/react'
import {
  getLuckyWheels,
  createLuckyWheel,
  updateLuckyWheel,
  openLuckyWheel,
  closeLuckyWheel,
  cancelLuckyWheel,
} from '../services/luckyWheelService'

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function buildPages(currentPage, pageCount) {
  const maxButtons = 7
  const pages = []

  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }

  const left = Math.max(1, currentPage - 2)
  const right = Math.min(pageCount, currentPage + 2)

  pages.push(1)
  if (left > 2) pages.push('...')

  for (let index = left; index <= right; index += 1) {
    if (index !== 1 && index !== pageCount) pages.push(index)
  }

  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)

  return pages
}

export default function LuckyWheelListPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCode, setCreateCode] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editing, setEditing] = useState(false)

  const total = pagination?.total ?? 0
  const pageCount = pagination?.pageCount ?? 1
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])

  async function load() {
    setLoading(true)
    setError('')

    try {
      const result = await getLuckyWheels({ page, pageSize, q, status: statusFilter })
      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setPagination(result?.pagination ?? null)
    } catch (e) {
      setRows([])
      setPagination(null)
      setError(getApiMessage(e, 'Không tải được danh sách'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q, statusFilter])

  function applySearch() {
    setPage(1)
    setQ(qDraft.trim())
  }

  function onReset() {
    setPage(1)
    setQ('')
    setQDraft('')
    setStatusFilter('')
  }

  async function handleOpen(id) {
    if (!window.confirm('Bạn chắc chắn muốn mở chiến dịch này?')) return
    try {
      await openLuckyWheel(id)
      await load()
      alert('Mở chiến dịch thành công')
    } catch (e) {
      alert(getApiMessage(e, 'Không thể mở chiến dịch'))
    }
  }

  async function handleClose(id) {
    if (!window.confirm('Bạn chắc chắn muốn đóng chiến dịch này?')) return
    try {
      await closeLuckyWheel(id)
      await load()
      alert('Đóng chiến dịch thành công')
    } catch (e) {
      alert(getApiMessage(e, 'Không thể đóng chiến dịch'))
    }
  }

  async function handleCancel(id) {
    const reason = window.prompt('Lý do hủy chiến dịch (bắt buộc)')
    if (!reason) return
    try {
      await cancelLuckyWheel(id, reason)
      await load()
      alert('Hủy chiến dịch thành công')
    } catch (e) {
      alert(getApiMessage(e, 'Không thể hủy chiến dịch'))
    }
  }

  async function handleCreate() {
    if (creating) return
    if (!createName.trim() || !createCode.trim()) { alert('Tên và mã là bắt buộc'); return }
    setCreating(true)
    try {
      const payload = { name: createName.trim(), code: createCode.trim().toUpperCase(), description: createDescription.trim() }
      const res = await createLuckyWheel(payload)
      if (res && res.id) {
        setShowCreate(false)
        setCreateName('')
        setCreateCode('')
        setCreateDescription('')
        await load()
        alert('Tạo thành công')
      } else {
        alert('Tạo thất bại')
      }
    } catch (e) {
      alert(getApiMessage(e, 'Lỗi khi tạo'))
    } finally {
      setCreating(false)
    }
  }

  function handleEditOpen(item) {
    setEditId(item.id)
    setEditName(item.name || '')
    setEditCode(item.code || '')
    setEditDescription(item.description || '')
    setShowEdit(true)
  }

  async function handleEditSave() {
    if (editing) return
    if (!editId) return
    if (!editName.trim() || !editCode.trim()) { alert('Tên và mã là bắt buộc'); return }
    setEditing(true)
    try {
      const payload = { name: editName.trim(), code: editCode.trim().toUpperCase(), description: editDescription.trim() }
      const res = await updateLuckyWheel(editId, payload)
      if (res && res.id) {
        setShowEdit(false)
        setEditId(null)
        setEditName('')
        setEditCode('')
        setEditDescription('')
        await load()
        alert('Cập nhật thành công')
      } else {
        alert('Cập nhật thất bại')
      }
    } catch (e) {
      alert(getApiMessage(e, 'Lỗi khi lưu'))
    } finally {
      setEditing(false)
    }
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className='mb-4 ai-card'>
          <CCardHeader>
            <strong>Filters</strong>
          </CCardHeader>
          <CCardBody>
            <div className='d-flex gap-3 align-items-end'>
              <div style={{ flex: 1 }}>
                <CFormInput placeholder='Tìm theo tên hoặc mã' value={qDraft} onChange={(e) => setQDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applySearch() }} />
              </div>
              <div>
                <CFormSelect value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value) }}>
                  <option value=''>Tất cả</option>
                  <option value='draft'>Nháp</option>
                  <option value='opened'>Đang mở</option>
                  <option value='closed'>Đã đóng</option>
                  <option value='cancelled'>Đã hủy</option>
                </CFormSelect>
              </div>
                <div className='d-flex gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color='secondary' variant='outline' onClick={onReset} disabled={loading}>Reset</CButton>
                <CButton color='success' onClick={() => setShowCreate(true)}>Tạo chiến dịch</CButton>
              </div>
            </div>
          </CCardBody>
        </CCard>

        {error && <div style={{ color: 'red' }}>{error}</div>}

        <CCard className='ai-card'>
          <CCardHeader className='d-flex justify-content-between align-items-center'>
            <div>
              <strong>Vòng quay may mắn</strong>
              <CBadge color='secondary' className='ms-2'>{total}</CBadge>
            </div>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive className='mb-3 ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>#</CTableHeaderCell>
                      <CTableHeaderCell>Tên chiến dịch</CTableHeaderCell>
                      <CTableHeaderCell>Mã</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Thời gian hoạt động</CTableHeaderCell>
                      <CTableHeaderCell>Người tham gia</CTableHeaderCell>
                      <CTableHeaderCell>Đã quay</CTableHeaderCell>
                      <CTableHeaderCell>Đã trao</CTableHeaderCell>
                      <CTableHeaderCell>Ngày tạo</CTableHeaderCell>
                      <CTableHeaderCell>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={10} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                        <CTableDataCell>{item.name || '-'}</CTableDataCell>
                        <CTableDataCell>{item.code || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={item.status === 'opened' ? 'success' : item.status === 'closed' ? 'secondary' : 'warning'}>
                            {item.status === 'draft' ? 'Nháp' : item.status === 'opened' ? 'Đang mở' : item.status === 'closed' ? 'Đã đóng' : 'Đã hủy'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{item.startAt ? `${formatDateTime(item.startAt)} → ${formatDateTime(item.endAt)}` : '-'}</CTableDataCell>
                        <CTableDataCell>{item.participantCount ?? 0}</CTableDataCell>
                        <CTableDataCell>{item.spinCount ?? 0}</CTableDataCell>
                        <CTableDataCell>{item.claimedCount ?? 0}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.createdAt)}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                            <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/lucky-wheels/${item.id}`)}>Chi tiết</CButton>
                            {item.status === 'draft' || item.status === 'closed' ? (
                              <CButton size='sm' color='success' variant='outline' onClick={() => handleOpen(item.id)}>Mở</CButton>
                            ) : null}
                            {item.status === 'opened' ? (
                              <CButton size='sm' color='warning' variant='outline' onClick={() => handleClose(item.id)}>Đóng</CButton>
                            ) : null}
                            <CButton size='sm' color='info' variant='outline' onClick={() => { navigator.clipboard?.writeText(window.location.origin + `/play/lucky-wheel/${item.code}`); alert('Copied') }}>Sao chép link</CButton>
                            <CButton size='sm' color='secondary' variant='outline' onClick={() => handleEditOpen(item)}>Sửa</CButton>
                            {item.status !== 'cancelled' ? (
                              <CButton size='sm' color='danger' variant='outline' onClick={() => handleCancel(item.id)}>Hủy</CButton>
                            ) : null}
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                <div className='d-flex justify-content-end'>
                  <CPagination aria-label='Page navigation example'>
                    <CPaginationItem disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((p) => p === '...' ? <CPaginationItem key={String(p)} disabled>…</CPaginationItem> : <CPaginationItem key={p} active={p === page} disabled={loading} onClick={() => setPage(p)}>{p}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pageCount || loading} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
      <CModal visible={showCreate} onClose={() => setShowCreate(false)}>
        <CModalHeader closeButton>Tạo vòng quay mới</CModalHeader>
        <CModalBody>
          <CForm onSubmit={(e) => { e.preventDefault(); handleCreate() }}>
            <div className='mb-3'>
              <CFormLabel>Tên</CFormLabel>
              <CFormInput value={createName} onChange={(e) => setCreateName(e.target.value)} required />
            </div>
            <div className='mb-3'>
              <CFormLabel>Mã (unique)</CFormLabel>
              <CFormInput value={createCode} onChange={(e) => setCreateCode(e.target.value)} required />
            </div>
            <div className='mb-3'>
              <CFormLabel>Mô tả</CFormLabel>
              <CFormInput value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' onClick={() => setShowCreate(false)} disabled={creating}>Hủy</CButton>
          <CButton color='primary' onClick={() => handleCreate()} disabled={creating}>{creating ? 'Đang tạo...' : 'Tạo'}</CButton>
        </CModalFooter>
      </CModal>
      <CModal visible={showEdit} onClose={() => setShowEdit(false)}>
        <CModalHeader closeButton>Chỉnh sửa chiến dịch</CModalHeader>
        <CModalBody>
          <CForm onSubmit={(e) => { e.preventDefault(); handleEditSave() }}>
            <div className='mb-3'>
              <CFormLabel>Tên</CFormLabel>
              <CFormInput value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className='mb-3'>
              <CFormLabel>Mã (unique)</CFormLabel>
              <CFormInput value={editCode} onChange={(e) => setEditCode(e.target.value)} required />
            </div>
            <div className='mb-3'>
              <CFormLabel>Mô tả</CFormLabel>
              <CFormInput value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' onClick={() => setShowEdit(false)} disabled={editing}>Hủy</CButton>
          <CButton color='primary' onClick={() => handleEditSave()} disabled={editing}>{editing ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}
