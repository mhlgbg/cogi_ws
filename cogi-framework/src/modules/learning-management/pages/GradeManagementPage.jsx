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
  createGrade,
  deleteGrade,
  getGrades,
  updateGrade,
} from '../services/learningObjectApi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function getEntityId(entity) {
  if (!entity) return ''
  return entity.documentId || entity.id || ''
}

function emptyForm() {
  return {
    code: '',
    title: '',
    order: '0',
    description: '',
    gradeStatus: 'active',
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function getStatusLabel(status) {
  if (status === 'inactive') return 'Ngưng hoạt động'
  if (status === 'active') return 'Đang hoạt động'
  return status || '-'
}

export default function GradeManagementPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [formData, setFormData] = useState(emptyForm())

  const filteredRows = useMemo(() => {
    if (!statusFilter) return rows
    return rows.filter((item) => String(item?.gradeStatus || item?.status || '').trim() === statusFilter)
  }, [rows, statusFilter])

  async function load() {
    setLoading(true)
    setError('')

    try {
      const result = await getGrades({ q })
      setRows(Array.isArray(result) ? result : [])
    } catch (loadError) {
      setRows([])
      setError(getApiMessage(loadError, 'Không tải được danh sách grades'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function resetForm() {
    setFormData(emptyForm())
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
    setEditingId('')
    resetForm()
  }

  function openCreateModal() {
    setEditingId('')
    setError('')
    resetForm()
    setShowModal(true)
  }

  function openEditModal(item) {
    setEditingId(getEntityId(item))
    setError('')
    setFormData({
      code: item?.code || '',
      title: item?.title || '',
      order: String(item?.order ?? 0),
      description: item?.description || '',
      gradeStatus: item?.gradeStatus || item?.status || 'active',
    })
    setShowModal(true)
  }

  function applySearch() {
    setQ(String(qDraft || '').trim())
  }

  function resetFilters() {
    setQ('')
    setQDraft('')
    setStatusFilter('')
  }

  async function handleSubmit() {
    if (!String(formData.code || '').trim()) {
      setError('Code không được để trống')
      return
    }

    if (!String(formData.title || '').trim()) {
      setError('Title không được để trống')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        code: String(formData.code || '').trim(),
        title: String(formData.title || '').trim(),
        order: Number(formData.order || 0),
        description: String(formData.description || '').trim(),
        gradeStatus: formData.gradeStatus === 'inactive' ? 'inactive' : 'active',
      }

      if (editingId) {
        await updateGrade(editingId, payload)
        setSuccess('Cập nhật grade thành công')
      } else {
        await createGrade(payload)
        setSuccess('Thêm grade thành công')
      }

      closeModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu grade'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    const entityId = getEntityId(item)
    if (!entityId) return
    if (!window.confirm(`Bạn chắc chắn muốn xóa grade ${item?.title || item?.code || ''}?`)) return

    setError('')
    setSuccess('')

    try {
      await deleteGrade(entityId)
      setSuccess('Xóa grade thành công')
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa grade'))
    }
  }

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <CCard className='mb-4 ai-card'>
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 ai-form align-items-end'>
              <CCol md={7}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo code, title, mô tả...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={3}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value=''>Tất cả</option>
                  <option value='active'>Đang hoạt động</option>
                  <option value='inactive'>Ngưng hoạt động</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12} md={2} className='d-flex justify-content-end gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {success ? <CAlert color='success' className='mb-4'>{success}</CAlert> : null}
        {error ? <CAlert color='danger' className='mb-4'>{error}</CAlert> : null}

        <CCard className='ai-card'>
          <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
            <div>
              <strong>Grades</strong>
              <CBadge color='secondary' className='ms-2'>{filteredRows.length}</CBadge>
            </div>
            <CButton color='success' onClick={openCreateModal} disabled={loading}>+ Thêm mới</CButton>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <CTable hover responsive className='mb-0 ai-table'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 140 }}>Code</CTableHeaderCell>
                    <CTableHeaderCell style={{ minWidth: 220 }}>Title</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 110 }}>Order</CTableHeaderCell>
                    <CTableHeaderCell style={{ minWidth: 240 }}>Mô tả</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 160 }}>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 220 }}>Cập nhật</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {filteredRows.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={8} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                    </CTableRow>
                  ) : filteredRows.map((item, index) => {
                    const status = item?.gradeStatus || item?.status || ''

                    return (
                      <CTableRow key={getEntityId(item) || `${item?.code || 'grade'}-${index}`}>
                        <CTableDataCell>{index + 1}</CTableDataCell>
                        <CTableDataCell>{item?.code || '-'}</CTableDataCell>
                        <CTableDataCell>{item?.title || '-'}</CTableDataCell>
                        <CTableDataCell>{Number(item?.order || 0)}</CTableDataCell>
                        <CTableDataCell>{item?.description || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={status === 'inactive' ? 'secondary' : 'success'}>{getStatusLabel(status)}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{formatDateTime(item?.updatedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item)}>Xóa</CButton>
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

        <CModal backdrop='static' visible={showModal} onClose={closeModal} size='lg'>
          <CModalHeader>
            <CModalTitle>{editingId ? 'Sửa grade' : 'Thêm grade'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CRow className='g-3'>
              <CCol md={4}>
                <CFormLabel htmlFor='grade-code'>Code <span className='text-danger'>*</span></CFormLabel>
                <CFormInput id='grade-code' value={formData.code} onChange={(event) => setFormData((prev) => ({ ...prev, code: event.target.value }))} disabled={saving} />
              </CCol>
              <CCol md={5}>
                <CFormLabel htmlFor='grade-title'>Title <span className='text-danger'>*</span></CFormLabel>
                <CFormInput id='grade-title' value={formData.title} onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))} disabled={saving} />
              </CCol>
              <CCol md={3}>
                <CFormLabel htmlFor='grade-order'>Order</CFormLabel>
                <CFormInput id='grade-order' type='number' min={0} value={formData.order} onChange={(event) => setFormData((prev) => ({ ...prev, order: event.target.value }))} disabled={saving} />
              </CCol>
              <CCol md={4}>
                <CFormLabel htmlFor='grade-status'>Trạng thái</CFormLabel>
                <CFormSelect id='grade-status' value={formData.gradeStatus} onChange={(event) => setFormData((prev) => ({ ...prev, gradeStatus: event.target.value }))} disabled={saving}>
                  <option value='active'>Đang hoạt động</option>
                  <option value='inactive'>Ngưng hoạt động</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel htmlFor='grade-description'>Mô tả</CFormLabel>
                <CFormTextarea id='grade-description' rows={4} value={formData.description} onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))} disabled={saving} />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeModal} disabled={saving}>Hủy</CButton>
            <CButton color='primary' onClick={handleSubmit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}