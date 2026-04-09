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
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import NotificationTemplateFormModal from '../components/NotificationTemplateFormModal'
import {
  createNotificationTemplate,
  getNotificationTemplates,
  updateNotificationTemplate,
} from '../services/admissionManagementService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function typeColor(type) {
  if (type === 'sms') return 'warning'
  if (type === 'ui') return 'info'
  return 'primary'
}

export default function NotificationTemplateManagementPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ q: '', type: '', isActive: '' })
  const [showModal, setShowModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const payload = await getNotificationTemplates({
        q: String(filters.q || '').trim() || undefined,
        type: String(filters.type || '').trim() || undefined,
        isActive: String(filters.isActive || '').trim() || undefined,
      })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không tải được NotificationTemplate'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  function openCreateModal() {
    setEditingRow(null)
    setShowModal(true)
  }

  function openEditModal(row) {
    setEditingRow(row)
    setShowModal(true)
  }

  async function handleSubmit(payload) {
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      if (editingRow?.id) {
        await updateNotificationTemplate(editingRow.id, payload)
        setSuccess('Cập nhật NotificationTemplate thành công')
      } else {
        await createNotificationTemplate(payload)
        setSuccess('Tạo NotificationTemplate thành công')
      }

      setShowModal(false)
      setEditingRow(null)
      await loadData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu NotificationTemplate'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Notification Template Management</strong>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={loadData} disabled={loading}>Tải lại</CButton>
              <CButton color='primary' onClick={openCreateModal}>Thêm template</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={5}>
                <CFormInput placeholder='Tìm theo tên, code, subject' value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
              </CCol>
              <CCol md={3}>
                <CFormSelect value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}>
                  <option value=''>Tất cả loại</option>
                  <option value='email'>email</option>
                  <option value='sms'>sms</option>
                  <option value='ui'>ui</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={filters.isActive} onChange={(event) => setFilters((prev) => ({ ...prev, isActive: event.target.value }))}>
                  <option value=''>Tất cả trạng thái</option>
                  <option value='true'>active</option>
                  <option value='false'>inactive</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CButton color='primary' className='w-100' onClick={loadData} disabled={loading}>Lọc</CButton>
              </CCol>
            </CRow>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            {success ? <CAlert color='success'>{success}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <CTable hover responsive align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Name</CTableHeaderCell>
                    <CTableHeaderCell>Code</CTableHeaderCell>
                    <CTableHeaderCell>Type</CTableHeaderCell>
                    <CTableHeaderCell>Tenant</CTableHeaderCell>
                    <CTableHeaderCell>isActive</CTableHeaderCell>
                    <CTableHeaderCell>Subject</CTableHeaderCell>
                    <CTableHeaderCell>Hành động</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rows.length > 0 ? rows.map((item) => (
                    <CTableRow key={item.id}>
                      <CTableDataCell>
                        <div className='fw-semibold'>{item.name || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>{item.code || '-'}</CTableDataCell>
                      <CTableDataCell><CBadge color={typeColor(item.type)}>{item.type || 'email'}</CBadge></CTableDataCell>
                      <CTableDataCell>
                        <div>{item.tenant?.name || '-'}</div>
                        <div className='small text-body-secondary'>{item.tenant?.code || ''}</div>
                      </CTableDataCell>
                      <CTableDataCell>{item.isActive ? 'Yes' : 'No'}</CTableDataCell>
                      <CTableDataCell>{item.subject || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <CButton size='sm' color='warning' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                      </CTableDataCell>
                    </CTableRow>
                  )) : (
                    <CTableRow>
                      <CTableDataCell colSpan={7} className='text-center text-body-secondary'>Chưa có NotificationTemplate nào</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <NotificationTemplateFormModal
        visible={showModal}
        initialValues={editingRow}
        onClose={() => {
          if (submitting) return
          setShowModal(false)
          setEditingRow(null)
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </CRow>
  )
}