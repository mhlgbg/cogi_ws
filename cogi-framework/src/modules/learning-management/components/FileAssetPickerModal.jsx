import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { getTenantStorageFiles, getApiMessage as getStorageApiMessage, uploadTenantStorageFile } from '../../content-management/services/tenantStorageService'
import { formatDateTime, getFileAssetUrl } from '../utils/questionBankUi'

export default function FileAssetPickerModal({
  visible,
  onClose,
  onSelect,
  title = 'Chọn file',
  acceptedKind = 'all',
  moduleKey = 'question-bank',
}) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [fileInput, setFileInput] = useState(null)

  const acceptValue = useMemo(() => {
    if (acceptedKind === 'audio') return 'audio/*'
    if (acceptedKind === 'image') return 'image/*'
    return '*/*'
  }, [acceptedKind])

  const filteredRows = useMemo(() => {
    if (acceptedKind === 'audio') {
      return rows.filter((item) => String(item?.mimeType || '').toLowerCase().startsWith('audio/'))
    }
    if (acceptedKind === 'image') {
      return rows.filter((item) => String(item?.mimeType || '').toLowerCase().startsWith('image/'))
    }
    return rows
  }, [acceptedKind, rows])

  useEffect(() => {
    if (!visible) return
    loadFiles()
  }, [visible, q])

  async function loadFiles() {
    setLoading(true)
    setError('')
    try {
      const payload = await getTenantStorageFiles({ page: 1, pageSize: 50, keyword: q || undefined, moduleKey })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
    } catch (requestError) {
      setRows([])
      setError(getStorageApiMessage(requestError, 'Không tải được file asset'))
    } finally {
      setLoading(false)
    }
  }

  function resetLocalState() {
    setQ('')
    setQDraft('')
    setError('')
    setSelectedId('')
    setFileInput(null)
    setRows([])
  }

  function handleClose() {
    if (loading || uploading) return
    resetLocalState()
    onClose?.()
  }

  async function handleUpload() {
    if (!fileInput) {
      setError('Vui lòng chọn file để upload')
      return
    }
    setUploading(true)
    setError('')
    try {
      const uploaded = await uploadTenantStorageFile({
        file: fileInput,
        moduleKey,
        isPublic: true,
      })
      setSelectedId(String(uploaded?.id || uploaded?.documentId || ''))
      await loadFiles()
    } catch (requestError) {
      setError(getStorageApiMessage(requestError, 'Không upload được file'))
    } finally {
      setUploading(false)
    }
  }

  function handleConfirm() {
    const selected = filteredRows.find((item) => String(item?.id || item?.documentId || '') === String(selectedId || ''))
    if (!selected) {
      setError('Vui lòng chọn một file asset')
      return
    }
    onSelect?.(selected)
    handleClose()
  }

  return (
    <CModal visible={visible} backdrop='static' size='xl' onClose={handleClose}>
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3 align-items-end mb-4'>
          <CCol md={6}>
            <CFormLabel>Tìm file</CFormLabel>
            <CFormInput value={qDraft} onChange={(event) => setQDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') setQ(String(qDraft || '').trim())
            }} placeholder='Tìm theo tên file, code, module key...' />
          </CCol>
          <CCol md={2}>
            <CButton color='primary' onClick={() => setQ(String(qDraft || '').trim())} disabled={loading}>Search</CButton>
          </CCol>
          <CCol md={4}>
            <CFormLabel>Upload file mới</CFormLabel>
            <div className='d-flex gap-2'>
              <CFormInput type='file' accept={acceptValue} onChange={(event) => setFileInput(event.target.files?.[0] || null)} />
              <CButton color='secondary' variant='outline' onClick={handleUpload} disabled={uploading}>{uploading ? 'Đang upload...' : 'Upload'}</CButton>
            </div>
          </CCol>
        </CRow>

        {loading ? (
          <div className='d-flex align-items-center gap-2 py-4'>
            <CSpinner size='sm' />
            <span>Đang tải danh sách file asset...</span>
          </div>
        ) : (
          <CTable hover responsive align='middle' className='ai-table'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell style={{ width: 70 }}>Chọn</CTableHeaderCell>
                <CTableHeaderCell>Tên file</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 160 }}>Loại</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 180 }}>Module</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 180 }}>Preview</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 180 }}>Cập nhật</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredRows.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={6} className='text-center text-body-secondary'>Chưa có file phù hợp.</CTableDataCell>
                </CTableRow>
              ) : filteredRows.map((item) => {
                const url = getFileAssetUrl(item)
                const isImage = String(item?.mimeType || '').toLowerCase().startsWith('image/')
                const isAudio = String(item?.mimeType || '').toLowerCase().startsWith('audio/')
                const rowId = String(item?.id || item?.documentId || '')
                return (
                  <CTableRow key={rowId} active={selectedId === rowId}>
                    <CTableDataCell>
                      <CFormSelect value={selectedId === rowId ? rowId : ''} onChange={() => setSelectedId(rowId)}>
                        <option value=''>-</option>
                        <option value={rowId}>Chọn</option>
                      </CFormSelect>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className='fw-semibold'>{item?.originalName || item?.fileName || '-'}</div>
                      <div className='small text-body-secondary'>{item?.code || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell>{item?.mimeType || '-'}</CTableDataCell>
                    <CTableDataCell>{item?.moduleKey || '-'}</CTableDataCell>
                    <CTableDataCell>
                      {isImage && url ? <img src={url} alt={item?.originalName || 'asset'} style={{ width: 88, height: 64, objectFit: 'cover', borderRadius: 8 }} /> : null}
                      {isAudio && url ? <audio controls preload='none' src={url} style={{ width: 160 }} /> : null}
                      {!isImage && !isAudio ? <span className='small text-body-secondary'>Không có preview</span> : null}
                    </CTableDataCell>
                    <CTableDataCell>{formatDateTime(item?.updatedAt)}</CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={loading || uploading}>Đóng</CButton>
        <CButton color='primary' onClick={handleConfirm} disabled={loading || uploading}>Chọn file</CButton>
      </CModalFooter>
    </CModal>
  )
}
