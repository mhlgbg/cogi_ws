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
import GeneratedPhotoGalleryModal from '../components/GeneratedPhotoGalleryModal'
import PhotoFrameCampaignFormModal from '../components/PhotoFrameCampaignFormModal'
import {
  createPhotoFrameCampaign,
  deletePhotoFrameCampaign,
  getApiMessage,
  getPhotoFrameCampaignDetail,
  getPhotoFrameCampaignFormOptions,
  getPhotoFrameCampaigns,
  togglePhotoFrameCampaignStatus,
  updatePhotoFrameCampaign,
  uploadPhotoFrameMedia,
} from '../services/photoFrameCampaignService'

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

function statusMeta(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'active') return { label: 'Active', color: 'success' }
  if (normalized === 'inactive') return { label: 'Inactive', color: 'secondary' }
  return { label: 'Draft', color: 'warning' }
}

function storageModeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'private') return 'Lưu riêng tư'
  if (normalized === 'public_gallery') return 'Public gallery'
  return 'Không lưu'
}

function ownerLabel(ownerUser) {
  if (!ownerUser) return '-'
  return ownerUser.fullName || ownerUser.username || ownerUser.email || `User #${ownerUser.id}`
}

function isPngFile(file) {
  if (!file) return false
  const fileName = String(file.name || '').toLowerCase()
  const mime = String(file.type || '').toLowerCase()
  return mime === 'image/png' || fileName.endsWith('.png')
}

