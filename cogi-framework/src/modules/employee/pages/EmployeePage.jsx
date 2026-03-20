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
import EmployeeFormModal from '../components/EmployeeFormModal'
import EmployeeHistoryModal from '../components/EmployeeHistoryModal'
import {
  createEmployee,
  createEmployeeHistory,
  deleteEmployee,
  formatDateDDMMYYYY,
  getDepartmentOptions,
  getEmployeeHistoryPage,
  getEmployeePage,
  getManagerOptions,
  getPositionOptions,
  getStatusMeta,
  getUserOptions,
  toAbsoluteMediaUrl,
  toEntityKey,
  updateEmployee,
  updateEmployeeHistory,
} from '../services/employeeService'

export default function EmployeePage() {
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
    department: '',
    position: '',
    status: '',
  })

  const [departmentOptions, setDepartmentOptions] = useState([])
  const [positionOptions, setPositionOptions] = useState([])
  const [managerOptions, setManagerOptions] = useState([])
  const [userOptions, setUserOptions] = useState([])

  const [showFormModal, setShowFormModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)

  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyEmployee, setHistoryEmployee] = useState(null)
  const [historyRows, setHistoryRows] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySaving, setHistorySaving] = useState(false)
  const [historyError, setHistoryError] = useState('')

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

  const statusOptions = useMemo(() => {
    return [
      { value: '', label: 'Tất cả' },
      { value: 'draft', label: 'Draft' },
      { value: 'active', label: 'Active' },
      { value: 'probation', label: 'Probation' },
      { value: 'official', label: 'Official' },
      { value: 'maternity_leave', label: 'Maternity Leave' },
      { value: 'unpaid_leave', label: 'Unpaid Leave' },
      { value: 'resigned', label: 'Resigned' },
      { value: 'retired', label: 'Retired' },
    ]
  }, [])

  const loadOptions = useCallback(async () => {
    try {
      const [departments, positions, managers, users] = await Promise.all([
        getDepartmentOptions(),
        getPositionOptions(),
        getManagerOptions(),
        getUserOptions(),
      ])

      setDepartmentOptions(departments)
      setPositionOptions(positions)
      setManagerOptions(managers)
      setUserOptions(users)
    } catch (requestError) {
      setDepartmentOptions([])
      setPositionOptions([])
      setManagerOptions([])
      setUserOptions([])

      const apiMessage = requestError?.response?.data?.error?.message
      setError(apiMessage || 'Không tải được danh mục Department/Position/Manager')
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = {
        'pagination[page]': page,
        'pagination[pageSize]': pageSize,
        'sort[0]': 'updatedAt:desc',
        'populate[0]': 'currentDepartment',
        'populate[1]': 'currentPosition',
        'populate[2]': 'currentManager',
        'populate[3]': 'user',
        'populate[4]': 'avatar',
      }

      const keyword = String(filters.keyword || '').trim()
      if (keyword) {
        params['filters[$or][0][fullName][$containsi]'] = keyword
        params['filters[$or][1][employeeCode][$containsi]'] = keyword
        params['filters[$or][2][phone][$containsi]'] = keyword
        params['filters[$or][3][workEmail][$containsi]'] = keyword
        params['filters[$or][4][personalEmail][$containsi]'] = keyword
      }

      if (filters.department) {
        params['filters[currentDepartment][id][$eq]'] = Number(filters.department)
      }

      if (filters.position) {
        params['filters[currentPosition][id][$eq]'] = Number(filters.position)
      }

      if (filters.status) {
        params['filters[status][$eq]'] = filters.status
      }

      const result = await getEmployeePage(params)

      setRows(result.rows || [])
      setTotal(result.pagination?.total || 0)
      setPage(result.pagination?.page || page)
      setPageSize(result.pagination?.pageSize || pageSize)
      setPageCount(Math.max(1, result.pagination?.pageCount || 1))
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.error?.message
      setError(apiMessage || 'Không tải được danh sách nhân sự')
      setRows([])
      setTotal(0)
      setPageCount(1)
    } finally {
      setLoading(false)
    }
  }, [filters.department, filters.keyword, filters.position, filters.status, page, pageSize])

  const loadHistory = useCallback(async (employeeRow) => {
    const employeeId = employeeRow?.id || null
    if (!employeeId) {
      setHistoryRows([])
      return
    }

    setHistoryLoading(true)
    setHistoryError('')

    try {
      const result = await getEmployeeHistoryPage({
        'pagination[page]': 1,
        'pagination[pageSize]': 200,
        'sort[0]': 'startDate:desc',
        'filters[employee][id][$eq]': employeeId,
        'populate[0]': 'employee',
        'populate[1]': 'department',
        'populate[2]': 'position',
        'populate[3]': 'manager',
      })

      setHistoryRows(result.rows || [])
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.error?.message
      setHistoryError(apiMessage || 'Không tải được lịch sử công tác')
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!token || !tenantCode) {
      setRows([])
      setDepartmentOptions([])
      setPositionOptions([])
      setManagerOptions([])
      setUserOptions([])
      return
    }

    loadOptions()
  }, [token, tenantCode, loadOptions])

  useEffect(() => {
    if (!token || !tenantCode) return
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

  async function handleSaveEmployee(payload) {
    setSaving(true)
    setError('')

    try {
      const identifier = toEntityKey(editingRow)

      if (identifier) {
        await updateEmployee(identifier, payload)
        setSuccess('Cập nhật nhân sự thành công.')
      } else {
        await createEmployee(payload)
        setSuccess('Tạo nhân sự thành công.')
      }

      setShowFormModal(false)
      setEditingRow(null)
      await Promise.all([loadData(), loadOptions()])
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.error?.message
      setError(apiMessage || 'Không thể lưu dữ liệu nhân sự')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEmployee(row) {
    const identifier = toEntityKey(row)
    if (!identifier) return

    const confirmed = window.confirm('Bạn có chắc muốn xóa nhân sự này?')
    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      await deleteEmployee(identifier)
      setSuccess('Xóa nhân sự thành công.')
      await Promise.all([loadData(), loadOptions()])
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.error?.message
      setError(apiMessage || 'Không thể xóa nhân sự')
    }
  }

  async function handleSaveHistory({ id, payload }) {
    setHistorySaving(true)
    setHistoryError('')

    try {
      if (id) {
        await updateEmployeeHistory(id, payload)
      } else {
        await createEmployeeHistory(payload)
      }

      await loadHistory(historyEmployee)
      await loadData()
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.error?.message
      setHistoryError(apiMessage || 'Lưu lịch sử công tác thất bại')
      throw requestError
    } finally {
      setHistorySaving(false)
    }
  }

  async function openHistoryModal(row) {
    setHistoryEmployee(row)
    setShowHistoryModal(true)
    setHistoryRows([])
    setHistoryError('')
    await loadOptions()
    loadHistory(row)
  }

  function onSearch() {
    setPage(1)
    setFilters((prev) => ({
      ...prev,
      keyword: String(prev.keywordDraft || '').trim(),
    }))
  }

  function onReset() {
    setPage(1)
    setFilters({
      keywordDraft: '',
      keyword: '',
      department: '',
      position: '',
      status: '',
    })
  }

  return (
    <CRow className="g-3">
      <CCol xs={12}>
        <CCard>
          <CCardHeader>
            <strong>Employee Management</strong>
            <div className="small text-body-secondary mt-1">
              Tenant: {tenantName || tenantCode || '-'}
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3 ai-form align-items-end">
              <CCol md={4}>
                <CFormLabel>Từ khóa</CFormLabel>
                <CFormInput
                  placeholder="fullName, employeeCode, phone, email"
                  value={filters.keywordDraft}
                  onChange={(event) => {
                    const value = event.target.value
                    setFilters((prev) => ({ ...prev, keywordDraft: value }))
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      onSearch()
                    }
                  }}
                />
              </CCol>

              <CCol md={2}>
                <CFormLabel>Department</CFormLabel>
                <CFormSelect
                  value={filters.department}
                  onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value }))}
                >
                  <option value="">Tất cả</option>
                  {departmentOptions.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name || `Department #${department.id}`}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={2}>
                <CFormLabel>Position</CFormLabel>
                <CFormSelect
                  value={filters.position}
                  onChange={(event) => setFilters((prev) => ({ ...prev, position: event.target.value }))}
                >
                  <option value="">Tất cả</option>
                  {positionOptions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name || `Position #${position.id}`}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={2}>
                <CFormLabel>Status</CFormLabel>
                <CFormSelect
                  value={filters.status}
                  onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {statusOptions.map((item) => (
                    <option key={item.value || 'all'} value={item.value}>{item.label}</option>
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
          <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <strong>Employees</strong>
              <CBadge color="secondary">{total}</CBadge>
            </div>

            <div className="d-flex align-items-center gap-2">
              <span className="text-body-secondary small">{fromToText}</span>
              <CButton color="primary" size="sm" onClick={openCreateModal}>
                Thêm mới
              </CButton>
            </div>
          </CCardHeader>

          <CCardBody>
            {success ? <CAlert color="success">{success}</CAlert> : null}
            {error ? <CAlert color="danger">{error}</CAlert> : null}

            {loading ? (
              <div className="d-flex align-items-center gap-2">
                <CSpinner size="sm" />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                {rows.length === 0 ? (
                  <CCard className="border-0 bg-light mb-3">
                    <CCardBody className="text-center text-body-secondary py-4">No employees found</CCardBody>
                  </CCard>
                ) : (
                  <CTable hover responsive className="mb-3 ai-table">
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell style={{ width: 70 }}>STT</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 130 }}>Employee Code</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 220 }}>Full Name</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 170 }}>Department</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 170 }}>Position</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 190 }}>Manager</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 140 }}>Phone</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 140 }}>Status</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 140 }}>Updated At</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 220 }}>Actions</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>

                    <CTableBody>
                      {rows.map((row, index) => {
                        const statusMeta = getStatusMeta(row.status)
                        const avatarUrl = toAbsoluteMediaUrl(row.avatar?.url)

                        return (
                          <CTableRow key={toEntityKey(row) || `${row.employeeCode}-${index}`}>
                            <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                            <CTableDataCell>{row.employeeCode || '-'}</CTableDataCell>
                            <CTableDataCell>
                              <div className="d-flex align-items-center gap-2">
                                {avatarUrl ? (
                                  <img
                                    src={avatarUrl}
                                    alt={row.fullName || 'Employee avatar'}
                                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <div
                                    className="d-flex align-items-center justify-content-center text-body-secondary"
                                    style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #dee2e6', fontSize: 14 }}
                                  >
                                    👤
                                  </div>
                                )}
                                <span>{row.fullName || '-'}</span>
                              </div>
                            </CTableDataCell>
                            <CTableDataCell>{row.currentDepartment?.name || '-'}</CTableDataCell>
                            <CTableDataCell>{row.currentPosition?.name || '-'}</CTableDataCell>
                            <CTableDataCell>{row.currentManager?.fullName || '-'}</CTableDataCell>
                            <CTableDataCell>{row.phone || '-'}</CTableDataCell>
                            <CTableDataCell>
                              <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                            </CTableDataCell>
                            <CTableDataCell>{formatDateDDMMYYYY(row.updatedAt)}</CTableDataCell>
                            <CTableDataCell>
                              <div className="d-flex gap-2">
                                <CButton color="info" variant="outline" size="sm" onClick={() => openHistoryModal(row)}>
                                  History
                                </CButton>
                                <CButton color="primary" variant="outline" size="sm" onClick={() => openEditModal(row)}>
                                  Sửa
                                </CButton>
                                <CButton color="danger" variant="outline" size="sm" onClick={() => handleDeleteEmployee(row)}>
                                  Delete
                                </CButton>
                              </div>
                            </CTableDataCell>
                          </CTableRow>
                        )
                      })}
                    </CTableBody>
                  </CTable>
                )}

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

      <EmployeeFormModal
        visible={showFormModal}
        mode={editingRow ? 'edit' : 'create'}
        initialValues={editingRow || undefined}
        loading={saving}
        onClose={() => {
          if (saving) return
          setShowFormModal(false)
          setEditingRow(null)
        }}
        onSubmit={handleSaveEmployee}
        departmentOptions={departmentOptions}
        positionOptions={positionOptions}
        managerOptions={managerOptions}
        userOptions={userOptions}
      />

      <EmployeeHistoryModal
        visible={showHistoryModal}
        employee={historyEmployee}
        rows={historyRows}
        loading={historyLoading}
        saving={historySaving}
        error={historyError}
        onClose={() => {
          if (historySaving) return
          setShowHistoryModal(false)
          setHistoryEmployee(null)
          setHistoryRows([])
          setHistoryError('')
        }}
        onRefresh={() => loadHistory(historyEmployee)}
        onSave={handleSaveHistory}
        departmentOptions={departmentOptions}
        positionOptions={positionOptions}
        managerOptions={managerOptions}
      />
    </CRow>
  )
}
