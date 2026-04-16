import api from '../../../api/axios'

function normalizeSliderPayload(payload) {
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

export async function getSliders({ page = 1, pageSize = 10, q = '' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'createdAt:desc',
    populate: 'tenant',
  }

  const keyword = String(q || '').trim()
  if (keyword) {
    params['filters[$or][0][name][$containsi]'] = keyword
    params['filters[$or][1][code][$containsi]'] = keyword
  }

  const res = await api.get('/sliders', { params })
  return normalizeSliderPayload(res.data)
}

export async function createSlider(payload) {
  const res = await api.post('/sliders', { data: payload })
  return res.data
}

export async function updateSlider(id, payload) {
  const res = await api.put(`/sliders/${id}`, { data: payload })
  return res.data
}

export async function deleteSlider(id) {
  const res = await api.delete(`/sliders/${id}`)
  return res.data
}