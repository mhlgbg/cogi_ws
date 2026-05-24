import api from '../../../api/axios'
import { resolveMediaUrl } from '../../../utils/mediaUrl'

function toAbsoluteUrl(url) {
  return resolveMediaUrl(url)
}

function normalizeRelation(value) {
  if (!value) return null

  if (value.data && typeof value.data === 'object') {
    const row = value.data
    if (row.attributes && typeof row.attributes === 'object') {
      return {
        id: row.id,
        ...row.attributes,
      }
    }

    return row
  }

  if (value.attributes && typeof value.attributes === 'object') {
    return {
      id: value.id,
      ...value.attributes,
    }
  }

  return value
}

function normalizeMedia(value) {
  if (!value) return null

  const relation = normalizeRelation(value)
  if (!relation || typeof relation !== 'object') return relation

  return {
    ...relation,
    url: toAbsoluteUrl(relation.url),
    attributes: relation.attributes
      ? {
        ...relation.attributes,
        url: toAbsoluteUrl(relation.attributes.url),
      }
      : relation.attributes,
  }
}

function normalizeJournalIssueItem(row) {
  if (!row || typeof row !== 'object') return null

  const base = row.attributes && typeof row.attributes === 'object'
    ? {
      id: row.id,
      ...row.attributes,
    }
    : row

  return {
    ...base,
    tenant: normalizeRelation(base.tenant),
    article: normalizeRelation(base.article),
    journalIssue: normalizeRelation(base.journalIssue),
    pdfFile: normalizeMedia(base.pdfFile),
  }
}

function normalizeJournalIssue(row) {
  if (!row || typeof row !== 'object') return null

  const base = row.attributes && typeof row.attributes === 'object'
    ? {
      id: row.id,
      ...row.attributes,
    }
    : row

  const issueItemsSource = Array.isArray(base.issueItems)
    ? base.issueItems
    : Array.isArray(base.issueItems?.data)
      ? base.issueItems.data
      : []

  return {
    ...base,
    tenant: normalizeRelation(base.tenant),
    journalCategory: normalizeRelation(base.journalCategory),
    coverImage: normalizeMedia(base.coverImage),
    pdfFile: normalizeMedia(base.pdfFile),
    issueItems: issueItemsSource.map(normalizeJournalIssueItem).filter(Boolean),
  }
}

function normalizePayload(payload, normalizer) {
  if (Array.isArray(payload?.data)) {
    return {
      data: payload.data.map(normalizer).filter(Boolean),
      meta: payload?.meta || null,
    }
  }

  if (payload?.data && typeof payload.data === 'object') {
    return {
      ...payload,
      data: normalizer(payload.data),
    }
  }

  return {
    data: [],
    meta: payload?.meta || null,
  }
}

function buildJournalIssueQueryParams({ page = 1, pageSize = 10, q = '', status = 'published' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'publicAt:desc',
    'sort[1]': 'year:desc',
    'sort[2]': 'updatedAt:desc',
    populate: '*',
    status,
  }

  const keyword = String(q || '').trim()
  if (keyword) {
    params['filters[$or][0][title][$containsi]'] = keyword
    params['filters[$or][1][slug][$containsi]'] = keyword
    params['filters[$or][2][issueNumber][$containsi]'] = keyword
    params['filters[$or][3][volume][$containsi]'] = keyword
    params['filters[$or][4][year][$eq]'] = Number.isInteger(Number(keyword)) ? Number(keyword) : undefined
  }

  Object.keys(params).forEach((key) => {
    if (params[key] === undefined) delete params[key]
  })

  return params
}

function buildArticleQueryParams({ page = 1, pageSize = 100, q = '', status = 'published' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'publicAt:desc',
    'sort[1]': 'publishedAt:desc',
    populate: '*',
    status,
  }

  const keyword = String(q || '').trim()
  if (keyword) {
    params['filters[$or][0][title][$containsi]'] = keyword
    params['filters[$or][1][slug][$containsi]'] = keyword
  }

  return params
}

