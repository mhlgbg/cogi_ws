import api from '../../../api/axios'
import { resolveMediaUrl } from '../../../utils/mediaUrl'

function unwrapData(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data
  return payload
}

function unwrapPagination(payload) {
  return payload?.meta?.pagination || {
    page: 1,
    pageSize: 20,
    pageCount: 1,
    total: 0,
  }
}

function normalizeMedia(value) {
  if (!value || typeof value !== 'object') return null
  const type = String(value.type || '').trim().toLowerCase()
  if (type === 'youtube') {
    const videoId = String(value.videoId || '').trim()
    if (!videoId) return null
    return {
      id: value.id || `youtube:${videoId}`,
      type: 'youtube',
      videoId,
      url: String(value.url || `https://www.youtube.com/watch?v=${videoId}`).trim(),
      order: Number(value.order || 0) || 0,
    }
  }

  return {
    id: Number(value.id || 0) || null,
    type: 'image',
    name: String(value.name || '').trim(),
    url: resolveMediaUrl(String(value.url || value.attributes?.url || '').trim()) || '',
    mime: String(value.mime || '').trim(),
    ext: String(value.ext || '').trim(),
    width: Number(value.width || 0) || null,
    height: Number(value.height || 0) || null,
    formats: value.formats && typeof value.formats === 'object' ? value.formats : null,
    order: Number(value.order || 0) || 0,
  }
}

function normalizeGroup(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: Number(value.id || 0) || null,
    name: String(value.name || '').trim(),
    slug: String(value.slug || '').trim(),
    description: String(value.description || '').trim(),
    visibility: String(value.visibility || 'members').trim().toLowerCase(),
    status: String(value.status || 'active').trim().toLowerCase(),
    linkedType: String(value.linkedType || 'none').trim().toLowerCase(),
    linkedClub: value.linkedClub || null,
    avatar: normalizeMedia(value.avatar),
    coverImage: normalizeMedia(value.coverImage),
    allowMemberPost: value.allowMemberPost !== false,
    memberPostRequiresApproval: value.memberPostRequiresApproval !== false,
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  }
}

function normalizePost(value) {
  if (!value || typeof value !== 'object') return null
  const reactionSummarySource = value.reactionSummary && typeof value.reactionSummary === 'object' ? value.reactionSummary : {}
  return {
    id: Number(value.id || 0) || null,
    scope: String(value.scope || 'community').trim().toLowerCase(),
    title: String(value.title || '').trim(),
    content: String(value.content || ''),
    contentType: String(value.contentType || 'text').trim().toLowerCase(),
    status: String(value.status || 'draft').trim().toLowerCase(),
    allowComment: value.allowComment !== false,
    isPinned: value.isPinned === true,
    isFeatured: value.isFeatured === true,
    publishedAt: value.publishedAt || null,
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
    author: value.author || null,
    group: normalizeGroup(value.group),
    media: Array.isArray(value.media) ? value.media.map(normalizeMedia).filter(Boolean).sort((a, b) => (a.order || 0) - (b.order || 0)) : [],
    youtubeUrl: value.youtubeUrl ? String(value.youtubeUrl).trim() : null,
    youtubeVideoId: value.youtubeVideoId ? String(value.youtubeVideoId).trim() : null,
    commentCount: Number(value.commentCount || 0) || 0,
    reactionCount: Number(value.reactionCount || 0) || 0,
    reactionSummary: {
      like: Number(reactionSummarySource.like || 0) || 0,
      love: Number(reactionSummarySource.love || 0) || 0,
      support: Number(reactionSummarySource.support || 0) || 0,
    },
    myReaction: value.myReaction ? String(value.myReaction).trim().toLowerCase() : null,
  }
}

