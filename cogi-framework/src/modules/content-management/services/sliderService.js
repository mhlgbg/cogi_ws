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

function normalizeSliderItem(item) {
  const entity = normalizeEntity(item)
  if (!entity || typeof entity !== 'object') return null

  return {
    ...entity,
    image: normalizeMedia(entity.image),
  }
}

function normalizeSlider(row) {
  const entity = normalizeEntity(row)
  if (!entity || typeof entity !== 'object') return null

  const itemsSource = Array.isArray(entity.items)
    ? entity.items
    : Array.isArray(entity.items?.data)
      ? entity.items.data
      : []

  return {
    ...entity,
    items: itemsSource.map(normalizeSliderItem).filter(Boolean),
  }
}

export async function getSliderByCode(code) {
  const normalizedCode = String(code || '').trim()
  if (!normalizedCode) return []

  const params = {
    'filters[code]': normalizedCode,
    populate: 'items',
  }

  const res = await api.get('/sliders', { params })
  const rows = Array.isArray(res?.data?.data) ? res.data.data : []
  const slider = normalizeSlider(rows[0])
  return Array.isArray(slider?.items) ? slider.items : []
}