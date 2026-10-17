import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
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
import ManagedClubHeader from '../components/ManagedClubHeader'
import {
  confirmManagedClubAchievementImport,
  downloadManagedClubAchievementImportTemplate,
  getMyManagedClub,
  getSportsClubManagementApiMessage,
  previewManagedClubAchievementImport,
} from '../services/sportsClubManagementService'
import { formatDistanceKm, formatDurationSeconds, formatSportsDateTime } from '../utils/sportsAchievementUi'

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

function getStatusColor(status) {
  if (status === 'CREATE') return 'success'
  if (status === 'DUPLICATE') return 'secondary'
  if (status === 'WARNING') return 'warning'
  return 'danger'
}

function exportRowsToCsv(rows, fileName) {
  const headers = ['rowNumber', 'status', 'profileCode', 'profileName', 'eventCode', 'eventName', 'bib', 'distanceKm', 'finishTimeSeconds', 'achievedAt', 'title', 'reason']
  const csvRows = [headers.join(',')]
  for (const row of rows) {
    const values = [
      row?.rowNumber,
      row?.status,
      row?.profileCode,
      row?.profileName,
      row?.eventCode,
      row?.eventName,
      row?.bib,
      row?.distanceKm,
      row?.finishTime,
      row?.achievedAt,
      row?.title,
      row?.reason,
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

export default function ManagedClubAchievementsImportPage() {
  const navigate = useNavigate()
  const { clubId, tenantCode } = useParams()
  const [loadingClub, setLoadingClub] = useState(true)
  const [club, setClub] = useState(null)
  const [error, setError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  const [importFile, setImportFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [confirmVisible, setConfirmVisible] = useState(false)
  const confirmPanelRef = useRef(null)
  const [settings, setSettings] = useState({
    achievementType: 'race_result',
    sportType: 'running',
    titleStrategy: 'auto_event_bib',
    processingMode: 'verify_now',
  })
  const pageSize = 20

  const workspacePath = tenantCode
    ? `/t/${encodeURIComponent(tenantCode)}/sports/my-clubs/${clubId}`
    : `/sports/my-clubs/${clubId}`
  const achievementsPath = `${workspacePath}/achievements`

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
    const rows = Array.isArray(preview?.rows) ? preview.rows : []
    if (!statusFilter) return rows
    return rows.filter((row) => row.status === statusFilter)
  }, [preview, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pages = useMemo(() => buildPages(currentPage, pageCount), [currentPage, pageCount])
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const readyRowsCount = Array.isArray(preview?.rows)
    ? preview.rows.filter((row) => row?.canImport).length
    : 0

  useEffect(() => {
    setPage(1)
  }, [statusFilter, preview])

  useEffect(() => {
    if (!confirmVisible) return
    confirmPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [confirmVisible])

  async function handleDownloadTemplate() {
    setError('')
    try {
      await downloadManagedClubAchievementImportTemplate(clubId)
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
      const result = await previewManagedClubAchievementImport(clubId, importFile, settings)
      setPreview(result)
      setConfirmVisible(false)
      setImportSuccess(`Đã xem trước ${result?.summary?.totalRows || 0} dòng.`)
    } catch (requestError) {
      setPreview(null)
      setConfirmVisible(false)
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể xem trước file import thành tích.'))
    } finally {
      setImporting(false)
    }
  }

  function handleOpenConfirm() {
    if (!importFile || !preview) {
      setError('Vui lòng xem trước file trước khi xác nhận import.')
      return
    }
    setConfirmVisible(true)
  }

  async function handleConfirmImport() {
    if (!importFile || !preview) {
      setError('Vui lòng xem trước file trước khi xác nhận import.')
      return
    }
    setImporting(true)
    setError('')
    setImportSuccess('')
    try {
      const result = await confirmManagedClubAchievementImport(clubId, importFile, settings)
      setPreview(result)
      setImportFile(null)
      setConfirmVisible(false)
      setImportSuccess(`Import hoàn tất: tạo ${result?.summary?.createdCount || 0}, bổ sung ${result?.summary?.updatedCount || result?.summary?.supplementedCount || 0}, bỏ qua ${result?.summary?.skippedCount || 0}, lỗi ${result?.summary?.errorCount || 0}.`)
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể xác nhận import thành tích.'))
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
          <div className='fs-5 fw-semibold'>Import thành tích CLB</div>
          <div className='text-body-secondary'>Ưu tiên Race Result cho môn chạy bộ, tái sử dụng workflow hiện có để ghi nhận ngay hoặc tạo submission chờ xác minh.</div>
        </div>
        <CButton color='secondary' variant='outline' onClick={() => navigate(achievementsPath)}>Quay lại tab thành tích</CButton>
      </div>

      <CCard className='border mb-4'>
        <CCardBody>
          <div className='fw-semibold mb-3'>Cấu hình import</div>
          <CRow className='g-3'>
            <CCol md={3}>
              <CFormLabel>Loại thành tích</CFormLabel>
              <CFormSelect value={settings.achievementType} onChange={(event) => setSettings((current) => ({ ...current, achievementType: event.target.value }))}>
                <option value='race_result'>Race Result</option>
              </CFormSelect>
            </CCol>
            <CCol md={3}>
              <CFormLabel>Môn</CFormLabel>
              <CFormSelect value={settings.sportType} onChange={(event) => setSettings((current) => ({ ...current, sportType: event.target.value }))}>
                <option value='running'>Chạy bộ</option>
              </CFormSelect>
            </CCol>
            <CCol md={3}>
              <CFormLabel>Tạo tiêu đề</CFormLabel>
              <CFormSelect value={settings.titleStrategy} onChange={(event) => setSettings((current) => ({ ...current, titleStrategy: event.target.value }))}>
                <option value='auto_event_bib'>Tự ghép eventCode-bib</option>
                <option value='excel_title'>Lấy title trong Excel</option>
              </CFormSelect>
            </CCol>
            <CCol md={3}>
              <CFormLabel>Chế độ xử lý</CFormLabel>
              <CFormSelect value={settings.processingMode} onChange={(event) => setSettings((current) => ({ ...current, processingMode: event.target.value }))}>
                <option value='verify_now'>Ghi nhận ngay</option>
                <option value='submission'>Chờ xác minh</option>
              </CFormSelect>
            </CCol>
          </CRow>

          <div className='fw-semibold mt-4 mb-2'>Upload file</div>
          <div className='d-flex flex-wrap gap-2 align-items-center'>
            <input type='file' accept='.xlsx,.xls' onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
            <CButton color='secondary' variant='outline' size='sm' onClick={handleDownloadTemplate} disabled={importing}>Tải mẫu Excel</CButton>
            <CButton color='primary' size='sm' onClick={handlePreviewImport} disabled={!importFile || importing}>Xem trước</CButton>
            <CButton color='success' size='sm' onClick={handleOpenConfirm} disabled={!importFile || !preview || importing}>
              {confirmVisible ? 'Đang chờ xác nhận ghi DB thật' : 'Mở bước xác nhận'}
            </CButton>
            <CButton color='secondary' size='sm' variant='outline' onClick={() => exportRowsToCsv(Array.isArray(preview?.rows) ? preview.rows : [], 'club-achievements-import-preview.csv')} disabled={!preview}>Tải báo cáo CSV</CButton>
          </div>
        </CCardBody>
      </CCard>

      {confirmVisible ? (
        <CCard ref={confirmPanelRef} className='border border-success mb-4'>
          <CCardBody>
            <div className='fw-semibold mb-2'>Xác nhận ghi dữ liệu thật</div>
            <div className='mb-3'>
              Bạn sắp ghi dữ liệu thật vào hệ thống cho CLB <strong>{club?.name || '-'}</strong>.
            </div>
            <div className='small text-body-secondary mb-2'>Cấu hình hiện tại</div>
            <div className='mb-3'>
              <div>Loại thành tích: <strong>Race Result</strong></div>
              <div>Môn: <strong>Chạy bộ</strong></div>
              <div>Tạo tiêu đề: <strong>{settings.titleStrategy === 'excel_title' ? 'Lấy title trong Excel' : 'Tự ghép eventCode-bib'}</strong></div>
              <div>Chế độ xử lý: <strong>{settings.processingMode === 'verify_now' ? 'Ghi nhận ngay' : 'Chờ xác minh'}</strong></div>
            </div>
            <div className='small text-body-secondary mb-2'>Kết quả preview</div>
            <div className='mb-3'>
              <div>Sẵn sàng ghi: <strong>{readyRowsCount}</strong></div>
              <div>Cảnh báo: <strong>{Number(preview?.summary?.warningCount || 0)}</strong></div>
              <div>Lỗi: <strong>{Number(preview?.summary?.errorCount || 0)}</strong></div>
              <div>Trùng/bỏ qua: <strong>{Number(preview?.summary?.duplicateCount || 0)}</strong></div>
            </div>
            <div className='text-danger small mb-3'>
              Chỉ khi bấm nút bên dưới thì hệ thống mới ghi DB thật.
            </div>
            <div className='d-flex gap-2 flex-wrap'>
              <CButton color='secondary' variant='outline' onClick={() => setConfirmVisible(false)} disabled={importing}>Hủy</CButton>
              <CButton color='success' onClick={handleConfirmImport} disabled={importing || readyRowsCount <= 0}>
                {importing ? 'Đang ghi dữ liệu...' : 'Xác nhận ghi DB thật'}
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      ) : null}

      {preview ? (
        <>
          <CRow className='g-3 mb-3'>
            <CCol md={4}>
              <CFormSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value=''>Tất cả trạng thái</option>
                <option value='CREATE'>CREATE</option>
                <option value='DUPLICATE'>DUPLICATE</option>
                <option value='WARNING'>WARNING</option>
                <option value='ERROR'>ERROR</option>
              </CFormSelect>
            </CCol>
          </CRow>

          <div className='small text-body-secondary mb-3'>
            Tổng dòng: {preview?.summary?.totalRows || 0}
            {' | '}Tạo mới: {preview?.summary?.createCount || preview?.summary?.createdCount || 0}
            {' | '}Trùng: {preview?.summary?.duplicateCount || 0}
            {' | '}Cảnh báo: {preview?.summary?.warningCount || 0}
            {' | '}Lỗi: {preview?.summary?.errorCount || 0}
          </div>

          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Dòng</CTableHeaderCell>
                <CTableHeaderCell>Profile</CTableHeaderCell>
                <CTableHeaderCell>Giải / BIB</CTableHeaderCell>
                <CTableHeaderCell>Cự ly / Kết quả</CTableHeaderCell>
                <CTableHeaderCell>Ngày thi đấu</CTableHeaderCell>
                <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                <CTableHeaderCell>Hành động</CTableHeaderCell>
                <CTableHeaderCell>Lý do</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {pagedRows.map((row) => (
                <CTableRow key={`${row.rowNumber}-${row.profileCode || row.eventCode || 'row'}`}>
                  <CTableDataCell>{row.rowNumber}</CTableDataCell>
                  <CTableDataCell>
                    <div>{row.profileName || '-'}</div>
                    <div className='small text-body-secondary'>{row.profileCode || '-'}</div>
                    <div className='small text-body-secondary'>{row.memberCode || '-'}</div>
                  </CTableDataCell>
                  <CTableDataCell>
                    <div>{row.eventName || row.eventCode || '-'}</div>
                    <div className='small text-body-secondary'>{row.eventCode || '-'}</div>
                    <div className='small text-body-secondary'>BIB: {row.bib || '-'}</div>
                  </CTableDataCell>
                  <CTableDataCell>
                    <div>{formatDistanceKm(row.distanceKm)}</div>
                    <div className='small text-body-secondary'>{formatDurationSeconds(row.finishTime)}</div>
                  </CTableDataCell>
                  <CTableDataCell>{formatSportsDateTime(row.achievedAt)}</CTableDataCell>
                  <CTableDataCell>{row.title || '-'}</CTableDataCell>
                  <CTableDataCell><CBadge color={getStatusColor(row.status)}>{row.status}</CBadge></CTableDataCell>
                  <CTableDataCell>{row.action || '-'}</CTableDataCell>
                  <CTableDataCell style={{ whiteSpace: 'pre-wrap', minWidth: 320 }}>{row.reason || '-'}</CTableDataCell>
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
