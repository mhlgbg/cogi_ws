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
import { formatDateTime, getApiMessage, getEntityId, getStatusBadgeColor } from '../utils/questionBankUi'

function buildInitialForm(fields = []) {
  return fields.reduce((result, field) => {
    result[field.name] = field.defaultValue ?? ''
    return result
  }, {})
}

export default function ReferenceDataTab({
  title,
  load,
  create,
  update,
  remove,
  fields = [],
  columns = [],
  searchPlaceholder = 'Tìm theo code, title...',
  statusField = 'status',
  entityLabel = 'bản ghi',
  setWorkspaceActions,
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [formData, setFormData] = useState(() => buildInitialForm(fields))

  const filteredRows = useMemo(() => {
    if (!statusFilter) return rows
    return rows.filter((item) => String(item?.[statusField] || item?.status || '').trim() === statusFilter)
  }, [rows, statusField, statusFilter])

  useEffect(() => {
    loadRows()
  }, [q])

  useEffect(() => {
    setWorkspaceActions?.(<CButton color='primary' onClick={openCreateModal}>+ Thêm mới</CButton>)
    return () => setWorkspaceActions?.(null)
  }, [setWorkspaceActions])

  function resetForm() {
    setFormData(buildInitialForm(fields))
    setEditingRow(null)
  }

  async function loadRows() {
    setLoading(true)
    setError('')
    try {
      const payload = await load({ q })
      const nextRows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
      setRows(nextRows)
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, `Không tải được ${entityLabel}`))
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    resetForm()
    setShowModal(true)
  }

  function openEditModal(row) {
    setEditingRow(row)
    const next = buildInitialForm(fields)
    fields.forEach((field) => {
      next[field.name] = field.normalize ? field.normalize(row) : row?.[field.name] ?? field.defaultValue ?? ''
    })
    setFormData(next)
    setShowModal(true)
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
    resetForm()
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = fields.reduce((result, field) => {
        result[field.name] = field.toPayload ? field.toPayload(formData[field.name], formData) : formData[field.name]
        return result
      }, {})
      if (editingRow) {
        await update(getEntityId(editingRow), payload)
        setSuccess(`Cập nhật ${entityLabel} thành công`)
      } else {
        await create(payload)
        setSuccess(`Tạo ${entityLabel} thành công`)
      }
      closeModal()
      await loadRows()
    } catch (requestError) {
      setError(getApiMessage(requestError, `Không lưu được ${entityLabel}`))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Bạn chắc chắn muốn xóa ${entityLabel} ${row?.title || row?.name || row?.code || ''}?`)) return
    setError('')
    setSuccess('')
    try {
      await remove(getEntityId(row))
      setSuccess(`Xóa ${entityLabel} thành công`)
      await loadRows()
    } catch (requestError) {
      setError(getApiMessage(requestError, `Không xóa được ${entityLabel}`))
    }
  }

  return (
    <>
      <CCard className='mb-4 ai-card'>
        <CCardHeader>
          <strong>Bộ lọc</strong>
        </CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol md={8}>
              <CFormInput value={qDraft} onChange={(event) => setQDraft(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter') setQ(String(qDraft || '').trim())
              }} label='Từ khóa' placeholder={searchPlaceholder} />
            </CCol>
            <CCol md={2}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value=''>Tất cả</option>
                <option value='active'>Đang hoạt động</option>
                <option value='archived'>Đã lưu trữ</option>
              </CFormSelect>
            </CCol>
            <CCol md={2} className='d-flex gap-2'>
              <CButton color='primary' onClick={() => setQ(String(qDraft || '').trim())}>Search</CButton>
              <CButton color='secondary' variant='outline' onClick={() => { setQ(''); setQDraft(''); setStatusFilter('') }}>Đặt lại</CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CCard className='ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <div>
            <strong>{title}</strong>
            <CBadge color='secondary' className='ms-2'>{filteredRows.length}</CBadge>
          </div>
          <CButton color='success' onClick={openCreateModal}>+ Thêm mới</CButton>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Đang tải dữ liệu...</span>
            </div>
          ) : (
            <CTable hover responsive className='ai-table'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                  {columns.map((column) => <CTableHeaderCell key={column.key} style={column.style}>{column.label}</CTableHeaderCell>)}
                  <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {filteredRows.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={columns.length + 2} className='text-center text-body-secondary'>Chưa có dữ liệu</CTableDataCell>
                  </CTableRow>
                ) : filteredRows.map((row, index) => (
                  <CTableRow key={getEntityId(row) || `${entityLabel}-${index}`}>
                    <CTableDataCell>{index + 1}</CTableDataCell>
                    {columns.map((column) => {
                      const value = column.render ? column.render(row) : row?.[column.key]
                      return <CTableDataCell key={column.key}>{value}</CTableDataCell>
                    })}
                    <CTableDataCell>
                      <div className='d-flex gap-2'>
                        <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(row)}>Sửa</CButton>
                        <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(row)}>Xóa</CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      <CModal visible={showModal} backdrop='static' size='lg' onClose={closeModal}>
        <CModalHeader>
          <CModalTitle>{editingRow ? `Sửa ${entityLabel}` : `Thêm ${entityLabel}`}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            {fields.map((field) => {
              const value = formData[field.name] ?? ''
              if (field.type === 'textarea') {
                return (
                  <CCol key={field.name} xs={12} md={field.colSpan || 12}>
                    <CFormLabel>{field.label}</CFormLabel>
                    <CFormTextarea rows={field.rows || 3} value={value} onChange={(event) => setFormData((prev) => ({ ...prev, [field.name]: event.target.value }))} />
                  </CCol>
                )
              }
              if (field.type === 'select') {
                return (
                  <CCol key={field.name} xs={12} md={field.colSpan || 6}>
                    <CFormLabel>{field.label}</CFormLabel>
                    <CFormSelect value={value} onChange={(event) => setFormData((prev) => ({ ...prev, [field.name]: event.target.value }))}>
                      {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </CFormSelect>
                  </CCol>
                )
              }
              return (
                <CCol key={field.name} xs={12} md={field.colSpan || 6}>
                  <CFormLabel>{field.label}</CFormLabel>
                  <CFormInput type={field.type || 'text'} value={value} onChange={(event) => setFormData((prev) => ({ ...prev, [field.name]: event.target.value }))} />
                </CCol>
              )
            })}
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeModal} disabled={saving}>Đóng</CButton>
          <CButton color='primary' onClick={handleSubmit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}
