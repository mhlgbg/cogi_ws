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
  CFormInput,
  CFormLabel,
  CFormSelect,
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
import { getLearningManagementBootstrap } from '../../learning-management/services/learningObjectApi'
import { archiveAssessment, createAssessment, getApiMessage, getAssessments, updateAssessment } from '../services/assessmentService'
import AssessmentEditorModal from '../components/AssessmentEditorModal'
import { buildPages, formatDateTime, getAssessmentStatusLabel, getAssessmentTypeLabel, getEntityId, getStatusBadgeColor, normalizePagination, truncateText } from '../components/assessmentUi'

export default function AssessmentListPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [bootstrap, setBootstrap] = useState(null)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [qDraft, setQDraft] = useState('')
  const [filters, setFilters] = useState({ q: '', assessmentType: '', subjectId: '', status: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingAssessment, setEditingAssessment] = useState(null)

  const subjects = bootstrap?.subjects || []
  const pagination = normalizePagination(meta?.pagination)
  const pages = useMemo(() => buildPages(page, pagination.pageCount), [page, pagination.pageCount])

  useEffect(() => {
    loadBootstrap()
  }, [])

  useEffect(() => {
    loadAssessments()
  }, [page, pageSize, filters])

  async function loadBootstrap() {
    setBootstrapping(true)
    try {
      const payload = await getLearningManagementBootstrap()
      setBootstrap(payload)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được dữ liệu nền của ngân hàng đề'))
    } finally {
      setBootstrapping(false)
    }
  }

  async function loadAssessments() {
    setLoading(true)
    setError('')
    try {
      const payload = await getAssessments({
        page,
        pageSize,
        q: filters.q || undefined,
        assessmentType: filters.assessmentType || undefined,
        subjectId: filters.subjectId || undefined,
        status: filters.status || undefined,
      })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
      setMeta(payload?.meta || null)
    } catch (requestError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(requestError, 'Không tải được danh sách đề'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(payload) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const saved = editingAssessment
        ? await updateAssessment(getEntityId(editingAssessment), payload)
        : await createAssessment(payload)
      setSuccess(editingAssessment ? 'Cập nhật đề thành công' : 'Tạo đề thành công')
      setShowEditor(false)
      setEditingAssessment(null)
      await loadAssessments()
      if (!editingAssessment) {
        navigate(`/assessments/${getEntityId(saved)}`)
      }
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được đề'))
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(row) {
    setError('')
    setSuccess('')
    try {
      await archiveAssessment(getEntityId(row))
      setSuccess('Đã lưu trữ đề')
      await loadAssessments()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu trữ đề'))
    }
  }

  if (bootstrapping) {
    return <div className='py-4 d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải dữ liệu ngân hàng đề...</span></div>
  }

  return (
    <>
      <CCard className='mb-4 ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <div className='fs-4 fw-semibold'>Ngân hàng đề</div>
            <div className='text-body-secondary'>Quản lý các bộ đề, phiên bản, cấu trúc và câu hỏi dùng cho kiểm tra và đánh giá.</div>
          </div>
          <CButton color='primary' onClick={() => { setEditingAssessment(null); setShowEditor(true) }}>+ Tạo đề</CButton>
        </CCardHeader>
      </CCard>

      <CCard className='mb-4 ai-card'>
        <CCardHeader><strong>Bộ lọc</strong></CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol md={4}><CFormInput label='Từ khóa' value={qDraft} onChange={(event) => setQDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setFilters((prev) => ({ ...prev, q: String(qDraft || '').trim() })); setPage(1) } }} placeholder='Tìm theo mã hoặc tên đề...' /></CCol>
            <CCol md={2}><CFormLabel>Loại đề</CFormLabel><CFormSelect value={filters.assessmentType} onChange={(event) => { setFilters((prev) => ({ ...prev, assessmentType: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{['placement', 'diagnostic', 'practice', 'quiz', 'exam', 'other'].map((item) => <option key={item} value={item}>{getAssessmentTypeLabel(item)}</option>)}</CFormSelect></CCol>
            <CCol md={3}><CFormLabel>Môn học</CFormLabel><CFormSelect value={filters.subjectId} onChange={(event) => { setFilters((prev) => ({ ...prev, subjectId: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.status} onChange={(event) => { setFilters((prev) => ({ ...prev, status: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{['draft', 'active', 'archived'].map((item) => <option key={item} value={item}>{getAssessmentStatusLabel(item)}</option>)}</CFormSelect></CCol>
            <CCol md={1} className='d-flex gap-2'>
              <CButton color='primary' onClick={() => { setFilters((prev) => ({ ...prev, q: String(qDraft || '').trim() })); setPage(1) }} disabled={loading}>Search</CButton>
            </CCol>
            <CCol md={12} className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={() => { setQDraft(''); setFilters({ q: '', assessmentType: '', subjectId: '', status: '' }); setPage(1) }} disabled={loading}>Xóa bộ lọc</CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CCard className='ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <div>
            <strong>Danh sách đề</strong>
            <CBadge color='secondary' className='ms-2'>{pagination.total}</CBadge>
          </div>
        </CCardHeader>
        <CCardBody>
          {loading ? <div className='d-flex align-items-center gap-2 py-3'><CSpinner size='sm' /><span>Đang tải danh sách đề...</span></div> : (
            <>
              <div className='d-none d-lg-block'>
                <CTable hover responsive align='middle' className='ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 140 }}>Mã</CTableHeaderCell>
                      <CTableHeaderCell>Tên đề</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Loại</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Môn học</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Phiên bản</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 130 }}>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow><CTableDataCell colSpan={8} className='text-center text-body-secondary'>Chưa có đề nào.</CTableDataCell></CTableRow>
                    ) : rows.map((row) => (
                      <CTableRow key={getEntityId(row) || row.code}>
                        <CTableDataCell>{row.code || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='fw-semibold'>{row.name || '-'}</div>
                          <div className='small text-body-secondary'>{truncateText(row.description, 100)}</div>
                        </CTableDataCell>
                        <CTableDataCell>{getAssessmentTypeLabel(row.assessmentType)}</CTableDataCell>
                        <CTableDataCell>{row.subject?.title || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div>{`${row.versionCount || 0} phiên bản`}</div>
                          <div className='small text-body-secondary'>{row.latestPublishedVersion ? `${row.latestPublishedVersion.code} · Published` : 'Chưa có phiên bản Published'}</div>
                        </CTableDataCell>
                        <CTableDataCell><CBadge color={getStatusBadgeColor(row.status)}>{getAssessmentStatusLabel(row.status)}</CBadge></CTableDataCell>
                        <CTableDataCell>{formatDateTime(row.updatedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => navigate(`/assessments/${getEntityId(row)}`)}>Mở</CButton>
                            <CButton size='sm' color='secondary' variant='outline' onClick={() => { setEditingAssessment(row); setShowEditor(true) }}>Sửa</CButton>
                            {row.status !== 'archived' ? <CButton size='sm' color='warning' variant='outline' onClick={() => handleArchive(row)}>Lưu trữ</CButton> : null}
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>

              <div className='d-lg-none d-grid gap-3'>
                {rows.length === 0 ? <div className='text-center text-body-secondary py-4'>Chưa có đề nào.</div> : rows.map((row) => (
                  <CCard key={getEntityId(row) || row.code} className='border'>
                    <CCardBody>
                      <div className='fw-semibold'>{row.code}</div>
                      <div className='mb-2'>{row.name}</div>
                      <div className='small text-body-secondary mb-2'>{`${getAssessmentTypeLabel(row.assessmentType)} · ${row.subject?.title || '-'}`}</div>
                      <div className='small text-body-secondary mb-2'>{`${row.versionCount || 0} phiên bản`}</div>
                      <div className='small text-body-secondary mb-3'>{row.latestPublishedVersion ? `${row.latestPublishedVersion.code} · Published` : 'Chưa có phiên bản Published'}</div>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton size='sm' color='info' variant='outline' onClick={() => navigate(`/assessments/${getEntityId(row)}`)}>Mở</CButton>
                        <CButton size='sm' color='secondary' variant='outline' onClick={() => { setEditingAssessment(row); setShowEditor(true) }}>Sửa</CButton>
                      </div>
                    </CCardBody>
                  </CCard>
                ))}
              </div>

              <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3'>
                <div className='small text-body-secondary'>{pagination.total > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, pagination.total)}/${pagination.total}` : '0'}</div>
                <div className='d-flex align-items-center gap-2'>
                  <CFormSelect value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value || 10)); setPage(1) }} style={{ width: 110 }}>
                    {[10, 20, 50].map((size) => <option key={size} value={size}>{size}/trang</option>)}
                  </CFormSelect>
                  <CPagination className='mb-0'>
                    <CPaginationItem disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => item === '...' ? <CPaginationItem key={`ellipsis-${index}`} disabled>…</CPaginationItem> : <CPaginationItem key={item} active={item === page} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pagination.pageCount} onClick={() => setPage((prev) => Math.min(pagination.pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </div>
            </>
          )}
        </CCardBody>
      </CCard>

      <AssessmentEditorModal visible={showEditor} saving={saving} assessment={editingAssessment} subjects={subjects} onClose={() => { if (!saving) { setShowEditor(false); setEditingAssessment(null) } }} onSubmit={handleSubmit} />
    </>
  )
}
