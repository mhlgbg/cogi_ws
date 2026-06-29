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
  confirmCandidateExamRecheckImport,
  downloadCandidateExamRecheckImportTemplate,
  previewCandidateExamRecheckImport,
} from '../services/admissionManagementService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function getActionLabel(action) {
  const normalized = String(action || '').trim().toUpperCase()
  if (normalized === 'UPDATE') return 'Cập nhật'
  if (normalized === 'ERROR') return 'Lỗi'
  if (normalized === 'DUPLICATE_IN_FILE') return 'Trùng trong file'
  if (normalized === 'SKIP') return 'Bỏ qua'
  return normalized || '-'
}

function getActionColor(action) {
  const normalized = String(action || '').trim().toUpperCase()
  if (normalized === 'UPDATE') return 'info'
  if (normalized === 'SKIP') return 'secondary'
  return 'danger'
}

export default function CandidateExamRecheckImportModal({
  visible,
  admissionSeason,
  onClose,
  onImported,
}) {
  const [file, setFile] = useState(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewResult, setPreviewResult] = useState(null)

  useEffect(() => {
    if (!visible) {
      setFile(null)
      setDownloadingTemplate(false)
      setPreviewLoading(false)
      setConfirmLoading(false)
      setError('')
      setPreviewResult(null)
    }
  }, [visible])

  const hasBlockingErrors = useMemo(() => (
    Array.isArray(previewResult?.rows)
      ? previewResult.rows.some((row) => row?.action === 'ERROR' || row?.action === 'DUPLICATE_IN_FILE')
      : false
  ), [previewResult])

  const blockingErrorRowIndexes = useMemo(() => (
    Array.isArray(previewResult?.rows)
      ? previewResult.rows
        .filter((row) => row?.action === 'ERROR' || row?.action === 'DUPLICATE_IN_FILE')
        .map((row) => Number(row?.rowIndex || 0))
        .filter((rowIndex) => Number.isInteger(rowIndex) && rowIndex > 0)
      : []
  ), [previewResult])

  const canPreview = Boolean(admissionSeason?.id) && Boolean(file) && !previewLoading && !confirmLoading
  const canConfirm = Boolean(admissionSeason?.id) && Boolean(file) && Boolean(previewResult) && !hasBlockingErrors && !previewLoading && !confirmLoading

  async function handleDownloadTemplate() {
    setError('')
    setDownloadingTemplate(true)
    try {
      const result = await downloadCandidateExamRecheckImportTemplate()
      const blob = result?.blob instanceof Blob
        ? result.blob
        : new Blob([result?.blob], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result?.fileName || 'candidate-exam-score-import-template.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải file mẫu import phúc khảo'))
    } finally {
      setDownloadingTemplate(false)
    }
  }

  async function handlePreview() {
    if (!admissionSeason?.id || !file) return

    setPreviewLoading(true)
    setError('')

    try {
      const result = await previewCandidateExamRecheckImport({
        admissionSeasonId: admissionSeason.id,
        file,
      })
      setPreviewResult(result)
    } catch (requestError) {
      setPreviewResult(null)
      setError(getApiMessage(requestError, 'Không thể xem trước dữ liệu import phúc khảo'))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleConfirm() {
    if (!canConfirm) return

    setConfirmLoading(true)
    setError('')

    try {
      const result = await confirmCandidateExamRecheckImport({
        admissionSeasonId: admissionSeason.id,
        file,
      })
      onImported?.(result)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xác nhận import phúc khảo'))
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='xl' scrollable onClose={() => !previewLoading && !confirmLoading && !downloadingTemplate && onClose?.()}>
      <CModalHeader>
        <CModalTitle>Import phúc khảo thí sinh</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className='small text-body-secondary mb-2'>Kỳ tuyển sinh đang làm việc: {admissionSeason?.name || '-'}</div>
        <div className='small text-body-secondary mb-3'>File mẫu gồm các cột: <strong>Số báo danh</strong>, <strong>Phúc khảo các môn (có/không)</strong>, <strong>Điểm sau phúc khảo các môn</strong> cùng các cột điểm gốc nếu cần.</div>

        <div className='d-flex flex-wrap gap-2 mb-3'>
          <CButton color='secondary' variant='outline' onClick={handleDownloadTemplate} disabled={downloadingTemplate || previewLoading || confirmLoading}>
            {downloadingTemplate ? 'Đang tải mẫu...' : 'Tải file mẫu phúc khảo'}
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
              setPreviewResult(null)
            }}
          />
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {previewResult ? (
          <div className='d-flex flex-column gap-3'>
            <CAlert color={hasBlockingErrors ? 'warning' : 'info'} className='mb-0'>
              Tổng dòng: {previewResult?.summary?.totalRows || 0} | Cập nhật: {previewResult?.summary?.updateCount || 0} | Bỏ qua: {previewResult?.summary?.skippedCount || 0} | Lỗi: {previewResult?.summary?.errorCount || 0} | Trùng file: {previewResult?.summary?.duplicateInFileCount || 0}
            </CAlert>

            {hasBlockingErrors ? (
              <CAlert color='danger' className='mb-0'>
                <div>Có lỗi trong file import phúc khảo. Vui lòng sửa file và xem trước lại trước khi xác nhận.</div>
                {blockingErrorRowIndexes.length > 0 ? (
                  <div className='mt-2'>Dòng lỗi: <strong>{blockingErrorRowIndexes.join(', ')}</strong></div>
                ) : null}
              </CAlert>
            ) : null}

            <CTable hover responsive align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Dòng Excel</CTableHeaderCell>
                  <CTableHeaderCell>Số báo danh</CTableHeaderCell>
                  <CTableHeaderCell>Phúc khảo Toán</CTableHeaderCell>
                  <CTableHeaderCell>Phúc khảo Tiếng Việt</CTableHeaderCell>
                  <CTableHeaderCell>Phúc khảo Tiếng Anh</CTableHeaderCell>
                  <CTableHeaderCell>Điểm sau PK Toán</CTableHeaderCell>
                  <CTableHeaderCell>Điểm sau PK Tiếng Việt</CTableHeaderCell>
                  <CTableHeaderCell>Điểm sau PK Tiếng Anh</CTableHeaderCell>
                  <CTableHeaderCell>Tổng điểm mới</CTableHeaderCell>
                  <CTableHeaderCell>Action</CTableHeaderCell>
                  <CTableHeaderCell>Trường sẽ cập nhật</CTableHeaderCell>
                  <CTableHeaderCell>Lỗi / Cảnh báo</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {(previewResult.rows || []).slice(0, 100).map((row) => (
                  <CTableRow key={`candidate-exam-recheck-import-${row.rowIndex}-${row.normalizedData?.candidateNumber || ''}`}>
                    <CTableDataCell>{row.rowIndex || '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.candidateNumber || '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.recheckMath ? 'Có' : 'Không'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.recheckVietnamese ? 'Có' : 'Không'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.recheckEnglish ? 'Có' : 'Không'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.recheckMathScore ?? '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.recheckVietnameseScore ?? '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.recheckEnglishScore ?? '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.totalScore ?? '-'}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getActionColor(row.action)}>{getActionLabel(row.action)}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell className='small'>
                      {Array.isArray(row.changedFields) && row.changedFields.length > 0 ? row.changedFields.join(' | ') : '-'}
                    </CTableDataCell>
                    <CTableDataCell>
                      {Array.isArray(row.errors) && row.errors.length > 0 ? row.errors.join(' | ') : ''}
                      {Array.isArray(row.errors) && row.errors.length > 0 && Array.isArray(row.warnings) && row.warnings.length > 0 ? ' || ' : ''}
                      {Array.isArray(row.warnings) && row.warnings.length > 0 ? row.warnings.join(' | ') : '-'}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={downloadingTemplate || previewLoading || confirmLoading}>Đóng</CButton>
        <CButton color='info' onClick={handlePreview} disabled={!canPreview}>
          {previewLoading ? (
            <span className='d-inline-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              Đang xem trước...
            </span>
          ) : 'Xem trước import'}
        </CButton>
        <CButton color='primary' onClick={handleConfirm} disabled={!canConfirm}>
          {confirmLoading ? (
            <span className='d-inline-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              Đang import...
            </span>
          ) : 'Xác nhận import phúc khảo'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
