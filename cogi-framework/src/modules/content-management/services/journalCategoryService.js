import api from '../../../api/axios'

function normalizeJournalCategoryPayload(payload) {
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

export async function getJournalCategories({ page = 1, pageSize = 10, q = '' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'title:asc',
  }

  const keyword = String(q || '').trim()
  if (keyword) {
    params['filters[$or][0][title][$containsi]'] = keyword
    params['filters[$or][1][slug][$containsi]'] = keyword
    params['filters[$or][2][description][$containsi]'] = keyword
  }

  const res = await api.get('/journal-categories', { params })
  return normalizeJournalCategoryPayload(res.data)
}

export async function createJournalCategory(payload) {
  const res = await api.post('/journal-categories', { data: payload })
  return res.data
}

export async function updateJournalCategory(id, payload) {
  const res = await api.put(`/journal-categories/${id}`, { data: payload })
  return res.data
}

export async function deleteJournalCategory(id) {
  const res = await api.delete(`/journal-categories/${id}`)
  return res.data
}

export async function getAllJournalCategoryOptions() {
  const rows = []
  const pageSize = 100
  let page = 1
  let pageCount = 1

  do {
    const res = await getJournalCategories({ page, pageSize, q: '' })
    rows.push(...(res?.data || []))
    pageCount = Math.max(1, Number(res?.meta?.pagination?.pageCount || 1))
    page += 1
  } while (page <= pageCount)

  return rows.map((item) => ({
    id: item?.id,
    rawId: item?.id,
    documentId: item?.documentId,
    title: item?.title || '',
    slug: item?.slug || '',
    description: item?.description || '',
  }))
}