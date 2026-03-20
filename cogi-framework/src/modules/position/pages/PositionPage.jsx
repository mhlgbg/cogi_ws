import { useCallback, useEffect, useMemo, useState } from 'react'
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
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CPagination,
  CPaginationItem,
} from '@coreui/react'
import { useAuth } from '../../../contexts/AuthContext'
import { useTenant } from '../../../contexts/TenantContext'
import PositionFormModal from '../components/PositionFormModal'
import {
  createPosition,
  deletePosition,
  getPositionPage,
  updatePosition,
} from '../services/positionService'

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Ngưng hoạt động' },
]

const LEADERSHIP_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'non-leadership', label: 'Non leadership' },
]

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toEntityKey(entity) {
  if (!entity || typeof entity !== 'object') return ''
  return toText(entity.documentId) || toText(entity.id)
}

function formatDateDDMMYYYY(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${day}/${month}/${year}`
}

function getStatusMeta(isActive) {
  return isActive
    ? { color: 'success', label: 'Active' }
    : { color: 'secondary', label: 'Inactive' }
}

function getLeadershipMeta(isLeadership) {
  return isLeadership
    ? { color: 'info', label: 'Leadership' }
    : { color: 'secondary', label: 'Non leadership' }
}

export default function PositionPage() {
  const auth = useAuth()
  const tenant = useTenant()

  const token = auth?.token || localStorage.getItem('authJwt') || ''
  const tenantCode = tenant?.currentTenant?.tenantCode || localStorage.getItem('tenantCode') || ''
  const tenantName = tenant?.currentTenant?.tenantName || localStorage.getItem('tenantName') || ''

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)

  const [filters, setFilters] = useState({
    keywordDraft: '',
    keyword: '',
    status: '',
    leadership: '',
  })

  const [showFormModal, setShowFormModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)

  const fromToText = useMemo(() => {
    if (!total) return '0'
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    return `${from}–${to}/${total}`
  }, [page, pageSize, total])

  const pageItems = useMemo(() => {
    const items = []
    for (let index = 1; index <= pageCount; index += 1) {
      items.push(index)
    }
    return items
  }, [pageCount])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = {
        'pagination[page]': page,
        'pagination[pageSize]': pageSize,
        'sort[0]': 'updatedAt:desc',
      }

      const keyword = toText(filters.keyword)
      if (keyword) {
        params['filters[$or][0][name][$containsi]'] = keyword
        params['filters[$or][1][code][$containsi]'] = keyword
      }

      if (filters.status === 'active') {
        params['filters[isActive][$eq]'] = true
      }

      if (filters.status === 'inactive') {
        params['filters[isActive][$eq]'] = false
      }

      if (filters.leadership === 'leadership') {
        params['filters[isLeadership][$eq]'] = true
      }

      if (filters.leadership === 'non-leadership') {
        params['filters[isLeadership][$eq]'] = false
      }

      const result = await getPositionPage(params)

      setRows(result.rows || [])
      setTotal(result.pagination?.total || 0)
      setPage(result.pagination?.page || page)
      setPageSize(result.pagination?.pageSize || pageSize)
      setPageCount(Math.max(1, result.pagination?.pageCount || 1))
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.error?.message
      setError(apiMessage || 'Không tải được danh sách vị trí')
      setRows([])
      setTotal(0)
      setPageCount(1)
    } finally {
      setLoading(false)
    }
  }, [filters.keyword, filters.status, filters.leadership, page, pageSize])

  useEffect(() => {
    if (!token || !tenantCode) {
      setRows([])
      return
    }

    loadData()
  }, [token, tenantCode, loadData])

  function openCreateModal() {
    setEditingRow(null)
    setShowFormModal(true)
  }

  function openEditModal(row) {
    setEditingRow(row)
    setShowFormModal(true)
  }

  async function handleSave(payload) {
    setSaving(true)
    setError('')

    try {
      const identifier = toEntityKey(editingRow)

      if (identifier) {
        await updatePosition(identifier, payload)
        setSuccess('Cập nhật vị trí thành công.')
      } else {
        await createPosition(payload)
        setSuccess('Tạo vị trí thành công.')
      }

      setShowFormModal(false)
      setEditingRow(null)
      await loadData()
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.error?.message
      setError(apiMessage || 'Không thể lưu dữ liệu vị trí')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    const identifier = toEntityKey(row)
    if (!identifier) return

    const confirmed = window.confirm('Bạn có chắc muốn xóa vị trí này?')
    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      await deletePosition(identifier)
      setSuccess('Xóa vị trí thành công.')
      await loadData()
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.error?.message
      setError(apiMessage || 'Không thể xóa vị trí')
    }
  }

  function onSearch() {
    setPage(1)
    setFilters((prev) => ({
      ...prev,
      keyword: toText(prev.keywordDraft),
    }))
  }

  function onReset() {
    setPage(1)
    setFilters({
      keywordDraft: '',
      keyword: '',
      status: '',
      leadership: '',
    })
  }

  return (
    <CRow className="g-3">
      <CCol xs={12}>
        <CCard>
          <CCardHeader>
            <strong>Position Management</strong>
            <div className="small text-body-secondary mt-1">
              Tenant: {tenantName || tenantCode || '-'}
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3 ai-form align-items-end">
              <CCol md={4}>
                <CFormLabel>Keyword</CFormLabel>
                <CFormInput
                  value={filters.keywordDraft}
                  onChange={(event) => setFilters((prev) => ({ ...prev, keywordDraft: event.target.value }))}
                  placeholder="Tìm theo code hoặc name"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      onSearch()
                    }
                  }}
                />
              </CCol>

              <CCol md={3}>
                <CFormLabel>Status</CFormLabel>
                <CFormSelect
                  value={filters.status}
                  onChange={(event) => {
                    const value = event.target.value
                    setPage(1)
                    setFilters((prev) => ({ ...prev, status: value }))
                  }}
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={3}>
                <CFormLabel>Leadership</CFormLabel>
                <CFormSelect
                  value={filters.leadership}
                  onChange={(event) => {
                    const value = event.target.value
                    setPage(1)
                    setFilters((prev) => ({ ...prev, leadership: value }))
                  }}
                >
                  {LEADERSHIP_FILTER_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={2}>
                <div className="d-flex gap-2">
                  <CButton color="primary" onClick={onSearch} disabled={loading}>
                    Search
                  </CButton>
                  <CButton color="secondary" variant="outline" onClick={onReset} disabled={loading}>
                    Reset
                  </CButton>
                </div>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard>
          <CCardHeader className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <strong>Danh sách vị trí</strong>
            <div className="d-flex align-items-center gap-2">
              <span className="small text-body-secondary">{fromToText}</span>
              <CButton color="primary" onClick={openCreateModal}>
                Thêm mới
              </CButton>
            </div>
          </CCardHeader>

          <CCardBody>
            {success ? <CAlert color="success">{success}</CAlert> : null}
            {error ? <CAlert color="danger">{error}</CAlert> : null}

            {loading ? (
              <div className="text-center py-4">
                <CSpinner size="sm" />
              </div>
            ) : (
              <>
                <CTable hover responsive align="middle">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell scope="col" style={{ width: 70 }}>STT</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Code</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Name</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Level</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Leadership</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Status</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Updated At</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Actions</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>

                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={8} className="text-center text-body-secondary py-4">
                          Không có dữ liệu
                        </CTableDataCell>
                      </CTableRow>
                    ) : rows.map((row, index) => {
                      const stt = (page - 1) * pageSize + index + 1
                      const statusMeta = getStatusMeta(row.isActive)
                      const leadershipMeta = getLeadershipMeta(row.isLeadership)

                      return (
                        <CTableRow key={toEntityKey(row) || `${row.code}-${index}`}>
                          <CTableDataCell>{stt}</CTableDataCell>
                          <CTableDataCell>{row.code || '-'}</CTableDataCell>
                          <CTableDataCell>{row.name || '-'}</CTableDataCell>
                          <CTableDataCell>{row.level ?? '-'}</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={leadershipMeta.color}>{leadershipMeta.label}</CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                          </CTableDataCell>
                          <CTableDataCell>{formatDateDDMMYYYY(row.updatedAt)}</CTableDataCell>
                          <CTableDataCell>
                            <div className="d-flex gap-2">
                              <CButton color="primary" variant="outline" size="sm" onClick={() => openEditModal(row)}>
                                Edit
                              </CButton>
                              <CButton
                                color="danger"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(row)}
                              >
                                Delete
                              </CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="d-flex align-items-center gap-2 ai-form">
                    <span>Page size</span>
                    <CFormSelect
                      style={{ width: 100 }}
                      value={pageSize}
                      onChange={(event) => {
                        const value = Number(event.target.value)
                        if (!Number.isInteger(value) || value <= 0) return
                        setPage(1)
                        setPageSize(value)
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </CFormSelect>
                  </div>

                  <CPagination align="end" className="mb-0">
                    <CPaginationItem
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Prev
                    </CPaginationItem>

                    {pageItems.map((pageItem) => (
                      <CPaginationItem
                        key={pageItem}
                        active={pageItem === page}
                        disabled={loading}
                        onClick={() => setPage(pageItem)}
                      >
                        {pageItem}
                      </CPaginationItem>
                    ))}

                    <CPaginationItem
                      disabled={page >= pageCount || loading}
                      onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                    >
                      Next
                    </CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <PositionFormModal
        visible={showFormModal}
        mode={editingRow ? 'edit' : 'create'}
        initialValues={editingRow || undefined}
        loading={saving}
        onClose={() => {
          if (saving) return
          setShowFormModal(false)
          setEditingRow(null)
        }}
        onSubmit={handleSave}
      />
    </CRow>
  )
}
