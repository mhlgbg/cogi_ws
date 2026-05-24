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
  createJournalCategory,
  deleteJournalCategory,
  getJournalCategories,
  updateJournalCategory,
} from '../services/journalCategoryService'

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

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function JournalCategoryManagementPage() {
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
    title: '',
    slug: '',
    description: '',
  })
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)

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
      const res = await getJournalCategories({ page, pageSize, q })
      setRows(res?.data || [])
      setMeta(res?.meta || null)
    } catch (loadError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách danh mục tạp chí'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, pageSize, q])

  function resetForm() {
    setFormData({
      title: '',
      slug: '',
      description: '',
    })
    setIsSlugManuallyEdited(false)
  }

  function openCreateModal() {
    setEditingId(null)
    resetForm()
    setShowModal(true)
  }

  function openEditModal(item) {
    setEditingId(item.documentId || item.id)
    setFormData({
      title: item.title || '',
      slug: item.slug || '',
      description: item.description || '',
    })
    setIsSlugManuallyEdited(Boolean(String(item.slug || '').trim()))
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

  function updateField(field, value) {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'title' && !isSlugManuallyEdited) {
        next.slug = slugify(value)
      }
      return next
    })
  }

  async function handleSubmit() {
    const nextTitle = String(formData.title || '').trim()
    const nextSlug = String(formData.slug || '').trim()
    const nextDescription = String(formData.description || '').trim()

    if (!nextTitle) {
      setError('Tên danh mục tạp chí không được trống')
      return
    }

    setFormLoading(true)
    setError('')

    try {
      const payload = {
        title: nextTitle,
        description: nextDescription || null,
      }

      if (nextSlug) {
        payload.slug = nextSlug
      }

      if (editingId) {
        await updateJournalCategory(editingId, payload)
        setSuccess('Cập nhật danh mục tạp chí thành công')
      } else {
        await createJournalCategory(payload)
        setSuccess('Thêm mới danh mục tạp chí thành công')
      }

      closeModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu danh mục tạp chí'))
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa danh mục tạp chí này?')) return

    setSuccess('')
    setError('')

    try {
      await deleteJournalCategory(id)
      setSuccess('Xóa danh mục tạp chí thành công')
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa danh mục tạp chí'))
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
                  placeholder='Tìm theo tiêu đề, slug, mô tả...'
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
              <strong>Danh mục tạp chí</strong>
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
                      <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 240 }}>Slug</CTableHeaderCell>
                      <CTableHeaderCell>Mô tả</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={6} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => (
                      <CTableRow key={item.documentId || item.id}>
                        <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                        <CTableDataCell>{item.title || '-'}</CTableDataCell>
                        <CTableDataCell>{item.slug || '-'}</CTableDataCell>
                        <CTableDataCell>{item.description || '-'}</CTableDataCell>
                        <CTableDataCell>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item.documentId || item.id)}>Xóa</CButton>
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
            <CModalTitle>{editingId ? 'Sửa danh mục tạp chí' : 'Thêm mới danh mục tạp chí'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={6}>
                  <CFormLabel htmlFor='journal-category-title'>Tiêu đề <span className='text-danger'>*</span></CFormLabel>
                  <CFormInput
                    id='journal-category-title'
                    value={formData.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    placeholder='Nhập tiêu đề danh mục'
                    disabled={formLoading}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='journal-category-slug'>Slug</CFormLabel>
                  <CFormInput
                    id='journal-category-slug'
                    value={formData.slug}
                    onChange={(event) => {
                      setIsSlugManuallyEdited(true)
                      updateField('slug', slugify(event.target.value))
                    }}
                    placeholder='Để trống để tự sinh theo tiêu đề'
                    disabled={formLoading}
                  />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel htmlFor='journal-category-description'>Mô tả</CFormLabel>
                  <CFormTextarea
                    id='journal-category-description'
                    rows={4}
                    value={formData.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    placeholder='Nhập mô tả danh mục'
                    disabled={formLoading}
                  />
                </CCol>
              </CRow>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeModal} disabled={formLoading}>Đóng</CButton>
            <CButton color='primary' onClick={handleSubmit} disabled={formLoading}>{formLoading ? 'Đang lưu...' : 'Lưu'}</CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}