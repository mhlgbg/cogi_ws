import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CPagination,
  CPaginationItem,
  CPlaceholder,
  CRow,
  CToast,
  CToastBody,
  CToaster,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import OutcomeStandardFormModal from './OutcomeStandardFormModal'
import OutcomeStandardStatusConfirmModal from './OutcomeStandardStatusConfirmModal'
import useOutcomeStandardMutations from '../hooks/useOutcomeStandardMutations'
import { listExamPrograms } from '../services/examProgramApi'
import { listOutcomeStandards } from '../services/outcomeStandardApi'
import { useFeature } from '../../../contexts/FeatureContext'
import { buildExamConfigurationDetailPath, resolveOutcomeStandardMutationError, resolveOutcomeStandardReadError } from '../utils/examConfigurationUi'
import { buildOutcomeStandardFormValues, mapOutcomeStandardFormValuesToCreatePayload, mapOutcomeStandardFormValuesToUpdatePayload } from '../utils/outcomeStandardForm'
import { OUTCOME_RECOGNITION_METHOD_OPTIONS, OUTCOME_STANDARD_SORT_OPTIONS, formatOutcomeEffectiveDateRange, getOutcomeRecognitionMethodLabel, getOutcomeStatusMeta } from '../utils/outcomeStandardUi'
import { formatExamConfigDateTime } from '../utils/examSubjectUi'

function buildPages(currentPage, pageCount) {
  const maxButtons = 7
  const pages = []
  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }
  const left = Math.max(2, currentPage - 2)
  const right = Math.min(pageCount - 1, currentPage + 2)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

function getInitialFilters(searchParams) {
  return {
    search: searchParams.get('search') || '',
    isActive: searchParams.get('isActive') || '',
    recognitionMethod: searchParams.get('recognitionMethod') || '',
    examProgramId: searchParams.get('examProgramId') || '',
    sortBy: searchParams.get('sortBy') || 'code',
    sortOrder: searchParams.get('sortOrder') || 'asc',
  }
}

function LoadingRows() {
  return Array.from({ length: 5 }).map((_, index) => (
    <CTableRow key={`placeholder-${index}`}>
      {Array.from({ length: 8 }).map((__, cellIndex) => <CTableDataCell key={`placeholder-cell-${cellIndex}`}><CPlaceholder animation='glow' xs={cellIndex === 1 ? 8 : 6} /></CTableDataCell>)}
    </CTableRow>
  ))
}