function toTimestamp(value) {
  const timestamp = Date.parse(String(value || ''))
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function hasNewerDraftVersion(draftVersion, publishedVersion) {
  if (!draftVersion || !publishedVersion) return false
  return toTimestamp(draftVersion.updatedAt) > toTimestamp(publishedVersion.updatedAt)
}

function compareDocuments(left, right) {
  const leftDate = toTimestamp(left?.displayDate || left?.updatedAt)
  const rightDate = toTimestamp(right?.displayDate || right?.updatedAt)
  if (leftDate !== rightDate) return rightDate - leftDate

  const leftUpdatedAt = toTimestamp(left?.updatedAt)
  const rightUpdatedAt = toTimestamp(right?.updatedAt)
  if (leftUpdatedAt !== rightUpdatedAt) return rightUpdatedAt - leftUpdatedAt

  return String(left?.title || '').localeCompare(String(right?.title || ''))
}

async function fetchAllJournalIssuesByStatus({ q = '', status = 'published' } = {}) {
  const rows = []
  const pageSize = 100
  let page = 1
  let pageCount = 1

  do {
    const res = await api.get('/journal-issues', {
      params: buildJournalIssueQueryParams({ page, pageSize, q, status }),
    })

    const normalized = normalizePayload(res.data, normalizeJournalIssue)
    rows.push(...(normalized?.data || []))
    pageCount = Math.max(1, Number(normalized?.meta?.pagination?.pageCount || 1))
    page += 1
  } while (page <= pageCount)

  return rows
}

async function fetchAllArticleOptionsByStatus({ q = '', status = 'published' } = {}) {
  const rows = []
  const pageSize = 100
  let page = 1
  let pageCount = 1

  do {
    const res = await api.get('/articles', {
      params: buildArticleQueryParams({ page, pageSize, q, status }),
    })

    const rawRows = Array.isArray(res?.data?.data) ? res.data.data : []
    rows.push(...rawRows)
    pageCount = Math.max(1, Number(res?.data?.meta?.pagination?.pageCount || 1))
    page += 1
  } while (page <= pageCount)

  return rows.map((row) => {
    if (!row || typeof row !== 'object') return null
    const base = row.attributes && typeof row.attributes === 'object'
      ? { id: row.id, ...row.attributes }
      : row

    return {
      id: base.id,
      documentId: base.documentId,
      title: base.title,
      slug: base.slug,
      publishedAt: base.publishedAt,
      updatedAt: base.updatedAt,
    }
  }).filter(Boolean)
}

function mergeDocumentVersions(draftRows = [], publishedRows = [], status = '') {
  const draftMap = new Map(
    draftRows
      .filter((item) => String(item?.documentId || '').trim())
      .map((item) => [String(item.documentId).trim(), item]),
  )
  const publishedMap = new Map(
    publishedRows
      .filter((item) => String(item?.documentId || '').trim())
      .map((item) => [String(item.documentId).trim(), item]),
  )

  const normalizedStatus = String(status || '').trim().toLowerCase()
  const documentIds = Array.from(new Set([...draftMap.keys(), ...publishedMap.keys()]))

  return documentIds.map((documentId) => {
    const draftVersion = draftMap.get(documentId) || null
    const publishedVersion = publishedMap.get(documentId) || null
    const displayVersion = publishedVersion || draftVersion
    if (!displayVersion) return null

    const hasPublishedVersion = Boolean(publishedVersion?.publishedAt)
    const hasModifiedDraft = hasPublishedVersion && hasNewerDraftVersion(draftVersion, publishedVersion)
    const statusLabel = hasPublishedVersion
      ? (hasModifiedDraft ? 'Published with modified draft' : 'Published')
      : 'Draft'

    return {
      ...displayVersion,
      documentId,
      draftVersion,
      publishedVersion,
      statusLabel,
      hasPublishedVersion,
      hasModifiedDraft,
      displayDate: displayVersion?.publicAt || displayVersion?.publishedAt || null,
    }
  }).filter((item) => {
    if (!item) return false
    if (normalizedStatus === 'published') return item.hasPublishedVersion
    if (normalizedStatus === 'draft') return !item.hasPublishedVersion
    return true
  }).sort(compareDocuments)
}

export async function getJournalIssues({ page = 1, pageSize = 10, q = '', status = '' } = {}) {
  const [draftRows, publishedRows] = await Promise.all([
    fetchAllJournalIssuesByStatus({ q, status: 'draft' }),
    fetchAllJournalIssuesByStatus({ q, status: 'published' }),
  ])

  const documents = mergeDocumentVersions(draftRows, publishedRows, status)
  const currentPage = Math.max(1, Number(page || 1))
  const normalizedPageSize = Math.max(1, Number(pageSize || 10))
  const total = documents.length
  const pageCount = Math.max(1, Math.ceil(total / normalizedPageSize))
  const safePage = Math.min(currentPage, pageCount)
  const start = (safePage - 1) * normalizedPageSize

  return {
    data: documents.slice(start, start + normalizedPageSize),
    meta: {
      pagination: {
        page: safePage,
        pageSize: normalizedPageSize,
        pageCount,
        total,
      },
    },
  }
}

export async function getJournalIssueById(id, options = {}) {
  const normalizedStatus = String(options?.status || 'published').trim().toLowerCase() === 'draft' ? 'draft' : 'published'
  const res = await api.get(`/journal-issues/${id}`, {
    params: {
      populate: '*',
      status: normalizedStatus,
    },
  })

  return normalizePayload(res.data, normalizeJournalIssue)
}

export async function createJournalIssue(payload, options = {}) {
  const normalizedStatus = String(options?.status || 'draft').trim().toLowerCase() === 'published' ? 'published' : 'draft'
  const res = await api.post('/journal-issues', { data: payload }, {
    params: {
      status: normalizedStatus,
    },
  })

  return normalizePayload(res.data, normalizeJournalIssue)
}

export async function updateJournalIssue(id, payload, options = {}) {
  const normalizedStatus = String(options?.status || 'draft').trim().toLowerCase() === 'published' ? 'published' : 'draft'
  const res = await api.put(`/journal-issues/${id}`, { data: payload }, {
    params: {
      status: normalizedStatus,
    },
  })

  return normalizePayload(res.data, normalizeJournalIssue)
}

export async function deleteJournalIssue(id) {
  const res = await api.delete(`/journal-issues/${id}`)
  return res.data
}

export async function createJournalIssueItem(payload) {
  const res = await api.post('/journal-issue-items', { data: payload })
  return normalizePayload(res.data, normalizeJournalIssueItem)
}

export async function updateJournalIssueItem(id, payload) {
  const res = await api.put(`/journal-issue-items/${id}`, { data: payload })
  return normalizePayload(res.data, normalizeJournalIssueItem)
}

export async function deleteJournalIssueItem(id) {
  const res = await api.delete(`/journal-issue-items/${id}`)
  return res.data
}

export async function getArticleOptions(q = '') {
  const [draftRows, publishedRows] = await Promise.all([
    fetchAllArticleOptionsByStatus({ q, status: 'draft' }),
    fetchAllArticleOptionsByStatus({ q, status: 'published' }),
  ])

  return mergeDocumentVersions(draftRows, publishedRows, '')
    .map((item) => ({
      id: item?.id,
      documentId: item?.documentId,
      title: item?.title,
      slug: item?.slug,
      statusLabel: item?.statusLabel,
    }))
}

export async function uploadMediaFiles(files = []) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const res = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return Array.isArray(res?.data) ? res.data.map(normalizeMedia).filter(Boolean) : []
}

export function getMediaRelationId(value) {
  const raw = value?.id ?? value
  if (raw === null || raw === undefined || raw === '') return null
  return raw
}

export function getRelationId(value) {
  const raw = value?.documentId ?? value?.id ?? value
  if (raw === null || raw === undefined || raw === '') return null
  return raw
}

export function getMediaUrl(value) {
  return String(value?.url || value?.attributes?.url || '').trim()
}