import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCol,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import {
  deleteGeneratedPhoto,
  getApiMessage,
  getCampaignGeneratedPhotoSummary,
  getCampaignGeneratedPhotos,
  updateGeneratedPhotoStatus,
} from '../services/generatedPhotoService'

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatFileSize(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let current = size
  let unitIndex = 0
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024
    unitIndex += 1
  }
  const digits = current >= 100 || unitIndex === 0 ? 0 : 2
  return `${current.toFixed(digits)} ${units[unitIndex]}`
}

function userLabel(user) {
  if (!user) return 'Anonymous'
  return user.fullName || user.username || user.email || `User #${user.id}`
}

function statusMeta(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'hidden') return { label: 'Hidden', color: 'secondary' }
  return { label: 'Active', color: 'success' }
}

export default function GeneratedPhotoGalleryModal({ visible, campaign, onClose }) {
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState('')
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filters, setFilters] = useState({ status: '', consent: '', userMode: '' })
  const [previewItem, setPreviewItem] = useState(null)

  const sortedRows = useMemo(() => rows, [rows])

  useEffect(() => {
    if (!visible || !campaign?.id) return
    loadAll()
  }, [visible, campaign?.id, filters.status, filters.consent, filters.userMode])

  async function loadAll() {
    if (!campaign?.id) return
    setLoading(true)
    setError('')
    try {
      const [listPayload, summaryPayload] = await Promise.all([
        getCampaignGeneratedPhotos(campaign.id, {
          status: filters.status || undefined,
          consent: filters.consent || undefined,
          userMode: filters.userMode || undefined,
          page: 1,
          pageSize: 100,
        }),
        getCampaignGeneratedPhotoSummary(campaign.id),
      ])
      setRows(Array.isArray(listPayload?.data) ? listPayload.data : [])
      setSummary(summaryPayload || null)
    } catch (requestError) {
      setRows([])
      setSummary(null)
      setError(getApiMessage(requestError, 'Không tải được ảnh đã tạo'))
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleStatus(item) {
    const nextStatus = item?.status === 'hidden' ? 'active' : 'hidden'
    const key = `status:${item.id}`
    setActionId(key)
    setError('')
    setSuccess('')
    try {
      await updateGeneratedPhotoStatus(item.id, nextStatus)
      setSuccess('Đã cập nhật trạng thái ảnh')
      await loadAll()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không cập nhật được trạng thái ảnh'))
    } finally {
      setActionId('')
    }
  }

  async function handleDelete(item) {
    if (!item?.id) return
    if (!window.confirm(`Xóa ảnh đã tạo ${item.originalFilename || item.id}?`)) return
    const key = `delete:${item.id}`
    setActionId(key)
    setError('')
    setSuccess('')
    try {
      await deleteGeneratedPhoto(item.id)
      if (previewItem?.id === item.id) setPreviewItem(null)
      setSuccess('Đã xóa ảnh đã tạo')
      await loadAll()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được ảnh đã tạo'))
    } finally {
      setActionId('')
    }
  }

  function handleDownload(item) {
    const url = String(item?.image?.resolvedUrl || item?.image?.url || '').trim()
    if (!url) return
    const popup = window.open(url, '_blank', 'noopener,noreferrer')
    if (popup) popup.opener = null
  }

  const counts = summary?.counts || {}

  return (
    <>
      <CModal visible={visible} onClose={onClose} size='xl' scrollable>
        <CModalHeader>
          <CModalTitle>{`Ảnh đã tạo • ${campaign?.name || ''}`}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {success ? <CAlert color='success'>{success}</CAlert> : null}
          {error ? <CAlert color='danger'>{error}</CAlert> : null}

          <div className='d-flex flex-wrap gap-2 mb-4'>
            <CBadge color='secondary'>{`Tổng ${counts.total || 0}`}</CBadge>
            <CBadge color='success'>{`Active ${counts.active || 0}`}</CBadge>
            <CBadge color='dark'>{`Hidden ${counts.hidden || 0}`}</CBadge>
            <CBadge color='info'>{`Consent ${counts.consented || 0}`}</CBadge>
            <CBadge color='warning'>{`Anonymous ${counts.anonymous || 0}`}</CBadge>
            <CBadge color='primary'>{`User ${counts.withUser || 0}`}</CBadge>
          </div>

          <CRow className='g-3 mb-4'>
            <CCol md={4}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='active'>Active</option>
                <option value='hidden'>Hidden</option>
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Consent public</CFormLabel>
              <CFormSelect value={filters.consent} onChange={(event) => setFilters((current) => ({ ...current, consent: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='true'>Đã đồng ý công khai</option>
                <option value='false'>Không đồng ý công khai</option>
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>User</CFormLabel>
              <CFormSelect value={filters.userMode} onChange={(event) => setFilters((current) => ({ ...current, userMode: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='user'>Có user</option>
                <option value='anonymous'>Anonymous</option>
              </CFormSelect>
            </CCol>
          </CRow>

          {loading ? (
            <div className='d-flex align-items-center gap-2 py-4'><CSpinner size='sm' /> Đang tải ảnh đã tạo...</div>
          ) : sortedRows.length === 0 ? (
            <div className='text-body-secondary'>Chưa có ảnh đã tạo nào.</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 16,
              }}
            >
              {sortedRows.map((item) => {
                const meta = statusMeta(item.status)
                return (
                  <div key={item.id} className='border rounded-4 p-3 bg-white'>
                    <button
                      type='button'
                      onClick={() => setPreviewItem(item)}
                      style={{ width: '100%', border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }}
                    >
                      <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        {item?.image?.resolvedUrl ? <img src={item.image.resolvedUrl} alt={item.originalFilename || 'generated'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                    </button>
                    <div className='d-flex flex-wrap gap-2 mt-3 mb-2'>
                      <CBadge color={meta.color}>{meta.label}</CBadge>
                      <CBadge color={item.consentPublicGallery ? 'info' : 'secondary'}>{item.consentPublicGallery ? 'Đã đồng ý công khai' : 'Không đồng ý công khai'}</CBadge>
                    </div>
                    <div className='small fw-semibold mb-1'>{item.originalFilename || item.image?.originalName || `Generated #${item.id}`}</div>
                    <div className='small text-body-secondary'>{formatDateTime(item.createdAt)}</div>
                    <div className='small text-body-secondary'>{userLabel(item.user)}</div>
                    <div className='small text-body-secondary'>{formatFileSize(item.fileSize)}</div>
                    <div className='d-flex flex-wrap gap-2 mt-3'>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => setPreviewItem(item)}>Xem lớn</CButton>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => handleDownload(item)}>Tải ảnh</CButton>
                      <CButton size='sm' color='warning' variant='outline' onClick={() => handleToggleStatus(item)} disabled={actionId === `status:${item.id}`}>{item.status === 'hidden' ? 'Hiện' : 'Ẩn'}</CButton>
                      <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item)} disabled={actionId === `delete:${item.id}`}>Xóa</CButton>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={Boolean(previewItem)} onClose={() => setPreviewItem(null)} size='lg'>
        <CModalHeader>
          <CModalTitle>{previewItem?.originalFilename || 'Ảnh đã tạo'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {previewItem?.image?.resolvedUrl ? <img src={previewItem.image.resolvedUrl} alt={previewItem.originalFilename || 'generated'} style={{ width: '100%', borderRadius: 16, border: '1px solid #e2e8f0' }} /> : null}
          {previewItem ? (
            <div className='mt-3 small text-body-secondary d-grid gap-1'>
              <div>{`Campaign: ${previewItem.campaign?.name || '-'}`}</div>
              <div>{`Created: ${formatDateTime(previewItem.createdAt)}`}</div>
              <div>{`User: ${userLabel(previewItem.user)}`}</div>
              <div>{`Session: ${previewItem.sessionId || '-'}`}</div>
              <div>{`Consent: ${previewItem.consentPublicGallery ? 'Đã đồng ý công khai' : 'Không đồng ý công khai'}`}</div>
              <div>{`Status: ${previewItem.status || '-'}`}</div>
              <div>{`File: ${formatFileSize(previewItem.fileSize)}`}</div>
              <div>{`Mime: ${previewItem.mimeType || '-'}`}</div>
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => previewItem && handleDownload(previewItem)}>Tải ảnh</CButton>
          <CButton color='secondary' variant='outline' onClick={() => setPreviewItem(null)}>Đóng</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}