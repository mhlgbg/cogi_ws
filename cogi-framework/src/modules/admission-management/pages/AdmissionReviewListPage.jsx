import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormCheck,
  CCol,
  CFormInput,
  CFormSelect,
  CModal,
  CModalBody,
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
import AdmissionReviewAccountModal from '../components/AdmissionReviewAccountModal'
import {
  exportAdmissionReviewList,
  getAdmissionReviewFormData,
  getAdmissionReviewList,
  getAdmissionReviewSnapshot,
  rebuildAdmissionReviewSnapshot,
  updateAdmissionReviewAccount,
} from '../services/admissionManagementService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function getReviewStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'draft') return 'Nháp'
  if (normalized === 'submitted') return 'Chờ duyệt'
  if (normalized === 'returned') return 'Trả lại'
  if (normalized === 'accepted') return 'Đã tiếp nhận'
  return normalized || '-'
}

function getReviewStatusColor(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'draft') return 'secondary'
  if (normalized === 'submitted') return 'warning'
  if (normalized === 'returned') return 'danger'
  if (normalized === 'accepted') return 'success'
  return 'secondary'
}

function getApprovalAcknowledgementBadge(item) {
  const admissionStatus = String(item?.admissionStatus || '').trim().toLowerCase()
  if (admissionStatus !== 'approved') {
    return { color: 'secondary', label: 'Không áp dụng' }
  }

  if (item?.approvedAcknowledgedAt) {
    return { color: 'success', label: `Đã xác nhận lúc ${formatDate(item.approvedAcknowledgedAt)}` }
  }

  return { color: 'warning', label: 'Chưa xác nhận' }
}

function buildPages(currentPage, pageCount) {
  const pages = []
  const maxButtons = 5

  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }

  const left = Math.max(2, currentPage - 1)
  const right = Math.min(pageCount - 1, currentPage + 1)

  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

