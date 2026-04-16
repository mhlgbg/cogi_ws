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

function normalizeAuthorPayload(payload) {
  const rawRows = Array.isArray(payload?.data) ? payload.data : []
  const rows = rawRows.map((row) => {
    if (!row || typeof row !== 'object') return null
    if (row.attributes && typeof row.attributes === 'object') {
      const normalized = {
        id: row.id,
        ...row.attributes,
      }

      if (normalized.avatar && typeof normalized.avatar === 'object') {
        normalized.avatar = {
          ...normalized.avatar,
          url: toAbsoluteUrl(normalized.avatar?.url),
          attributes: normalized.avatar?.attributes
            ? {
              ...normalized.avatar.attributes,
              url: toAbsoluteUrl(normalized.avatar.attributes?.url),
            }
            : normalized.avatar?.attributes,
          data: normalized.avatar?.data
            ? {
              ...normalized.avatar.data,
              url: toAbsoluteUrl(normalized.avatar.data?.url),
              attributes: normalized.avatar.data?.attributes
                ? {
                  ...normalized.avatar.data.attributes,
                  url: toAbsoluteUrl(normalized.avatar.data.attributes?.url),
                }
                : normalized.avatar.data?.attributes,
            }
            : normalized.avatar?.data,
        }
      }

      return normalized
    }

    if (row.avatar && typeof row.avatar === 'object') {
      return {
        ...row,
        avatar: {
          ...row.avatar,
          url: toAbsoluteUrl(row.avatar?.url),
          attributes: row.avatar?.attributes
            ? {
              ...row.avatar.attributes,
              url: toAbsoluteUrl(row.avatar.attributes?.url),
            }
            : row.avatar?.attributes,
          data: row.avatar?.data
            ? {
              ...row.avatar.data,
              url: toAbsoluteUrl(row.avatar.data?.url),
              attributes: row.avatar.data?.attributes
                ? {
                  ...row.avatar.data.attributes,
                  url: toAbsoluteUrl(row.avatar.data.attributes?.url),
                }
                : row.avatar.data?.attributes,
            }
            : row.avatar?.data,
        },
      }
    }

    return row
  }).filter(Boolean)

  return {
    data: rows,
    meta: payload?.meta || null,
  }
}

export async function getAuthors({ page = 1, pageSize = 10, q = '' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'name:asc',
    populate: 'avatar',
  }

  const keyword = String(q || '').trim()
  if (keyword) {
    params['filters[$or][0][name][$containsi]'] = keyword
    params['filters[$or][1][email][$containsi]'] = keyword
  }

  const res = await api.get('/authors', { params })
  return normalizeAuthorPayload(res.data)
}

export async function createAuthor(payload) {
  const res = await api.post('/authors', { data: payload })
  return res.data
}

export async function updateAuthor(id, payload) {
  const res = await api.put(`/authors/${id}`, { data: payload })
  return res.data
}

export async function deleteAuthor(id) {
  const res = await api.delete(`/authors/${id}`)
  return res.data
}