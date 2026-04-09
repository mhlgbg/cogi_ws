import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  CNav,
  CNavItem,
  CNavLink,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import * as XLSX from 'xlsx'
import {
  createEnrollment,
  deleteEnrollment,
  getClassById,
  getClassEnrollmentOptions,
  getClassEnrollments,
  importClassEnrollments,
  updateEnrollment,
} from '../services/classService'

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

function emptyEnrollmentForm() {
  return {
    learner: '',
    joinDate: '',
    leaveDate: '',
    status: 'active',
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function formatDate(value) {
  if (!value) return '-'
  return value
}

function formatTeacherDisplay(teacher) {
  if (!teacher) return '-'

  const fullName = String(teacher.fullName || '').trim()
  const username = String(teacher.username || '').trim()
  const fallback = String(teacher.email || '').trim()

  if (fullName && username) return `${fullName} (${username})`
  return fullName || username || fallback || '-'
}

function renderImportItemLabel(item) {
  if (!item) return '-'

  const parts = [
    item.code,
    item.username,
    item.email,
  ].filter(Boolean)

  return parts.join(' · ') || '-'
}

function downloadEnrollmentImportTemplate() {
  const rows = [
    { 'Mã học sinh': 'HS001', 'Họ tên': 'Nguyen Van A', 'Tên đăng nhập': 'hocvien01', Email: 'hocvien01@example.com', Password: 'Hocvien@123' },
    { 'Mã học sinh': 'HS002', 'Họ tên': 'Tran Thi B', 'Tên đăng nhập': 'hocvien02', Email: 'hocvien02@example.com', Password: 'Hocvien@123' },
  ]

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Enrollments')

  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'class-enrollment-import-template.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}

export default function ClassDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [detail, setDetail] = useState(null)
  const [activeTab, setActiveTab] = useState('info')
  const [enrollmentRows, setEnrollmentRows] = useState([])
  const [enrollmentMeta, setEnrollmentMeta] = useState(null)
  const [enrollmentPage, setEnrollmentPage] = useState(1)
  const [enrollmentPageSize, setEnrollmentPageSize] = useState(10)
  const [enrollmentQ, setEnrollmentQ] = useState('')
  const [enrollmentQDraft, setEnrollmentQDraft] = useState('')
  const [enrollmentStatus, setEnrollmentStatus] = useState('')
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingEnrollmentId, setEditingEnrollmentId] = useState(null)
  const [savingEnrollment, setSavingEnrollment] = useState(false)
  const [learners, setLearners] = useState([])
  const [roles, setRoles] = useState([])
  const [enrollmentForm, setEnrollmentForm] = useState(emptyEnrollmentForm())
  const [importForm, setImportForm] = useState({
    roleId: '',
    joinDate: '',
    leaveDate: '',
    file: null,
  })
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const enrollmentTotal = enrollmentMeta?.total ?? 0
  const enrollmentPageCount = enrollmentMeta?.pageCount ?? 1
  const enrollmentPages = useMemo(() => buildPages(enrollmentPage, enrollmentPageCount), [enrollmentPage, enrollmentPageCount])

  const enrollmentRangeText = useMemo(() => {
    if (!enrollmentMeta || enrollmentTotal === 0) return '0'
    const from = (enrollmentMeta.page - 1) * enrollmentMeta.pageSize + 1
    const to = Math.min(enrollmentMeta.page * enrollmentMeta.pageSize, enrollmentTotal)
    return `${from}–${to}/${enrollmentTotal}`
  }, [enrollmentMeta, enrollmentTotal])

  async function loadDetail() {
    const data = await getClassById(id)
    setDetail(data)
  }

  async function loadEnrollmentOptions() {
    const data = await getClassEnrollmentOptions(id)
    setLearners(Array.isArray(data?.learners) ? data.learners : [])
    setRoles(Array.isArray(data?.roles) ? data.roles : [])
  }

  async function loadEnrollments(nextPage = enrollmentPage, nextPageSize = enrollmentPageSize, nextQ = enrollmentQ, nextStatus = enrollmentStatus) {
    const data = await getClassEnrollments(id, {
      page: nextPage,
      pageSize: nextPageSize,
      q: nextQ,
      status: nextStatus,
    })
    setEnrollmentRows(Array.isArray(data?.rows) ? data.rows : [])
    setEnrollmentMeta(data?.meta ?? null)
    setEnrollmentPage(Number(data?.meta?.page || nextPage) || 1)
    setEnrollmentPageSize(Number(data?.meta?.pageSize || nextPageSize) || 10)
  }

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        await Promise.all([loadDetail(), loadEnrollmentOptions(), loadEnrollments()])
      } catch (requestError) {
        if (!mounted) return
        setError(getApiMessage(requestError, 'Không thể tải chi tiết lớp'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [id])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  function openCreateEnrollmentModal() {
    setEditingEnrollmentId(null)
    setEnrollmentForm(emptyEnrollmentForm())
    setShowEnrollmentModal(true)
  }

  function openEditEnrollmentModal(item) {
    setEditingEnrollmentId(item.id)
    setEnrollmentForm({
      learner: String(item?.learner?.id || ''),
      joinDate: item.joinDate || '',
      leaveDate: item.leaveDate || '',
      status: item.status || 'active',
    })
    setShowEnrollmentModal(true)
  }

  function closeEnrollmentModal() {
    setShowEnrollmentModal(false)
    setEditingEnrollmentId(null)
    setEnrollmentForm(emptyEnrollmentForm())
  }

  async function handleSaveEnrollment() {
    if (!String(enrollmentForm.learner).trim()) {
      setError('Bạn cần chọn học viên')
      return
    }

    setSavingEnrollment(true)
    setError('')
    try {
      const payload = {
        learner: Number(enrollmentForm.learner),
        joinDate: enrollmentForm.joinDate || null,
        leaveDate: enrollmentForm.leaveDate || null,
        status: enrollmentForm.status === 'inactive' ? 'inactive' : 'active',
      }

      if (editingEnrollmentId) {
        await updateEnrollment(id, editingEnrollmentId, payload)
        setSuccess('Cập nhật enrollment thành công')
      } else {
        await createEnrollment(id, payload)
        setSuccess('Thêm enrollment thành công')
      }

      closeEnrollmentModal()
      await loadEnrollments(enrollmentPage, enrollmentPageSize, enrollmentQ, enrollmentStatus)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu enrollment'))
    } finally {
      setSavingEnrollment(false)
    }
  }

  async function handleDeleteEnrollment(enrollmentId) {
    if (!window.confirm('Bạn chắc chắn muốn xóa enrollment này?')) return

    setError('')
    try {
      await deleteEnrollment(id, enrollmentId)
      setSuccess('Xóa enrollment thành công')
      await loadEnrollments(enrollmentPage, enrollmentPageSize, enrollmentQ, enrollmentStatus)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xóa enrollment'))
    }
  }

  async function handleImportEnrollments() {
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
      const formData = new FormData()
      formData.append('file', importForm.file)
      formData.append('roleId', String(importForm.roleId))
      if (importForm.joinDate) formData.append('joinDate', importForm.joinDate)
      if (importForm.leaveDate) formData.append('leaveDate', importForm.leaveDate)

      const result = await importClassEnrollments(id, formData)
      setImportResult(result)
      setSuccess(`Import hoàn tất: thêm ${result?.summary?.createdCount || 0} enrollment`)
      await Promise.all([
        loadEnrollments(enrollmentPage, enrollmentPageSize, enrollmentQ, enrollmentStatus),
        loadEnrollmentOptions(),
      ])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể import enrollments'))
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className='text-center py-5'>
        <CSpinner color='primary' />
      </div>
    )
  }

  return (
    <div className='container-fluid py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <h3 className='mb-1'>{detail?.name || 'Class detail'}</h3>
          <div className='text-medium-emphasis'>
            {detail?.subjectCode || '-'}
            {detail?.subject ? ` · ${detail.subject}` : ''}
          </div>
        </div>
        <div className='d-flex gap-2'>
          <CButton color='light' onClick={() => navigate('/classes')}>Quay lại</CButton>
        </div>
      </div>

      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CNav variant='tabs' role='tablist' className='mb-4'>
        <CNavItem>
          <CNavLink active={activeTab === 'info'} onClick={() => setActiveTab('info')} role='button'>Thông tin lớp</CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink active={activeTab === 'enrollments'} onClick={() => setActiveTab('enrollments')} role='button'>Enrollments</CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent>
        <CTabPane visible={activeTab === 'info'}>
          <CRow className='g-3'>
            <CCol md={6}>
              <CCard className='border-0 shadow-sm'>
                <CCardHeader><strong>Thông tin hiện hành</strong></CCardHeader>
                <CCardBody>
                  <div className='mb-3'><strong>Tên lớp:</strong> {detail?.name || '-'}</div>
                  <div className='mb-3'><strong>Mã môn:</strong> {detail?.subjectCode || '-'}</div>
                  <div className='mb-3'><strong>Môn học:</strong> {detail?.subject || '-'}</div>
                  <div className='mb-3'><strong>Giáo viên chính:</strong> {formatTeacherDisplay(detail?.mainTeacher)}</div>
                  <div className='mb-3'>
                    <strong>Trạng thái:</strong>{' '}
                    <CBadge color={detail?.status === 'inactive' ? 'secondary' : 'success'}>
                      {detail?.status === 'inactive' ? 'Ngưng hoạt động' : 'Đang hoạt động'}
                    </CBadge>
                  </div>
                  <div><strong>Cập nhật:</strong> {formatDateTime(detail?.updatedAt)}</div>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>

        <CTabPane visible={activeTab === 'enrollments'}>
          <CCard className='border-0 shadow-sm mb-4'>
            <CCardHeader><strong>Bộ lọc</strong></CCardHeader>
            <CCardBody>
              <CRow className='g-3 align-items-end'>
                <CCol md={7}>
                  <CFormInput label='Từ khóa' placeholder='Tìm theo username, email, họ tên...' value={enrollmentQDraft} onChange={(event) => setEnrollmentQDraft(event.target.value)} onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      setEnrollmentPage(1)
                      setEnrollmentQ(enrollmentQDraft.trim())
                    }
                  }} />
                </CCol>
                <CCol md={3}>
                  <CFormLabel>Trạng thái</CFormLabel>
                  <CFormSelect value={enrollmentStatus} onChange={(event) => { setEnrollmentPage(1); setEnrollmentStatus(event.target.value); loadEnrollments(1, enrollmentPageSize, enrollmentQ, event.target.value) }}>
                    <option value=''>Tất cả</option>
                    <option value='active'>Đang hoạt động</option>
                    <option value='inactive'>Ngưng hoạt động</option>
                  </CFormSelect>
                </CCol>
                <CCol md={2} className='d-flex justify-content-end gap-2'>
                  <CButton color='primary' onClick={() => { setEnrollmentPage(1); setEnrollmentQ(enrollmentQDraft.trim()); loadEnrollments(1, enrollmentPageSize, enrollmentQDraft.trim(), enrollmentStatus) }}>Search</CButton>
                  <CButton color='secondary' variant='outline' onClick={() => {
                    setEnrollmentPage(1)
                    setEnrollmentQ('')
                    setEnrollmentQDraft('')
                    setEnrollmentStatus('')
                    loadEnrollments(1, enrollmentPageSize, '', '')
                  }}>Reset</CButton>
                </CCol>
              </CRow>
            </CCardBody>
          </CCard>

          <CCard className='border-0 shadow-sm'>
            <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
              <div>
                <strong>Enrollments</strong>
                <CBadge color='secondary' className='ms-2'>{enrollmentTotal}</CBadge>
              </div>
              <div className='d-flex align-items-center gap-2 flex-wrap'>
                <span className='text-body-secondary small'>{enrollmentRangeText}</span>
                <CButton color='info' variant='outline' onClick={() => setShowImportModal(true)}>Import Excel</CButton>
                <CButton color='success' onClick={openCreateEnrollmentModal}>+ Thêm enrollment</CButton>
              </div>
            </CCardHeader>
            <CCardBody>
              <CTable hover responsive className='mb-3'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>#</CTableHeaderCell>
                    <CTableHeaderCell>Học viên</CTableHeaderCell>
                    <CTableHeaderCell>Join date</CTableHeaderCell>
                    <CTableHeaderCell>End date</CTableHeaderCell>
                    <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell>Cập nhật</CTableHeaderCell>
                    <CTableHeaderCell>Hành động</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {enrollmentRows.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={7} className='text-center text-body-secondary'>Không có enrollment</CTableDataCell>
                    </CTableRow>
                  ) : enrollmentRows.map((item, index) => (
                    <CTableRow key={item.id}>
                      <CTableDataCell>{(enrollmentPage - 1) * enrollmentPageSize + index + 1}</CTableDataCell>
                      <CTableDataCell>
                        <div>{item?.learner?.fullName || item?.learner?.username || '-'}</div>
                        <div className='small text-body-secondary'>
                          {[item?.learner?.code, item?.learner?.username || item?.learner?.email].filter(Boolean).join(' · ') || '-'}
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>{formatDate(item.joinDate)}</CTableDataCell>
                      <CTableDataCell>{formatDate(item.leaveDate)}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={item.status === 'inactive' ? 'secondary' : 'success'}>
                          {item.status === 'inactive' ? 'Ngưng hoạt động' : 'Đang hoạt động'}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{formatDateTime(item.updatedAt)}</CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex gap-2'>
                          <CButton size='sm' color='info' variant='outline' onClick={() => openEditEnrollmentModal(item)}>Sửa</CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteEnrollment(item.id)}>Xóa</CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>

              <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                <div className='d-flex align-items-center gap-2'>
                  <span>Page size</span>
                  <CFormSelect value={enrollmentPageSize} onChange={(event) => {
                    const nextSize = Number(event.target.value) || 10
                    setEnrollmentPage(1)
                    setEnrollmentPageSize(nextSize)
                    loadEnrollments(1, nextSize, enrollmentQ, enrollmentStatus)
                  }} style={{ width: 100 }}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </CFormSelect>
                </div>

                <CPagination align='end' className='mb-0'>
                  <CPaginationItem disabled={enrollmentPage <= 1} onClick={() => { const next = Math.max(1, enrollmentPage - 1); setEnrollmentPage(next); loadEnrollments(next, enrollmentPageSize, enrollmentQ, enrollmentStatus) }}>Trước</CPaginationItem>
                  {enrollmentPages.map((item, index) => item === '...'
                    ? <CPaginationItem key={`dots-${index}`} disabled>…</CPaginationItem>
                    : <CPaginationItem key={item} active={item === enrollmentPage} onClick={() => { setEnrollmentPage(item); loadEnrollments(item, enrollmentPageSize, enrollmentQ, enrollmentStatus) }}>{item}</CPaginationItem>)}
                  <CPaginationItem disabled={enrollmentPage >= enrollmentPageCount} onClick={() => { const next = Math.min(enrollmentPageCount, enrollmentPage + 1); setEnrollmentPage(next); loadEnrollments(next, enrollmentPageSize, enrollmentQ, enrollmentStatus) }}>Sau</CPaginationItem>
                </CPagination>
              </div>
            </CCardBody>
          </CCard>
        </CTabPane>
      </CTabContent>

      <CModal backdrop='static' visible={showEnrollmentModal} onClose={closeEnrollmentModal}>
        <CModalHeader>
          <CModalTitle>{editingEnrollmentId ? 'Sửa enrollment' : 'Thêm enrollment'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CRow className='g-3'>
              <CCol md={12}>
                <CFormLabel>Học viên</CFormLabel>
                <CFormSelect value={enrollmentForm.learner} onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, learner: event.target.value }))}>
                  <option value=''>Chọn học viên</option>
                  {learners.map((learner) => (
                    <option key={learner.id} value={learner.id}>{learner.label}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel>Join date</CFormLabel>
                <CFormInput type='date' value={enrollmentForm.joinDate} onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, joinDate: event.target.value }))} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>End date</CFormLabel>
                <CFormInput type='date' value={enrollmentForm.leaveDate} onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, leaveDate: event.target.value }))} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={enrollmentForm.status} onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value='active'>Đang hoạt động</option>
                  <option value='inactive'>Ngưng hoạt động</option>
                </CFormSelect>
              </CCol>
            </CRow>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeEnrollmentModal}>Hủy</CButton>
          <CButton color='primary' onClick={handleSaveEnrollment} disabled={savingEnrollment}>{savingEnrollment ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal backdrop='static' size='lg' visible={showImportModal} onClose={() => !importing && setShowImportModal(false)}>
        <CModalHeader>
          <CModalTitle>Import enrollments</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CRow className='g-3'>
              <CCol md={12}>
                <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                  <div className='small text-body-secondary'>File Excel cần các cột <strong>Mã học sinh</strong>, <strong>Họ tên</strong>, <strong>Tên đăng nhập</strong>, <strong>Email</strong>, <strong>Password</strong>. Password sẽ được dùng khi hệ thống phải tạo mới user.</div>
                  <CButton color='secondary' variant='outline' size='sm' onClick={downloadEnrollmentImportTemplate}>Download template</CButton>
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
                <div className='small text-body-secondary mt-1'>Khuyến nghị chọn role Student nếu tenant đang có role này.</div>
              </CCol>
              <CCol md={6}>
                <CFormLabel>Join date</CFormLabel>
                <CFormInput type='date' value={importForm.joinDate} onChange={(event) => setImportForm((prev) => ({ ...prev, joinDate: event.target.value }))} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>End date</CFormLabel>
                <CFormInput type='date' value={importForm.leaveDate} onChange={(event) => setImportForm((prev) => ({ ...prev, leaveDate: event.target.value }))} />
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
                  <CCardHeader className='text-danger'>
                    <strong>Các dòng lỗi</strong>
                  </CCardHeader>
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
                          <CTableRow key={`import-error-${item.rowNumber || index}`}>
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
                  <CCardHeader className='text-warning'>
                    <strong>Các dòng bỏ qua</strong>
                  </CCardHeader>
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
                          <CTableRow key={`import-skipped-${item.rowNumber || index}`}>
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

              {Array.isArray(importResult?.created) && importResult.created.length > 0 ? (
                <CCard className='border-success'>
                  <CCardHeader className='text-success'>
                    <strong>Các dòng thành công</strong>
                  </CCardHeader>
                  <CCardBody>
                    <CTable small responsive>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell style={{ width: 100 }}>Dòng</CTableHeaderCell>
                          <CTableHeaderCell style={{ minWidth: 220 }}>Bản ghi</CTableHeaderCell>
                          <CTableHeaderCell>Kết quả</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {importResult.created.map((item, index) => (
                          <CTableRow key={`import-created-${item.rowNumber || index}`}>
                            <CTableDataCell>{item.rowNumber || '-'}</CTableDataCell>
                            <CTableDataCell>{renderImportItemLabel(item)}</CTableDataCell>
                            <CTableDataCell>{item.message || 'Tạo thành công'}</CTableDataCell>
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
          <CButton color='primary' onClick={handleImportEnrollments} disabled={importing}>{importing ? 'Đang import...' : 'Import'}</CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}