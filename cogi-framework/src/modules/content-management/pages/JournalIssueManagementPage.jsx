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
  CFormTextarea,
} from '@coreui/react'
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'
import {
  createJournalIssue,
  createJournalIssueItem,
  deleteJournalIssue,
  deleteJournalIssueItem,
  getArticleOptions,
  getJournalIssueById,
  getJournalIssues,
  getMediaUrl,
  getMediaRelationId,
  getRelationId,
  updateJournalIssue,
  updateJournalIssueItem,
  uploadMediaFiles,
} from '../services/journalIssueService'
import { getAllJournalCategoryOptions } from '../services/journalCategoryService'

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

function formatDateTimeInput(value) {
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

function formatDateTimeDisplay(value) {
  const raw = String(value || '').trim()
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function extractStatusColor(item) {
  const statusText = String(item?.statusLabel || '').toLowerCase()
  if (statusText.includes('modified')) return 'warning'
  if (statusText.includes('published')) return 'success'
  return 'secondary'
}

function getDefaultIssueForm() {
  return {
    title: '',
    slug: '',
    journalCategory: '',
    issueNumber: '',
    volume: '',
    year: '',
    publicAt: '',
    summary: '<p></p>',
    publishState: 'draft',
  }
}

function getDefaultItemForm() {
  return {
    orderNo: '',
    articleTitle: '',
    authorsText: '',
    startPage: '',
    endPage: '',
    pageText: '',
    doi: '',
    article: '',
  }
}

function normalizeIssueForm(issue) {
  return {
    title: issue?.title || '',
    slug: issue?.slug || '',
    journalCategory: String(issue?.journalCategory?.id || ''),
    issueNumber: issue?.issueNumber || '',
    volume: issue?.volume || '',
    year: issue?.year ? String(issue.year) : '',
    publicAt: formatDateTimeInput(issue?.publicAt),
    summary: issue?.summary || '<p></p>',
    publishState: issue?.publishedAt ? 'published' : 'draft',
  }
}

function normalizeItemForm(item) {
  return {
    orderNo: item?.orderNo === 0 || item?.orderNo ? String(item.orderNo) : '',
    articleTitle: item?.articleTitle || '',
    authorsText: item?.authorsText || '',
    startPage: item?.startPage === 0 || item?.startPage ? String(item.startPage) : '',
    endPage: item?.endPage === 0 || item?.endPage ? String(item.endPage) : '',
    pageText: item?.pageText || '',
    doi: item?.doi || '',
    article: String(getRelationId(item?.article) || ''),
  }
}

function FileFieldPreview({ label, media, pendingFile, accept, disabled, onChange, onClear }) {
  const mediaUrl = getMediaUrl(media)
  const mediaName = pendingFile?.name || media?.name || media?.alternativeText || mediaUrl

  return (
    <div>
      <CFormLabel>{label}</CFormLabel>
      <CFormInput type='file' accept={accept} disabled={disabled} onChange={(event) => onChange(event.target.files?.[0] || null)} />
      {pendingFile ? <div className='small text-body-secondary mt-2'>Đã chọn: {pendingFile.name}</div> : null}
      {!pendingFile && mediaUrl ? (
        <div className='d-flex align-items-center gap-2 flex-wrap mt-2'>
          <a href={mediaUrl} target='_blank' rel='noreferrer'>
            {mediaName || 'Xem file hiện tại'}
          </a>
          <CButton type='button' size='sm' color='secondary' variant='outline' onClick={onClear} disabled={disabled}>
            Gỡ file
          </CButton>
        </div>
      ) : null}
    </div>
  )
}

export default function JournalIssueManagementPage() {
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

  const [showIssueModal, setShowIssueModal] = useState(false)
  const [editingIssueId, setEditingIssueId] = useState(null)
  const [issueDetailLoading, setIssueDetailLoading] = useState(false)
  const [issueFormLoading, setIssueFormLoading] = useState(false)
  const [issueFormData, setIssueFormData] = useState(getDefaultIssueForm())
  const [journalCategoryOptions, setJournalCategoryOptions] = useState([])
  const [journalCategoryOptionsLoading, setJournalCategoryOptionsLoading] = useState(false)
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)
  const [issueCoverState, setIssueCoverState] = useState({ current: null, pendingFile: null, changed: false })
  const [issuePdfState, setIssuePdfState] = useState({ current: null, pendingFile: null, changed: false })

  const [showItemsModal, setShowItemsModal] = useState(false)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState(null)

  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [itemFormLoading, setItemFormLoading] = useState(false)
  const [itemFormData, setItemFormData] = useState(getDefaultItemForm())
  const [itemPdfState, setItemPdfState] = useState({ current: null, pendingFile: null, changed: false })
  const [articleOptions, setArticleOptions] = useState([])
  const [articleOptionsLoading, setArticleOptionsLoading] = useState(false)
  const [articleSearch, setArticleSearch] = useState('')

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
    setError('')

    try {
      const res = await getJournalIssues({ page, pageSize, q, status })
      setRows(res?.data || [])
      setMeta(res?.meta || null)
    } catch (loadError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách tạp chí'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, pageSize, q, status])

  function resetIssueForm() {
    setIssueFormData(getDefaultIssueForm())
    setJournalCategoryOptions([])
    setJournalCategoryOptionsLoading(false)
    setIsSlugManuallyEdited(false)
    setIssueCoverState({ current: null, pendingFile: null, changed: false })
    setIssuePdfState({ current: null, pendingFile: null, changed: false })
  }

  async function loadJournalCategoryOptions() {
    setJournalCategoryOptionsLoading(true)

    try {
      const options = await getAllJournalCategoryOptions()
      setJournalCategoryOptions(options || [])
      return options || []
    } catch (lookupError) {
      setError(getApiMessage(lookupError, 'Không tải được danh sách danh mục tạp chí'))
      setJournalCategoryOptions([])
      return []
    } finally {
      setJournalCategoryOptionsLoading(false)
    }
  }

  function resetItemForm() {
    setItemFormData(getDefaultItemForm())
    setEditingItemId(null)
    setItemPdfState({ current: null, pendingFile: null, changed: false })
    setArticleSearch('')
    setArticleOptions([])
  }

  async function loadIssueDetail(id, preferredStatus = 'draft') {
    try {
      const draftRes = await getJournalIssueById(id, { status: preferredStatus })
      return draftRes?.data || null
    } catch (firstError) {
      if (preferredStatus === 'published') throw firstError
      const publishedRes = await getJournalIssueById(id, { status: 'published' })
      return publishedRes?.data || null
    }
  }

  async function openCreateIssueModal() {
    setEditingIssueId(null)
    resetIssueForm()
    setShowIssueModal(true)
    await loadJournalCategoryOptions()
  }

  async function openEditIssueModal(item) {
    const documentId = String(item?.documentId || item?.id || '').trim()
    if (!documentId) return

    setEditingIssueId(documentId)
    setShowIssueModal(true)
    setIssueDetailLoading(true)
    setError('')

    try {
      const [issue] = await Promise.all([
        loadIssueDetail(documentId, 'draft'),
        loadJournalCategoryOptions(),
      ])
      setIssueFormData(normalizeIssueForm(issue))
      setIsSlugManuallyEdited(Boolean(String(issue?.slug || '').trim()))
      setIssueCoverState({ current: issue?.coverImage || null, pendingFile: null, changed: false })
      setIssuePdfState({ current: issue?.pdfFile || null, pendingFile: null, changed: false })
    } catch (detailError) {
      setError(getApiMessage(detailError, 'Không tải được chi tiết tạp chí'))
      setShowIssueModal(false)
      setEditingIssueId(null)
    } finally {
      setIssueDetailLoading(false)
    }
  }

  function closeIssueModal() {
    setShowIssueModal(false)
    setEditingIssueId(null)
    setIssueDetailLoading(false)
    resetIssueForm()
  }

  function applySearch() {
    setPage(1)
    setQ(qDraft.trim())
  }

  function resetFilters() {
    setPage(1)
    setQ('')
    setQDraft('')
    setStatus('')
  }

  function updateIssueField(field, value) {
    setIssueFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'title' && !isSlugManuallyEdited) {
        next.slug = slugify(value)
      }
      return next
    })
  }

  async function ensureUploadedId(file, fallbackMessage) {
    if (!file) return null
    const uploaded = await uploadMediaFiles([file])
    const uploadedId = getMediaRelationId(uploaded[0])
    if (!uploadedId) {
      throw new Error(fallbackMessage)
    }
    return uploadedId
  }

  async function buildIssuePayload() {
    const title = String(issueFormData.title || '').trim()
    const slug = String(issueFormData.slug || '').trim()
    const journalCategory = String(issueFormData.journalCategory || '').trim()
    const issueNumber = String(issueFormData.issueNumber || '').trim()
    const volume = String(issueFormData.volume || '').trim()
    const year = Number(issueFormData.year)
    const publicAt = String(issueFormData.publicAt || '').trim()
    const summary = String(issueFormData.summary || '').trim()

    if (!title) throw new Error('Tiêu đề tạp chí không được trống')
    if (!issueNumber) throw new Error('Số tạp chí không được trống')
    if (!Number.isInteger(year) || year <= 0) throw new Error('Năm phát hành không hợp lệ')

    const payload = {
      title,
      journalCategory: journalCategory || null,
      issueNumber,
      year,
      volume: volume || null,
      publicAt: publicAt ? new Date(publicAt).toISOString() : null,
      summary: summary || '<p></p>',
    }

    if (slug) {
      payload.slug = slug
    }

    if (issueCoverState.pendingFile) {
      payload.coverImage = await ensureUploadedId(issueCoverState.pendingFile, 'Upload ảnh bìa thất bại')
    } else if (issueCoverState.changed && !issueCoverState.current) {
      payload.coverImage = null
    }

    if (issuePdfState.pendingFile) {
      payload.pdfFile = await ensureUploadedId(issuePdfState.pendingFile, 'Upload file tạp chí thất bại')
    } else if (issuePdfState.changed && !issuePdfState.current) {
      payload.pdfFile = null
    }

    return payload
  }

  async function handleIssueSubmit() {
    setIssueFormLoading(true)
    setError('')

    try {
      const payload = await buildIssuePayload()
      const targetStatus = issueFormData.publishState === 'published' ? 'published' : 'draft'

      if (editingIssueId) {
        await updateJournalIssue(editingIssueId, payload, { status: targetStatus })
        setSuccess('Cập nhật tạp chí thành công')
      } else {
        await createJournalIssue(payload, { status: targetStatus })
        setSuccess('Thêm mới tạp chí thành công')
      }

      closeIssueModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu tạp chí'))
    } finally {
      setIssueFormLoading(false)
    }
  }

  async function handleDeleteIssue(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa tạp chí này?')) return

    setError('')

    try {
      await deleteJournalIssue(id)
      setSuccess('Xóa tạp chí thành công')
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa tạp chí'))
    }
  }

  async function openItemsModal(issueRow) {
    const documentId = String(issueRow?.documentId || issueRow?.id || '').trim()
    if (!documentId) return

    setShowItemsModal(true)
    setItemsLoading(true)
    setSelectedIssue(null)
    setError('')

    try {
      const issue = await loadIssueDetail(documentId, 'draft')
      setSelectedIssue(issue)
    } catch (detailError) {
      setError(getApiMessage(detailError, 'Không tải được danh sách item của tạp chí'))
      setShowItemsModal(false)
    } finally {
      setItemsLoading(false)
    }
  }

  function closeItemsModal() {
    setShowItemsModal(false)
    setSelectedIssue(null)
    setItemsLoading(false)
    closeItemModal()
  }

  async function refreshSelectedIssue() {
    const documentId = String(selectedIssue?.documentId || selectedIssue?.id || '').trim()
    if (!documentId) return
    const issue = await loadIssueDetail(documentId, 'draft')
    setSelectedIssue(issue)
  }

  async function loadArticleLookup(keyword = '') {
    setArticleOptionsLoading(true)

    try {
      const rows = await getArticleOptions(keyword)
      setArticleOptions(rows || [])
    } catch (lookupError) {
      setError(getApiMessage(lookupError, 'Không tải được danh sách article'))
    } finally {
      setArticleOptionsLoading(false)
    }
  }

  async function openCreateItemModal() {
    resetItemForm()
    setShowItemModal(true)
    await loadArticleLookup('')
  }

  async function openEditItemModal(item) {
    resetItemForm()
    setEditingItemId(String(item?.documentId || item?.id || '').trim())
    setItemFormData(normalizeItemForm(item))
    setItemPdfState({ current: item?.pdfFile || null, pendingFile: null, changed: false })
    setArticleSearch(item?.article?.title || '')
    setShowItemModal(true)
    await loadArticleLookup(item?.article?.title || '')
  }

  function closeItemModal() {
    setShowItemModal(false)
    setItemFormLoading(false)
    resetItemForm()
  }

  async function buildItemPayload() {
    const issueRelation = getRelationId(selectedIssue)
    const orderNo = Number(itemFormData.orderNo)
    const articleTitle = String(itemFormData.articleTitle || '').trim()
    const authorsText = String(itemFormData.authorsText || '').trim()
    const pageText = String(itemFormData.pageText || '').trim()
    const doi = String(itemFormData.doi || '').trim()
    const startPage = String(itemFormData.startPage || '').trim()
    const endPage = String(itemFormData.endPage || '').trim()
    const articleRelation = String(itemFormData.article || '').trim()

    if (!issueRelation) throw new Error('Không xác định được tạp chí để gắn item')
    if (!Number.isInteger(orderNo)) throw new Error('Thứ tự item phải là số nguyên')
    if (!articleTitle) throw new Error('Tên bài viết không được trống')

    const payload = {
      journalIssue: issueRelation,
      orderNo,
      articleTitle,
      authorsText: authorsText || null,
      pageText: pageText || null,
      doi: doi || null,
      startPage: startPage !== '' ? Number(startPage) : null,
      endPage: endPage !== '' ? Number(endPage) : null,
      article: articleRelation || null,
    }

    if (payload.startPage !== null && !Number.isInteger(payload.startPage)) {
      throw new Error('Trang bắt đầu không hợp lệ')
    }

    if (payload.endPage !== null && !Number.isInteger(payload.endPage)) {
      throw new Error('Trang kết thúc không hợp lệ')
    }

    if (itemPdfState.pendingFile) {
      payload.pdfFile = await ensureUploadedId(itemPdfState.pendingFile, 'Upload file item thất bại')
    } else if (itemPdfState.changed && !itemPdfState.current) {
      payload.pdfFile = null
    }

    return payload
  }

  async function handleItemSubmit() {
    setItemFormLoading(true)
    setError('')

    try {
      const payload = await buildItemPayload()

      if (editingItemId) {
        await updateJournalIssueItem(editingItemId, payload)
        setSuccess('Cập nhật item thành công')
      } else {
        await createJournalIssueItem(payload)
        setSuccess('Thêm item thành công')
      }

      await refreshSelectedIssue()
      await load()
      closeItemModal()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu item'))
    } finally {
      setItemFormLoading(false)
    }
  }

  async function handleDeleteItem(itemId) {
    if (!window.confirm('Bạn chắc chắn muốn xóa item này?')) return

    setError('')

    try {
      await deleteJournalIssueItem(itemId)
      setSuccess('Xóa item thành công')
      await refreshSelectedIssue()
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa item'))
    }
  }

  const issueItems = Array.isArray(selectedIssue?.issueItems)
    ? [...selectedIssue.issueItems].sort((left, right) => Number(left?.orderNo || 0) - Number(right?.orderNo || 0))
    : []

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <CCard className='mb-4 ai-card'>
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 ai-form align-items-end'>
              <CCol md={6} lg={5}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo tiêu đề, slug, số, volume, năm...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={3} lg={3}>
                <CFormSelect label='Trạng thái' value={status} onChange={(event) => {
                  setPage(1)
                  setStatus(event.target.value)
                }}>
                  <option value=''>Tất cả</option>
                  <option value='draft'>Draft</option>
                  <option value='published'>Published</option>
                </CFormSelect>
              </CCol>
              <CCol xs={12} className='d-flex justify-content-end gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {success ? <CAlert color='success' className='mb-4'>{success}</CAlert> : null}
        {error ? <CAlert color='danger' className='mb-4'>{error}</CAlert> : null}

        <CCard className='ai-card'>
          <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
            <div>
              <strong>Tạp chí</strong>
            </div>
            <div className='d-flex align-items-center gap-3'>
              <div className='text-body-secondary small'>{fromToText}</div>
              <CButton color='success' onClick={openCreateIssueModal} disabled={loading}>+ Thêm tạp chí</CButton>
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
                      <CTableHeaderCell>Tạp chí</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 190 }}>Danh mục</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 190 }}>Số / Tập / Năm</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 150 }}>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 170 }}>Công khai</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 90 }}>Items</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 170 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 260 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => (
                      <CTableRow key={item.documentId || item.id}>
                        <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                        <CTableDataCell>
                          <div className='fw-semibold'>{item.title || '-'}</div>
                          <div className='small text-body-secondary'>{item.slug || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>{item.journalCategory?.title || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div>Số: {item.issueNumber || '-'}</div>
                          <div>Tập: {item.volume || '-'}</div>
                          <div>Năm: {item.year || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={extractStatusColor(item)}>{item.statusLabel || 'Draft'}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{formatDateTimeDisplay(item.publicAt)}</CTableDataCell>
                        <CTableDataCell>{Array.isArray(item.issueItems) ? item.issueItems.length : 0}</CTableDataCell>
                        <CTableDataCell>{formatDateTimeDisplay(item.updatedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2 flex-wrap'>
                            <CButton size='sm' color='primary' variant='outline' onClick={() => openItemsModal(item)}>Quản lý item</CButton>
                            <CButton size='sm' color='info' variant='outline' onClick={() => openEditIssueModal(item)}>Sửa</CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteIssue(item.documentId || item.id)}>Xóa</CButton>
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
      </CCol>

      <CModal visible={showIssueModal} onClose={closeIssueModal} size='xl'>
        <CModalHeader>
          <CModalTitle>{editingIssueId ? 'Cập nhật tạp chí' : 'Thêm tạp chí'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {issueDetailLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Đang tải chi tiết tạp chí...</span>
            </div>
          ) : (
            <CForm className='ai-form'>
              <CRow className='g-3'>
                <CCol md={8}>
                  <CFormInput
                    label='Tiêu đề'
                    value={issueFormData.title}
                    onChange={(event) => updateIssueField('title', event.target.value)}
                    disabled={issueFormLoading}
                  />
                </CCol>
                <CCol md={4}>
                  <CFormSelect
                    label='Trạng thái lưu'
                    value={issueFormData.publishState}
                    onChange={(event) => updateIssueField('publishState', event.target.value)}
                    disabled={issueFormLoading}
                  >
                    <option value='draft'>Draft</option>
                    <option value='published'>Published</option>
                  </CFormSelect>
                </CCol>
                <CCol md={4}>
                  <CFormSelect
                    label='Danh mục tạp chí'
                    value={issueFormData.journalCategory}
                    onChange={(event) => updateIssueField('journalCategory', event.target.value)}
                    disabled={issueFormLoading || journalCategoryOptionsLoading}
                  >
                    <option value=''>Không chọn</option>
                    {journalCategoryOptions.map((item) => (
                      <option key={item.rawId || item.id} value={item.rawId || item.id}>
                        {item.title || item.slug || 'Untitled'}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={4}>
                  <CFormInput
                    label='Slug'
                    value={issueFormData.slug}
                    onChange={(event) => {
                      setIsSlugManuallyEdited(true)
                      updateIssueField('slug', slugify(event.target.value))
                    }}
                    disabled={issueFormLoading}
                  />
                </CCol>
                <CCol md={4}>
                  <CFormInput
                    label='Số tạp chí'
                    value={issueFormData.issueNumber}
                    onChange={(event) => updateIssueField('issueNumber', event.target.value)}
                    disabled={issueFormLoading}
                  />
                </CCol>
                <CCol md={4}>
                  <CFormInput
                    label='Tập'
                    value={issueFormData.volume}
                    onChange={(event) => updateIssueField('volume', event.target.value)}
                    disabled={issueFormLoading}
                  />
                </CCol>
                <CCol md={4}>
                  <CFormInput
                    type='number'
                    min='1900'
                    label='Năm'
                    value={issueFormData.year}
                    onChange={(event) => updateIssueField('year', event.target.value)}
                    disabled={issueFormLoading}
                  />
                </CCol>
                <CCol md={4}>
                  <CFormInput
                    type='datetime-local'
                    label='Public at'
                    value={issueFormData.publicAt}
                    onChange={(event) => updateIssueField('publicAt', event.target.value)}
                    disabled={issueFormLoading}
                  />
                </CCol>
                <CCol md={6}>
                  <FileFieldPreview
                    label='Ảnh bìa'
                    media={issueCoverState.current}
                    pendingFile={issueCoverState.pendingFile}
                    accept='image/*'
                    disabled={issueFormLoading}
                    onChange={(file) => setIssueCoverState({ current: issueCoverState.current, pendingFile: file, changed: true })}
                    onClear={() => setIssueCoverState({ current: null, pendingFile: null, changed: true })}
                  />
                </CCol>
                <CCol md={6}>
                  <FileFieldPreview
                    label='PDF tạp chí'
                    media={issuePdfState.current}
                    pendingFile={issuePdfState.pendingFile}
                    accept='.pdf,application/pdf'
                    disabled={issueFormLoading}
                    onChange={(file) => setIssuePdfState({ current: issuePdfState.current, pendingFile: file, changed: true })}
                    onClear={() => setIssuePdfState({ current: null, pendingFile: null, changed: true })}
                  />
                </CCol>
                <CCol xs={12}>
                  <SimpleHtmlEditor
                    label='Tóm tắt'
                    value={issueFormData.summary}
                    onChange={(value) => updateIssueField('summary', value)}
                    disabled={issueFormLoading}
                    rows={10}
                  />
                </CCol>
              </CRow>
            </CForm>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeIssueModal} disabled={issueFormLoading}>Đóng</CButton>
          <CButton color='primary' onClick={handleIssueSubmit} disabled={issueFormLoading || issueDetailLoading}>
            {issueFormLoading ? 'Đang lưu...' : 'Lưu tạp chí'}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showItemsModal} onClose={closeItemsModal} size='xl'>
        <CModalHeader>
          <CModalTitle>Quản lý item tạp chí</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {itemsLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Đang tải item...</span>
            </div>
          ) : selectedIssue ? (
            <>
              <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
                <div>
                  <div className='fw-semibold'>{selectedIssue.title || '-'}</div>
                  <div className='small text-body-secondary'>
                    Số {selectedIssue.issueNumber || '-'} | Tập {selectedIssue.volume || '-'} | Năm {selectedIssue.year || '-'}
                  </div>
                </div>
                <div className='d-flex gap-2 flex-wrap'>
                  <CBadge color={selectedIssue.publishedAt ? 'success' : 'secondary'}>
                    {selectedIssue.publishedAt ? 'Published' : 'Draft'}
                  </CBadge>
                  <CButton size='sm' color='success' onClick={openCreateItemModal}>+ Thêm item</CButton>
                </div>
              </div>

              <CTable hover responsive className='mb-0 ai-table'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                    <CTableHeaderCell>Bài viết</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 220 }}>Tác giả</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 140 }}>Trang</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 220 }}>Liên kết</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {issueItems.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={6} className='text-center text-body-secondary'>Chưa có item nào</CTableDataCell>
                    </CTableRow>
                  ) : issueItems.map((item) => (
                    <CTableRow key={item.documentId || item.id}>
                      <CTableDataCell>{item.orderNo}</CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{item.articleTitle || '-'}</div>
                        <div className='small text-body-secondary'>{item.article?.title || item.article?.slug || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>{item.authorsText || '-'}</CTableDataCell>
                      <CTableDataCell>{item.pageText || ((item.startPage || item.endPage) ? `${item.startPage || ''}${item.endPage ? ` - ${item.endPage}` : ''}` : '-')}</CTableDataCell>
                      <CTableDataCell>
                        {item.doi ? <div>DOI: {item.doi}</div> : null}
                        {getMediaUrl(item.pdfFile) ? (
                          <a href={getMediaUrl(item.pdfFile)} target='_blank' rel='noreferrer'>PDF item</a>
                        ) : <span className='text-body-secondary'>-</span>}
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex gap-2'>
                          <CButton size='sm' color='info' variant='outline' onClick={() => openEditItemModal(item)}>Sửa</CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteItem(item.documentId || item.id)}>Xóa</CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeItemsModal}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showItemModal} onClose={closeItemModal} size='lg'>
        <CModalHeader>
          <CModalTitle>{editingItemId ? 'Cập nhật item' : 'Thêm item'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm className='ai-form'>
            <CRow className='g-3'>
              <CCol md={4}>
                <CFormInput
                  type='number'
                  min='1'
                  label='Thứ tự'
                  value={itemFormData.orderNo}
                  onChange={(event) => setItemFormData((prev) => ({ ...prev, orderNo: event.target.value }))}
                  disabled={itemFormLoading}
                />
              </CCol>
              <CCol md={8}>
                <CFormInput
                  label='Tên bài viết'
                  value={itemFormData.articleTitle}
                  onChange={(event) => setItemFormData((prev) => ({ ...prev, articleTitle: event.target.value }))}
                  disabled={itemFormLoading}
                />
              </CCol>
              <CCol xs={12}>
                <div className='d-flex align-items-end gap-2 flex-wrap'>
                  <div style={{ minWidth: 220, flex: 1 }}>
                    <CFormInput
                      label='Tìm article để liên kết'
                      value={articleSearch}
                      onChange={(event) => setArticleSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') loadArticleLookup(articleSearch)
                      }}
                      disabled={itemFormLoading}
                    />
                  </div>
                  <CButton type='button' color='secondary' variant='outline' onClick={() => loadArticleLookup(articleSearch)} disabled={itemFormLoading || articleOptionsLoading}>
                    {articleOptionsLoading ? 'Đang tải...' : 'Tìm article'}
                  </CButton>
                </div>
              </CCol>
              <CCol xs={12}>
                <CFormSelect
                  label='Article liên kết'
                  value={itemFormData.article}
                  onChange={(event) => {
                    const relation = event.target.value
                    const selectedArticle = articleOptions.find((item) => String(item.documentId || item.id) === relation)

                    setItemFormData((prev) => ({
                      ...prev,
                      article: relation,
                      articleTitle: prev.articleTitle || selectedArticle?.title || '',
                    }))
                  }}
                  disabled={itemFormLoading}
                >
                  <option value=''>Không liên kết article</option>
                  {articleOptions.map((item) => (
                    <option key={item.documentId || item.id} value={String(item.documentId || item.id)}>
                      {item.title || item.slug || item.documentId} {item.statusLabel ? `(${item.statusLabel})` : ''}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormTextarea
                  rows={3}
                  label='Tác giả'
                  value={itemFormData.authorsText}
                  onChange={(event) => setItemFormData((prev) => ({ ...prev, authorsText: event.target.value }))}
                  disabled={itemFormLoading}
                />
              </CCol>
              <CCol md={4}>
                <CFormInput
                  type='number'
                  min='1'
                  label='Trang bắt đầu'
                  value={itemFormData.startPage}
                  onChange={(event) => setItemFormData((prev) => ({ ...prev, startPage: event.target.value }))}
                  disabled={itemFormLoading}
                />
              </CCol>
              <CCol md={4}>
                <CFormInput
                  type='number'
                  min='1'
                  label='Trang kết thúc'
                  value={itemFormData.endPage}
                  onChange={(event) => setItemFormData((prev) => ({ ...prev, endPage: event.target.value }))}
                  disabled={itemFormLoading}
                />
              </CCol>
              <CCol md={4}>
                <CFormInput
                  label='Chuỗi trang'
                  placeholder='Ví dụ: 12-18'
                  value={itemFormData.pageText}
                  onChange={(event) => setItemFormData((prev) => ({ ...prev, pageText: event.target.value }))}
                  disabled={itemFormLoading}
                />
              </CCol>
              <CCol xs={12}>
                <CFormInput
                  label='DOI'
                  value={itemFormData.doi}
                  onChange={(event) => setItemFormData((prev) => ({ ...prev, doi: event.target.value }))}
                  disabled={itemFormLoading}
                />
              </CCol>
              <CCol xs={12}>
                <FileFieldPreview
                  label='PDF item'
                  media={itemPdfState.current}
                  pendingFile={itemPdfState.pendingFile}
                  accept='.pdf,application/pdf'
                  disabled={itemFormLoading}
                  onChange={(file) => setItemPdfState({ current: itemPdfState.current, pendingFile: file, changed: true })}
                  onClear={() => setItemPdfState({ current: null, pendingFile: null, changed: true })}
                />
              </CCol>
            </CRow>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeItemModal} disabled={itemFormLoading}>Đóng</CButton>
          <CButton color='primary' onClick={handleItemSubmit} disabled={itemFormLoading}>
            {itemFormLoading ? 'Đang lưu...' : 'Lưu item'}
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}