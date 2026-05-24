import api from '../../api/axios'
import { resolveMediaUrl } from '../../utils/mediaUrl'

export function toAbsoluteUrl(url) {
  return resolveMediaUrl(url)
}

export function normalizeRelation(value) {
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

export function normalizeMedia(value) {
  const relation = normalizeRelation(value)
  if (!relation || typeof relation !== 'object') return relation

  return {
    ...relation,
    url: toAbsoluteUrl(relation.url),
    formats: relation.formats && typeof relation.formats === 'object'
      ? Object.fromEntries(
        Object.entries(relation.formats).map(([key, item]) => [
          key,
          item && typeof item === 'object'
            ? { ...item, url: toAbsoluteUrl(item.url) }
            : item,
        ]),
      )
      : relation.formats,
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
    article: normalizeRelation(base.article),
    journalIssue: normalizeRelation(base.journalIssue),
    pdfFile: normalizeMedia(base.pdfFile),
    tenant: normalizeRelation(base.tenant),
  }
}

function normalizeJournalIssueRow(row) {
  if (!row || typeof row !== 'object') return null

  const base = row.attributes && typeof row.attributes === 'object'
    ? {
      id: row.id,
      ...row.attributes,
    }
    : row

  const itemsSource = Array.isArray(base.issueItems)
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
    issueItems: itemsSource.map(normalizeJournalIssueItem).filter(Boolean),
  }
}

export function normalizeJournalIssueList(payload) {
  const rawRows = Array.isArray(payload?.data) ? payload.data : []
  return rawRows.map(normalizeJournalIssueRow).filter(Boolean)
}

export function normalizeSingleJournalIssue(payload) {
  const firstRow = Array.isArray(payload?.data) ? payload.data[0] : null
  return normalizeJournalIssueRow(firstRow)
}

function normalizeJournalCategoryRow(row) {
  if (!row || typeof row !== 'object') return null
  return row.attributes && typeof row.attributes === 'object'
    ? { id: row.id, ...row.attributes }
    : row
}

export function normalizeJournalCategoryList(payload) {
  const rawRows = Array.isArray(payload?.data) ? payload.data : []
  return rawRows.map(normalizeJournalCategoryRow).filter(Boolean)
}

export function normalizeSingleJournalCategory(payload) {
  const firstRow = Array.isArray(payload?.data) ? payload.data[0] : null
  return normalizeJournalCategoryRow(firstRow)
}

export function normalizePagination(payload, defaultPageSize = 10) {
  const pagination = payload?.meta?.pagination
  return {
    page: Number(pagination?.page || 1),
    pageCount: Math.max(1, Number(pagination?.pageCount || 1)),
    pageSize: Number(pagination?.pageSize || defaultPageSize),
    total: Number(pagination?.total || 0),
  }
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export function formatDisplayDate(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'

  return new Date(timestamp).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function sanitizeHtml(html) {
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

  blockedTags.forEach((tagName) => {
    documentNode.querySelectorAll(tagName).forEach((node) => node.remove())
  })

  documentNode.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = String(attribute.name || '').toLowerCase()
      const value = String(attribute.value || '')

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name)
        return
      }

      if ((name === 'href' || name === 'src') && /^javascript:/i.test(value.trim())) {
        element.removeAttribute(attribute.name)
      }
    })
  })

  return documentNode.body.innerHTML
}

export function getMediaUrl(file) {
  return toAbsoluteUrl(file?.url || file?.attributes?.url || '')
}

export function getMediaName(file) {
  return String(file?.name || file?.attributes?.name || '').trim()
}

export function getMediaMimeType(file) {
  return String(file?.mime || file?.attributes?.mime || '').trim().toLowerCase()
}

export function isPdfFile(file) {
  const mediaUrl = getMediaUrl(file).toLowerCase()
  const mediaName = getMediaName(file).toLowerCase()
  const mimeType = getMediaMimeType(file)

  return mimeType === 'application/pdf' || mediaUrl.endsWith('.pdf') || mediaName.endsWith('.pdf')
}