export default function AdmissionReviewListPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [rows, setRows] = useState([])
  const [statusFilter, setStatusFilter] = useState('submitted')
  const [keywordDraft, setKeywordDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pageCount, setPageCount] = useState(1)
  const [total, setTotal] = useState(0)
  const [approvalAckFilter, setApprovalAckFilter] = useState('all')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [sortBy, setSortBy] = useState('submittedAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [exportingVariant, setExportingVariant] = useState('')
  const [accountModalVisible, setAccountModalVisible] = useState(false)
  const [accountSubmitting, setAccountSubmitting] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [editingRow, setEditingRow] = useState(null)
  const [refreshingSnapshotId, setRefreshingSnapshotId] = useState(null)
  const [snapshotModalVisible, setSnapshotModalVisible] = useState(false)
  const [snapshotViewingRow, setSnapshotViewingRow] = useState(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState('')
  const [snapshotData, setSnapshotData] = useState(null)
  const [formDataModalVisible, setFormDataModalVisible] = useState(false)
  const [formDataViewingRow, setFormDataViewingRow] = useState(null)
  const [formDataLoading, setFormDataLoading] = useState(false)
  const [formDataError, setFormDataError] = useState('')
  const [reviewFormData, setReviewFormData] = useState(null)

  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])
  const fromToText = useMemo(() => {
    if (total === 0) return '0'
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    return `${from}-${to}/${total}`
  }, [page, pageSize, total])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await getAdmissionReviewList({
        status: statusFilter,
        approvalAckStatus: approvalAckFilter,
        includeDeleted,
        q: keyword || undefined,
        page,
        pageSize,
        sortBy,
        sortOrder,
      })

      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setTotal(Number(result?.pagination?.total || 0))
      setPage(Number(result?.pagination?.page || page))
      setPageSize(Number(result?.pagination?.pageSize || pageSize))
      setPageCount(Math.max(1, Number(result?.pagination?.pageCount || 1)))
    } catch (requestError) {
      setRows([])
      setTotal(0)
      setPageCount(1)
      setError(getApiMessage(requestError, 'Không tải được danh sách hồ sơ chờ duyệt'))
    } finally {
      setLoading(false)
    }
  }, [approvalAckFilter, includeDeleted, keyword, page, pageSize, sortBy, sortOrder, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  function applySearch() {
    setPage(1)
    setSuccessMessage('')
    setKeyword(String(keywordDraft || '').trim())
  }

  function resetFilters() {
    setStatusFilter('submitted')
    setApprovalAckFilter('all')
    setIncludeDeleted(false)
    setKeywordDraft('')
    setKeyword('')
    setPage(1)
    setSortBy('submittedAt')
    setSortOrder('desc')
    setSuccessMessage('')
  }

  function toggleApplicationCodeSort() {
    setPage(1)
    setSortBy((currentSortBy) => {
      if (currentSortBy !== 'applicationCode') {
        setSortOrder('asc')
        return 'applicationCode'
      }

      setSortOrder((currentSortOrder) => (currentSortOrder === 'asc' ? 'desc' : 'asc'))
      return currentSortBy
    })
  }

  function toggleTimeSort(field) {
    setPage(1)
    setSortBy((currentSortBy) => {
      if (currentSortBy !== field) {
        setSortOrder('desc')
        return field
      }

      setSortOrder((currentSortOrder) => (currentSortOrder === 'desc' ? 'asc' : 'desc'))
      return currentSortBy
    })
  }

  const applicationCodeSortIndicator = sortBy === 'applicationCode'
    ? (sortOrder === 'asc' ? ' ↑' : ' ↓')
    : ''
  const submittedAtSortIndicator = sortBy === 'submittedAt'
    ? (sortOrder === 'asc' ? ' ↑' : ' ↓')
    : ''
  const reviewedAtSortIndicator = sortBy === 'reviewedAt'
    ? (sortOrder === 'asc' ? ' ↑' : ' ↓')
    : ''

  function openAccountModal(row) {
    setEditingRow(row)
    setAccountError('')
    setAccountModalVisible(true)
  }

  function closeAccountModal() {
    if (accountSubmitting) return
    setAccountModalVisible(false)
    setEditingRow(null)
    setAccountError('')
  }

  async function openSnapshotModal(row) {
    setSnapshotViewingRow(row)
    setSnapshotModalVisible(true)
    setSnapshotLoading(true)
    setSnapshotError('')
    setSnapshotData(null)

    try {
      const result = await getAdmissionReviewSnapshot(row.id)
      setSnapshotData(result)
    } catch (requestError) {
      setSnapshotError(getApiMessage(requestError, 'Không tải được dữ liệu snapshot'))
    } finally {
      setSnapshotLoading(false)
    }
  }

  function closeSnapshotModal() {
    if (refreshingSnapshotId) return
    setSnapshotModalVisible(false)
    setSnapshotViewingRow(null)
    setSnapshotError('')
    setSnapshotData(null)
  }

  async function openFormDataModal(row) {
    setFormDataViewingRow(row)
    setFormDataModalVisible(true)
    setFormDataLoading(true)
    setFormDataError('')
    setReviewFormData(null)

    try {
      const result = await getAdmissionReviewFormData(row.id)
      setReviewFormData(result)
    } catch (requestError) {
      setFormDataError(getApiMessage(requestError, 'Không tải được formData'))
    } finally {
      setFormDataLoading(false)
    }
  }

  function closeFormDataModal() {
    if (refreshingSnapshotId) return
    setFormDataModalVisible(false)
    setFormDataViewingRow(null)
    setFormDataError('')
    setReviewFormData(null)
  }

  async function handleRefreshSnapshot(row) {
    if (!row?.id) return

    setRefreshingSnapshotId(row.id)
    setError('')
    setSuccessMessage('')

    try {
      const updated = await rebuildAdmissionReviewSnapshot(row.id)
      setRows((currentRows) => currentRows.map((entry) => (entry.id === row.id ? { ...entry, ...updated } : entry)))
      setSnapshotViewingRow((currentRow) => (currentRow?.id === row.id ? { ...currentRow, ...updated } : currentRow))
      setSnapshotData((currentSnapshot) => (currentSnapshot && currentSnapshot.id === row.id
        ? {
            ...currentSnapshot,
            applicationCode: updated?.applicationCode || currentSnapshot.applicationCode,
            reviewSnapshot: updated?.reviewSnapshot ?? null,
          }
        : currentSnapshot))
      setSuccessMessage(`Đã làm mới snapshot cho hồ sơ ${updated?.applicationCode || row.applicationCode || row.id}`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không làm mới được snapshot'))
    } finally {
      setRefreshingSnapshotId(null)
    }
  }

  async function handleAccountSubmit(payload) {
    if (!editingRow?.id) return

    setAccountSubmitting(true)
    setAccountError('')

    try {
      await updateAdmissionReviewAccount(editingRow.id, payload)
      setSuccessMessage('Đã cập nhật thông tin tài khoản phụ huynh')
      setAccountModalVisible(false)
      setEditingRow(null)
      await loadData()
    } catch (requestError) {
      setAccountError(getApiMessage(requestError, 'Không cập nhật được thông tin tài khoản phụ huynh'))
    } finally {
      setAccountSubmitting(false)
    }
  }

  async function handleExportExcel(variant = 'expanded') {
    setExportingVariant(variant)
    setError('')

    try {
      const result = await exportAdmissionReviewList({
        status: statusFilter,
        approvalAckStatus: approvalAckFilter,
        includeDeleted,
        q: keyword || undefined,
        variant,
      })

      const blob = result?.blob instanceof Blob
        ? result.blob
        : new Blob([result?.blob], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result?.fileName || 'admission-reviews.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xuất được danh sách hồ sơ'))
    } finally {
      setExportingVariant('')
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
            <strong>Duyệt hồ sơ tuyển sinh</strong>
            <div className='d-flex align-items-center gap-2 flex-wrap'>
              <CButton color='secondary' variant='outline' onClick={() => handleExportExcel('legacy')} disabled={loading || Boolean(exportingVariant)}>
                {exportingVariant === 'legacy' ? 'Đang xuất Excel cũ...' : 'Xuất Excel cũ'}
              </CButton>
              <CButton color='info' variant='outline' onClick={() => handleExportExcel('review-summary')} disabled={loading || Boolean(exportingVariant)}>
                {exportingVariant === 'review-summary' ? 'Đang xuất Excel xét duyệt...' : 'Xuất Excel xét duyệt'}
              </CButton>
              <CButton color='success' variant='outline' onClick={() => handleExportExcel('expanded')} disabled={loading || Boolean(exportingVariant)}>
                {exportingVariant === 'expanded' ? 'Đang xuất Excel mở rộng...' : 'Xuất Excel mở rộng'}
              </CButton>
              <div className='text-body-secondary small'>{fromToText}</div>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={5}>
                <CFormInput
                  placeholder='Tìm theo mã hồ sơ, mã học sinh, học sinh, phụ huynh, SĐT, email'
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={2}>
                <CFormSelect value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
                  <option value='all'>Tất cả</option>
                  <option value='draft'>Nháp</option>
                  <option value='submitted'>Chờ duyệt</option>
                  <option value='returned'>Trả lại</option>
                  <option value='accepted'>Đã tiếp nhận</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={approvalAckFilter} onChange={(event) => { setApprovalAckFilter(event.target.value); setPage(1) }}>
                  <option value='all'>Xác nhận PH: Tất cả</option>
                  <option value='acknowledged'>Đã xác nhận</option>
                  <option value='pending'>Chưa xác nhận</option>
                </CFormSelect>
              </CCol>
              <CCol md={2} className='d-flex align-items-center'>
                <CFormCheck
                  id='admission-review-include-deleted'
                  label='Hiển thị hồ sơ đã xóa'
                  checked={includeDeleted}
                  onChange={(event) => {
                    setIncludeDeleted(event.target.checked)
                    setPage(1)
                  }}
                />
              </CCol>
              <CCol md={1}>
                <CFormSelect value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value) || 10) }}>
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </CFormSelect>
              </CCol>
              <CCol md={2} className='d-flex gap-2'>
                <CButton color='primary' className='w-100' onClick={applySearch} disabled={loading}>Lọc</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            {successMessage ? <CAlert color='success'>{successMessage}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>
                        <button
                          type='button'
                          className='btn btn-link p-0 text-decoration-none fw-semibold'
                          onClick={toggleApplicationCodeSort}
                        >
                          Mã hồ sơ{applicationCodeSortIndicator}
                        </button>
                      </CTableHeaderCell>
                      <CTableHeaderCell>Học sinh</CTableHeaderCell>
                      <CTableHeaderCell>Phụ huynh</CTableHeaderCell>
                      <CTableHeaderCell>
                        <button
                          type='button'
                          className='btn btn-link p-0 text-decoration-none fw-semibold'
                          onClick={() => toggleTimeSort('submittedAt')}
                        >
                          Ngày nộp{submittedAtSortIndicator}
                        </button>
                      </CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Người duyệt</CTableHeaderCell>
                      <CTableHeaderCell>
                        <button
                          type='button'
                          className='btn btn-link p-0 text-decoration-none fw-semibold'
                          onClick={() => toggleTimeSort('reviewedAt')}
                        >
                          Thời gian duyệt{reviewedAtSortIndicator}
                        </button>
                      </CTableHeaderCell>
                      <CTableHeaderCell>Xác nhận PH</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length > 0 ? rows.map((item) => (
                      <CTableRow key={item.id} style={item?.isDeleted ? { opacity: 0.65, backgroundColor: 'rgba(108, 117, 125, 0.08)' } : undefined}>
                        <CTableDataCell>{item.applicationCode || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='fw-semibold'>{item.studentName || '-'}</div>
                          <div className='small text-body-secondary'>{item?.campaign?.name || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div>{item?.parent?.fullName || item?.parent?.username || '-'}</div>
                          <div className='small text-body-secondary'>SĐT: {item?.parent?.phone || '-'}</div>
                          <div className='small text-body-secondary'>Email: {item?.parent?.email || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>{formatDate(item.submittedAt || item.createdAt)}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={getReviewStatusColor(item.reviewStatus)}>{getReviewStatusLabel(item.reviewStatus)}</CBadge>
                          {item?.isDeleted ? <CBadge color='dark' className='ms-2'>Đã xóa</CBadge> : null}
                        </CTableDataCell>
                        <CTableDataCell>{item?.reviewedBy?.fullName || item?.reviewedBy?.username || '-'}</CTableDataCell>
                        <CTableDataCell>{formatDate(item.reviewedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={getApprovalAcknowledgementBadge(item).color}>{getApprovalAcknowledgementBadge(item).label}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell className='text-end'>
                          <div className='d-inline-flex gap-2 flex-wrap justify-content-end'>
                            <CButton size='sm' color='warning' variant='outline' onClick={() => openAccountModal(item)} disabled={item?.isDeleted}>
                              Đổi thông tin tài khoản
                            </CButton>
                            <CButton
                              size='sm'
                              color='info'
                              variant='outline'
                              onClick={() => openSnapshotModal(item)}
                            >
                              Xem snapshot
                            </CButton>
                            <CButton
                              size='sm'
                              color='dark'
                              variant='outline'
                              onClick={() => openFormDataModal(item)}
                            >
                              Xem formData
                            </CButton>
                            <CButton
                              size='sm'
                              color='success'
                              variant='outline'
                              onClick={() => handleRefreshSnapshot(item)}
                              disabled={refreshingSnapshotId === item.id || item?.isDeleted}
                            >
                              {refreshingSnapshotId === item.id ? 'Đang làm mới...' : 'Làm mới'}
                            </CButton>
                            <CButton size='sm' color='primary' variant='outline' onClick={() => window.open(`/admission/reviews/${item.id}`, '_blank', 'noopener,noreferrer')}>
                              Xem hồ sơ
                            </CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    )) : (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Không có hồ sơ phù hợp</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>

                <div className='d-flex justify-content-between align-items-center flex-wrap gap-3 mt-3'>
                  <div className='text-body-secondary small'>Hiển thị {fromToText}</div>
                  <CPagination align='end' className='mb-0'>
                    <CPaginationItem disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => typeof item === 'string'
                      ? <CPaginationItem key={`dots-${index}`} disabled>…</CPaginationItem>
                      : <CPaginationItem key={item} active={item === page} disabled={loading} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pageCount || loading} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <AdmissionReviewAccountModal
        visible={accountModalVisible}
        submitting={accountSubmitting}
        initialValues={{
          fullName: editingRow?.parent?.fullName || '',
          email: editingRow?.parent?.email || '',
          phone: editingRow?.parent?.phone || '',
        }}
        error={accountError}
        onClose={closeAccountModal}
        onSubmit={handleAccountSubmit}
      />

      <CModal visible={snapshotModalVisible} size='xl' alignment='center' onClose={closeSnapshotModal}>
        <CModalHeader>
          <CModalTitle>Snapshot hồ sơ {snapshotViewingRow?.applicationCode || ''}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {snapshotLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Đang tải snapshot...</span>
            </div>
          ) : snapshotError ? (
            <CAlert color='danger' className='mb-0'>{snapshotError}</CAlert>
          ) : snapshotData?.reviewSnapshot ? (
            <pre className='mb-0 small' style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '70vh', overflow: 'auto' }}>
              {JSON.stringify(snapshotData.reviewSnapshot, null, 2)}
            </pre>
          ) : (
            <CAlert color='warning' className='mb-0'>Hồ sơ này chưa có dữ liệu snapshot.</CAlert>
          )}
        </CModalBody>
      </CModal>

      <CModal visible={formDataModalVisible} size='xl' alignment='center' onClose={closeFormDataModal}>
        <CModalHeader>
          <CModalTitle>FormData hồ sơ {formDataViewingRow?.applicationCode || ''}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {formDataLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Đang tải formData...</span>
            </div>
          ) : formDataError ? (
            <CAlert color='danger' className='mb-0'>{formDataError}</CAlert>
          ) : reviewFormData?.formData ? (
            <pre className='mb-0 small' style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '70vh', overflow: 'auto' }}>
              {JSON.stringify(reviewFormData.formData, null, 2)}
            </pre>
          ) : (
            <CAlert color='warning' className='mb-0'>Hồ sơ này chưa có formData.</CAlert>
          )}
        </CModalBody>
      </CModal>
    </CRow>
  )
}
