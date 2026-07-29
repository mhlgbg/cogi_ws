import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CNav,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CFormLabel,
  CForm,
  CFormInput,
  CFormSelect,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CSpinner,
  CButton,
} from '@coreui/react'
import { getLuckyWheel, getLuckyWheelPrizes, exportParticipants, exportResults, createLuckyWheelPrize, updateLuckyWheelPrize, updateLuckyWheel, openLuckyWheel, closeLuckyWheel, getLuckyWheelParticipants, getLuckyWheelResults, getLuckyWheelPresentation, verifyLuckyWheelResult, createLuckyWheelParticipant, updateLuckyWheelParticipant, blockLuckyWheelParticipant, unblockLuckyWheelParticipant, generateLuckyWheelParticipantCodes, claimLuckyWheelResult } from '../services/luckyWheelService'
import { uploadTenantStorageFile, getApiMessage as storageApiMessage } from '../../content-management/services/tenantStorageService'
import api from '../../../api/axios'
import * as XLSX from 'xlsx'

function resolveLuckyWheelTab(pathname = '') {
  if (/\/slides(?:\/)?$/i.test(pathname)) return 'slides'
  if (/\/(spins|results)(?:\/)?$/i.test(pathname)) return 'spins'
  if (/\/participants(?:\/)?$/i.test(pathname)) return 'participants'
  if (/\/settings(?:\/)?$/i.test(pathname)) return 'settings'
  return 'prizes'
}

function buildLuckyWheelTabPath(id, tab, tenantCode = '') {
  const prefix = tenantCode ? `/t/${encodeURIComponent(tenantCode)}` : ''
  if (tab === 'participants') return `${prefix}/lucky-wheels/${id}/participants`
  if (tab === 'settings') return `${prefix}/lucky-wheels/${id}/settings`
  if (tab === 'spins') return `${prefix}/lucky-wheels/${id}/results`
  if (tab === 'slides') return `${prefix}/lucky-wheels/${id}/slides`
  return `${prefix}/lucky-wheels/${id}`
}

function getStatusMeta(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'opened') return { label: 'Đang mở', bg: '#dcfce7', color: '#166534' }
  if (normalized === 'closed') return { label: 'Đã đóng', bg: '#e5e7eb', color: '#374151' }
  if (normalized === 'cancelled') return { label: 'Đã hủy', bg: '#fee2e2', color: '#991b1b' }
  return { label: 'Nháp', bg: '#fef3c7', color: '#92400e' }
}

function SpinnerCenter() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <CSpinner />
    </div>
  )
}

const EditHeaderForm = ({ wheel, onClose = null, onSaved = null }) => {
  const [name, setName] = useState(wheel?.name || '')
  const [description, setDescription] = useState(wheel?.description || '')
  const [startAt, setStartAt] = useState(wheel?.startAt ? new Date(wheel.startAt).toISOString().slice(0,16) : '')
  const [endAt, setEndAt] = useState(wheel?.endAt ? new Date(wheel.endAt).toISOString().slice(0,16) : '')
  const [participationMode, setParticipationMode] = useState(wheel?.participationMode || 'predefined')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(wheel?.name || '')
    setDescription(wheel?.description || '')
    setStartAt(wheel?.startAt ? new Date(wheel.startAt).toISOString().slice(0,16) : '')
    setEndAt(wheel?.endAt ? new Date(wheel.endAt).toISOString().slice(0,16) : '')
    setParticipationMode(wheel?.participationMode || 'predefined')
  }, [wheel])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const payload = {
        name,
        description,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        participationMode,
      }
      const updated = await updateLuckyWheel(wheel.id, payload)
      if (typeof onSaved === 'function') onSaved(updated)
    } catch (e) {
      window.alert(e?.response?.data?.message || e?.message || 'Lỗi khi lưu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CForm onSubmit={(e) => { e.preventDefault(); handleSave() }}>
      <div className='mb-3'>
        <CFormLabel>Tên</CFormLabel>
        <CFormInput value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className='mb-3'>
        <CFormLabel>Mô tả</CFormLabel>
        <CFormInput value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Thời gian bắt đầu</CFormLabel>
        <CFormInput type='datetime-local' value={startAt} onChange={(e) => setStartAt(e.target.value)} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Thời gian kết thúc</CFormLabel>
        <CFormInput type='datetime-local' value={endAt} onChange={(e) => setEndAt(e.target.value)} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Participation Mode</CFormLabel>
        <CFormSelect value={participationMode} onChange={(e) => setParticipationMode(e.target.value)}>
          <option value='predefined'>predefined</option>
          <option value='open'>open</option>
        </CFormSelect>
      </div>
      <div className='d-flex justify-content-end gap-2'>
        <CButton color='secondary' onClick={() => { if (typeof onClose === 'function') onClose() }}>Hủy</CButton>
        <CButton type='submit' color='primary' disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</CButton>
      </div>
    </CForm>
  )
}

