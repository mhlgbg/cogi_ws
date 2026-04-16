import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
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
import {
  createSliderItem,
  deleteSliderItem,
  getSliderItems,
  getSliderOptions,
  updateSliderItem,
  uploadSliderItemImage,
} from '../services/sliderItemManagementService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

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

function createEmptyForm() {
  return {
    sliderId: '',
    title: '',
    description: '',
    link: '',
    order: '0',
    showTitle: true,
    showDescription: true,
    openInNewTab: false,
    isActive: true,
    imageId: null,
    imageUrl: '',
    imageFile: null,
    imagePreviewUrl: '',
    imageCleared: false,
  }
}

function toPositiveIntegerOrNull(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.floor(parsed)
}

export default function SliderItemManagementPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [sliderFilter, setSliderFilter] = useState('')
  const [sliderOptions, setSliderOptions] = useState([])
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [formData, setFormData] = useState(createEmptyForm())

  const total = meta?.pagination?.total ?? 0
  const pageCount = meta?.pagination?.pageCount ?? 1
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])

  const fromToText = useMemo(() => {
    const pagination = meta?.pagination
    if (!pagination || total === 0) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, total)
    return `${from}–${to}/${total}`
  }, [meta, total])

  useEffect(() => {
    let cancelled = false

    async function loadSliderLookup() {
      try {
        const nextOptions = await getSliderOptions()
        if (cancelled) return
        setSliderOptions(nextOptions)
      } catch {
        if (cancelled) return
        setSliderOptions([])
      }
    }

    loadSliderLookup()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (formData.imagePreviewUrl && formData.imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(formData.imagePreviewUrl)
      }
    }
  }, [formData.imagePreviewUrl])

  async function load() {
    setLoading(true)
    setSuccess('')
    setError('')

    try {
      const res = await getSliderItems({ page, pageSize, q, sliderId: sliderFilter })
      setRows(res?.data || [])
      setMeta(res?.meta || null)
    } catch (loadError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách slider item'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, pageSize, q, sliderFilter])

  function resetForm() {
    if (formData.imagePreviewUrl && formData.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(formData.imagePreviewUrl)
    }
    setFormData(createEmptyForm())
  }

  function openCreateModal() {
    setEditingId(null)
    resetForm()
    setShowModal(true)
  }

  function openEditModal(item) {
    if (formData.imagePreviewUrl && formData.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(formData.imagePreviewUrl)
    }

    setEditingId(item.id)
    setFormData({
      sliderId: item?.slider?.id ? String(item.slider.id) : '',
      title: item?.title || '',
      description: item?.description || '',
      link: item?.link || '',
      order: item?.order === null || item?.order === undefined ? '0' : String(item.order),
      showTitle: item?.showTitle !== false,
      showDescription: item?.showDescription !== false,
      openInNewTab: Boolean(item?.openInNewTab),
      isActive: item?.isActive !== false,
      imageId: item?.image?.id || null,
      imageUrl: item?.image?.url || '',
      imageFile: null,
      imagePreviewUrl: item?.image?.url || '',
      imageCleared: false,
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    resetForm()
  }

  function applySearch() {
    setPage(1)
    setQ(qDraft.trim())
  }

  function onReset() {
    setPage(1)
    setQ('')
    setQDraft('')
    setSliderFilter('')
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0] || null

    setFormData((previous) => {
      if (previous.imagePreviewUrl && previous.imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previous.imagePreviewUrl)
      }

      return {
        ...previous,
        imageFile: file,
        imagePreviewUrl: file ? URL.createObjectURL(file) : previous.imageUrl,
        imageCleared: false,
      }
    })
  }

  function clearImage() {
    setFormData((previous) => {
      if (previous.imagePreviewUrl && previous.imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previous.imagePreviewUrl)
      }

      return {
        ...previous,
        imageId: null,
        imageUrl: '',
        imageFile: null,
        imagePreviewUrl: '',
        imageCleared: true,
      }
    })
  }

  async function handleSubmit() {
    const sliderId = Number(formData.sliderId)
    const order = toPositiveIntegerOrNull(formData.order)

    if (!Number.isInteger(sliderId) || sliderId <= 0) {
      setError('Slider là bắt buộc')
      return
    }

    if (order === null) {
      setError('Order phải là số')
      return
    }

    setFormLoading(true)
    setError('')

    try {
      let imageId = formData.imageId
      let imageUrl = formData.imageUrl

      if (formData.imageFile) {
        setUploadingImage(true)
        try {
          const uploaded = await uploadSliderItemImage(formData.imageFile)
          imageId = uploaded?.id || null
          imageUrl = uploaded?.url || ''
        } finally {
          setUploadingImage(false)
        }
      }

      const payload = {
        slider: sliderId,
        title: String(formData.title || '').trim() || null,
        description: String(formData.description || '').trim() || null,
        link: String(formData.link || '').trim() || null,
        order,
        showTitle: Boolean(formData.showTitle),
        showDescription: Boolean(formData.showDescription),
        openInNewTab: Boolean(formData.openInNewTab),
        isActive: Boolean(formData.isActive),
      }

      if (formData.imageCleared) {
        payload.image = null
      } else if (imageId) {
        payload.image = imageId
      }

      if (editingId) {
        await updateSliderItem(editingId, payload)
        setSuccess('Cập nhật slider item thành công')
      } else {
        await createSliderItem(payload)
        setSuccess('Thêm mới slider item thành công')
      }

      setFormData((previous) => ({
        ...previous,
        imageId,
        imageUrl,
      }))

      closeModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu slider item'))
    } finally {
      setFormLoading(false)
      setUploadingImage(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa slider item này?')) return

    setSuccess('')
    setError('')

    try {
      await deleteSliderItem(id)
      setSuccess('Xóa slider item thành công')
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa slider item'))
    }
  }

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <CCard className='mb-4 ai-card'>
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 ai-form align-items-end'>
              <CCol md={4}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo tiêu đề, link...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel htmlFor='slider-item-filter'>Slider</CFormLabel>
                <CFormSelect id='slider-item-filter' value={sliderFilter} onChange={(event) => { setPage(1); setSliderFilter(event.target.value) }}>
                  <option value=''>-- Tất cả slider --</option>
                  {sliderOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name || item.code || `Slider #${item.id}`}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={12} md={4} className='d-flex justify-content-end gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color='secondary' variant='outline' onClick={onReset} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {success ? <CAlert color='success' className='mb-4'>{success}</CAlert> : null}
        {error ? <CAlert color='danger' className='mb-4'>{error}</CAlert> : null}

        <CCard className='ai-card'>
          <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
            <div>
              <strong>Slider Items</strong>
            </div>
            <div className='d-flex align-items-center gap-3'>
              <div className='text-body-secondary small'>{fromToText}</div>
              <CButton color='success' onClick={openCreateModal} disabled={loading}>+ Thêm mới</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive className='mb-3 ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 84 }}>Ảnh</CTableHeaderCell>
                      <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Slider</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 100 }}>Order</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 120 }}>Active</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={6} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>
                          {item?.image?.url ? (
                            <img src={item.image.url} alt={item.title || 'Slider item'} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 10 }} />
                          ) : '-'}
                        </CTableDataCell>
                        <CTableDataCell>{item.title || '-'}</CTableDataCell>
                        <CTableDataCell>{item?.slider?.name || item?.slider?.code || '-'}</CTableDataCell>
                        <CTableDataCell>{item.order ?? 0}</CTableDataCell>
                        <CTableDataCell>{item.isActive === false ? 'No' : 'Yes'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item.id)}>Xóa</CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                  <div className='d-flex align-items-center gap-2 ai-form'>
                    <span>Page size</span>
                    <CFormInput
                      type='number'
                      min='1'
                      step='1'
                      value={pageSize}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value)
                        setPage(1)
                        setPageSize(Number.isInteger(nextValue) && nextValue > 0 ? nextValue : 10)
                      }}
                      style={{ width: 100 }}
                    />
                  </div>

                  <CPagination align='end' className='mb-0'>
                    <CPaginationItem disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => item === '...'
                      ? <CPaginationItem key={`dots-${index}`} disabled>…</CPaginationItem>
                      : <CPaginationItem key={item} active={item === page} disabled={loading} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pageCount || loading} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>

        <CModal backdrop='static' visible={showModal} onClose={closeModal} size='lg'>
          <CModalHeader>
            <CModalTitle>{editingId ? 'Sửa slider item' : 'Thêm mới slider item'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={6}>
                  <CFormLabel htmlFor='slider-item-slider'>Slider <span className='text-danger'>*</span></CFormLabel>
                  <CFormSelect
                    id='slider-item-slider'
                    value={formData.sliderId}
                    onChange={(event) => setFormData((prev) => ({ ...prev, sliderId: event.target.value }))}
                    disabled={formLoading || uploadingImage}
                  >
                    <option value=''>-- Chọn slider --</option>
                    {sliderOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.name || item.code || `Slider #${item.id}`}</option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='slider-item-order'>Order</CFormLabel>
                  <CFormInput
                    id='slider-item-order'
                    type='number'
                    step='1'
                    value={formData.order}
                    onChange={(event) => setFormData((prev) => ({ ...prev, order: event.target.value }))}
                    disabled={formLoading || uploadingImage}
                  />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel htmlFor='slider-item-title'>Title</CFormLabel>
                  <CFormInput
                    id='slider-item-title'
                    value={formData.title}
                    onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                    disabled={formLoading || uploadingImage}
                  />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel htmlFor='slider-item-description'>Description</CFormLabel>
                  <CFormTextarea
                    id='slider-item-description'
                    rows={4}
                    value={formData.description}
                    onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                    disabled={formLoading || uploadingImage}
                  />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel htmlFor='slider-item-link'>Link</CFormLabel>
                  <CFormInput
                    id='slider-item-link'
                    value={formData.link}
                    onChange={(event) => setFormData((prev) => ({ ...prev, link: event.target.value }))}
                    placeholder='/journal hoặc https://...'
                    disabled={formLoading || uploadingImage}
                  />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel htmlFor='slider-item-image'>Image</CFormLabel>
                  <CFormInput
                    id='slider-item-image'
                    type='file'
                    accept='image/*'
                    onChange={handleImageChange}
                    disabled={formLoading || uploadingImage}
                  />
                  <div className='small text-body-secondary mt-1'>Ảnh sẽ được upload vào media library khi lưu.</div>
                </CCol>
                {formData.imagePreviewUrl ? (
                  <CCol xs={12}>
                    <div className='d-flex align-items-start gap-3 flex-wrap'>
                      <img src={formData.imagePreviewUrl} alt='Preview' style={{ width: 240, maxWidth: '100%', borderRadius: 16, objectFit: 'cover', border: '1px solid #d1d5db' }} />
                      <div className='d-flex flex-column gap-2'>
                        <span className='small text-body-secondary'>Preview sau khi chọn/upload ảnh</span>
                        <CButton color='secondary' variant='outline' onClick={clearImage} disabled={formLoading || uploadingImage}>Xóa ảnh</CButton>
                      </div>
                    </div>
                  </CCol>
                ) : null}
                <CCol md={6}>
                  <CFormSwitch
                    id='slider-item-show-title'
                    label='Hiển thị title'
                    checked={Boolean(formData.showTitle)}
                    onChange={(event) => setFormData((prev) => ({ ...prev, showTitle: event.target.checked }))}
                    disabled={formLoading || uploadingImage}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormSwitch
                    id='slider-item-show-description'
                    label='Hiển thị description'
                    checked={Boolean(formData.showDescription)}
                    onChange={(event) => setFormData((prev) => ({ ...prev, showDescription: event.target.checked }))}
                    disabled={formLoading || uploadingImage}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormSwitch
                    id='slider-item-open-new-tab'
                    label='Mở link ở tab mới'
                    checked={Boolean(formData.openInNewTab)}
                    onChange={(event) => setFormData((prev) => ({ ...prev, openInNewTab: event.target.checked }))}
                    disabled={formLoading || uploadingImage}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormSwitch
                    id='slider-item-is-active'
                    label='Đang hoạt động'
                    checked={Boolean(formData.isActive)}
                    onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
                    disabled={formLoading || uploadingImage}
                  />
                </CCol>
              </CRow>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' onClick={closeModal} disabled={formLoading || uploadingImage}>Hủy</CButton>
            <CButton color='primary' onClick={handleSubmit} disabled={formLoading || uploadingImage}>
              {formLoading || uploadingImage ? <><CSpinner size='sm' className='me-2' />Đang xử lý...</> : (editingId ? 'Cập nhật' : 'Thêm mới')}
            </CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}