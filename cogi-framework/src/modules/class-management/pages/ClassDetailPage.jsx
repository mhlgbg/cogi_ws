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
  CFormCheck,
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
import ClassTeacherAssignmentsTab from '../components/ClassTeacherAssignmentsTab'
import ClassSessionsTab from '../components/ClassSessionsTab'
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
import { getLearnerPage, updateLearner } from '../../learner-management/services/learnerService'
import AsyncCombobox from '../../../components/AsyncCombobox'

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
    mode: 'existing',
    learner: '',
    newLearnerFullName: '',
    newLearnerCode: '',
    newLearnerEmail: '',
    newLearnerPhone: '',
    joinDate: '',
    leaveDate: '',
    status: 'active',
  }
}

function normalizeText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
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
  const [includeInactiveLearners, setIncludeInactiveLearners] = useState(false)
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingEnrollmentId, setEditingEnrollmentId] = useState(null)
  const [savingEnrollment, setSavingEnrollment] = useState(false)
  const [learners, setLearners] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedLearnerOption, setSelectedLearnerOption] = useState(null)
  const [enrollmentForm, setEnrollmentForm] = useState(emptyEnrollmentForm())
  const [importForm, setImportForm] = useState({
    roleId: '',
    joinDate: '',
    leaveDate: '',
    file: null,
  })
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  function handleMessage(message) {
    if (!message) return
    if (message.type === 'error') {
      setError(message.text || 'Có lỗi xảy ra')
      return
    }
    setSuccess(message.text || '')
    setError('')
  }

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
    const data = await getClassEnrollmentOptions(id, { includeInactive: includeInactiveLearners })
    try {
      // eslint-disable-next-line no-console
      console.debug('[debug] loadEnrollmentOptions data:', data)
      // eslint-disable-next-line no-console
      console.debug('[debug] learners length:', Array.isArray(data?.learners) ? data.learners.length : 0)
    } catch (e) {
      // ignore console errors
    }

    let resolvedLearners = Array.isArray(data?.learners) ? data.learners : []
    // If backend returned no learners (e.g. filtered by active only), fallback to /learners endpoint
    if ((!Array.isArray(resolvedLearners) || resolvedLearners.length === 0)) {
      try {
        const page = await getLearnerPage({ page: 1, pageSize: 200, q: '', status: includeInactiveLearners ? '' : 'active' })
        resolvedLearners = (Array.isArray(page.rows) ? page.rows : []).map((row) => ({
          id: row.id,
          code: row.code || '',
          username: row.user?.username || '',
          email: row.email || row.user?.email || '',
          phone: row.phone || row.user?.phone || '',
          fullName: row.fullName || '',
          label: [(row.code || ''), (row.fullName || row.user?.fullName || ''), (row.email || row.user?.email || ''), (row.phone || row.user?.phone || '')].filter(Boolean).join(' - '),
          status: row.learnerStatus || row.status || 'active',
        }))
      } catch (err) {
        // ignore fallback failure
      }
    }

    setLearners(Array.isArray(resolvedLearners) ? resolvedLearners : [])
    setRoles(Array.isArray(data?.roles) ? data.roles : [])
  }

  async function loadLearnerOptions(input) {
    const q = String(input || '').trim()
    try {
      const page = await getLearnerPage({ page: 1, pageSize: 20, q, status: includeInactiveLearners ? '' : 'active' })
      const rows = Array.isArray(page.rows) ? page.rows : []
      return rows.map((r) => ({
        value: r.id,
        label: [r.code, r.fullName || r.user?.fullName || r.user?.username, r.email || r.user?.email, r.phone || r.user?.phone].filter(Boolean).join(' - '),
        status: r.learnerStatus || r.status || 'active',
      }))
    } catch (err) {
      return []
    }
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

  async function openCreateEnrollmentModal() {
    setEditingEnrollmentId(null)
    setEnrollmentForm(emptyEnrollmentForm())
    setSelectedLearnerOption(null)
    try {
      await loadEnrollmentOptions()
    } catch (err) {
      // ignore - loadEnrollmentOptions sets error state on failure
    }
    setShowEnrollmentModal(true)
  }

  async function openEditEnrollmentModal(item) {
    setEditingEnrollmentId(item.id)
    setEnrollmentForm({
      mode: 'existing',
      learner: String(item?.learner?.id || ''),
      newLearnerFullName: '',
      newLearnerCode: '',
      newLearnerEmail: '',
      newLearnerPhone: '',
      joinDate: item.joinDate || '',
      leaveDate: item.leaveDate || '',
      status: item.status || 'active',
    })
    try {
      await loadEnrollmentOptions()
    } catch (err) {
      // ignore
    }
    // Preload selected option so AsyncCombobox shows current learner
    try {
      const learnerObj = item?.learner || null
      if (learnerObj && learnerObj.id) {
        const label = learnerObj.fullName || learnerObj.username || learnerObj.email || `User #${learnerObj.id}`
        setSelectedLearnerOption({ value: learnerObj.id, label, status: learnerObj.learnerStatus || learnerObj.status || 'active' })
      } else {
        setSelectedLearnerOption(null)
      }
    } catch (e) {
      setSelectedLearnerOption(null)
    }

    setShowEnrollmentModal(true)
  }

  function closeEnrollmentModal() {
    setShowEnrollmentModal(false)
    setEditingEnrollmentId(null)
    setEnrollmentForm(emptyEnrollmentForm())
    setSelectedLearnerOption(null)
  }

  async function handleSaveEnrollment() {
    const mode = editingEnrollmentId ? 'existing' : enrollmentForm.mode

    if (mode === 'existing') {
      if (!String(enrollmentForm.learner).trim()) {
        setError('Bạn cần chọn học viên')
        return
      }
    } else {
      if (!normalizeText(enrollmentForm.newLearnerFullName)) {
        setError('Bạn cần nhập họ tên học viên')
        return
      }
      if (!normalizeText(enrollmentForm.newLearnerCode)) {
        setError('Bạn cần nhập mã học viên')
        return
      }
    }

    setSavingEnrollment(true)
    setError('')
    try {
      if (mode === 'existing') {
        const selectedLearner = learners.find((l) => String(l.id) === String(enrollmentForm.learner)) || (selectedLearnerOption ? { id: selectedLearnerOption.value, status: selectedLearnerOption.status } : null)
        if (selectedLearner && (selectedLearner.status === 'inactive' || selectedLearner.learnerStatus === 'inactive')) {
          const confirmActivate = window.confirm('Học viên đang ở trạng thái inactive. Bạn có muốn kích hoạt họ trước khi nhập học? Nhấn OK để kích hoạt và tiếp tục, hoặc Hủy để hủy.')
          if (!confirmActivate) {
            setSavingEnrollment(false)
            return
          }
          try {
            await updateLearner(selectedLearner.id, { learnerStatus: 'active' })
            setSuccess('Kích hoạt học viên thành công')
            setLearners((prev) => prev.map((it) => (String(it.id) === String(selectedLearner.id) ? { ...it, status: 'active', learnerStatus: 'active' } : it)))
          } catch (err) {
            setError('Không thể kích hoạt học viên')
            setSavingEnrollment(false)
            return
          }
        }
      }

      const payload = {
        joinDate: enrollmentForm.joinDate || null,
        leaveDate: enrollmentForm.leaveDate || null,
        status: enrollmentForm.status === 'inactive' ? 'inactive' : 'active',
      }

      if (mode === 'existing') {
        payload.learner = Number(enrollmentForm.learner)
      } else {
        payload.newLearner = {
          fullName: normalizeText(enrollmentForm.newLearnerFullName),
          code: normalizeText(enrollmentForm.newLearnerCode),
          email: normalizeText(enrollmentForm.newLearnerEmail) || null,
          phone: normalizeText(enrollmentForm.newLearnerPhone) || null,
        }
      }

      if (editingEnrollmentId) {
        await updateEnrollment(id, editingEnrollmentId, payload)
        setSuccess('Cập nhật enrollment thành công')
      } else {
        await createEnrollment(id, payload)
        setSuccess(mode === 'existing' ? 'Thêm học viên vào lớp thành công' : 'Tạo học viên và thêm vào lớp thành công')
      }

      closeEnrollmentModal()
      await Promise.all([
        loadEnrollments(enrollmentPage, enrollmentPageSize, enrollmentQ, enrollmentStatus),
        loadEnrollmentOptions(),
      ])
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
            <div className='text-medium-emphasis d-flex align-items-center gap-2'>
              <div>
                {detail?.subjectCode || '-'}
                {detail?.subject ? ` · ${detail.subject}` : ''}
              </div>
              <div>
                <CBadge color={detail?.status === 'inactive' ? 'secondary' : 'success'}>
                  {detail?.status === 'inactive' ? 'Ngưng hoạt động' : 'Đang hoạt động'}
                </CBadge>
              </div>
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
          <CNavLink active={activeTab === 'info'} onClick={() => setActiveTab('info')} role='button'>Thông tin chung</CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink active={activeTab === 'enrollments'} onClick={() => setActiveTab('enrollments')} role='button'>Học viên</CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink active={activeTab === 'assignments'} onClick={() => setActiveTab('assignments')} role='button'>Phân công chuyên môn</CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} role='button'>Buổi học</CNavLink>
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
                  <div className='mb-3'>
                    <strong>Trạng thái:</strong>{' '}
                    <CBadge color={detail?.status === 'inactive' ? 'secondary' : 'success'}>
                      {detail?.status === 'inactive' ? 'Ngưng hoạt động' : 'Đang hoạt động'}
                    </CBadge>
                  </div>
                  {detail?.createdAt ? <div className='mb-2'><strong>Ngày tạo:</strong> {formatDateTime(detail?.createdAt)}</div> : null}
                  {detail?.updatedAt ? <div><strong>Cập nhật:</strong> {formatDateTime(detail?.updatedAt)}</div> : null}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>

        <CTabPane visible={activeTab === 'assignments'}>
          <ClassTeacherAssignmentsTab classId={id} />
        </CTabPane>
        <CTabPane visible={activeTab === 'sessions'}>
          <ClassSessionsTab classId={id} classDetail={detail} onMessage={handleMessage} />
        </CTabPane>
        <CTabPane visible={activeTab === 'enrollments'}>
          <div className='d-flex justify-content-between align-items-center mb-3'>
            <div className='d-flex gap-2'>
              <CButton type='button' color='primary' onClick={openCreateEnrollmentModal}>Thêm học viên</CButton>
              <CButton type='button' color='secondary' onClick={() => setShowImportModal(true)}>Import</CButton>
            </div>
            <div className='d-flex gap-2'>
              <CFormInput placeholder='Tìm kiếm học viên' value={enrollmentQDraft} onChange={(e) => setEnrollmentQDraft(e.target.value)} />
              <div className='d-flex align-items-center ms-2'>
                <CFormCheck id='include-inactive' label='Bao gồm inactive' checked={includeInactiveLearners} onChange={(e) => setIncludeInactiveLearners(e.target.checked)} />
              </div>
              <CButton type='button' color='primary' onClick={() => { setEnrollmentPage(1); setEnrollmentQ(enrollmentQDraft); loadEnrollments(1, enrollmentPageSize, enrollmentQDraft, enrollmentStatus) }}>Tìm</CButton>
            </div>
          </div>

          <CCard className='border-0 shadow-sm'>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 40 }}>#</CTableHeaderCell>
                  <CTableHeaderCell>Học viên</CTableHeaderCell>
                  <CTableHeaderCell>Join date</CTableHeaderCell>
                  <CTableHeaderCell>End date</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 160 }}>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {enrollmentRows.map((row, index) => (
                  <CTableRow key={row.id}>
                    <CTableDataCell>{(enrollmentMeta?.page - 1) * enrollmentMeta?.pageSize + index + 1}</CTableDataCell>
                    <CTableDataCell>{row.learner ? (row.learner.fullName || row.learner.username || row.learner.email || row.learner.phone) : '-'}</CTableDataCell>
                    <CTableDataCell>{row.joinDate || '-'}</CTableDataCell>
                    <CTableDataCell>{row.leaveDate || '-'}</CTableDataCell>
                    <CTableDataCell>{row.enrollmentStatus === 'inactive' ? 'Ngưng hoạt động' : 'Đang hoạt động'}</CTableDataCell>
                    <CTableDataCell>
                      <CButton type='button' size='sm' color='secondary' className='me-2' onClick={() => openEditEnrollmentModal(row)}>Sửa</CButton>
                      <CButton type='button' size='sm' color='danger' onClick={() => handleDeleteEnrollment(row.id)}>Xóa</CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCard>

          <div className='d-flex justify-content-between align-items-center mt-3'>
            <div className='small text-body-secondary'>Hiển thị {enrollmentRangeText}</div>
            <div>
              <CPagination aria-label='Page navigation example'>
                {enrollmentPages.map((p, idx) => (
                  typeof p === 'string' ? <span key={`sep-${idx}`} className='mx-2'>...</span> : (
                    <CPaginationItem key={`page-${p}`} active={p === enrollmentPage} onClick={() => { setEnrollmentPage(p); loadEnrollments(p, enrollmentPageSize, enrollmentQ, enrollmentStatus) }}>{p}</CPaginationItem>
                  )
                ))}
              </CPagination>
            </div>
          </div>
        </CTabPane>
      </CTabContent>

      <CModal backdrop='static' visible={showEnrollmentModal} onClose={closeEnrollmentModal}>
        <CModalHeader>
          <CModalTitle>{editingEnrollmentId ? 'Sửa enrollment' : 'Thêm học viên'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CRow className='g-3'>
              {!editingEnrollmentId ? (
                <CCol md={12}>
                  <CNav variant='tabs' role='tablist'>
                    <CNavItem>
                      <CNavLink active={enrollmentForm.mode === 'existing'} onClick={() => {
                        setEnrollmentForm((prev) => ({
                          ...prev,
                          mode: 'existing',
                        }))
                      }} role='button'>Chọn học viên có sẵn</CNavLink>
                    </CNavItem>
                    <CNavItem>
                      <CNavLink active={enrollmentForm.mode === 'new'} onClick={() => {
                        setSelectedLearnerOption(null)
                        setEnrollmentForm((prev) => ({
                          ...prev,
                          mode: 'new',
                          learner: '',
                        }))
                      }} role='button'>Tạo học viên mới</CNavLink>
                    </CNavItem>
                  </CNav>
                </CCol>
              ) : null}

              {editingEnrollmentId || enrollmentForm.mode === 'existing' ? (
                <CCol md={12}>
                  <CFormLabel>Học viên</CFormLabel>
                  <AsyncCombobox
                    loadOptions={loadLearnerOptions}
                    value={selectedLearnerOption}
                    onChange={(opt) => {
                      setSelectedLearnerOption(opt || null)
                      setEnrollmentForm((prev) => ({ ...prev, learner: opt ? opt.value : '' }))
                    }}
                    placeholder='Chọn học viên'
                  />
                  <div className='small text-body-secondary mt-1'>Tìm theo mã, họ tên, email hoặc số điện thoại nếu hồ sơ học viên đã có.</div>
                </CCol>
              ) : (
                <>
                  <CCol md={12}>
                    <CAlert color='info' className='mb-0'>Luồng này chỉ tạo Learner và Enrollment. Không tạo hoặc liên kết User ở bước này.</CAlert>
                  </CCol>
                  <CCol md={12}>
                    <CFormLabel>Họ tên</CFormLabel>
                    <CFormInput value={enrollmentForm.newLearnerFullName} onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, newLearnerFullName: event.target.value }))} placeholder='Nhập họ tên học viên' />
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Mã học viên</CFormLabel>
                    <CFormInput value={enrollmentForm.newLearnerCode} onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, newLearnerCode: event.target.value }))} placeholder='Nhập mã học viên' />
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Email</CFormLabel>
                    <CFormInput type='email' value={enrollmentForm.newLearnerEmail} onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, newLearnerEmail: event.target.value }))} placeholder='Không bắt buộc' />
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Điện thoại</CFormLabel>
                    <CFormInput value={enrollmentForm.newLearnerPhone} onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, newLearnerPhone: event.target.value }))} placeholder='Không bắt buộc' />
                  </CCol>
                  <CCol md={12}>
                    <div className='small text-body-secondary'>Nếu mã, email hoặc số điện thoại đã khớp learner hoặc user trong tenant hiện tại, hệ thống sẽ chặn tạo trùng và yêu cầu dùng hồ sơ sẵn có.</div>
                  </CCol>
                </>
              )}
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