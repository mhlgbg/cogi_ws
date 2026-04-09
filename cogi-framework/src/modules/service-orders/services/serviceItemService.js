import api from '../../../api/axios'

export async function getServiceItems({ page = 1, pageSize = 10, q = '', categoryId = '', isActive = '' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'sortOrder:asc',
    'sort[1]': 'name:asc',
    populate: 'category',
  }

  const keyword = String(q || '').trim()
  if (keyword) {
    params['filters[$or][0][name][$containsi]'] = keyword
    params['filters[$or][1][code][$containsi]'] = keyword
    params['filters[$or][2][description][$containsi]'] = keyword
    params.q = keyword
  }

  const category = Number(categoryId)
  if (Number.isInteger(category) && category > 0) {
    params['filters[category][id][$eq]'] = category
  }

  if (isActive === true || isActive === false) {
    params['filters[isActive][$eq]'] = isActive
  } else if (String(isActive) === 'true' || String(isActive) === 'false') {
    params['filters[isActive][$eq]'] = String(isActive) === 'true'
  }

  const res = await api.get('/service-items', { params })
  return res.data
}

export async function getServiceCategoriesLookup({ pageSize = 200, isActive } = {}) {
  const params = {
    'pagination[page]': 1,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'sortOrder:asc',
    'sort[1]': 'name:asc',
  }

  if (isActive === true || isActive === false) {
    params['filters[isActive][$eq]'] = isActive
  }

  const res = await api.get('/service-categories', { params })
  return res.data
}

export async function createServiceItem(payload) {
  const res = await api.post('/service-items', { data: payload })
  return res.data
}

export async function updateServiceItem(id, payload) {
  const res = await api.put(`/service-items/${id}`, { data: payload })
  return res.data
}

export async function deleteServiceItem(id) {
  const res = await api.delete(`/service-items/${id}`)
  return res.data
}