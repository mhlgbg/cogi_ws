import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
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
} from '@coreui/react'
import CampaignReport from '../components/CampaignReport'
import CreateAssignmentModal from '../components/CreateAssignmentModal'
import ImportAssignmentModal from '../components/ImportAssignmentModal'
import {
  deleteSurveyAssignmentsByFilter,
  exportSurveyCampaignProgressReport,
  getSurveyAssignments,
  getSurveyCampaignDetail,
  resetSurveyCampaignResponses,
  restoreSurveyAssignment,
  restoreSurveyAssignmentsByFilter,
} from '../services/surveyCampaignService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function getAssignmentStatusMeta(item) {
  const status = String(item?.statusLabel || item?.latestResponseStatus || '').toUpperCase()

  if (status === 'COMPLETED' || status === 'SUBMITTED') {
    return { color: 'success', label: 'Completed' }
  }

  if (status === 'RESET') {
    return {
      color: 'warning',
      label: item?.wasCompletedBeforeReset ? 'Completed -> Reset' : 'Reset',
    }
  }

  if (status === 'IN_PROGRESS') {
    return { color: 'info', label: 'In Progress' }
  }

  return { color: 'secondary', label: 'Pending' }
}

function createEmptyAssignmentFilters() {
  return {
    studentKeyword: '',
    isCompleted: '',
    courseId: '',
    lecturerId: '',
  }
}

function normalizeAssignmentFilters(filters) {
  return {
    studentKeyword: String(filters?.studentKeyword || '').trim(),
    isCompleted: String(filters?.isCompleted || ''),
    courseId: String(filters?.courseId || '').trim(),
    lecturerId: String(filters?.lecturerId || '').trim(),
  }
}

function buildRangeText(total, rowCount, currentPage, currentPageSize) {
  if (total <= 0 || rowCount === 0) return '0 / 0'
  const start = (currentPage - 1) * currentPageSize + 1
  const end = Math.min(currentPage * currentPageSize, total)
  return `${start}-${end} / ${total}`
}

function buildPaginationItems(currentPage, currentPageCount) {
  if (currentPageCount <= 1) return [1]
  const pages = new Set([1, currentPageCount, currentPage - 1, currentPage, currentPage + 1])
  return [...pages]
    .filter((value) => value >= 1 && value <= currentPageCount)
    .sort((left, right) => left - right)
    .reduce((acc, value, index, array) => {
      if (index > 0 && value - array[index - 1] > 1) {
        acc.push('ellipsis')
      }
      acc.push(value)
      return acc
    }, [])
}

