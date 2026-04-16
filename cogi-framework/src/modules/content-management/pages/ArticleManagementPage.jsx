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
  createArticle,
  deleteArticle,
  getArticleById,
  getArticles,
  getMediaUrl,
  getRelationId,
  updateArticle,
  uploadMediaFiles,
} from '../services/articleService'
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'
import { createAuthor, getAuthors } from '../services/authorService'
import { createCategory, getCategories } from '../services/categoryService'

const BLOCK_TYPES = [
  { value: 'shared.rich-text', label: 'Rich text' },
  { value: 'shared.quote', label: 'Quote' },
  { value: 'shared.media', label: 'Media' },
  { value: 'shared.slider', label: 'Slider' },
]

function createLocalId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function slugifyVietnamese(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

  return normalized.slice(0, 160).replace(/-+$/g, '')
}

function toDatetimeLocalValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function fromDatetimeLocalValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function formatReadableDateTime(value) {
  const raw = String(value || '').trim()
  if (!raw) return '-'

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '-'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}`
}

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

function getBlockLabel(type) {
  return BLOCK_TYPES.find((item) => item.value === type)?.label || type
}

function createEmptyBlock(type) {
  switch (type) {
    case 'shared.quote':
      return {
        localId: createLocalId('block'),
        __component: type,
        title: '',
        body: '',
      }
    case 'shared.media':
      return {
        localId: createLocalId('block'),
        __component: type,
        file: null,
        pendingFile: null,
      }
    case 'shared.slider':
      return {
        localId: createLocalId('block'),
        __component: type,
        files: [],
        pendingFiles: [],
      }
    case 'shared.rich-text':
    default:
      return {
        localId: createLocalId('block'),
        __component: 'shared.rich-text',
        body: '',
      }
  }
}

function normalizeBlockForForm(block) {
  const type = String(block?.__component || '').trim()
  const baseId = createLocalId('block')

  if (type === 'shared.quote') {
    return {
      localId: baseId,
      __component: type,
      title: block?.title || '',
      body: block?.body || '',
    }
  }

  if (type === 'shared.media') {
    return {
      localId: baseId,
      __component: type,
      file: block?.file || null,
      pendingFile: null,
    }
  }

  if (type === 'shared.slider') {
    return {
      localId: baseId,
      __component: type,
      files: Array.isArray(block?.files) ? block.files.filter(Boolean) : [],
      pendingFiles: [],
    }
  }

  return {
    localId: baseId,
    __component: 'shared.rich-text',
    body: block?.body || '',
  }
}

function getFileLabel(file, fallback) {
  return file?.name || file?.alternativeText || file?.caption || fallback
}

function normalizeArticleForm(article) {
  return {
    title: article?.title || '',
    slug: article?.slug || '',
    description: article?.description || '',
    authorId: article?.author?.id ? String(article.author.id) : '',
    categoryId: article?.category?.id ? String(article.category.id) : '',
    publicAt: toDatetimeLocalValue(article?.publicAt),
    publishState: article?.publishedAt ? 'published' : 'draft',
    publishedAt: article?.publishedAt || null,
    blocks: Array.isArray(article?.blocks) ? article.blocks.map(normalizeBlockForForm) : [],
  }
}

function getDefaultArticleForm() {
  return {
    title: '',
    slug: '',
    description: '',
    authorId: '',
    categoryId: '',
    publicAt: '',
    publishState: 'draft',
    publishedAt: null,
    blocks: [createEmptyBlock('shared.rich-text')],
  }
}

function extractSummary(article) {
  const blocksCount = Array.isArray(article?.blocks) ? article.blocks.length : 0
  const statusText = String(article?.statusLabel || (article?.publishedAt ? 'Published' : 'Draft')).trim()
  return `${statusText} • ${blocksCount} block${blocksCount === 1 ? '' : 's'}`
}

export default function ArticleManagementPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [status, setStatus] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [relationsLoading, setRelationsLoading] = useState(false)
  const [formData, setFormData] = useState(getDefaultArticleForm())
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)
  const [coverState, setCoverState] = useState({
    current: null,
    pendingFile: null,
    changed: false,
  })

  const [authors, setAuthors] = useState([])
  const [categories, setCategories] = useState([])

  const [showAuthorModal, setShowAuthorModal] = useState(false)
  const [quickAuthorLoading, setQuickAuthorLoading] = useState(false)
  const [quickAuthorForm, setQuickAuthorForm] = useState({ name: '', email: '' })

  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [quickCategoryLoading, setQuickCategoryLoading] = useState(false)
  const [quickCategoryForm, setQuickCategoryForm] = useState({ name: '', slug: '', description: '' })

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

  const coverPreviewUrl = useMemo(() => {
    if (coverState.pendingFile) return ''
    return getMediaUrl(coverState.current)
  }, [coverState])

  async function load() {
    setLoading(true)
    setError('')

    try {
      const res = await getArticles({ page, pageSize, q, status })
      setRows(res?.data || [])
      setMeta(res?.meta || null)
    } catch (loadError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách article'))
    } finally {
      setLoading(false)
    }
  }

  async function loadRelations() {
    setRelationsLoading(true)

    try {
      const [authorRes, categoryRes] = await Promise.all([
        getAuthors({ page: 1, pageSize: 100, q: '' }),
        getCategories({ page: 1, pageSize: 100, q: '' }),
      ])

      setAuthors(authorRes?.data || [])
      setCategories(categoryRes?.data || [])
    } catch (relationError) {
      setError(getApiMessage(relationError, 'Không tải được author/category cho article'))
    } finally {
      setRelationsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, pageSize, q, status])

  function resetArticleForm() {
    setFormData(getDefaultArticleForm())
    setIsSlugManuallyEdited(false)
    setCoverState({
      current: null,
      pendingFile: null,
      changed: false,
    })
  }

  async function openCreateModal() {
    setEditingId(null)
    resetArticleForm()
    setShowModal(true)
    await loadRelations()
  }

  async function openEditModal(item) {
    const documentId = String(item?.documentId || item?.id || '').trim()
    setEditingId(documentId)
    setShowModal(true)
    setDetailLoading(true)
    setError('')

    try {
      await loadRelations()
      const res = await getArticleById(documentId, { status: 'draft' })
      const article = res?.data || null
      setFormData(normalizeArticleForm(article))
      setIsSlugManuallyEdited(Boolean(String(article?.slug || '').trim()))
      setCoverState({
        current: article?.cover || null,
        pendingFile: null,
        changed: false,
      })
    } catch (detailError) {
      setError(getApiMessage(detailError, 'Không tải được chi tiết article'))
      setShowModal(false)
      setEditingId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setDetailLoading(false)
    resetArticleForm()
  }

  function applySearch() {
    setPage(1)
    setQ(qDraft.trim())
  }

  function onReset() {
    setPage(1)
    setQ('')
    setQDraft('')
    setStatus('')
  }

  function updateBlock(blockId, updater) {
    setFormData((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) => (block.localId === blockId ? updater(block) : block)),
    }))
  }

  function addBlock(type) {
    setFormData((prev) => ({
      ...prev,
      blocks: [...prev.blocks, createEmptyBlock(type)],
    }))
  }

  function removeBlock(blockId) {
    setFormData((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((block) => block.localId !== blockId),
    }))
  }

  function moveBlock(blockId, direction) {
    setFormData((prev) => {
      const nextBlocks = [...prev.blocks]
      const index = nextBlocks.findIndex((block) => block.localId === blockId)
      if (index < 0) return prev

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= nextBlocks.length) return prev

      const [current] = nextBlocks.splice(index, 1)
      nextBlocks.splice(targetIndex, 0, current)

      return {
        ...prev,
        blocks: nextBlocks,
      }
    })
  }

  async function ensureUploadedIds(files, fallbackMessage) {
    if (!Array.isArray(files) || files.length === 0) return []
    const uploaded = await uploadMediaFiles(files)
    const ids = uploaded.map((item) => getRelationId(item)).filter(Boolean)

    if (ids.length !== files.length) {
      throw new Error(fallbackMessage)
    }

    return ids
  }

  async function serializeBlocks() {
    const normalizedBlocks = []

    for (const block of formData.blocks) {
      if (block.__component === 'shared.rich-text') {
        const nextBody = String(block.body || '').trim()
        if (!nextBody) continue

        normalizedBlocks.push({
          __component: 'shared.rich-text',
          body: nextBody,
        })
        continue
      }

      if (block.__component === 'shared.quote') {
        const nextTitle = String(block.title || '').trim()
        const nextBody = String(block.body || '').trim()
        if (!nextTitle && !nextBody) continue

        normalizedBlocks.push({
          __component: 'shared.quote',
          title: nextTitle || null,
          body: nextBody || null,
        })
        continue
      }

      if (block.__component === 'shared.media') {
        let fileId = getRelationId(block.file)

        if (block.pendingFile) {
          const uploadedIds = await ensureUploadedIds([block.pendingFile], 'Upload media block thất bại')
          fileId = uploadedIds[0] || null
        }

        if (!fileId) continue

        normalizedBlocks.push({
          __component: 'shared.media',
          file: fileId,
        })
        continue
      }

      if (block.__component === 'shared.slider') {
        const existingIds = Array.isArray(block.files)
          ? block.files.map((item) => getRelationId(item)).filter(Boolean)
          : []
        const uploadedIds = await ensureUploadedIds(block.pendingFiles || [], 'Upload slider block thất bại')
        const allIds = Array.from(new Set([...existingIds, ...uploadedIds]))
        if (allIds.length === 0) continue

        normalizedBlocks.push({
          __component: 'shared.slider',
          files: allIds,
        })
      }
    }

    return normalizedBlocks
  }

  async function buildArticlePayload() {
    const title = String(formData.title || '').trim()
    const slug = slugifyVietnamese(String(formData.slug || '').trim() || title)
    const description = String(formData.description || '').trim()
    const authorId = String(formData.authorId || '').trim()
    const categoryId = String(formData.categoryId || '').trim()
    const publicAt = fromDatetimeLocalValue(formData.publicAt)

    if (!title) {
      throw new Error('Tiêu đề article không được trống')
    }

    const payload = {
      title,
      description: description || null,
      author: authorId || null,
      category: categoryId || null,
      publicAt,
      blocks: await serializeBlocks(),
    }

    if (slug) {
      payload.slug = slug
    }

    if (coverState.pendingFile) {
      const uploadedIds = await ensureUploadedIds([coverState.pendingFile], 'Upload cover thất bại')
      payload.cover = uploadedIds[0] || null
    } else if (coverState.changed && !coverState.current) {
      payload.cover = null
    }

    return payload
  }

  async function handleSubmit() {
    setFormLoading(true)
    setError('')

    try {
      const payload = await buildArticlePayload()
      const targetStatus = formData.publishState === 'published' ? 'published' : 'draft'

      if (editingId) {
        await updateArticle(editingId, payload, { status: targetStatus })
        setSuccess('Cập nhật article thành công')
      } else {
        await createArticle(payload, { status: targetStatus })
        setSuccess('Thêm mới article thành công')
      }

      closeModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu article'))
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa article này?')) return

    setSuccess('')
    setError('')

    try {
      await deleteArticle(id)
      setSuccess('Xóa article thành công')
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa article'))
    }
  }

  async function handleQuickCreateAuthor() {
    const name = String(quickAuthorForm.name || '').trim()
    const email = String(quickAuthorForm.email || '').trim()

    if (!name) {
      setError('Tên author không được trống')
      return
    }

    setQuickAuthorLoading(true)

    try {
      const created = await createAuthor({
        name,
        email: email || null,
      })

      const createdAuthorId = getRelationId(created?.data || created)
      await loadRelations()
      if (createdAuthorId) {
        setFormData((prev) => ({ ...prev, authorId: String(createdAuthorId) }))
      }
      setQuickAuthorForm({ name: '', email: '' })
      setShowAuthorModal(false)
      setSuccess('Đã tạo nhanh author cho article')
    } catch (quickError) {
      setError(getApiMessage(quickError, 'Không thể tạo nhanh author'))
    } finally {
      setQuickAuthorLoading(false)
    }
  }

  async function handleQuickCreateCategory() {
    const name = String(quickCategoryForm.name || '').trim()
    const slug = String(quickCategoryForm.slug || '').trim()
    const description = String(quickCategoryForm.description || '').trim()

    if (!name) {
      setError('Tên category không được trống')
      return
    }

    setQuickCategoryLoading(true)

    try {
      const payload = {
        name,
        description: description || null,
      }

      if (slug) payload.slug = slug

      const created = await createCategory(payload)
      const createdCategoryId = getRelationId(created?.data || created)
      await loadRelations()
      if (createdCategoryId) {
        setFormData((prev) => ({ ...prev, categoryId: String(createdCategoryId) }))
      }
      setQuickCategoryForm({ name: '', slug: '', description: '' })
      setShowCategoryModal(false)
      setSuccess('Đã tạo nhanh category cho article')
    } catch (quickError) {
      setError(getApiMessage(quickError, 'Không thể tạo nhanh category'))
    } finally {
      setQuickCategoryLoading(false)
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
              <CCol lg={5} md={6}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo tiêu đề, slug, mô tả, author, category...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol lg={3} md={6}>
                <CFormSelect
                  label='Trạng thái'
                  value={status}
                  onChange={(event) => {
                    setPage(1)
                    setStatus(event.target.value)
                  }}
                >
                  <option value=''>Tất cả</option>
                  <option value='published'>Published</option>
                  <option value='draft'>Draft</option>
                </CFormSelect>
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
              <strong>Articles</strong>
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
                      <CTableHeaderCell style={{ width: 90 }}>Cover</CTableHeaderCell>
                      <CTableHeaderCell>Article</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Category</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Author</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Ngày xuất bản</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => {
                      const coverUrl = getMediaUrl(item.cover)
                      const displayDate = item.publicAt || null

                      return (
                        <CTableRow key={item.documentId || item.id}>
                          <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                          <CTableDataCell>
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt={item.title || 'Article'}
                                style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }}
                              />
                            ) : '-'}
                          </CTableDataCell>
                          <CTableDataCell>
                            <div className='fw-semibold'>{item.title || '-'}</div>
                            <div className='text-body-secondary small'>{item.slug || '-'}</div>
                            <div className='text-body-secondary small'>{extractSummary(item)}</div>
                          </CTableDataCell>
                          <CTableDataCell>{item.category?.name || '-'}</CTableDataCell>
                          <CTableDataCell>{item.author?.name || '-'}</CTableDataCell>
                          <CTableDataCell>
                            <div>{item.statusLabel || (item.publishedAt ? 'Published' : 'Draft')}</div>
                          </CTableDataCell>
                          <CTableDataCell>{formatReadableDateTime(displayDate)}</CTableDataCell>
                          <CTableDataCell>{formatReadableDateTime(item.updatedAt)}</CTableDataCell>
                          <CTableDataCell>
                            <div className='d-flex gap-2'>
                              <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                              <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item.documentId || item.id)}>Xóa</CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
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

        <CModal backdrop='static' visible={showModal} onClose={closeModal} size='xl'>
          <CModalHeader>
            <CModalTitle>{editingId ? 'Sửa article' : 'Thêm mới article'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {detailLoading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải chi tiết article...</span>
              </div>
            ) : (
              <CForm>
                <CRow className='g-4'>
                  <CCol xs={12}>
                    <CCard className='border-0 shadow-sm'>
                      <CCardHeader>
                        <strong>Thông tin cơ bản</strong>
                      </CCardHeader>
                      <CCardBody>
                        <CRow className='g-3'>
                          <CCol md={8}>
                            <CFormLabel htmlFor='article-title'>Tiêu đề <span className='text-danger'>*</span></CFormLabel>
                            <CFormInput
                              id='article-title'
                              value={formData.title}
                              onChange={(event) => {
                                const nextTitle = event.target.value
                                setFormData((prev) => ({
                                  ...prev,
                                  title: nextTitle,
                                  slug: isSlugManuallyEdited ? prev.slug : slugifyVietnamese(nextTitle),
                                }))
                              }}
                              placeholder='Nhập tiêu đề bài viết'
                              disabled={formLoading}
                            />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel htmlFor='article-slug'>Slug</CFormLabel>
                            <CFormInput
                              id='article-slug'
                              value={formData.slug}
                              onChange={(event) => {
                                const nextSlug = slugifyVietnamese(event.target.value)
                                setFormData((prev) => ({ ...prev, slug: nextSlug }))
                                setIsSlugManuallyEdited(Boolean(nextSlug))
                              }}
                              placeholder='Để trống để tự sinh'
                              disabled={formLoading}
                            />
                          </CCol>
                          <CCol md={8}>
                            <CFormLabel htmlFor='article-description'>Mô tả ngắn</CFormLabel>
                            <CFormTextarea
                              id='article-description'
                              rows={3}
                              value={formData.description}
                              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                              placeholder='Mô tả ngắn cho bài viết'
                              disabled={formLoading}
                            />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel htmlFor='article-public-at'>Ngày xuất bản</CFormLabel>
                            <CFormInput
                              id='article-public-at'
                              type='datetime-local'
                              value={formData.publicAt}
                              onChange={(event) => setFormData((prev) => ({ ...prev, publicAt: event.target.value }))}
                              disabled={formLoading}
                            />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel htmlFor='article-publish-state'>Trạng thái publish</CFormLabel>
                            <CFormSelect
                              id='article-publish-state'
                              value={formData.publishState}
                              onChange={(event) => setFormData((prev) => ({ ...prev, publishState: event.target.value }))}
                              disabled={formLoading}
                            >
                              <option value='draft'>Draft</option>
                              <option value='published'>Published</option>
                            </CFormSelect>
                            <div className='small text-body-secondary mt-2'>
                              {formData.publishState === 'published'
                                ? 'Article sẽ được publish ngay khi lưu.'
                                : 'Article được lưu ở trạng thái draft.'}
                            </div>
                          </CCol>
                        </CRow>
                      </CCardBody>
                    </CCard>
                  </CCol>

                  <CCol lg={6}>
                    <CCard className='border-0 shadow-sm h-100'>
                      <CCardHeader className='d-flex align-items-center justify-content-between gap-2'>
                        <strong>Quan hệ</strong>
                        {relationsLoading ? <span className='small text-body-secondary'>Đang tải lựa chọn...</span> : null}
                      </CCardHeader>
                      <CCardBody>
                        <CRow className='g-3'>
                          <CCol xs={12}>
                            <div className='d-flex justify-content-between align-items-center mb-2 gap-2'>
                              <CFormLabel htmlFor='article-category' className='mb-0'>Category</CFormLabel>
                              <CButton size='sm' color='secondary' variant='outline' onClick={() => setShowCategoryModal(true)} disabled={formLoading || relationsLoading}>+ Tạo nhanh Category</CButton>
                            </div>
                            <CFormSelect
                              id='article-category'
                              value={formData.categoryId}
                              onChange={(event) => setFormData((prev) => ({ ...prev, categoryId: event.target.value }))}
                              disabled={formLoading || relationsLoading}
                            >
                              <option value=''>-- Chưa chọn category --</option>
                              {categories.map((item) => (
                                <option key={item.id} value={item.id}>{item.name || `Category #${item.id}`}</option>
                              ))}
                            </CFormSelect>
                          </CCol>
                          <CCol xs={12}>
                            <div className='d-flex justify-content-between align-items-center mb-2 gap-2'>
                              <CFormLabel htmlFor='article-author' className='mb-0'>Author</CFormLabel>
                              <CButton size='sm' color='secondary' variant='outline' onClick={() => setShowAuthorModal(true)} disabled={formLoading || relationsLoading}>+ Tạo nhanh Author</CButton>
                            </div>
                            <CFormSelect
                              id='article-author'
                              value={formData.authorId}
                              onChange={(event) => setFormData((prev) => ({ ...prev, authorId: event.target.value }))}
                              disabled={formLoading || relationsLoading}
                            >
                              <option value=''>-- Chưa chọn author --</option>
                              {authors.map((item) => (
                                <option key={item.id} value={item.id}>{item.name || `Author #${item.id}`}</option>
                              ))}
                            </CFormSelect>
                          </CCol>
                        </CRow>
                      </CCardBody>
                    </CCard>
                  </CCol>

                  <CCol lg={6}>
                    <CCard className='border-0 shadow-sm h-100'>
                      <CCardHeader>
                        <strong>Cover</strong>
                      </CCardHeader>
                      <CCardBody>
                        {coverPreviewUrl ? (
                          <div className='mb-3'>
                            <img
                              src={coverPreviewUrl}
                              alt={formData.title || 'Cover'}
                              style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 16 }}
                            />
                          </div>
                        ) : null}

                        {coverState.pendingFile ? (
                          <div className='mb-3 small text-body-secondary'>
                            Sẽ upload cover mới: {coverState.pendingFile.name}
                          </div>
                        ) : null}

                        {!coverPreviewUrl && !coverState.pendingFile ? (
                          <div className='mb-3 text-body-secondary small'>Chưa có cover</div>
                        ) : null}

                        <CFormInput
                          type='file'
                          accept='image/*,video/*,.pdf,.doc,.docx'
                          onChange={(event) => {
                            const nextFile = event.target.files?.[0] || null
                            setCoverState((prev) => ({
                              ...prev,
                              pendingFile: nextFile,
                              changed: true,
                            }))
                          }}
                          disabled={formLoading}
                        />

                        <div className='d-flex gap-2 mt-3'>
                          <CButton
                            size='sm'
                            color='secondary'
                            variant='outline'
                            onClick={() => setCoverState((prev) => ({ ...prev, pendingFile: null, changed: prev.changed || Boolean(prev.current) }))}
                            disabled={formLoading || !coverState.pendingFile}
                          >
                            Bỏ file mới chọn
                          </CButton>
                          <CButton
                            size='sm'
                            color='danger'
                            variant='outline'
                            onClick={() => setCoverState({ current: null, pendingFile: null, changed: true })}
                            disabled={formLoading || (!coverState.current && !coverState.pendingFile)}
                          >
                            Gỡ cover
                          </CButton>
                        </div>
                      </CCardBody>
                    </CCard>
                  </CCol>

                  <CCol xs={12}>
                    <CCard className='border-0 shadow-sm'>
                      <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
                        <strong>Blocks</strong>
                        <div className='d-flex gap-2 flex-wrap'>
                          {BLOCK_TYPES.map((item) => (
                            <CButton key={item.value} size='sm' color='secondary' variant='outline' onClick={() => addBlock(item.value)} disabled={formLoading}>
                              + {item.label}
                            </CButton>
                          ))}
                        </div>
                      </CCardHeader>
                      <CCardBody>
                        {formData.blocks.length === 0 ? (
                          <div className='text-body-secondary'>Chưa có block nào. Hãy thêm ít nhất một thành phần nội dung.</div>
                        ) : (
                          <div className='d-flex flex-column gap-3'>
                            {formData.blocks.map((block, index) => (
                              <CCard key={block.localId} className='border'>
                                <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                                  <div>
                                    <strong>#{index + 1} - {getBlockLabel(block.__component)}</strong>
                                  </div>
                                  <div className='d-flex gap-2'>
                                    <CButton size='sm' color='secondary' variant='outline' onClick={() => moveBlock(block.localId, 'up')} disabled={index === 0 || formLoading}>Lên</CButton>
                                    <CButton size='sm' color='secondary' variant='outline' onClick={() => moveBlock(block.localId, 'down')} disabled={index === formData.blocks.length - 1 || formLoading}>Xuống</CButton>
                                    <CButton size='sm' color='danger' variant='outline' onClick={() => removeBlock(block.localId)} disabled={formLoading}>Xóa block</CButton>
                                  </div>
                                </CCardHeader>
                                <CCardBody>
                                  {block.__component === 'shared.rich-text' ? (
                                    <SimpleHtmlEditor
                                      label='Nội dung HTML'
                                      rows={12}
                                      value={block.body}
                                      onChange={(nextValue) => updateBlock(block.localId, (current) => ({ ...current, body: nextValue }))}
                                      placeholder='<p>Nhập nội dung bài viết...</p><h2>Tiêu đề nhỏ</h2><ul><li>Ý chính</li></ul>'
                                      disabled={formLoading}
                                    />
                                  ) : null}

                                  {block.__component === 'shared.quote' ? (
                                    <CRow className='g-3'>
                                      <CCol md={4}>
                                        <CFormLabel htmlFor={`${block.localId}-title`}>Tiêu đề quote</CFormLabel>
                                        <CFormInput
                                          id={`${block.localId}-title`}
                                          value={block.title}
                                          onChange={(event) => updateBlock(block.localId, (current) => ({ ...current, title: event.target.value }))}
                                          placeholder='Ví dụ: Câu nói nổi bật'
                                          disabled={formLoading}
                                        />
                                      </CCol>
                                      <CCol md={8}>
                                        <CFormLabel htmlFor={`${block.localId}-quote-body`}>Nội dung quote</CFormLabel>
                                        <CFormTextarea
                                          id={`${block.localId}-quote-body`}
                                          rows={4}
                                          value={block.body}
                                          onChange={(event) => updateBlock(block.localId, (current) => ({ ...current, body: event.target.value }))}
                                          placeholder='Nhập nội dung quote'
                                          disabled={formLoading}
                                        />
                                      </CCol>
                                    </CRow>
                                  ) : null}

                                  {block.__component === 'shared.media' ? (
                                    <>
                                      {getMediaUrl(block.file) ? (
                                        <div className='mb-3'>
                                          <img
                                            src={getMediaUrl(block.file)}
                                            alt={getFileLabel(block.file, 'Media block')}
                                            style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12 }}
                                          />
                                        </div>
                                      ) : null}
                                      {block.pendingFile ? (
                                        <div className='mb-2 small text-body-secondary'>Sẽ upload: {block.pendingFile.name}</div>
                                      ) : null}
                                      {!getMediaUrl(block.file) && !block.pendingFile ? (
                                        <div className='mb-2 small text-body-secondary'>Block này chưa có media</div>
                                      ) : null}
                                      <CFormInput
                                        type='file'
                                        accept='image/*,video/*,.pdf,.doc,.docx'
                                        onChange={(event) => {
                                          const nextFile = event.target.files?.[0] || null
                                          updateBlock(block.localId, (current) => ({ ...current, pendingFile: nextFile }))
                                        }}
                                        disabled={formLoading}
                                      />
                                      <div className='d-flex gap-2 mt-3'>
                                        <CButton
                                          size='sm'
                                          color='secondary'
                                          variant='outline'
                                          onClick={() => updateBlock(block.localId, (current) => ({ ...current, pendingFile: null }))}
                                          disabled={formLoading || !block.pendingFile}
                                        >
                                          Bỏ file mới chọn
                                        </CButton>
                                        <CButton
                                          size='sm'
                                          color='danger'
                                          variant='outline'
                                          onClick={() => updateBlock(block.localId, (current) => ({ ...current, file: null, pendingFile: null }))}
                                          disabled={formLoading || (!block.file && !block.pendingFile)}
                                        >
                                          Gỡ media
                                        </CButton>
                                      </div>
                                    </>
                                  ) : null}

                                  {block.__component === 'shared.slider' ? (
                                    <>
                                      <div className='mb-3'>
                                        <div className='fw-semibold mb-2'>Ảnh hiện có</div>
                                        {Array.isArray(block.files) && block.files.length > 0 ? (
                                          <div className='d-flex flex-column gap-2'>
                                            {block.files.map((file, fileIndex) => (
                                              <div key={`${block.localId}-file-${getRelationId(file) || fileIndex}`} className='d-flex align-items-center justify-content-between gap-2 border rounded px-3 py-2'>
                                                <div className='d-flex align-items-center gap-2'>
                                                  {getMediaUrl(file) ? (
                                                    <img
                                                      src={getMediaUrl(file)}
                                                      alt={getFileLabel(file, `Slide ${fileIndex + 1}`)}
                                                      style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }}
                                                    />
                                                  ) : null}
                                                  <span>{getFileLabel(file, `Slide ${fileIndex + 1}`)}</span>
                                                </div>
                                                <CButton
                                                  size='sm'
                                                  color='danger'
                                                  variant='outline'
                                                  onClick={() => updateBlock(block.localId, (current) => ({
                                                    ...current,
                                                    files: current.files.filter((item) => String(getRelationId(item)) !== String(getRelationId(file))),
                                                  }))}
                                                  disabled={formLoading}
                                                >
                                                  Gỡ
                                                </CButton>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className='small text-body-secondary'>Chưa có ảnh nào trong slider</div>
                                        )}
                                      </div>

                                      {Array.isArray(block.pendingFiles) && block.pendingFiles.length > 0 ? (
                                        <div className='mb-3'>
                                          <div className='fw-semibold mb-2'>Ảnh sẽ upload</div>
                                          <div className='small text-body-secondary'>
                                            {block.pendingFiles.map((file) => file.name).join(', ')}
                                          </div>
                                        </div>
                                      ) : null}

                                      <CFormInput
                                        type='file'
                                        accept='image/*'
                                        multiple
                                        onChange={(event) => {
                                          const nextFiles = Array.from(event.target.files || [])
                                          updateBlock(block.localId, (current) => ({ ...current, pendingFiles: nextFiles }))
                                        }}
                                        disabled={formLoading}
                                      />
                                      <div className='d-flex gap-2 mt-3'>
                                        <CButton
                                          size='sm'
                                          color='secondary'
                                          variant='outline'
                                          onClick={() => updateBlock(block.localId, (current) => ({ ...current, pendingFiles: [] }))}
                                          disabled={formLoading || !block.pendingFiles?.length}
                                        >
                                          Bỏ danh sách ảnh mới
                                        </CButton>
                                      </div>
                                    </>
                                  ) : null}
                                </CCardBody>
                              </CCard>
                            ))}
                          </div>
                        )}
                      </CCardBody>
                    </CCard>
                  </CCol>
                </CRow>
              </CForm>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeModal} disabled={formLoading}>Đóng</CButton>
            <CButton color='primary' onClick={handleSubmit} disabled={formLoading || detailLoading}>
              {formLoading ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo article'}
            </CButton>
          </CModalFooter>
        </CModal>

        <CModal backdrop='static' visible={showAuthorModal} onClose={() => setShowAuthorModal(false)}>
          <CModalHeader>
            <CModalTitle>Tạo nhanh Author</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CRow className='g-3'>
              <CCol xs={12}>
                <CFormLabel htmlFor='quick-author-name'>Tên author <span className='text-danger'>*</span></CFormLabel>
                <CFormInput
                  id='quick-author-name'
                  value={quickAuthorForm.name}
                  onChange={(event) => setQuickAuthorForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder='Nhập tên author'
                  disabled={quickAuthorLoading}
                />
              </CCol>
              <CCol xs={12}>
                <CFormLabel htmlFor='quick-author-email'>Email</CFormLabel>
                <CFormInput
                  id='quick-author-email'
                  value={quickAuthorForm.email}
                  onChange={(event) => setQuickAuthorForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder='Nhập email author'
                  disabled={quickAuthorLoading}
                />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={() => setShowAuthorModal(false)} disabled={quickAuthorLoading}>Đóng</CButton>
            <CButton color='primary' onClick={handleQuickCreateAuthor} disabled={quickAuthorLoading}>{quickAuthorLoading ? 'Đang tạo...' : 'Tạo author'}</CButton>
          </CModalFooter>
        </CModal>

        <CModal backdrop='static' visible={showCategoryModal} onClose={() => setShowCategoryModal(false)}>
          <CModalHeader>
            <CModalTitle>Tạo nhanh Category</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CRow className='g-3'>
              <CCol xs={12}>
                <CFormLabel htmlFor='quick-category-name'>Tên category <span className='text-danger'>*</span></CFormLabel>
                <CFormInput
                  id='quick-category-name'
                  value={quickCategoryForm.name}
                  onChange={(event) => setQuickCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder='Nhập tên category'
                  disabled={quickCategoryLoading}
                />
              </CCol>
              <CCol xs={12}>
                <CFormLabel htmlFor='quick-category-slug'>Slug</CFormLabel>
                <CFormInput
                  id='quick-category-slug'
                  value={quickCategoryForm.slug}
                  onChange={(event) => setQuickCategoryForm((prev) => ({ ...prev, slug: event.target.value }))}
                  placeholder='Để trống để tự sinh'
                  disabled={quickCategoryLoading}
                />
              </CCol>
              <CCol xs={12}>
                <CFormLabel htmlFor='quick-category-description'>Mô tả</CFormLabel>
                <CFormTextarea
                  id='quick-category-description'
                  rows={4}
                  value={quickCategoryForm.description}
                  onChange={(event) => setQuickCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder='Nhập mô tả category'
                  disabled={quickCategoryLoading}
                />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={() => setShowCategoryModal(false)} disabled={quickCategoryLoading}>Đóng</CButton>
            <CButton color='primary' onClick={handleQuickCreateCategory} disabled={quickCategoryLoading}>{quickCategoryLoading ? 'Đang tạo...' : 'Tạo category'}</CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}