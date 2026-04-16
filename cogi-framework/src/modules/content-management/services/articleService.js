import api from '../../../api/axios'

function toAbsoluteUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw

  try {
    const apiBase = String(api.defaults.baseURL || window.location.origin)
    const origin = new URL(apiBase, window.location.origin).origin
    return new URL(raw, origin).toString()
  } catch {
    return raw
  }
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

function normalizeBlock(block) {
  if (!block || typeof block !== 'object') return null
  const componentKey = String(block.__component || block.component || '').trim()
  if (!componentKey) return null

  if (componentKey === 'shared.media') {
    return {
      ...block,
      __component: componentKey,
      file: normalizeMedia(block.file),
    }
  }

  if (componentKey === 'shared.slider') {
    const filesSource = Array.isArray(block.files)
      ? block.files
      : Array.isArray(block.files?.data)
        ? block.files.data
        : []

    return {
      ...block,
      __component: componentKey,
      files: filesSource.map(normalizeMedia).filter(Boolean),
    }
  }

  return {
    ...block,
    __component: componentKey,
  }
}

function normalizeArticle(row) {
  if (!row || typeof row !== 'object') return null

  const base = row.attributes && typeof row.attributes === 'object'
    ? {
      id: row.id,
      ...row.attributes,
    }
    : row

  return {
    ...base,
    author: normalizeRelation(base.author),
    category: normalizeRelation(base.category),
    tenant: normalizeRelation(base.tenant),
    cover: normalizeMedia(base.cover),
    blocks: Array.isArray(base.blocks) ? base.blocks.map(normalizeBlock).filter(Boolean) : [],
  }
}

function normalizeArticlePayload(payload) {
  if (Array.isArray(payload?.data)) {
    return {
      data: payload.data.map(normalizeArticle).filter(Boolean),
      meta: payload?.meta || null,
    }
  }

  if (payload?.data && typeof payload.data === 'object') {
    return {
      ...payload,
      data: normalizeArticle(payload.data),
    }
  }

  return {
    data: [],
    meta: payload?.meta || null,
  }
}

function buildArticleQueryParams({ page = 1, pageSize = 10, q = '', status = 'published' } = {}) {
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
    params['filters[$or][2][description][$containsi]'] = keyword
    params['filters[$or][3][author][name][$containsi]'] = keyword
    params['filters[$or][4][category][name][$containsi]'] = keyword
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

function compareArticleDocuments(left, right) {
  const leftDate = toTimestamp(left?.displayDate || left?.updatedAt)
  const rightDate = toTimestamp(right?.displayDate || right?.updatedAt)
  if (leftDate !== rightDate) return rightDate - leftDate

  const leftUpdatedAt = toTimestamp(left?.updatedAt)
  const rightUpdatedAt = toTimestamp(right?.updatedAt)
  if (leftUpdatedAt !== rightUpdatedAt) return rightUpdatedAt - leftUpdatedAt

  return String(left?.title || '').localeCompare(String(right?.title || ''))
}

async function fetchAllArticlesByStatus({ q = '', status = 'published' } = {}) {
  const rows = []
  const pageSize = 100
  let page = 1
  let pageCount = 1

  do {
    const res = await api.get('/articles', {
      params: buildArticleQueryParams({ page, pageSize, q, status }),
    })

    const normalized = normalizeArticlePayload(res.data)
    rows.push(...(normalized?.data || []))
    pageCount = Math.max(1, Number(normalized?.meta?.pagination?.pageCount || 1))
    page += 1
  } while (page <= pageCount)

  return rows
}

function mergeArticleDocuments(draftRows = [], publishedRows = [], status = '') {
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
  }).sort(compareArticleDocuments)
}

export async function getArticles({ page = 1, pageSize = 10, q = '', status = '' } = {}) {
  const [draftRows, publishedRows] = await Promise.all([
    fetchAllArticlesByStatus({ q, status: 'draft' }),
    fetchAllArticlesByStatus({ q, status: 'published' }),
  ])

  const documents = mergeArticleDocuments(draftRows, publishedRows, status)
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

export async function getArticleById(id, options = {}) {
  const normalizedStatus = String(options?.status || 'published').trim().toLowerCase() === 'draft' ? 'draft' : 'published'
  const res = await api.get(`/articles/${id}`, {
    params: {
      populate: '*',
      status: normalizedStatus,
    },
  })

  return normalizeArticlePayload(res.data)
}

export async function createArticle(payload, options = {}) {
  const normalizedStatus = String(options?.status || 'draft').trim().toLowerCase() === 'published' ? 'published' : 'draft'
  const res = await api.post('/articles', { data: payload }, {
    params: {
      status: normalizedStatus,
    },
  })
  return normalizeArticlePayload(res.data)
}

export async function updateArticle(id, payload, options = {}) {
  const normalizedStatus = String(options?.status || 'draft').trim().toLowerCase() === 'published' ? 'published' : 'draft'
  const res = await api.put(`/articles/${id}`, { data: payload }, {
    params: {
      status: normalizedStatus,
    },
  })
  return normalizeArticlePayload(res.data)
}

export async function deleteArticle(id) {
  const res = await api.delete(`/articles/${id}`)
  return res.data
}

export async function uploadMediaFiles(files = []) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const res = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  const rows = Array.isArray(res?.data) ? res.data.map(normalizeMedia).filter(Boolean) : []
  return rows
}

export function getRelationId(value) {
  const raw = value?.id ?? value?.documentId ?? value
  if (raw === null || raw === undefined || raw === '') return null
  return raw
}

export function getMediaUrl(value) {
  return String(value?.url || value?.attributes?.url || '').trim()
}