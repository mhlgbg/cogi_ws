import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  deleteCommunityPost,
  featureCommunityPost,
  getCommunityApiMessage,
  getCommunityGroups,
  getManageCommunityPostDetail,
  getManageCommunityPosts,
  hideCommunityPost,
  pinCommunityPost,
  publishCommunityPost,
  rejectCommunityPost,
  unfeatureCommunityPost,
  unpinCommunityPost,
  updateCommunityPost,
} from '../services/communityRuntimeService'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function statusMeta(status) {
  if (status === 'pending') return { label: 'Chờ duyệt', color: 'warning' }
  if (status === 'rejected') return { label: 'Bị từ chối', color: 'danger' }
  if (status === 'published') return { label: 'Đã đăng', color: 'success' }
  if (status === 'hidden') return { label: 'Đã ẩn', color: 'secondary' }
  return { label: 'Bản nháp', color: 'light' }
}

function scopeMeta(post) {
  if (post.scope === 'public') return 'Công khai'
  if (post.scope === 'group') return `Nhóm${post.group?.name ? `: ${post.group.name}` : ''}`
  return 'Community'
}

function excerpt(post) {
  const title = toText(post.title)
  if (title) return title
  const content = toText(post.content).replace(/\s+/g, ' ')
  if (!content) return '(Không có tiêu đề)'
  if (content.length <= 120) return content
  return `${content.slice(0, 117)}...`
}

function sanitizeHtml(html) {
  const source = String(html || '').trim()
  if (!source) return ''

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return source
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(href|src)\s*=\s*(['"])javascript:.*?\2/gi, '')
  }

  const parser = new DOMParser()
  const documentNode = parser.parseFromString(source, 'text/html')
  const blockedTags = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base']
  blockedTags.forEach((tag) => documentNode.querySelectorAll(tag).forEach((node) => node.remove()))
  documentNode.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = String(attribute.name || '').toLowerCase()
      const value = String(attribute.value || '')
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name)
      } else if ((name === 'href' || name === 'src') && /^javascript:/i.test(value.trim())) {
        element.removeAttribute(attribute.name)
      }
    })
  })
  return documentNode.body.innerHTML
}

const TAB_CONFIGS = [
  { key: 'all', label: 'Tất cả', query: {} },
  { key: 'pending', label: 'Chờ duyệt', query: { status: 'pending' } },
  { key: 'rejected', label: 'Bị từ chối', query: { status: 'rejected' } },
  { key: 'published', label: 'Đã đăng', query: { status: 'published' } },
  { key: 'hidden', label: 'Đã ẩn', query: { status: 'hidden' } },
  { key: 'draft', label: 'Bản nháp', query: { status: 'draft' } },
  { key: 'pinned', label: 'Đã ghim', query: { pinned: true } },
  { key: 'featured', label: 'Nổi bật', query: { featured: true } },
]

