import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CAlert, CButton, CFormCheck, CFormInput, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CSpinner } from '@coreui/react'
import { NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { useFeature } from '../../../contexts/FeatureContext'
import { useTenant } from '../../../contexts/TenantContext'
import { resolveMediaUrl } from '../../../utils/mediaUrl'
import { buildTenantUrl } from '../../../utils/tenantRouting'
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'
import { sanitizeQuickMessageHtml } from '../../crm/components/quickMessageHtml'
import { getActiveCommunityConfig, getCommunityConfigPreview } from '../services/communityConfigService'
import {
  createCommunityComment,
  createCommunityPost,
  deleteCommunityPost,
  deleteCommunityComment,
  getCommunityApiMessage,
  getCommunityFeed,
  getCommunityGroupDetail,
  getCommunityGroups,
  getCommunityMyPosts,
  getCommunityPostComments,
  getCommunityPostingContext,
  hideCommunityComment,
  getMyCommunityGroups,
  removeCommunityPostReaction,
  setCommunityPostReaction,
  submitCommunityPostForReview,
  publishCommunityPost,
  uploadCommunityPostImages,
  updateCommunityComment,
  updateCommunityPost,
  withdrawCommunityPost,
} from '../services/communityRuntimeService'
import '../community.css'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toInitials(input) {
  const text = toText(input)
  if (!text) return 'C'
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join('')
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeTextContentToHtml(value) {
  const source = String(value || '').replace(/\r\n/g, '\n').trim()
  if (!source) return ''
  const paragraphs = source
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
  return paragraphs.join('')
}

function stripHtmlToPlainText(value) {
  const sanitized = sanitizeQuickMessageHtml(value)
  if (!sanitized) return ''
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(sanitized, 'text/html')
    return String(doc?.body?.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .trim()
  }
  return sanitized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function hasFormattingRiskInHtml(value) {
  const sanitized = sanitizeQuickMessageHtml(value)
  if (!sanitized) return false
  return /<(?!\/?(p|br)\b)[^>]+>/i.test(sanitized)
}

function normalizeComposerContent(contentType, content) {
  if (contentType === 'html') return sanitizeQuickMessageHtml(content || '')
  return String(content || '')
}

function buildComposerDraft({ scope = 'community', group = '', allowComment = true } = {}) {
  return {
    id: null,
    scope,
    group,
    title: '',
    content: '',
    contentType: 'text',
    allowComment: allowComment !== false,
    media: [],
    youtube: null,
  }
}

const COMMUNITY_RICH_EDITOR_TOOLBAR = [
  { label: 'B', command: 'bold' },
  { label: 'I', command: 'italic' },
  { label: 'U', command: 'underline' },
  { label: 'H2', command: 'formatBlock', value: 'h2' },
  { label: 'H3', command: 'formatBlock', value: 'h3' },
  { label: '•', command: 'insertUnorderedList' },
  { label: '1.', command: 'insertOrderedList' },
  { label: '❝', command: 'formatBlock', value: 'blockquote' },
  { label: '—', command: 'insertHorizontalRule' },
  { label: '↶', command: 'undo' },
  { label: '↷', command: 'redo' },
]

function formatPostTime(post) {
  const raw = post?.publishedAt || post?.createdAt
  if (!raw) return '--'

  const now = Date.now()
  const published = new Date(raw).getTime()
  if (Number.isNaN(published)) return '--'

  const diffMinutes = Math.max(1, Math.floor((now - published) / 60000))
  if (diffMinutes < 60) return `${diffMinutes} phút`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} ngày`

  return new Date(raw).toLocaleString()
}

function routeModeFromPath(pathname) {
  const normalized = String(pathname || '').trim().toLowerCase()
  if (normalized.endsWith('/community/groups')) return 'groups'
  if (normalized.includes('/community/group/')) return 'group-feed'
  if (normalized.endsWith('/community/my-posts')) return 'my-posts'
  if (normalized.endsWith('/community/public')) return 'public-feed'
  if (normalized.endsWith('/community/community')) return 'community-feed'
  return 'home'
}

function extractGroupIdFromPath(pathname) {
  const normalized = String(pathname || '')
  const parts = normalized.split('/').filter(Boolean)
  const groupIndex = parts.findIndex((part) => part === 'group')
  if (groupIndex < 0) return ''
  return String(parts[groupIndex + 1] || '').trim()
}

function resolveAudienceLabel(scope, groupName) {
  if (scope === 'public') return '🌐 Công khai'
  if (scope === 'group') return `🔒 Nhóm${groupName ? `: ${groupName}` : ''}`
  return '👥 Community'
}

function resolveStatusLabel(status) {
  if (status === 'pending') return 'Chờ duyệt'
  if (status === 'rejected') return 'Bị từ chối'
  if (status === 'published') return 'Đã đăng'
  if (status === 'hidden') return 'Đã ẩn'
  return 'Bản nháp'
}

function resolveReactionMeta(type) {
  if (type === 'love') return { icon: '❤️', label: 'Yêu thích' }
  if (type === 'support') return { icon: '🤝', label: 'Ủng hộ' }
  return { icon: '👍', label: 'Thích' }
}

function parseYouTubeVideoId(value) {
  const raw = toText(value)
  if (!raw) return null
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  const hostname = String(parsed.hostname || '').toLowerCase().replace(/^www\./, '')
  const parts = String(parsed.pathname || '').split('/').filter(Boolean)
  let videoId = ''
  if (hostname === 'youtu.be') {
    videoId = parts[0] || ''
  } else if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    if (parts[0] === 'watch') videoId = toText(parsed.searchParams.get('v'))
    if (parts[0] === 'shorts' || parts[0] === 'embed') videoId = parts[1] || ''
  }

  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
  return videoId
}

function resolveYouTubeThumbnail(videoId) {
  const id = toText(videoId)
  if (!id) return ''
  return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`
}

function resolveImageCardUrl(media) {
  if (!media || media.type !== 'image') return ''
  const candidate = media.formats?.medium?.url || media.formats?.small?.url || media.formats?.thumbnail?.url || media.url
  return resolveMediaUrl(candidate) || media.url || ''
}

function resolveImageViewerUrl(media) {
  if (!media || media.type !== 'image') return ''
  const candidate = media.url || media.formats?.large?.url || media.formats?.medium?.url || media.formats?.small?.url || media.formats?.thumbnail?.url
  return resolveMediaUrl(candidate) || media.url || ''
}

function resolveUserAvatarUrl(user) {
  const raw = toText(
    user?.avatarUrl
    || user?.photoUrl
    || user?.imageUrl
    || user?.avatar?.url
    || user?.avatar?.formats?.thumbnail?.url
    || user?.avatar?.formats?.small?.url,
  )
  if (!raw) return ''
  return resolveMediaUrl(raw) || raw
}

function isAuthRequiredCommunityMessage(message) {
  const normalized = toText(message).toLowerCase()
  return normalized === 'authentication is required' || normalized === 'unauthorized'
}

function isTenantMemberRequiredMessage(message) {
  const normalized = toText(message).toLowerCase()
  return normalized === 'tính năng này dành cho thành viên của community.'
}

function resolveFeedEmptyCopy(routeMode) {
  if (routeMode === 'home') {
    return {
      title: 'Hiện chưa có tin phù hợp với bạn.',
      description: 'Hãy thử chọn một mục khác hoặc quay lại sau.',
    }
  }
  if (routeMode === 'public-feed') {
    return {
      title: 'Hiện chưa có bài viết công khai.',
      description: 'Hãy thử chọn một mục khác hoặc quay lại sau.',
    }
  }
  if (routeMode === 'community-feed') {
    return {
      title: 'Hiện chưa có bài viết trong Community.',
      description: 'Hãy thử chọn một mục khác hoặc quay lại sau.',
    }
  }
  if (routeMode === 'group-feed') {
    return {
      title: 'Hiện chưa có bài viết từ các nhóm của bạn.',
      description: 'Hãy thử chọn một mục khác hoặc quay lại sau.',
    }
  }
  return {
    title: 'Hiện không có tin phù hợp.',
    description: 'Hãy thử chọn một mục khác hoặc quay lại sau.',
  }
}

function resolveCommunityIdentity(snapshot, tenantContext) {
  const tenant = snapshot?.tenant || {}
  const config = snapshot?.config || {}
  const headerConfig = config?.headerConfig || {}
  const tenantName = toText(tenant?.name)
    || toText(tenantContext?.currentTenant?.tenantShortName || tenantContext?.currentTenant?.tenantName || tenantContext?.resolvedTenant?.tenantName)
    || 'Community'
  const communityName = toText(headerConfig.communityName) || tenantName
  const slogan = toText(headerConfig.slogan) || toText(tenant?.slogan) || ''
  const rawLogoUrl = toText(tenant?.logoUrl) || toText(tenantContext?.currentTenant?.tenantLogoUrl)
  const tenantLogoUrl = rawLogoUrl ? resolveMediaUrl(rawLogoUrl) : ''
  const accentColor = toText(headerConfig.accentColor || tenant?.accentColor || tenantContext?.currentTenant?.accentColor)

  return {
    tenantName,
    communityName,
    slogan,
    tenantLogoUrl,
    accentColor,
  }
}

function resolveComposerScopeByRoute(routeMode, feedConfig, routeGroupId) {
  if (routeMode === 'group-feed' && routeGroupId) {
    return { scope: 'group', group: routeGroupId }
  }
  if (routeMode === 'public-feed') {
    return { scope: 'public', group: '' }
  }
  if (routeMode === 'community-feed') {
    return { scope: 'community', group: '' }
  }

  const defaultFeed = toText(feedConfig?.defaultFeed).toLowerCase()
  if (defaultFeed === 'public') return { scope: 'public', group: '' }
  if (defaultFeed === 'community') return { scope: 'community', group: '' }
  return { scope: 'community', group: '' }
}

function CommunitySidebar({
  items,
  myGroups,
  mobileOpen,
  onClose,
  showMyGroups,
  tenantCode,
  isMainDomain,
}) {
  function getItemIcon(itemId) {
    const id = toText(itemId).toLowerCase()
    if (id.includes('home')) return '🏠'
    if (id.includes('community')) return '👥'
    if (id.includes('public')) return '🌐'
    if (id.includes('post')) return '📝'
    if (id.includes('group')) return '👪'
    if (id.includes('admin')) return '⚙️'
    return '•'
  }

  return (
    <>
      <aside className={['community-sidebar', mobileOpen ? 'is-open' : ''].filter(Boolean).join(' ')}>
        <div className='community-sidebar-inner'>
          <div className='community-sidebar-title-row'>
            <div className='community-sidebar-title'>Community Navigation</div>
            <button type='button' className='community-sidebar-close' onClick={onClose}>×</button>
          </div>
          <nav className='community-nav-list'>
            {items.map((item) => (
              item.external ? (
                <a key={item.id} href={item.target} target='_blank' rel='noreferrer' className='community-nav-item' onClick={onClose}>
                  <span className='community-nav-icon'>{getItemIcon(item.id)}</span>
                  <span>{item.label}</span>
                </a>
              ) : (
                <NavLink key={item.id} to={item.target} className='community-nav-item' onClick={onClose}>
                  <span className='community-nav-icon'>{getItemIcon(item.id)}</span>
                  <span>{item.label}</span>
                </NavLink>
              )
            ))}
            {items.length === 0 ? <div className='community-empty-note'>Chưa có mục điều hướng.</div> : null}
          </nav>

          {showMyGroups ? (
            <div className='community-my-groups'>
              <div className='community-sidebar-title mt-3'>Nhóm của tôi</div>
              {myGroups.length === 0 ? (
                <div className='community-empty-note'>Bạn chưa tham gia nhóm nào.</div>
              ) : (
                <div className='community-nav-list'>
                  {myGroups.map((membership) => {
                    const groupId = membership.group?.id
                    const groupPath = buildTenantUrl(`/community/group/${groupId}`, { tenantCode, isMainDomain }) || `/community/group/${groupId}`
                    const avatarUrl = membership.group?.avatar?.url
                    return (
                      <NavLink key={`my-group:${membership.id}`} to={groupPath} className='community-nav-item community-group-nav-item' onClick={onClose}>
                        <span className='community-group-avatar'>
                          {avatarUrl ? <img src={avatarUrl} alt={membership.group?.name || 'group'} /> : toInitials(membership.group?.name || 'G')}
                        </span>
                        <span>{membership.group?.name || `Group #${groupId}`}</span>
                      </NavLink>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </aside>
      {mobileOpen ? <button type='button' className='community-sidebar-backdrop' onClick={onClose} /> : null}
    </>
  )
}

function CommunityFeedFilters({ isTenantMember, routeMode, navigate, paths }) {
  const tabs = [
    { key: 'home', label: 'Dành cho bạn', path: paths.home, visible: true },
    { key: 'community-feed', label: 'Community', path: paths.communityFeed, visible: isTenantMember },
    { key: 'public-feed', label: 'Công khai', path: paths.publicFeed, visible: true },
    { key: 'groups', label: 'Nhóm của tôi', path: paths.groups, visible: isTenantMember },
  ].filter((tab) => tab.visible)

  return (
    <div className='community-feed-filters'>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type='button'
          className={['community-filter-chip', routeMode === tab.key ? 'is-active' : ''].join(' ')}
          onClick={() => navigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function CommunityCommentSection({
  post,
  commentsState,
  isTenantMember,
  isAdmin,
  busy,
  onLoad,
  onCreate,
  onUpdate,
  onDelete,
  onHide,
}) {
  const isOpen = commentsState?.open === true
  const rows = Array.isArray(commentsState?.rows) ? commentsState.rows : []
  const loading = commentsState?.loading === true
  const canComment = isTenantMember && post.allowComment && post.status === 'published'
  const [draft, setDraft] = useState('')
  const [replyDrafts, setReplyDrafts] = useState({})
  const [editing, setEditing] = useState({})

  useEffect(() => {
    if (!isOpen || commentsState?.loaded || loading) return
    onLoad?.()
  }, [isOpen, commentsState?.loaded, loading, onLoad])

  const submitComment = async () => {
    const content = toText(draft)
    if (!content) return
    await onCreate?.({ content })
    setDraft('')
  }

  const submitReply = async (parentId) => {
    const content = toText(replyDrafts[parentId] || '')
    if (!content) return
    await onCreate?.({ content, parentCommentId: parentId })
    setReplyDrafts((previous) => ({ ...previous, [parentId]: '' }))
  }

  return (
    <section className={['community-comment-section', isOpen ? 'is-open' : ''].join(' ')}>
      {!isOpen ? null : (
        <div className='community-comments-panel'>
          {canComment ? (
            <div className='community-comment-composer'>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder='Viết bình luận...'
                disabled={busy}
              />
              <button type='button' onClick={submitComment} disabled={busy || !toText(draft)}>Gửi</button>
            </div>
          ) : (
            <div className='community-comment-note'>
              {!isTenantMember ? 'Chỉ thành viên Community mới có thể bình luận.' : (post.allowComment ? 'Bài viết này hiện không nhận bình luận.' : 'Bình luận đã tắt cho bài viết này.')}
            </div>
          )}

          {loading ? <div className='community-comment-note'>Đang tải bình luận...</div> : null}
          {!loading && rows.length === 0 ? <div className='community-comment-note'>Chưa có bình luận nào.</div> : null}

          {rows.map((comment) => {
            const authorName = toText(comment.author?.fullName || comment.author?.username || comment.author?.email || 'Thành viên')
            const edited = comment.updatedAt && comment.createdAt && comment.updatedAt !== comment.createdAt
            const editValue = editing[comment.id] ?? comment.content
            return (
              <div key={`comment:${comment.id}`} className='community-comment-item'>
                <div className='community-comment-avatar'>{toInitials(authorName)}</div>
                <div className='community-comment-main'>
                  <div className='community-comment-bubble'>
                    <div className='community-comment-author'>{authorName}</div>
                    {editing[comment.id] !== undefined ? (
                      <textarea
                        value={editValue}
                        onChange={(event) => setEditing((previous) => ({ ...previous, [comment.id]: event.target.value }))}
                        disabled={busy}
                      />
                    ) : (
                      <div className='community-comment-content'>{comment.content}</div>
                    )}
                    {edited ? <div className='community-comment-edited'>Đã chỉnh sửa</div> : null}
                  </div>
                  <div className='community-comment-actions'>
                    {canComment ? (
                      <button
                        type='button'
                        onClick={() => setReplyDrafts((previous) => {
                          const next = { ...previous }
                          if (Object.prototype.hasOwnProperty.call(next, comment.id)) {
                            delete next[comment.id]
                          } else {
                            next[comment.id] = ''
                          }
                          return next
                        })}
                      >
                        Trả lời
                      </button>
                    ) : null}
                    {comment.canEdit ? (
                      editing[comment.id] !== undefined ? (
                        <>
                          <button
                            type='button'
                            disabled={busy || !toText(editValue)}
                            onClick={async () => {
                              await onUpdate?.(comment.id, { content: editValue })
                              setEditing((previous) => {
                                const next = { ...previous }
                                delete next[comment.id]
                                return next
                              })
                            }}
                          >
                            Lưu
                          </button>
                          <button
                            type='button'
                            onClick={() => setEditing((previous) => {
                              const next = { ...previous }
                              delete next[comment.id]
                              return next
                            })}
                          >
                            Hủy
                          </button>
                        </>
                      ) : <button type='button' onClick={() => setEditing((previous) => ({ ...previous, [comment.id]: comment.content }))}>Sửa</button>
                    ) : null}
                    {comment.canDelete ? <button type='button' onClick={() => onDelete?.(comment.id)} disabled={busy}>Xóa</button> : null}
                    {(isAdmin || comment.canModerate) && comment.status === 'active' ? (
                      <button type='button' onClick={() => onHide?.(comment.id)} disabled={busy}>Ẩn</button>
                    ) : null}
                  </div>

                  {replyDrafts[comment.id] !== undefined ? (
                    <div className='community-comment-reply-composer'>
                      <input
                        value={replyDrafts[comment.id] || ''}
                        onChange={(event) => setReplyDrafts((previous) => ({ ...previous, [comment.id]: event.target.value }))}
                        placeholder='Trả lời bình luận...'
                        disabled={busy}
                      />
                      <button type='button' disabled={busy || !toText(replyDrafts[comment.id])} onClick={() => submitReply(comment.id)}>Gửi</button>
                    </div>
                  ) : null}

                  {Array.isArray(comment.replies) && comment.replies.length > 0 ? (
                    <div className='community-reply-list'>
                      {comment.replies.map((reply) => {
                        const replyAuthorName = toText(reply.author?.fullName || reply.author?.username || reply.author?.email || 'Thành viên')
                        const replyEdited = reply.updatedAt && reply.createdAt && reply.updatedAt !== reply.createdAt
                        const replyEditValue = editing[reply.id] ?? reply.content
                        return (
                          <div key={`reply:${reply.id}`} className='community-comment-item is-reply'>
                            <div className='community-comment-avatar'>{toInitials(replyAuthorName)}</div>
                            <div className='community-comment-main'>
                              <div className='community-comment-bubble'>
                                <div className='community-comment-author'>{replyAuthorName}</div>
                                {editing[reply.id] !== undefined ? (
                                  <textarea
                                    value={replyEditValue}
                                    onChange={(event) => setEditing((previous) => ({ ...previous, [reply.id]: event.target.value }))}
                                    disabled={busy}
                                  />
                                ) : (
                                  <div className='community-comment-content'>{reply.content}</div>
                                )}
                                {replyEdited ? <div className='community-comment-edited'>Đã chỉnh sửa</div> : null}
                              </div>
                              <div className='community-comment-actions'>
                                {reply.canEdit ? (
                                  editing[reply.id] !== undefined ? (
                                    <>
                                      <button
                                        type='button'
                                        disabled={busy || !toText(replyEditValue)}
                                        onClick={async () => {
                                          await onUpdate?.(reply.id, { content: replyEditValue })
                                          setEditing((previous) => {
                                            const next = { ...previous }
                                            delete next[reply.id]
                                            return next
                                          })
                                        }}
                                      >
                                        Lưu
                                      </button>
                                      <button
                                        type='button'
                                        onClick={() => setEditing((previous) => {
                                          const next = { ...previous }
                                          delete next[reply.id]
                                          return next
                                        })}
                                      >
                                        Hủy
                                      </button>
                                    </>
                                  ) : <button type='button' onClick={() => setEditing((previous) => ({ ...previous, [reply.id]: reply.content }))}>Sửa</button>
                                ) : null}
                                {reply.canDelete ? <button type='button' onClick={() => onDelete?.(reply.id)} disabled={busy}>Xóa</button> : null}
                                {(isAdmin || reply.canModerate) && reply.status === 'active' ? <button type='button' onClick={() => onHide?.(reply.id)} disabled={busy}>Ẩn</button> : null}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function CommunityPostCard({
  post,
  showStatus,
  actions = [],
  allowReaction,
  isTenantMember,
  reactionBusy,
  onReact,
  commentsState,
  commentsBusy,
  onToggleComments,
  onLoadComments,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onHideComment,
  isAdmin,
}) {
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(-1)
  const [playingYouTube, setPlayingYouTube] = useState({})
  const contentRef = useRef(null)
  const contentText = toText(post?.content)
  const safeHtmlContent = useMemo(() => sanitizeQuickMessageHtml(post?.content || ''), [post?.content])

  useEffect(() => {
    if (!contentRef.current) return
    const element = contentRef.current
    const nextCanExpand = element.scrollHeight > element.clientHeight + 2
    setCanExpand(nextCanExpand)
  }, [contentText, post?.contentType, expanded])

  const audienceLabel = resolveAudienceLabel(post.scope, post.group?.name)
  const myReaction = post?.myReaction || null
  const reactionSummary = post?.reactionSummary || { like: 0, love: 0, support: 0 }
  const canShowInteraction = post?.status === 'published'
  const mediaRows = Array.isArray(post.media) ? post.media : []
  const imageMedias = mediaRows.filter((item) => item?.type === 'image' && toText(item.url))
  const youtubeMedias = mediaRows.filter((item) => item?.type === 'youtube' && toText(item.videoId))
  const galleryPreview = imageMedias.slice(0, 4)
  const remainImageCount = Math.max(0, imageMedias.length - 4)

  return (
    <article className='community-panel community-post-card'>
      <div className='community-post-header'>
        <div className='community-post-avatar'>{toInitials(post?.author?.fullName || post?.author?.username || post?.author?.email || 'U')}</div>
        <div className='community-post-header-copy'>
          <div className='community-post-author'>{toText(post?.author?.fullName || post?.author?.username || post?.author?.email || 'Người dùng')}</div>
          <div className='community-post-meta-line'>
            <span>{formatPostTime(post)}</span>
            <span>·</span>
            <span>{audienceLabel}</span>
          </div>
        </div>
      </div>

      {post.isPinned ? <div className='community-post-flag'>📌 Bài ghim</div> : null}
      {post.isFeatured ? <div className='community-post-flag'>⭐ Nổi bật</div> : null}
      {showStatus ? <div className='community-post-flag'>🗂 {resolveStatusLabel(post.status)}</div> : null}
      {showStatus && post.status === 'rejected' ? (
        <div className='community-post-review-hint'>
          Bài viết đã bị từ chối. Bạn có thể chỉnh sửa nội dung và gửi duyệt lại.
        </div>
      ) : null}

      {post.title ? <h3 className='community-post-title'>{post.title}</h3> : null}
      {post.contentType === 'html'
        ? (
          <div
            ref={contentRef}
            className={['community-post-content', expanded ? '' : 'is-clamped'].join(' ').trim()}
            dangerouslySetInnerHTML={{ __html: safeHtmlContent }}
          />
        )
        : (
          <p ref={contentRef} className={['community-post-content', expanded ? '' : 'is-clamped'].join(' ').trim()}>
            {post.content || ''}
          </p>
        )}

      {canExpand ? (
        <button type='button' className='community-read-toggle' onClick={() => setExpanded((previous) => !previous)}>
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      ) : null}

      {imageMedias.length > 0 ? (
        <div className={`community-post-media-grid media-count-${Math.min(galleryPreview.length, 4)}`}>
          {galleryPreview.map((media, index) => (
            <button
              key={`media:${post.id}:${media.id || media.url}:${index}`}
              type='button'
              className='community-post-media-item community-post-media-btn'
              onClick={() => setViewerIndex(index)}
            >
              <img src={resolveImageCardUrl(media)} alt={media.name || 'media'} />
              {remainImageCount > 0 && index === galleryPreview.length - 1 ? (
                <span className='community-post-media-overlay'>+{remainImageCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {youtubeMedias.length > 0 ? (
        <div className='community-post-youtube-list'>
          {youtubeMedias.map((media, index) => {
            const mediaKey = `${media.id || media.videoId || index}`
            const isPlaying = playingYouTube[mediaKey] === true
            const thumbUrl = resolveYouTubeThumbnail(media.videoId)
            return (
              <div key={`youtube:${post.id}:${mediaKey}`} className='community-youtube-card'>
                {!isPlaying ? (
                  <button
                    type='button'
                    className='community-youtube-thumb-btn'
                    onClick={() => setPlayingYouTube((previous) => ({ ...previous, [mediaKey]: true }))}
                  >
                    {thumbUrl ? <img src={thumbUrl} alt='YouTube thumbnail' className='community-youtube-thumb' /> : <div className='community-youtube-fallback'>YouTube</div>}
                    <span className='community-youtube-play'>▶</span>
                  </button>
                ) : (
                  <div className='community-youtube-embed-wrap'>
                    <iframe
                      src={`https://www.youtube.com/embed/${encodeURIComponent(media.videoId)}`}
                      title='YouTube player'
                      loading='lazy'
                      allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      {viewerIndex >= 0 && imageMedias[viewerIndex] ? (
        <div className='community-lightbox' role='dialog' aria-modal='true'>
          <button type='button' className='community-lightbox-backdrop' onClick={() => setViewerIndex(-1)} aria-label='Đóng' />
          <div className='community-lightbox-body'>
            <button type='button' className='community-lightbox-close' onClick={() => setViewerIndex(-1)}>×</button>
            <button
              type='button'
              className='community-lightbox-nav'
              onClick={() => setViewerIndex((previous) => (previous <= 0 ? imageMedias.length - 1 : previous - 1))}
              disabled={imageMedias.length <= 1}
            >
              ‹
            </button>
            <img src={resolveImageViewerUrl(imageMedias[viewerIndex])} alt={imageMedias[viewerIndex]?.name || 'media'} className='community-lightbox-image' />
            <button
              type='button'
              className='community-lightbox-nav'
              onClick={() => setViewerIndex((previous) => (previous >= imageMedias.length - 1 ? 0 : previous + 1))}
              disabled={imageMedias.length <= 1}
            >
              ›
            </button>
          </div>
        </div>
      ) : null}

      {canShowInteraction ? (
        <>
          <div className='community-interaction-summary'>
            <div className='community-reaction-summary'>
              {(reactionSummary.like > 0 || reactionSummary.love > 0 || reactionSummary.support > 0) ? (
                <>
                  {reactionSummary.like > 0 ? <span>👍</span> : null}
                  {reactionSummary.love > 0 ? <span>❤️</span> : null}
                  {reactionSummary.support > 0 ? <span>🤝</span> : null}
                </>
              ) : <span>🙂</span>}
              <span>{post.reactionCount || 0}</span>
            </div>
            <button type='button' className='community-comment-count-btn' onClick={onToggleComments}>{post.commentCount || 0} bình luận</button>
          </div>

          <div className='community-interaction-bar'>
            {allowReaction ? (
              <div className='community-reaction-buttons'>
                {['like', 'love', 'support'].map((type) => {
                  const meta = resolveReactionMeta(type)
                  const active = myReaction === type
                  return (
                    <button
                      key={`${post.id}:reaction:${type}`}
                      type='button'
                      className={['community-interaction-btn', active ? 'is-active' : ''].join(' ')}
                      onClick={() => onReact?.(type)}
                      disabled={reactionBusy}
                      title={meta.label}
                    >
                      {meta.icon} {meta.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
            <button type='button' className='community-interaction-btn' onClick={onToggleComments}>💬 Bình luận</button>
          </div>

          {!post.allowComment ? <div className='community-post-note'>Bình luận đã tắt cho bài viết này.</div> : null}

          <CommunityCommentSection
            post={post}
            commentsState={commentsState}
            isTenantMember={isTenantMember}
            isAdmin={isAdmin}
            busy={commentsBusy}
            onLoad={onLoadComments}
            onCreate={onCreateComment}
            onUpdate={onUpdateComment}
            onDelete={onDeleteComment}
            onHide={onHideComment}
          />
        </>
      ) : null}
      {actions.length > 0 ? (
        <div className='community-post-owner-actions'>
          {actions.map((action) => (
            <button
              key={`${post.id}:${action.key}`}
              type='button'
              className={['community-owner-action-btn', action.primary ? 'is-primary' : ''].join(' ').trim()}
              onClick={action.onClick}
              disabled={action.disabled === true}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function CommunityComposer({
  isTenantMember,
  userName,
  onOpenComposer,
  onOpenImageComposer,
}) {
  if (!isTenantMember) return null

  return (
    <section className='community-panel community-composer'>
      <div className='community-composer-collapsed'>
        <div className='community-composer-avatar'>{toInitials(userName || 'U')}</div>
        <button type='button' className='community-composer-trigger' onClick={onOpenComposer}>
          Bạn muốn chia sẻ điều gì?
        </button>
      </div>
      <div className='community-composer-quick-actions'>
        <button type='button' className='community-soft-action' onClick={onOpenImageComposer}>🖼 Ảnh</button>
        <button type='button' className='community-soft-action' onClick={onOpenComposer}>✍ Bài viết</button>
      </div>
    </section>
  )
}

function CommunityComposerModal({
  visible,
  title,
  userName,
  form,
  setForm,
  composerGroups,
  routeMode,
  routeGroupId,
  groupName,
  submitting,
  mediaUploading,
  message,
  canDirectPublish,
  initialFocus,
  onClose,
  onSaveDraft,
  onSubmitForReview,
  onPublishNow,
  onSelectImages,
  onRemoveImage,
  onSetYoutubeLink,
  onClearYoutubeLink,
}) {
  const fileInputRef = useRef(null)
  const quickContentRef = useRef(null)
  const [youtubeInput, setYoutubeInput] = useState('')
  const [showYoutubeInput, setShowYoutubeInput] = useState(false)
  const isGroupRoute = routeMode === 'group-feed' && routeGroupId
  const isHtmlMode = form.contentType === 'html'
  const canSubmit = Boolean(toText(stripHtmlToPlainText(form.content)))
  const selectedGroupName = composerGroups.find((group) => Number(group.id) === Number(form.group))?.name || groupName
  const youtubeInputVisible = showYoutubeInput || Boolean(form.youtube)

  useEffect(() => {
    if (!visible || initialFocus !== 'image') return
    const timer = window.setTimeout(() => {
      fileInputRef.current?.click?.()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [initialFocus, visible])

  useEffect(() => {
    if (!visible || isHtmlMode || !quickContentRef.current) return
    const element = quickContentRef.current
    element.style.height = 'auto'
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 150), 320)}px`
  }, [form.content, isHtmlMode, visible])

  function switchContentMode(nextMode) {
    const targetType = nextMode === 'html' ? 'html' : 'text'
    if (targetType === form.contentType) return

    if (targetType === 'html') {
      const converted = normalizeTextContentToHtml(form.content)
      setForm((previous) => ({
        ...previous,
        contentType: 'html',
        content: converted || '<p></p>',
      }))
      return
    }

    if (hasFormattingRiskInHtml(form.content)) {
      const confirmed = window.confirm('Chuyển sang Bài nhanh sẽ loại bỏ định dạng nội dung.\nBạn có muốn tiếp tục?')
      if (!confirmed) return
    }

    setForm((previous) => ({
      ...previous,
      contentType: 'text',
      content: stripHtmlToPlainText(previous.content),
    }))
  }

  return (
    <CModal
      visible={visible}
      onClose={onClose}
      alignment='center'
      className='community-composer-modal'
    >
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className='community-composer-expanded'>
          <input
            ref={fileInputRef}
            type='file'
            accept='.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
            multiple
            className='d-none'
            onChange={(event) => {
              const rows = Array.from(event.target.files || [])
              onSelectImages?.(rows)
              event.target.value = ''
            }}
          />

          <div className='community-composer-head'>
            <div className='community-composer-avatar'>{toInitials(userName || 'U')}</div>
            <div>
              <div className='community-composer-author'>{userName || 'Thành viên Community'}</div>
              <div className='community-composer-audience'>
                {form.scope === 'group' ? resolveAudienceLabel('group', selectedGroupName) : resolveAudienceLabel(form.scope)}
              </div>
            </div>
          </div>

          <div className='community-scope-row'>
            <button
              type='button'
              className={['community-scope-chip', form.scope === 'public' ? 'is-active' : ''].join(' ')}
              onClick={() => setForm((previous) => ({ ...previous, scope: 'public', group: '' }))}
            >
              🌐 Công khai
            </button>
            <button
              type='button'
              className={['community-scope-chip', form.scope === 'community' ? 'is-active' : ''].join(' ')}
              onClick={() => setForm((previous) => ({ ...previous, scope: 'community', group: '' }))}
            >
              👥 Community
            </button>
            <button
              type='button'
              className={['community-scope-chip', form.scope === 'group' ? 'is-active' : ''].join(' ')}
              onClick={() => setForm((previous) => ({ ...previous, scope: 'group', group: previous.group || routeGroupId || '' }))}
              disabled={composerGroups.length === 0}
            >
              🔒 Nhóm
            </button>
          </div>

          {form.scope === 'group' ? (
            composerGroups.length > 0 ? (
              <CFormSelect
                value={form.group}
                onChange={(event) => setForm((previous) => ({ ...previous, group: event.target.value }))}
                disabled={isGroupRoute}
              >
                <option value=''>Chọn nhóm</option>
                {composerGroups.map((group) => (
                  <option key={`composer-group:${group.id}`} value={group.id}>{group.name || `Group #${group.id}`}</option>
                ))}
              </CFormSelect>
            ) : (
              <div className='community-group-note'>Bạn chưa tham gia nhóm nào.</div>
            )
          ) : null}

          <CFormInput
            placeholder='Tiêu đề (không bắt buộc)'
            value={form.title}
            onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
          />

          <div className='community-content-mode-switch' role='tablist' aria-label='Chế độ nội dung'>
            <button
              type='button'
              className={['community-content-mode-btn', form.contentType === 'text' ? 'is-active' : ''].join(' ')}
              onClick={() => switchContentMode('text')}
            >
              Bài nhanh
            </button>
            <button
              type='button'
              className={['community-content-mode-btn', form.contentType === 'html' ? 'is-active' : ''].join(' ')}
              onClick={() => switchContentMode('html')}
            >
              Bài viết đầy đủ
            </button>
          </div>

          {form.contentType === 'text' ? (
            <textarea
              ref={quickContentRef}
              className='community-quick-textarea'
              placeholder='Bạn muốn chia sẻ điều gì?'
              value={form.content}
              onChange={(event) => setForm((previous) => ({ ...previous, content: event.target.value }))}
            />
          ) : (
            <div className='community-rich-editor-shell'>
              <SimpleHtmlEditor
                value={form.content || '<p></p>'}
                onChange={(value) => setForm((previous) => ({ ...previous, content: value }))}
                disabled={submitting}
                rows={10}
                placeholder='Viết nội dung bài...'
                toolbarActions={COMMUNITY_RICH_EDITOR_TOOLBAR}
                showLinkControls
                showImageControls={false}
                showColorControls={false}
                allowHtmlMode={false}
                helperText='Nội dung sẽ được sanitize an toàn trước khi gửi.'
              />
            </div>
          )}

          <div className='community-composer-media-tools'>
            <div className='community-composer-media-title'>Thêm vào bài viết</div>
            <div className='community-composer-media-actions'>
              <button type='button' className='community-soft-action' onClick={() => fileInputRef.current?.click?.()} disabled={mediaUploading || submitting}>
                {mediaUploading ? 'Đang tải ảnh...' : '📷 Ảnh'}
              </button>
              <button
                type='button'
                className='community-soft-action'
                onClick={() => setShowYoutubeInput((previous) => !previous)}
                disabled={submitting}
              >
                ▶ YouTube
              </button>
            </div>
            {youtubeInputVisible ? (
              <div className='community-youtube-input-row'>
                <CFormInput
                  placeholder='Dán liên kết YouTube...'
                  value={youtubeInput}
                  onChange={(event) => setYoutubeInput(event.target.value)}
                  disabled={mediaUploading || submitting}
                />
                <button
                  type='button'
                  className='community-owner-action-btn'
                  onClick={() => {
                    const accepted = onSetYoutubeLink?.(youtubeInput)
                    if (accepted !== false) {
                      setYoutubeInput('')
                      setShowYoutubeInput(true)
                    }
                  }}
                  disabled={mediaUploading || submitting || !toText(youtubeInput)}
                >
                  Thêm video
                </button>
              </div>
            ) : null}
          </div>

          {Array.isArray(form.media) && form.media.length > 0 ? (
            <div className='community-composer-media-preview'>
              {form.media.filter((item) => item?.type === 'image').map((media, index) => (
                <div key={`composer-image:${media.id || index}`} className='community-composer-media-thumb'>
                  <img src={resolveImageCardUrl(media)} alt={media.name || `Ảnh ${index + 1}`} />
                  <button type='button' onClick={() => onRemoveImage?.(index)} disabled={mediaUploading || submitting}>×</button>
                </div>
              ))}
            </div>
          ) : null}

          {form.youtube ? (
            <div className='community-composer-youtube-preview'>
              <img src={resolveYouTubeThumbnail(form.youtube.videoId)} alt='YouTube thumbnail' />
              <div className='community-composer-youtube-meta'>
                <strong>YouTube</strong>
                <span>{form.youtube.url}</span>
              </div>
              <button type='button' className='community-owner-action-btn' onClick={onClearYoutubeLink} disabled={submitting}>Xóa</button>
            </div>
          ) : null}

          <div className='community-composer-footer'>
            <CFormCheck
              label='Cho phép bình luận'
              checked={form.allowComment}
              onChange={(event) => setForm((previous) => ({ ...previous, allowComment: event.target.checked }))}
            />
          </div>
          {message ? <div className='community-form-message'>{message}</div> : null}
        </div>
      </CModalBody>
      <CModalFooter className='d-flex gap-2 justify-content-end'>
        <button type='button' className='community-ghost-btn' onClick={onClose} disabled={submitting}>Hủy</button>
        <button type='button' className='community-owner-action-btn' onClick={onSaveDraft} disabled={submitting || !canSubmit}>Lưu nháp</button>
        {canDirectPublish ? (
          <CButton className='community-primary-btn' onClick={onPublishNow} disabled={submitting || !canSubmit}>
            {submitting ? 'Đang xử lý...' : 'Đăng ngay'}
          </CButton>
        ) : (
          <CButton className='community-primary-btn' onClick={onSubmitForReview} disabled={submitting || !canSubmit}>
            {submitting ? 'Đang xử lý...' : 'Lưu và đề nghị duyệt'}
          </CButton>
        )}
      </CModalFooter>
    </CModal>
  )
}

export default function CommunityPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const auth = useAuth()
  const feature = useFeature()
  const tenant = useTenant()
  const [searchParams] = useSearchParams()

  const [bootstrapLoading, setBootstrapLoading] = useState(true)
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [previewNotice, setPreviewNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [feedRows, setFeedRows] = useState([])
  const [groupsRows, setGroupsRows] = useState([])
  const [myGroups, setMyGroups] = useState([])
  const [postingContext, setPostingContext] = useState(null)
  const [communityActor, setCommunityActor] = useState({
    authenticated: false,
    tenantMember: false,
    communityRole: 'guest',
  })
  const [routeGroup, setRouteGroup] = useState(null)
  const [composerModalOpen, setComposerModalOpen] = useState(false)
  const [composerModalMode, setComposerModalMode] = useState('create')
  const [composerModalFocus, setComposerModalFocus] = useState(null)
  const [composerForm, setComposerForm] = useState(() => buildComposerDraft())
  const [composerFormInitial, setComposerFormInitial] = useState(() => buildComposerDraft())
  const [composerSubmitting, setComposerSubmitting] = useState(false)
  const [composerMessage, setComposerMessage] = useState('')
  const [mediaUploading, setMediaUploading] = useState(false)
  const [commentStates, setCommentStates] = useState({})
  const [commentBusyPosts, setCommentBusyPosts] = useState({})
  const [reactionBusyPosts, setReactionBusyPosts] = useState({})
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  const isAuthenticated = Boolean(auth?.isAuthenticated)
  const isAdmin = Boolean(feature?.hasFeature?.('community-config.manage') || feature?.hasFeature?.('community-group.manage') || feature?.hasFeature?.('community-post.manage'))
  const previewConfigId = String(searchParams.get('previewConfig') || '').trim()
  const tenantCode = String(tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)

  const routeMode = routeModeFromPath(location.pathname)
  const routeGroupId = extractGroupIdFromPath(location.pathname) || String(params?.groupId || '').trim()
  const routeHomePath = buildTenantUrl('/community', { tenantCode, isMainDomain }) || '/community'
  const adminConfigPath = buildTenantUrl('/community/configs', { tenantCode, isMainDomain }) || '/community/configs'
  const groupsDirectoryPath = buildTenantUrl('/community/groups', { tenantCode, isMainDomain }) || '/community/groups'
  const myPostsPath = buildTenantUrl('/community/my-posts', { tenantCode, isMainDomain }) || '/community/my-posts'
  const publicFeedPath = buildTenantUrl('/community/public', { tenantCode, isMainDomain }) || '/community/public'
  const communityFeedPath = buildTenantUrl('/community/community', { tenantCode, isMainDomain }) || '/community/community'
  const loginBasePath = buildTenantUrl('/login', { tenantCode, isMainDomain }) || '/login'
  const loginPath = `${loginBasePath}?redirect=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`
  const authRequiredError = !isAuthenticated && isAuthRequiredCommunityMessage(errorMessage)
  const tenantMemberRequiredError = isAuthenticated && isTenantMemberRequiredMessage(errorMessage)
  const isTenantMember = communityActor?.tenantMember === true
  const userAvatarUrl = resolveUserAvatarUrl(auth?.user)

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      setBootstrapLoading(true)
      setErrorMessage('')
      setPreviewNotice('')
      try {
        if (previewConfigId) {
          if (!isAuthenticated || !isAdmin) {
            setPreviewNotice('Preview config chỉ dành cho admin Community.')
            const activeSnapshot = await getActiveCommunityConfig()
            if (!cancelled) setSnapshot(activeSnapshot)
          } else {
            const previewSnapshot = await getCommunityConfigPreview(previewConfigId)
            if (!cancelled) {
              setSnapshot(previewSnapshot)
              setPreviewNotice('Đang xem bản preview CommunityConfig.')
            }
          }
        } else {
          const activeSnapshot = await getActiveCommunityConfig()
          if (!cancelled) setSnapshot(activeSnapshot)
        }
      } catch (requestError) {
        if (cancelled) return
        setSnapshot(null)
        setErrorMessage(getCommunityApiMessage(requestError, 'Không tải được cấu hình Community.'))
      } finally {
        if (!cancelled) setBootstrapLoading(false)
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [isAdmin, isAuthenticated, previewConfigId])

  const feedQuery = useMemo(() => {
    if (routeMode === 'public-feed') return { scope: 'public', page: 1 }
    if (routeMode === 'community-feed') return { scope: 'community', page: 1 }
    if (routeMode === 'my-posts') return { mine: true, page: 1 }
    if (routeMode === 'group-feed') return { scope: 'group', groupId: routeGroupId, page: 1 }
    return { page: 1 }
  }, [routeGroupId, routeMode])

  const loadRuntime = useCallback(async () => {
    if (!snapshot?.hasActiveConfig && !previewConfigId) {
      setFeedRows([])
      setGroupsRows([])
      setMyGroups([])
      setPostingContext(null)
      setCommunityActor({
        authenticated: isAuthenticated,
        tenantMember: false,
        communityRole: 'guest',
      })
      setRouteGroup(null)
      return
    }

    setRuntimeLoading(true)
    setErrorMessage('')

    const primaryPromise = routeMode === 'groups'
      ? getCommunityGroups({ page: 1, pageSize: 50 })
      : (routeMode === 'my-posts' ? getCommunityMyPosts(feedQuery) : getCommunityFeed(feedQuery))

    const myGroupsPromise = isAuthenticated ? getMyCommunityGroups() : Promise.resolve([])
    const postingContextPromise = getCommunityPostingContext()
    const routeGroupPromise = routeMode === 'group-feed' && routeGroupId
      ? getCommunityGroupDetail(routeGroupId)
      : Promise.resolve(null)

    try {
      const [primaryResult, myGroupsResult, postingContextResult, routeGroupResult] = await Promise.allSettled([
        primaryPromise,
        myGroupsPromise,
        postingContextPromise,
        routeGroupPromise,
      ])

      if (primaryResult.status === 'rejected') {
        throw primaryResult.reason
      }

      const primary = primaryResult.value
      const nextActor = primary?.actor || (postingContextResult.status === 'fulfilled' ? postingContextResult.value?.actor : null) || {
        authenticated: isAuthenticated,
        tenantMember: false,
        communityRole: 'guest',
      }
      setCommunityActor(nextActor)
      if (routeMode === 'groups') {
        setGroupsRows(primary?.rows || [])
        setFeedRows([])
        setCommentStates({})
      } else {
        setFeedRows(primary?.rows || [])
        setGroupsRows([])
        setCommentStates({})
      }

      if (myGroupsResult.status === 'fulfilled') {
        setMyGroups(myGroupsResult.value || [])
      } else {
        setMyGroups([])
      }

      if (postingContextResult.status === 'fulfilled') {
        setPostingContext(postingContextResult.value || null)
      } else {
        setPostingContext(null)
      }

      if (routeGroupResult.status === 'fulfilled') {
        setRouteGroup(routeGroupResult.value || null)
      } else {
        setRouteGroup(null)
      }
    } catch (requestError) {
      setFeedRows([])
      setGroupsRows([])
      setRouteGroup(null)
      setErrorMessage(getCommunityApiMessage(requestError, 'Không tải được dữ liệu Community.'))
    } finally {
      setRuntimeLoading(false)
    }
  }, [feedQuery, isAuthenticated, previewConfigId, routeGroupId, routeMode, snapshot?.hasActiveConfig])

  useEffect(() => {
    loadRuntime()
  }, [loadRuntime])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!userMenuRef.current) return
      if (!userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }

    if (!userMenuOpen) return undefined
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [userMenuOpen])

  useEffect(() => {
    setUserMenuOpen(false)
  }, [location.pathname, location.search])

  const identity = useMemo(() => resolveCommunityIdentity(snapshot, tenant), [snapshot, tenant])
  const config = snapshot?.config || null
  const headerConfig = config?.headerConfig || {}
  const feedConfig = useMemo(
    () => (config?.feedConfig && typeof config.feedConfig === 'object' ? config.feedConfig : {}),
    [config?.feedConfig],
  )
  const defaultComposerScope = useMemo(
    () => resolveComposerScopeByRoute(routeMode, feedConfig, routeGroupId),
    [feedConfig, routeGroupId, routeMode],
  )

  const sidebarItems = useMemo(() => {
    const sidebarConfig = config?.sidebarConfig && typeof config.sidebarConfig === 'object' ? config.sidebarConfig : {}
    const rawItems = Array.isArray(sidebarConfig.items) ? sidebarConfig.items : []
    const fallback = [
      { id: 'home', label: 'Trang chủ', type: 'home', target: routeHomePath, order: 0, enabled: true, visibility: 'public' },
      { id: 'community-feed', label: 'Community Feed', type: 'community-feed', target: communityFeedPath, order: 1, enabled: true, visibility: 'tenant-member' },
      { id: 'my-posts', label: 'Bài viết của tôi', type: 'my-posts', target: myPostsPath, order: 2, enabled: true, visibility: 'tenant-member' },
      { id: 'public-feed', label: 'Public Feed', type: 'public-feed', target: publicFeedPath, order: 3, enabled: true, visibility: 'public' },
      { id: 'group-directory', label: 'Nhóm của tôi', type: 'group', target: groupsDirectoryPath, order: 4, enabled: true, visibility: 'tenant-member' },
      { id: 'admin', label: 'Quản trị Community', type: 'admin', target: adminConfigPath, order: 99, enabled: true, visibility: 'admin' },
    ]

    const candidate = rawItems.length > 0 ? rawItems : fallback
    const memberOnlyTypes = new Set(['community-feed', 'my-posts', 'group'])
    const visibilityCheck = (visibility) => {
      if (visibility === 'admin') return isAdmin
      if (visibility === 'tenant-member') return isTenantMember
      if (visibility === 'authenticated') return isAuthenticated
      return true
    }

    const resolveTarget = (item) => {
      const type = toText(item.type).toLowerCase()
      if (type === 'home') return routeHomePath
      if (type === 'public-feed') return publicFeedPath
      if (type === 'community-feed') return communityFeedPath
      if (type === 'my-posts') return myPostsPath
      if (type === 'group') return groupsDirectoryPath
      if (type === 'admin') return adminConfigPath
      return toText(item.target)
    }

    return candidate
      .map((item, index) => ({
        id: toText(item.id) || `item-${index + 1}`,
        label: toText(item.label) || `Menu ${index + 1}`,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
        enabled: item.enabled !== false,
        type: toText(item.type).toLowerCase(),
        visibility: ['public', 'authenticated', 'tenant-member', 'admin'].includes(toText(item.visibility).toLowerCase()) ? toText(item.visibility).toLowerCase() : 'public',
        external: toText(item.type).toLowerCase() === 'external-link',
        target: resolveTarget(item),
      }))
      .map((item) => {
        if (item.visibility !== 'authenticated') return item
        if (!memberOnlyTypes.has(item.type)) return item
        return {
          ...item,
          visibility: 'tenant-member',
        }
      })
      .filter((item) => item.enabled && item.target && visibilityCheck(item.visibility))
      .sort((a, b) => a.order - b.order)
  }, [
    adminConfigPath,
    communityFeedPath,
    config?.sidebarConfig,
    groupsDirectoryPath,
    isAdmin,
    isAuthenticated,
    isTenantMember,
    myPostsPath,
    publicFeedPath,
    routeHomePath,
  ])

  const showSearch = headerConfig.showSearch !== false
  const showNotification = headerConfig.showNotification !== false
  const showUserMenu = headerConfig.showUserMenu !== false
  const accentColor = identity.accentColor || '#4f46e5'

  const composerGroups = useMemo(() => {
    const groups = Array.isArray(postingContext?.myGroups) ? postingContext.myGroups : []
    return groups.map((item) => item.group).filter(Boolean)
  }, [postingContext?.myGroups])

  const userName = toText(auth?.user?.fullName || auth?.user?.username || auth?.user?.email)
  const feedEmptyCopy = resolveFeedEmptyCopy(routeMode)

  function openLoginFromCommunity() {
    navigate(loginPath)
  }

  function openAccountPage() {
    setUserMenuOpen(false)
    navigate('/choose-tenant')
  }

  function openMyPostsFromMenu() {
    setUserMenuOpen(false)
    navigate(myPostsPath)
  }

  function openMyGroupsFromMenu() {
    setUserMenuOpen(false)
    navigate(groupsDirectoryPath)
  }

  function openCommunityAdminFromMenu() {
    setUserMenuOpen(false)
    navigate(adminConfigPath)
  }

  function logoutFromCommunity() {
    setUserMenuOpen(false)
    auth?.logout?.()
    navigate(routeHomePath, { replace: true })
  }

  function normalizeDraftForCompare(draft) {
    const mediaIds = Array.isArray(draft?.media)
      ? draft.media.map((item) => Number(item?.id || 0)).filter((id) => Number.isInteger(id) && id > 0)
      : []
    return JSON.stringify({
      scope: draft?.scope || 'community',
      group: draft?.scope === 'group' ? String(draft?.group || '') : '',
      title: toText(draft?.title),
      contentType: draft?.contentType || 'text',
      content: normalizeComposerContent(draft?.contentType, draft?.content || ''),
      allowComment: draft?.allowComment !== false,
      mediaIds,
      youtubeVideoId: toText(draft?.youtube?.videoId),
      youtubeUrl: toText(draft?.youtube?.url),
    })
  }

  function buildComposerPayload(draft) {
    const imageMediaIds = Array.isArray(draft?.media)
      ? draft.media.map((item) => Number(item?.id || 0)).filter((id) => Number.isInteger(id) && id > 0)
      : []
    return {
      scope: draft?.scope || 'community',
      group: draft?.scope === 'group' ? Number(draft?.group || routeGroupId || 0) || null : null,
      title: toText(draft?.title) || null,
      content: normalizeComposerContent(draft?.contentType, draft?.content || ''),
      contentType: draft?.contentType === 'html' ? 'html' : 'text',
      allowComment: draft?.allowComment !== false,
      media: imageMediaIds,
      youtubeUrl: draft?.youtube?.url || null,
      status: 'draft',
    }
  }

  function buildCreateDraft() {
    return buildComposerDraft({
      scope: defaultComposerScope.scope,
      group: defaultComposerScope.group,
      allowComment: postingContext?.defaultAllowComment !== false,
    })
  }

  function closeComposerModal(force = false) {
    if (!force && normalizeDraftForCompare(composerForm) !== normalizeDraftForCompare(composerFormInitial)) {
      const confirmed = window.confirm('Bạn có thay đổi chưa được lưu. Bạn có muốn đóng bài viết?')
      if (!confirmed) return
    }
    setComposerModalOpen(false)
    setComposerModalFocus(null)
    setComposerForm(buildCreateDraft())
    setComposerFormInitial(buildCreateDraft())
    setComposerMessage('')
  }

  function openCreateComposer(options = {}) {
    const focus = options.focusMedia || null
    const next = buildCreateDraft()
    setComposerModalMode('create')
    setComposerForm(next)
    setComposerFormInitial(next)
    setComposerModalFocus(focus)
    setComposerMessage('')
    setComposerModalOpen(true)
  }

  async function uploadImages(files, applyResult) {
    const selectedFiles = Array.isArray(files) ? files : []
    if (selectedFiles.length === 0) return

    const imageFiles = []
    for (const file of selectedFiles) {
      const fileName = toText(file?.name).toLowerCase()
      const mime = toText(file?.type).toLowerCase()
      const isImageMime = ['image/jpeg', 'image/png', 'image/webp'].includes(mime)
      const isImageExt = ['.jpg', '.jpeg', '.png', '.webp'].some((ext) => fileName.endsWith(ext))
      if (!isImageMime || !isImageExt) {
        setComposerMessage('Hiện Community chưa hỗ trợ tải video trực tiếp. Vui lòng tải video lên YouTube và dán liên kết vào bài viết.')
        return
      }
      imageFiles.push(file)
    }

    setMediaUploading(true)
    setComposerMessage('')
    try {
      const uploaded = await uploadCommunityPostImages(imageFiles)
      applyResult(uploaded)
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể tải ảnh lên.'))
    } finally {
      setMediaUploading(false)
    }
  }

  function applyYoutubeInput(inputValue, applyResult) {
    const videoId = parseYouTubeVideoId(inputValue)
    if (!videoId) {
      setComposerMessage('Liên kết YouTube không hợp lệ.')
      return false
    }
    const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`
    applyResult({ videoId, url: normalizedUrl })
    return true
  }

  async function saveDraftComposer() {
    setComposerSubmitting(true)
    setComposerMessage('')
    try {
      const payload = buildComposerPayload(composerForm)
      if (composerModalMode === 'edit' && composerForm.id) {
        await updateCommunityPost(composerForm.id, payload)
      } else {
        await createCommunityPost(payload)
      }
      closeComposerModal(true)
      setComposerMessage('Đã lưu bản nháp.')
      await loadRuntime()
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể lưu bản nháp.'))
    } finally {
      setComposerSubmitting(false)
    }
  }

  async function submitComposerForReview() {
    if (!window.confirm('Sau khi gửi duyệt, bạn sẽ không thể chỉnh sửa bài cho đến khi rút đề nghị hoặc bài được xử lý.\nBạn có muốn tiếp tục?')) {
      return
    }

    setComposerSubmitting(true)
    setComposerMessage('')
    try {
      let targetPostId = Number(composerForm.id || 0) || null
      if (composerModalMode === 'edit' && targetPostId) {
        await updateCommunityPost(targetPostId, buildComposerPayload(composerForm))
      } else {
        const created = await createCommunityPost(buildComposerPayload(composerForm))
        targetPostId = created.id
      }
      await submitCommunityPostForReview(targetPostId)
      closeComposerModal(true)
      setComposerMessage('Bài viết đã được gửi duyệt.')
      await loadRuntime()
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể gửi duyệt bài viết.'))
    } finally {
      setComposerSubmitting(false)
    }
  }

  async function publishComposerPost() {
    setComposerSubmitting(true)
    setComposerMessage('')
    try {
      let targetPostId = Number(composerForm.id || 0) || null
      if (composerModalMode === 'edit' && targetPostId) {
        await updateCommunityPost(targetPostId, buildComposerPayload(composerForm))
      } else {
        const created = await createCommunityPost(buildComposerPayload(composerForm))
        targetPostId = created.id
      }
      await publishCommunityPost(targetPostId)
      closeComposerModal(true)
      setComposerMessage('Bài viết đã được đăng.')
      await loadRuntime()
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể đăng bài viết.'))
    } finally {
      setComposerSubmitting(false)
    }
  }

  function startEditDraft(post) {
    const nextDraft = {
      id: post.id,
      scope: post.scope || 'community',
      group: post.group?.id ? String(post.group.id) : '',
      title: post.title || '',
      content: post.content || '',
      contentType: post.contentType || 'text',
      allowComment: post.allowComment !== false,
      media: Array.isArray(post.media) ? post.media.filter((item) => item?.type === 'image') : [],
      youtube: post.youtubeVideoId ? { videoId: post.youtubeVideoId, url: post.youtubeUrl || `https://www.youtube.com/watch?v=${post.youtubeVideoId}` } : null,
    }
    setComposerModalMode('edit')
    setComposerForm(nextDraft)
    setComposerFormInitial(nextDraft)
    setComposerModalFocus(null)
    setComposerModalOpen(true)
    setComposerMessage('')
  }

  async function withdrawPendingPost(postId) {
    setComposerSubmitting(true)
    setComposerMessage('')
    try {
      await withdrawCommunityPost(postId)
      setComposerMessage('Bài viết đã được rút về bản nháp.')
      await loadRuntime()
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể rút đề nghị duyệt.'))
    } finally {
      setComposerSubmitting(false)
    }
  }

  async function submitDraftFromCard(postId) {
    if (!window.confirm('Sau khi gửi duyệt, bạn sẽ không thể chỉnh sửa bài cho đến khi rút đề nghị hoặc bài được xử lý.\nBạn có muốn tiếp tục?')) {
      return
    }
    setComposerSubmitting(true)
    setComposerMessage('')
    try {
      await submitCommunityPostForReview(postId)
      setComposerMessage('Bài viết đã được gửi duyệt.')
      await loadRuntime()
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể gửi duyệt bài viết.'))
    } finally {
      setComposerSubmitting(false)
    }
  }

  async function deleteDraftFromCard(postId) {
    if (!window.confirm('Bạn có chắc muốn xóa bản nháp này?')) return
    setComposerSubmitting(true)
    setComposerMessage('')
    try {
      await deleteCommunityPost(postId)
      setComposerMessage('Đã xóa bài viết.')
      await loadRuntime()
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể xóa bài viết.'))
    } finally {
      setComposerSubmitting(false)
    }
  }

  function mergePostInteraction(postId, update) {
    setFeedRows((previous) => previous.map((item) => {
      if (Number(item.id) !== Number(postId)) return item
      const nextUpdate = typeof update === 'function' ? update(item) : update
      return {
        ...item,
        ...nextUpdate,
      }
    }))
  }

  async function loadComments(postId) {
    setCommentStates((previous) => ({
      ...previous,
      [postId]: {
        ...(previous[postId] || {}),
        loading: true,
      },
    }))
    try {
      const result = await getCommunityPostComments(postId, { page: 1, pageSize: 10 })
      setCommentStates((previous) => ({
        ...previous,
        [postId]: {
          ...(previous[postId] || {}),
          open: true,
          loading: false,
          loaded: true,
          rows: result.rows || [],
          pagination: result.pagination || null,
        },
      }))
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể tải bình luận.'))
      setCommentStates((previous) => ({
        ...previous,
        [postId]: {
          ...(previous[postId] || {}),
          loading: false,
          loaded: true,
        },
      }))
    }
  }

  function toggleComments(postId) {
    setCommentStates((previous) => {
      const current = previous[postId] || { open: false, rows: [], loading: false, loaded: false }
      return {
        ...previous,
        [postId]: {
          ...current,
          open: !current.open,
        },
      }
    })
  }

  async function createComment(postId, payload) {
    setCommentBusyPosts((previous) => ({ ...previous, [postId]: true }))
    try {
      await createCommunityComment(postId, payload)
      await loadComments(postId)
      mergePostInteraction(postId, (current) => ({ commentCount: Number(current.commentCount || 0) + 1 }))
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể gửi bình luận.'))
    } finally {
      setCommentBusyPosts((previous) => ({ ...previous, [postId]: false }))
    }
  }

  async function updateComment(postId, commentId, payload) {
    setCommentBusyPosts((previous) => ({ ...previous, [postId]: true }))
    try {
      await updateCommunityComment(commentId, payload)
      await loadComments(postId)
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể cập nhật bình luận.'))
    } finally {
      setCommentBusyPosts((previous) => ({ ...previous, [postId]: false }))
    }
  }

  async function deleteComment(postId, commentId) {
    setCommentBusyPosts((previous) => ({ ...previous, [postId]: true }))
    try {
      await deleteCommunityComment(commentId)
      await loadComments(postId)
      mergePostInteraction(postId, (current) => ({ commentCount: Math.max(0, Number(current.commentCount || 0) - 1) }))
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể xóa bình luận.'))
    } finally {
      setCommentBusyPosts((previous) => ({ ...previous, [postId]: false }))
    }
  }

  async function hideComment(postId, commentId) {
    setCommentBusyPosts((previous) => ({ ...previous, [postId]: true }))
    try {
      await hideCommunityComment(commentId)
      await loadComments(postId)
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể ẩn bình luận.'))
    } finally {
      setCommentBusyPosts((previous) => ({ ...previous, [postId]: false }))
    }
  }

  async function reactPost(post, type) {
    if (!post?.id) return
    setReactionBusyPosts((previous) => ({ ...previous, [post.id]: true }))
    try {
      if (post.myReaction === type) {
        const result = await removeCommunityPostReaction(post.id)
        mergePostInteraction(post.id, {
          reactionSummary: result?.reactionSummary || { like: 0, love: 0, support: 0 },
          reactionCount: Number(result?.reactionCount || 0),
          myReaction: null,
        })
      } else {
        const result = await setCommunityPostReaction(post.id, type)
        mergePostInteraction(post.id, {
          reactionSummary: result?.reactionSummary || { like: 0, love: 0, support: 0 },
          reactionCount: Number(result?.reactionCount || 0),
          myReaction: result?.myReaction || type,
        })
      }
    } catch (requestError) {
      setComposerMessage(getCommunityApiMessage(requestError, 'Không thể cập nhật cảm xúc.'))
    } finally {
      setReactionBusyPosts((previous) => ({ ...previous, [post.id]: false }))
    }
  }

  return (
    <div className='community-shell' style={{ '--community-accent': accentColor }}>
      <header className='community-header'>
        <div className='community-header-left'>
          <button type='button' className='community-hamburger' onClick={() => setMobileMenuOpen(true)}>☰</button>
          {identity.tenantLogoUrl ? (
            <img src={identity.tenantLogoUrl} alt={identity.communityName} className='community-logo' />
          ) : (
            <div className='community-logo community-logo-fallback'>{toInitials(identity.communityName)}</div>
          )}
          <div className='community-header-copy'>
            <div className='community-title'>{identity.communityName}</div>
            {identity.slogan ? <div className='community-slogan'>{identity.slogan}</div> : null}
          </div>
        </div>
        <div className='community-header-right'>
          {showSearch ? <input className='community-search' placeholder='Tìm trong Community...' disabled /> : null}
          {showNotification ? <button type='button' className='community-icon-btn' title='Thông báo'>🔔</button> : null}
          {showUserMenu ? (
            isAuthenticated ? (
              <div className='community-user-menu' ref={userMenuRef}>
                <button
                  type='button'
                  className='community-user-trigger'
                  title='Tài khoản'
                  onClick={() => setUserMenuOpen((previous) => !previous)}
                >
                  <span className='community-user-avatar'>
                    {userAvatarUrl ? <img src={userAvatarUrl} alt={userName || 'User'} /> : toInitials(userName || 'U')}
                  </span>
                  <span className='community-user-name'>{userName || 'Tài khoản'}</span>
                  <span className='community-user-caret'>▾</span>
                </button>
                {userMenuOpen ? (
                  <div className='community-user-dropdown'>
                    <div className='community-user-dropdown-head'>{userName || auth?.user?.email || 'Tài khoản'}</div>
                    <button type='button' className='community-user-dropdown-item' onClick={openAccountPage}>Tài khoản</button>
                    {isTenantMember ? <button type='button' className='community-user-dropdown-item' onClick={openMyPostsFromMenu}>Bài viết của tôi</button> : null}
                    {isTenantMember ? <button type='button' className='community-user-dropdown-item' onClick={openMyGroupsFromMenu}>Nhóm của tôi</button> : null}
                    {isAdmin ? <button type='button' className='community-user-dropdown-item' onClick={openCommunityAdminFromMenu}>Quản trị Community</button> : null}
                    <button type='button' className='community-user-dropdown-item is-danger' onClick={logoutFromCommunity}>Đăng xuất</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button type='button' className='community-login-btn' onClick={openLoginFromCommunity}>Đăng nhập</button>
            )
          ) : null}
        </div>
      </header>

      <div className='community-layout'>
        <CommunitySidebar
          items={sidebarItems}
          myGroups={myGroups}
          mobileOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          showMyGroups={isTenantMember}
          tenantCode={tenantCode}
          isMainDomain={isMainDomain}
        />

        <main className='community-content'>
          {bootstrapLoading || runtimeLoading ? (
            <div className='community-loading'><CSpinner size='sm' /> <span>Đang tải Community...</span></div>
          ) : null}
          {previewNotice ? <CAlert color='info'>{previewNotice}</CAlert> : null}
          {authRequiredError ? (
            <section className='community-panel community-auth-required-card'>
              <h3>Bạn cần đăng nhập để sử dụng tính năng này.</h3>
              <p>Vui lòng đăng nhập để xem nội dung Community và tham gia tương tác.</p>
              <div>
                <CButton className='community-primary-btn' onClick={() => navigate(loginPath)}>Đăng nhập</CButton>
              </div>
            </section>
          ) : null}
          {routeMode === 'my-posts' && tenantMemberRequiredError ? (
            <section className='community-panel community-auth-required-card'>
              <h3>Tính năng này dành cho thành viên của Community.</h3>
              <p>Tài khoản của bạn hiện chưa thuộc tenant này.</p>
            </section>
          ) : null}
          {errorMessage && !authRequiredError && !(routeMode === 'my-posts' && tenantMemberRequiredError) ? <CAlert color='danger'>{errorMessage}</CAlert> : null}

          {!bootstrapLoading && !errorMessage && !snapshot?.hasActiveConfig ? (
            <CAlert color='warning'>
              Community chưa được mở cho tenant này.
              {isAdmin ? <> <CButton color='link' className='p-0 align-baseline' href={adminConfigPath}>Tạo hoặc activate CommunityConfig</CButton>.</> : null}
            </CAlert>
          ) : null}

          {!bootstrapLoading && !errorMessage && (snapshot?.hasActiveConfig || previewConfigId) ? (
            <div className='community-feed-shell'>
              {composerMessage && !composerModalOpen ? <CAlert color='info' className='mb-0'>{composerMessage}</CAlert> : null}
              {routeMode !== 'groups' ? (
                <CommunityFeedFilters
                  isTenantMember={isTenantMember}
                  routeMode={routeMode}
                  navigate={navigate}
                  paths={{
                    home: routeHomePath,
                    communityFeed: communityFeedPath,
                    publicFeed: publicFeedPath,
                    groups: groupsDirectoryPath,
                  }}
                />
              ) : null}

              {routeMode !== 'groups' ? (
                <CommunityComposer
                  isTenantMember={isTenantMember}
                  userName={userName}
                  onOpenComposer={() => openCreateComposer()}
                  onOpenImageComposer={() => openCreateComposer({ focusMedia: 'image' })}
                />
              ) : null}

              {routeMode === 'groups' ? (
                <section className='community-feed-container'>
                  {groupsRows.length === 0 ? (
                    <div className='community-panel'>
                      <div className='community-empty-state'>
                        <h3>Chưa có nhóm phù hợp.</h3>
                        <p>Hiện chưa có CommunityGroup nào hiển thị với tài khoản của bạn.</p>
                      </div>
                    </div>
                  ) : groupsRows.map((group) => {
                    const groupPath = buildTenantUrl(`/community/group/${group.id}`, { tenantCode, isMainDomain }) || `/community/group/${group.id}`
                    return (
                      <article key={`group:${group.id}`} className='community-panel community-group-card'>
                        <div className='community-group-head'>
                          <div className='community-group-avatar'>
                            {group.avatar?.url ? <img src={group.avatar.url} alt={group.name || 'group'} /> : toInitials(group.name || 'G')}
                          </div>
                          <div>
                            <div className='community-group-name'>{group.name || `Group #${group.id}`}</div>
                            <div className='community-group-meta'>{group.visibility === 'public' ? '🌐 Công khai' : '🔒 Chỉ thành viên'}</div>
                          </div>
                        </div>
                        <p className='community-group-description'>{group.description || 'Không có mô tả.'}</p>
                        <CButton className='community-primary-btn' onClick={() => navigate(groupPath)}>Xem feed nhóm</CButton>
                      </article>
                    )
                  })}
                </section>
              ) : (
                <section className='community-feed-container'>
                  {feedRows.length === 0 ? (
                    <div className='community-panel community-empty-card'>
                      <div className='community-empty-state'>
                        <h3>{feedEmptyCopy.title}</h3>
                        <p>{feedEmptyCopy.description}</p>
                      </div>
                    </div>
                  ) : (
                    feedRows.map((post) => {
                      const postActions = []
                      if (routeMode === 'my-posts') {
                        if (post.status === 'draft' || post.status === 'rejected') {
                          postActions.push({ key: 'edit-draft', label: 'Chỉnh sửa', onClick: () => startEditDraft(post), disabled: composerSubmitting })
                          postActions.push({ key: 'submit-review', label: 'Gửi duyệt', primary: true, onClick: () => submitDraftFromCard(post.id), disabled: composerSubmitting })
                          postActions.push({ key: 'delete-draft', label: 'Xóa', onClick: () => deleteDraftFromCard(post.id), disabled: composerSubmitting })
                        } else if (post.status === 'pending') {
                          postActions.push({ key: 'withdraw-review', label: 'Rút đề nghị duyệt', onClick: () => withdrawPendingPost(post.id), disabled: composerSubmitting })
                        }
                      }

                      const commentsState = commentStates[post.id] || { open: false, rows: [], loading: false }
                      const allowReaction = isTenantMember && post.status === 'published' && (snapshot?.config?.policyConfig?.allowReaction !== false)
                      return (
                        <CommunityPostCard
                          key={`post:${post.id}`}
                          post={post}
                          showStatus={routeMode === 'my-posts'}
                          actions={postActions}
                          allowReaction={allowReaction}
                          isTenantMember={isTenantMember}
                          reactionBusy={reactionBusyPosts[post.id] === true}
                          onReact={(type) => reactPost(post, type)}
                          commentsState={commentsState}
                          commentsBusy={commentBusyPosts[post.id] === true}
                          onToggleComments={() => toggleComments(post.id)}
                          onLoadComments={() => loadComments(post.id)}
                          onCreateComment={(payload) => createComment(post.id, payload)}
                          onUpdateComment={(commentId, payload) => updateComment(post.id, commentId, payload)}
                          onDeleteComment={(commentId) => deleteComment(post.id, commentId)}
                          onHideComment={(commentId) => hideComment(post.id, commentId)}
                          isAdmin={isAdmin}
                        />
                      )
                    })
                  )}
                </section>
              )}
            </div>
          ) : null}
        </main>
      </div>

      <CommunityComposerModal
        visible={composerModalOpen}
        title={composerModalMode === 'edit' ? 'Chỉnh sửa bản nháp' : 'Tạo bài viết'}
        userName={userName}
        form={composerForm}
        setForm={setComposerForm}
        composerGroups={composerGroups}
        routeMode={routeMode}
        routeGroupId={routeGroupId}
        groupName={routeGroup?.name || ''}
        submitting={composerSubmitting}
        mediaUploading={mediaUploading}
        message={composerMessage}
        canDirectPublish={isAdmin}
        initialFocus={composerModalFocus}
        onClose={() => closeComposerModal(false)}
        onSaveDraft={saveDraftComposer}
        onSubmitForReview={submitComposerForReview}
        onPublishNow={publishComposerPost}
        onSelectImages={(files) => uploadImages(files, (uploaded) => {
          setComposerForm((previous) => ({
            ...previous,
            media: [...(Array.isArray(previous.media) ? previous.media : []), ...uploaded],
          }))
        })}
        onRemoveImage={(index) => setComposerForm((previous) => ({
          ...previous,
          media: (Array.isArray(previous.media) ? previous.media : []).filter((_, mediaIndex) => mediaIndex !== index),
        }))}
        onSetYoutubeLink={(youtubeInput) => {
          return applyYoutubeInput(youtubeInput, (youtube) => {
            setComposerForm((previous) => ({
              ...previous,
              youtube,
            }))
          })
        }}
        onClearYoutubeLink={() => setComposerForm((previous) => ({ ...previous, youtube: null }))}
      />
    </div>
  )
}
