import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCol,
  CFormSelect,
  CFormInput,
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
import { downloadSportsProfileImportTemplate, listSportsProfiles, previewSportsProfileImport, confirmSportsProfileImport } from '../services/sportsProfileService'
import {
  formatSportsBirthDateOrYear,
  GENDER_OPTIONS,
  getLinkedUserLabel,
  getSportsProfileGenderLabel,
  getSportsProfileStatusMeta,
  STATUS_OPTIONS,
} from '../utils/sportsProfileUi'

function buildPages(currentPage, pageCount) {
  const pages = []
  if (pageCount <= 7) {
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

export default function SportsProfilesPage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '', gender: '', hasUser: '' })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', status: '', gender: '', hasUser: '' })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await listSportsProfiles({ page: pagination.page, pageSize: pagination.pageSize, sort: 'updatedAt:desc', ...appliedFilters })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(requestError?.response?.data?.error?.message || requestError?.message || 'Không tải được danh sách hồ sơ thể thao.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [appliedFilters, pagination.page, pagination.pageSize])

  const basePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/profiles` : '/sports/profiles'

  function resetFilters() {
    const next = { search: '', status: '', gender: '', hasUser: '' }
    setFilters(next)
    setAppliedFilters(next)
    setPagination((current) => ({ ...current, page: 1 }))
  }

  async function handleDownloadTemplate() {
    try {
      await downloadSportsProfileImportTemplate()
    } catch (requestError) {
      setImportError(requestError?.response?.data?.error?.message || requestError?.message || 'Không thể tải mẫu Excel.')
    }
  }

  async function handlePreviewImport() {
    if (!importFile) {
      setImportError('Vui lòng chọn file Excel để xem trước.')
      return
    }

    setImporting(true)
    setImportError('')
    setImportSuccess('')
    try {
      const result = await previewSportsProfileImport(importFile)
      setImportPreview(result)
      setImportSuccess(`Đã xem trước ${result?.summary?.totalRows || 0} dòng.`)
    } catch (requestError) {
      setImportPreview(null)
      setImportError(requestError?.response?.data?.error?.message || requestError?.message || 'Không thể xem trước file import.')
    } finally {
      setImporting(false)
    }
  }

  async function handleConfirmImport() {
    if (!importFile || !importPreview) {
      setImportError('Vui lòng xem trước file trước khi xác nhận import.')
      return
    }

    setImporting(true)
    setImportError('')
    setImportSuccess('')
    try {
      const result = await confirmSportsProfileImport(importFile)
      setImportSuccess(`Import hoàn tất: tạo ${result?.summary?.createdCount || 0}, cập nhật ${result?.summary?.updatedCount || 0}, không đổi ${result?.summary?.unchangedCount || 0}.`)
      setImportPreview(null)
      setImportFile(null)
      setPagination((current) => ({ ...current, page: 1 }))
      setAppliedFilters((current) => ({ ...current }))
      await listSportsProfiles({ page: 1, pageSize: pagination.pageSize, sort: 'updatedAt:desc', ...appliedFilters })
    } catch (requestError) {
      setImportError(requestError?.response?.data?.error?.message || requestError?.message || 'Không thể xác nhận import Excel.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>Hồ sơ thể thao</div>
          <div className='text-body-secondary'>Quản lý hồ sơ thể thao theo tenant, độc lập với Strava và chưa gắn trực tiếp membership/club trong phạm vi task này.</div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={handleDownloadTemplate}>Tải mẫu Excel</CButton>
          <CButton color='primary' onClick={() => navigate(`${basePath}/new`)}>Tạo hồ sơ thể thao</CButton>
        </div>
      </div>

      <div className='card border mb-4'>
        <div className='card-body'>
          <div className='fw-semibold mb-2'>Import Excel</div>
          <div className='d-flex flex-wrap gap-2 align-items-center'>
            <input type='file' accept='.xlsx,.xls' onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
            <CButton color='secondary' variant='outline' size='sm' onClick={handleDownloadTemplate} disabled={importing}>Tải mẫu</CButton>
            <CButton color='primary' size='sm' onClick={handlePreviewImport} disabled={!importFile || importing}>Xem trước</CButton>
            <CButton color='success' size='sm' onClick={handleConfirmImport} disabled={!importFile || !importPreview || importing}>Xác nhận import</CButton>
          </div>
          {importError ? <CAlert color='danger' className='mt-3 mb-0'>{importError}</CAlert> : null}
          {importSuccess ? <CAlert color='success' className='mt-3 mb-0'>{importSuccess}</CAlert> : null}
          {importPreview ? (
            <div className='mt-3'>
              <div className='small text-body-secondary mb-2'>
                Tổng dòng: {importPreview?.summary?.totalRows || 0} | Tạo mới: {importPreview?.summary?.createCount || 0} | Cập nhật: {importPreview?.summary?.updateCount || 0} | Không đổi: {importPreview?.summary?.unchangedCount || 0} | Lỗi: {importPreview?.summary?.errorCount || 0}
              </div>
              <div className='table-responsive'>
                <table className='table table-sm table-bordered align-middle mb-0'>
                  <thead>
                    <tr>
                      <th>Dòng</th>
                      <th>Mã</th>
                      <th>Họ tên</th>
                      <th>Trạng thái</th>
                      <th>Thay đổi</th>
                      <th>Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(importPreview?.rows || []).map((row) => (
                      <tr key={`${row.rowNumber}-${row.profileCode || 'empty'}`}>
                        <td>{row.rowNumber}</td>
                        <td>{row.profileCode || '-'}</td>
                        <td>{row.fullName || '-'}</td>
                        <td>{row.status}</td>
                        <td>{row.action}</td>
                        <td>{row.reason || (row.errors?.length ? row.errors.join('; ') : row.warnings?.join('; ')) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <CRow className='g-3 mb-3'>
        <CCol lg={4} md={6}><CFormInput placeholder='Tìm theo mã, họ tên, tên hiển thị, điện thoại, email' value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value=''>Tất cả trạng thái</option>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.gender} onChange={(event) => setFilters((current) => ({ ...current, gender: event.target.value }))}><option value=''>Tất cả giới tính</option>{GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.hasUser} onChange={(event) => setFilters((current) => ({ ...current, hasUser: event.target.value }))}><option value=''>Có/không có User</option><option value='true'>Đã liên kết User</option><option value='false'>Chưa liên kết User</option></CFormSelect></CCol>
        <CCol lg={2} md={12} className='d-flex gap-2'>
          <CButton color='primary' className='flex-grow-1' onClick={() => { setPagination((current) => ({ ...current, page: 1 })); setAppliedFilters(filters) }}>Lọc</CButton>
          <CButton color='secondary' variant='outline' onClick={resetFilters}>Xóa lọc</CButton>
        </CCol>
      </CRow>

      <div className='small text-body-secondary mb-3'>Tổng cộng {pagination.total} hồ sơ</div>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải hồ sơ thể thao...</div>
      ) : rows.length === 0 ? (
        <CAlert color='secondary' className='mb-0'>Chưa có hồ sơ phù hợp.</CAlert>
      ) : (
        <>
          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Avatar</CTableHeaderCell>
                <CTableHeaderCell>Mã</CTableHeaderCell>
                <CTableHeaderCell>Họ tên</CTableHeaderCell>
                <CTableHeaderCell>Tên hiển thị</CTableHeaderCell>
                <CTableHeaderCell>Giới tính</CTableHeaderCell>
                <CTableHeaderCell>Ngày/Năm sinh</CTableHeaderCell>
                <CTableHeaderCell>Liên hệ</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                <CTableHeaderCell>User</CTableHeaderCell>
                <CTableHeaderCell>Thao tác</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((row) => {
                const statusMeta = getSportsProfileStatusMeta(row.status)
                return (
                  <CTableRow key={row.id}>
                    <CTableDataCell>{row.avatar?.url ? <img src={row.avatar.url} alt={row.fullName || row.code} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 10 }} /> : <div className='d-inline-flex align-items-center justify-content-center rounded bg-body-tertiary text-body-secondary' style={{ width: 44, height: 44 }}>N/A</div>}</CTableDataCell>
                    <CTableDataCell className='fw-semibold'>{row.code || '-'}</CTableDataCell>
                    <CTableDataCell>{row.fullName || '-'}</CTableDataCell>
                    <CTableDataCell>{row.displayName || '-'}</CTableDataCell>
                    <CTableDataCell>{getSportsProfileGenderLabel(row.gender)}</CTableDataCell>
                    <CTableDataCell>{formatSportsBirthDateOrYear(row.dateOfBirth, row.birthYear)}</CTableDataCell>
                    <CTableDataCell><div>{row.contactPhone || '-'}</div><div className='small text-body-secondary'>{row.contactEmail || '-'}</div></CTableDataCell>
                    <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                    <CTableDataCell>{getLinkedUserLabel(row.user)}</CTableDataCell>
                    <CTableDataCell><CButton size='sm' color='secondary' variant='outline' onClick={() => navigate(`${basePath}/${row.id}`)}>Xem chi tiết</CButton></CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>

          {pagination.pageCount > 1 ? (
            <div className='d-flex justify-content-end'>
              <CPagination>
                <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                {pages.map((entry, index) => entry === '...'
                  ? <CPaginationItem key={`sports-profile-ellipsis-${index}`} disabled>...</CPaginationItem>
                  : <CPaginationItem key={`sports-profile-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}