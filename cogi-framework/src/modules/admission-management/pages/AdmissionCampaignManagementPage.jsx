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
import AdmissionCampaignFormModal from '../components/AdmissionCampaignFormModal'
import {
  createAdmissionCampaign,
  getAdmissionCampaignFormOptions,
  getAdmissionCampaigns,
  updateAdmissionCampaign,
} from '../services/admissionManagementService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function statusColor(status) {
  if (status === 'open') return 'success'
  if (status === 'closed') return 'secondary'
  return 'warning'
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function AdmissionCampaignManagementPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rows, setRows] = useState([])
  const [formTemplateOptions, setFormTemplateOptions] = useState([])
  const [filters, setFilters] = useState({ q: '', status: '', year: '' })
  const [showModal, setShowModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [campaignData, options] = await Promise.all([
        getAdmissionCampaigns({
          q: String(filters.q || '').trim() || undefined,
          status: String(filters.status || '').trim() || undefined,
          year: String(filters.year || '').trim() || undefined,
        }),
        getAdmissionCampaignFormOptions(),
      ])

      setRows(Array.isArray(campaignData?.data) ? campaignData.data : [])
      setFormTemplateOptions(Array.isArray(options?.formTemplates) ? options.formTemplates : [])
    } catch (requestError) {
      setRows([])
      setFormTemplateOptions([])
      setError(getApiMessage(requestError, 'Không tải được dữ liệu chiến dịch tuyển sinh'))
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

  const availableYears = useMemo(() => {
    return [...new Set(rows.map((item) => Number(item?.year || 0)).filter((value) => value > 0))].sort((a, b) => b - a)
  }, [rows])

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
        await updateAdmissionCampaign(editingRow.id, payload)
        setSuccess('Cập nhật chiến dịch tuyển sinh thành công')
      } else {
        await createAdmissionCampaign(payload)
        setSuccess('Tạo chiến dịch tuyển sinh thành công')
      }

      setShowModal(false)
      setEditingRow(null)
      await loadData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu chiến dịch tuyển sinh'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Admission Campaign Management</strong>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={loadData} disabled={loading}>Tải lại</CButton>
              <CButton color='primary' onClick={openCreateModal}>Thêm chiến dịch</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={5}>
                <CFormInput placeholder='Tìm theo tên, mã, khối' value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
              </CCol>
              <CCol md={3}>
                <CFormSelect value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value=''>Tất cả trạng thái</option>
                  <option value='draft'>draft</option>
                  <option value='open'>open</option>
                  <option value='closed'>closed</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={filters.year} onChange={(event) => setFilters((prev) => ({ ...prev, year: event.target.value }))}>
                  <option value=''>Tất cả năm</option>
                  {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
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
                    <CTableHeaderCell>Tên chiến dịch</CTableHeaderCell>
                    <CTableHeaderCell>Mã</CTableHeaderCell>
                    <CTableHeaderCell>Năm</CTableHeaderCell>
                    <CTableHeaderCell>Khối</CTableHeaderCell>
                    <CTableHeaderCell>FormTemplate</CTableHeaderCell>
                    <CTableHeaderCell>Version</CTableHeaderCell>
                    <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell>Hoạt động</CTableHeaderCell>
                    <CTableHeaderCell>Hồ sơ</CTableHeaderCell>
                    <CTableHeaderCell>Hành động</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rows.length > 0 ? rows.map((item) => (
                    <CTableRow key={item.id}>
                      <CTableDataCell>
                        <div className='fw-semibold'>{item.name || '-'}</div>
                        <div className='small text-body-secondary'>{stripHtml(item.description) || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>{item.code || '-'}</CTableDataCell>
                      <CTableDataCell>{item.year || '-'}</CTableDataCell>
                      <CTableDataCell>{item.grade || '-'}</CTableDataCell>
                      <CTableDataCell>{item.formTemplate?.name || '-'}</CTableDataCell>
                      <CTableDataCell>{item.formTemplateVersion || '-'}</CTableDataCell>
                      <CTableDataCell><CBadge color={statusColor(item.status)}>{item.status || 'draft'}</CBadge></CTableDataCell>
                      <CTableDataCell>{item.isActive ? 'Yes' : 'No'}</CTableDataCell>
                      <CTableDataCell>{item.applicationCount || 0}</CTableDataCell>
                      <CTableDataCell>
                        <CButton size='sm' color='warning' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                      </CTableDataCell>
                    </CTableRow>
                  )) : (
                    <CTableRow>
                      <CTableDataCell colSpan={10} className='text-center text-body-secondary'>Chưa có chiến dịch tuyển sinh nào</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <AdmissionCampaignFormModal
        visible={showModal}
        initialValues={editingRow}
        formTemplateOptions={formTemplateOptions}
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