function normalizeComment(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: Number(value.id || 0) || null,
    postId: Number(value.postId || value.post?.id || 0) || null,
    tenantId: Number(value.tenantId || value.tenant?.id || 0) || null,
    parentCommentId: Number(value.parentCommentId || value.parentComment?.id || 0) || null,
    content: String(value.content || ''),
    status: String(value.status || 'active').trim().toLowerCase(),
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
    author: value.author || null,
    replies: Array.isArray(value.replies) ? value.replies.map(normalizeComment).filter(Boolean) : [],
    canEdit: value.canEdit === true,
    canDelete: value.canDelete === true,
    canModerate: value.canModerate === true,
  }
}

function normalizeMembership(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: Number(value.id || 0) || null,
    role: String(value.role || 'member').trim().toLowerCase(),
    status: String(value.status || 'active').trim().toLowerCase(),
    joinedAt: value.joinedAt || null,
    user: value.user || null,
    group: normalizeGroup(value.group),
  }
}

function normalizeActor(value, fallbackAuthenticated = false) {
  if (!value || typeof value !== 'object') {
    return {
      authenticated: fallbackAuthenticated,
      tenantMember: false,
      communityRole: 'guest',
    }
  }
  return {
    authenticated: value.authenticated === true,
    tenantMember: value.tenantMember === true,
    communityRole: String(value.communityRole || 'guest').trim().toLowerCase(),
  }
}

export function getCommunityApiMessage(error, fallback = 'Không thể xử lý Community.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function getCommunityFeed(params = {}) {
  const response = await api.get('/community/feed', { params })
  const rows = Array.isArray(response?.data?.data) ? response.data.data.map(normalizePost).filter(Boolean) : []
  return {
    rows,
    pagination: unwrapPagination(response.data),
    policy: response?.data?.meta?.policy || null,
    actor: normalizeActor(response?.data?.meta?.actor, false),
  }
}

export async function getCommunityMyPosts(params = {}) {
  const response = await api.get('/community/posts/mine', { params })
  return {
    rows: Array.isArray(response?.data?.data) ? response.data.data.map(normalizePost).filter(Boolean) : [],
    pagination: unwrapPagination(response.data),
    policy: response?.data?.meta?.policy || null,
    actor: normalizeActor(response?.data?.meta?.actor, true),
  }
}

export async function getCommunityGroups(params = {}) {
  const response = await api.get('/community/groups', { params })
  return {
    rows: Array.isArray(response?.data?.data) ? response.data.data.map(normalizeGroup).filter(Boolean) : [],
    pagination: unwrapPagination(response.data),
  }
}

export async function getCommunityGroupDetail(groupId) {
  const response = await api.get(`/community/groups/${groupId}`)
  return normalizeGroup(unwrapData(response.data))
}

export async function createCommunityGroup(payload) {
  const response = await api.post('/community/groups', { data: payload })
  return normalizeGroup(unwrapData(response.data))
}

export async function updateCommunityGroup(groupId, payload) {
  const response = await api.put(`/community/groups/${groupId}`, { data: payload })
  return normalizeGroup(unwrapData(response.data))
}

export async function archiveCommunityGroup(groupId) {
  const response = await api.post(`/community/groups/${groupId}/archive`, {})
  return normalizeGroup(unwrapData(response.data))
}

export async function getCommunityGroupMembers(groupId) {
  const response = await api.get(`/community/groups/${groupId}/members`)
  return Array.isArray(response?.data?.data) ? response.data.data.map(normalizeMembership).filter(Boolean) : []
}

export async function addCommunityGroupMember(groupId, payload) {
  const response = await api.post(`/community/groups/${groupId}/members`, { data: payload })
  return normalizeMembership(unwrapData(response.data))
}

export async function updateCommunityGroupMember(groupId, memberId, payload) {
  const response = await api.put(`/community/groups/${groupId}/members/${memberId}`, { data: payload })
  return normalizeMembership(unwrapData(response.data))
}

export async function removeCommunityGroupMember(groupId, memberId) {
  await api.delete(`/community/groups/${groupId}/members/${memberId}`)
}

export async function getMyCommunityGroups() {
  const response = await api.get('/community/my-groups')
  return Array.isArray(response?.data?.data) ? response.data.data.map(normalizeMembership).filter(Boolean) : []
}

