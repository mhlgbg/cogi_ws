import { useEffect, useMemo, useState } from 'react'
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
  CProgress,
  CProgressBar,
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
  deleteTenantStorageFile,
  getApiMessage,
  getTenantStorageFiles,
  getTenantStorageSummary,
  restoreTenantStorageFile,
  uploadTenantStorageFile,
} from '../services/tenantStorageService'

const MODULE_OPTIONS = [
  { value: 'media', label: 'media' },
  { value: 'articles', label: 'articles' },
  { value: 'admissions', label: 'admissions' },
  { value: 'surveys', label: 'surveys' },
  { value: 'lms', label: 'lms' },
  { value: 'avatars', label: 'avatars' },
]

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

function formatBytes(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let current = size
  let unitIndex = 0
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024
    unitIndex += 1
  }

  const digits = current >= 100 || unitIndex === 0 ? 0 : 2
  return `${current.toFixed(digits)} ${units[unitIndex]}`
}

function formatDateTime(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'
  return new Date(timestamp).toLocaleString('vi-VN')
}

function getStatusBadgeColor(status) {
  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'ACTIVE') return 'success'
  if (normalized === 'DELETED') return 'danger'
  if (normalized === 'ARCHIVED') return 'warning'
  return 'secondary'
}

export default function TenantStorageManagerPage() {
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [actionId, setActionId] = useState('')
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, pageCount: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [keywordDraft, setKeywordDraft] = useState('')
  const [moduleKey, setModuleKey] = useState('')
  const [moduleKeyDraft, setModuleKeyDraft] = useState('')
  const [status, setStatus] = useState('')
  const [statusDraft, setStatusDraft] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadModuleKey, setUploadModuleKey] = useState('media')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const pages = useMemo(() => buildPages(page, pagination.pageCount || 1), [page, pagination.pageCount])

  const fromToText = useMemo(() => {
    if (!pagination?.total) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, pagination.total)
    return `${from}–${to}/${pagination.total}`
  }, [pagination])

  async function loadSummary() {
    setSummaryLoading(true)
    try {
      const nextSummary = await getTenantStorageSummary()
      setSummary(nextSummary)
    } finally {
      setSummaryLoading(false)
    }
  }

  async function loadFiles() {
    setListLoading(true)
    try {
      const result = await getTenantStorageFiles({
        page,
        pageSize,
        keyword,
        moduleKey,
        status,
      })
      setRows(result.data || [])
      setPagination(result.pagination || { page: 1, pageSize, pageCount: 1, total: 0 })
    } finally {
      setListLoading(false)
    }
  }

  async function loadAll() {
    setError('')
    try {
      await Promise.all([loadSummary(), loadFiles()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được dữ liệu storage'))
    }
  }

  useEffect(() => {
    loadAll()
  }, [page, pageSize, keyword, moduleKey, status])

  function applySearch() {
    setPage(1)
    setKeyword(keywordDraft.trim())
    setModuleKey(moduleKeyDraft)
    setStatus(statusDraft)
  }

  function resetFilters() {
    setPage(1)
    setKeyword('')
    setKeywordDraft('')
    setModuleKey('')
    setModuleKeyDraft('')
    setStatus('')
    setStatusDraft('')
  }

  async function handleUpload() {
    if (!uploadFile) {
      setError('Vui lòng chọn file để upload')
      setSuccess('')
      return
    }

    if (!uploadModuleKey) {
      setError('Vui lòng chọn moduleKey')
      setSuccess('')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      await uploadTenantStorageFile({
        file: uploadFile,
        moduleKey: uploadModuleKey,
        isPublic: true,
      })
      setUploadFile(null)
      setSuccess('Upload file thành công')
      await loadAll()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể upload file vào storage'))
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(item) {
    if (!item?.id) return
    if (!window.confirm(`Xóa mềm file ${item.originalName || item.fileName || `#${item.id}`} ?`)) return

    setActionId(`delete:${item.id}`)
    setError('')
    setSuccess('')

    try {
      await deleteTenantStorageFile(item.id)
      setSuccess('Đã xóa mềm file')
      await loadAll()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xóa file'))
    } finally {
      setActionId('')
    }
  }

  async function handleRestore(item) {
    if (!item?.id) return

    setActionId(`restore:${item.id}`)
    setError('')
    setSuccess('')

    try {
      await restoreTenantStorageFile(item.id)
      setSuccess('Đã khôi phục file')
      await loadAll()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể khôi phục file'))
    } finally {
      setActionId('')
    }
  }

  async function handleCopyUrl(item) {
    const url = String(item?.resolvedUrl || item?.url || '').trim()
    if (!url) {
      setError('File này chưa có URL hợp lệ')
      setSuccess('')
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setSuccess('Đã copy URL')
      setError('')
    } catch {
      setError('Không thể copy URL')
      setSuccess('')
    }
  }

  function handleOpenFile(item) {
    const url = String(item?.resolvedUrl || item?.url || '').trim()
    if (!url) {
      setError('File này chưa có URL hợp lệ')
      setSuccess('')
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        {success ? <CAlert color='success' className='mb-4'>{success}</CAlert> : null}
        {error ? <CAlert color='danger' className='mb-4'>{error}</CAlert> : null}

        <CCard className='mb-4 ai-card'>
          <CCardHeader>
            <strong>Tổng quan lưu trữ</strong>
          </CCardHeader>
          <CCardBody>
            {summaryLoading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải tổng quan lưu trữ...</span>
              </div>
            ) : (
              <CRow className='g-3'>
                <CCol md={4} xl={2}>
                  <div className='border rounded-3 p-3 h-100'>
                    <div className='small text-body-secondary'>Provider</div>
                    <div className='fw-semibold text-uppercase'>{summary?.provider || 'local'}</div>
                  </div>
                </CCol>
                <CCol md={4} xl={2}>
                  <div className='border rounded-3 p-3 h-100'>
                    <div className='small text-body-secondary'>Đã dùng / quota</div>
                    <div className='fw-semibold'>{formatBytes(summary?.usedBytes || 0)} / {Number(summary?.quotaGB || 0)} GB</div>
                  </div>
                </CCol>
                <CCol md={4} xl={2}>
                  <div className='border rounded-3 p-3 h-100'>
                    <div className='small text-body-secondary'>Số file</div>
                    <div className='fw-semibold'>{summary?.fileCount || 0}</div>
                  </div>
                </CCol>
                <CCol md={4} xl={2}>
                  <div className='border rounded-3 p-3 h-100'>
                    <div className='small text-body-secondary'>File active</div>
                    <div className='fw-semibold'>{summary?.activeFileCount || 0}</div>
                  </div>
                </CCol>
                <CCol md={4} xl={2}>
                  <div className='border rounded-3 p-3 h-100'>
                    <div className='small text-body-secondary'>File đã xóa</div>
                    <div className='fw-semibold'>{summary?.deletedFileCount || 0}</div>
                  </div>
                </CCol>
                <CCol md={8} xl={12}>
                  <div className='border rounded-3 p-3 h-100'>
                    <div className='d-flex justify-content-between align-items-center gap-2 mb-2'>
                      <div className='small text-body-secondary'>Mức sử dụng dung lượng</div>
                      <div className='fw-semibold'>{Number(summary?.percentUsed || 0).toFixed(2)}%</div>
                    </div>
                    <CProgress height={16}>
                      <CProgressBar value={Math.min(100, Number(summary?.percentUsed || 0))} color={Number(summary?.percentUsed || 0) >= 90 ? 'danger' : 'primary'} />
                    </CProgress>
                  </div>
                </CCol>
              </CRow>
            )}
          </CCardBody>
        </CCard>

        <CCard className='mb-4 ai-card'>
          <CCardHeader>
            <strong>Upload thử</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 align-items-end'>
              <CCol md={5}>
                <CFormLabel htmlFor='tenant-storage-upload-file'>Chọn file</CFormLabel>
                <CFormInput
                  id='tenant-storage-upload-file'
                  type='file'
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  disabled={uploading}
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel htmlFor='tenant-storage-upload-module'>moduleKey</CFormLabel>
                <CFormSelect
                  id='tenant-storage-upload-module'
                  value={uploadModuleKey}
                  onChange={(event) => setUploadModuleKey(event.target.value)}
                  disabled={uploading}
                >
                  {MODULE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={3}>
                <CButton color='primary' className='w-100' onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Đang upload...' : 'Upload'}
                </CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CCard className='mb-4 ai-card'>
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 ai-form align-items-end'>
              <CCol md={4}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo tên file, đường dẫn, URL...'
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={3}>
                <CFormLabel htmlFor='tenant-storage-filter-module'>moduleKey</CFormLabel>
                <CFormSelect id='tenant-storage-filter-module' value={moduleKeyDraft} onChange={(event) => setModuleKeyDraft(event.target.value)}>
                  <option value=''>Tất cả</option>
                  {MODULE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={3}>
                <CFormLabel htmlFor='tenant-storage-filter-status'>Status</CFormLabel>
                <CFormSelect id='tenant-storage-filter-status' value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                  <option value=''>Tất cả</option>
                  <option value='ACTIVE'>ACTIVE</option>
                  <option value='DELETED'>DELETED</option>
                  <option value='ARCHIVED'>ARCHIVED</option>
                </CFormSelect>
              </CCol>
              <CCol md={2} className='d-flex gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={listLoading}>Tìm kiếm</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={listLoading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CCard className='ai-card'>
          <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
            <strong>Danh sách FileAsset</strong>
            <div className='text-body-secondary small'>{fromToText}</div>
          </CCardHeader>
          <CCardBody>
            {listLoading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải danh sách file...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive className='mb-3 ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Tên file gốc</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 120 }}>Module</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Mime type</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 120 }}>Size</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 100 }}>Provider</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 120 }}>Status</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 220 }}>URL</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Ngày tạo</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 260 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item) => {
                      const deleteKey = `delete:${item.id}`
                      const restoreKey = `restore:${item.id}`
                      return (
                        <CTableRow key={item.id}>
                          <CTableDataCell>
                            <div className='d-flex flex-column gap-1'>
                              <strong>{item.originalName || item.fileName || '-'}</strong>
                              <span className='small text-body-secondary'>{item.fileName || '-'}</span>
                            </div>
                          </CTableDataCell>
                          <CTableDataCell>{item.moduleKey || '-'}</CTableDataCell>
                          <CTableDataCell>{item.mimeType || '-'}</CTableDataCell>
                          <CTableDataCell>{formatBytes(item.size)}</CTableDataCell>
                          <CTableDataCell className='text-uppercase'>{item.provider || '-'}</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={getStatusBadgeColor(item.status)}>{item.status || '-'}</CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <div className='small text-body-secondary text-break'>{item.url || '-'}</div>
                          </CTableDataCell>
                          <CTableDataCell>{formatDateTime(item.createdAt)}</CTableDataCell>
                          <CTableDataCell>
                            <div className='d-flex gap-2 flex-wrap'>
                              <CButton size='sm' color='primary' variant='outline' onClick={() => handleOpenFile(item)}>
                                Mở file
                              </CButton>
                              <CButton size='sm' color='secondary' variant='outline' onClick={() => handleCopyUrl(item)}>
                                Copy URL
                              </CButton>
                              {item.status === 'DELETED' ? (
                                <CButton size='sm' color='success' variant='outline' onClick={() => handleRestore(item)} disabled={actionId === restoreKey}>
                                  {actionId === restoreKey ? 'Đang xử lý...' : 'Khôi phục'}
                                </CButton>
                              ) : (
                                <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item)} disabled={actionId === deleteKey}>
                                  {actionId === deleteKey ? 'Đang xử lý...' : 'Xóa mềm'}
                                </CButton>
                              )}
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>

                <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                  <div className='d-flex align-items-center gap-2 ai-form'>
                    <span>Page size</span>
                    <CFormInput
                      type='number'
                      min='1'
                      step='1'
                      value={pageSize}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value)
                        setPage(1)
                        setPageSize(Number.isInteger(nextValue) && nextValue > 0 ? nextValue : 10)
                      }}
                      style={{ width: 100 }}
                    />
                  </div>

                  <CPagination align='end' className='mb-0'>
                    <CPaginationItem disabled={page <= 1 || listLoading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => item === '...'
                      ? <CPaginationItem key={`dots-${index}`} disabled>…</CPaginationItem>
                      : <CPaginationItem key={item} active={item === page} disabled={listLoading} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= (pagination.pageCount || 1) || listLoading} onClick={() => setPage((prev) => Math.min(pagination.pageCount || 1, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}