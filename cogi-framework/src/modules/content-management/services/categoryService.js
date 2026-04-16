import api from '../../../api/axios'

function normalizeCategoryPayload(payload) {
  const rawRows = Array.isArray(payload?.data) ? payload.data : []
  const rows = rawRows.map((row) => {
    if (!row || typeof row !== 'object') return null
    if (row.attributes && typeof row.attributes === 'object') {
      return {
        id: row.id,
        ...row.attributes,
      }
    }

    return row
  }).filter(Boolean)

  return {
    data: rows,
    meta: payload?.meta || null,
  }
}

export async function getCategories({ page = 1, pageSize = 10, q = '' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'name:asc',
  }

  const keyword = String(q || '').trim()
  if (keyword) {
    params['filters[$or][0][name][$containsi]'] = keyword
    params['filters[$or][1][slug][$containsi]'] = keyword
    params['filters[$or][2][description][$containsi]'] = keyword
  }

  const res = await api.get('/categories', { params })
  return normalizeCategoryPayload(res.data)
}

export async function createCategory(payload) {
  const res = await api.post('/categories', { data: payload })
  return res.data
}

export async function updateCategory(id, payload) {
  const res = await api.put(`/categories/${id}`, { data: payload })
  return res.data
}

export async function deleteCategory(id) {
  const res = await api.delete(`/categories/${id}`)
  return res.data
}