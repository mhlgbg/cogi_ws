import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
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
import ManagedClubHeader from '../components/ManagedClubHeader'
import {
  confirmManagedClubMemberImport,
  downloadManagedClubMemberImportTemplate,
  getMyManagedClub,
  getSportsClubManagementApiMessage,
  previewManagedClubMemberImport,
} from '../services/sportsClubManagementService'

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

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function getStatusColor(status) {
  if (status === 'CREATE') return 'success'
  if (status === 'UPDATE') return 'info'
  if (status === 'UNCHANGED') return 'secondary'
  if (status === 'WARNING') return 'warning'
  return 'danger'
}

function buildCurrentSummary(row) {
  const current = row?.currentMembership
  if (!current) return '-'
  return [
    `memberCode: ${formatValue(current.memberCode)}`,
    `status: ${formatValue(current.status)}`,
    `title: ${formatValue(current.positionTitle)}`,
    `joinedAt: ${formatValue(current.joinedAt)}`,
  ].join('\n')
}

function buildNextSummary(row) {
  const nextValues = row?.nextValues && typeof row.nextValues === 'object' ? row.nextValues : {}
  const entries = Object.entries(nextValues)
  if (entries.length === 0) return '-'
  return entries.map(([field, value]) => `${field}: ${formatValue(value)}`).join('\n')
}

function buildReason(row) {
  const parts = []
  if (row?.reason) parts.push(row.reason)
  if (Array.isArray(row?.errors) && row.errors.length > 0) parts.push(`Errors: ${row.errors.join(' | ')}`)
  if (Array.isArray(row?.warnings) && row.warnings.length > 0) parts.push(`Warnings: ${row.warnings.join(' | ')}`)
  return parts.join('\n') || '-'
}

