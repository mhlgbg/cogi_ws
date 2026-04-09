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
import FormTemplateFormModal from '../components/FormTemplateFormModal'
import {
  createFormTemplate,
  getFormTemplates,
  updateFormTemplate,
} from '../services/admissionManagementService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function statusColor(status) {
  if (status === 'published') return 'success'
  if (status === 'archived') return 'secondary'
  return 'warning'
}

export default function FormTemplateManagementPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ q: '', status: '' })
  const [showModal, setShowModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const payload = await getFormTemplates({
        q: String(filters.q || '').trim() || undefined,
        status: String(filters.status || '').trim() || undefined,
      })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không tải được FormTemplate'))
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

  const groupedSummary = useMemo(() => {
    const counts = new Map()
    rows.forEach((item) => {
      const key = String(item?.name || '')
      counts.set(key, Number(counts.get(key) || 0) + 1)
    })
    return counts
  }, [rows])

  function openCreateModal() {
    setEditingRow(null)
    setShowModal(true)
  }

  function openEditModal(row) {
    setEditingRow(row)
    setShowModal(true)
  }

  function openCloneVersion(row) {
    setEditingRow({
      ...row,
      id: null,
      version: Number(row?.version || 0) + 1,
      status: 'draft',
      isLocked: false,
    })
    setShowModal(true)
  }

  async function handleSubmit(payload) {
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      if (editingRow?.id) {
        await updateFormTemplate(editingRow.id, payload)
        setSuccess('Cập nhật FormTemplate thành công')
      } else {
        await createFormTemplate(payload)
        setSuccess('Tạo FormTemplate thành công')
      }

      setShowModal(false)
      setEditingRow(null)
      await loadData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu FormTemplate'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Form Template Management</strong>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={loadData} disabled={loading}>Tải lại</CButton>
              <CButton color='primary' onClick={openCreateModal}>Thêm FormTemplate</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={8}>
                <CFormInput placeholder='Tìm theo tên FormTemplate' value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
              </CCol>
              <CCol md={2}>
                <CFormSelect value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value=''>Tất cả trạng thái</option>
                  <option value='draft'>draft</option>
                  <option value='published'>published</option>
                  <option value='archived'>archived</option>
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
                    <CTableHeaderCell>Tên</CTableHeaderCell>
                    <CTableHeaderCell>Version</CTableHeaderCell>
                    <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell>isLocked</CTableHeaderCell>
                    <CTableHeaderCell>Campaign sử dụng</CTableHeaderCell>
                    <CTableHeaderCell>Số version</CTableHeaderCell>
                    <CTableHeaderCell>Hành động</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rows.length > 0 ? rows.map((item) => (
                    <CTableRow key={item.id}>
                      <CTableDataCell>{item.name || '-'}</CTableDataCell>
                      <CTableDataCell>{item.version || '-'}</CTableDataCell>
                      <CTableDataCell><CBadge color={statusColor(item.status)}>{item.status || 'draft'}</CBadge></CTableDataCell>
                      <CTableDataCell>{item.isLocked ? 'Yes' : 'No'}</CTableDataCell>
                      <CTableDataCell>{item.usageCount || 0}</CTableDataCell>
                      <CTableDataCell>{groupedSummary.get(String(item.name || '')) || 1}</CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex gap-2 flex-wrap'>
                          <CButton size='sm' color='warning' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                          <CButton size='sm' color='info' variant='outline' onClick={() => openCloneVersion(item)}>Tạo version mới</CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  )) : (
                    <CTableRow>
                      <CTableDataCell colSpan={7} className='text-center text-body-secondary'>Chưa có FormTemplate nào</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <FormTemplateFormModal
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