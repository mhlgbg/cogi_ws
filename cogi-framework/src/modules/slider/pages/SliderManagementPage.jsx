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
  createSlider,
  deleteSlider,
  getSliders,
  updateSlider,
} from '../services/sliderManagementService'

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

function toPositiveIntegerOrNull(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}

export default function SliderManagementPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    interval: '4000',
    isActive: true,
  })

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

  async function load() {
    setLoading(true)
    setSuccess('')
    setError('')

    try {
      const res = await getSliders({ page, pageSize, q })
      setRows(res?.data || [])
      setMeta(res?.meta || null)
    } catch (loadError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách slider'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, pageSize, q])

  function resetForm() {
    setFormData({
      name: '',
      code: '',
      description: '',
      interval: '4000',
      isActive: true,
    })
  }

  function openCreateModal() {
    setEditingId(null)
    resetForm()
    setShowModal(true)
  }

  function openEditModal(item) {
    setEditingId(item.id)
    setFormData({
      name: item.name || '',
      code: item.code || '',
      description: item.description || '',
      interval: item.interval === null || item.interval === undefined ? '4000' : String(item.interval),
      isActive: item.isActive !== false,
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
  }

  async function handleSubmit() {
    const nextName = String(formData.name || '').trim()
    const nextCode = String(formData.code || '').trim()
    const nextDescription = String(formData.description || '').trim()
    const nextInterval = toPositiveIntegerOrNull(formData.interval)

    if (!nextName) {
      setError('Tên slider không được trống')
      return
    }

    if (!nextCode) {
      setError('Code slider không được trống')
      return
    }

    if (nextInterval === null) {
      setError('Interval phải là số nguyên không âm')
      return
    }

    setFormLoading(true)
    setError('')

    try {
      const payload = {
        name: nextName,
        code: nextCode,
        description: nextDescription || null,
        interval: nextInterval,
        isActive: Boolean(formData.isActive),
      }

      if (editingId) {
        await updateSlider(editingId, payload)
        setSuccess('Cập nhật slider thành công')
      } else {
        await createSlider(payload)
        setSuccess('Thêm mới slider thành công')
      }

      closeModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu slider'))
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa slider này?')) return

    setSuccess('')
    setError('')

    try {
      await deleteSlider(id)
      setSuccess('Xóa slider thành công')
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa slider'))
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
              <CCol md={8} lg={6}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo tên hoặc code...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol xs={12} className='d-flex justify-content-end gap-2'>
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
              <strong>Sliders</strong>
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
                      <CTableHeaderCell>Tên slider</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Code</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 120 }}>isActive</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Ngày tạo</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={5} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{item.name || '-'}</CTableDataCell>
                        <CTableDataCell>{item.code || '-'}</CTableDataCell>
                        <CTableDataCell>{item.isActive === false ? 'No' : 'Yes'}</CTableDataCell>
                        <CTableDataCell>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</CTableDataCell>
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
            <CModalTitle>{editingId ? 'Sửa slider' : 'Thêm mới slider'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={6}>
                  <CFormLabel htmlFor='slider-name'>Tên <span className='text-danger'>*</span></CFormLabel>
                  <CFormInput
                    id='slider-name'
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder='Nhập tên slider'
                    disabled={formLoading}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='slider-code'>Code <span className='text-danger'>*</span></CFormLabel>
                  <CFormInput
                    id='slider-code'
                    value={formData.code}
                    onChange={(event) => setFormData((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder='Ví dụ: home-hero'
                    disabled={formLoading}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='slider-interval'>Interval (ms)</CFormLabel>
                  <CFormInput
                    id='slider-interval'
                    type='number'
                    min='0'
                    step='1'
                    value={formData.interval}
                    onChange={(event) => setFormData((prev) => ({ ...prev, interval: event.target.value }))}
                    placeholder='4000'
                    disabled={formLoading}
                  />
                </CCol>
                <CCol md={6} className='d-flex align-items-end'>
                  <CFormSwitch
                    id='slider-is-active'
                    label='Đang hoạt động'
                    checked={Boolean(formData.isActive)}
                    onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
                    disabled={formLoading}
                  />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel htmlFor='slider-description'>Mô tả</CFormLabel>
                  <CFormTextarea
                    id='slider-description'
                    rows={4}
                    value={formData.description}
                    onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder='Mô tả ngắn về slider'
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