export async function getCommunityPostingContext() {
  const response = await api.get('/community/posting-context')
  const context = unwrapData(response.data) || null
  if (!context || typeof context !== 'object') return null
  return {
    ...context,
    actor: normalizeActor(context.actor, false),
  }
}

export async function createCommunityPost(payload) {
  const response = await api.post('/community/posts', { data: payload })
  return normalizePost(unwrapData(response.data))
}

export async function uploadCommunityPostImages(files) {
  const rows = Array.isArray(files) ? files : []
  if (rows.length === 0) return []

  const formData = new FormData()
  rows.forEach((file) => formData.append('files', file))
  const response = await api.post('/upload', formData)
  const uploadedRows = Array.isArray(response?.data) ? response.data : []
  return uploadedRows.map(normalizeMedia).filter(Boolean)
}

export async function updateCommunityPost(postId, payload) {
  const response = await api.put(`/community/posts/${postId}`, { data: payload })
  return normalizePost(unwrapData(response.data))
}

export async function deleteCommunityPost(postId) {
  await api.delete(`/community/posts/${postId}`)
}

export async function getPendingCommunityPosts() {
  const response = await api.get('/community/posts/manage/pending')
  return Array.isArray(response?.data?.data) ? response.data.data.map(normalizePost).filter(Boolean) : []
}

export async function getManageCommunityPosts(params = {}) {
  const response = await api.get('/community/posts/manage', { params })
  return {
    rows: Array.isArray(response?.data?.data) ? response.data.data.map(normalizePost).filter(Boolean) : [],
    pagination: unwrapPagination(response.data),
  }
}

export async function getManageCommunityPostDetail(postId) {
  const response = await api.get(`/community/posts/${postId}`)
  return normalizePost(unwrapData(response.data))
}

async function runPostAction(postId, action) {
  const response = await api.post(`/community/posts/${postId}/${action}`, {})
  return normalizePost(unwrapData(response.data))
}

export async function publishCommunityPost(postId) {
  return await runPostAction(postId, 'publish')
}

export async function submitCommunityPostForReview(postId) {
  return await runPostAction(postId, 'submit-review')
}

export async function withdrawCommunityPost(postId) {
  return await runPostAction(postId, 'withdraw')
}

export async function hideCommunityPost(postId) {
  return await runPostAction(postId, 'hide')
}

export async function rejectCommunityPost(postId) {
  return await runPostAction(postId, 'reject')
}

export async function pinCommunityPost(postId) {
  return await runPostAction(postId, 'pin')
}

export async function unpinCommunityPost(postId) {
  return await runPostAction(postId, 'unpin')
}

export async function featureCommunityPost(postId) {
  return await runPostAction(postId, 'feature')
}

export async function unfeatureCommunityPost(postId) {
  return await runPostAction(postId, 'unfeature')
}

export async function getCommunityPostComments(postId, params = {}) {
  const response = await api.get(`/community/posts/${postId}/comments`, { params })
  return {
    rows: Array.isArray(response?.data?.data) ? response.data.data.map(normalizeComment).filter(Boolean) : [],
    pagination: unwrapPagination(response.data),
  }
}

export async function createCommunityComment(postId, payload) {
  const response = await api.post(`/community/posts/${postId}/comments`, { data: payload })
  return normalizeComment(unwrapData(response.data))
}

export async function updateCommunityComment(commentId, payload) {
  const response = await api.put(`/community/comments/${commentId}`, { data: payload })
  return normalizeComment(unwrapData(response.data))
}

export async function deleteCommunityComment(commentId) {
  await api.delete(`/community/comments/${commentId}`)
}

export async function hideCommunityComment(commentId) {
  await api.post(`/community/comments/${commentId}/hide`, {})
}

export async function setCommunityPostReaction(postId, type) {
  const response = await api.post(`/community/posts/${postId}/reaction`, { data: { type } })
  return unwrapData(response.data) || null
}

export async function removeCommunityPostReaction(postId) {
  const response = await api.delete(`/community/posts/${postId}/reaction`)
  return unwrapData(response.data) || null
}
