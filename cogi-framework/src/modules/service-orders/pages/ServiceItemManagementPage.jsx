import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
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
  createServiceItem,
  deleteServiceItem,
  getServiceCategoriesLookup,
  getServiceItems,
  updateServiceItem,
} from '../services/serviceItemService'

function normalizeRelation(value) {
  const data = value?.data || value
  if (!data || typeof data !== 'object') return null
  if (data.attributes && typeof data.attributes === 'object') {
    return { id: data.id, ...data.attributes }
  }
  return data
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.attributes && typeof raw.attributes === 'object') {
    const attributes = raw.attributes
    return {
      id: raw.id,
      ...attributes,
      category: normalizeRelation(attributes.category),
    }
  }

  return {
    ...raw,
    category: normalizeRelation(raw.category),
  }
}

function mapRows(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows.map(normalizeItem).filter(Boolean)
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'
  return new Intl.NumberFormat('vi-VN').format(amount)
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

export default function ServiceItemManagementPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [categoryOptions, setCategoryOptions] = useState([])
  const [categoryOptionsLoaded, setCategoryOptionsLoaded] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    unit: '',
    defaultPrice: '0',
    description: '',
    isActive: true,
    sortOrder: '0',
    category: '',
  })

  const total = meta?.pagination?.total ?? 0
  const pageCount = meta?.pagination?.pageCount ?? 1

  const fromToText = useMemo(() => {
    const pagination = meta?.pagination
    if (!pagination || total === 0) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, total)
    return `${from}–${to}/${total}`
  }, [meta, total])

  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])
  const categoryOptionIds = useMemo(
    () => new Set(categoryOptions.map((item) => Number(item?.id)).filter((value) => Number.isInteger(value) && value > 0)),
    [categoryOptions],
  )

  async function loadCategoryOptions() {
    try {
      const res = await getServiceCategoriesLookup({ pageSize: 500 })
      setCategoryOptions(mapRows(res))
    } catch {
      setCategoryOptions([])
    } finally {
      setCategoryOptionsLoaded(true)
    }
  }

  async function load() {
    setLoading(true)
    setSuccess('')
    setError('')

    try {
      const res = await getServiceItems({
        page,
        pageSize,
        q,
        categoryId: categoryFilter,
        isActive: statusFilter,
      })

      setRows(mapRows(res))
      setMeta(res?.meta ?? null)
    } catch (loadError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách service item'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategoryOptions()
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q, categoryFilter, statusFilter])

  function resetForm() {
    setFormData({
      code: '',
      name: '',
      unit: '',
      defaultPrice: '0',
      description: '',
      isActive: true,
      sortOrder: '0',
      category: '',
    })
  }

  function openCreateModal() {
    setEditingId(null)
    resetForm()
    setShowModal(true)
  }

  function openEditModal(item) {
    const currentCategoryId = item?.category?.id ? String(item.category.id) : ''
    const hasValidCategory = currentCategoryId && categoryOptionIds.has(Number(currentCategoryId))

    setEditingId(item.id)
    setFormData({
      code: item.code || '',
      name: item.name || '',
      unit: item.unit || '',
      defaultPrice: item.defaultPrice ?? '0',
      description: item.description || '',
      isActive: item.isActive !== false,
      sortOrder: item.sortOrder ?? '0',
      category: hasValidCategory || !categoryOptionsLoaded ? currentCategoryId : '',
    })
    if (currentCategoryId && categoryOptionsLoaded && !hasValidCategory) {
      setError('Danh mục hiện tại của service item không thuộc tenant hiện tại. Hãy chọn danh mục khác hoặc để trống trước khi lưu.')
    } else {
      setError('')
    }
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
    setCategoryFilter('')
    setStatusFilter('')
  }

  async function handleSubmit() {
    if (!String(formData.code).trim()) {
      setError('Mã service item không được trống')
      return
    }

    if (!String(formData.name).trim()) {
      setError('Tên service item không được trống')
      return
    }

    setFormLoading(true)
    setError('')

    try {
      const categoryId = Number(formData.category)
      const hasValidCategory = Number.isInteger(categoryId) && categoryId > 0 && categoryOptionIds.has(categoryId)

      const payload = {
        code: String(formData.code).trim(),
        name: String(formData.name).trim(),
        unit: String(formData.unit || '').trim() || null,
        defaultPrice: formData.defaultPrice === '' ? 0 : Number(formData.defaultPrice || 0),
        description: String(formData.description || '').trim() || null,
        isActive: Boolean(formData.isActive),
        sortOrder: formData.sortOrder === '' ? 0 : Number(formData.sortOrder || 0),
        category: hasValidCategory ? categoryId : null,
      }

      if (editingId) {
        await updateServiceItem(editingId, payload)
        setSuccess('Cập nhật service item thành công')
      } else {
        await createServiceItem(payload)
        setSuccess('Thêm mới service item thành công')
      }

      closeModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu service item'))
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa service item này?')) return

    setError('')
    setSuccess('')

    try {
      await deleteServiceItem(id)
      setSuccess('Xóa service item thành công')
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa service item'))
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
              <CCol md={5}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo mã, tên, mô tả...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={3}>
                <CFormLabel>Danh mục dịch vụ</CFormLabel>
                <CFormSelect value={categoryFilter} onChange={(event) => { setPage(1); setCategoryFilter(event.target.value) }}>
                  <option value=''>Tất cả</option>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name || option.code || `#${option.id}`}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value) }}>
                  <option value=''>Tất cả</option>
                  <option value='true'>Đang dùng</option>
                  <option value='false'>Tạm ngưng</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12} md={2} className='d-flex justify-content-end gap-2'>
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
              <strong>Service Items</strong>
              <CBadge color='secondary' className='ms-2'>{total}</CBadge>
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
                      <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Mã</CTableHeaderCell>
                      <CTableHeaderCell>Tên dịch vụ</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 190 }}>Danh mục</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 110 }}>Đơn vị</CTableHeaderCell>
                      <CTableHeaderCell className='text-end' style={{ width: 140 }}>Giá mặc định</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 110 }}>Sắp xếp</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 150 }}>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={10} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : (
                      rows.map((item, index) => (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                          <CTableDataCell>{item.code || '-'}</CTableDataCell>
                          <CTableDataCell>
                            <div className='fw-semibold'>{item.name || '-'}</div>
                            <div className='small text-body-secondary'>{item.description || '-'}</div>
                          </CTableDataCell>
                          <CTableDataCell>{item?.category?.name || item?.category?.code || '-'}</CTableDataCell>
                          <CTableDataCell>{item.unit || '-'}</CTableDataCell>
                          <CTableDataCell className='text-end'>{formatMoney(item.defaultPrice)}</CTableDataCell>
                          <CTableDataCell>{item.sortOrder ?? 0}</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={item.isActive === false ? 'secondary' : 'success'}>
                              {item.isActive === false ? 'Tạm ngưng' : 'Đang dùng'}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</CTableDataCell>
                          <CTableDataCell>
                            <div className='d-flex gap-2'>
                              <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                              <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item.id)}>Xóa</CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      ))
                    )}
                  </CTableBody>
                </CTable>

                <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                  <div className='d-flex align-items-center gap-2 ai-form'>
                    <span>Page size</span>
                    <CFormSelect value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value) || 10) }} style={{ width: 100 }}>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </CFormSelect>
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
            <CModalTitle>{editingId ? 'Sửa service item' : 'Thêm mới service item'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={6}>
                  <CFormLabel htmlFor='service-item-code'>Mã <span className='text-danger'>*</span></CFormLabel>
                  <CFormInput
                    id='service-item-code'
                    value={formData.code}
                    onChange={(event) => setFormData((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder='VD: SI001'
                    disabled={formLoading}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='service-item-name'>Tên <span className='text-danger'>*</span></CFormLabel>
                  <CFormInput
                    id='service-item-name'
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder='Nhập tên service item'
                    disabled={formLoading}
                  />
                </CCol>
                <CCol md={4}>
                  <CFormLabel htmlFor='service-item-category'>Danh mục</CFormLabel>
                  <CFormSelect
                    id='service-item-category'
                    value={formData.category}
                    onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                    disabled={formLoading}
                  >
                    <option value=''>-- Chọn danh mục --</option>
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name || option.code || `#${option.id}`}</option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={4}>
                  <CFormLabel htmlFor='service-item-unit'>Đơn vị</CFormLabel>
                  <CFormInput
                    id='service-item-unit'
                    value={formData.unit}
                    onChange={(event) => setFormData((prev) => ({ ...prev, unit: event.target.value }))}
                    placeholder='VD: lần, gói, cái'
                    disabled={formLoading}
                  />
                </CCol>
                <CCol md={4}>
                  <CFormLabel htmlFor='service-item-price'>Giá mặc định</CFormLabel>
                  <CFormInput
                    id='service-item-price'
                    type='number'
                    min={0}
                    step='any'
                    value={formData.defaultPrice}
                    onChange={(event) => setFormData((prev) => ({ ...prev, defaultPrice: event.target.value }))}
                    disabled={formLoading}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='service-item-sort-order'>Thứ tự sắp xếp</CFormLabel>
                  <CFormInput
                    id='service-item-sort-order'
                    type='number'
                    step='1'
                    value={formData.sortOrder}
                    onChange={(event) => setFormData((prev) => ({ ...prev, sortOrder: event.target.value }))}
                    disabled={formLoading}
                  />
                </CCol>
                <CCol md={6} className='d-flex align-items-end'>
                  <CFormCheck
                    id='service-item-active'
                    label='Đang dùng'
                    checked={formData.isActive}
                    onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
                    disabled={formLoading}
                  />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel htmlFor='service-item-description'>Mô tả</CFormLabel>
                  <CFormInput
                    id='service-item-description'
                    value={formData.description}
                    onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder='Mô tả ngắn về service item'
                    disabled={formLoading}
                  />
                </CCol>
              </CRow>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' onClick={closeModal} disabled={formLoading}>Hủy</CButton>
            <CButton color='primary' onClick={handleSubmit} disabled={formLoading}>
              {formLoading ? <><CSpinner size='sm' className='me-2' />Đang xử lý...</> : (editingId ? 'Cập nhật' : 'Thêm mới')}
            </CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}