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
import ExamComponentFormModal from './ExamComponentFormModal'
import ExamComponentStatusConfirmModal from './ExamComponentStatusConfirmModal'
import useExamComponentMutations from '../hooks/useExamComponentMutations'
import { getExamComponents } from '../services/examComponentApi'
import { useFeature } from '../../../contexts/FeatureContext'
import {
  buildExamComponentFormValues,
  mapExamComponentFormValuesToCreatePayload,
  mapExamComponentFormValuesToUpdatePayload,
} from '../utils/examComponentForm'
import {
  buildExamConfigurationDetailPath,
  formatExamScore,
  getApiMessage,
  getExamComponentTypeLabel,
  getExamMethodLabel,
  getExamStatusBadgeMeta,
  resolveExamComponentMutationError,
} from '../utils/examConfigurationUi'

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
    componentType: searchParams.get('componentType') || '',
    examMethod: searchParams.get('examMethod') || '',
    isActive: searchParams.get('isActive') || '',
  }
}

export default function ExamComponentsTab() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const feature = useFeature()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [refreshToken, setRefreshToken] = useState(0)
  const [toastState, setToastState] = useState({ visible: false, color: 'success', message: '' })
  const [editorState, setEditorState] = useState({ open: false, mode: 'create', item: null, initialValues: buildExamComponentFormValues() })
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmState, setConfirmState] = useState({ open: false, item: null, nextActive: true, error: '' })
  const [pagination, setPagination] = useState({
    page: Number(searchParams.get('page') || 1),
    pageSize: Number(searchParams.get('pageSize') || 10),
    total: 0,
    pageCount: 1,
  })
  const [filters, setFilters] = useState(() => getInitialFilters(searchParams))
  const [appliedFilters, setAppliedFilters] = useState(() => getInitialFilters(searchParams))
  const canManage = feature?.isLoading ? false : feature?.hasFeature?.('exam-round.manage') || false
  const { activeMutation, createExamComponent, updateExamComponent, setExamComponentActive } = useExamComponentMutations()

  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  function syncUrl(nextPage, nextPageSize, nextFilters) {
    const params = new URLSearchParams()
    params.set('page', String(nextPage))
    params.set('pageSize', String(nextPageSize))
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    setSearchParams(params)
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getExamComponents({
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...appliedFilters,
        })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
        syncUrl(result?.pagination?.page || pagination.page, result?.pagination?.pageSize || pagination.pageSize, appliedFilters)
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(getApiMessage(requestError, 'Không tải được danh sách kỹ năng thi.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [appliedFilters, pagination.page, pagination.pageSize, refreshToken])

  useEffect(() => {
    if (!canManage) return
    if (searchParams.get('action') !== 'create') return
    setEditorState({ open: true, mode: 'create', item: null, initialValues: buildExamComponentFormValues({}, { mode: 'create' }) })
    setFormError('')
    setFieldErrors({})
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('action')
    setSearchParams(nextParams, { replace: true })
  }, [canManage, searchParams, setSearchParams])

  useEffect(() => {
    if (!toastState.visible) return undefined
    const timer = window.setTimeout(() => setToastState((current) => ({ ...current, visible: false })), 2500)
    return () => window.clearTimeout(timer)
  }, [toastState.visible])

  function triggerReload() {
    setRefreshToken((current) => current + 1)
  }

  function openCreateModal() {
    setFormError('')
    setFieldErrors({})
    setEditorState({ open: true, mode: 'create', item: null, initialValues: buildExamComponentFormValues({}, { mode: 'create' }) })
  }

  function openEditModal(row) {
    setFormError('')
    setFieldErrors({})
    setEditorState({ open: true, mode: 'edit', item: row, initialValues: buildExamComponentFormValues(row, { mode: 'edit' }) })
  }

  function openCloneModal(row) {
    setFormError('')
    setFieldErrors({})
    setEditorState({ open: true, mode: 'clone', item: row, initialValues: buildExamComponentFormValues(row, { mode: 'clone' }) })
  }

  function closeEditor() {
    if (activeMutation) return
    setEditorState((current) => ({ ...current, open: false }))
    setFormError('')
    setFieldErrors({})
  }

  function openStatusConfirm(row, nextActive) {
    setConfirmState({ open: true, item: row, nextActive, error: '' })
  }

  function closeStatusConfirm() {
    if (activeMutation) return
    setConfirmState({ open: false, item: null, nextActive: true, error: '' })
  }

  async function handleFormSubmit(values) {
    setFormError('')
    setFieldErrors({})

    try {
      const targetId = editorState.item?.id || editorState.item?.documentId

      if (editorState.mode === 'edit' && targetId) {
        const payload = mapExamComponentFormValuesToUpdatePayload(values, editorState.initialValues)
        if (Object.keys(payload).length === 0) {
          closeEditor()
          return
        }
        await updateExamComponent(targetId, payload)
        setToastState({ visible: true, color: 'success', message: 'Đã cập nhật kỹ năng thi.' })
      } else {
        await createExamComponent(mapExamComponentFormValuesToCreatePayload(values))
        setToastState({ visible: true, color: 'success', message: editorState.mode === 'clone' ? 'Đã tạo bản sao kỹ năng thi.' : 'Đã tạo kỹ năng thi mới.' })
      }

      closeEditor()
      triggerReload()
    } catch (requestError) {
      const resolvedError = resolveExamComponentMutationError(requestError, editorState.mode === 'edit' ? 'Không thể cập nhật kỹ năng thi.' : 'Không thể tạo kỹ năng thi.')
      setFormError(resolvedError.message)
      setFieldErrors(resolvedError.fieldErrors || {})
    }
  }

  async function handleStatusConfirm() {
    if (!confirmState.item) return

    try {
      await setExamComponentActive(confirmState.item.id || confirmState.item.documentId, confirmState.nextActive)
      setToastState({
        visible: true,
        color: 'success',
        message: confirmState.nextActive ? 'Đã kích hoạt lại kỹ năng thi.' : 'Đã ngừng sử dụng kỹ năng thi.',
      })
      closeStatusConfirm()
      triggerReload()
    } catch (requestError) {
      const resolvedError = resolveExamComponentMutationError(requestError, confirmState.nextActive ? 'Không thể kích hoạt lại kỹ năng thi.' : 'Không thể ngừng sử dụng kỹ năng thi.')
      setConfirmState((current) => ({ ...current, error: resolvedError.message }))
    }
  }

  function applyFilters() {
    setPagination((prev) => ({ ...prev, page: 1 }))
    setAppliedFilters(filters)
  }

  function resetFilters() {
    const next = { search: '', componentType: '', examMethod: '', isActive: '' }
    setFilters(next)
    setAppliedFilters(next)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const rangeStart = rows.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0
  const rangeEnd = rows.length > 0 ? rangeStart + rows.length - 1 : 0

  return (
    <CCard>
      <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
        <div>
          <div className='fw-semibold'>Danh sách kỹ năng thi</div>
          <div className='small text-body-secondary'>Tra cứu kỹ năng hoặc phần thi đang được dùng làm đơn vị cấu hình nền cho môn thi và đợt thi.</div>
        </div>
        <div className='d-flex align-items-center gap-2 flex-wrap'>
          <div className='small text-body-secondary'>Hiển thị {rangeStart}-{rangeEnd} / {pagination.total}</div>
          {canManage ? <CButton color='primary' onClick={openCreateModal} disabled={Boolean(activeMutation)}>Tạo kỹ năng thi</CButton> : null}
        </div>
      </CCardHeader>
      <CCardBody>
        <CRow className='g-3 mb-3'>
          <CCol lg={4} md={6}>
            <CFormLabel>Tìm kiếm</CFormLabel>
            <CFormInput placeholder='Mã, tên hoặc mô tả kỹ năng thi' value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
          </CCol>
          <CCol lg={2} md={6}>
            <CFormLabel>Loại</CFormLabel>
            <CFormSelect value={filters.componentType} onChange={(event) => setFilters((prev) => ({ ...prev, componentType: event.target.value }))}>
              <option value=''>Tất cả</option>
              <option value='skill'>Kỹ năng</option>
              <option value='part'>Phần thi</option>
            </CFormSelect>
          </CCol>
          <CCol lg={3} md={6}>
            <CFormLabel>Phương thức thi</CFormLabel>
            <CFormSelect value={filters.examMethod} onChange={(event) => setFilters((prev) => ({ ...prev, examMethod: event.target.value }))}>
              <option value=''>Tất cả</option>
              <option value='computer'>Trên máy tính</option>
              <option value='paper'>Trên giấy</option>
              <option value='oral'>Vấn đáp</option>
              <option value='practical'>Thực hành</option>
              <option value='mixed'>Kết hợp</option>
              <option value='other'>Khác</option>
            </CFormSelect>
          </CCol>
          <CCol lg={3} md={6}>
            <CFormLabel>Trạng thái</CFormLabel>
            <CFormSelect value={filters.isActive} onChange={(event) => setFilters((prev) => ({ ...prev, isActive: event.target.value }))}>
              <option value=''>Tất cả</option>
              <option value='true'>Đang hoạt động</option>
              <option value='false'>Ngưng hoạt động</option>
            </CFormSelect>
          </CCol>
        </CRow>

        <div className='d-flex gap-2 mb-3 flex-wrap'>
          <CButton color='primary' onClick={applyFilters}>Lọc</CButton>
          <CButton color='secondary' variant='outline' onClick={resetFilters}>Đặt lại</CButton>
          <CButton color='secondary' variant='outline' onClick={triggerReload} disabled={loading}>Tải lại</CButton>
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải danh sách kỹ năng thi...</span>
          </div>
        ) : (
          <>
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Mã</CTableHeaderCell>
                  <CTableHeaderCell>Tên kỹ năng thi</CTableHeaderCell>
                  <CTableHeaderCell>Loại</CTableHeaderCell>
                  <CTableHeaderCell>Phương thức</CTableHeaderCell>
                  <CTableHeaderCell>Thang điểm</CTableHeaderCell>
                  <CTableHeaderCell>Thời lượng</CTableHeaderCell>
                  <CTableHeaderCell>Thứ tự</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length > 0 ? rows.map((row) => {
                  const statusMeta = getExamStatusBadgeMeta(row.isActive)
                  const canManageRow = canManage && row.componentType === 'skill'
                  return (
                    <CTableRow key={row.id}>
                      <CTableDataCell>{row.code || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{row.name || '-'}</div>
                        <div className='small text-body-secondary text-truncate' style={{ maxWidth: 320 }}>{row.description || 'Không có mô tả.'}</div>
                      </CTableDataCell>
                      <CTableDataCell>{getExamComponentTypeLabel(row.componentType)}</CTableDataCell>
                      <CTableDataCell>{getExamMethodLabel(row.examMethod)}</CTableDataCell>
                      <CTableDataCell>{formatExamScore(row.minimumScore)} - {formatExamScore(row.maximumScore)}</CTableDataCell>
                      <CTableDataCell>{row.defaultDurationMinutes ? `${row.defaultDurationMinutes} phút` : '-'}</CTableDataCell>
                      <CTableDataCell>{row.displayOrder ?? 0}</CTableDataCell>
                      <CTableDataCell><span className={`badge text-bg-${statusMeta.color}`}>{statusMeta.label}</span></CTableDataCell>
                      <CTableDataCell>
                        <CDropdown alignment='end'>
                          <CDropdownToggle color='secondary' variant='outline' size='sm' disabled={Boolean(activeMutation)}>Thao tác</CDropdownToggle>
                          <CDropdownMenu>
                            <CDropdownItem onClick={() => navigate(buildExamConfigurationDetailPath('components', row.id, tenantCode))}>Xem chi tiết</CDropdownItem>
                            {canManageRow ? <CDropdownItem onClick={() => openEditModal(row)}>Chỉnh sửa</CDropdownItem> : null}
                            {canManageRow ? <CDropdownItem onClick={() => openCloneModal(row)}>Nhân bản</CDropdownItem> : null}
                            {canManageRow && row.isActive ? <CDropdownItem onClick={() => openStatusConfirm(row, false)}>Ngừng sử dụng</CDropdownItem> : null}
                            {canManageRow && !row.isActive ? <CDropdownItem onClick={() => openStatusConfirm(row, true)}>Kích hoạt lại</CDropdownItem> : null}
                          </CDropdownMenu>
                        </CDropdown>
                      </CTableDataCell>
                    </CTableRow>
                  )
                }) : (
                  <CTableRow>
                    <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Chưa có kỹ năng thi nào phù hợp với bộ lọc hiện tại.</CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>

            <div className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
              <div className='small text-body-secondary'>Trang {pagination.page}/{pagination.pageCount} • Mỗi trang</div>
              <div className='d-flex align-items-center gap-2 flex-wrap'>
                <CFormSelect value={pagination.pageSize} onChange={(event) => setPagination((prev) => ({ ...prev, page: 1, pageSize: Number(event.target.value) || 10 }))} style={{ width: 96 }}>
                  {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </CFormSelect>
                {pagination.pageCount > 1 ? (
                  <CPagination className='mb-0'>
                    <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}>Trước</CPaginationItem>
                    {pages.map((page) => (
                      <CPaginationItem
                        key={`${page}`}
                        active={page === pagination.page}
                        disabled={page === '...'}
                        onClick={() => typeof page === 'number' && setPagination((prev) => ({ ...prev, page }))}
                      >
                        {page}
                      </CPaginationItem>
                    ))}
                    <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pageCount, prev.page + 1) }))}>Sau</CPaginationItem>
                  </CPagination>
                ) : null}
              </div>
            </div>
          </>
        )}
      </CCardBody>

      <ExamComponentFormModal
        visible={editorState.open}
        mode={editorState.mode}
        initialValues={editorState.initialValues}
        onClose={closeEditor}
        onSubmit={handleFormSubmit}
        submitting={Boolean(activeMutation)}
        submitError={formError}
        fieldErrors={fieldErrors}
      />

      <ExamComponentStatusConfirmModal
        visible={confirmState.open}
        nextActive={confirmState.nextActive}
        error={confirmState.error}
        submitting={activeMutation === 'toggle-active'}
        onClose={closeStatusConfirm}
        onConfirm={handleStatusConfirm}
      />

      <CToaster placement='top-end'>
        <CToast visible={toastState.visible} autohide delay={2500} color={toastState.color} onClose={() => setToastState((current) => ({ ...current, visible: false }))}>
          <CToastBody>{toastState.message}</CToastBody>
        </CToast>
      </CToaster>
    </CCard>
  )
}