export default function PhotoFrameCampaignManagementPage() {
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, pageCount: 1, total: 0 })
  const [options, setOptions] = useState({ statuses: [], storageModes: [], owners: [], canManageAll: false, canFilterOwners: false, canFilterTenants: false })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [status, setStatus] = useState('')
  const [statusDraft, setStatusDraft] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [ownerIdDraft, setOwnerIdDraft] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [activeId, setActiveId] = useState(null)
  const [activeItem, setActiveItem] = useState(null)
  const [generatedPhotoCampaign, setGeneratedPhotoCampaign] = useState(null)
  const [frameState, setFrameState] = useState({ current: null, pendingFile: null, warning: '' })
  const [actionId, setActionId] = useState('')

  const pages = useMemo(() => buildPages(page, pagination.pageCount || 1), [page, pagination.pageCount])
  const fromToText = useMemo(() => {
    if (!pagination?.total) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, pagination.total)
    return `${from}–${to}/${pagination.total}`
  }, [pagination])

  const framePreviewUrl = useMemo(() => {
    if (frameState.pendingFile) {
      return URL.createObjectURL(frameState.pendingFile)
    }
    return String(frameState.current?.url || '').trim()
  }, [frameState.current, frameState.pendingFile])

  useEffect(() => {
    if (!frameState.pendingFile || !framePreviewUrl.startsWith('blob:')) return undefined
    return () => URL.revokeObjectURL(framePreviewUrl)
  }, [framePreviewUrl, frameState.pendingFile])

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    loadRows()
  }, [page, pageSize, q, status, ownerId])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  async function loadOptions() {
    try {
      const payload = await getPhotoFrameCampaignFormOptions()
      setOptions(payload || { statuses: [], storageModes: [], owners: [] })
    } catch (requestError) {
      setOptions({ statuses: [], storageModes: [], owners: [], canManageAll: false, canFilterOwners: false, canFilterTenants: false })
      setError(getApiMessage(requestError, 'Không tải được cấu hình form Frame Campaign'))
    }
  }

  async function loadRows() {
    setLoading(true)
    setError('')
    try {
      const payload = await getPhotoFrameCampaigns({
        page,
        pageSize,
        q: q || undefined,
        status: status || undefined,
        ownerId: ownerId || undefined,
      })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
      setPagination(payload?.pagination || { page: 1, pageSize, pageCount: 1, total: 0 })
    } catch (requestError) {
      setRows([])
      setPagination({ page: 1, pageSize, pageCount: 1, total: 0 })
      setError(getApiMessage(requestError, 'Không tải được danh sách Frame Campaign'))
    } finally {
      setLoading(false)
    }
  }

  function resetModalState() {
    setActiveId(null)
    setActiveItem(null)
    setFrameState({ current: null, pendingFile: null, warning: '' })
  }

  function openCreateModal() {
    resetModalState()
    setModalMode('create')
    setModalVisible(true)
  }

  async function openExistingModal(id, mode) {
    setModalMode(mode)
    setActiveId(id)
    setDetailLoading(true)
    setError('')
    try {
      const detail = await getPhotoFrameCampaignDetail(id)
      setActiveItem(detail)
      setFrameState({ current: detail?.frameImage || null, pendingFile: null, warning: '' })
      setModalVisible(true)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được chi tiết Frame Campaign'))
    } finally {
      setDetailLoading(false)
    }
  }

  function closeModal() {
    if (submitting) return
    setModalVisible(false)
    resetModalState()
  }

  function openGeneratedPhotos(item) {
    setGeneratedPhotoCampaign(item)
  }

  function closeGeneratedPhotos() {
    setGeneratedPhotoCampaign(null)
  }

  function applyFilters() {
    setPage(1)
    setQ(qDraft.trim())
    setStatus(statusDraft)
    setOwnerId(ownerIdDraft)
  }

  function resetFilters() {
    setPage(1)
    setQ('')
    setQDraft('')
    setStatus('')
    setStatusDraft('')
    setOwnerId('')
    setOwnerIdDraft('')
  }

  function handleFrameChange(file) {
    if (!file) return
    if (!isPngFile(file)) {
      setFrameState((prev) => ({ ...prev, pendingFile: null, warning: 'Chỉ nên upload file PNG nền trong suốt cho frameImage.' }))
      return
    }
    setFrameState((prev) => ({ ...prev, pendingFile: file, warning: '' }))
  }

  async function handleSubmit(payload) {
    if (!frameState.current && !frameState.pendingFile && modalMode === 'create') {
      setError('Vui lòng upload file PNG cho khung hình')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const nextPayload = { ...payload }
      if (frameState.pendingFile) {
        const uploaded = await uploadPhotoFrameMedia(frameState.pendingFile)
        nextPayload.frameImage = uploaded?.id || null
      } else {
        nextPayload.frameImage = frameState.current?.id || null
      }

      if (!nextPayload.frameImage) {
        throw new Error('Frame image là bắt buộc')
      }

      if (modalMode === 'edit' && activeId) {
        await updatePhotoFrameCampaign(activeId, nextPayload)
        setSuccess('Đã cập nhật Frame Campaign')
      } else {
        await createPhotoFrameCampaign(nextPayload)
        setSuccess('Đã tạo Frame Campaign')
      }

      closeModal()
      await Promise.all([loadRows(), loadOptions()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu Frame Campaign'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopyLink(item) {
    try {
      await navigator.clipboard.writeText(String(item?.publicUrl || ''))
      setSuccess('Đã sao chép link public')
      setError('')
    } catch {
      setError('Không thể sao chép link public')
    }
  }

  function handleOpenLink(item) {
    const url = String(item?.publicUrl || '').trim()
    if (!url) return
    const popup = window.open(url, '_blank', 'noopener,noreferrer')
    if (popup) popup.opener = null
  }

  async function handleToggleStatus(item) {
    if (!item?.id) return
    const key = `toggle:${item.id}`
    setActionId(key)
    setError('')
    setSuccess('')
    try {
      await togglePhotoFrameCampaignStatus(item.id, {
        status: item.status === 'active' ? 'inactive' : 'active',
      })
      setSuccess('Đã cập nhật trạng thái Frame Campaign')
      await loadRows()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không cập nhật được trạng thái'))
    } finally {
      setActionId('')
    }
  }

  async function handleDelete(item) {
    if (!item?.id) return
    if (!window.confirm(`Xóa campaign ${item.name || item.slug || item.id}?`)) return
    const key = `delete:${item.id}`
    setActionId(key)
    setError('')
    setSuccess('')
    try {
      await deletePhotoFrameCampaign(item.id)
      setSuccess('Đã xóa Frame Campaign')
      await Promise.all([loadRows(), loadOptions()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được Frame Campaign'))
    } finally {
      setActionId('')
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Khung hình / Frame Campaigns</strong>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={loadRows} disabled={loading}>Tải lại</CButton>
              <CButton color='primary' onClick={openCreateModal}>Thêm Frame Campaign</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            {success ? <CAlert color='success'>{success}</CAlert> : null}
            {error ? <CAlert color='danger'>{error}</CAlert> : null}

            <CRow className='g-3 mb-4'>
              <CCol md={4}>
                <CFormLabel>Tìm theo tên hoặc slug</CFormLabel>
                <CFormInput value={qDraft} onChange={(event) => setQDraft(event.target.value)} placeholder='frame-tet-2026' />
              </CCol>
              <CCol md={3}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                  <option value=''>Tất cả</option>
                  {(Array.isArray(options?.statuses) ? options.statuses : []).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </CFormSelect>
              </CCol>
              {options?.canFilterOwners ? (
                <CCol md={3}>
                  <CFormLabel>Owner</CFormLabel>
                  <CFormSelect value={ownerIdDraft} onChange={(event) => setOwnerIdDraft(event.target.value)}>
                    <option value=''>Tất cả owner</option>
                    {(Array.isArray(options?.owners) ? options.owners : []).map((item) => (
                      <option key={item.id} value={item.id}>{ownerLabel(item)}</option>
                    ))}
                  </CFormSelect>
                </CCol>
              ) : null}
              <CCol md={options?.canFilterOwners ? 2 : 5} className='d-flex align-items-end'>
                <div className='d-flex gap-2 w-100'>
                  <CButton color='primary' onClick={applyFilters}>Lọc</CButton>
                  <CButton color='secondary' variant='outline' onClick={resetFilters}>Đặt lại</CButton>
                </div>
              </CCol>
            </CRow>

            <div className='d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3'>
              <div className='small text-body-secondary'>Hiển thị {fromToText}</div>
              <div className='d-flex align-items-center gap-2'>
                <span className='small text-body-secondary'>Số dòng/trang</span>
                <CFormSelect value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value) || 10) }} style={{ width: 96 }}>
                  {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </CFormSelect>
              </div>
            </div>

            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 96 }}>Thumbnail</CTableHeaderCell>
                  <CTableHeaderCell>Tên</CTableHeaderCell>
                  <CTableHeaderCell>Slug</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Chế độ lưu ảnh</CTableHeaderCell>
                  <CTableHeaderCell>Bắt đầu</CTableHeaderCell>
                  <CTableHeaderCell>Kết thúc</CTableHeaderCell>
                  <CTableHeaderCell>Ngày tạo</CTableHeaderCell>
                  {options?.canManageAll ? <CTableHeaderCell>Owner</CTableHeaderCell> : null}
                  <CTableHeaderCell className='text-end'>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {loading ? (
                  <CTableRow>
                    <CTableDataCell colSpan={options?.canManageAll ? 10 : 9} className='text-center py-4'><CSpinner size='sm' /> Đang tải dữ liệu...</CTableDataCell>
                  </CTableRow>
                ) : rows.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={options?.canManageAll ? 10 : 9} className='text-center py-4 text-body-secondary'>Chưa có Frame Campaign nào.</CTableDataCell>
                  </CTableRow>
                ) : rows.map((item) => {
                  const meta = statusMeta(item.status)
                  return (
                    <CTableRow key={item.id}>
                      <CTableDataCell>
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 12,
                            overflow: 'hidden',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            backgroundImage: 'linear-gradient(45deg, #dbe4f0 25%, transparent 25%), linear-gradient(-45deg, #dbe4f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #dbe4f0 75%), linear-gradient(-45deg, transparent 75%, #dbe4f0 75%)',
                            backgroundSize: '18px 18px',
                            backgroundPosition: '0 0, 0 9px, 9px -9px, -9px 0px',
                          }}
                        >
                          {item?.frameImage?.url ? <img src={item.frameImage.url} alt={item.name || item.slug || 'frame'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{item.name || '-'}</div>
                        <div className='small text-body-secondary'>{item.width} x {item.height}</div>
                      </CTableDataCell>
                      <CTableDataCell>{item.slug || '-'}</CTableDataCell>
                      <CTableDataCell><CBadge color={meta.color}>{meta.label}</CBadge></CTableDataCell>
                      <CTableDataCell>{storageModeLabel(item.generatedImageStorageMode)}</CTableDataCell>
                      <CTableDataCell>{formatDateTime(item.startAt)}</CTableDataCell>
                      <CTableDataCell>{formatDateTime(item.endAt)}</CTableDataCell>
                      <CTableDataCell>{formatDateTime(item.createdAt)}</CTableDataCell>
                      {options?.canManageAll ? <CTableDataCell>{ownerLabel(item.ownerUser)}</CTableDataCell> : null}
                      <CTableDataCell className='text-end'>
                        <div className='d-flex flex-wrap gap-2 justify-content-end'>
                          <CButton size='sm' color='secondary' variant='outline' onClick={() => openExistingModal(item.id, 'view')} disabled={detailLoading}>Xem</CButton>
                          <CButton size='sm' color='primary' variant='outline' onClick={() => openExistingModal(item.id, 'edit')} disabled={detailLoading}>Sửa</CButton>
                          {item.generatedImageStorageMode !== 'none' ? <CButton size='sm' color='dark' variant='outline' onClick={() => openGeneratedPhotos(item)}>Ảnh đã tạo</CButton> : null}
                          <CButton size='sm' color='info' variant='outline' onClick={() => handleCopyLink(item)}>Sao chép link</CButton>
                          <CButton size='sm' color='info' onClick={() => handleOpenLink(item)}>Mở thử</CButton>
                          <CButton size='sm' color={item.status === 'active' ? 'warning' : 'success'} variant='outline' onClick={() => handleToggleStatus(item)} disabled={actionId === `toggle:${item.id}`}>
                            {item.status === 'active' ? 'Tắt' : 'Bật'}
                          </CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item)} disabled={actionId === `delete:${item.id}`}>Xóa</CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>

            <div className='d-flex justify-content-end mt-3'>
              <CPagination align='end'>
                <CPaginationItem disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trước</CPaginationItem>
                {pages.map((item, index) => (
                  <CPaginationItem
                    key={`${item}:${index}`}
                    active={item === page}
                    disabled={item === '...'}
                    onClick={() => typeof item === 'number' && setPage(item)}
                  >
                    {item}
                  </CPaginationItem>
                ))}
                <CPaginationItem disabled={page >= (pagination.pageCount || 1)} onClick={() => setPage((current) => Math.min(pagination.pageCount || 1, current + 1))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      <PhotoFrameCampaignFormModal
        visible={modalVisible}
        mode={modalMode}
        initialValues={activeItem}
        formOptions={options}
        submitting={submitting}
        framePreviewUrl={framePreviewUrl}
        frameFileName={frameState.pendingFile?.name || frameState.current?.name || ''}
        fileWarning={frameState.warning}
        onFrameChange={handleFrameChange}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <GeneratedPhotoGalleryModal
        visible={Boolean(generatedPhotoCampaign)}
        campaign={generatedPhotoCampaign}
        onClose={closeGeneratedPhotos}
      />
    </CRow>
  )
}