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

function normalizeEntity(row) {
  if (!row || typeof row !== 'object') return null
  if (row.attributes && typeof row.attributes === 'object') {
    return {
      id: row.id,
      ...row.attributes,
    }
  }

  return row
}

function normalizeMedia(value) {
  if (!value) return null
  const media = value?.data ? normalizeEntity(value.data) : normalizeEntity(value)
  if (!media || typeof media !== 'object') return media

  return {
    ...media,
    url: toAbsoluteUrl(media.url),
  }
}

function normalizeSliderItem(row) {
  const entity = normalizeEntity(row)
  if (!entity || typeof entity !== 'object') return null

  return {
    ...entity,
    slider: normalizeEntity(entity.slider),
    image: normalizeMedia(entity.image),
  }
}

function normalizeCollection(payload, mapper = normalizeEntity) {
  const rawRows = Array.isArray(payload?.data) ? payload.data : []
  return {
    data: rawRows.map(mapper).filter(Boolean),
    meta: payload?.meta || null,
  }
}

export async function getSliderItems({ page = 1, pageSize = 10, q = '', sliderId = '' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'order:asc',
    'sort[1]': 'createdAt:desc',
    'populate[0]': 'slider',
    'populate[1]': 'image',
  }

  const keyword = String(q || '').trim()
  if (keyword) {
    params['filters[$or][0][title][$containsi]'] = keyword
    params['filters[$or][1][description][$containsi]'] = keyword
    params['filters[$or][2][link][$containsi]'] = keyword
  }

  const sliderRef = Number(sliderId)
  if (Number.isInteger(sliderRef) && sliderRef > 0) {
    params['filters[slider][id][$eq]'] = sliderRef
  }

  const res = await api.get('/slider-items', { params })
  return normalizeCollection(res.data, normalizeSliderItem)
}

export async function createSliderItem(payload) {
  const res = await api.post('/slider-items', { data: payload })
  return res.data
}

export async function updateSliderItem(id, payload) {
  const res = await api.put(`/slider-items/${id}`, { data: payload })
  return res.data
}

export async function deleteSliderItem(id) {
  const res = await api.delete(`/slider-items/${id}`)
  return res.data
}

export async function getSliderOptions() {
  const res = await api.get('/sliders', {
    params: {
      'pagination[page]': 1,
      'pagination[pageSize]': 200,
      'sort[0]': 'name:asc',
    },
  })

  return normalizeCollection(res.data, normalizeEntity).data
}

export async function uploadSliderItemImage(file) {
  const formData = new FormData()
  formData.append('files', file)

  const res = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  const rows = Array.isArray(res?.data) ? res.data.map(normalizeMedia).filter(Boolean) : []
  return rows[0] || null
}