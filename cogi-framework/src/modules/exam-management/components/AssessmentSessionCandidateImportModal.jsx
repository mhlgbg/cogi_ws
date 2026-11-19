import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import * as XLSX from 'xlsx'
import {
  confirmSessionCandidateImport,
  downloadSessionCandidateTemplate,
  previewSessionCandidateImport,
} from '../services/examSessionApi'

function actionMeta(action) {
  const normalized = String(action || '').toUpperCase()
  if (normalized === 'CREATE') return { label: 'Tạo mới', color: 'success' }
  if (normalized === 'SKIP') return { label: 'Bỏ qua', color: 'secondary' }
  if (normalized === 'WARNING') return { label: 'Cảnh báo', color: 'warning' }
  return { label: 'Lỗi', color: 'danger' }
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function buildErrorExportBlob(rows = []) {
  const data = rows.map((row) => ({
    rowNumber: row?.rowNumber || '',
    sessionCode: row?.sessionCode || '',
    studentCode: row?.studentCode || '',
    fullName: row?.inputFullName || '',
    errors: Array.isArray(row?.errors) ? row.errors.join(' | ') : '',
  }))
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Errors')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
}

export default function AssessmentSessionCandidateImportModal({ visible, sessionId, onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [error, setError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [confirmedWarningKeys, setConfirmedWarningKeys] = useState([])

  useEffect(() => {
    if (!visible) {
      setFile(null)
      setPreview(null)
      setFilter('ALL')
      setError('')
      setPreviewLoading(false)
      setConfirmLoading(false)
      setDownloadLoading(false)
      setConfirmedWarningKeys([])
    }
  }, [visible])

  const rows = useMemo(() => {
    const source = Array.isArray(preview?.rows) ? preview.rows : []
    if (filter === 'ALL') return source
    return source.filter((item) => String(item?.action || '').toUpperCase() === filter)
  }, [filter, preview])

  const errorRows = useMemo(
    () => (Array.isArray(preview?.rows) ? preview.rows.filter((item) => String(item?.action || '').toUpperCase() === 'ERROR') : []),
    [preview],
  )
  const warningRows = useMemo(
    () => (Array.isArray(preview?.rows) ? preview.rows.filter((item) => String(item?.action || '').toUpperCase() === 'WARNING') : []),
    [preview],
  )

  const hasErrors = errorRows.length > 0
  const allWarningsConfirmed = warningRows.every((item) => confirmedWarningKeys.includes(item.rowKey))
  const canPreview = Boolean(file) && !previewLoading && !confirmLoading
  const canConfirm = Boolean(preview?.previewToken) && !hasErrors && allWarningsConfirmed && !confirmLoading && !previewLoading

  async function handleDownloadTemplate() {
    setDownloadLoading(true)
    setError('')
    try {
      const result = await downloadSessionCandidateTemplate(sessionId || null)
      downloadBlob(result?.blob, result?.fileName || 'assessment-session-candidates-template.xlsx')
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || 'Không thể tải file mẫu')
    } finally {
      setDownloadLoading(false)
    }
  }

  async function handlePreview() {
    if (!canPreview) return
    setPreviewLoading(true)
    setError('')
    try {
      const result = await previewSessionCandidateImport(sessionId || null, file)
      setPreview(result)
      setConfirmedWarningKeys([])
      setFilter('ALL')
    } catch (requestError) {
      setPreview(null)
      setConfirmedWarningKeys([])
      setError(requestError?.response?.data?.error?.message || 'Không thể xem trước file import')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleConfirm() {
    if (!canConfirm) return
    setConfirmLoading(true)
    setError('')
    try {
      const result = await confirmSessionCandidateImport(sessionId || null, {
        previewToken: preview.previewToken,
        confirmedWarningKeys,
      })
      onImported?.(result)
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || 'Không thể xác nhận import')
    } finally {
      setConfirmLoading(false)
    }
  }

  function toggleWarningConfirm(rowKey, checked) {
    setConfirmedWarningKeys((current) => {
      const key = String(rowKey || '')
      if (!key) return current
      if (checked) {
        return current.includes(key) ? current : [...current, key]
      }
      return current.filter((item) => item !== key)
    })
  }

  function exportErrors() {
    if (errorRows.length === 0) return
    const buffer = buildErrorExportBlob(errorRows)
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    downloadBlob(blob, 'assessment-session-candidate-import-errors.xlsx')
  }

  return (
    <CModal visible={visible} backdrop='static' size='xl' scrollable onClose={() => !previewLoading && !confirmLoading && onClose?.()}>
      <CModalHeader>
        <CModalTitle>Import ghi danh thí sinh từ Excel</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className='d-flex gap-2 flex-wrap mb-3'>
          <CButton color='secondary' variant='outline' onClick={handleDownloadTemplate} disabled={downloadLoading || previewLoading || confirmLoading}>
            {downloadLoading ? 'Đang tải mẫu...' : 'Tải file mẫu'}
          </CButton>
          {errorRows.length > 0 ? (
            <CButton color='danger' variant='outline' onClick={exportErrors}>
              Xuất danh sách lỗi
            </CButton>
          ) : null}
        </div>

        <div className='mb-3'>
          <CFormLabel>File Excel</CFormLabel>
          <CFormInput
            type='file'
            accept='.xlsx,.xls'
            disabled={previewLoading || confirmLoading}
            onChange={(event) => {
              setFile(event.target.files?.[0] || null)
              setPreview(null)
              setConfirmedWarningKeys([])
            }}
          />
          <div className='small text-body-secondary mt-1'>Cột bắt buộc: sessionCode, studentCode, fullName.</div>
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {preview ? (
          <div className='d-flex flex-column gap-3'>
            <CAlert color={hasErrors ? 'warning' : (warningRows.length > 0 ? 'info' : 'success')} className='mb-0'>
              Tổng dòng: {preview?.totalRows || 0}
              {' | '}Tạo mới: {preview?.createCount || 0}
              {' | '}Bỏ qua: {preview?.skipCount || 0}
              {' | '}Cảnh báo: {preview?.warningCount || 0}
              {' | '}Lỗi: {preview?.errorCount || 0}
            </CAlert>

            {Array.isArray(preview?.bySession) && preview.bySession.length > 0 ? (
              <div className='small text-body-secondary border rounded p-2'>
                {preview.bySession.map((item) => (
                  <div key={`session-summary-${item.sessionCode}`}>
                    [{item.sessionCode}] {item.sessionName || '—'}: tổng {item.total}, tạo {item.create}, bỏ qua {item.skip}, cảnh báo {item.warning}, lỗi {item.error}
                  </div>
                ))}
              </div>
            ) : null}

            {hasErrors ? <CAlert color='danger' className='mb-0'>Có dòng ERROR. Vui lòng sửa dữ liệu và preview lại trước khi confirm.</CAlert> : null}
            {!hasErrors && warningRows.length > 0 && !allWarningsConfirmed ? (
              <CAlert color='warning' className='mb-0'>Có dòng WARNING. Bạn cần xác nhận từng dòng WARNING trước khi confirm.</CAlert>
            ) : null}

            <div className='d-flex gap-2 flex-wrap'>
              <CButton color={filter === 'ALL' ? 'primary' : 'secondary'} variant={filter === 'ALL' ? undefined : 'outline'} onClick={() => setFilter('ALL')}>Tất cả</CButton>
              <CButton color={filter === 'CREATE' ? 'success' : 'secondary'} variant={filter === 'CREATE' ? undefined : 'outline'} onClick={() => setFilter('CREATE')}>Tạo mới</CButton>
              <CButton color={filter === 'SKIP' ? 'dark' : 'secondary'} variant={filter === 'SKIP' ? undefined : 'outline'} onClick={() => setFilter('SKIP')}>Bỏ qua</CButton>
              <CButton color={filter === 'WARNING' ? 'warning' : 'secondary'} variant={filter === 'WARNING' ? undefined : 'outline'} onClick={() => setFilter('WARNING')}>Cảnh báo</CButton>
              <CButton color={filter === 'ERROR' ? 'danger' : 'secondary'} variant={filter === 'ERROR' ? undefined : 'outline'} onClick={() => setFilter('ERROR')}>Lỗi</CButton>
            </div>

            <CTable hover responsive align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Dòng</CTableHeaderCell>
                  <CTableHeaderCell>Session</CTableHeaderCell>
                  <CTableHeaderCell>Mã SV</CTableHeaderCell>
                  <CTableHeaderCell>Họ tên Excel</CTableHeaderCell>
                  <CTableHeaderCell>Họ tên Learner</CTableHeaderCell>
                  <CTableHeaderCell>Hành động</CTableHeaderCell>
                  <CTableHeaderCell>Xác nhận WARNING</CTableHeaderCell>
                  <CTableHeaderCell>Kết quả</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length > 0 ? rows.map((item) => {
                  const meta = actionMeta(item?.action)
                  const errors = Array.isArray(item?.errors) ? item.errors : []
                  const warnings = Array.isArray(item?.warnings) ? item.warnings : []
                  const isWarning = String(item?.action || '').toUpperCase() === 'WARNING'
                  return (
                    <CTableRow key={`candidate-import-${item.rowKey || `${item.rowNumber}-${item.studentCode}`}`}>
                      <CTableDataCell>{item.rowNumber || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{item.sessionCode || '-'}</div>
                        <div className='small text-body-secondary'>{item.sessionName || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>{item.studentCode || '-'}</CTableDataCell>
                      <CTableDataCell>{item.inputFullName || '-'}</CTableDataCell>
                      <CTableDataCell>{item.learnerFullName || '-'}</CTableDataCell>
                      <CTableDataCell><CBadge color={meta.color}>{meta.label}</CBadge></CTableDataCell>
                      <CTableDataCell>
                        {isWarning ? (
                          <CFormCheck
                            id={`warning-confirm-${item.rowKey}`}
                            checked={confirmedWarningKeys.includes(item.rowKey)}
                            onChange={(event) => toggleWarningConfirm(item.rowKey, event.target.checked)}
                            label='Xác nhận'
                          />
                        ) : '—'}
                      </CTableDataCell>
                      <CTableDataCell>{errors.length ? errors.join(' | ') : (warnings.length ? warnings.join(' | ') : (item?.message || 'Hợp lệ'))}</CTableDataCell>
                    </CTableRow>
                  )
                }) : (
                  <CTableRow>
                    <CTableDataCell colSpan={8} className='text-center text-body-secondary'>Không có dòng phù hợp bộ lọc.</CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
          </div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={previewLoading || confirmLoading || downloadLoading}>Đóng</CButton>
        <CButton color='info' onClick={handlePreview} disabled={!canPreview}>
          {previewLoading ? <span className='d-inline-flex align-items-center gap-2'><CSpinner size='sm' />Đang preview...</span> : 'Xem trước import'}
        </CButton>
        <CButton color='primary' onClick={handleConfirm} disabled={!canConfirm}>
          {confirmLoading ? <span className='d-inline-flex align-items-center gap-2'><CSpinner size='sm' />Đang import...</span> : 'Xác nhận import'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