export default function CommunityPostModerationPage() {
  const [tab, setTab] = useState('all')
  const [rows, setRows] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filters, setFilters] = useState({
    q: '',
    scope: '',
    groupId: '',
    author: '',
    dateFrom: '',
    dateTo: '',
  })
  const [appliedFilters, setAppliedFilters] = useState({
    q: '',
    scope: '',
    groupId: '',
    author: '',
    dateFrom: '',
    dateTo: '',
  })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, pageCount: 1, total: 0 })
  const [viewPost, setViewPost] = useState(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    id: null,
    title: '',
    content: '',
    contentType: 'text',
    scope: 'community',
    group: '',
    allowComment: true,
    isPinned: false,
    isFeatured: false,
  })

  const tabQuery = useMemo(() => TAB_CONFIGS.find((item) => item.key === tab)?.query || {}, [tab])

  const loadGroups = useCallback(async () => {
    try {
      const response = await getCommunityGroups({ page: 1, pageSize: 100 })
      setGroups(response.rows || [])
    } catch {
      setGroups([])
    }
  }, [])

  const loadRows = useCallback(async (targetPage = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = {
        ...tabQuery,
        page: targetPage,
        pageSize: pagination.pageSize,
        q: toText(appliedFilters.q) || undefined,
        scope: toText(appliedFilters.scope) || undefined,
        groupId: toText(appliedFilters.groupId) || undefined,
        author: toText(appliedFilters.author) || undefined,
        dateFrom: toText(appliedFilters.dateFrom) || undefined,
        dateTo: toText(appliedFilters.dateTo) || undefined,
      }
      const response = await getManageCommunityPosts(params)
      setRows(response.rows || [])
      setPagination(response.pagination || { page: 1, pageSize: 20, pageCount: 1, total: 0 })
    } catch (requestError) {
      setRows([])
      setPagination((previous) => ({ ...previous, page: 1, pageCount: 1, total: 0 }))
      setError(getCommunityApiMessage(requestError, 'Không tải được danh sách bài viết.'))
    } finally {
      setLoading(false)
    }
  }, [appliedFilters.author, appliedFilters.dateFrom, appliedFilters.dateTo, appliedFilters.groupId, appliedFilters.q, appliedFilters.scope, pagination.pageSize, tabQuery])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  useEffect(() => {
    loadRows(1)
  }, [appliedFilters, loadRows, tab, pagination.pageSize])

  async function openView(postId) {
    setError('')
    try {
      const detail = await getManageCommunityPostDetail(postId)
      setViewPost(detail)
      setViewOpen(true)
    } catch (requestError) {
      setError(getCommunityApiMessage(requestError, 'Không tải được chi tiết bài viết.'))
    }
  }

  async function openEdit(postId) {
    setError('')
    try {
      const detail = await getManageCommunityPostDetail(postId)
      setEditForm({
        id: detail.id,
        title: detail.title || '',
        content: detail.content || '',
        contentType: detail.contentType || 'text',
        scope: detail.scope || 'community',
        group: detail.group?.id ? String(detail.group.id) : '',
        allowComment: detail.allowComment !== false,
        isPinned: detail.isPinned === true,
        isFeatured: detail.isFeatured === true,
      })
      setEditOpen(true)
    } catch (requestError) {
      setError(getCommunityApiMessage(requestError, 'Không tải được bài viết để chỉnh sửa.'))
    }
  }

  async function runAction(post, action) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (action === 'publish') await publishCommunityPost(post.id)
      if (action === 'hide') await hideCommunityPost(post.id)
      if (action === 'reject') await rejectCommunityPost(post.id)
      if (action === 'pin') await pinCommunityPost(post.id)
      if (action === 'unpin') await unpinCommunityPost(post.id)
      if (action === 'feature') await featureCommunityPost(post.id)
      if (action === 'unfeature') await unfeatureCommunityPost(post.id)
      if (action === 'delete') {
        const confirmed = window.confirm('Bạn có chắc muốn xóa mềm bài viết này?')
        if (!confirmed) {
          setSaving(false)
          return
        }
        await deleteCommunityPost(post.id)
      }
      if (action === 'publish' && post.status === 'pending') {
        setSuccess('Bài viết đã được chấp nhận và đăng.')
      } else if (action === 'reject' && post.status === 'pending') {
        setSuccess('Bài viết đã bị từ chối.')
      } else if (action === 'publish') {
        setSuccess('Bài viết đã được đăng.')
      } else if (action === 'hide') {
        setSuccess('Bài viết đã được ẩn.')
      } else {
        setSuccess('Đã cập nhật bài viết.')
      }
      await loadRows(pagination.page)
    } catch (requestError) {
      setError(getCommunityApiMessage(requestError, 'Không thể cập nhật trạng thái bài viết.'))
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit() {
    if (!editForm.id) return
    if (editForm.scope === 'group' && !toText(editForm.group)) {
      setError('Vui lòng chọn nhóm khi scope là nhóm.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await updateCommunityPost(editForm.id, {
        title: toText(editForm.title) || null,
        content: editForm.content,
        contentType: editForm.contentType,
        scope: editForm.scope,
        group: editForm.scope === 'group' ? Number(editForm.group) : null,
        allowComment: editForm.allowComment,
        isPinned: editForm.isPinned,
        isFeatured: editForm.isFeatured,
      })

      if (editForm.isPinned) await pinCommunityPost(editForm.id)
      else await unpinCommunityPost(editForm.id)
      if (editForm.isFeatured) await featureCommunityPost(editForm.id)
      else await unfeatureCommunityPost(editForm.id)

      setEditOpen(false)
      setSuccess('Đã lưu thay đổi bài viết.')
      await loadRows(pagination.page)
    } catch (requestError) {
      setError(getCommunityApiMessage(requestError, 'Không thể cập nhật bài viết.'))
    } finally {
      setSaving(false)
    }
  }

  function renderActions(post) {
    const actions = [{ key: 'view', label: 'Xem', color: 'secondary', variant: 'outline' }]

    actions.push({ key: 'edit', label: 'Sửa', color: 'primary', variant: 'outline' })

    if (post.status === 'pending') {
      actions.push({ key: 'publish', label: 'Chấp nhận', color: 'success', variant: undefined })
      actions.push({ key: 'reject', label: 'Từ chối', color: 'warning', variant: 'outline' })
    } else if (post.status === 'rejected') {
      actions.push({ key: 'publish', label: 'Đăng ngay', color: 'success', variant: undefined })
    } else if (post.status === 'hidden') {
      actions.push({ key: 'publish', label: 'Đăng lại', color: 'success', variant: undefined })
    } else if (post.status === 'published') {
      actions.push({ key: 'hide', label: 'Ẩn', color: 'warning', variant: 'outline' })
    }

    actions.push({
      key: post.isPinned ? 'unpin' : 'pin',
      label: post.isPinned ? 'Bỏ ghim' : 'Ghim',
      color: 'secondary',
      variant: 'outline',
    })
    actions.push({
      key: post.isFeatured ? 'unfeature' : 'feature',
      label: post.isFeatured ? 'Bỏ nổi bật' : 'Nổi bật',
      color: 'info',
      variant: 'outline',
    })

    if (post.status === 'draft' || post.status === 'pending' || post.status === 'hidden') {
      actions.push({ key: 'delete', label: 'Xóa', color: 'danger', variant: 'outline' })
    }

    return (
      <div className='d-flex gap-1 flex-wrap justify-content-end'>
        {actions.map((action) => {
          if (action.key === 'view') {
            return <CButton key={action.key} size='sm' color={action.color} variant={action.variant} onClick={() => openView(post.id)} disabled={saving}>{action.label}</CButton>
          }
          if (action.key === 'edit') {
            return <CButton key={action.key} size='sm' color={action.color} variant={action.variant} onClick={() => openEdit(post.id)} disabled={saving}>{action.label}</CButton>
          }
          return (
            <CButton
              key={action.key}
              size='sm'
              color={action.color}
              variant={action.variant}
              onClick={() => runAction(post, action.key)}
              disabled={saving}
            >
              {action.label}
            </CButton>
          )
        })}
      </div>
    )
  }

  return (
    <CCard>
      <CCardHeader>
        <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <strong>Quản lý bài viết Community</strong>
          <CButton color='secondary' variant='outline' onClick={() => loadRows(pagination.page)} disabled={loading || saving}>Tải lại</CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        {success ? <CAlert color='success'>{success}</CAlert> : null}
        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        <div className='d-flex gap-2 flex-wrap mb-3'>
          {TAB_CONFIGS.map((item) => (
            <CButton
              key={item.key}
              size='sm'
              color={tab === item.key ? 'primary' : 'secondary'}
              variant={tab === item.key ? undefined : 'outline'}
              onClick={() => {
                setTab(item.key)
                setPagination((previous) => ({ ...previous, page: 1 }))
              }}
            >
              {item.label}
            </CButton>
          ))}
        </div>

        <div className='row g-2 mb-3'>
          <div className='col-md-4'>
            <CFormInput
              placeholder='Tìm title/content/tác giả...'
              value={filters.q}
              onChange={(event) => setFilters((previous) => ({ ...previous, q: event.target.value }))}
            />
          </div>
          <div className='col-md-2'>
            <CFormSelect value={filters.scope} onChange={(event) => setFilters((previous) => ({ ...previous, scope: event.target.value }))}>
              <option value=''>Tất cả scope</option>
              <option value='public'>Công khai</option>
              <option value='community'>Community</option>
              <option value='group'>Nhóm</option>
            </CFormSelect>
          </div>
          <div className='col-md-2'>
            <CFormSelect value={filters.groupId} onChange={(event) => setFilters((previous) => ({ ...previous, groupId: event.target.value }))}>
              <option value=''>Tất cả nhóm</option>
              {groups.map((group) => (
                <option key={`group:${group.id}`} value={group.id}>{group.name || `Group #${group.id}`}</option>
              ))}
            </CFormSelect>
          </div>
          <div className='col-md-2'>
            <CFormInput
              placeholder='Tác giả'
              value={filters.author}
              onChange={(event) => setFilters((previous) => ({ ...previous, author: event.target.value }))}
            />
          </div>
          <div className='col-md-1'>
            <CFormInput type='date' value={filters.dateFrom} onChange={(event) => setFilters((previous) => ({ ...previous, dateFrom: event.target.value }))} />
          </div>
          <div className='col-md-1'>
            <CFormInput type='date' value={filters.dateTo} onChange={(event) => setFilters((previous) => ({ ...previous, dateTo: event.target.value }))} />
          </div>
          <div className='col-12 d-flex gap-2'>
            <CButton
              color='primary'
              onClick={() => {
                setAppliedFilters(filters)
                setPagination((previous) => ({ ...previous, page: 1 }))
              }}
              disabled={loading}
            >
              Lọc
            </CButton>
            <CButton
              color='secondary'
              variant='outline'
              onClick={() => {
                const cleared = { q: '', scope: '', groupId: '', author: '', dateFrom: '', dateTo: '' }
                setFilters(cleared)
                setAppliedFilters(cleared)
                setPagination((previous) => ({ ...previous, page: 1 }))
              }}
              disabled={loading}
            >
              Reset
            </CButton>
          </div>
        </div>

        {loading ? (
          <div className='d-flex gap-2 align-items-center'><CSpinner size='sm' />Đang tải danh sách bài viết...</div>
        ) : (
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Tác giả</CTableHeaderCell>
                <CTableHeaderCell>Tiêu đề / trích đoạn</CTableHeaderCell>
                <CTableHeaderCell>Scope</CTableHeaderCell>
                <CTableHeaderCell>Group</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell>Bình luận</CTableHeaderCell>
                <CTableHeaderCell>Pinned</CTableHeaderCell>
                <CTableHeaderCell>Featured</CTableHeaderCell>
                <CTableHeaderCell>Ngày tạo</CTableHeaderCell>
                <CTableHeaderCell>Ngày đăng</CTableHeaderCell>
                <CTableHeaderCell className='text-end'>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={11} className='text-center text-body-secondary py-4'>Không có bài viết phù hợp.</CTableDataCell>
                </CTableRow>
              ) : rows.map((post) => {
                const status = statusMeta(post.status)
                return (
                  <CTableRow key={`post:${post.id}`}>
                    <CTableDataCell>{post.author?.fullName || post.author?.username || post.author?.email || 'User'}</CTableDataCell>
                    <CTableDataCell>{excerpt(post)}</CTableDataCell>
                    <CTableDataCell>{scopeMeta(post)}</CTableDataCell>
                    <CTableDataCell>{post.group?.name || '—'}</CTableDataCell>
                    <CTableDataCell><CBadge color={status.color}>{status.label}</CBadge></CTableDataCell>
                    <CTableDataCell>{post.allowComment ? 'Cho phép' : 'Tắt'}</CTableDataCell>
                    <CTableDataCell>{post.isPinned ? 'Có' : 'Không'}</CTableDataCell>
                    <CTableDataCell>{post.isFeatured ? 'Có' : 'Không'}</CTableDataCell>
                    <CTableDataCell>{formatDate(post.createdAt)}</CTableDataCell>
                    <CTableDataCell>{formatDate(post.publishedAt)}</CTableDataCell>
                    <CTableDataCell className='text-end'>{renderActions(post)}</CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        )}

        <div className='d-flex justify-content-between align-items-center mt-3 gap-2 flex-wrap'>
          <div className='text-body-secondary small'>Trang {pagination.page}/{pagination.pageCount} · Tổng {pagination.total} bài</div>
          <div className='d-flex align-items-center gap-2'>
            <CFormSelect
              size='sm'
              value={pagination.pageSize}
              onChange={(event) => {
                const nextPageSize = Number(event.target.value) || 20
                setPagination((previous) => ({ ...previous, pageSize: nextPageSize, page: 1 }))
              }}
              style={{ width: '96px' }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </CFormSelect>
            <CButton size='sm' color='secondary' variant='outline' disabled={loading || pagination.page <= 1} onClick={() => loadRows(pagination.page - 1)}>Trước</CButton>
            <CButton size='sm' color='secondary' variant='outline' disabled={loading || pagination.page >= pagination.pageCount} onClick={() => loadRows(pagination.page + 1)}>Sau</CButton>
          </div>
        </div>
      </CCardBody>

      <CModal visible={viewOpen} onClose={() => setViewOpen(false)} size='lg'>
        <CModalHeader><CModalTitle>Chi tiết bài viết</CModalTitle></CModalHeader>
        <CModalBody>
          {viewPost ? (
            <div className='d-flex flex-column gap-2'>
              <div><strong>Tác giả:</strong> {viewPost.author?.fullName || viewPost.author?.username || viewPost.author?.email || 'User'}</div>
              <div><strong>Scope:</strong> {scopeMeta(viewPost)}</div>
              <div><strong>Status:</strong> {statusMeta(viewPost.status).label}</div>
              <div><strong>Tiêu đề:</strong> {viewPost.title || '—'}</div>
              <div>
                <strong>Nội dung:</strong>
                {viewPost.contentType === 'html'
                  ? <div className='border rounded p-2 mt-1' dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewPost.content || '') }} />
                  : <div className='border rounded p-2 mt-1' style={{ whiteSpace: 'pre-wrap' }}>{viewPost.content || '—'}</div>}
              </div>
              <div><strong>Bình luận:</strong> {viewPost.allowComment ? 'Cho phép' : 'Tắt'}</div>
              <div><strong>Pinned:</strong> {viewPost.isPinned ? 'Có' : 'Không'} · <strong>Featured:</strong> {viewPost.isFeatured ? 'Có' : 'Không'}</div>
              <div><strong>Ngày tạo:</strong> {formatDate(viewPost.createdAt)} · <strong>Ngày đăng:</strong> {formatDate(viewPost.publishedAt)}</div>
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setViewOpen(false)}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={editOpen} onClose={() => setEditOpen(false)} size='lg'>
        <CModalHeader><CModalTitle>Chỉnh sửa bài viết</CModalTitle></CModalHeader>
        <CModalBody>
          <div className='d-flex flex-column gap-2'>
            <CFormInput placeholder='Tiêu đề (không bắt buộc)' value={editForm.title} onChange={(event) => setEditForm((previous) => ({ ...previous, title: event.target.value }))} />
            <CFormSelect value={editForm.scope} onChange={(event) => setEditForm((previous) => ({ ...previous, scope: event.target.value, group: event.target.value === 'group' ? previous.group : '' }))}>
              <option value='public'>Công khai</option>
              <option value='community'>Community</option>
              <option value='group'>Nhóm</option>
            </CFormSelect>
            {editForm.scope === 'group' ? (
              <CFormSelect value={editForm.group} onChange={(event) => setEditForm((previous) => ({ ...previous, group: event.target.value }))}>
                <option value=''>Chọn nhóm</option>
                {groups.map((group) => (
                  <option key={`edit-group:${group.id}`} value={group.id}>{group.name || `Group #${group.id}`}</option>
                ))}
              </CFormSelect>
            ) : null}
            <CFormSelect value={editForm.contentType} onChange={(event) => setEditForm((previous) => ({ ...previous, contentType: event.target.value }))}>
              <option value='text'>Văn bản</option>
              <option value='html'>HTML</option>
            </CFormSelect>
            <CFormTextarea rows={6} placeholder='Nội dung bài viết' value={editForm.content} onChange={(event) => setEditForm((previous) => ({ ...previous, content: event.target.value }))} />
            <CFormCheck label='Cho phép bình luận' checked={editForm.allowComment} onChange={(event) => setEditForm((previous) => ({ ...previous, allowComment: event.target.checked }))} />
            <CFormCheck label='Ghim bài viết' checked={editForm.isPinned} onChange={(event) => setEditForm((previous) => ({ ...previous, isPinned: event.target.checked }))} />
            <CFormCheck label='Đánh dấu nổi bật' checked={editForm.isFeatured} onChange={(event) => setEditForm((previous) => ({ ...previous, isFeatured: event.target.checked }))} />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setEditOpen(false)} disabled={saving}>Hủy</CButton>
          <CButton color='primary' onClick={submitEdit} disabled={saving || !toText(editForm.content)}>{saving ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  )
}
