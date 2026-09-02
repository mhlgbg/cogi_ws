import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
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
import {
  commitExamEligibilityImport,
  downloadExamEligibilityImportTemplate,
  previewExamEligibilityImport,
} from '../services/examEligibilityApi'
import { getEligibilityStatusMeta, getExamEligibilityApiMessage } from '../utils/examEligibilityUi'

function getActionMeta(action) {
  const normalized = String(action || '').trim().toUpperCase()
  if (normalized === 'CREATE') return { label: 'Tạo mới', color: 'success' }
  if (normalized === 'UPDATE') return { label: 'Cập nhật', color: 'info' }
  if (normalized === 'SKIP') return { label: 'Không thay đổi', color: 'secondary' }
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

export default function ExamEligibilityImportModal({ visible, roundId, onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    if (!visible) {
      setFile(null)
      setPreviewLoading(false)
      setConfirmLoading(false)
      setDownloadingTemplate(false)
      setError('')
      setPreview(null)
      setFilter('ALL')
    }
  }, [visible])

  const filteredRows = useMemo(() => {
    const rows = Array.isArray(preview?.rows) ? preview.rows : []
    if (filter === 'ALL') return rows
    return rows.filter((row) => String(row?.action || '').toUpperCase() === filter)
  }, [filter, preview])

  const hasBlockingErrors = useMemo(() => (
    Array.isArray(preview?.rows)
      ? preview.rows.some((row) => String(row?.action || '').toUpperCase() === 'ERROR')
      : false
  ), [preview])

  const canPreview = Boolean(roundId) && Boolean(file) && !previewLoading && !confirmLoading && !downloadingTemplate
  const canConfirm = Boolean(roundId) && Boolean(file) && Boolean(preview) && !hasBlockingErrors && !previewLoading && !confirmLoading

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true)
    setError('')
    try {
      const result = await downloadExamEligibilityImportTemplate()
      downloadBlob(result?.blob, result?.fileName || 'exam-eligibility-import-template.xlsx')
    } catch (requestError) {
      setError(getExamEligibilityApiMessage(requestError, 'Không thể tải file mẫu import eligibility.'))
    } finally {
      setDownloadingTemplate(false)
    }
  }

  async function handlePreview() {
    if (!canPreview) return
    setPreviewLoading(true)
    setError('')
    try {
      const result = await previewExamEligibilityImport(roundId, file)
      setPreview(result)
      setFilter('ALL')
    } catch (requestError) {
      setPreview(null)
      setError(getExamEligibilityApiMessage(requestError, 'Không thể xem trước file import eligibility.'))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleConfirm() {
    if (!canConfirm) return
    setConfirmLoading(true)
    setError('')
    try {
      const result = await commitExamEligibilityImport(roundId, file)
      onImported?.(result)
    } catch (requestError) {
      setError(getExamEligibilityApiMessage(requestError, 'Không thể xác nhận import eligibility.'))
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='xl' scrollable onClose={() => !previewLoading && !confirmLoading && !downloadingTemplate && onClose?.()}>
      <CModalHeader>
        <CModalTitle>Nhập đối tượng đăng ký từ Excel</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className='d-flex flex-wrap gap-2 mb-3'>
          <CButton color='secondary' variant='outline' onClick={handleDownloadTemplate} disabled={downloadingTemplate || previewLoading || confirmLoading}>
            {downloadingTemplate ? 'Đang tải mẫu...' : 'Tải file mẫu'}
          </CButton>
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
            }}
          />
          <div className='small text-body-secondary mt-1'>Chỉ match learner đã tồn tại trong tenant bằng learnerCode. File này không tạo learner mới.</div>
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {preview ? (
          <div className='d-flex flex-column gap-3'>
            <CAlert color={hasBlockingErrors ? 'warning' : 'info'} className='mb-0'>
              Tổng dòng: {preview?.totalRows || 0} | Hợp lệ: {preview?.validRows || 0} | Tạo mới: {preview?.createCount || 0} | Cập nhật: {preview?.updateCount || 0} | Không thay đổi: {preview?.skipCount || 0} | Lỗi: {preview?.errorCount || 0}
            </CAlert>

            {hasBlockingErrors ? <CAlert color='danger' className='mb-0'>Có ít nhất một dòng lỗi. Pha này đang chạy strict mode nên chưa thể xác nhận import.</CAlert> : null}

            <div className='d-flex flex-wrap gap-2'>
              <CButton color={filter === 'ALL' ? 'primary' : 'secondary'} variant={filter === 'ALL' ? undefined : 'outline'} onClick={() => setFilter('ALL')}>Tất cả</CButton>
              <CButton color={filter === 'CREATE' ? 'success' : 'secondary'} variant={filter === 'CREATE' ? undefined : 'outline'} onClick={() => setFilter('CREATE')}>Tạo mới</CButton>
              <CButton color={filter === 'UPDATE' ? 'info' : 'secondary'} variant={filter === 'UPDATE' ? undefined : 'outline'} onClick={() => setFilter('UPDATE')}>Cập nhật</CButton>
              <CButton color={filter === 'SKIP' ? 'dark' : 'secondary'} variant={filter === 'SKIP' ? undefined : 'outline'} onClick={() => setFilter('SKIP')}>Bỏ qua</CButton>
              <CButton color={filter === 'ERROR' ? 'danger' : 'secondary'} variant={filter === 'ERROR' ? undefined : 'outline'} onClick={() => setFilter('ERROR')}>Lỗi</CButton>
            </div>

            <CTable hover responsive align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Dòng</CTableHeaderCell>
                  <CTableHeaderCell>Mã learner</CTableHeaderCell>
                  <CTableHeaderCell>Họ tên</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái hiện tại</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái import</CTableHeaderCell>
                  <CTableHeaderCell>Hành động</CTableHeaderCell>
                  <CTableHeaderCell>Kết quả</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {filteredRows.length > 0 ? filteredRows.map((row) => {
                  const actionMeta = getActionMeta(row.action)
                  const currentStatusMeta = getEligibilityStatusMeta(row.currentStatus)
                  const newStatusMeta = getEligibilityStatusMeta(row.newStatus)
                  return (
                    <CTableRow key={`eligibility-import-${row.rowNumber}-${row.learnerCode || 'blank'}`}>
                      <CTableDataCell>{row.rowNumber || '-'}</CTableDataCell>
                      <CTableDataCell>{row.learnerCode || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{row.learnerName || '-'}</div>
                        <div className='small text-body-secondary'>{row.dateOfBirth || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={currentStatusMeta.color}>{currentStatusMeta.label}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={newStatusMeta.color}>{newStatusMeta.label}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={actionMeta.color}>{actionMeta.label}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        {Array.isArray(row.errors) && row.errors.length > 0 ? row.errors.join(' | ') : ''}
                        {Array.isArray(row.errors) && row.errors.length > 0 && Array.isArray(row.warnings) && row.warnings.length > 0 ? ' || ' : ''}
                        {Array.isArray(row.warnings) && row.warnings.length > 0 ? row.warnings.join(' | ') : (Array.isArray(row.errors) && row.errors.length > 0 ? '' : 'Hợp lệ')}
                      </CTableDataCell>
                    </CTableRow>
                  )
                }) : (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className='text-center text-body-secondary'>Không có dòng nào phù hợp với bộ lọc hiện tại.</CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
          </div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={previewLoading || confirmLoading || downloadingTemplate}>Đóng</CButton>
        <CButton color='info' onClick={handlePreview} disabled={!canPreview}>
          {previewLoading ? <span className='d-inline-flex align-items-center gap-2'><CSpinner size='sm' />Đang preview...</span> : 'Xem trước import'}
        </CButton>
        <CButton color='primary' onClick={handleConfirm} disabled={!canConfirm}>
          {confirmLoading ? <span className='d-inline-flex align-items-center gap-2'><CSpinner size='sm' />Đang nhập...</span> : 'Xác nhận nhập dữ liệu'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}