export default function LuckyWheelDetailPage() {
  const { id, tenantCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [wheel, setWheel] = useState(null)
  const [showEditHeader, setShowEditHeader] = useState(false)
  const [editing, setEditing] = useState(false)
  const activeTab = useMemo(() => resolveLuckyWheelTab(location.pathname), [location.pathname])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const data = await getLuckyWheel(id)
        if (!mounted) return
        setWheel(data)
      } catch (e) {
        setWheel(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  if (loading) return <SpinnerCenter />
  if (!wheel) return (
    <CContainer className='py-5'>
      <CRow className='justify-content-center'>
        <CCol md={8}>
          <CCard><CCardBody className='text-center'>Không tìm thấy vòng quay.</CCardBody></CCard>
        </CCol>
      </CRow>
    </CContainer>
  )

  return (
    <CContainer fluid className='py-4'>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CButton color='secondary' onClick={() => navigate('/lucky-wheels')} className='me-2'>← Quay lại</CButton>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{wheel.name}</div>
              <div className='text-muted'>{wheel.code}</div>
            </div>
          </div>
          <div className='mb-3 text-muted' style={{ marginTop: 8 }}>{wheel.description}</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <div><strong>Trạng thái:</strong> <span className='text-muted'>{wheel.status || ''}</span></div>
            <div><strong>Participation:</strong> <span className='text-muted'>{wheel.participationMode || ''}</span></div>
            <div><strong>Bắt đầu:</strong> <span className='text-muted'>{wheel.startAt ? new Date(wheel.startAt).toLocaleString() : '—'}</span></div>
            <div><strong>Kết thúc:</strong> <span className='text-muted'>{wheel.endAt ? new Date(wheel.endAt).toLocaleString() : '—'}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <CButton color='warning' onClick={() => setShowEditHeader(true)}>Sửa thông tin</CButton>
          {wheel.participationMode === 'open' ? (
            <CButton color='info' onClick={async () => {
              if (!window.confirm('Chuyển sang participationMode: predefined?')) return
              try {
                const updated = await updateLuckyWheel(wheel.id, { participationMode: 'predefined' })
                setWheel(updated)
                window.alert('Đã đổi chế độ')
              } catch (e) { window.alert(e?.message || 'Lỗi') }
            }}>Đổi sang Predefined</CButton>
          ) : (
            <CButton color='info' onClick={async () => {
              if (!window.confirm('Chuyển sang participationMode: open?')) return
              try {
                const updated = await updateLuckyWheel(wheel.id, { participationMode: 'open' })
                setWheel(updated)
                window.alert('Đã đổi chế độ')
              } catch (e) { window.alert(e?.message || 'Lỗi') }
            }}>Đổi sang Open</CButton>
          )}
          {wheel.status !== 'opened' ? (
            <CButton color='success' onClick={async () => {
              if (!window.confirm('Mở vòng quay?')) return
              try {
                const res = await openLuckyWheel(wheel.id)
                if (res) setWheel(await getLuckyWheel(wheel.id))
                window.alert('Vòng quay đã mở')
              } catch (e) { window.alert(e?.message || 'Lỗi') }
            }}>Mở vòng quay</CButton>
          ) : (
            <CButton color='danger' onClick={async () => {
              if (!window.confirm('Đóng vòng quay?')) return
              try {
                const res = await closeLuckyWheel(wheel.id)
                if (res) setWheel(await getLuckyWheel(wheel.id))
                window.alert('Vòng quay đã đóng')
              } catch (e) { window.alert(e?.message || 'Lỗi') }
            }}>Đóng vòng quay</CButton>
          )}
        </div>
      </div>

          <CNav variant="tabs">
            <CNavItem>
              <CNavLink active={activeTab === 'prizes'} onClick={() => navigate(buildLuckyWheelTabPath(id, 'prizes', tenantCode))}>Phần thưởng</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'participants'} onClick={() => navigate(buildLuckyWheelTabPath(id, 'participants', tenantCode))}>Người chơi</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'settings'} onClick={() => navigate(buildLuckyWheelTabPath(id, 'settings', tenantCode))}>Cấu hình</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'spins'} onClick={() => navigate(buildLuckyWheelTabPath(id, 'spins', tenantCode))}>Kết quả</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'slides'} onClick={() => navigate(buildLuckyWheelTabPath(id, 'slides', tenantCode))}>Trình chiếu</CNavLink>
            </CNavItem>
          </CNav>

          <CTabContent>
            <CTabPane visible={activeTab === 'prizes'}>
              <CCard className='mt-3'><CCardBody>
                <h5>Danh sách phần thưởng</h5>
                <PrizeList wheelId={wheel.id} />
              </CCardBody></CCard>
            </CTabPane>

            <CTabPane visible={activeTab === 'participants'}>
              <CCard className='mt-3'><CCardBody>
                <h5>Người chơi</h5>
                <div className='mb-2'>
                  <CButton color='primary' onClick={() => navigate(`/lucky-wheels/${id}/participants`)}>Quản lý chi tiết người chơi</CButton>
                  <CButton className='ms-2' color='secondary' onClick={async () => { const resp = await exportParticipants(id); if (resp) window.alert('Export started') }}>Xuất người chơi</CButton>
                </div>
                <ParticipantList wheelId={id} />
              </CCardBody></CCard>
            </CTabPane>

            <CTabPane visible={activeTab === 'settings'}>
              <CCard className='mt-3'><CCardBody>
                <h5>Cấu hình</h5>
                <ParticipantFormConfig wheel={wheel} onSaved={(updated) => setWheel(updated)} />
              </CCardBody></CCard>
            </CTabPane>

            <CTabPane visible={activeTab === 'spins'}>
              <CCard className='mt-3'><CCardBody>
                <h5>Kết quả quay</h5>
                <div className='mb-2'>
                  <CButton color='secondary' onClick={async () => { const resp = await exportResults(id); if (resp) window.alert('Export started') }}>Xuất kết quả</CButton>
                </div>
                <ResultList wheelId={id} wheel={wheel} />
              </CCardBody></CCard>
            </CTabPane>

            <CTabPane visible={activeTab === 'slides'}>
              <CCard className='mt-3'><CCardBody>
                <h5>Trình chiếu</h5>
                <PresentationTab wheelId={id} wheel={wheel} />
              </CCardBody></CCard>
            </CTabPane>
          </CTabContent>
      {/* Edit header modal */}
      <CModal visible={showEditHeader} onClose={() => setShowEditHeader(false)}>
        <CModalHeader closeButton>Chỉnh sửa thông tin vòng quay</CModalHeader>
        <CModalBody>
          <EditHeaderForm wheel={wheel} onClose={() => setShowEditHeader(false)} onSaved={(updated) => { setWheel(updated); setShowEditHeader(false) }} />
        </CModalBody>
      </CModal>
    </CContainer>
  )
}