function exportRowsToCsv(rows, fileName) {
  const headers = ['rowNumber', 'status', 'action', 'memberCode', 'profileCode', 'profileName', 'reason']
  const csvRows = [headers.join(',')]
  for (const row of rows) {
    const values = [
      row?.rowNumber,
      row?.status,
      row?.action,
      row?.memberCode,
      row?.profileCode,
      row?.profileName,
      buildReason(row),
    ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
    csvRows.push(values.join(','))
  }
  const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export default function ManagedClubMembersImportPage() {
  const navigate = useNavigate()
  const { clubId, tenantCode } = useParams()
  const [loadingClub, setLoadingClub] = useState(true)
  const [club, setClub] = useState(null)
  const [error, setError] = useState('')
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importSuccess, setImportSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const membersPath = tenantCode
    ? `/t/${encodeURIComponent(tenantCode)}/sports/my-clubs/${clubId}/members`
    : `/sports/my-clubs/${clubId}/members`
  const workspacePath = tenantCode
    ? `/t/${encodeURIComponent(tenantCode)}/sports/my-clubs/${clubId}`
    : `/sports/my-clubs/${clubId}`

  useEffect(() => {
    let mounted = true
    async function loadClub() {
      setLoadingClub(true)
      setError('')
      try {
        const result = await getMyManagedClub(clubId)
        if (!mounted) return
        setClub(result || null)
      } catch (requestError) {
        if (!mounted) return
        setClub(null)
        setError(getSportsClubManagementApiMessage(requestError, 'Không tải được thông tin CLB.'))
      } finally {
        if (mounted) setLoadingClub(false)
      }
    }
    loadClub()
    return () => { mounted = false }
  }, [clubId])

  const filteredRows = useMemo(() => {
    const rows = Array.isArray(importPreview?.rows) ? importPreview.rows : []
    if (!statusFilter) return rows
    return rows.filter((row) => row.status === statusFilter)
  }, [importPreview, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pages = useMemo(() => buildPages(currentPage, pageCount), [currentPage, pageCount])
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [statusFilter, importPreview])

  async function handleDownloadTemplate() {
    setError('')
    try {
      await downloadManagedClubMemberImportTemplate(clubId)
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể tải mẫu Excel.'))
    }
  }

  async function handlePreviewImport() {
    if (!importFile) {
      setError('Vui lòng chọn file Excel để xem trước.')
      return
    }
    setImporting(true)
    setError('')
    setImportSuccess('')
    try {
      const result = await previewManagedClubMemberImport(clubId, importFile)
      setImportPreview(result)
      setImportSuccess(`Đã xem trước ${result?.summary?.totalRows || 0} dòng.`)
    } catch (requestError) {
      setImportPreview(null)
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể xem trước file import membership.'))
    } finally {
      setImporting(false)
    }
  }

  async function handleConfirmImport() {
    if (!importFile || !importPreview) {
      setError('Vui lòng xem trước file trước khi xác nhận import.')
      return
    }
    setImporting(true)
    setError('')
    setImportSuccess('')
    try {
      const result = await confirmManagedClubMemberImport(clubId, importFile)
      setImportSuccess(`Import hoàn tất: tạo ${result?.summary?.createdCount || 0}, cập nhật ${result?.summary?.updatedCount || 0}, không đổi ${result?.summary?.unchangedCount || 0}.`)
      setImportPreview(result)
      setImportFile(null)
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể xác nhận import membership.'))
    } finally {
      setImporting(false)
    }
  }

  if (loadingClub) {
    return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải thông tin CLB...</div>
  }

  if (!club) {
    return <CAlert color='danger'>{error || 'Không tìm thấy CLB hoặc bạn không có quyền truy cập.'}</CAlert>
  }

  return (
    <div>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {importSuccess ? <CAlert color='success'>{importSuccess}</CAlert> : null}
      <ManagedClubHeader club={club} onBack={() => navigate(workspacePath)} />

      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>Import thành viên CLB</div>
          <div className='text-body-secondary'>Import/Upsert membership cho CLB hiện tại theo profileCode trong tenant, không tự tạo Sports Profile và không tự thay đổi quyền quản trị CLB.</div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(membersPath)}>Quay lại danh sách thành viên</CButton>
        </div>
      </div>

      <CCard className='border mb-4'>
        <CCardBody>
          <div className='fw-semibold mb-2'>Upload file Import</div>
          <div className='d-flex flex-wrap gap-2 align-items-center'>
            <input type='file' accept='.xlsx,.xls' onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
            <CButton color='secondary' variant='outline' size='sm' onClick={handleDownloadTemplate} disabled={importing}>Tải mẫu Excel</CButton>
            <CButton color='primary' size='sm' onClick={handlePreviewImport} disabled={!importFile || importing}>Xem trước</CButton>
            <CButton color='success' size='sm' onClick={handleConfirmImport} disabled={!importFile || !importPreview || importing}>Xác nhận import</CButton>
            <CButton color='secondary' size='sm' variant='outline' onClick={() => exportRowsToCsv(Array.isArray(importPreview?.rows) ? importPreview.rows : [], 'club-membership-import-preview.csv')} disabled={!importPreview}>Tải báo cáo CSV</CButton>
          </div>
        </CCardBody>
      </CCard>

      {importPreview ? (
        <>
          <CRow className='g-3 mb-3'>
            <CCol md={4}>
              <CFormSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value=''>Tất cả trạng thái</option>
                <option value='CREATE'>CREATE</option>
                <option value='UPDATE'>UPDATE</option>
                <option value='UNCHANGED'>UNCHANGED</option>
                <option value='WARNING'>WARNING</option>
                <option value='ERROR'>ERROR</option>
              </CFormSelect>
            </CCol>
          </CRow>

          <div className='small text-body-secondary mb-3'>
            Tổng dòng: {importPreview?.summary?.totalRows || 0}
            {' | '}Tạo mới: {importPreview?.summary?.createCount || importPreview?.summary?.createdCount || 0}
            {' | '}Cập nhật: {importPreview?.summary?.updateCount || importPreview?.summary?.updatedCount || 0}
            {' | '}Không đổi: {importPreview?.summary?.unchangedCount || 0}
            {' | '}Cảnh báo: {importPreview?.summary?.warningCount || 0}
            {' | '}Lỗi: {importPreview?.summary?.errorCount || 0}
          </div>

          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Dòng</CTableHeaderCell>
                <CTableHeaderCell>Member Code</CTableHeaderCell>
                <CTableHeaderCell>Profile</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                <CTableHeaderCell>Thao tác</CTableHeaderCell>
                <CTableHeaderCell>Hiện tại</CTableHeaderCell>
                <CTableHeaderCell>Giá trị mới</CTableHeaderCell>
                <CTableHeaderCell>Lý do</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {pagedRows.map((row) => (
                <CTableRow key={`${row.rowNumber}-${row.profileCode || row.memberCode || 'row'}`}>
                  <CTableDataCell>{row.rowNumber}</CTableDataCell>
                  <CTableDataCell>{row.memberCode || '-'}</CTableDataCell>
                  <CTableDataCell>
                    <div>{row.profileName || '-'}</div>
                    <div className='small text-body-secondary'>{row.profileCode || '-'}</div>
                  </CTableDataCell>
                  <CTableDataCell><CBadge color={getStatusColor(row.status)}>{row.status}</CBadge></CTableDataCell>
                  <CTableDataCell>{row.action || '-'}</CTableDataCell>
                  <CTableDataCell style={{ whiteSpace: 'pre-wrap', minWidth: 220 }}>{buildCurrentSummary(row)}</CTableDataCell>
                  <CTableDataCell style={{ whiteSpace: 'pre-wrap', minWidth: 220 }}>{buildNextSummary(row)}</CTableDataCell>
                  <CTableDataCell style={{ whiteSpace: 'pre-wrap', minWidth: 320 }}>{buildReason(row)}</CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>

          {pageCount > 1 ? (
            <CPagination className='mt-3'>
              <CPaginationItem disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trước</CPaginationItem>
              {pages.map((item, index) => (
                <CPaginationItem
                  key={`${item}-${index}`}
                  active={item === currentPage}
                  disabled={item === '...'}
                  onClick={() => { if (typeof item === 'number') setPage(item) }}
                >
                  {item}
                </CPaginationItem>
              ))}
              <CPaginationItem disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Sau</CPaginationItem>
            </CPagination>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
