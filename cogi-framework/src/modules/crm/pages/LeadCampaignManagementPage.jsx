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
import LeadCampaignFormModal from '../components/LeadCampaignFormModal'
import {
  createLeadCampaign,
  getLeadCampaignFormOptions,
  getLeadCampaigns,
  updateLeadCampaign,
} from '../services/crmService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function statusColor(status) {
  if (status === 'active') return 'success'
  if (status === 'paused') return 'warning'
  if (status === 'closed' || status === 'archived') return 'secondary'
  return 'info'
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatDateTime(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function LeadCampaignManagementPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rows, setRows] = useState([])
  const [formTemplateOptions, setFormTemplateOptions] = useState([])
  const [filters, setFilters] = useState({ q: '', status: '' })
  const [showModal, setShowModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [campaignData, options] = await Promise.all([
        getLeadCampaigns({
          q: String(filters.q || '').trim() || undefined,
          status: String(filters.status || '').trim() || undefined,
        }),
        getLeadCampaignFormOptions(),
      ])

      setRows(Array.isArray(campaignData?.data) ? campaignData.data : [])
      setFormTemplateOptions(Array.isArray(options?.formTemplates) ? options.formTemplates : [])
    } catch (requestError) {
      setRows([])
      setFormTemplateOptions([])
      setError(getApiMessage(requestError, 'Không tải được dữ liệu chiến dịch lead'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  const activeCount = useMemo(() => rows.filter((item) => item?.leadCampaignStatus === 'active').length, [rows])

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
        await updateLeadCampaign(editingRow.id, payload)
        setSuccess('Cập nhật chiến dịch lead thành công')
      } else {
        await createLeadCampaign(payload)
        setSuccess('Tạo chiến dịch lead thành công')
      }

      setShowModal(false)
      setEditingRow(null)
      await loadData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu chiến dịch lead'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <div>
              <strong>Lead Campaign Management</strong>
              <div className='small text-body-secondary mt-1'>Đang có {rows.length} chiến dịch, {activeCount} chiến dịch active.</div>
            </div>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={loadData} disabled={loading}>Tải lại</CButton>
              <CButton color='primary' onClick={openCreateModal}>Thêm chiến dịch</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={8}>
                <CFormInput placeholder='Tìm theo tên hoặc mã chiến dịch' value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
              </CCol>
              <CCol md={2}>
                <CFormSelect value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value=''>Tất cả trạng thái</option>
                  <option value='draft'>draft</option>
                  <option value='active'>active</option>
                  <option value='paused'>paused</option>
                  <option value='closed'>closed</option>
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
                    <CTableHeaderCell>Tên chiến dịch</CTableHeaderCell>
                    <CTableHeaderCell>Mã</CTableHeaderCell>
                    <CTableHeaderCell>FormTemplate</CTableHeaderCell>
                    <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell>Thời gian chạy</CTableHeaderCell>
                    <CTableHeaderCell>Lead</CTableHeaderCell>
                    <CTableHeaderCell>Email tự động</CTableHeaderCell>
                    <CTableHeaderCell>Email nội bộ</CTableHeaderCell>
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
                      <CTableDataCell>{item.formTemplate?.name ? `${item.formTemplate.name} v${item.formTemplate.version || 0}` : '-'}</CTableDataCell>
                      <CTableDataCell><CBadge color={statusColor(item.leadCampaignStatus)}>{item.leadCampaignStatus || 'draft'}</CBadge></CTableDataCell>
                      <CTableDataCell>
                        <div className='small'>Từ: {formatDateTime(item.startDate)}</div>
                        <div className='small'>Đến: {formatDateTime(item.endDate)}</div>
                      </CTableDataCell>
                      <CTableDataCell>{item.leadCount || 0}</CTableDataCell>
                      <CTableDataCell>{item.autoReplyEnabled ? 'Bật' : 'Tắt'}</CTableDataCell>
                      <CTableDataCell>{item.internalNotifyEnabled ? 'Bật' : 'Tắt'}</CTableDataCell>
                      <CTableDataCell>
                        <CButton size='sm' color='warning' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                      </CTableDataCell>
                    </CTableRow>
                  )) : (
                    <CTableRow>
                      <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Chưa có chiến dịch lead nào</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <LeadCampaignFormModal
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
