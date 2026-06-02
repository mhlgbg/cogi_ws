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
import {
  confirmCandidateExamImport,
  previewCandidateExamImport,
} from '../services/admissionManagementService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function getActionLabel(action) {
  const normalized = String(action || '').trim().toUpperCase()
  if (normalized === 'CREATE') return 'Tạo mới'
  if (normalized === 'UPDATE') return 'Cập nhật'
  if (normalized === 'ERROR') return 'Lỗi'
  if (normalized === 'DUPLICATE_IN_FILE') return 'Trùng trong file'
  if (normalized === 'DELETED_EXISTING') return 'Đã xóa trước đó'
  if (normalized === 'RESTORED') return 'Khôi phục'
  if (normalized === 'SKIP') return 'Bỏ qua'
  return normalized || '-'
}

function getActionColor(action) {
  const normalized = String(action || '').trim().toUpperCase()
  if (normalized === 'CREATE' || normalized === 'RESTORED') return 'success'
  if (normalized === 'UPDATE') return 'info'
  if (normalized === 'DELETED_EXISTING') return 'warning'
  if (normalized === 'SKIP') return 'secondary'
  return 'danger'
}

function buildInitialOptions() {
  return {
    updateExisting: true,
    restoreDeleted: false,
    overwriteScores: false,
    overwriteExamAssignment: true,
  }
}

export default function CandidateExamImportModal({
  visible,
  admissionSeason,
  onClose,
  onImported,
}) {
  const [file, setFile] = useState(null)
  const [options, setOptions] = useState(buildInitialOptions())
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewResult, setPreviewResult] = useState(null)

  useEffect(() => {
    if (!visible) {
      setFile(null)
      setOptions(buildInitialOptions())
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

  const canPreview = Boolean(admissionSeason?.id) && Boolean(file) && !previewLoading && !confirmLoading
  const canConfirm = Boolean(admissionSeason?.id) && Boolean(file) && Boolean(previewResult) && !hasBlockingErrors && !previewLoading && !confirmLoading

  async function handlePreview() {
    if (!admissionSeason?.id || !file) return

    setPreviewLoading(true)
    setError('')

    try {
      const result = await previewCandidateExamImport({
        admissionSeasonId: admissionSeason.id,
        file,
      })
      setPreviewResult(result)
    } catch (requestError) {
      setPreviewResult(null)
      setError(getApiMessage(requestError, 'Không thể xem trước dữ liệu import'))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleConfirm() {
    if (!canConfirm) return

    setConfirmLoading(true)
    setError('')

    try {
      const result = await confirmCandidateExamImport({
        admissionSeasonId: admissionSeason.id,
        file,
        options,
      })
      onImported?.(result)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xác nhận import Excel'))
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='xl' scrollable onClose={() => !previewLoading && !confirmLoading && onClose?.()}>
      <CModalHeader>
        <CModalTitle>Import Excel thí sinh dự kiểm tra</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className='small text-body-secondary mb-3'>Kỳ tuyển sinh đang làm việc: {admissionSeason?.name || '-'}</div>

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

        <div className='d-flex flex-column gap-2 mb-4'>
          <CFormCheck
            id='candidate-exam-import-update-existing'
            label='Cập nhật bản ghi đã tồn tại'
            checked={options.updateExisting}
            disabled={previewLoading || confirmLoading}
            onChange={(event) => setOptions((prev) => ({ ...prev, updateExisting: event.target.checked }))}
          />
          <CFormCheck
            id='candidate-exam-import-restore-deleted'
            label='Khôi phục bản ghi đã xóa nếu trùng mã'
            checked={options.restoreDeleted}
            disabled={previewLoading || confirmLoading}
            onChange={(event) => setOptions((prev) => ({ ...prev, restoreDeleted: event.target.checked }))}
          />
          <CFormCheck
            id='candidate-exam-import-overwrite-scores'
            label='Ghi đè điểm thi'
            checked={options.overwriteScores}
            disabled={previewLoading || confirmLoading}
            onChange={(event) => setOptions((prev) => ({ ...prev, overwriteScores: event.target.checked }))}
          />
          <CFormCheck
            id='candidate-exam-import-overwrite-assignment'
            label='Ghi đè SBD/phòng/địa điểm'
            checked={options.overwriteExamAssignment}
            disabled={previewLoading || confirmLoading}
            onChange={(event) => setOptions((prev) => ({ ...prev, overwriteExamAssignment: event.target.checked }))}
          />
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {previewResult ? (
          <div className='d-flex flex-column gap-3'>
            <CAlert color={hasBlockingErrors ? 'warning' : 'info'} className='mb-0'>
              Tổng dòng: {previewResult?.summary?.totalRows || 0} | Tạo mới: {previewResult?.summary?.createCount || 0} | Cập nhật: {previewResult?.summary?.updateCount || 0} | Lỗi: {previewResult?.summary?.errorCount || 0} | Trùng file: {previewResult?.summary?.duplicateInFileCount || 0} | Bản ghi đã xóa: {previewResult?.summary?.deletedExistingCount || 0} | Bỏ qua: {previewResult?.summary?.skippedCount || 0}
            </CAlert>

            {hasBlockingErrors ? (
              <CAlert color='danger' className='mb-0'>Có lỗi nghiêm trọng trong file import. Vui lòng sửa file và xem trước lại trước khi xác nhận import.</CAlert>
            ) : null}

            <CTable hover responsive align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Dòng Excel</CTableHeaderCell>
                  <CTableHeaderCell>Mã học sinh</CTableHeaderCell>
                  <CTableHeaderCell>Mã hồ sơ</CTableHeaderCell>
                  <CTableHeaderCell>Họ tên</CTableHeaderCell>
                  <CTableHeaderCell>Đường dẫn ảnh thẻ</CTableHeaderCell>
                  <CTableHeaderCell>SBD</CTableHeaderCell>
                  <CTableHeaderCell>Phòng</CTableHeaderCell>
                  <CTableHeaderCell>Điểm khuyến khích</CTableHeaderCell>
                  <CTableHeaderCell>Action</CTableHeaderCell>
                  <CTableHeaderCell>Trường sẽ cập nhật</CTableHeaderCell>
                  <CTableHeaderCell>Lỗi / Cảnh báo</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {(previewResult.rows || []).slice(0, 100).map((row) => (
                  <CTableRow key={`candidate-exam-import-${row.rowIndex}-${row.normalizedData?.studentCode || ''}-${row.normalizedData?.applicationCode || ''}`}>
                    <CTableDataCell>{row.rowIndex || '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.studentCode || '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.applicationCode || '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.fullName || '-'}</CTableDataCell>
                    <CTableDataCell className='small'>{row.normalizedData?.cardImagePath || '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.candidateNumber || '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.examRoom || '-'}</CTableDataCell>
                    <CTableDataCell>{row.normalizedData?.incentiveScore ?? 0}</CTableDataCell>
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
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={previewLoading || confirmLoading}>Đóng</CButton>
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
          ) : 'Xác nhận import'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}