export default function OutcomeStandardsTab() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const feature = useFeature()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [refreshToken, setRefreshToken] = useState(0)
  const [toastState, setToastState] = useState({ visible: false, color: 'success', message: '' })
  const [editorState, setEditorState] = useState({ open: false, mode: 'create', item: null, initialValues: buildOutcomeStandardFormValues() })
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmState, setConfirmState] = useState({ open: false, item: null, nextActive: true, error: '' })
  const [examProgramOptions, setExamProgramOptions] = useState([])
  const [pagination, setPagination] = useState({ page: Number(searchParams.get('page') || 1), pageSize: Number(searchParams.get('pageSize') || 10), total: 0, pageCount: 1 })
  const [filters, setFilters] = useState(() => getInitialFilters(searchParams))
  const [debouncedSearch, setDebouncedSearch] = useState(() => String(searchParams.get('search') || '').trim())
  const canManage = feature?.isLoading ? false : feature?.hasFeature?.('exam-round.manage') || false
  const { activeMutation, createOutcomeStandard, updateOutcomeStandard, setOutcomeStandardActive } = useOutcomeStandardMutations()
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(String(filters.search || '').trim()), 300)
    return () => window.clearTimeout(timer)
  }, [filters.search])

  useEffect(() => {
    let mounted = true
    async function loadExamProgramOptions() {
      try {
        const result = await listExamPrograms({ page: 1, pageSize: 100, isActive: 'true' })
        if (!mounted) return
        setExamProgramOptions((result?.rows || []).map((item) => ({ value: String(item.id || item.documentId || ''), label: `${item.code} - ${item.name}` })))
      } catch {
        if (mounted) setExamProgramOptions([])
      }
    }
    loadExamProgramOptions()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!toastState.visible) return undefined
    const timer = window.setTimeout(() => setToastState((current) => ({ ...current, visible: false })), 2500)
    return () => window.clearTimeout(timer)
  }, [toastState.visible])

  function syncUrl(nextPage, nextPageSize, nextFilters) {
    const params = new URLSearchParams()
    params.set('page', String(nextPage))
    params.set('pageSize', String(nextPageSize))
    Object.entries(nextFilters).forEach(([key, value]) => { if (value) params.set(key, value) })
    setSearchParams(params)
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await listOutcomeStandards({
          page: pagination.page,
          pageSize: pagination.pageSize,
          search: debouncedSearch,
          isActive: filters.isActive,
          recognitionMethod: filters.recognitionMethod,
          examProgramId: filters.examProgramId,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
        syncUrl(result?.pagination?.page || pagination.page, result?.pagination?.pageSize || pagination.pageSize, {
          search: debouncedSearch,
          isActive: filters.isActive,
          recognitionMethod: filters.recognitionMethod,
          examProgramId: filters.examProgramId,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(resolveOutcomeStandardReadError(requestError, 'Không tải được danh sách chuẩn đầu ra.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [debouncedSearch, filters.isActive, filters.recognitionMethod, filters.examProgramId, filters.sortBy, filters.sortOrder, pagination.page, pagination.pageSize, refreshToken])

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPagination((current) => ({ ...current, page: 1 }))
  }

  function resetFilters() {
    setFilters({ search: '', isActive: '', recognitionMethod: '', examProgramId: '', sortBy: 'code', sortOrder: 'asc' })
    setDebouncedSearch('')
    setPagination((current) => ({ ...current, page: 1 }))
  }

  function retryLoad() { setRefreshToken((current) => current + 1) }
  function openCreateModal() { setFormError(''); setFieldErrors({}); setEditorState({ open: true, mode: 'create', item: null, initialValues: buildOutcomeStandardFormValues({}, { mode: 'create' }) }) }
  function openEditModal(row) { setFormError(''); setFieldErrors({}); setEditorState({ open: true, mode: 'edit', item: row, initialValues: buildOutcomeStandardFormValues(row, { mode: 'edit' }) }) }
  function openCloneModal(row) { setFormError(''); setFieldErrors({}); setEditorState({ open: true, mode: 'clone', item: row, initialValues: buildOutcomeStandardFormValues(row, { mode: 'clone' }) }) }
  function closeEditor() { if (activeMutation) return; setEditorState((current) => ({ ...current, open: false })); setFormError(''); setFieldErrors({}) }
  function openStatusConfirm(row, nextActive) { setConfirmState({ open: true, item: row, nextActive, error: '' }) }
  function closeStatusConfirm() { if (activeMutation) return; setConfirmState({ open: false, item: null, nextActive: true, error: '' }) }

  async function handleFormSubmit(values) {
    setFormError('')
    setFieldErrors({})
    try {
      const targetId = editorState.item?.id || editorState.item?.documentId
      if (editorState.mode === 'edit' && targetId) {
        const payload = mapOutcomeStandardFormValuesToUpdatePayload(values, editorState.initialValues)
        if (Object.keys(payload).length === 0) { closeEditor(); return }
        await updateOutcomeStandard(targetId, payload)
        setToastState({ visible: true, color: 'success', message: 'Đã cập nhật chuẩn đầu ra.' })
        closeEditor()
        retryLoad()
        return
      }
      const created = await createOutcomeStandard(mapOutcomeStandardFormValuesToCreatePayload(values))
      setToastState({ visible: true, color: 'success', message: editorState.mode === 'clone' ? 'Đã tạo bản sao chuẩn đầu ra.' : 'Đã tạo chuẩn đầu ra mới.' })
      closeEditor()
      retryLoad()
      navigate(buildExamConfigurationDetailPath('outcomes', created?.id || created?.documentId, tenantCode))
    } catch (requestError) {
      const resolvedError = resolveOutcomeStandardMutationError(requestError, editorState.mode === 'edit' ? 'Không thể cập nhật chuẩn đầu ra.' : 'Không thể tạo chuẩn đầu ra.')
      setFormError(resolvedError.message)
      setFieldErrors(resolvedError.fieldErrors || {})
    }
  }

  async function handleStatusConfirm() {
    if (!confirmState.item) return
    try {
      await setOutcomeStandardActive(confirmState.item.id || confirmState.item.documentId, confirmState.nextActive)
      setToastState({ visible: true, color: 'success', message: confirmState.nextActive ? 'Đã kích hoạt lại chuẩn đầu ra.' : 'Đã ngừng sử dụng chuẩn đầu ra.' })
      closeStatusConfirm()
      retryLoad()
    } catch (requestError) {
      const resolvedError = resolveOutcomeStandardMutationError(requestError, confirmState.nextActive ? 'Không thể kích hoạt lại chuẩn đầu ra.' : 'Không thể ngừng sử dụng chuẩn đầu ra.')
      setConfirmState((current) => ({ ...current, error: resolvedError.message }))
    }
  }

  const rangeStart = rows.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0
  const rangeEnd = rows.length > 0 ? rangeStart + rows.length - 1 : 0
  const hasActiveFilters = Boolean(debouncedSearch || filters.isActive || filters.recognitionMethod || filters.examProgramId)

  return (
    <CCard>
      <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
        <div>
          <div className='fw-semibold'>Chuẩn đầu ra</div>
          <div className='small text-body-secondary'>Chuẩn đầu ra xác định chương trình, môn thi hoặc các điều kiện learner cần hoàn thành để được công nhận đạt chuẩn.</div>
        </div>
        <div className='d-flex align-items-center gap-2 flex-wrap'>
          <div className='small text-body-secondary'>Hiển thị {rangeStart}-{rangeEnd} / {pagination.total}</div>
          {canManage ? <CButton color='primary' onClick={openCreateModal} disabled={Boolean(activeMutation)}>Tạo chuẩn đầu ra</CButton> : null}
        </div>
      </CCardHeader>
      <CCardBody>
        <CAlert color='info'>Chuẩn đầu ra là cấu hình dùng để đánh giá và công nhận kết quả. Việc chỉnh sửa chuẩn đầu ra không tự động làm thay đổi dữ liệu đánh giá hoặc kết quả đã được ghi nhận trước đó.</CAlert>
        <CRow className='g-3 mb-3'>
          <CCol lg={4} md={6} xs={12}><CFormLabel>Tìm kiếm</CFormLabel><CFormInput placeholder='Tìm theo mã hoặc tên chuẩn' value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} /></CCol>
          <CCol lg={2} md={6} xs={12}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.isActive} onChange={(event) => updateFilter('isActive', event.target.value)}><option value=''>Tất cả</option><option value='true'>Đang hoạt động</option><option value='false'>Ngừng sử dụng</option></CFormSelect></CCol>
          <CCol lg={3} md={6} xs={12}><CFormLabel>Phương thức công nhận</CFormLabel><CFormSelect value={filters.recognitionMethod} onChange={(event) => updateFilter('recognitionMethod', event.target.value)}>{OUTCOME_RECOGNITION_METHOD_OPTIONS.map((item) => <option key={item.value || 'all'} value={item.value}>{item.label}</option>)}</CFormSelect></CCol>
          <CCol lg={3} md={6} xs={12}><CFormLabel>Chương trình thi</CFormLabel><CFormSelect value={filters.examProgramId} onChange={(event) => updateFilter('examProgramId', event.target.value)}><option value=''>Tất cả chương trình</option>{examProgramOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</CFormSelect></CCol>
          <CCol lg={4} md={6} xs={12}><CFormLabel>Sắp xếp</CFormLabel><CFormSelect value={`${filters.sortBy}:${filters.sortOrder}`} onChange={(event) => { const [sortBy, sortOrder] = String(event.target.value || 'code:asc').split(':'); setFilters((current) => ({ ...current, sortBy: sortBy || 'code', sortOrder: sortOrder || 'asc' })); setPagination((current) => ({ ...current, page: 1 })) }}>{OUTCOME_STANDARD_SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</CFormSelect></CCol>
        </CRow>
        <div className='d-flex gap-2 mb-3 flex-wrap'><CButton color='secondary' variant='outline' onClick={resetFilters}>Đặt lại bộ lọc</CButton><CButton color='secondary' variant='outline' onClick={retryLoad} disabled={loading}>Tải lại</CButton>{loading ? <div className='d-flex align-items-center gap-2 small text-body-secondary'><CSpinner size='sm' />Đang tải dữ liệu...</div> : null}</div>
        {error ? <CAlert color='danger' className='d-flex justify-content-between align-items-center flex-wrap gap-2'><span>{error}</span><CButton color='danger' variant='outline' size='sm' onClick={retryLoad}>Thử lại</CButton></CAlert> : null}
        <CTable responsive hover align='middle'>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Mã chuẩn</CTableHeaderCell>
              <CTableHeaderCell>Tên chuẩn</CTableHeaderCell>
              <CTableHeaderCell>Chương trình thi</CTableHeaderCell>
              <CTableHeaderCell>Phương thức công nhận</CTableHeaderCell>
              <CTableHeaderCell>Thời gian hiệu lực</CTableHeaderCell>
              <CTableHeaderCell>Trạng thái</CTableHeaderCell>
              <CTableHeaderCell>Cập nhật gần nhất</CTableHeaderCell>
              <CTableHeaderCell>Thao tác</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? <LoadingRows /> : null}
            {!loading && rows.length > 0 ? rows.map((row) => { const statusMeta = getOutcomeStatusMeta(row.isActive); return (
              <CTableRow key={row.id}>
                <CTableDataCell>{row.code || '-'}</CTableDataCell>
                <CTableDataCell><div className='fw-semibold'>{row.name || '-'}</div><div className='small text-body-secondary text-truncate' style={{ maxWidth: 320 }}>{row.applicableDescription || 'Chưa có mô tả phạm vi áp dụng.'}</div></CTableDataCell>
                <CTableDataCell>{row.examProgramName || 'Không gắn chương trình'}</CTableDataCell>
                <CTableDataCell>{getOutcomeRecognitionMethodLabel(row.recognitionMethod)}</CTableDataCell>
                <CTableDataCell>{formatOutcomeEffectiveDateRange(row)}</CTableDataCell>
                <CTableDataCell><span className={`badge text-bg-${statusMeta.color}`}>{statusMeta.label}</span></CTableDataCell>
                <CTableDataCell>{formatExamConfigDateTime(row.updatedAt)}</CTableDataCell>
                <CTableDataCell>
                  <CDropdown alignment='end'>
                    <CDropdownToggle color='secondary' variant='outline' size='sm' disabled={Boolean(activeMutation)}>Thao tác</CDropdownToggle>
                    <CDropdownMenu>
                      <CDropdownItem onClick={() => navigate(buildExamConfigurationDetailPath('outcomes', row.id, tenantCode))}>Xem chi tiết</CDropdownItem>
                      {canManage ? <CDropdownItem onClick={() => openEditModal(row)}>Chỉnh sửa</CDropdownItem> : null}
                      {canManage ? <CDropdownItem onClick={() => openCloneModal(row)}>Nhân bản</CDropdownItem> : null}
                      {canManage && row.isActive ? <CDropdownItem onClick={() => openStatusConfirm(row, false)}>Ngừng sử dụng</CDropdownItem> : null}
                      {canManage && !row.isActive ? <CDropdownItem onClick={() => openStatusConfirm(row, true)}>Kích hoạt lại</CDropdownItem> : null}
                    </CDropdownMenu>
                  </CDropdown>
                </CTableDataCell>
              </CTableRow>
            )}) : null}
            {!loading && rows.length === 0 ? <CTableRow><CTableDataCell colSpan={8} className='text-center text-body-secondary'>{hasActiveFilters ? 'Không tìm thấy chuẩn đầu ra phù hợp với bộ lọc hiện tại.' : 'Chưa có chuẩn đầu ra nào được cấu hình.'}</CTableDataCell></CTableRow> : null}
          </CTableBody>
        </CTable>
        <div className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
          <div className='small text-body-secondary'>Trang {pagination.page}/{pagination.pageCount} • Mỗi trang</div>
          <div className='d-flex align-items-center gap-2 flex-wrap'>
            <CFormSelect value={pagination.pageSize} onChange={(event) => setPagination((current) => ({ ...current, page: 1, pageSize: Number(event.target.value) || 10 }))} style={{ width: 96 }}>{[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}</CFormSelect>
            {pagination.pageCount > 1 ? <CPagination className='mb-0'><CPaginationItem disabled={pagination.page <= 1 || loading} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>{pages.map((page) => <CPaginationItem key={`${page}`} active={page === pagination.page} disabled={page === '...' || loading} onClick={() => typeof page === 'number' && setPagination((current) => ({ ...current, page }))}>{page}</CPaginationItem>)}<CPaginationItem disabled={pagination.page >= pagination.pageCount || loading} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem></CPagination> : null}
          </div>
        </div>
        <OutcomeStandardFormModal visible={editorState.open} mode={editorState.mode} initialValues={editorState.initialValues} examProgramOptions={examProgramOptions} onClose={closeEditor} onSubmit={handleFormSubmit} submitting={Boolean(activeMutation)} submitError={formError} fieldErrors={fieldErrors} />
        <OutcomeStandardStatusConfirmModal visible={confirmState.open} nextActive={confirmState.nextActive} error={confirmState.error} submitting={activeMutation === 'toggle-active'} onClose={closeStatusConfirm} onConfirm={handleStatusConfirm} />
        <CToaster placement='top-end'><CToast visible={toastState.visible} autohide delay={2500} color={toastState.color} onClose={() => setToastState((current) => ({ ...current, visible: false }))}><CToastBody>{toastState.message}</CToastBody></CToast></CToaster>
      </CCardBody>
    </CCard>
  )
}