import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
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
} from '@coreui/react'
import * as XLSX from 'xlsx'
import {
  createLearner,
  deleteLearner,
  getLearnerFormOptions,
  getLearnerPage,
  importLearners,
  updateLearner,
} from '../services/learnerService'

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

function emptyForm() {
  return {
    code: '',
    fullName: '',
    dateOfBirth: '',
    parentName: '',
    parentPhone: '',
    user: '',
    status: 'active',
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function formatUserDisplay(user) {
  if (!user) return '-'
  return [user.fullName || '', user.username || '', user.email || ''].filter(Boolean).join(' - ') || '-'
}

function renderImportItemLabel(item) {
  if (!item) return '-'
  return [item.code, item.username, item.email].filter(Boolean).join(' · ') || '-'
}

function downloadLearnerImportTemplate() {
  const rows = [
    {
      'Mã học sinh': 'HS001',
      'Họ tên': 'Nguyen Van A',
      'Tên đăng nhập': 'hocvien01',
      Email: 'hocvien01@example.com',
      Password: 'Hocvien@123',
      'Ngày sinh': '2014-01-15',
      'Tên phụ huynh': 'Nguyen Van B',
      'SĐT phụ huynh': '0900000001',
    },
  ]

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Learners')

  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'learner-import-template.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}

export default function LearnerManagementPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [formData, setFormData] = useState(emptyForm())
  const [importForm, setImportForm] = useState({
    roleId: '',
    file: null,
  })

  const total = pagination?.total ?? 0
  const pageCount = pagination?.pageCount ?? 1
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])

  const fromToText = useMemo(() => {
    if (!pagination || total === 0) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, total)
    return `${from}–${to}/${total}`
  }, [pagination, total])

  async function loadOptions() {
    try {
      const result = await getLearnerFormOptions()
      setUsers(Array.isArray(result?.users) ? result.users : [])
      setRoles(Array.isArray(result?.roles) ? result.roles : [])
    } catch {
      setUsers([])
      setRoles([])
    }
  }

  async function load() {
    setLoading(true)
    setError('')

    try {
      const result = await getLearnerPage({ page, pageSize, q, status: statusFilter })
      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setPagination(result?.pagination ?? null)
    } catch (loadError) {
      setRows([])
      setPagination(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách người học'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    load()
  }, [page, pageSize, q, statusFilter])

  function resetForm() {
    setFormData(emptyForm())
  }

  function openCreateModal() {
    setEditingId(null)
    resetForm()
    setShowModal(true)
  }

  function openEditModal(item) {
    setEditingId(item.id)
    setFormData({
      code: item.code || '',
      fullName: item.fullName || '',
      dateOfBirth: item.dateOfBirth || '',
      parentName: item.parentName || '',
      parentPhone: item.parentPhone || '',
      user: String(item?.user?.id || ''),
      status: item.status || 'active',
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    resetForm()
  }

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

  async function handleSubmit() {
    if (!String(formData.code).trim()) {
      setError('Mã học sinh không được trống')
      return
    }

    if (!String(formData.fullName).trim()) {
      setError('Họ tên không được trống')
      return
    }

    setFormLoading(true)
    setError('')

    try {
      const payload = {
        code: String(formData.code).trim(),
        fullName: String(formData.fullName).trim(),
        dateOfBirth: String(formData.dateOfBirth || '').trim() || null,
        parentName: String(formData.parentName || '').trim() || null,
        parentPhone: String(formData.parentPhone || '').trim() || null,
        user: String(formData.user || '').trim() ? Number(formData.user) : null,
        status: formData.status === 'inactive' ? 'inactive' : 'active',
      }

      if (editingId) {
        await updateLearner(editingId, payload)
        setSuccess('Cập nhật người học thành công')
      } else {
        await createLearner(payload)
        setSuccess('Thêm mới người học thành công')
      }

      closeModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu người học'))
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa người học này?')) return

    setError('')
    setSuccess('')

    try {
      await deleteLearner(id)
      setSuccess('Xóa người học thành công')
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa người học'))
    }
  }

  async function handleImport() {
    if (!importForm.file) {
      setError('Bạn cần chọn file Excel')
      return
    }

    if (!String(importForm.roleId).trim()) {
      setError('Bạn cần chọn role cho user được thêm mới vào tenant')
      return
    }

    setImporting(true)
    setError('')
    setImportResult(null)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('file', importForm.file)
      formDataToSend.append('roleId', String(importForm.roleId))

      const result = await importLearners(formDataToSend)
      setImportResult(result)
      setSuccess(`Import hoàn tất: thêm ${result?.summary?.createdCount || 0} người học`)
      await Promise.all([load(), loadOptions()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể import người học'))
    } finally {
      setImporting(false)
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
                  placeholder='Tìm theo mã học sinh, họ tên, phụ huynh, username, email...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={3}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value) }}>
                  <option value=''>Tất cả</option>
                  <option value='active'>Đang hoạt động</option>
                  <option value='inactive'>Ngưng hoạt động</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12} md={2} className='d-flex justify-content-end gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color='secondary' variant='outline' onClick={onReset} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {success ? <CAlert color='success' className='mb-4'>{success}</CAlert> : null}
        {error ? <CAlert color='danger' className='mb-4'>{error}</CAlert> : null}

        <CCard className='ai-card'>
          <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
            <div>
              <strong>Learners</strong>
              <CBadge color='secondary' className='ms-2'>{total}</CBadge>
            </div>
            <div className='d-flex align-items-center gap-3 flex-wrap'>
              <div className='text-body-secondary small'>{fromToText}</div>
              <CButton color='info' variant='outline' onClick={() => setShowImportModal(true)} disabled={loading}>Import Excel</CButton>
              <CButton color='success' onClick={openCreateModal} disabled={loading}>+ Thêm mới</CButton>
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
                      <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Mã học sinh</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 220 }}>Họ tên</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Ngày sinh</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 200 }}>Phụ huynh</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 220 }}>Tài khoản</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 150 }}>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                        <CTableDataCell>{item.code || '-'}</CTableDataCell>
                        <CTableDataCell>{item.fullName || '-'}</CTableDataCell>
                        <CTableDataCell>{item.dateOfBirth || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div>{item.parentName || '-'}</div>
                          <div className='small text-body-secondary'>{item.parentPhone || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>{formatUserDisplay(item.user)}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={item.status === 'inactive' ? 'secondary' : 'success'}>
                            {item.status === 'inactive' ? 'Ngưng hoạt động' : 'Đang hoạt động'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.updatedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item.id)}>Xóa</CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                  <div className='d-flex align-items-center gap-2 ai-form'>
                    <span>Page size</span>
                    <CFormSelect value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value) || 10) }} style={{ width: 100 }}>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </CFormSelect>
                  </div>

                  <CPagination align='end' className='mb-0'>
                    <CPaginationItem disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => item === '...'
                      ? <CPaginationItem key={`dots-${index}`} disabled>…</CPaginationItem>
                      : <CPaginationItem key={item} active={item === page} disabled={loading} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pageCount || loading} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>

        <CModal backdrop='static' visible={showModal} onClose={closeModal} size='lg'>
          <CModalHeader>
            <CModalTitle>{editingId ? 'Sửa người học' : 'Thêm mới người học'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={6}>
                  <CFormLabel>Mã học sinh <span className='text-danger'>*</span></CFormLabel>
                  <CFormInput value={formData.code} onChange={(event) => setFormData((prev) => ({ ...prev, code: event.target.value }))} disabled={formLoading} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Họ tên <span className='text-danger'>*</span></CFormLabel>
                  <CFormInput value={formData.fullName} onChange={(event) => setFormData((prev) => ({ ...prev, fullName: event.target.value }))} disabled={formLoading} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Ngày sinh</CFormLabel>
                  <CFormInput type='date' value={formData.dateOfBirth} onChange={(event) => setFormData((prev) => ({ ...prev, dateOfBirth: event.target.value }))} disabled={formLoading} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Tài khoản phụ huynh</CFormLabel>
                  <CFormSelect value={formData.user} onChange={(event) => setFormData((prev) => ({ ...prev, user: event.target.value }))} disabled={formLoading}>
                    <option value=''>Không chọn</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.label}</option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Tên phụ huynh</CFormLabel>
                  <CFormInput value={formData.parentName} onChange={(event) => setFormData((prev) => ({ ...prev, parentName: event.target.value }))} disabled={formLoading} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Số điện thoại phụ huynh</CFormLabel>
                  <CFormInput value={formData.parentPhone} onChange={(event) => setFormData((prev) => ({ ...prev, parentPhone: event.target.value }))} disabled={formLoading} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Trạng thái</CFormLabel>
                  <CFormSelect value={formData.status} onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))} disabled={formLoading}>
                    <option value='active'>Đang hoạt động</option>
                    <option value='inactive'>Ngưng hoạt động</option>
                  </CFormSelect>
                </CCol>
              </CRow>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeModal}>Hủy</CButton>
            <CButton color='primary' onClick={handleSubmit} disabled={formLoading}>{formLoading ? 'Đang lưu...' : 'Lưu'}</CButton>
          </CModalFooter>
        </CModal>

        <CModal backdrop='static' size='lg' visible={showImportModal} onClose={() => !importing && setShowImportModal(false)}>
          <CModalHeader>
            <CModalTitle>Import learners</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={12}>
                  <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                    <div className='small text-body-secondary'>File Excel cần các cột <strong>Mã học sinh</strong>, <strong>Họ tên</strong>, <strong>Tên đăng nhập</strong>, <strong>Email</strong>, <strong>Password</strong>. Có thể thêm <strong>Ngày sinh</strong>, <strong>Tên phụ huynh</strong>, <strong>SĐT phụ huynh</strong>.</div>
                    <CButton color='secondary' variant='outline' size='sm' onClick={downloadLearnerImportTemplate}>Download template</CButton>
                  </div>
                </CCol>
                <CCol md={12}>
                  <CFormLabel>Role cho user được thêm mới vào tenant</CFormLabel>
                  <CFormSelect value={importForm.roleId} onChange={(event) => setImportForm((prev) => ({ ...prev, roleId: event.target.value }))}>
                    <option value=''>Chọn role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={12}>
                  <CFormLabel>File Excel</CFormLabel>
                  <CFormInput type='file' accept='.xlsx,.xls' onChange={(event) => setImportForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))} />
                </CCol>
              </CRow>
            </CForm>

            {importResult ? (
              <div className='mt-4'>
                <CAlert color='success'>
                  Total: {importResult?.summary?.totalRows || 0} | Created: {importResult?.summary?.createdCount || 0} | Skipped: {importResult?.summary?.skippedCount || 0} | Errors: {importResult?.summary?.errorCount || 0}
                </CAlert>

                {Array.isArray(importResult?.errors) && importResult.errors.length > 0 ? (
                  <CCard className='border-danger mb-3'>
                    <CCardHeader className='text-danger'><strong>Các dòng lỗi</strong></CCardHeader>
                    <CCardBody>
                      <CTable small responsive>
                        <CTableHead>
                          <CTableRow>
                            <CTableHeaderCell style={{ width: 100 }}>Dòng</CTableHeaderCell>
                            <CTableHeaderCell style={{ minWidth: 220 }}>Bản ghi</CTableHeaderCell>
                            <CTableHeaderCell>Lỗi</CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          {importResult.errors.map((item, index) => (
                            <CTableRow key={`learner-import-error-${item.rowNumber || index}`}>
                              <CTableDataCell>{item.rowNumber || '-'}</CTableDataCell>
                              <CTableDataCell>{renderImportItemLabel(item)}</CTableDataCell>
                              <CTableDataCell>{item.message || 'Có lỗi xảy ra'}</CTableDataCell>
                            </CTableRow>
                          ))}
                        </CTableBody>
                      </CTable>
                    </CCardBody>
                  </CCard>
                ) : null}

                {Array.isArray(importResult?.skipped) && importResult.skipped.length > 0 ? (
                  <CCard className='border-warning mb-3'>
                    <CCardHeader className='text-warning'><strong>Các dòng bỏ qua</strong></CCardHeader>
                    <CCardBody>
                      <CTable small responsive>
                        <CTableHead>
                          <CTableRow>
                            <CTableHeaderCell style={{ width: 100 }}>Dòng</CTableHeaderCell>
                            <CTableHeaderCell style={{ minWidth: 220 }}>Bản ghi</CTableHeaderCell>
                            <CTableHeaderCell>Lý do</CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          {importResult.skipped.map((item, index) => (
                            <CTableRow key={`learner-import-skipped-${item.rowNumber || index}`}>
                              <CTableDataCell>{item.rowNumber || '-'}</CTableDataCell>
                              <CTableDataCell>{renderImportItemLabel(item)}</CTableDataCell>
                              <CTableDataCell>{item.message || 'Bỏ qua'}</CTableDataCell>
                            </CTableRow>
                          ))}
                        </CTableBody>
                      </CTable>
                    </CCardBody>
                  </CCard>
                ) : null}
              </div>
            ) : null}
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={() => setShowImportModal(false)} disabled={importing}>Đóng</CButton>
            <CButton color='primary' onClick={handleImport} disabled={importing}>{importing ? 'Đang import...' : 'Import'}</CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}