export default function CampaignDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [detail, setDetail] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pageCount, setPageCount] = useState(1)
  const [total, setTotal] = useState(0)
  const [trashAssignments, setTrashAssignments] = useState([])
  const [trashPage, setTrashPage] = useState(1)
  const [trashPageSize, setTrashPageSize] = useState(10)
  const [trashPageCount, setTrashPageCount] = useState(1)
  const [trashTotal, setTrashTotal] = useState(0)
  const [trashLoaded, setTrashLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showDeleteAssignmentsConfirm, setShowDeleteAssignmentsConfirm] = useState(false)
  const [resettingResponses, setResettingResponses] = useState(false)
  const [deletingAssignments, setDeletingAssignments] = useState(false)
  const [restoringDeletedAssignments, setRestoringDeletedAssignments] = useState(false)
  const [restoringAssignmentId, setRestoringAssignmentId] = useState(null)
  const [exportingProgress, setExportingProgress] = useState(false)
  const [reportReloadKey, setReportReloadKey] = useState(0)
  const [filters, setFilters] = useState(createEmptyAssignmentFilters)
  const [appliedFilters, setAppliedFilters] = useState(createEmptyAssignmentFilters)
  const [trashFilters, setTrashFilters] = useState(createEmptyAssignmentFilters)
  const [appliedTrashFilters, setAppliedTrashFilters] = useState(createEmptyAssignmentFilters)

  async function loadDetail() {
    const data = await getSurveyCampaignDetail(id)
    setDetail(data)
  }

  async function loadAssignments(nextPage = page, nextPageSize = pageSize, nextFilters = appliedFilters) {
    const response = await getSurveyAssignments({
      campaignId: id,
      page: nextPage,
      pageSize: nextPageSize,
      ...nextFilters,
    })
    setAssignments(Array.isArray(response?.data) ? response.data : [])
    setPage(Number(response?.meta?.page || nextPage) || 1)
    setPageSize(Number(response?.meta?.pageSize || nextPageSize) || 10)
    setPageCount(Number(response?.meta?.pageCount || 1) || 1)
    setTotal(Number(response?.meta?.total || 0) || 0)
  }

  async function loadDeletedAssignments(nextPage = trashPage, nextPageSize = trashPageSize, nextFilters = appliedTrashFilters) {
    const response = await getSurveyAssignments({
      campaignId: id,
      page: nextPage,
      pageSize: nextPageSize,
      deletedOnly: true,
      ...nextFilters,
    })
    setTrashAssignments(Array.isArray(response?.data) ? response.data : [])
    setTrashPage(Number(response?.meta?.page || nextPage) || 1)
    setTrashPageSize(Number(response?.meta?.pageSize || nextPageSize) || 10)
    setTrashPageCount(Number(response?.meta?.pageCount || 1) || 1)
    setTrashTotal(Number(response?.meta?.total || 0) || 0)
    setTrashLoaded(true)
  }

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        await Promise.all([loadDetail(), loadAssignments()])
      } catch (requestError) {
        if (!mounted) return
        setError(getApiMessage(requestError, 'Không thể tải campaign detail'))
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

    const timer = window.setTimeout(() => setSuccess(''), 3000)
    return () => window.clearTimeout(timer)
  }, [success])

  useEffect(() => {
    if (activeTab !== 'trash' || trashLoaded || !id) return undefined

    let mounted = true

    setLoading(true)
    setError('')

    loadDeletedAssignments()
      .catch((requestError) => {
        if (!mounted) return
        setError(getApiMessage(requestError, 'Không thể tải danh sách assignment đã xóa'))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [activeTab, trashLoaded, id])

  async function applyFilters() {
    setLoading(true)
    setError('')

    try {
      const nextFilters = normalizeAssignmentFilters(filters)
      setAppliedFilters(nextFilters)
      await loadAssignments(1, pageSize, nextFilters)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải danh sách assignment'))
    } finally {
      setLoading(false)
    }
  }

  async function applyTrashFilters() {
    setLoading(true)
    setError('')

    try {
      const nextFilters = normalizeAssignmentFilters(trashFilters)
      setAppliedTrashFilters(nextFilters)
      await loadDeletedAssignments(1, trashPageSize, nextFilters)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải danh sách assignment đã xóa'))
    } finally {
      setLoading(false)
    }
  }

  async function handlePageChange(nextPage) {
    if (nextPage < 1 || nextPage > pageCount || nextPage === page) return

    setLoading(true)
    setError('')

    try {
      await loadAssignments(nextPage, pageSize, appliedFilters)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải danh sách assignment'))
    } finally {
      setLoading(false)
    }
  }

  async function handlePageSizeChange(nextPageSize) {
    setLoading(true)
    setError('')

    try {
      await loadAssignments(1, nextPageSize, appliedFilters)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải danh sách assignment'))
    } finally {
      setLoading(false)
    }
  }

  async function handleTrashPageChange(nextPage) {
    if (nextPage < 1 || nextPage > trashPageCount || nextPage === trashPage) return

    setLoading(true)
    setError('')

    try {
      await loadDeletedAssignments(nextPage, trashPageSize, appliedTrashFilters)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải danh sách assignment đã xóa'))
    } finally {
      setLoading(false)
    }
  }

  async function handleTrashPageSizeChange(nextPageSize) {
    setLoading(true)
    setError('')

    try {
      await loadDeletedAssignments(1, nextPageSize, appliedTrashFilters)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải danh sách assignment đã xóa'))
    } finally {
      setLoading(false)
    }
  }

  function resetFilters() {
    const nextFilters = createEmptyAssignmentFilters()
    setFilters(nextFilters)
    setAppliedFilters(nextFilters)
    setLoading(true)
    setError('')

    loadAssignments(1, pageSize, nextFilters)
      .catch((requestError) => {
        setError(getApiMessage(requestError, 'Không thể tải danh sách assignment'))
      })
      .finally(() => {
        setLoading(false)
      })
  }

  function resetTrashFilters() {
    const nextFilters = createEmptyAssignmentFilters()
    setTrashFilters(nextFilters)
    setAppliedTrashFilters(nextFilters)
    setLoading(true)
    setError('')

    loadDeletedAssignments(1, trashPageSize, nextFilters)
      .catch((requestError) => {
        setError(getApiMessage(requestError, 'Không thể tải danh sách assignment đã xóa'))
      })
      .finally(() => {
        setLoading(false)
      })
  }

  async function handleCreateAssignmentSuccess() {
    setShowCreateModal(false)
    setSuccess('Đã thêm assignment mới')
    await Promise.all([loadDetail(), loadAssignments(1, pageSize, appliedFilters)])
  }

  async function handleResetResponses() {
    if (!id || resettingResponses) return

    setResettingResponses(true)
    setError('')
    setSuccess('')

    try {
      const result = await resetSurveyCampaignResponses(id)
      await Promise.all([loadDetail(), loadAssignments(page, pageSize, appliedFilters)])
      setReportReloadKey((current) => current + 1)
      setShowResetConfirm(false)
      setSuccess(
        `Đã chuyển ${result?.resetResponses || 0} response sang RESET và ${result?.resetAssignments || 0} assignment về trạng thái chưa hoàn thành.`,
      )
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể reset responses của campaign'))
    } finally {
      setResettingResponses(false)
    }
  }

  async function handleDeleteAssignmentsByFilter() {
    if (!id || deletingAssignments) return

    setDeletingAssignments(true)
    setError('')
    setSuccess('')

    try {
      const result = await deleteSurveyAssignmentsByFilter({
        campaignId: id,
        ...appliedFilters,
      })
      await Promise.all([
        loadDetail(),
        loadAssignments(1, pageSize, appliedFilters),
        loadDeletedAssignments(1, trashPageSize, appliedTrashFilters),
      ])
      setShowDeleteAssignmentsConfirm(false)
      setSuccess(
        `Đã chuyển ${result?.softDeletedAssignments || 0} assignment vào trạng thái xóa mềm theo bộ lọc hiện tại.`,
      )
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xóa mềm assignments theo điều kiện lọc'))
    } finally {
      setDeletingAssignments(false)
    }
  }

  async function handleRestoreDeletedAssignmentsByFilter() {
    if (!id || restoringDeletedAssignments) return

    setRestoringDeletedAssignments(true)
    setError('')
    setSuccess('')

    try {
      const result = await restoreSurveyAssignmentsByFilter({
        campaignId: id,
        deletedOnly: true,
        ...appliedTrashFilters,
      })
      await Promise.all([
        loadDetail(),
        loadAssignments(1, pageSize, appliedFilters),
        loadDeletedAssignments(1, trashPageSize, appliedTrashFilters),
      ])
      setSuccess(`Đã khôi phục ${result?.restoredAssignments || 0} assignment theo điều kiện tìm kiếm hiện tại.`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể khôi phục assignments theo điều kiện lọc'))
    } finally {
      setRestoringDeletedAssignments(false)
    }
  }

  async function handleRestoreAssignment(assignmentId) {
    if (!assignmentId || restoringAssignmentId) return

    setRestoringAssignmentId(assignmentId)
    setError('')
    setSuccess('')

    try {
      const restored = await restoreSurveyAssignment(assignmentId)
      await Promise.all([
        loadDetail(),
        loadAssignments(1, pageSize, appliedFilters),
        loadDeletedAssignments(trashPage, trashPageSize, appliedTrashFilters),
      ])
      setSuccess(`Đã khôi phục assignment của ${restored?.student?.fullName || restored?.student?.studentCode || `#${assignmentId}`}.`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể khôi phục assignment'))
    } finally {
      setRestoringAssignmentId(null)
    }
  }

  async function handleExportProgress() {
    if (!id || exportingProgress) return

    setExportingProgress(true)
    setError('')

    try {
      const result = await exportSurveyCampaignProgressReport(id)
      const blob = result?.blob instanceof Blob
        ? result.blob
        : new Blob([result?.blob], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result?.fileName || `survey-progress-${id}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xuất tiến độ khảo sát'))
    } finally {
      setExportingProgress(false)
    }
  }

  const assignmentRangeText = useMemo(() => buildRangeText(total, assignments.length, page, pageSize), [assignments.length, page, pageSize, total])
  const trashRangeText = useMemo(() => buildRangeText(trashTotal, trashAssignments.length, trashPage, trashPageSize), [trashAssignments.length, trashPage, trashPageSize, trashTotal])
  const paginationItems = useMemo(() => buildPaginationItems(page, pageCount), [page, pageCount])
  const trashPaginationItems = useMemo(() => buildPaginationItems(trashPage, trashPageCount), [trashPage, trashPageCount])

  const summary = useMemo(() => ({
    total: detail?.totalAssignments || 0,
    completed: detail?.completedAssignments || 0,
    percent: detail?.progressPercent || 0,
  }), [detail])

  return (
    <div className='container-fluid py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <h3 className='mb-1'>{detail?.name || 'Campaign detail'}</h3>
          <div className='text-medium-emphasis'>
            {detail?.surveyTemplate?.name || '-'}
            {detail?.academicYear ? ` · ${detail.academicYear}` : ''}
            {detail?.semester ? ` · ${detail.semester}` : ''}
          </div>
        </div>
        <div className='d-flex gap-2'>
          <CButton color='light' onClick={() => navigate('/survey/campaigns')}>Quay lại</CButton>
          <CButton color='warning' variant='outline' onClick={() => navigate(`/survey/campaigns/create?id=${id}`)}>Edit</CButton>
          <CButton color='success' variant='outline' onClick={handleExportProgress} disabled={loading || exportingProgress}>
            {exportingProgress ? 'Đang xuất...' : 'Xuất tiến độ khảo sát'}
          </CButton>
          <CButton color='primary' onClick={() => setShowImportModal(true)}>Import Assignment</CButton>
        </div>
      </div>

      {error ? <div className='alert alert-danger'>{error}</div> : null}
      {success ? <div className='alert alert-success'>{success}</div> : null}

      {loading ? (
        <div className='text-center py-5'>
          <CSpinner color='primary' />
        </div>
      ) : (
        <>
          <CNav variant='tabs' role='tablist' className='mb-4'>
            <CNavItem>
              <CNavLink active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} role='button'>Overview</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'assignments'} onClick={() => setActiveTab('assignments')} role='button'>Assignments</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'report'} onClick={() => setActiveTab('report')} role='button'>Report</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'trash'} onClick={() => setActiveTab('trash')} role='button'>Trash</CNavLink>
            </CNavItem>
          </CNav>

          <CTabContent>
            <CTabPane visible={activeTab === 'overview'}>
              <CRow className='g-3'>
                <CCol md={3}>
                  <CCard className='border-0 shadow-sm'>
                    <CCardBody>
                      <div className='text-medium-emphasis small'>Trạng thái</div>
                      <div className='mt-2'><CBadge color={detail?.campaignStatus === 'OPEN' ? 'success' : detail?.campaignStatus === 'CLOSED' ? 'secondary' : 'warning'}>{detail?.campaignStatus || 'DRAFT'}</CBadge></div>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={3}>
                  <CCard className='border-0 shadow-sm'>
                    <CCardBody>
                      <div className='text-medium-emphasis small'>Total assignments</div>
                      <div className='fs-4 fw-semibold'>{summary.total}</div>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={3}>
                  <CCard className='border-0 shadow-sm'>
                    <CCardBody>
                      <div className='text-medium-emphasis small'>Completed</div>
                      <div className='fs-4 fw-semibold'>{summary.completed}</div>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={3}>
                  <CCard className='border-0 shadow-sm'>
                    <CCardBody>
                      <div className='text-medium-emphasis small'>Progress %</div>
                      <div className='fs-4 fw-semibold'>{summary.percent}%</div>
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>
            </CTabPane>

            <CTabPane visible={activeTab === 'assignments'}>
              <CCard className='border-0 shadow-sm mb-4'>
                <CCardHeader className='bg-white'><strong>Filters</strong></CCardHeader>
                <CCardBody>
                  <CRow className='g-3 align-items-end'>
                    <CCol md={3}>
                      <CFormLabel htmlFor='assignment-student-keyword'>Sinh viên</CFormLabel>
                      <CFormInput
                        id='assignment-student-keyword'
                        value={filters.studentKeyword}
                        onChange={(event) => setFilters((prev) => ({ ...prev, studentKeyword: event.target.value }))}
                        placeholder='Mã hoặc họ tên sinh viên'
                      />
                    </CCol>
                    <CCol md={3}>
                      <CFormLabel htmlFor='assignment-is-completed'>isCompleted</CFormLabel>
                      <CFormSelect id='assignment-is-completed' value={filters.isCompleted} onChange={(event) => setFilters((prev) => ({ ...prev, isCompleted: event.target.value }))}>
                        <option value=''>Tất cả</option>
                        <option value='true'>Completed</option>
                        <option value='false'>Pending</option>
                      </CFormSelect>
                    </CCol>
                    <CCol md={3}>
                      <CFormLabel htmlFor='assignment-course-id'>courseId</CFormLabel>
                      <CFormInput id='assignment-course-id' value={filters.courseId} onChange={(event) => setFilters((prev) => ({ ...prev, courseId: event.target.value }))} />
                    </CCol>
                    <CCol md={3}>
                      <CFormLabel htmlFor='assignment-lecturer-id'>lecturerId</CFormLabel>
                      <CFormInput id='assignment-lecturer-id' value={filters.lecturerId} onChange={(event) => setFilters((prev) => ({ ...prev, lecturerId: event.target.value }))} />
                    </CCol>
                    <CCol md={12}>
                      <div className='d-flex gap-2'>
                        <CButton color='primary' onClick={applyFilters}>Lọc</CButton>
                        <CButton color='secondary' variant='outline' onClick={resetFilters}>Reset</CButton>
                      </div>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>

              <CCard className='border-0 shadow-sm'>
                <CCardHeader className='bg-white d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                  <strong>Assignments</strong>
                  <div className='d-flex gap-2 flex-wrap'>
                    <CButton
                      color='primary'
                      variant='outline'
                      onClick={() => setShowCreateModal(true)}
                      disabled={loading}
                    >
                      Thêm mới
                    </CButton>
                    <CButton
                      color='danger'
                      variant='outline'
                      onClick={() => setShowDeleteAssignmentsConfirm(true)}
                      disabled={loading || deletingAssignments || total <= 0}
                    >
                      {deletingAssignments ? 'Đang xóa...' : 'Xóa assignments đã lọc'}
                    </CButton>
                    <CButton
                      color='danger'
                      variant='outline'
                      onClick={() => setShowResetConfirm(true)}
                      disabled={loading || resettingResponses || Number(detail?.totalAssignments || 0) <= 0}
                    >
                      {resettingResponses ? 'Đang reset...' : 'Reset Responses'}
                    </CButton>
                  </div>
                </CCardHeader>
                <CCardBody>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Sinh viên</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Môn</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Giảng viên</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: '12px 8px' }}>Không có assignment phù hợp</td>
                          </tr>
                        ) : assignments.map((item) => (
                          <tr key={item.id}>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                              <div style={{ fontWeight: 600 }}>{item?.student?.fullName || item?.student?.studentCode || '-'}</div>
                              <div style={{ color: '#666', fontSize: 13 }}>{item?.student?.studentCode || '-'}</div>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                              <div>{item.courseName || '-'}</div>
                              <div style={{ color: '#666', fontSize: 13 }}>{item.courseId || '-'}</div>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                              <div>{item.lecturerName || '-'}</div>
                              <div style={{ color: '#666', fontSize: 13 }}>{item.lecturerId || '-'}</div>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                              <CBadge color={getAssignmentStatusMeta(item).color}>{getAssignmentStatusMeta(item).label}</CBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mt-3'>
                    <div className='d-flex align-items-center gap-2'>
                      <span className='text-body-secondary small'>Hiển thị</span>
                      <CFormSelect
                        value={pageSize}
                        onChange={(event) => handlePageSizeChange(Number(event.target.value) || 10)}
                        style={{ width: 96 }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </CFormSelect>
                      <span className='text-body-secondary small'>{assignmentRangeText}</span>
                    </div>

                    <CPagination align='end' className='mb-0'>
                      <CPaginationItem disabled={page <= 1 || loading} onClick={() => handlePageChange(page - 1)}>
                        Trước
                      </CPaginationItem>
                      {paginationItems.map((item, index) => item === 'ellipsis'
                        ? <CPaginationItem key={`ellipsis-${index}`} disabled>…</CPaginationItem>
                        : (
                            <CPaginationItem
                              key={item}
                              active={item === page}
                              disabled={loading}
                              onClick={() => handlePageChange(item)}
                            >
                              {item}
                            </CPaginationItem>
                          ))}
                      <CPaginationItem disabled={page >= pageCount || loading} onClick={() => handlePageChange(page + 1)}>
                        Sau
                      </CPaginationItem>
                    </CPagination>
                  </div>
                </CCardBody>
              </CCard>
            </CTabPane>

            <CTabPane visible={activeTab === 'report'}>
              <CampaignReport campaignId={id} active={activeTab === 'report'} reloadKey={reportReloadKey} />
            </CTabPane>

            <CTabPane visible={activeTab === 'trash'}>
              <CCard className='border-0 shadow-sm mb-4'>
                <CCardHeader className='bg-white'><strong>Bộ lọc Trash</strong></CCardHeader>
                <CCardBody>
                  <CRow className='g-3 align-items-end'>
                    <CCol md={3}>
                      <CFormLabel htmlFor='trash-student-keyword'>Sinh viên</CFormLabel>
                      <CFormInput
                        id='trash-student-keyword'
                        value={trashFilters.studentKeyword}
                        onChange={(event) => setTrashFilters((prev) => ({ ...prev, studentKeyword: event.target.value }))}
                        placeholder='Mã hoặc họ tên sinh viên'
                      />
                    </CCol>
                    <CCol md={3}>
                      <CFormLabel htmlFor='trash-is-completed'>isCompleted</CFormLabel>
                      <CFormSelect id='trash-is-completed' value={trashFilters.isCompleted} onChange={(event) => setTrashFilters((prev) => ({ ...prev, isCompleted: event.target.value }))}>
                        <option value=''>Tất cả</option>
                        <option value='true'>Completed</option>
                        <option value='false'>Pending</option>
                      </CFormSelect>
                    </CCol>
                    <CCol md={3}>
                      <CFormLabel htmlFor='trash-course-id'>courseId</CFormLabel>
                      <CFormInput id='trash-course-id' value={trashFilters.courseId} onChange={(event) => setTrashFilters((prev) => ({ ...prev, courseId: event.target.value }))} />
                    </CCol>
                    <CCol md={3}>
                      <CFormLabel htmlFor='trash-lecturer-id'>lecturerId</CFormLabel>
                      <CFormInput id='trash-lecturer-id' value={trashFilters.lecturerId} onChange={(event) => setTrashFilters((prev) => ({ ...prev, lecturerId: event.target.value }))} />
                    </CCol>
                    <CCol md={12}>
                      <div className='d-flex gap-2'>
                        <CButton color='primary' onClick={applyTrashFilters}>Lọc</CButton>
                        <CButton color='secondary' variant='outline' onClick={resetTrashFilters}>Reset</CButton>
                      </div>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>

              <CCard className='border-0 shadow-sm'>
                <CCardHeader className='bg-white d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                  <strong>Assignments đã xóa mềm</strong>
                  <div className='d-flex gap-2 flex-wrap'>
                    <CButton
                      color='success'
                      variant='outline'
                      onClick={handleRestoreDeletedAssignmentsByFilter}
                      disabled={loading || restoringDeletedAssignments || trashTotal <= 0}
                    >
                      {restoringDeletedAssignments ? 'Đang khôi phục...' : 'Khôi phục theo điều kiện lọc'}
                    </CButton>
                  </div>
                </CCardHeader>
                <CCardBody>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 1040, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Sinh viên</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Môn</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Giảng viên</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Trạng thái</th>
                          <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trashAssignments.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: '12px 8px' }}>Không có assignment đã xóa mềm phù hợp</td>
                          </tr>
                        ) : trashAssignments.map((item) => (
                          <tr key={item.id}>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                              <div style={{ fontWeight: 600 }}>{item?.student?.fullName || item?.student?.studentCode || '-'}</div>
                              <div style={{ color: '#666', fontSize: 13 }}>{item?.student?.studentCode || '-'}</div>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                              <div>{item.courseName || '-'}</div>
                              <div style={{ color: '#666', fontSize: 13 }}>{item.courseId || '-'}</div>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                              <div>{item.lecturerName || '-'}</div>
                              <div style={{ color: '#666', fontSize: 13 }}>{item.lecturerId || '-'}</div>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                              <CBadge color={getAssignmentStatusMeta(item).color}>{getAssignmentStatusMeta(item).label}</CBadge>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                              <CButton
                                size='sm'
                                color='success'
                                variant='outline'
                                onClick={() => handleRestoreAssignment(item.id)}
                                disabled={loading || restoringDeletedAssignments || restoringAssignmentId === item.id}
                              >
                                {restoringAssignmentId === item.id ? 'Đang khôi phục...' : 'Khôi phục'}
                              </CButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mt-3'>
                    <div className='d-flex align-items-center gap-2'>
                      <span className='text-body-secondary small'>Hiển thị</span>
                      <CFormSelect
                        value={trashPageSize}
                        onChange={(event) => handleTrashPageSizeChange(Number(event.target.value) || 10)}
                        style={{ width: 96 }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </CFormSelect>
                      <span className='text-body-secondary small'>{trashRangeText}</span>
                    </div>

                    <CPagination align='end' className='mb-0'>
                      <CPaginationItem disabled={trashPage <= 1 || loading} onClick={() => handleTrashPageChange(trashPage - 1)}>
                        Trước
                      </CPaginationItem>
                      {trashPaginationItems.map((item, index) => item === 'ellipsis'
                        ? <CPaginationItem key={`trash-ellipsis-${index}`} disabled>…</CPaginationItem>
                        : (
                            <CPaginationItem
                              key={`trash-page-${item}`}
                              active={item === trashPage}
                              disabled={loading}
                              onClick={() => handleTrashPageChange(item)}
                            >
                              {item}
                            </CPaginationItem>
                          ))}
                      <CPaginationItem disabled={trashPage >= trashPageCount || loading} onClick={() => handleTrashPageChange(trashPage + 1)}>
                        Sau
                      </CPaginationItem>
                    </CPagination>
                  </div>
                </CCardBody>
              </CCard>
            </CTabPane>
          </CTabContent>
        </>
      )}

      <ImportAssignmentModal
        visible={showImportModal}
        campaignId={detail?.id}
        campaignName={detail?.name}
        onClose={() => setShowImportModal(false)}
        onSuccess={async () => {
          await Promise.all([loadDetail(), loadAssignments(page, pageSize, appliedFilters)])
        }}
      />

      <CreateAssignmentModal
        visible={showCreateModal}
        campaignId={detail?.id}
        campaignName={detail?.name}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateAssignmentSuccess}
      />

      <CModal
        visible={showDeleteAssignmentsConfirm}
        backdrop='static'
        onClose={() => !deletingAssignments && setShowDeleteAssignmentsConfirm(false)}
      >
        <CModalHeader>
          <CModalTitle>Xác nhận xóa assignments</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Bạn có chắc chắn muốn xóa tất cả assignments thỏa mãn điều kiện tìm kiếm hiện tại không?<br />
          <strong>Số bản ghi khớp hiện tại: {total}</strong><br />
          Thao tác này sẽ xóa luôn response và answer liên quan của các assignment đó.
        </CModalBody>
        <CModalFooter>
          <CButton
            color='secondary'
            variant='outline'
            onClick={() => setShowDeleteAssignmentsConfirm(false)}
            disabled={deletingAssignments}
          >
            Hủy
          </CButton>
          <CButton color='danger' onClick={handleDeleteAssignmentsByFilter} disabled={deletingAssignments}>
            {deletingAssignments ? 'Đang xóa...' : 'Đồng ý xóa'}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={showResetConfirm}
        backdrop='static'
        onClose={() => !resettingResponses && setShowResetConfirm(false)}
      >
        <CModalHeader>
          <CModalTitle>Xác nhận reset khảo sát</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Bạn có chắc chắn muốn reset các khảo sát đã Completed của campaign này không?<br />
          Sau khi reset, các bản này sẽ hiện trạng thái <strong>Completed -&gt; Reset</strong> để dễ nhận biết đã từng submit nhưng đã bị mở lại.
        </CModalBody>
        <CModalFooter>
          <CButton
            color='secondary'
            variant='outline'
            onClick={() => setShowResetConfirm(false)}
            disabled={resettingResponses}
          >
            Hủy
          </CButton>
          <CButton color='danger' onClick={handleResetResponses} disabled={resettingResponses}>
            {resettingResponses ? 'Đang reset...' : 'Đồng ý reset'}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}