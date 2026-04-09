import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import {
  createClass,
  deleteClass,
  getClassFormOptions,
  getClassPage,
  updateClass,
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

function emptyForm() {
  return {
    name: '',
    subjectCode: '',
    subject: '',
    mainTeacher: '',
    status: 'active',
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function formatTeacherDisplay(teacher) {
  if (!teacher) return '-'

  const fullName = String(teacher.fullName || '').trim()
  const username = String(teacher.username || '').trim()
  const fallback = String(teacher.email || '').trim()

  if (fullName && username) return `${fullName} (${username})`
  return fullName || username || fallback || '-'
}

export default function ClassManagementPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [teacherKeyword, setTeacherKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState(emptyForm())

  const total = pagination?.total ?? 0
  const pageCount = pagination?.pageCount ?? 1
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])
  const filteredTeachers = useMemo(() => {
    const keyword = String(teacherKeyword || '').trim().toLowerCase()
    if (!keyword) return teachers

    return teachers.filter((teacher) => {
      const haystacks = [
        teacher?.fullName,
        teacher?.username,
        teacher?.email,
        teacher?.label,
      ]

      return haystacks.some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [teacherKeyword, teachers])

  const fromToText = useMemo(() => {
    if (!pagination || total === 0) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, total)
    return `${from}–${to}/${total}`
  }, [pagination, total])

  async function loadOptions() {
    try {
      const nextTeachers = await getClassFormOptions()
      setTeachers(Array.isArray(nextTeachers) ? nextTeachers : [])
    } catch {
      setTeachers([])
    }
  }

  async function load() {
    setLoading(true)
    setError('')

    try {
      const result = await getClassPage({ page, pageSize, q, status: statusFilter })
      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setPagination(result?.pagination ?? null)
    } catch (loadError) {
      setRows([])
      setPagination(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách lớp'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q, statusFilter])

  function resetForm() {
    setFormData(emptyForm())
  }

  function openCreateModal() {
    setEditingId(null)
    setTeacherKeyword('')
    resetForm()
    setShowModal(true)
  }

  function openEditModal(item) {
    setEditingId(item.id)
    setTeacherKeyword('')
    setFormData({
      name: item.name || '',
      subjectCode: item.subjectCode || '',
      subject: item.subject || '',
      mainTeacher: String(item?.mainTeacher?.id || ''),
      status: item.status || 'active',
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setTeacherKeyword('')
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
    if (!String(formData.name).trim()) {
      setError('Tên lớp không được trống')
      return
    }

    if (!String(formData.mainTeacher).trim()) {
      setError('Bạn cần chọn giáo viên chính')
      return
    }

    setFormLoading(true)
    setError('')

    try {
      const payload = {
        name: String(formData.name).trim(),
        subjectCode: String(formData.subjectCode || '').trim() || null,
        subject: String(formData.subject || '').trim() || null,
        mainTeacher: Number(formData.mainTeacher),
        status: formData.status === 'inactive' ? 'inactive' : 'active',
      }

      if (editingId) {
        await updateClass(editingId, payload)
        setSuccess('Cập nhật lớp thành công')
      } else {
        await createClass(payload)
        setSuccess('Thêm mới lớp thành công')
      }

      closeModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu lớp'))
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa lớp này?')) return

    setError('')
    setSuccess('')

    try {
      await deleteClass(id)
      setSuccess('Xóa lớp thành công')
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa lớp'))
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
                  placeholder='Tìm theo tên lớp, mã môn, tên môn...'
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
              <strong>Classes</strong>
              <CBadge color='secondary' className='ms-2'>{total}</CBadge>
            </div>
            <div className='d-flex align-items-center gap-3'>
              <div className='text-body-secondary small'>{fromToText}</div>
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
                      <CTableHeaderCell style={{ minWidth: 220 }}>Tên lớp</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Mã môn</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 180 }}>Môn học</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 180 }}>Giáo viên chính</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 150 }}>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 260 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={8} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                        <CTableDataCell>{item.name || '-'}</CTableDataCell>
                        <CTableDataCell>{item.subjectCode || '-'}</CTableDataCell>
                        <CTableDataCell>{item.subject || '-'}</CTableDataCell>
                        <CTableDataCell>{formatTeacherDisplay(item?.mainTeacher)}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={item.status === 'inactive' ? 'secondary' : 'success'}>
                            {item.status === 'inactive' ? 'Ngưng hoạt động' : 'Đang hoạt động'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.updatedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                              <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/classes/${item.id}`)}>Chi tiết</CButton>
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
            <CModalTitle>{editingId ? 'Sửa lớp' : 'Thêm mới lớp'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={6}>
                  <CFormLabel htmlFor='class-name'>Tên lớp <span className='text-danger'>*</span></CFormLabel>
                  <CFormInput id='class-name' value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} disabled={formLoading} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='class-main-teacher'>Giáo viên chính <span className='text-danger'>*</span></CFormLabel>
                  <CFormInput
                    className='mb-2'
                    placeholder='Gõ để tìm giáo viên theo tên, username, email'
                    value={teacherKeyword}
                    onChange={(event) => setTeacherKeyword(event.target.value)}
                    disabled={formLoading}
                  />
                  <CFormSelect id='class-main-teacher' value={formData.mainTeacher} onChange={(event) => setFormData((prev) => ({ ...prev, mainTeacher: event.target.value }))} disabled={formLoading}>
                    <option value=''>Chọn giáo viên</option>
                    {filteredTeachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>{formatTeacherDisplay(teacher)}</option>
                    ))}
                  </CFormSelect>
                  {teacherKeyword && filteredTeachers.length === 0 ? <div className='small text-body-secondary mt-1'>Không tìm thấy giáo viên phù hợp.</div> : null}
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='class-subject-code'>Mã môn</CFormLabel>
                  <CFormInput id='class-subject-code' value={formData.subjectCode} onChange={(event) => setFormData((prev) => ({ ...prev, subjectCode: event.target.value }))} disabled={formLoading} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='class-subject'>Môn học</CFormLabel>
                  <CFormInput id='class-subject' value={formData.subject} onChange={(event) => setFormData((prev) => ({ ...prev, subject: event.target.value }))} disabled={formLoading} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='class-status'>Trạng thái</CFormLabel>
                  <CFormSelect id='class-status' value={formData.status} onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))} disabled={formLoading}>
                    <option value='active'>Đang hoạt động</option>
                    <option value='inactive'>Ngưng hoạt động</option>
                  </CFormSelect>
                </CCol>
              </CRow>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeModal}>Hủy</CButton>
            <CButton color='primary' onClick={handleSubmit} disabled={formLoading}>
              {formLoading ? 'Đang lưu...' : 'Lưu'}
            </CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}