function PrizeList({ wheelId }) {
  const [prizes, setPrizes] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editPrize, setEditPrize] = useState(null)
  const [uploading, setUploading] = useState(false)
  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const rows = await getLuckyWheelPrizes(wheelId)
        if (!mounted) return
        setPrizes(rows)
      } catch (e) {
        setPrizes([])
      }
    }
    load()
    return () => { mounted = false }
  }, [wheelId])

  if (prizes === null) return <div style={{ padding: 20 }}><CSpinner /></div>
  function normalizePrize(p) {
    if (!p) return null
    const attrs = p.attributes || p
    return {
      id: p.id || attrs.id,
      name: attrs.name || '',
      description: attrs.description || '',
      quantity: attrs.quantity || 0,
      remainingQuantity: attrs.remainingQuantity || 0,
      weight: attrs.weight || 1,
      isNoPrize: Boolean(attrs.isNoPrize),
      isActive: attrs.isActive !== false,
      image: attrs.image || null,
      displayColor: attrs.displayColor || '',
      textColor: attrs.textColor || '',
    }
  }

  async function handleUploadFile(file) {
    if (!file) return null
    setUploading(true)
    try {
      const uploaded = await uploadTenantStorageFile({ file, moduleKey: 'lucky-wheel', entityType: 'prize', entityId: String(wheelId), isPublic: true })
      return uploaded
    } catch (e) {
      window.alert(storageApiMessage(e, 'Không thể upload ảnh'))
      return null
    } finally {
      setUploading(false)
    }
  }

  async function handleCreateSubmit(form) {
    if (creating) return
    setCreating(true)
    try {
      let payload = { ...form }
      if (form.file instanceof File) {
        const uploaded = await handleUploadFile(form.file)
        if (uploaded) payload.image = uploaded.id
      } else {
        delete payload.image
      }
      const created = await createLuckyWheelPrize(wheelId, payload)
      if (created) {
        await (async () => { const rows = await getLuckyWheelPrizes(wheelId); setPrizes(rows) })()
        setShowCreate(false)
        window.alert('Tạo phần thưởng thành công')
      }
    } catch (e) {
      window.alert((e?.response?.data?.message) || e?.message || 'Lỗi khi tạo')
    } finally { setCreating(false) }
  }

  async function handleEditSubmit(id, form) {
    if (creating) return
    setCreating(true)
    try {
      let payload = { ...form }
      if (form.file instanceof File) {
        const uploaded = await handleUploadFile(form.file)
        if (uploaded) payload.image = uploaded.id
      } else if (form.removeImage) {
        payload.image = null
      } else {
        delete payload.image
      }
      const updated = await updateLuckyWheelPrize(wheelId, id, payload)
      if (updated) {
        const rows = await getLuckyWheelPrizes(wheelId)
        setPrizes(rows)
        setEditPrize(null)
        window.alert('Cập nhật thành công')
      }
    } catch (e) {
      window.alert((e?.response?.data?.message) || e?.message || 'Lỗi khi cập nhật')
    } finally { setCreating(false) }
  }

  async function handleDelete(id) {
    if (!id) return
    if (!window.confirm('Xóa phần thưởng này?')) return
    try {
      await api.delete(`/lucky-wheels/${wheelId}/prizes/${id}`)
      const rows = await getLuckyWheelPrizes(wheelId)
      setPrizes(rows)
      window.alert('Đã xóa')
    } catch (e) {
      window.alert((e?.response?.data?.message) || e?.message || 'Lỗi khi xóa')
    }
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-center mb-2'>
        <div />
        <div>
          <CButton color='primary' onClick={() => setShowCreate(true)}>Thêm giải thưởng</CButton>
        </div>
      </div>
      {prizes.length === 0 ? <div className='text-muted'>Chưa có phần thưởng.</div> : (
        <div className='table-responsive'>
          <table className='table table-hover align-middle'>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Hình</th>
                <th>Tên / Mô tả</th>
                <th style={{ width: 110, textAlign: 'right' }}>Số lượng</th>
                <th style={{ width: 120, textAlign: 'right' }}>Còn lại</th>
                <th style={{ width: 90, textAlign: 'center' }}>Trọng số</th>
                <th style={{ width: 120, textAlign: 'center' }}>Loại ô</th>
                <th style={{ width: 90, textAlign: 'center' }}>Kích hoạt</th>
                <th style={{ width: 160, textAlign: 'center' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {prizes.map((p) => {
                const item = normalizePrize(p)
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ width: 56, height: 40, borderRadius: 6, overflow: 'hidden', border: `2px solid ${item.displayColor || 'transparent'}` }}>
                        {item.image && (item.image.resolvedUrl || item.image.url) ? (
                          <img src={item.image.resolvedUrl || item.image.url} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: item.displayColor || '#f4f4f4', color: item.textColor || '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                            {item.name ? String(item.name).slice(0,1) : ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div className='text-muted' style={{ fontSize: 12 }}>{item.description}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{item.quantity === null ? '—' : item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{item.remainingQuantity === null ? '—' : item.remainingQuantity}</td>
                    <td style={{ textAlign: 'center' }}>{item.weight}</td>
                    <td style={{ textAlign: 'center' }}>{item.isNoPrize ? 'Không trúng' : 'Phần thưởng'}</td>
                    <td style={{ textAlign: 'center' }}>{item.isActive ? 'Yes' : 'No'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <CButton size='sm' color='secondary' onClick={() => setEditPrize(item)}>Sửa</CButton>
                      <CButton size='sm' color='danger' className='ms-2' onClick={() => handleDelete(item.id)}>Xóa</CButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <CModal visible={showCreate} onClose={() => setShowCreate(false)}>
        <CModalHeader closeButton>Thêm phần thưởng</CModalHeader>
        <CModalBody>
          <PrizeForm onSubmit={handleCreateSubmit} submitting={creating} uploading={uploading} />
        </CModalBody>
      </CModal>

      {/* Edit modal */}
      <CModal visible={!!editPrize} onClose={() => setEditPrize(null)}>
        <CModalHeader closeButton>Chỉnh sửa phần thưởng</CModalHeader>
        <CModalBody>
          <PrizeForm initial={editPrize} onSubmit={(form) => handleEditSubmit(editPrize.id, form)} submitting={creating} uploading={uploading} />
        </CModalBody>
      </CModal>
    </div>
  )
}

function PrizeForm({ initial = null, onSubmit = null, submitting = false, uploading = false }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [quantity, setQuantity] = useState(initial?.quantity || 0)
  const [weight, setWeight] = useState(initial?.weight || 1)
  const [isNoPrize, setIsNoPrize] = useState(Boolean(initial?.isNoPrize))
  const [file, setFile] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [displayColor, setDisplayColor] = useState(initial?.displayColor || '')
  const [textColor, setTextColor] = useState(initial?.textColor || '')
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    setName(initial?.name || '')
    setDescription(initial?.description || '')
    setQuantity(initial?.quantity || 0)
    setWeight(initial?.weight || 1)
    setIsNoPrize(Boolean(initial?.isNoPrize))
    setFile(null)
    setRemoveImage(false)
    setDisplayColor(initial?.displayColor || '')
    setTextColor(initial?.textColor || '')
    setPreviewUrl(initial && initial.image ? (initial.image.resolvedUrl || initial.image.url || null) : null)
  }, [initial])

  useEffect(() => {
    let objUrl = null
    if (file instanceof File) {
      objUrl = URL.createObjectURL(file)
      setPreviewUrl(objUrl)
    }
    return () => {
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [file])

  return (
    <CForm onSubmit={(e) => { e.preventDefault(); if (typeof onSubmit === 'function') onSubmit({ name, description, quantity, weight, isNoPrize, file, removeImage, displayColor, textColor }) }}>
      <div className='mb-3'>
        <CFormLabel>Tên</CFormLabel>
        <CFormInput value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className='mb-3'>
        <CFormLabel>Mô tả</CFormLabel>
        <CFormInput value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Số lượng</CFormLabel>
        <CFormInput type='number' value={quantity} onChange={(e) => setQuantity(Number(e.target.value || 0))} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Trọng số (weight)</CFormLabel>
        <CFormInput type='number' value={weight} onChange={(e) => setWeight(Number(e.target.value || 1))} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Loại ô</CFormLabel>
        <CFormSelect value={isNoPrize ? 'no-prize' : 'prize'} onChange={(e) => setIsNoPrize(e.target.value === 'no-prize')}>
          <option value='prize'>Phần thưởng</option>
          <option value='no-prize'>Không trúng</option>
        </CFormSelect>
      </div>
      <div className='mb-3'>
        <CFormLabel>Màu hiển thị</CFormLabel>
        <CFormInput type='color' value={displayColor || '#ffffff'} onChange={(e) => setDisplayColor(e.target.value)} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Màu chữ</CFormLabel>
        <CFormInput type='color' value={textColor || '#000000'} onChange={(e) => setTextColor(e.target.value)} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Ảnh</CFormLabel>
        <CFormInput type='file' onChange={(e) => {
          const nextFile = e.target.files && e.target.files[0] ? e.target.files[0] : null
          setFile(nextFile)
          if (nextFile) setRemoveImage(false)
        }} />
        {previewUrl ? (
          <div style={{ marginTop: 8 }}>
            <img src={previewUrl} alt='preview' style={{ maxWidth: 180, maxHeight: 120, borderRadius: 6, objectFit: 'cover', border: `1px solid ${displayColor || '#ddd'}` }} />
            <div style={{ marginTop: 8 }}>
              <CButton
                type='button'
                size='sm'
                color='danger'
                variant='outline'
                onClick={() => {
                  setFile(null)
                  setPreviewUrl(null)
                  setRemoveImage(true)
                }}
              >
                Xóa ảnh
              </CButton>
            </div>
          </div>
        ) : null}
      </div>
      <div className='d-flex gap-2 justify-content-end'>
        <CButton type='submit' color='primary' disabled={submitting || uploading}>{submitting ? 'Đang lưu...' : 'Lưu'}</CButton>
      </div>
    </CForm>
  )
}

function ParticipantList({ wheelId }) {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [generateCount, setGenerateCount] = useState(100)
  const [generatePrefix, setGeneratePrefix] = useState('')
  const [generateLength, setGenerateLength] = useState(6)
  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const resp = await getLuckyWheelParticipants(wheelId, { page: 1, pageSize: 100 })
        if (!mounted) return
        const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || [])
        setRows(items)
      } catch (e) {
        setRows([])
      } finally { if (mounted) setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [wheelId])

  async function handleCreate(form) {
    try {
      await createLuckyWheelParticipant(wheelId, form)
      const resp = await getLuckyWheelParticipants(wheelId, { page: 1, pageSize: 100 })
      const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || [])
      setRows(items)
      setShowCreate(false)
      window.alert('Tạo người chơi thành công')
    } catch (e) { window.alert(e?.response?.data?.message || e?.message || 'Lỗi') }
  }

  async function handleEdit(id, form) {
    try {
      await updateLuckyWheelParticipant(wheelId, id, form)
      const resp = await getLuckyWheelParticipants(wheelId, { page: 1, pageSize: 100 })
      const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || [])
      setRows(items)
      setEditItem(null)
      window.alert('Cập nhật thành công')
    } catch (e) { window.alert(e?.response?.data?.message || e?.message || 'Lỗi') }
  }

  async function handleToggleBlock(item) {
    try {
      if (item.isBlocked) await unblockLuckyWheelParticipant(wheelId, item.id)
      else await blockLuckyWheelParticipant(wheelId, item.id)
      const resp = await getLuckyWheelParticipants(wheelId, { page: 1, pageSize: 100 })
      const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || [])
      setRows(items)
    } catch (e) { window.alert(e?.response?.data?.message || e?.message || 'Lỗi') }
  }

  if (loading) return <div style={{ padding: 20 }}><CSpinner /></div>
  return (
    <div>
      <div className='d-flex justify-content-between mb-2'>
        <div />
        <div>
          <CButton color='primary' onClick={() => setShowCreate(true)}>Thêm người chơi</CButton>
          <CButton color='secondary' className='ms-2' onClick={() => document.getElementById(`import-file-${wheelId}`)?.click()}>Import</CButton>
          <CButton color='warning' className='ms-2' onClick={async () => {
            try {
              const resp = await exportParticipants(wheelId)
              if (!resp || !resp.data) { window.alert('Không nhận được file'); return }
              const blob = resp.data
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `participants-${wheelId}.xlsx`
              document.body.appendChild(a)
              a.click()
              a.remove()
              window.URL.revokeObjectURL(url)
            } catch (e) { window.alert(e?.response?.data?.message || e?.message || 'Lỗi khi xuất file') }
          }}>Xuất Excel</CButton>
          <CButton color='info' className='ms-2' onClick={() => setShowGenerate(true)}>Sinh mã hàng loạt</CButton>
          <input id={`import-file-${wheelId}`} type='file' accept='.xlsx,.xls,.csv' style={{ display: 'none' }} onChange={async (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            try {
              const data = await f.arrayBuffer();
              const workbook = XLSX.read(data, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const sheet = workbook.Sheets[sheetName];
              const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
              // preview via backend
              const preview = await api.post(`/lucky-wheels/${wheelId}/participants/import-preview`, { rows });
              if (preview && preview.data) {
                const ok = window.confirm(`Preview returned ${preview.data.data.length} rows. Import now?`);
                if (!ok) return;
                const result = await api.post(`/lucky-wheels/${wheelId}/participants/import`, { rows });
                window.alert('Import completed: ' + (Array.isArray(result.data.data) ? result.data.data.length : 0) + ' created');
                // refresh list
                const resp = await getLuckyWheelParticipants(wheelId, { page: 1, pageSize: 100 });
                const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || []);
                setRows(items);
              } else {
                window.alert('Preview failed')
              }
            } catch (e) { window.alert('Import error: ' + (e?.message || e)); }
            e.target.value = '';
          }} />
            {/* Generate codes modal */}
            <CModal visible={showGenerate} onClose={() => setShowGenerate(false)}>
              <CModalHeader closeButton>Sinh mã người chơi hàng loạt</CModalHeader>
              <CModalBody>
                <CForm>
                  <div className='mb-3'>
                    <CFormLabel>Số lượng</CFormLabel>
                    <CFormInput type='number' value={generateCount} onChange={(e) => setGenerateCount(Number(e.target.value || 0))} />
                  </div>
                  <div className='mb-3'>
                    <CFormLabel>Tiền tố (prefix)</CFormLabel>
                    <CFormInput value={generatePrefix} onChange={(e) => setGeneratePrefix(e.target.value)} placeholder='VD: AS2026-' />
                  </div>
                  <div className='mb-3'>
                    <CFormLabel>Độ dài phần hậu tố (số ký tự)</CFormLabel>
                    <CFormInput type='number' value={generateLength} onChange={(e) => setGenerateLength(Number(e.target.value || 0))} />
                  </div>
                </CForm>
              </CModalBody>
              <CModalFooter>
                <CButton color='secondary' onClick={() => setShowGenerate(false)}>Hủy</CButton>
                <CButton color='primary' onClick={async () => {
                  try {
                    if (!generateCount || generateCount <= 0) { window.alert('Số lượng không hợp lệ'); return }
                    const payload = { count: generateCount, prefix: generatePrefix || null, suffixLength: generateLength || 6 }
                    const res = await generateLuckyWheelParticipantCodes(wheelId, payload)
                    if (res && res.data) {
                      window.alert(`Đã sinh ${Array.isArray(res.data) ? res.data.length : (res.data.length || 0)} mã`)
                      const resp = await getLuckyWheelParticipants(wheelId, { page: 1, pageSize: 100 })
                      const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || [])
                      setRows(items)
                      setShowGenerate(false)
                    } else {
                      window.alert('Không nhận được phản hồi')
                    }
                  } catch (e) { window.alert(e?.response?.data?.message || e?.message || 'Lỗi khi sinh mã') }
                }}>Sinh và thêm</CButton>
              </CModalFooter>
            </CModal>
        </div>
      </div>
      {rows.length === 0 ? <div className='text-muted'>Chưa có người chơi.</div> : (
        <div className='table-responsive'>
          <table className='table table-hover align-middle'>
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Code</th>
                <th>Phone</th>
                <th>Lớp</th>
                <th style={{ width: 160 }}>Trạng thái</th>
                <th style={{ width: 180 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const a = (r && r.attributes) ? r.attributes : r || {};
                return (
                  <tr key={r.id}>
                    <td>{a.fullName || a.fullname || r.fullName || r.name || '-'}</td>
                    <td>{a.participantCode || a.code || r.participantCode || r.code || '-'}</td>
                    <td>{a.phone || r.phone || '-'}</td>
                    <td>{a.className || a.classname || r.className || r.classname || '-'}</td>
                    <td>{a.status || r.status || (a.isBlocked || r.isBlocked ? 'Blocked' : 'Active')}</td>
                    <td>
                      <CButton size='sm' color='secondary' onClick={() => setEditItem(r)}>Sửa</CButton>
                      <CButton size='sm' className='ms-2' color={(a.isBlocked || r.isBlocked) ? 'success' : 'danger'} onClick={() => handleToggleBlock({ id: r.id, isBlocked: (a.isBlocked || r.isBlocked) })}>{(a.isBlocked || r.isBlocked) ? 'Bật' : 'Vô hiệu'}</CButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <CModal visible={showCreate} onClose={() => setShowCreate(false)}>
        <CModalHeader closeButton>Thêm người chơi</CModalHeader>
        <CModalBody>
          <ParticipantForm onSubmit={handleCreate} />
        </CModalBody>
      </CModal>

      <CModal visible={!!editItem} onClose={() => setEditItem(null)}>
        <CModalHeader closeButton>Chỉnh sửa người chơi</CModalHeader>
        <CModalBody>
          <ParticipantForm initial={editItem} onSubmit={(form) => handleEdit(editItem.id, form)} />
        </CModalBody>
      </CModal>
    </div>
  )
}

function ParticipantForm({ initial = null, onSubmit = null }) {
  const [fullName, setFullName] = useState(initial?.attributes?.fullName || initial?.fullName || '')
  const [email, setEmail] = useState(initial?.attributes?.email || initial?.email || '')
  const [phone, setPhone] = useState(initial?.attributes?.phone || initial?.phone || '')
  const [participantCode, setParticipantCode] = useState(initial?.attributes?.participantCode || initial?.participantCode || '')
  const [className, setClassName] = useState(initial?.attributes?.className || initial?.className || '')

  useEffect(() => {
    setFullName(initial?.attributes?.fullName || initial?.fullName || '')
    setEmail(initial?.attributes?.email || initial?.email || '')
    setPhone(initial?.attributes?.phone || initial?.phone || '')
    setParticipantCode(initial?.attributes?.participantCode || initial?.participantCode || '')
    setClassName(initial?.attributes?.className || initial?.className || '')
  }, [initial])

  return (
    <CForm onSubmit={(e) => { e.preventDefault(); if (typeof onSubmit === 'function') onSubmit({ fullName, email, phone, participantCode, className }) }}>
      <div className='mb-3'>
        <CFormLabel>Họ tên</CFormLabel>
        <CFormInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Email</CFormLabel>
        <CFormInput type='email' value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Phone</CFormLabel>
        <CFormInput value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Code</CFormLabel>
        <CFormInput value={participantCode} onChange={(e) => setParticipantCode(e.target.value)} />
      </div>
      <div className='mb-3'>
        <CFormLabel>Lớp</CFormLabel>
        <CFormInput value={className} onChange={(e) => setClassName(e.target.value)} />
      </div>
      <div className='d-flex justify-content-end'>
        <CButton type='submit' color='primary'>Lưu</CButton>
      </div>
    </CForm>
  )
}

function ParticipantFormConfig({ wheel, onSaved = null }) {
  const [cfg, setCfg] = useState(() => wheel?.participantFormConfig || null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setCfg(wheel?.participantFormConfig || null) }, [wheel])

  const fields = [
    { key: 'participantCode', label: 'Mã' },
    { key: 'fullName', label: 'Họ tên' },
    { key: 'phone', label: 'Điện thoại' },
    { key: 'email', label: 'Email' },
    { key: 'className', label: 'Lớp' },
  ]

  function ensureCfg() {
    if (cfg && cfg.fields) return cfg
    return { fields: fields.map(f => ({ key: f.key, label: f.label, enabled: f.key === 'participantCode' ? true : true, required: f.key === 'participantCode' ? true : false, editable: f.key !== 'participantCode', placeholder: '' })) }
  }

  function toggleField(key, prop) {
    const base = ensureCfg()
    const next = { fields: base.fields.map(f => { if (f.key !== key) return f; return { ...f, [prop]: !f[prop] } }) }
    setCfg(next)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = { participantFormConfig: cfg }
      const updated = await updateLuckyWheel(wheel.id, payload)
      if (typeof onSaved === 'function') onSaved(updated)
      window.alert('Lưu cấu hình thành công')
    } catch (e) { window.alert(e?.response?.data?.message || e?.message || 'Lỗi khi lưu') }
    finally { setSaving(false) }
  }

  const current = ensureCfg()
  return (
    <div>
      <div className='mb-3'>
        <div>Chọn các trường hiển thị / bắt buộc khi người chơi tham gia. Trường <strong>Mã</strong> luôn bắt buộc.</div>
      </div>
      <div className='table-responsive'>
        <table className='table'>
          <thead>
            <tr><th>Trường</th><th>Hiển thị</th><th>Bắt buộc</th><th>Editable</th></tr>
          </thead>
          <tbody>
            {current.fields.map(f => (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td><input type='checkbox' checked={f.enabled} disabled={f.key === 'participantCode'} onChange={() => toggleField(f.key, 'enabled')} /></td>
                <td><input type='checkbox' checked={f.required} disabled={f.key === 'participantCode'} onChange={() => toggleField(f.key, 'required')} /></td>
                <td><input type='checkbox' checked={f.editable} disabled={f.key === 'participantCode'} onChange={() => toggleField(f.key, 'editable')} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className='d-flex justify-content-end'>
        <CButton color='secondary' onClick={() => setCfg(wheel?.participantFormConfig || null)}>Reset</CButton>
        <CButton color='primary' className='ms-2' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</CButton>
      </div>
    </div>
  )
}

function PresentationTab({ wheelId, wheel }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copyState, setCopyState] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const resp = await getLuckyWheelPresentation(wheelId)
        if (!mounted) return
        setData(resp?.data || null)
      } catch {
        if (!mounted) return
        setData(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [wheelId])

  async function copyText(value, label) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopyState(`Đã sao chép ${label}`)
      window.setTimeout(() => setCopyState(''), 1800)
    } catch {
      window.alert(`Không thể sao chép ${label}`)
    }
  }

  if (loading) return <div style={{ padding: 20 }}><CSpinner /></div>
  if (!data) return <div className='text-muted'>Không tải được dữ liệu trình chiếu.</div>

  const statusMeta = getStatusMeta(data?.wheel?.status || wheel?.status)
  const statistics = data.statistics || {}

  return (
    <div>
      {statusMeta.label !== 'Đang mở' ? (
        <div className='alert alert-warning py-2'>Vòng quay hiện chưa mở. Bạn vẫn có thể xem preview trình chiếu.</div>
      ) : null}

      <div className='row g-3'>
        <div className='col-12 col-lg-6'>
          <div className='border rounded p-3 h-100'>
            <div className='fw-semibold mb-2'>Thông tin truy cập public</div>
            <div className='small text-muted mb-2'>{data.publicUrl || '—'}</div>
            <div className='d-flex flex-wrap gap-2 mb-3'>
              <CButton size='sm' color='secondary' variant='outline' onClick={() => copyText(data.publicUrl, 'link tham gia')}>Sao chép liên kết</CButton>
              <CButton size='sm' color='primary' onClick={() => window.open(data.publicUrl, '_blank', 'noopener,noreferrer')}>Mở trang người tham gia</CButton>
            </div>
            {data.qrCodeDataUrl ? (
              <div className='text-center'>
                <img src={data.qrCodeDataUrl} alt='QR tham gia' style={{ width: 220, maxWidth: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                <div className='mt-2 fw-semibold'>Quét mã để tham gia</div>
                <div className='small text-muted'>Mã vòng quay: {data?.wheel?.code || wheel?.code || '—'}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className='col-12 col-lg-6'>
          <div className='border rounded p-3 h-100'>
            <div className='fw-semibold mb-2'>Thông tin trình chiếu</div>
            <div className='small text-muted mb-2'>{data.presentationUrl || '—'}</div>
            <div className='d-flex flex-wrap gap-2 mb-3'>
              <CButton size='sm' color='secondary' variant='outline' onClick={() => copyText(data.presentationUrl, 'link trình chiếu')}>Sao chép link trình chiếu</CButton>
              <CButton size='sm' color='primary' onClick={() => window.open(data.presentationUrl, '_blank', 'noopener,noreferrer')}>Mở trình chiếu</CButton>
            </div>
            <div className='small text-muted'>Màn hình này dùng để hiển thị trên TV, máy chiếu hoặc màn hình lớn.</div>
          </div>
        </div>

        <div className='col-12 col-lg-6'>
          <div className='border rounded p-3 h-100'>
            <div className='fw-semibold mb-2'>Trạng thái chiến dịch</div>
            <div className='d-flex align-items-center gap-2 mb-2'>
              <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 999, background: statusMeta.bg, color: statusMeta.color, fontWeight: 700, fontSize: 12 }}>{statusMeta.label}</span>
            </div>
            <div><strong>Tên:</strong> {data?.wheel?.name || wheel?.name || '—'}</div>
            <div><strong>Mã:</strong> {data?.wheel?.code || wheel?.code || '—'}</div>
            <div><strong>Bắt đầu:</strong> {data?.wheel?.startAt ? new Date(data.wheel.startAt).toLocaleString() : '—'}</div>
            <div><strong>Kết thúc:</strong> {data?.wheel?.endAt ? new Date(data.wheel.endAt).toLocaleString() : '—'}</div>
            <div><strong>Hình thức tham gia:</strong> {data?.wheel?.participationMode || wheel?.participationMode || '—'}</div>
          </div>
        </div>

        <div className='col-12 col-lg-6'>
          <div className='border rounded p-3 h-100'>
            <div className='fw-semibold mb-2'>Thống kê nhanh</div>
            <div className='row g-2'>
              <div className='col-6'><div className='border rounded p-2'><div className='small text-muted'>Tổng số người tham gia</div><div className='fw-bold fs-5'>{statistics.totalParticipants ?? 0}</div></div></div>
              <div className='col-6'><div className='border rounded p-2'><div className='small text-muted'>Chưa quay</div><div className='fw-bold fs-5'>{statistics.eligibleParticipants ?? 0}</div></div></div>
              <div className='col-6'><div className='border rounded p-2'><div className='small text-muted'>Đã quay</div><div className='fw-bold fs-5'>{statistics.usedParticipants ?? 0}</div></div></div>
              <div className='col-6'><div className='border rounded p-2'><div className='small text-muted'>Tổng lượt quay</div><div className='fw-bold fs-5'>{statistics.totalSpins ?? 0}</div></div></div>
              <div className='col-12'><div className='border rounded p-2'><div className='small text-muted'>Số giải còn hiệu lực</div><div className='fw-bold fs-5'>{statistics.activePrizeCount ?? 0}</div></div></div>
            </div>
          </div>
        </div>
      </div>

      {copyState ? <div className='small text-success mt-3'>{copyState}</div> : null}
    </div>
  )
}

function ResultList({ wheelId, wheel }) {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, pageCount: 1, total: 0 })
  const [search, setSearch] = useState('')
  const [claimStatusFilter, setClaimStatusFilter] = useState('')
  const [resultTypeFilter, setResultTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [verifyError, setVerifyError] = useState('')
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimNote, setClaimNote] = useState('')
  const [claimTarget, setClaimTarget] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const participantFields = useMemo(() => ([
    { key: 'participantCode', label: 'Mã người tham gia' },
    { key: 'fullName', label: 'Họ tên' },
  ]), [])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const resp = await getLuckyWheelResults(wheelId, {
          page: pagination.page,
          pageSize: pagination.pageSize,
          search,
          claimStatus: claimStatusFilter,
          resultType: resultTypeFilter,
          dateFrom,
          dateTo,
          sort: 'spunAt:desc',
        })
        if (!mounted) return
        const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || [])
        setRows(items)
        setPagination(resp?.meta?.pagination || { page: 1, pageSize: 20, pageCount: 1, total: items.length })
      } catch (e) {
        if (!mounted) return
        setRows([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [wheelId, pagination.page, pagination.pageSize, search, claimStatusFilter, resultTypeFilter, dateFrom, dateTo, reloadKey])

  function pickParticipantValue(item, key) {
    const attrs = item?.attributes || item || {}
    if (key === 'participantCode') return attrs.participant?.participantCode || attrs.participantCode || '-'
    if (key === 'fullName') return attrs.participant?.fullName || attrs.participantFullName || '-'
    return '-'
  }

  function normalizeRow(row) {
    const attrs = row?.attributes || row || {}
    return {
      ...attrs,
      id: row?.id || attrs.id,
      participant: attrs.participant || {},
      result: attrs.result || attrs.prize || {},
    }
  }

  function claimStatusLabel(value) {
    if (value === 'claimed') return 'Đã trao'
    if (value === 'not_applicable') return 'Không cần trao'
    return 'Chưa trao'
  }

  function resultTypeLabel(isNoPrize) {
    return isNoPrize ? 'Không có phần thưởng' : 'Có phần thưởng'
  }

  async function handleVerify(event) {
    event?.preventDefault?.()
    const normalizedCode = String(verifyCode || '').trim().toUpperCase()
    if (!normalizedCode || verifyLoading) return
    setVerifyLoading(true)
    setVerifyError('')
    try {
      const resp = await verifyLuckyWheelResult(wheelId, normalizedCode)
      setVerifyResult(resp?.data || null)
      setVerifyCode(normalizedCode)
    } catch (error) {
      setVerifyResult(null)
      setVerifyError(String(error?.response?.data?.error || error?.message || 'Không kiểm tra được mã'))
    } finally {
      setVerifyLoading(false)
    }
  }

  function openClaimModal(item) {
    setClaimTarget(item)
    setClaimNote('')
  }

  async function handleClaim() {
    if (!claimTarget || claiming) return
    setClaiming(true)
    try {
      const resp = await claimLuckyWheelResult(wheelId, claimTarget.id, { claimNote })
      const updated = resp?.data || null
      if (updated) {
        setRows((current) => (current || []).map((row) => {
          const normalized = normalizeRow(row)
          if (String(normalized.id) !== String(updated.id)) return row
          return { id: updated.id, attributes: updated }
        }))
        setVerifyResult((current) => {
          if (!current || String(current.id) !== String(updated.id)) return current
          return updated
        })
      }
      setClaimTarget(null)
      setClaimNote('')
      setReloadKey((current) => current + 1)
    } catch (error) {
      const currentData = error?.response?.data?.data || null
      if (currentData) {
        setVerifyResult(currentData)
        setRows((current) => (current || []).map((row) => {
          const normalized = normalizeRow(row)
          if (String(normalized.id) !== String(currentData.id)) return row
          return { id: currentData.id, attributes: currentData }
        }))
      }
      window.alert(String(error?.response?.data?.error || error?.message || 'Không thể xác nhận đã trao'))
    } finally {
      setClaiming(false)
    }
  }

  if (loading) return <div style={{ padding: 20 }}><CSpinner /></div>

  return (
    <div>
      <div className='d-flex flex-wrap gap-2 mb-3 align-items-end'>
        <div style={{ minWidth: 260 }}>
          <CFormLabel>Tìm kiếm</CFormLabel>
          <CFormInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Mã xác thực, mã người tham gia, họ tên, phần thưởng' />
        </div>
        <div>
          <CFormLabel>Trạng thái trao</CFormLabel>
          <CFormSelect value={claimStatusFilter} onChange={(e) => setClaimStatusFilter(e.target.value)}>
            <option value=''>Tất cả</option>
            <option value='unclaimed'>Chưa trao</option>
            <option value='claimed'>Đã trao</option>
            <option value='not_applicable'>Không cần trao</option>
          </CFormSelect>
        </div>
        <div>
          <CFormLabel>Loại kết quả</CFormLabel>
          <CFormSelect value={resultTypeFilter} onChange={(e) => setResultTypeFilter(e.target.value)}>
            <option value=''>Tất cả</option>
            <option value='prize'>Có phần thưởng</option>
            <option value='no_prize'>Không có phần thưởng</option>
          </CFormSelect>
        </div>
        <div>
          <CFormLabel>Từ ngày</CFormLabel>
          <CFormInput type='date' value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <CFormLabel>Đến ngày</CFormLabel>
          <CFormInput type='date' value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className='ms-auto d-flex gap-2'>
          <CButton color='secondary' variant='outline' onClick={() => { setSearch(''); setClaimStatusFilter(''); setResultTypeFilter(''); setDateFrom(''); setDateTo(''); setPagination((current) => ({ ...current, page: 1 })) }}>Reset</CButton>
          <CButton color='primary' variant='outline' onClick={() => { setShowVerifyModal(true); setVerifyError(''); setVerifyResult(null) }}>Xác minh mã</CButton>
        </div>
      </div>

      {!rows || rows.length === 0 ? <div className='text-muted'>Chưa có kết quả quay.</div> : (
        <div className='table-responsive'>
          <table className='table table-hover align-middle'>
            <thead>
              <tr>
                <th style={{ width: 180 }}>Thời gian quay</th>
                <th style={{ width: 160 }}>Mã xác thực</th>
                {participantFields.map((field) => (
                  <th key={field.key}>{field.label || field.key}</th>
                ))}
                <th>Kết quả</th>
                <th style={{ width: 160 }}>Loại kết quả</th>
                <th style={{ width: 140 }}>Trạng thái trao thưởng</th>
                <th style={{ width: 180 }}>Thời gian trao</th>
                <th style={{ width: 160 }}>Người trao</th>
                <th style={{ width: 160 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const item = normalizeRow(row)
                const canClaim = item.claimStatus === 'unclaimed' && !item.result?.isNoPrize && item.status !== 'cancelled'
                return (
                  <tr key={item.id}>
                    <td>{item.spunAt ? new Date(item.spunAt).toLocaleString() : '-'}</td>
                    <td><strong>{item.verificationCode || '-'}</strong></td>
                    {participantFields.map((field) => (
                      <td key={field.key}>{pickParticipantValue(item, field.key)}</td>
                    ))}
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.result?.name || '-'}</div>
                      {item.result?.resultMessage ? <div className='text-muted' style={{ fontSize: 12 }}>{item.result.resultMessage}</div> : null}
                    </td>
                    <td>{resultTypeLabel(item.result?.isNoPrize)}</td>
                    <td>{claimStatusLabel(item.claimStatus)}</td>
                    <td>{item.claimedAt ? new Date(item.claimedAt).toLocaleString() : '-'}</td>
                    <td>{item.claimedByName || '-'}</td>
                    <td>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton size='sm' color='secondary' variant='outline' onClick={() => { setShowVerifyModal(true); setVerifyCode(item.verificationCode || ''); setVerifyError(''); setVerifyResult(item) }}>Chi tiết</CButton>
                        {canClaim ? <CButton size='sm' color='primary' onClick={() => openClaimModal(item)}>Xác nhận đã trao</CButton> : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className='d-flex justify-content-between align-items-center mt-3'>
        <div className='small text-muted'>Tổng: {pagination.total || 0}</div>
        <div className='d-flex align-items-center gap-2'>
          <CButton size='sm' color='secondary' variant='outline' disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Trang trước</CButton>
          <span className='small'>Trang {pagination.page || 1}/{pagination.pageCount || 1}</span>
          <CButton size='sm' color='secondary' variant='outline' disabled={(pagination.page || 1) >= (pagination.pageCount || 1)} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Trang sau</CButton>
        </div>
      </div>

      <CModal visible={showVerifyModal} onClose={() => setShowVerifyModal(false)}>
        <CModalHeader closeButton>Xác minh mã kết quả</CModalHeader>
        <CModalBody>
          <CForm onSubmit={handleVerify}>
            <div className='mb-3'>
              <CFormLabel>Mã xác thực</CFormLabel>
              <CFormInput value={verifyCode} onChange={(e) => setVerifyCode(String(e.target.value || '').toUpperCase())} placeholder='Nhập mã xác thực' />
            </div>
            <div className='d-flex justify-content-end'>
              <CButton type='submit' color='primary' disabled={verifyLoading || !String(verifyCode || '').trim()}>{verifyLoading ? 'Đang kiểm tra...' : 'Kiểm tra'}</CButton>
            </div>
          </CForm>

          {verifyError ? <div className='alert alert-danger py-2 mt-3 mb-0'>{verifyError}</div> : null}

          {verifyResult ? (
            <div className='mt-3 border rounded p-3'>
              <div><strong>Mã xác thực:</strong> {verifyResult.verificationCode || '-'}</div>
              <div><strong>Họ tên:</strong> {verifyResult.participant?.fullName || '-'}</div>
              <div><strong>Mã người tham gia:</strong> {verifyResult.participant?.participantCode || '-'}</div>
              <div><strong>Lớp/đơn vị:</strong> {verifyResult.participant?.className || '-'}</div>
              <div><strong>Kết quả:</strong> {verifyResult.result?.name || '-'}</div>
              <div><strong>Thời gian quay:</strong> {verifyResult.spunAt ? new Date(verifyResult.spunAt).toLocaleString() : '-'}</div>
              <div><strong>Trạng thái trao:</strong> {claimStatusLabel(verifyResult.claimStatus)}</div>
              {verifyResult.result?.image?.resolvedUrl || verifyResult.result?.image?.url ? (
                <div className='mt-3'>
                  <img src={verifyResult.result.image.resolvedUrl || verifyResult.result.image.url} alt={verifyResult.result?.name || 'Prize'} style={{ width: 180, maxWidth: '100%', borderRadius: 12 }} />
                </div>
              ) : null}
              {verifyResult.result?.resultMessage ? <div className='mt-2'>{verifyResult.result.resultMessage}</div> : null}
              {verifyResult.claimNote ? <div className='mt-2'><strong>Ghi chú:</strong> {verifyResult.claimNote}</div> : null}
              {verifyResult.canClaim ? (
                <div className='mt-3'>
                  <CButton color='primary' onClick={() => openClaimModal(verifyResult)}>Xác nhận đã trao</CButton>
                </div>
              ) : null}
            </div>
          ) : null}
        </CModalBody>
      </CModal>

      <CModal visible={!!claimTarget} onClose={() => !claiming && setClaimTarget(null)}>
        <CModalHeader closeButton>Xác nhận đã trao thưởng</CModalHeader>
        <CModalBody>
          {claimTarget ? (
            <div>
              <div><strong>Họ tên:</strong> {claimTarget.participant?.fullName || '-'}</div>
              <div><strong>Mã người tham gia:</strong> {claimTarget.participant?.participantCode || '-'}</div>
              <div><strong>Mã xác thực:</strong> {claimTarget.verificationCode || '-'}</div>
              <div><strong>Phần thưởng:</strong> {claimTarget.result?.name || '-'}</div>
              <div className='mt-3'>
                <CFormLabel>Ghi chú</CFormLabel>
                <textarea className='form-control' rows={3} value={claimNote} onChange={(e) => setClaimNote(e.target.value)} placeholder='Ghi chú trao thưởng (không bắt buộc)' />
              </div>
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' onClick={() => setClaimTarget(null)} disabled={claiming}>Hủy</CButton>
          <CButton color='primary' onClick={handleClaim} disabled={claiming}>{claiming ? 'Đang xác nhận...' : 'Xác nhận đã trao'}</CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}
